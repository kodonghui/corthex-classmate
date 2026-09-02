//! Corthex Classmate 로컬 도우미(Chrome Native Messaging Host)의 진입점.
//!
//! 하는 일은 둘이다. 하나는 신원 확인(`ping` → `hello`), 다른 하나는 **교시 기록 보관**이다.
//! 확장이 보낸 세션 기록을 교시별 SQLite(WAL) 파일에 붙이고, 얼마나 쌓였는지 알려 주고,
//! 요청하면 JSONL 로 내보낸다. stdin 이 닫히면 0 으로 끝난다.
//!
//! 지키는 경계 (docs/master-prompt.md §4):
//! - stdout 은 프로토콜 전용이다. 사람이 읽을 로그는 전부 stderr 로만 나간다.
//! - 메시지 안의 문자열을 명령·셸로 절대 넘기지 않는다(§4-7). `periodId` 는 글자 집합을 좁혀
//!   받고 내보내기 경로는 이미 있는 폴더의 `.jsonl` 만 받는다. 실행 경로 자체가 없다.
//! - 오류로 되돌려 보내는 값에 본문 원문이나 파일 경로를 담지 않는다.
//! - 네트워크로 내보내는 코드가 없다. 수업 데이터는 이 PC 안에만 남는다(§4-1).

use std::collections::HashMap;
use std::io::{self, BufWriter, Read, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use serde::Deserialize;
use serde_json::{json, Value};

use classmate_host::protocol::{self, Frame};
use classmate_host::store::{self, SessionEvent, SessionStore, StoreError};

/// 확장이 이해하는 프로토콜 세대. 모양이 바뀌면 올린다.
const PROTOCOL_VERSION: u64 = 1;

/// 모르는 type 을 그대로 되돌려 줄 때의 길이 상한.
/// 확장이 보낸 긴 문장이 응답과 로그로 되돌아가지 않게 잘라 낸다.
const ECHOED_TYPE_MAX_CHARS: usize = 64;

/// 봉투에서 우리가 보는 것은 type 하나뿐이다. 나머지 필드는 아직 읽지 않는다.
#[derive(Debug, Default, Deserialize)]
struct Envelope {
    #[serde(rename = "type", default)]
    kind: Option<String>,
}

fn main() -> ExitCode {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = stdin.lock();
    let mut writer = BufWriter::new(stdout.lock());

    match serve(&mut reader, &mut writer) {
        Ok(()) => {
            eprintln!("[classmate-host] stdin 이 닫혀서 끝냅니다");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("[classmate-host] 프로토콜 오류 · {error}");
            ExitCode::FAILURE
        }
    }
}

/// stdin 이 닫힐 때까지 프레임을 하나씩 읽고 답한다.
///
/// 본문을 끝까지 읽었는데 JSON 이 아니었던 프레임은 **오류로 답하고 계속 산다**. 스트림이
/// 다음 프레임 경계에 그대로 서 있기 때문이다. 프레임 자체가 깨졌을 때(길이 헤더가 끊김·본문이
/// 잘림·상한 초과)만 다음 경계를 알 수 없어 오류로 끝낸다.
fn serve<R: Read, W: Write>(reader: &mut R, writer: &mut W) -> io::Result<()> {
    let mut router = Router::new();

    loop {
        match protocol::read_frame(reader)? {
            Frame::Eof => return Ok(()),
            Frame::Message(message) => {
                let reply = router.handle(&message);
                protocol::write_message(writer, &reply)?;
            }
            Frame::Undecodable { bytes, detail } => {
                eprintln!("[classmate-host] 읽을 수 없는 프레임 · {detail}");
                protocol::write_message(writer, &undecodable_reply(bytes))?;
            }
        }
    }
}

/// 열어 둔 교시 저장소를 들고 메시지를 나눠 주는 자리.
///
/// 저장소는 `periodId` 마다 하나씩 열어 두고 다시 쓴다. 교시 하나가 파일 하나이므로
/// 8교시를 들어도 열려 있는 손잡이는 최대 여덟 개다.
struct Router {
    /// 이미 정해진 저장 폴더. `None` 이면 첫 저장 메시지에서 환경을 보고 정한다.
    data_dir: Option<PathBuf>,
    stores: HashMap<String, SessionStore>,
}

impl Router {
    /// 저장 폴더를 아직 정하지 않은 채로 만든다. `ping` 만 오가면 폴더를 건드리지 않는다.
    fn new() -> Self {
        Self {
            data_dir: None,
            stores: HashMap::new(),
        }
    }

    /// 저장 폴더를 못 박아 만든다. 시험이 임시 폴더를 쓰려고 쓴다.
    #[cfg(test)]
    fn with_data_dir(data_dir: PathBuf) -> Self {
        Self {
            data_dir: Some(data_dir),
            stores: HashMap::new(),
        }
    }

    fn handle(&mut self, message: &Value) -> Value {
        let kind = message.get("type").and_then(Value::as_str).unwrap_or("");

        match kind {
            "event.append" => self
                .try_append(message)
                .unwrap_or_else(|error| store_failure(kind, &error)),
            "session.status" => self
                .try_status(message)
                .unwrap_or_else(|error| store_failure(kind, &error)),
            "session.export" => self
                .try_export(message)
                .unwrap_or_else(|error| store_failure(kind, &error)),
            _ => respond(message),
        }
    }

    /// 이 교시의 저장소를 준다. 아직 없으면 그때 연다.
    fn store(&mut self, period_id: &str) -> store::Result<&SessionStore> {
        let data_dir = match &self.data_dir {
            Some(existing) => existing.clone(),
            None => {
                let resolved = store::default_data_dir()?;
                self.data_dir = Some(resolved.clone());
                resolved
            }
        };

        if !self.stores.contains_key(period_id) {
            let opened = SessionStore::open(&data_dir, period_id)?;
            eprintln!("[classmate-host] 교시 {period_id} 저장소를 열었습니다");
            self.stores.insert(period_id.to_string(), opened);
        }

        Ok(self
            .stores
            .get(period_id)
            .expect("방금 넣었으므로 반드시 있다"))
    }

    fn try_append(&mut self, message: &Value) -> store::Result<Value> {
        let period_id = period_id_of(message)?;
        let raw = message
            .get("event")
            .cloned()
            .ok_or(StoreError::MalformedEvent("event"))?;
        let event: SessionEvent =
            serde_json::from_value(raw).map_err(|_| StoreError::MalformedEvent("event"))?;

        let seq = self.store(&period_id)?.append(&event)?;

        Ok(json!({
            "type": "event.ack",
            "periodId": period_id,
            "seq": seq,
            "id": event.id,
        }))
    }

    fn try_status(&mut self, message: &Value) -> store::Result<Value> {
        let period_id = period_id_of(message)?;
        let store = self.store(&period_id)?;

        let count = store.count()?;
        let last_at = store.last_at()?;
        let journal_mode = store.journal_mode()?;

        Ok(json!({
            "type": "session.status",
            "periodId": period_id,
            "count": count,
            "lastAt": last_at,
            "journalMode": journal_mode,
        }))
    }

    fn try_export(&mut self, message: &Value) -> store::Result<Value> {
        let period_id = period_id_of(message)?;
        let path = message
            .get("path")
            .and_then(Value::as_str)
            .ok_or(StoreError::UnusableExportPath)?
            .to_string();

        let count = self.store(&period_id)?.export_jsonl(&path)?;

        Ok(json!({
            "type": "session.exported",
            "path": path,
            "count": count,
        }))
    }
}

/// 메시지에서 교시 이름을 꺼낸다. 문자열이 아니면 저장소가 볼 것도 없이 거절한다.
fn period_id_of(message: &Value) -> store::Result<String> {
    message
        .get("periodId")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or(StoreError::InvalidPeriodId)
}

/// 저장이 실패했을 때의 응답. 프로세스는 죽지 않는다.
///
/// `reason` 에는 우리가 직접 쓴 짧은 이유만 담는다. 파일 경로와 본문 원문은 담지 않는다.
fn store_failure(kind: &str, error: &StoreError) -> Value {
    eprintln!("[classmate-host] {kind} 를 처리하지 못했습니다 · {error}");

    json!({
        "type": "error",
        "message": "session store failed",
        "reason": error.to_string(),
        "received": kind,
    })
}

/// 본문을 풀지 못한 프레임에 대한 응답. 길이만 알려 주고 원문은 담지 않는다.
fn undecodable_reply(bytes: usize) -> Value {
    json!({
        "type": "error",
        "message": "unreadable message",
        "bytes": bytes,
        "received": Value::Null,
    })
}

/// 저장과 상관없는 요청 하나에 대한 응답을 만든다. 부수 효과가 없어서 테스트하기 쉽다.
fn respond(message: &Value) -> Value {
    let envelope: Envelope = serde_json::from_value(message.clone()).unwrap_or_default();

    match envelope.kind.as_deref() {
        Some("ping") => json!({
            "type": "hello",
            "host": "classmate-host",
            "version": env!("CARGO_PKG_VERSION"),
            "protocol": PROTOCOL_VERSION,
        }),
        _ => json!({
            "type": "error",
            "message": "unknown message type",
            "received": echoed_type(message),
        }),
    }
}

/// 되돌려 보낼 type 값. 문자열이면 길이를 잘라 내고, 없거나 문자열이 아니면 null 로 만든다.
fn echoed_type(message: &Value) -> Value {
    match message.get("type") {
        Some(Value::String(text)) if text.chars().count() > ECHOED_TYPE_MAX_CHARS => {
            let clipped: String = text.chars().take(ECHOED_TYPE_MAX_CHARS).collect();
            Value::String(clipped)
        }
        Some(Value::String(text)) => Value::String(text.clone()),
        _ => Value::Null,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use std::sync::atomic::{AtomicU32, Ordering};

    /// 시험이 끝나면 스스로 지워지는 임시 폴더. 라우터보다 먼저 선언해야 한다
    /// (Rust 는 선언의 역순으로 떨어뜨리므로 라우터가 파일을 놓은 뒤에 지워진다).
    struct TempDir(PathBuf);

    impl std::ops::Deref for TempDir {
        type Target = Path;

        fn deref(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    /// 시험마다 겹치지 않는 임시 폴더. 경로를 짧게 두어 Windows MAX_PATH 를 피한다.
    fn temp_dir(tag: &str) -> TempDir {
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let serial = COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!("cmrt-{}-{tag}-{serial}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).expect("임시 폴더를 만들 수 있어야 한다");
        TempDir(path)
    }

    /// fixtures 의 골든 시나리오 27줄.
    fn fixture_events() -> Vec<SessionEvent> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures/synthetic-class/golden-ioc/session-events.jsonl");
        let text = fs::read_to_string(path).expect("fixtures 를 읽을 수 있어야 한다");

        text.lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| serde_json::from_str(line).expect("fixture 한 줄이 계약과 같아야 한다"))
            .collect()
    }

    #[test]
    fn ping_is_answered_with_hello() {
        let reply = respond(&json!({ "type": "ping" }));

        assert_eq!(reply["type"], "hello");
        assert_eq!(reply["host"], "classmate-host");
        assert_eq!(reply["version"], env!("CARGO_PKG_VERSION"));
        assert_eq!(reply["protocol"], PROTOCOL_VERSION);
    }

    #[test]
    fn unknown_type_is_answered_with_error() {
        let reply = respond(&json!({ "type": "launch", "path": "C:/Windows/System32/cmd.exe" }));

        assert_eq!(reply["type"], "error");
        assert_eq!(reply["message"], "unknown message type");
        assert_eq!(reply["received"], "launch");
        // 명령처럼 생긴 필드는 응답 어디에도 실리지 않는다.
        assert!(!reply.to_string().contains("cmd.exe"), "{reply}");
    }

    #[test]
    fn missing_or_non_string_type_becomes_null() {
        assert_eq!(respond(&json!({})).get("received"), Some(&Value::Null));
        assert_eq!(
            respond(&json!({ "type": 7 })).get("received"),
            Some(&Value::Null)
        );
    }

    #[test]
    fn echoed_type_is_clipped() {
        let long = "x".repeat(ECHOED_TYPE_MAX_CHARS * 4);
        let reply = respond(&json!({ "type": long }));

        let received = reply["received"].as_str().expect("문자열이어야 한다");
        assert_eq!(received.chars().count(), ECHOED_TYPE_MAX_CHARS);
    }

    #[test]
    fn serve_answers_every_frame_then_stops_at_eof() {
        // 두 프레임을 이어 붙인 가짜 stdin 을 만든다.
        let mut input = Vec::new();
        protocol::write_message(&mut input, &json!({ "type": "ping" }))
            .expect("쓰기가 되어야 한다");
        protocol::write_message(&mut input, &json!({ "type": "nope" }))
            .expect("쓰기가 되어야 한다");

        let mut reader = io::Cursor::new(input);
        let mut output = Vec::new();
        serve(&mut reader, &mut output).expect("EOF 로 끝나면 성공이다");

        let mut replies = io::Cursor::new(output);
        let first = protocol::read_message(&mut replies)
            .expect("읽기")
            .expect("첫 응답");
        let second = protocol::read_message(&mut replies)
            .expect("읽기")
            .expect("두 번째 응답");

        assert_eq!(first["type"], "hello");
        assert_eq!(second["type"], "error");
        assert_eq!(protocol::read_message(&mut replies).expect("읽기"), None);
    }

    #[test]
    fn serve_survives_a_frame_it_cannot_read() {
        // 깨진 본문 하나를 사이에 끼운다. 예전에는 여기서 프로세스가 끝났다.
        let mut input = Vec::new();
        protocol::write_message(&mut input, &json!({ "type": "ping" }))
            .expect("쓰기가 되어야 한다");
        input.extend_from_slice(&(9u32).to_le_bytes());
        input.extend_from_slice(b"not json!");
        protocol::write_message(&mut input, &json!({ "type": "ping" }))
            .expect("쓰기가 되어야 한다");

        let mut reader = io::Cursor::new(input);
        let mut output = Vec::new();
        serve(&mut reader, &mut output).expect("깨진 프레임 하나로 끝나면 안 된다");

        let mut replies = io::Cursor::new(output);
        let mut seen = Vec::new();
        while let Some(reply) = protocol::read_message(&mut replies).expect("읽기") {
            seen.push(reply);
        }

        assert_eq!(seen.len(), 3, "세 프레임에 세 번 답해야 한다");
        assert_eq!(seen[0]["type"], "hello");
        assert_eq!(seen[1]["type"], "error");
        assert_eq!(seen[1]["message"], "unreadable message");
        assert_eq!(seen[1]["bytes"], 9);
        assert!(!seen[1].to_string().contains("not json"), "{}", seen[1]);
        assert_eq!(seen[2]["type"], "hello");
    }

    #[test]
    fn append_is_acked_and_status_reports_what_is_kept() {
        let dir = temp_dir("router");
        let mut router = Router::with_data_dir(dir.to_path_buf());
        let events = fixture_events();

        // 아직 아무것도 안 넣은 교시의 상태.
        let empty =
            router.handle(&json!({ "type": "session.status", "periodId": "2026-09-02-p3" }));
        assert_eq!(empty["type"], "session.status");
        assert_eq!(empty["count"], 0);
        assert_eq!(empty["lastAt"], Value::Null);
        assert_eq!(empty["journalMode"], "wal");

        let mut last_seq = 0u64;
        for event in &events {
            let reply = router.handle(&json!({
                "type": "event.append",
                "periodId": event.period_id,
                "event": event,
            }));

            assert_eq!(reply["type"], "event.ack", "{reply}");
            assert_eq!(reply["periodId"], event.period_id);
            assert_eq!(reply["id"], event.id);
            let seq = reply["seq"].as_u64().expect("seq 는 숫자다");
            assert!(seq > last_seq, "seq 는 늘어나기만 한다");
            last_seq = seq;
        }

        let filled =
            router.handle(&json!({ "type": "session.status", "periodId": "2026-09-02-p3" }));
        assert_eq!(filled["count"], 27);
        assert_eq!(filled["lastAt"], "2026-09-02T10:33:14+09:00");
        assert_eq!(filled["journalMode"], "wal");

        // 같은 줄을 다시 보내면 같은 seq 로 답하고 개수는 그대로다(재연결 중복 방지).
        let again = router.handle(&json!({
            "type": "event.append",
            "periodId": events[0].period_id,
            "event": events[0],
        }));
        assert_eq!(again["seq"], 1);
        let after =
            router.handle(&json!({ "type": "session.status", "periodId": "2026-09-02-p3" }));
        assert_eq!(after["count"], 27);
    }

    #[test]
    fn export_writes_one_line_per_event() {
        let dir = temp_dir("export");
        let out = dir.join("out.jsonl");
        let mut router = Router::with_data_dir(dir.to_path_buf());

        for event in fixture_events() {
            router.handle(&json!({
                "type": "event.append",
                "periodId": event.period_id,
                "event": event,
            }));
        }

        let reply = router.handle(&json!({
            "type": "session.export",
            "periodId": "2026-09-02-p3",
            "path": out.to_string_lossy(),
        }));

        assert_eq!(reply["type"], "session.exported", "{reply}");
        assert_eq!(reply["count"], 27);
        let text = fs::read_to_string(&out).expect("내보낸 파일을 읽어야 한다");
        assert_eq!(text.lines().count(), 27);
    }

    #[test]
    fn store_failures_answer_with_an_error_instead_of_dying() {
        let dir = temp_dir("failure");
        let mut router = Router::with_data_dir(dir.to_path_buf());

        // 폴더 밖으로 나가려는 교시 이름.
        let escape = router.handle(&json!({
            "type": "session.status",
            "periodId": "../../etc/passwd",
        }));
        assert_eq!(escape["type"], "error");
        assert_eq!(escape["message"], "session store failed");
        assert_eq!(escape["received"], "session.status");

        // 계약에 없는 사건 이름.
        let bad_event = router.handle(&json!({
            "type": "event.append",
            "periodId": "2026-09-02-p3",
            "event": {
                "id": "ev-x-001",
                "periodId": "2026-09-02-p3",
                "at": "2026-09-02T10:31:35+09:00",
                "type": "shell.exec",
                "payload": { "command": "cmd.exe /c del" },
            },
        }));
        assert_eq!(bad_event["type"], "error");
        assert!(
            !bad_event.to_string().contains("cmd.exe"),
            "본문이 새면 안 된다: {bad_event}"
        );

        // 그 뒤에도 라우터는 멀쩡히 답한다.
        assert_eq!(router.handle(&json!({ "type": "ping" }))["type"], "hello");
    }
}
