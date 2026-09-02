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
//! 2라운드 계획: 루트 크레이트 `src/protocol.rs` 를 지우고 `src/main.rs` 가 이 크레이트의
//! [`framing`] 을 쓰게 바꿉니다. 1라운드에서는 단위끼리 같은 파일을 고치지 않으려고
//! 복사본으로 둡니다.

pub mod framing;
pub mod schema;

use serde_json::Value;

use schema::{SchemaKind, Violation, ViolationKind};

/// 이 크레이트가 맡는 단위 이름입니다. 스켈레톤이 워크스페이스에 붙었는지 확인하는 용도입니다.
pub const UNIT: &str = "transport";

/// 표 한 줄로는 적을 수 없는 봉투별 추가 검사입니다.
///
/// 스키마 하나로 값 하나를 보는 것으로 끝나지 않는 봉투가 있어서 둡니다. 지금은
/// `frame.store` 하나뿐입니다(고정 계약 (가) · `apps/native-host/README.md` §2-5).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExtraCheck {
    /// 추가로 볼 것이 없습니다.
    None,
    /// `bytesBase64` 가 비어 있지 않은 문자열이어야 하고,
    /// `frame.path` 가 `frames/<frame.id>.webp` 여야 합니다.
    FrameBody,
}

/// 봉투 하나를 어떻게 검사할지 적어 둔 줄입니다.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EnvelopeRule {
    /// 봉투의 `type` 값입니다.
    pub message_type: &'static str,
    /// `periodId` 가 있어야 하는지입니다. 있으면 계약의 `PeriodId` 모양으로 검사합니다.
    pub needs_period_id: bool,
    /// 딸림 값이 있으면 (필드 이름, 그 값을 검사할 계약 스키마) 입니다.
    pub payload: Option<(&'static str, SchemaKind)>,
    /// 스키마 하나로는 볼 수 없는 추가 검사입니다.
    pub extra: ExtraCheck,
    /// 무엇을 하는 메시지인지 한 줄입니다.
    pub summary: &'static str,
}

/// 로컬 도우미가 받는 봉투 전부입니다.
///
/// `src/main.rs` 가 실제로 나눠 주는 이름과 같습니다. `Router::handle` 이 갈래로 받는 넷과
/// `respond()` 가 받는 `ping` 을 합쳐 다섯입니다. 한쪽만 늘면
/// `the_table_matches_the_router_in_main_rs` 시험이 먼저 빨갛게 됩니다.
/// 여기 없는 `type` 은 호스트가 `error` 로 답하므로 이 표도 모르는 것으로 답합니다.
pub const ENVELOPE_RULES: [EnvelopeRule; 5] = [
    EnvelopeRule {
        message_type: "ping",
        needs_period_id: false,
        payload: None,
        extra: ExtraCheck::None,
        summary: "신원 확인. 호스트는 hello 로 답합니다",
    },
    EnvelopeRule {
        message_type: "event.append",
        needs_period_id: true,
        payload: Some(("event", SchemaKind::SessionEvent)),
        extra: ExtraCheck::None,
        summary: "교시 기록 한 줄을 저장소에 붙입니다",
    },
    EnvelopeRule {
        message_type: "session.status",
        needs_period_id: true,
        payload: None,
        extra: ExtraCheck::None,
        summary: "이 교시에 얼마나 쌓였는지 묻습니다",
    },
    EnvelopeRule {
        message_type: "session.export",
        needs_period_id: true,
        payload: None,
        extra: ExtraCheck::None,
        summary: "이 교시를 JSONL 로 내보냅니다",
    },
    EnvelopeRule {
        message_type: "frame.store",
        needs_period_id: true,
        payload: Some(("frame", SchemaKind::ScreenFrame)),
        extra: ExtraCheck::FrameBody,
        summary: "화면 프레임 한 장의 정보와 본문(bytesBase64)을 저장소에 넣습니다",
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
    }

    if violations.is_empty() {
        Ok(rule)
    } else {
        Err(violations)
    }
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

    /// `apps/native-host/src/main.rs` 원문입니다. 빌드할 때 **읽기만** 합니다.
    const HOST_MAIN_RS: &str = include_str!("../../../src/main.rs");

    /// `src/main.rs` 에서 봉투 이름으로 갈래를 나누는 자리를 긁어 옵니다.
    ///
    /// 보는 모양은 둘입니다. `Router::handle` 의 `"event.append" => …` 와
    /// `respond()` 의 `Some("ping") => …` 입니다.
    fn router_types_in_main_rs() -> Vec<String> {
        let mut found = Vec::new();

        for line in HOST_MAIN_RS.lines() {
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
    fn the_table_holds_the_five_request_types() {
        // 고정 계약이 말하는 다섯 이름입니다. 순서까지 표와 같아야 합니다.
        const EXPECTED: [&str; 5] = [
            "ping",
            "event.append",
            "session.status",
            "session.export",
            "frame.store",
        ];

        let ours: Vec<&str> = ENVELOPE_RULES.iter().map(|r| r.message_type).collect();
        assert_eq!(ours, EXPECTED.to_vec());
    }

    #[test]
    fn the_table_matches_the_router_in_main_rs() {
        let mut ours: Vec<String> = ENVELOPE_RULES
            .iter()
            .map(|rule| rule.message_type.to_string())
            .collect();
        ours.sort_unstable();

        assert_eq!(
            router_types_in_main_rs(),
            ours,
            "봉투 표와 src/main.rs 의 갈래가 어긋납니다"
        );
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
