//! Chrome Native Messaging 전송층입니다 (Phase 2 1라운드 단위 9).
//!
//! 세 조각으로 나뉩니다.
//!
//! ```text
//! 확장  ──stdin──▶  [framing]  ──Value──▶  [envelope]  ──payload──▶  [schema]
//!                4바이트 길이+JSON      type 로 갈래 나눔        contracts 로 검증
//! ```
//!
//! - [`framing`] — 리틀엔디언 4바이트 길이 + UTF-8 JSON. 살릴 수 있는 프레임 오류와
//!   살릴 수 없는 오류를 가릅니다.
//! - [`schema`] — `packages/contracts/schemas/*.schema.json` 으로 값 하나를 검사합니다.
//!   스키마는 `include_str!` 로 **읽기만** 합니다. 계약은 고정 상태입니다.
//! - 이 파일 — 요청 봉투의 `type` 을 보고 어떤 스키마로 무엇을 검사할지 정하는 표입니다.
//!
//! 지키는 경계 (docs/master-prompt.md §4)
//! - 오류 문구에 확장이 준 문자열을 되돌려 담지 않습니다. 자리와 까닭만 알립니다.
//! - 확장이 준 문자열을 경로나 명령으로 쓰지 않습니다. 이 크레이트에는 파일을 열거나
//!   프로세스를 띄우는 코드가 아예 없습니다.
//! - 네트워크로 내보내는 코드가 없습니다.
//!
//! 2라운드에서 루트 크레이트의 복사본 `src/protocol.rs` 를 지웠습니다. 프레이밍은 이제
//! 이 크레이트 하나뿐이고 `apps/native-host/src/router.rs` 가 [`framing`] 을 그대로 씁니다.

pub mod framing;
pub mod schema;

use serde_json::Value;

use schema::{SchemaKind, Violation, ViolationKind};

/// 이 크레이트가 맡는 단위 이름입니다. 스켈레톤이 워크스페이스에 붙었는지 확인하는 용도입니다.
pub const UNIT: &str = "transport";

/// 질문 문장 `question` 의 상한입니다. **글자 수가 아니라 UTF-8 바이트 수**입니다.
///
/// 프레임 상한(1 MiB)과 달리 이 값은 모델에 넘길 문맥을 좁혀 두려는 것입니다. 한글 한 글자가
/// UTF-8 로 3바이트이므로 한글만 쓰면 약 1,365자입니다. 고정 계약 (마) 의 `question?(≤4096 바이트)`.
pub const QUESTION_MAX_BYTES: usize = 4096;

/// `tutor.ask` 가 받는 제공자 이름입니다. 고정 계약 (마) 그대로 둘뿐입니다.
pub const ASK_PROVIDERS: [&str; 2] = ["claude", "codex"];

/// 봉투가 계약과 어긋났을 때 확장에 돌려줄 기본 `reason` 낱말입니다.
pub const REASON_ENVELOPE_INVALID: &str = "envelope-invalid";

/// `tutor.ask` 의 `question` 이 문자열이 아니거나 [`QUESTION_MAX_BYTES`] 를 넘었을 때입니다.
pub const REASON_QUESTION_TOO_LONG: &str = "question-too-long";

/// `tutor.ask` 의 `snapshot` 이 계약의 `QuestionSnapshot` 이 아닐 때입니다.
pub const REASON_MALFORMED_SNAPSHOT: &str = "malformed-snapshot";

/// 표 한 줄로는 적을 수 없는 봉투별 추가 검사입니다.
///
/// 스키마 하나로 값 하나를 보는 것으로 끝나지 않는 봉투가 있어서 둡니다.
/// `frame.store`(고정 계약 (가) · `apps/native-host/README.md` §2-5)와
/// `tutor.ask`(고정 계약 (마)) 둘입니다.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExtraCheck {
    /// 추가로 볼 것이 없습니다.
    None,
    /// `bytesBase64` 가 비어 있지 않은 문자열이어야 하고,
    /// `frame.path` 가 `frames/<frame.id>.webp` 여야 합니다.
    FrameBody,
    /// `provider` 가 [`ASK_PROVIDERS`] 안의 이름이어야 하고, `snapshot` 이 계약
    /// `question.schema.json` 의 `/properties/snapshot` 정의에 맞아야 하며,
    /// `question` 과 `word` 는 있으면 [`QUESTION_MAX_BYTES`] 이하의 문자열이어야 합니다.
    AskSnapshot,
}

/// 봉투 하나를 어떻게 검사할지 적어 둔 줄입니다.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EnvelopeRule {
    /// 봉투의 `type` 값입니다.
    pub message_type: &'static str,
    /// `periodId` 가 있어야 하는지입니다. 있으면 계약의 `PeriodId` 모양으로 검사합니다.
    pub needs_period_id: bool,
    /// `questionId` 가 있어야 하는지입니다. 있으면 계약의 `Id` 모양으로 검사합니다.
    pub needs_question_id: bool,
    /// 딸림 값이 있으면 (필드 이름, 그 값을 검사할 계약 스키마) 입니다.
    pub payload: Option<(&'static str, SchemaKind)>,
    /// 스키마 하나로는 볼 수 없는 추가 검사입니다.
    pub extra: ExtraCheck,
    /// 무엇을 하는 메시지인지 한 줄입니다.
    pub summary: &'static str,
}

/// 로컬 도우미가 받는 봉투 전부입니다.
///
/// `apps/native-host/src/router.rs` 의 `Router::handle` 이 실제로 나눠 주는 이름과 같습니다.
/// 한쪽만 늘면 `the_table_matches_the_router_in_router_rs` 시험이 먼저 빨갛게 됩니다.
/// 여기 없는 `type` 은 호스트가 `unknown-message-type` 으로 답하므로 이 표도 모르는 것으로 답합니다.
pub const ENVELOPE_RULES: [EnvelopeRule; 7] = [
    EnvelopeRule {
        message_type: "ping",
        needs_period_id: false,
        needs_question_id: false,
        payload: None,
        extra: ExtraCheck::None,
        summary: "신원 확인. 호스트는 hello 로 답합니다",
    },
    EnvelopeRule {
        message_type: "event.append",
        needs_period_id: true,
        needs_question_id: false,
        payload: Some(("event", SchemaKind::SessionEvent)),
        extra: ExtraCheck::None,
        summary: "교시 기록 한 줄을 저장소에 붙입니다",
    },
    EnvelopeRule {
        message_type: "session.status",
        needs_period_id: true,
        needs_question_id: false,
        payload: None,
        extra: ExtraCheck::None,
        summary: "이 교시에 얼마나 쌓였는지 묻습니다",
    },
    EnvelopeRule {
        message_type: "session.export",
        needs_period_id: true,
        needs_question_id: false,
        payload: None,
        extra: ExtraCheck::None,
        summary: "이 교시를 JSONL 로 내보냅니다",
    },
    EnvelopeRule {
        message_type: "frame.store",
        needs_period_id: true,
        needs_question_id: false,
        payload: Some(("frame", SchemaKind::ScreenFrame)),
        extra: ExtraCheck::FrameBody,
        summary: "화면 프레임 한 장의 정보와 본문(bytesBase64)을 저장소에 넣습니다",
    },
    EnvelopeRule {
        message_type: "tutor.ask",
        needs_period_id: true,
        needs_question_id: true,
        payload: None,
        extra: ExtraCheck::AskSnapshot,
        summary: "질문 시점에 봉인한 자료 묶음과 함께 튜터 파이프라인에 질문을 맡깁니다",
    },
    EnvelopeRule {
        message_type: "tutor.retry",
        needs_period_id: true,
        needs_question_id: true,
        payload: None,
        extra: ExtraCheck::None,
        summary: "제공자가 실패해 밀린 질문 하나를 다시 맡깁니다",
    },
];

/// 봉투 이름으로 규칙을 찾습니다. 모르는 이름이면 `None` 입니다.
pub fn rule_for(message_type: &str) -> Option<&'static EnvelopeRule> {
    ENVELOPE_RULES
        .iter()
        .find(|rule| rule.message_type == message_type)
}

/// 봉투 하나가 계약에 맞는지 봅니다. 맞으면 어떤 규칙에 걸렸는지 알려 줍니다.
///
///     use classmate_transport::validate_envelope;
///     let message = serde_json::json!({ "type": "ping" });
///     assert_eq!(validate_envelope(&message).unwrap().message_type, "ping");
///
/// 어긋난 자리는 봉투 기준 경로로 알려 줍니다. 딸림 값 안이면 `/event/periodId` 처럼
/// 필드 이름이 앞에 붙습니다.
pub fn validate_envelope(message: &Value) -> Result<&'static EnvelopeRule, Vec<Violation>> {
    let Some(fields) = message.as_object() else {
        return Err(vec![Violation {
            path: "/".to_string(),
            message: "메시지는 JSON 객체여야 합니다".to_string(),
            kind: ViolationKind::Value,
        }]);
    };

    let Some(message_type) = fields.get("type").and_then(Value::as_str) else {
        return Err(vec![Violation {
            path: "/type".to_string(),
            message: "type 이 문자열로 있어야 합니다".to_string(),
            kind: ViolationKind::Value,
        }]);
    };

    // 모르는 이름은 그대로 되돌려 담지 않습니다. 아는 이름 목록만 알려 줍니다(§4-7).
    let Some(rule) = rule_for(message_type) else {
        return Err(vec![Violation {
            path: "/type".to_string(),
            message: format!(
                "모르는 메시지 type 입니다 · 받는 것은 {} 입니다",
                known_types()
            ),
            kind: ViolationKind::Value,
        }]);
    };

    let mut violations = Vec::new();

    if rule.needs_period_id {
        match fields.get("periodId") {
            Some(period_id) => {
                if let Err(found) =
                    schema::validate_definition(SchemaKind::Common, "PeriodId", period_id)
                {
                    violations.extend(prefixed("periodId", found));
                }
            }
            None => violations.push(Violation {
                path: "/periodId".to_string(),
                message: "꼭 있어야 하는 값이 없습니다".to_string(),
                kind: ViolationKind::Value,
            }),
        }
    }

    if rule.needs_question_id {
        match fields.get("questionId") {
            Some(question_id) => {
                if let Err(found) =
                    schema::validate_definition(SchemaKind::Common, "Id", question_id)
                {
                    violations.extend(prefixed("questionId", found));
                }
            }
            None => violations.push(Violation {
                path: "/questionId".to_string(),
                message: "꼭 있어야 하는 값이 없습니다".to_string(),
                kind: ViolationKind::Value,
            }),
        }
    }

    if let Some((field, kind)) = rule.payload {
        match fields.get(field) {
            Some(payload) => {
                if let Err(found) = schema::validate(kind, payload) {
                    violations.extend(prefixed(field, found));
                }
            }
            None => violations.push(Violation {
                path: format!("/{field}"),
                message: "꼭 있어야 하는 값이 없습니다".to_string(),
                kind: ViolationKind::Value,
            }),
        }
    }

    match rule.extra {
        ExtraCheck::None => {}
        ExtraCheck::FrameBody => violations.extend(frame_body_violations(fields)),
        ExtraCheck::AskSnapshot => violations.extend(ask_violations(fields)),
    }

    if violations.is_empty() {
        Ok(rule)
    } else {
        Err(violations)
    }
}

/// 어긋난 자리들을 확장이 분기할 낱말 하나로 줄입니다.
///
/// 세 낱말뿐이고 보는 순서가 곧 우선순위입니다.
///
/// ```text
/// /question 이나 /word 가 어긋났나? ─예─▶ question-too-long
///        │아니오
/// /snapshot 아래가 어긋났나? ─예─▶ malformed-snapshot
///        │아니오
///        └────────────────────────▶ envelope-invalid
/// ```
///
/// `/word` 가 `/question` 과 같은 낱말을 받는 것은, 질문 문장이 없을 때 붙잡은 낱말이 그대로
/// 질문 자리로 흘러가기 때문입니다. 확장이 분기할 낱말을 늘리지 않으려고 같은 것을 씁니다.
///
/// 어긋난 자리가 없으면(빈 목록) 부를 자리가 아니지만, 그래도 기본 낱말을 돌려줍니다.
pub fn envelope_reason(violations: &[Violation]) -> &'static str {
    if violations
        .iter()
        .any(|found| found.path == "/question" || found.path == "/word")
    {
        REASON_QUESTION_TOO_LONG
    } else if violations
        .iter()
        .any(|found| found.path.starts_with("/snapshot"))
    {
        REASON_MALFORMED_SNAPSHOT
    } else {
        REASON_ENVELOPE_INVALID
    }
}

/// `tutor.ask` 봉투만 보는 추가 검사입니다. 고정 계약 (마) 의 세 가지를 봅니다.
///
/// - `provider` 는 [`ASK_PROVIDERS`] 안의 이름입니다. 이 값으로 어떤 CLI 를 부를지 갈리므로
///   목록 밖의 값을 그대로 흘려보내지 않습니다.
/// - `snapshot` 은 계약 `question.schema.json` 의 `/properties/snapshot`(QuestionSnapshot)
///   정의로 검사합니다. 질문 시점에 봉인한 자료 묶음이라 이 모양이 깨지면 답을 만들 수 없습니다.
/// - `question` 과 `word` 는 없어도 되지만, 있으면 UTF-8 [`QUESTION_MAX_BYTES`] 이하의
///   문자열입니다. `question` 이 없으면 파이프라인이 `word` 를 질문 자리에 그대로 쓰고
///   `question.asked` payload 에도 같은 값을 실으므로, 둘을 같은 자로 재지 않으면 상한이
///   한쪽으로 뚫립니다(2라운드 검토 #2).
///
/// `kind` 는 여기서 보지 않습니다. 무엇을 어떻게 물었는지는 파이프라인(단위 6)이 봉인할 때
/// 다시 보므로 봉투 검사에서 겹쳐 막지 않습니다.
/// 어긋난 자리만 알리고 받은 값은 문구에 담지 않습니다(§4-7).
fn ask_violations(fields: &serde_json::Map<String, Value>) -> Vec<Violation> {
    let mut violations = Vec::new();

    let provider = match fields.get("provider") {
        Some(Value::String(name)) if ASK_PROVIDERS.contains(&name.as_str()) => None,
        Some(Value::String(_)) => {
            Some(format!("받는 제공자는 {} 입니다", ASK_PROVIDERS.join(", ")))
        }
        Some(_) => Some("제공자 이름은 문자열이어야 합니다".to_string()),
        None => Some("꼭 있어야 하는 값이 없습니다".to_string()),
    };
    if let Some(message) = provider {
        violations.push(Violation {
            path: "/provider".to_string(),
            message,
            kind: ViolationKind::Value,
        });
    }

    match fields.get("snapshot") {
        Some(snapshot) => {
            if let Err(found) =
                schema::validate_pointer(SchemaKind::Question, "/properties/snapshot", snapshot)
            {
                violations.extend(prefixed("snapshot", found));
            }
        }
        None => violations.push(Violation {
            path: "/snapshot".to_string(),
            message: "꼭 있어야 하는 값이 없습니다".to_string(),
            kind: ViolationKind::Value,
        }),
    }

    // 글자 수가 아니라 바이트 수로 잽니다. 상한이 모델에 넘길 문맥의 크기를 재는 값이라서입니다.
    let question = match fields.get("question") {
        None => None,
        Some(Value::String(text)) if text.len() <= QUESTION_MAX_BYTES => None,
        Some(Value::String(text)) => Some(format!(
            "질문은 UTF-8 {QUESTION_MAX_BYTES} 바이트 이하여야 합니다 · 받은 것은 {} 바이트입니다",
            text.len()
        )),
        Some(_) => Some("질문은 문자열이어야 합니다".to_string()),
    };
    if let Some(message) = question {
        violations.push(Violation {
            path: "/question".to_string(),
            message,
            kind: ViolationKind::Value,
        });
    }

    let word = match fields.get("word") {
        None => None,
        Some(Value::String(text)) if text.len() <= QUESTION_MAX_BYTES => None,
        Some(Value::String(text)) => Some(format!(
            "붙잡은 낱말은 UTF-8 {QUESTION_MAX_BYTES} 바이트 이하여야 합니다 · 받은 것은 {} 바이트입니다",
            text.len()
        )),
        Some(_) => Some("붙잡은 낱말은 문자열이어야 합니다".to_string()),
    };
    if let Some(message) = word {
        violations.push(Violation {
            path: "/word".to_string(),
            message,
            kind: ViolationKind::Value,
        });
    }

    violations
}

/// `frame.store` 봉투만 보는 추가 검사입니다. 고정 계약 (가) 의 두 가지를 봅니다.
///
/// - `bytesBase64` 는 비어 있지 않은 문자열입니다. 본문을 실제로 푸는 것은 저장소 몫이라
///   여기서는 자리와 모양만 봅니다.
/// - `frame.path` 는 `frames/<frame.id>.webp` 입니다. 파일 이름을 `id` 로 못 박아 두면
///   확장이 준 경로가 교시 폴더 밖으로 나갈 자리가 없어집니다.
///
/// `frame` 안의 값이 문자열이 아니면 스키마 검사가 이미 알렸으므로 겹쳐 말하지 않습니다.
/// 어긋난 자리만 알리고 받은 값은 문구에 담지 않습니다(§4-7).
fn frame_body_violations(fields: &serde_json::Map<String, Value>) -> Vec<Violation> {
    let mut violations = Vec::new();

    let body = match fields.get("bytesBase64") {
        Some(Value::String(text)) if !text.is_empty() => None,
        Some(Value::String(_)) => Some("본문이 비어 있습니다"),
        Some(_) => Some("본문은 base64 문자열이어야 합니다"),
        None => Some("꼭 있어야 하는 값이 없습니다"),
    };
    if let Some(message) = body {
        violations.push(Violation {
            path: "/bytesBase64".to_string(),
            message: message.to_string(),
            kind: ViolationKind::Value,
        });
    }

    let frame = fields.get("frame");
    let id = frame
        .and_then(|frame| frame.get("id"))
        .and_then(Value::as_str);
    let path = frame
        .and_then(|frame| frame.get("path"))
        .and_then(Value::as_str);
    if let (Some(id), Some(path)) = (id, path) {
        if path != format!("frames/{id}.webp") {
            violations.push(Violation {
                path: "/frame/path".to_string(),
                message: "path 는 frames/<id>.webp 여야 합니다".to_string(),
                kind: ViolationKind::Value,
            });
        }
    }

    violations
}

/// 아는 봉투 이름들을 쉼표로 잇습니다. 우리 표에서 온 값이라 그대로 적어도 안전합니다.
fn known_types() -> String {
    ENVELOPE_RULES
        .iter()
        .map(|rule| rule.message_type)
        .collect::<Vec<_>>()
        .join(", ")
}

/// 딸림 값 안에서 나온 자리를 봉투 기준 자리로 바꿉니다. `/id` → `/event/id`
fn prefixed(field: &str, violations: Vec<Violation>) -> Vec<Violation> {
    violations
        .into_iter()
        .map(|violation| Violation {
            path: match violation.path.as_str() {
                "/" => format!("/{field}"),
                inner => format!("/{field}{inner}"),
            },
            ..violation
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use schema::describe;
    use serde_json::json;

    fn golden_event() -> Value {
        json!({
            "id": "ev-p3-118",
            "periodId": "2026-09-02-p3",
            "at": "2026-09-02T10:32:18+09:00",
            "type": "state.changed",
            "payload": { "from": "CAPTURE", "to": "ANSWER_MINIMAL" }
        })
    }

    fn paths(violations: &[Violation]) -> Vec<&str> {
        violations.iter().map(|v| v.path.as_str()).collect()
    }

    /// 저장소 뿌리입니다. `CARGO_MANIFEST_DIR` 은 `apps/native-host/crates/transport` 입니다.
    fn repo_root() -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../..")
            .canonicalize()
            .expect("저장소 뿌리를 찾을 수 있어야 합니다")
    }

    /// 골든 고정자료의 첫 프레임입니다. 지어내지 않고 실제 자료를 씁니다.
    fn golden_frame() -> Value {
        let path = repo_root().join("fixtures/synthetic-class/golden-ioc/screen-frames.json");
        let text =
            std::fs::read_to_string(&path).unwrap_or_else(|error| panic!("{path:?} · {error}"));
        let frames: Value = serde_json::from_str(&text).expect("JSON 이어야 합니다");
        frames
            .as_array()
            .and_then(|items| items.first())
            .cloned()
            .expect("프레임이 하나는 있어야 합니다")
    }

    /// 고정 계약 (가) 의 `frame.store` 봉투를 만듭니다. 본문을 빼고도 만들 수 있습니다.
    fn frame_store_message(frame: Value, bytes: Option<&str>) -> Value {
        let mut message = json!({
            "type": "frame.store",
            "periodId": "2026-09-02-p3",
            "frame": frame,
        });
        if let Some(bytes) = bytes {
            message["bytesBase64"] = json!(bytes);
        }
        message
    }

    /// `apps/native-host/src/router.rs` 원문입니다. 빌드할 때 **읽기만** 합니다.
    ///
    /// 2라운드에서 `Router` 가 `src/main.rs` 에서 `src/router.rs` 로 옮겨 왔습니다.
    const HOST_ROUTER_RS: &str = include_str!("../../../src/router.rs");

    /// `router.rs` 원문에서 나눠 주는 함수 하나의 본문만 잘라 냅니다.
    ///
    /// 예전에는 파일 전체를 긁었습니다. 그러면 갈래 하나를 지워도 그 이름을 적은 **주석이나
    /// 시험 줄**이 남아 있을 때 대조가 그대로 통과했습니다(거짓 음성 · 2라운드 검토 #9).
    /// 이제는 실제로 나눠 주는 자리만 봅니다.
    fn handle_body(text: &str) -> String {
        const HEAD: &str = "pub fn handle(";
        let at = text
            .find(HEAD)
            .expect("router.rs 에 나눠 주는 함수가 있어야 합니다");
        let rest = &text[at..];
        let open = rest.find('{').expect("본문 여는 중괄호가 있어야 합니다");

        let mut depth = 0usize;
        for (index, letter) in rest[open..].char_indices() {
            match letter {
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        return rest[open..=open + index].to_string();
                    }
                }
                _ => {}
            }
        }
        panic!("본문 닫는 중괄호를 찾지 못했습니다");
    }

    /// 나눠 주는 본문에서 봉투 이름으로 갈래를 나누는 자리를 긁어 옵니다.
    ///
    /// `"event.append" => …` 같은 줄을 봅니다. 한 줄에 이름을 둘 이상 묶은 갈래
    /// (`"a" | "b" =>`)는 뒤엣것만 잡히므로 router.rs 는 갈래를 한 줄에 하나씩 씁니다.
    /// 주석으로 시작하는 줄은 건너뜁니다 — 주석은 나눠 주는 자리가 아니기 때문입니다.
    fn router_types_in(body: &str) -> Vec<String> {
        let mut found = Vec::new();

        for line in body.lines() {
            let line = line.trim_start();
            if line.starts_with("//") {
                continue;
            }
            let Some(arrow) = line.find("=>") else {
                continue;
            };
            let head = line[..arrow].trim_end();
            let head = head.strip_suffix(')').unwrap_or(head);
            let Some(rest) = head.strip_suffix('"') else {
                continue;
            };
            let Some(open) = rest.rfind('"') else {
                continue;
            };
            let name = &rest[open + 1..];
            if !name.is_empty() {
                found.push(name.to_string());
            }
        }

        found.sort_unstable();
        found.dedup();
        found
    }

    #[test]
    fn skeleton_is_wired_into_workspace() {
        assert_eq!(UNIT, "transport");
    }

    #[test]
    fn ping_needs_nothing_else() {
        let rule = validate_envelope(&json!({ "type": "ping" })).expect("통과해야 합니다");
        assert_eq!(rule.message_type, "ping");
    }

    #[test]
    fn append_checks_the_event_against_the_contract() {
        let message = json!({
            "type": "event.append",
            "periodId": "2026-09-02-p3",
            "event": golden_event()
        });

        let rule = validate_envelope(&message).expect("통과해야 합니다");
        assert_eq!(rule.payload, Some(("event", SchemaKind::SessionEvent)));
    }

    #[test]
    fn broken_event_is_reported_under_the_field_name() {
        let mut event = golden_event();
        event["type"] = json!("answer.exploded");
        let message = json!({
            "type": "event.append",
            "periodId": "2026-09-02-p3",
            "event": event
        });

        let violations = validate_envelope(&message).expect_err("계약에 없는 사건 이름입니다");
        assert_eq!(
            paths(&violations),
            vec!["/event/type"],
            "{}",
            describe(&violations)
        );
    }

    #[test]
    fn missing_payload_and_period_id_are_both_reported() {
        let violations =
            validate_envelope(&json!({ "type": "event.append" })).expect_err("둘 다 없습니다");
        assert_eq!(paths(&violations), vec!["/periodId", "/event"]);
    }

    #[test]
    fn period_id_that_walks_out_of_the_folder_is_rejected() {
        let message = json!({ "type": "session.status", "periodId": "../../etc/passwd" });

        let violations = validate_envelope(&message).expect_err("교시 이름 모양이 아닙니다");
        assert_eq!(paths(&violations), vec!["/periodId"]);
        assert!(
            !describe(&violations).contains("passwd"),
            "원문이 새면 안 됩니다: {}",
            describe(&violations)
        );
    }

    #[test]
    fn unknown_type_is_rejected_without_echoing_it() {
        let message = json!({ "type": "launch", "path": "C:/Windows/System32/cmd.exe" });

        let violations = validate_envelope(&message).expect_err("모르는 이름입니다");
        assert_eq!(paths(&violations), vec!["/type"]);
        assert!(
            !describe(&violations).contains("cmd.exe"),
            "{}",
            describe(&violations)
        );
        assert!(describe(&violations).contains("session.export"));
    }

    #[test]
    fn non_object_and_missing_type_are_reported_at_the_root() {
        let violations = validate_envelope(&json!([1, 2, 3])).expect_err("객체가 아닙니다");
        assert_eq!(paths(&violations), vec!["/"]);

        let violations = validate_envelope(&json!({ "periodId": "2026-09-02-p3" }))
            .expect_err("type 이 없습니다");
        assert_eq!(paths(&violations), vec!["/type"]);

        let violations = validate_envelope(&json!({ "type": 7 })).expect_err("문자열이 아닙니다");
        assert_eq!(paths(&violations), vec!["/type"]);
    }

    #[test]
    fn frame_store_takes_a_golden_frame_with_its_body() {
        let message = frame_store_message(golden_frame(), Some("UklGRiQAAABXRUJQ"));

        let rule = validate_envelope(&message).expect("통과해야 합니다");
        assert_eq!(rule.message_type, "frame.store");
        assert_eq!(rule.payload, Some(("frame", SchemaKind::ScreenFrame)));
        assert_eq!(rule.extra, ExtraCheck::FrameBody);
    }

    #[test]
    fn frame_store_needs_a_body_that_is_not_empty() {
        let violations = validate_envelope(&frame_store_message(golden_frame(), None))
            .expect_err("본문 자리가 없습니다");
        assert_eq!(paths(&violations), vec!["/bytesBase64"]);

        let violations = validate_envelope(&frame_store_message(golden_frame(), Some("")))
            .expect_err("본문이 비었습니다");
        assert_eq!(paths(&violations), vec!["/bytesBase64"]);
    }

    #[test]
    fn frame_store_rejects_a_path_that_does_not_match_the_id() {
        let mut frame = golden_frame();
        // 계약이 정한 자리(frames/<id>.webp)를 벗어나 폴더 밖을 가리키는 경로입니다.
        frame["path"] = json!("frames/../../etc/passwd.webp");
        let message = frame_store_message(frame, Some("UklGRiQAAABXRUJQ"));

        let violations = validate_envelope(&message).expect_err("path 가 id 와 어긋납니다");
        assert_eq!(paths(&violations), vec!["/frame/path"]);
        assert!(
            !describe(&violations).contains("passwd"),
            "원문이 새면 안 됩니다: {}",
            describe(&violations)
        );
    }

    #[test]
    fn the_table_holds_the_seven_request_types() {
        // 고정 계약이 말하는 일곱 이름입니다. 순서까지 표와 같아야 합니다.
        const EXPECTED: [&str; 7] = [
            "ping",
            "event.append",
            "session.status",
            "session.export",
            "frame.store",
            "tutor.ask",
            "tutor.retry",
        ];

        let ours: Vec<&str> = ENVELOPE_RULES.iter().map(|r| r.message_type).collect();
        assert_eq!(ours, EXPECTED.to_vec());
    }

    #[test]
    fn the_table_matches_the_router_in_router_rs() {
        let mut ours: Vec<String> = ENVELOPE_RULES
            .iter()
            .map(|rule| rule.message_type.to_string())
            .collect();
        ours.sort_unstable();

        assert_eq!(
            router_types_in(&handle_body(HOST_ROUTER_RS)),
            ours,
            "봉투 표와 src/router.rs 의 갈래가 어긋납니다"
        );
    }

    #[test]
    fn the_scraper_reads_only_the_dispatch_body_and_skips_comments() {
        // 대조가 헛돌지 않는지를 **검사기 자체**로 확인합니다. 나눠 주는 함수 밖의 갈래와
        // 주석 안의 갈래가 세어지면, 갈래를 지워도 대조가 통과해 버립니다(거짓 음성).
        let sample = concat!(
            "fn elsewhere(&self) -> Value {
",
            "    match kind {
",
            "        \"ghost.outside\" => hello(),
",
            "        _ => none(),
",
            "    }
",
            "}
",
            "
",
            "pub fn handle(&mut self, msg: Value) -> Value {
",
            "    match kind {
",
            "        // \"ghost.comment\" => hello(),
",
            "        \"ping\" => hello(),
",
            "        _ => unknown_message_type(&msg),
",
            "    }
",
            "}
",
        );

        assert_eq!(
            router_types_in(&handle_body(sample)),
            vec!["ping".to_string()],
            "나눠 주는 본문의 갈래 하나만 세어야 합니다"
        );
    }

    /// 골든 고정자료의 질문 하나입니다. 지어내지 않고 실제 자료를 씁니다.
    fn golden_question() -> Value {
        let path = repo_root().join("fixtures/synthetic-class/golden-ioc/question.json");
        let text =
            std::fs::read_to_string(&path).unwrap_or_else(|error| panic!("{path:?} · {error}"));
        serde_json::from_str(&text).expect("JSON 이어야 합니다")
    }

    /// 고정 계약 (마) 의 `tutor.ask` 봉투를 골든 질문에서 만듭니다.
    fn tutor_ask_message() -> Value {
        let question = golden_question();
        json!({
            "type": "tutor.ask",
            "periodId": question["periodId"],
            "questionId": question["id"],
            "kind": question["kind"],
            "question": question["text"],
            "provider": "claude",
            "snapshot": question["snapshot"],
        })
    }

    #[test]
    fn tutor_ask_takes_a_golden_question_with_its_snapshot() {
        let rule = validate_envelope(&tutor_ask_message()).expect("통과해야 합니다");

        assert_eq!(rule.message_type, "tutor.ask");
        assert!(rule.needs_question_id);
        assert_eq!(rule.extra, ExtraCheck::AskSnapshot);
        // snapshot 은 payload 표가 아니라 추가 검사가 봅니다(계약 파일 전체가 아니라 속성 하나).
        assert_eq!(rule.payload, None);
    }

    #[test]
    fn tutor_ask_needs_a_question_id_and_a_known_provider() {
        let mut message = tutor_ask_message();
        message
            .as_object_mut()
            .expect("객체다")
            .remove("questionId");
        message["provider"] = json!("gpt-9");

        let violations = validate_envelope(&message).expect_err("둘 다 어긋납니다");
        assert_eq!(paths(&violations), vec!["/questionId", "/provider"]);
        assert_eq!(envelope_reason(&violations), REASON_ENVELOPE_INVALID);
        assert!(
            !describe(&violations).contains("gpt-9"),
            "원문이 새면 안 됩니다: {}",
            describe(&violations)
        );
    }

    #[test]
    fn a_broken_snapshot_is_reported_under_snapshot() {
        // ages 는 세 칸이 모두 있어야 합니다. 하나를 빼면 봉인이 깨진 것입니다.
        let mut message = tutor_ask_message();
        message["snapshot"]["ages"]
            .as_object_mut()
            .expect("객체다")
            .remove("screenSec");

        let violations = validate_envelope(&message).expect_err("봉인이 깨졌습니다");
        assert_eq!(paths(&violations), vec!["/snapshot/ages/screenSec"]);
        assert_eq!(envelope_reason(&violations), REASON_MALFORMED_SNAPSHOT);
    }

    #[test]
    fn a_snapshot_that_is_not_an_object_is_also_malformed() {
        let mut message = tutor_ask_message();
        message["snapshot"] = json!("전부 다 주세요");

        let violations = validate_envelope(&message).expect_err("객체가 아닙니다");
        assert_eq!(envelope_reason(&violations), REASON_MALFORMED_SNAPSHOT);
        assert!(
            !describe(&violations).contains("전부 다"),
            "원문이 새면 안 됩니다: {}",
            describe(&violations)
        );

        let mut missing = tutor_ask_message();
        missing.as_object_mut().expect("객체다").remove("snapshot");
        let violations = validate_envelope(&missing).expect_err("봉인이 없습니다");
        assert_eq!(paths(&violations), vec!["/snapshot"]);
        assert_eq!(envelope_reason(&violations), REASON_MALFORMED_SNAPSHOT);
    }

    #[test]
    fn a_question_is_measured_in_utf8_bytes_not_characters() {
        // 상한과 같은 크기는 통과합니다. 한 바이트만 더 늘면 거절합니다.
        let mut message = tutor_ask_message();
        message["question"] = json!("a".repeat(QUESTION_MAX_BYTES));
        assert!(validate_envelope(&message).is_ok());

        message["question"] = json!("a".repeat(QUESTION_MAX_BYTES + 1));
        let violations = validate_envelope(&message).expect_err("한 바이트 넘었습니다");
        assert_eq!(paths(&violations), vec!["/question"]);
        assert_eq!(envelope_reason(&violations), REASON_QUESTION_TOO_LONG);

        // 한글은 한 글자가 3바이트입니다. 글자 수로 세면 통과할 길이가 바이트로는 넘습니다.
        let mut hangul = tutor_ask_message();
        hangul["question"] = json!("가".repeat(QUESTION_MAX_BYTES / 3 + 1));
        assert_eq!(
            envelope_reason(&validate_envelope(&hangul).expect_err("바이트로는 넘습니다")),
            REASON_QUESTION_TOO_LONG
        );

        // 질문 자체는 없어도 됩니다(낱말만 붙잡은 경우).
        let mut wordless = tutor_ask_message();
        wordless.as_object_mut().expect("객체다").remove("question");
        assert!(validate_envelope(&wordless).is_ok());
    }

    #[test]
    fn a_word_is_measured_with_the_same_limit_as_the_question() {
        // question 이 없으면 파이프라인은 word 를 질문 자리에 그대로 씁니다. 여기서 재지
        // 않으면 1 MiB 짜리 word 하나가 상한을 지나 CLI stdin 과 되나가는 알림으로 흘러갑니다.
        let mut message = tutor_ask_message();
        message.as_object_mut().expect("객체다").remove("question");

        message["word"] = json!("a".repeat(QUESTION_MAX_BYTES));
        assert!(
            validate_envelope(&message).is_ok(),
            "상한과 같으면 통과합니다"
        );

        message["word"] = json!("a".repeat(QUESTION_MAX_BYTES + 1));
        let violations = validate_envelope(&message).expect_err("한 바이트 넘었습니다");
        assert_eq!(paths(&violations), vec!["/word"]);
        assert_eq!(envelope_reason(&violations), REASON_QUESTION_TOO_LONG);
        assert!(
            !describe(&violations).contains("aaaa"),
            "원문이 새면 안 됩니다: {}",
            describe(&violations)
        );

        // 낱말은 없어도 됩니다(문장으로만 물은 경우).
        let mut sentence_only = tutor_ask_message();
        sentence_only
            .as_object_mut()
            .expect("객체다")
            .remove("word");
        assert!(validate_envelope(&sentence_only).is_ok());
    }

    #[test]
    fn tutor_retry_needs_only_the_two_ids() {
        let message = json!({
            "type": "tutor.retry",
            "periodId": "2026-09-02-p3",
            "questionId": "q-p3-001",
        });
        let rule = validate_envelope(&message).expect("통과해야 합니다");
        assert_eq!(rule.message_type, "tutor.retry");
        assert_eq!(rule.extra, ExtraCheck::None);

        let violations =
            validate_envelope(&json!({ "type": "tutor.retry" })).expect_err("둘 다 없습니다");
        assert_eq!(paths(&violations), vec!["/periodId", "/questionId"]);
        assert_eq!(envelope_reason(&violations), REASON_ENVELOPE_INVALID);
    }

    #[test]
    fn validate_pointer_reads_a_property_definition_not_a_definitions_entry() {
        let snapshot = golden_question()["snapshot"].clone();
        assert!(
            schema::validate_pointer(SchemaKind::Question, "/properties/snapshot", &snapshot)
                .is_ok()
        );

        // 없는 자리를 가리키면 값 쪽이 아니라 스키마 쪽 문제로 알립니다.
        let violations =
            schema::validate_pointer(SchemaKind::Question, "/properties/nope", &snapshot)
                .expect_err("그런 자리가 없습니다");
        assert_eq!(violations[0].kind, ViolationKind::UnsupportedSchema);
    }

    #[test]
    fn the_table_has_no_duplicate_names() {
        let mut names: Vec<&str> = ENVELOPE_RULES.iter().map(|r| r.message_type).collect();
        names.sort_unstable();
        let count = names.len();
        names.dedup();
        assert_eq!(names.len(), count, "봉투 이름이 겹칩니다");
    }

    #[test]
    fn a_framed_request_can_be_read_and_checked_in_one_go() {
        // 프레이밍 → 봉투 판별 → 계약 검증까지 한 번에 이어 봅니다.
        let message = json!({
            "type": "event.append",
            "periodId": "2026-09-02-p3",
            "event": golden_event()
        });

        let mut wire = Vec::new();
        framing::write_message(&mut wire, &message).expect("쓰기가 되어야 합니다");

        let mut cursor = std::io::Cursor::new(wire);
        let read = framing::read_message(&mut cursor)
            .expect("읽기가 되어야 합니다")
            .expect("메시지 하나가 있어야 합니다");

        assert_eq!(read, message);
        assert_eq!(
            validate_envelope(&read)
                .expect("통과해야 합니다")
                .message_type,
            "event.append"
        );
    }
}
