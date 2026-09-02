//! Chrome Native Messaging 프레이밍.
//!
//! 한 메시지는 `4바이트 리틀엔디언 길이` + `그 길이만큼의 UTF-8 JSON` 입니다.
//! stdout 은 이 프레임 전용이므로 사람이 읽을 로그는 절대 여기로 내보내지 않습니다.
//!
//! 오류 메시지에는 본문 원문을 담지 않고 길이(바이트 수)만 담습니다.
//! 확장에서 온 문장이 그대로 로그·응답으로 되돌아가면 프롬프트 주입 경로가 되기 때문입니다
//! (docs/master-prompt.md §4-7).
//!
//! 이 모듈은 루트 크레이트 `src/protocol.rs` 를 이 크레이트로 옮겨 정리한 것입니다.
//! 1라운드에서는 루트 파일을 그대로 두고 여기에 복사본을 둡니다(단위끼리 파일을 겹쳐 고치지
//! 않기 위해서입니다). 루트가 이 모듈을 쓰도록 바꾸는 것은 2라운드 몫입니다.

use std::io::{self, Read, Write};

use serde_json::Value;

/// 한 메시지 본문의 상한. Chrome 은 호스트 → 확장 방향 메시지를 1 MB 로 제한합니다.
pub const MAX_MESSAGE_BYTES: usize = 1024 * 1024;

/// 길이 헤더의 바이트 수. Native Messaging 은 리틀엔디언 `u32` 하나로 고정입니다.
pub const HEADER_BYTES: usize = 4;

/// 프레임 하나를 읽은 결과.
///
/// 여기서 갈리는 것이 중요합니다. **본문을 끝까지 읽었으면** 스트림은 다음 프레임 경계에
/// 정확히 서 있으므로 오류로 답하고 **계속 살아 있어도 됩니다**([`Frame::Undecodable`]).
/// 반대로 길이 헤더나 본문이 잘렸거나 상한을 넘어 본문을 건너뛰지 못했으면 다음 프레임이
/// 어디서 시작하는지 알 수 없으므로 **살릴 수 없습니다**(그때는 `Err`).
#[derive(Debug, PartialEq)]
pub enum Frame {
    /// 읽어서 JSON 으로 풀린 메시지.
    Message(Value),
    /// 본문은 끝까지 읽었지만 UTF-8 이나 JSON 이 아니었습니다. `detail` 에는 길이만 담고
    /// 본문 원문은 담지 않습니다(§4-7).
    Undecodable { bytes: usize, detail: String },
    /// 프레임 경계에서 스트림이 깨끗하게 닫혔습니다.
    Eof,
}

/// 프레임 하나를 읽습니다. 살릴 수 있는 오류와 살릴 수 없는 오류를 구분합니다.
///
/// - 정상: `Ok(Frame::Message(value))`
/// - 본문은 다 읽었으나 UTF-8·JSON 이 아님: `Ok(Frame::Undecodable { .. })`
/// - 프레임 경계에서 닫힘: `Ok(Frame::Eof)`
/// - 길이 헤더가 끊김 / 본문이 잘림 / 상한 초과: `Err`
pub fn read_frame<R: Read>(reader: &mut R) -> io::Result<Frame> {
    let mut header = [0u8; HEADER_BYTES];
    let filled = read_as_much_as_possible(reader, &mut header)?;

    if filled == 0 {
        // 프레임 경계에서 스트림이 닫혔습니다. 정상 종료입니다.
        return Ok(Frame::Eof);
    }
    if filled < header.len() {
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            format!(
                "길이 헤더가 {filled} 바이트에서 끊겼습니다 · {HEADER_BYTES} 바이트가 필요합니다"
            ),
        ));
    }

    let declared = u32::from_le_bytes(header) as usize;
    if declared > MAX_MESSAGE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("본문 {declared} 바이트가 상한 {MAX_MESSAGE_BYTES} 바이트를 넘었습니다"),
        ));
    }

    let mut body = vec![0u8; declared];
    let filled = read_as_much_as_possible(reader, &mut body)?;
    if filled < declared {
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            format!("본문이 {filled} 바이트에서 잘렸습니다 · {declared} 바이트가 필요합니다"),
        ));
    }

    Ok(decode_body(body))
}

/// [`read_frame`] 을 감싸서 "메시지 하나 아니면 EOF" 로만 보는 얇은 겉옷입니다.
///
/// 본문을 풀지 못한 프레임도 오류로 바꿔 돌려주므로, 이 함수를 쓰는 쪽은 살릴 수 있는
/// 오류와 없는 오류를 구분하지 못합니다. 구분이 필요하면 [`read_frame`] 을 직접 씁니다.
pub fn read_message<R: Read>(reader: &mut R) -> io::Result<Option<Value>> {
    match read_frame(reader)? {
        Frame::Message(value) => Ok(Some(value)),
        Frame::Eof => Ok(None),
        Frame::Undecodable { detail, .. } => {
            Err(io::Error::new(io::ErrorKind::InvalidData, detail))
        }
    }
}

/// 프레임 하나를 씁니다. 쓰고 나서 바로 flush 합니다(확장이 기다리고 있으므로).
pub fn write_message<W: Write>(writer: &mut W, value: &Value) -> io::Result<()> {
    let body = encode_body(value)?;

    writer.write_all(&(body.len() as u32).to_le_bytes())?;
    writer.write_all(&body)?;
    writer.flush()
}

/// 값 하나를 프레임 본문 바이트로 만듭니다. 상한을 넘으면 한 바이트도 내보내지 않습니다.
///
/// 프레임을 손으로 조립해야 하는 자리(시험·왕복 스크립트)가 쓰라고 밖으로 냅니다.
pub fn encode_body(value: &Value) -> io::Result<Vec<u8>> {
    let body = serde_json::to_vec(value)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error.to_string()))?;

    if body.len() > MAX_MESSAGE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "본문 {} 바이트가 상한 {MAX_MESSAGE_BYTES} 바이트를 넘었습니다",
                body.len()
            ),
        ));
    }

    Ok(body)
}

/// 다 읽은 본문 바이트를 [`Frame`] 으로 바꿉니다. 여기서는 스트림을 더 건드리지 않으므로
/// 실패해도 [`Frame::Undecodable`] 이지 `Err` 이 아닙니다.
fn decode_body(body: Vec<u8>) -> Frame {
    let bytes = body.len();

    let text = match String::from_utf8(body) {
        Ok(text) => text,
        Err(error) => {
            return Frame::Undecodable {
                bytes,
                detail: format!(
                    "본문 {bytes} 바이트가 UTF-8 이 아닙니다 · {} 바이트째에서 어긋납니다",
                    error.utf8_error().valid_up_to()
                ),
            }
        }
    };

    match serde_json::from_str::<Value>(&text) {
        Ok(value) => Frame::Message(value),
        Err(error) => Frame::Undecodable {
            bytes,
            detail: format!(
                "본문 {bytes} 바이트를 JSON 으로 읽지 못했습니다 · {}행 {}열",
                error.line(),
                error.column()
            ),
        },
    }
}

/// `buf` 를 채울 수 있는 만큼 채우고 실제로 채운 바이트 수를 돌려줍니다.
/// `read_exact` 와 달리 "0바이트 EOF" 와 "중간에 끊긴 EOF" 를 호출한 쪽이 구분할 수 있습니다.
fn read_as_much_as_possible<R: Read>(reader: &mut R, buf: &mut [u8]) -> io::Result<usize> {
    let mut filled = 0;
    while filled < buf.len() {
        match reader.read(&mut buf[filled..]) {
            Ok(0) => break,
            Ok(read) => filled += read,
            Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
            Err(error) => return Err(error),
        }
    }
    Ok(filled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// 시험용: 길이 헤더를 손으로 붙인 프레임을 만듭니다.
    fn frame(body: &[u8]) -> Vec<u8> {
        let mut bytes = (body.len() as u32).to_le_bytes().to_vec();
        bytes.extend_from_slice(body);
        bytes
    }

    /// 직렬화 결과가 정확히 `total` 바이트가 되는 값을 만듭니다.
    /// `{"text":""}` 이 11 바이트이므로 나머지를 ASCII 로 채웁니다.
    fn value_of_exact_size(total: usize) -> Value {
        let skeleton = json!({ "text": "" }).to_string().len();
        assert!(total >= skeleton, "{skeleton} 바이트보다는 커야 합니다");
        json!({ "text": "a".repeat(total - skeleton) })
    }

    #[test]
    fn round_trip_returns_the_same_value() {
        let original = json!({ "type": "ping", "at": "2026-09-02T10:32:18+09:00" });

        let mut written = Vec::new();
        write_message(&mut written, &original).expect("쓰기가 되어야 합니다");

        let mut cursor = io::Cursor::new(written);
        let read = read_message(&mut cursor).expect("읽기가 되어야 합니다");

        assert_eq!(read, Some(original));
        // 프레임을 다 읽고 나면 그 다음은 깨끗한 EOF 입니다.
        assert_eq!(
            read_message(&mut cursor).expect("EOF 는 오류가 아닙니다"),
            None
        );
    }

    #[test]
    fn header_is_little_endian() {
        let mut written = Vec::new();
        write_message(&mut written, &json!({})).expect("쓰기가 되어야 합니다");

        assert_eq!(&written[..HEADER_BYTES], &[0x02, 0x00, 0x00, 0x00]);
        assert_eq!(&written[HEADER_BYTES..], b"{}");
    }

    #[test]
    fn empty_stream_yields_none() {
        let mut cursor = io::Cursor::new(Vec::<u8>::new());
        assert_eq!(
            read_message(&mut cursor).expect("EOF 는 오류가 아닙니다"),
            None
        );
    }

    #[test]
    fn zero_length_body_is_undecodable_but_keeps_the_boundary() {
        // 경계값 0: 길이만 0 이고 본문이 없는 프레임입니다. 빈 문자열은 JSON 이 아닙니다.
        let mut bytes = frame(b"");
        write_message(&mut bytes, &json!({ "type": "ping" })).expect("쓰기가 되어야 합니다");

        let mut cursor = io::Cursor::new(bytes);
        match read_frame(&mut cursor).expect("본문을 다 읽었으니 오류가 아닙니다") {
            Frame::Undecodable { bytes, detail } => {
                assert_eq!(bytes, 0);
                assert!(detail.contains("0 바이트"), "{detail}");
            }
            other => panic!("Undecodable 이어야 합니다: {other:?}"),
        }

        // 0 바이트짜리 프레임 뒤의 경계도 그대로 살아 있어야 합니다.
        assert_eq!(
            read_frame(&mut cursor).expect("읽기"),
            Frame::Message(json!({ "type": "ping" }))
        );
    }

    #[test]
    fn body_of_exactly_the_limit_round_trips() {
        // 경계값 1 MiB: 상한과 같은 크기는 통과해야 합니다.
        let original = value_of_exact_size(MAX_MESSAGE_BYTES);

        let mut written = Vec::new();
        write_message(&mut written, &original).expect("상한과 같으면 통과해야 합니다");
        assert_eq!(written.len(), HEADER_BYTES + MAX_MESSAGE_BYTES);

        let mut cursor = io::Cursor::new(written);
        assert_eq!(
            read_message(&mut cursor).expect("읽기가 되어야 합니다"),
            Some(original)
        );
    }

    #[test]
    fn body_one_byte_over_the_limit_is_rejected_on_both_sides() {
        // 경계값 1 MiB + 1: 쓰는 쪽도 읽는 쪽도 거절해야 합니다.
        let too_big = value_of_exact_size(MAX_MESSAGE_BYTES + 1);

        let mut written = Vec::new();
        let error = write_message(&mut written, &too_big).expect_err("상한을 넘으면 오류입니다");
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(
            written.is_empty(),
            "거절한 메시지는 한 바이트도 나가면 안 됩니다"
        );

        // 본문을 실제로 만들지 않고 길이 헤더만 상한 + 1 로 선언해도 막아야 합니다.
        let mut bytes = ((MAX_MESSAGE_BYTES + 1) as u32).to_le_bytes().to_vec();
        bytes.extend_from_slice(b"{}");
        let mut cursor = io::Cursor::new(bytes);
        let error = read_message(&mut cursor).expect_err("상한을 넘으면 오류입니다");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("상한"), "{error}");
    }

    #[test]
    fn truncated_length_header_is_unexpected_eof() {
        let mut cursor = io::Cursor::new(vec![0x02, 0x00]); // 4바이트여야 하는데 2바이트
        let error = read_message(&mut cursor).expect_err("잘린 헤더는 오류여야 합니다");

        assert_eq!(error.kind(), io::ErrorKind::UnexpectedEof);
        assert!(error.to_string().contains("길이 헤더"), "{error}");
    }

    #[test]
    fn truncated_body_is_unexpected_eof() {
        let mut bytes = 32u32.to_le_bytes().to_vec(); // 32바이트라고 해 놓고
        bytes.extend_from_slice(b"{\"type\":\"pi"); // 11바이트만 줍니다

        let mut cursor = io::Cursor::new(bytes);
        let error = read_message(&mut cursor).expect_err("잘린 본문은 오류여야 합니다");

        assert_eq!(error.kind(), io::ErrorKind::UnexpectedEof);
        assert!(error.to_string().contains("잘렸습니다"), "{error}");
    }

    #[test]
    fn invalid_json_is_invalid_data_without_echoing_body() {
        let mut cursor = io::Cursor::new(frame(b"not json at all"));
        let error = read_message(&mut cursor).expect_err("JSON 이 아니면 오류여야 합니다");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(
            !error.to_string().contains("not json"),
            "원문이 새면 안 됩니다: {error}"
        );
        assert!(error.to_string().contains("15 바이트"), "{error}");
    }

    #[test]
    fn invalid_utf8_is_reported_without_echoing_body() {
        // 0xff 0xfe 는 UTF-8 로 올 수 없는 바이트입니다.
        let mut cursor = io::Cursor::new(frame(&[0x22, 0xff, 0xfe, 0x22]));
        match read_frame(&mut cursor).expect("본문을 다 읽었으니 오류가 아닙니다") {
            Frame::Undecodable { bytes, detail } => {
                assert_eq!(bytes, 4);
                assert!(detail.contains("UTF-8"), "{detail}");
                assert!(detail.contains("1 바이트째"), "{detail}");
            }
            other => panic!("Undecodable 이어야 합니다: {other:?}"),
        }

        // 얇은 겉옷 쪽에서는 같은 프레임이 오류로 올라옵니다.
        let mut cursor = io::Cursor::new(frame(&[0x22, 0xff, 0xfe, 0x22]));
        let error = read_message(&mut cursor).expect_err("UTF-8 이 아니면 오류여야 합니다");
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("UTF-8"), "{error}");
    }

    #[test]
    fn undecodable_body_keeps_the_stream_aligned() {
        // 깨진 프레임 하나 뒤에 멀쩡한 프레임 하나를 붙입니다.
        let mut bytes = frame(b"not json at all");
        write_message(&mut bytes, &json!({ "type": "ping" })).expect("쓰기가 되어야 합니다");

        let mut cursor = io::Cursor::new(bytes);
        match read_frame(&mut cursor).expect("본문을 다 읽었으니 오류가 아닙니다") {
            Frame::Undecodable { bytes, detail } => {
                assert_eq!(bytes, 15);
                assert!(
                    !detail.contains("not json"),
                    "원문이 새면 안 됩니다: {detail}"
                );
            }
            other => panic!("Undecodable 이어야 합니다: {other:?}"),
        }

        // 다음 프레임 경계가 그대로 살아 있어야 재연결 없이 계속 답할 수 있습니다.
        assert_eq!(
            read_frame(&mut cursor).expect("읽기"),
            Frame::Message(json!({ "type": "ping" }))
        );
        assert_eq!(read_frame(&mut cursor).expect("읽기"), Frame::Eof);
    }

    #[test]
    fn many_frames_round_trip_in_order() {
        let originals = [
            json!({ "type": "ping" }),
            json!({ "type": "session.status", "periodId": "2026-09-02-p3" }),
            json!({ "type": "hello", "protocol": 1 }),
        ];

        let mut written = Vec::new();
        for value in &originals {
            write_message(&mut written, value).expect("쓰기가 되어야 합니다");
        }

        let mut cursor = io::Cursor::new(written);
        for value in &originals {
            assert_eq!(
                read_message(&mut cursor).expect("읽기"),
                Some(value.clone())
            );
        }
        assert_eq!(read_message(&mut cursor).expect("읽기"), None);
    }
}
