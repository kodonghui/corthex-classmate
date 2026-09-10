//! 시험용 가짜 Tiro — `std::net` 위의 작은 HTTP/1.1 서버. 실제 Tiro 를 부르지 않는다(인수인계 §4.3).
//!
//! 세 경로를 흉내 낸다(응답 모양은 kickoff §Tiro 공식 API 실측 그대로):
//! - `GET /v1/external/workspaces/me` → `{"guid":"ws-1"}`
//! - `GET /v1/external/workspaces/ws-1/notes?size=8` → `{"content":[…],"nextCursor":null}`
//! - `GET /v1/external/notes/{guid}/paragraphs?size=N[&cursor=cK]` → 서버 쪽 페이지 상한으로 잘라
//!   `nextCursor` 를 `c<다음 오프셋>` 으로 준다. 모르는 노트는 404.
//!
//! `Authorization: Bearer <key>` 가 다르면 401. `set_status_override` 로 아무 상태나 강제할 수 있다.
//! 받은 요청(경로 · Authorization)은 전부 기록한다.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use serde_json::{json, Value};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Recorded {
    pub path: String,
    pub authorization: Option<String>,
}

#[derive(Default)]
struct State {
    expected_key: String,
    notes: Vec<Value>,
    paragraphs: HashMap<String, Vec<Value>>,
    page_cap: usize,
    status_override: Option<u16>,
    requests: Vec<Recorded>,
}

pub struct FakeTiro {
    port: u16,
    state: Arc<Mutex<State>>,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl FakeTiro {
    pub fn start(expected_key: &str) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").expect("loopback 포트를 열 수 있어야 한다");
        let port = listener.local_addr().unwrap().port();
        let state = Arc::new(Mutex::new(State {
            expected_key: expected_key.to_string(),
            page_cap: 1_000,
            ..State::default()
        }));
        let stop = Arc::new(AtomicBool::new(false));

        let thread = {
            let state = Arc::clone(&state);
            let stop = Arc::clone(&stop);
            std::thread::spawn(move || {
                for stream in listener.incoming() {
                    if stop.load(Ordering::Relaxed) {
                        break;
                    }
                    if let Ok(stream) = stream {
                        let _ = serve_one(stream, &state);
                    }
                }
            })
        };

        Self {
            port,
            state,
            stop,
            thread: Some(thread),
        }
    }

    pub fn base_url(&self) -> String {
        format!("http://127.0.0.1:{}/v1/external", self.port)
    }

    pub fn add_note(
        &self,
        guid: &str,
        title: Option<&str>,
        started_at: &str,
        ended_at: Option<&str>,
    ) {
        let mut state = self.state.lock().unwrap();
        state.notes.push(json!({
            "guid": guid,
            "title": title,
            "sourceType": "RECORDING",
            "recordingStartAt": started_at,
            "recordingEndAt": ended_at,
            "webUrl": format!("https://example.invalid/notes/{guid}")
        }));
        state.paragraphs.entry(guid.to_string()).or_default();
    }

    pub fn end_note(&self, guid: &str, ended_at: &str) {
        let mut state = self.state.lock().unwrap();
        for note in &mut state.notes {
            if note["guid"] == guid {
                note["recordingEndAt"] = json!(ended_at);
            }
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn add_paragraph(
        &self,
        note_guid: &str,
        uuid: &str,
        time_from: &str,
        time_to: &str,
        text: &str,
        summary_md: Option<&str>,
        locked: bool,
    ) {
        let mut state = self.state.lock().unwrap();
        state
            .paragraphs
            .entry(note_guid.to_string())
            .or_default()
            .push(json!({
                "uuid": uuid,
                "transcript": {"type": "TEXT", "content": text},
                "summary": {"markdown": summary_md},
                "translated": null,
                "diarizedSegments": [],
                "timeFrom": time_from,
                "timeTo": time_to,
                "locked": locked
            }));
    }

    pub fn update_paragraph(
        &self,
        note_guid: &str,
        uuid: &str,
        time_to: &str,
        text: &str,
        locked: bool,
    ) {
        let mut state = self.state.lock().unwrap();
        if let Some(list) = state.paragraphs.get_mut(note_guid) {
            for paragraph in list {
                if paragraph["uuid"] == uuid {
                    paragraph["timeTo"] = json!(time_to);
                    paragraph["transcript"]["content"] = json!(text);
                    paragraph["locked"] = json!(locked);
                }
            }
        }
    }

    /// 서버 쪽 페이지 상한(요청의 `size` 보다 작으면 이 값으로 자른다).
    pub fn set_page_cap(&self, cap: usize) {
        self.state.lock().unwrap().page_cap = cap.max(1);
    }

    pub fn set_status_override(&self, status: Option<u16>) {
        self.state.lock().unwrap().status_override = status;
    }

    pub fn requests(&self) -> Vec<Recorded> {
        self.state.lock().unwrap().requests.clone()
    }
}

impl Drop for FakeTiro {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        // accept 를 깨우는 빈 연결.
        let _ = TcpStream::connect(("127.0.0.1", self.port));
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn serve_one(mut stream: TcpStream, state: &Mutex<State>) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let target = parts.next().unwrap_or("").to_string();

    let mut authorization = None;
    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line)? == 0 || line == "\r\n" || line == "\n" {
            break;
        }
        if let Some((name, value)) = line.split_once(':') {
            let value = value.trim();
            if name.eq_ignore_ascii_case("authorization") {
                authorization = Some(value.to_string());
            } else if name.eq_ignore_ascii_case("content-length") {
                content_length = value.parse().unwrap_or(0);
            }
        }
    }
    if content_length > 0 {
        let mut body = vec![0u8; content_length];
        reader.read_exact(&mut body)?;
    }

    let (status, body) = {
        let mut state = state.lock().unwrap();
        state.requests.push(Recorded {
            path: target.clone(),
            authorization: authorization.clone(),
        });
        respond(&state, &method, &target, authorization.as_deref())
    };

    let reason = match status {
        200 => "OK",
        401 => "Unauthorized",
        404 => "Not Found",
        _ => "Status",
    };
    let text = body.to_string();
    write!(
        stream,
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{text}",
        text.len()
    )?;
    stream.flush()
}

fn respond(state: &State, method: &str, target: &str, authorization: Option<&str>) -> (u16, Value) {
    if let Some(status) = state.status_override {
        return (status, json!({"message": "forced"}));
    }
    if method != "GET" {
        return (405, json!({"message": "method"}));
    }
    if authorization != Some(&format!("Bearer {}", state.expected_key)) {
        return (401, json!({"message": "unauthorized"}));
    }

    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    let query: HashMap<String, String> = query
        .split('&')
        .filter(|pair| !pair.is_empty())
        .filter_map(|pair| pair.split_once('='))
        .map(|(key, value)| (key.to_string(), percent_decode(value)))
        .collect();

    if path == "/v1/external/workspaces/me" {
        return (200, json!({"guid": "ws-1"}));
    }
    if path == "/v1/external/workspaces" {
        // 실측(2026-09-10) 모양: {"workspaces":[{guid,name,isWikiEnabled}]}
        return (
            200,
            json!({"workspaces": [
                {"guid": "ws-1", "name": "시험 워크스페이스", "isWikiEnabled": false},
                {"guid": "ws-2", "name": "다른 워크스페이스", "isWikiEnabled": true}
            ]}),
        );
    }
    if path == "/v1/external/workspaces/ws-1/notes" {
        return (200, json!({"content": state.notes, "nextCursor": null}));
    }
    if let Some(rest) = path.strip_prefix("/v1/external/notes/") {
        if let Some(guid) = rest.strip_suffix("/paragraphs") {
            let Some(list) = state.paragraphs.get(guid) else {
                return (404, json!({"message": "note not found"}));
            };
            let size: usize = query
                .get("size")
                .and_then(|value| value.parse().ok())
                .unwrap_or(1_000);
            let page = size.min(state.page_cap).max(1);
            let offset: usize = query
                .get("cursor")
                .and_then(|value| value.strip_prefix('c'))
                .and_then(|value| value.parse().ok())
                .unwrap_or(0);
            let end = (offset + page).min(list.len());
            let next = if end < list.len() {
                json!(format!("c{end}"))
            } else {
                Value::Null
            };
            return (
                200,
                json!({"content": list[offset.min(list.len())..end], "nextCursor": next}),
            );
        }
    }
    (404, json!({"message": "no route"}))
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() + 1 && index + 2 <= bytes.len() - 1 + 1 {
            if let Ok(byte) = u8::from_str_radix(&value[index + 1..index + 3], 16) {
                out.push(byte);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}
