//! Corthex Classmate 로컬 도우미(Chrome Native Messaging Host)의 진입점.
//!
//! 하는 일은 아직 하나다. stdin 으로 들어온 프레임을 읽고, `{"type":"ping"}` 에
//! 신원(hello)으로 답하고, 모르는 type 에는 오류로 답한다. stdin 이 닫히면 0 으로 끝난다.
//!
//! 지키는 경계 (docs/master-prompt.md §4-7):
//! - stdout 은 프로토콜 전용이다. 사람이 읽을 로그는 전부 stderr 로만 나간다.
//! - 메시지 안의 문자열을 명령·경로·셸로 절대 넘기지 않는다. 지금 코드에는 실행 경로 자체가 없다.
//! - 오류로 되돌려 보내는 값에 본문 원문을 담지 않는다. 길이만 담는다.

mod protocol;

use std::io::{self, BufWriter, Read, Write};
use std::process::ExitCode;

use serde::Deserialize;
use serde_json::{json, Value};

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
fn serve<R: Read, W: Write>(reader: &mut R, writer: &mut W) -> io::Result<()> {
    loop {
        match protocol::read_message(reader)? {
            None => return Ok(()),
            Some(message) => {
                let reply = respond(&message);
                protocol::write_message(writer, &reply)?;
            }
        }
    }
}

/// 요청 하나에 대한 응답을 만든다. 부수 효과가 없어서 테스트하기 쉽다.
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
}
