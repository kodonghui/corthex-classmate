//! Tiro 공식 API 클라이언트 — 인수인계 §4.3 · kickoff §Tiro 공식 API(2026-09-10 실측) 가 정본.
//!
//! - 베이스 `https://api.tiro.ooo/v1/external`(시험은 `CLASSMATE_TIRO_BASE_URL`).
//! - `GET /workspaces/me` → `{guid}`
//! - `GET /workspaces/{guid}/notes?size=8` → `{content:[{guid,title,sourceType,recordingStartAt,recordingEndAt,webUrl}],nextCursor}`
//! - `GET /notes/{guid}/paragraphs?size=1000[&cursor=…]` → `{content:[{uuid,transcript{type,content},summary{markdown},timeFrom,timeTo,locked}],nextCursor}`
//!
//! 모르는 열쇠는 무시한다(Tiro 가 열을 더해도 깨지지 않게). 401 · 404 는 [`guidance`] 가 사람 문구로 바꾼다.

use serde::Deserialize;

use crate::config::Config;
use crate::error::{CoreError, Result};
use crate::store::Paragraph;

use super::http::{self, percent_encode, Base};

/// `nextCursor` 를 따라가는 최대 페이지 수(폭주 방지).
const MAX_PAGES: usize = 50;

/// Tiro 노트 한 줄(`/workspaces/{guid}/notes` 의 `content[]`).
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub guid: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub source_type: Option<String>,
    #[serde(default)]
    pub recording_start_at: Option<String>,
    /// 진행 중이면 `null`.
    #[serde(default)]
    pub recording_end_at: Option<String>,
    #[serde(default)]
    pub web_url: Option<String>,
}

impl Note {
    pub fn is_recording(&self) -> bool {
        self.recording_end_at.is_none()
    }

    pub fn title_or_guid(&self) -> &str {
        self.title
            .as_deref()
            .filter(|title| !title.trim().is_empty())
            .unwrap_or(&self.guid)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Page<T> {
    #[serde(default = "Vec::new")]
    content: Vec<T>,
    #[serde(default)]
    next_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WorkspaceMe {
    guid: String,
}

/// `GET /workspaces` 의 한 줄. 키는 워크스페이스 하나에 묶이므로(Tiro 문서 "API key is scoped to one
/// workspace") 이 목록은 "계정이 닿는 곳" 이고 실제로 읽을 수 있는 곳은 `/workspaces/me` 뿐이다.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub guid: String,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawParagraph {
    uuid: String,
    #[serde(default)]
    transcript: Option<RawTranscript>,
    #[serde(default)]
    summary: Option<RawSummary>,
    time_from: String,
    time_to: String,
    #[serde(default)]
    locked: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct RawTranscript {
    #[serde(default)]
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawSummary {
    #[serde(default)]
    markdown: Option<String>,
}

impl RawParagraph {
    fn into_paragraph(self, note_guid: &str) -> Paragraph {
        Paragraph {
            uuid: self.uuid,
            note_guid: note_guid.to_string(),
            text: self
                .transcript
                .and_then(|transcript| transcript.content)
                .unwrap_or_default(),
            summary_md: self
                .summary
                .and_then(|summary| summary.markdown)
                .filter(|markdown| !markdown.trim().is_empty()),
            time_from: self.time_from,
            time_to: self.time_to,
            locked: self.locked.unwrap_or(false),
        }
    }
}

/// 키 하나를 품은 클라이언트. 키는 밖으로 내지 않는다(`Debug` 도 가린다).
pub struct Client {
    base: Base,
    key: String,
}

impl std::fmt::Debug for Client {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Client")
            .field("base", &self.base)
            .field("key", &"<hidden>")
            .finish()
    }
}

impl Client {
    /// 베이스 주소와 키로 만든다.
    pub fn new(base_url: &str, key: &str) -> Result<Self> {
        if key.trim().is_empty() {
            return Err(CoreError::InvalidValue("Tiro 키"));
        }
        Ok(Self {
            base: Base::parse(base_url)?,
            key: key.trim().to_string(),
        })
    }

    /// 환경 변수/기본 베이스([`Config::tiro_base_url`])로 만든다.
    pub fn with_default_base(key: &str) -> Result<Self> {
        Self::new(&Config::tiro_base_url(), key)
    }

    /// `GET /workspaces/me` → 워크스페이스 guid. 키 검증에도 쓴다(401 이면 키가 틀린 것).
    pub fn workspace_me(&self) -> Result<String> {
        let me: WorkspaceMe = self.get_json("/workspaces/me")?;
        Ok(me.guid)
    }

    /// `GET /workspaces` — 계정이 닿는 워크스페이스 목록(guid · 이름). 응답이 배열이든 `{content:[…]}` 든 받는다.
    pub fn workspaces(&self) -> Result<Vec<Workspace>> {
        let value: serde_json::Value = self.get_json("/workspaces")?;
        let items = match value {
            serde_json::Value::Array(items) => items,
            // 실측(2026-09-10): `{"workspaces":[…]}`. 다른 목록처럼 `content` 로 올 수도 있어 둘 다 받는다.
            serde_json::Value::Object(mut map) => {
                match map.remove("workspaces").or_else(|| map.remove("content")) {
                    Some(serde_json::Value::Array(items)) => items,
                    _ => Vec::new(),
                }
            }
            _ => Vec::new(),
        };
        items
            .into_iter()
            .map(|item| {
                serde_json::from_value(item).map_err(|_| CoreError::Json("Tiro 워크스페이스"))
            })
            .collect()
    }

    /// `GET /workspaces/{guid}/notes?size=N` 의 첫 페이지.
    pub fn notes(&self, workspace_guid: &str, size: usize) -> Result<Vec<Note>> {
        let page: Page<Note> = self.get_json(&format!(
            "/workspaces/{}/notes?size={size}",
            percent_encode(workspace_guid)
        ))?;
        Ok(page.content)
    }

    /// `GET /notes/{guid}/paragraphs?size=N` 을 `nextCursor` 가 끝날 때까지 이어 받아 전부 돌려준다.
    pub fn paragraphs(&self, note_guid: &str, page_size: usize) -> Result<Vec<Paragraph>> {
        let mut found = Vec::new();
        let mut cursor: Option<String> = None;
        for _ in 0..MAX_PAGES {
            let mut path = format!(
                "/notes/{}/paragraphs?size={page_size}",
                percent_encode(note_guid)
            );
            if let Some(cursor) = &cursor {
                path.push_str("&cursor=");
                path.push_str(&percent_encode(cursor));
            }
            let page: Page<RawParagraph> = self.get_json(&path)?;
            found.extend(
                page.content
                    .into_iter()
                    .map(|raw| raw.into_paragraph(note_guid)),
            );
            match page.next_cursor.filter(|next| !next.is_empty()) {
                Some(next) if Some(&next) != cursor.as_ref() => cursor = Some(next),
                _ => return Ok(found),
            }
        }
        Err(CoreError::InvalidValue("Tiro 페이지 수"))
    }

    fn get_json<T: serde::de::DeserializeOwned>(&self, path_and_query: &str) -> Result<T> {
        let response = http::get(&self.base, path_and_query, Some(&self.key))?;
        if trace_enabled() {
            trace(path_and_query, &response);
        }
        if !(200..300).contains(&response.status) {
            return Err(CoreError::Http(response.status));
        }
        serde_json::from_slice(&response.body).map_err(|_| CoreError::Json("Tiro 응답"))
    }
}

/// `CLASSMATE_TIRO_TRACE` 가 있으면 응답의 **모양**(상태 · 경로 · 최상위 열쇠와 배열 길이)만 stderr 로 찍는다.
/// 본문 · 키는 찍지 않는다. `setup --check` · `doctor` 에서 응답 모양이 실측과 다를 때 쓴다.
fn trace_enabled() -> bool {
    std::env::var_os("CLASSMATE_TIRO_TRACE").is_some_and(|value| !value.is_empty())
}

fn trace(path_and_query: &str, response: &http::Response) {
    let path = path_and_query.split('?').next().unwrap_or(path_and_query);
    let shape = match serde_json::from_slice::<serde_json::Value>(&response.body) {
        Ok(serde_json::Value::Object(map)) => map
            .iter()
            .map(|(key, value)| match value {
                serde_json::Value::Array(items) => format!("{key}[{}]", items.len()),
                serde_json::Value::Object(inner) => format!("{key}{{{}}}", inner.len()),
                serde_json::Value::Null => format!("{key}=null"),
                serde_json::Value::String(text) => format!("{key}:str({})", text.chars().count()),
                other => format!("{key}:{}", other),
            })
            .collect::<Vec<_>>()
            .join(" "),
        Ok(serde_json::Value::Array(items)) => format!("array[{}]", items.len()),
        Ok(other) => format!("{other}"),
        Err(_) => format!("(JSON 아님 · {} bytes)", response.body.len()),
    };
    eprintln!("[tiro] GET {path} → {} · {shape}", response.status);
}

/// 401 · 404 를 사람이 할 일로 바꾼다(인수인계 §4.3 — 사용자가 둘 다 겪었다).
pub fn guidance(error: &CoreError) -> Option<&'static str> {
    match error {
        CoreError::Http(401) => Some(
            "Tiro 가 401 로 거절했습니다. 키 형식이 keyId.secret 인지 확인하세요 — Key ID 만 넣으면 401 입니다(platform.tiro.ooo/me/api-keys).",
        ),
        CoreError::Http(404) => Some(
            "Tiro 가 404 로 답했습니다. 이 키 범위 밖의 노트이거나(다른 워크스페이스) 노트가 없습니다.",
        ),
        CoreError::Http(429) => Some("Tiro 요청 한도(키당 600req/60s)에 걸렸습니다. 잠시 뒤 다시 시도합니다."),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::super::fake::FakeTiro;
    use super::*;

    #[test]
    fn workspace_notes_and_paragraphs_round_trip_through_the_fake() {
        let fake = FakeTiro::start("abcd1234.secretsecret");
        fake.add_note("n1", Some("스프링 1강"), "2026-09-10T04:00:00Z", None);
        fake.add_paragraph(
            "n1",
            "u1",
            "2026-09-10T04:00:00Z",
            "2026-09-10T04:00:20Z",
            "무상태성이란",
            Some("- 요약"),
            true,
        );
        fake.add_paragraph(
            "n1",
            "u2",
            "2026-09-10T04:00:20Z",
            "2026-09-10T04:00:35Z",
            "서버가",
            None,
            false,
        );
        fake.add_paragraph(
            "n1",
            "u3",
            "2026-09-10T04:00:35Z",
            "2026-09-10T04:00:41Z",
            "",
            None,
            false,
        );
        fake.set_page_cap(2);

        let client = Client::new(&fake.base_url(), "abcd1234.secretsecret").unwrap();
        assert_eq!(client.workspace_me().unwrap(), "ws-1");

        let notes = client.notes("ws-1", 8).unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].title_or_guid(), "스프링 1강");
        assert!(notes[0].is_recording());

        // 페이지 상한 2 → 두 페이지(2 + 1)를 nextCursor 로 이어 받는다.
        let paragraphs = client.paragraphs("n1", 1000).unwrap();
        let uuids: Vec<&str> = paragraphs.iter().map(|p| p.uuid.as_str()).collect();
        assert_eq!(uuids, vec!["u1", "u2", "u3"]);
        assert_eq!(paragraphs[0].summary_md.as_deref(), Some("- 요약"));
        assert!(paragraphs[0].locked);
        assert_eq!(paragraphs[1].summary_md, None);
        assert!(!paragraphs[2].locked);
        assert_eq!(paragraphs[2].text, "");

        let requests = fake.requests();
        let paragraph_calls: Vec<&String> = requests
            .iter()
            .filter(|request| request.path.contains("/paragraphs"))
            .map(|request| &request.path)
            .collect();
        assert_eq!(paragraph_calls.len(), 2);
        assert!(
            paragraph_calls[1].contains("cursor=c2"),
            "{}",
            paragraph_calls[1]
        );
        assert!(
            requests
                .iter()
                .all(|request| request.authorization.as_deref()
                    == Some("Bearer abcd1234.secretsecret")),
            "모든 요청에 Bearer 헤더"
        );
    }

    #[test]
    fn workspaces_list_reads_the_measured_shape() {
        let fake = FakeTiro::start("abcd1234.secretsecret");
        let client = Client::new(&fake.base_url(), "abcd1234.secretsecret").unwrap();
        let list = client.workspaces().unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].guid, "ws-1");
        assert_eq!(list[0].name.as_deref(), Some("시험 워크스페이스"));
    }

    #[test]
    fn wrong_key_is_401_and_unknown_note_is_404() {
        let fake = FakeTiro::start("abcd1234.secretsecret");
        let wrong = Client::new(&fake.base_url(), "abcd1234").unwrap();
        let error = wrong.workspace_me().unwrap_err();
        assert!(matches!(error, CoreError::Http(401)), "{error}");
        assert!(guidance(&error).unwrap().contains("keyId.secret"));

        let right = Client::new(&fake.base_url(), "abcd1234.secretsecret").unwrap();
        let error = right.paragraphs("없는-노트", 1000).unwrap_err();
        assert!(matches!(error, CoreError::Http(404)), "{error}");
        assert!(guidance(&error).unwrap().contains("404"));
        assert!(guidance(&CoreError::Http(500)).is_none());
    }

    #[test]
    fn unreachable_server_is_a_windows_error_not_a_panic() {
        // 아무도 듣지 않는 포트.
        let client =
            Client::new("http://127.0.0.1:1/v1/external", "abcd1234.secretsecret").unwrap();
        let error = client.workspace_me().unwrap_err();
        assert!(matches!(error, CoreError::Windows(_, _)), "{error}");
        let text = error.to_string();
        assert!(
            !text.contains("secretsecret") && !text.contains("127.0.0.1"),
            "{text}"
        );
    }

    #[test]
    fn client_never_prints_the_key() {
        let error = Client::new("https://api.tiro.ooo/v1/external", "  ").unwrap_err();
        assert!(matches!(error, CoreError::InvalidValue("Tiro 키")));
        let client =
            Client::new("https://api.tiro.ooo/v1/external", "abcd1234.secretsecret").unwrap();
        let debug = format!("{client:?}");
        assert!(!debug.contains("secretsecret"), "{debug}");
        assert!(debug.contains("<hidden>"));
    }
}
