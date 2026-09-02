//! Chrome Native Messaging 프레이밍.
//!
//! 한 메시지는 `4바이트 리틀엔디언 길이` + `그 길이만큼의 UTF-8 JSON` 이다.
//! stdout 은 이 프레임 전용이므로 사람이 읽을 로그는 절대 여기로 내보내지 않는다.
//!
//! 오류 메시지에는 본문 원문을 담지 않고 길이(바이트 수)만 담는다.
//! 확장에서 온 문장이 그대로 로그·응답으로 되돌아가면 프롬프트 주입 경로가 되기 때문이다
//! (docs/master-prompt.md §4-7).

use std::io::{self, Read, Write};

use serde_json::Value;

/// 한 메시지 본문의 상한. Chrome 은 호스트 → 확장 방향 메시지를 1 MB 로 제한한다.
pub const MAX_MESSAGE_BYTES: usize = 1024 * 1024;

/// 프레임 하나를 읽는다.
///
/// - 정상: `Ok(Some(value))`
/// - 스트림이 프레임 경계에서 깨끗하게 닫힘(EOF): `Ok(None)`
/// - 길이 헤더가 4바이트보다 짧게 끊김 / 본문이 잘림: `UnexpectedEof`
/// - 상한 초과 · UTF-8 아님 · JSON 아님: `InvalidData`
pub fn read_message<R: Read>(reader: &mut R) -> io::Result<Option<Value>> {
    let mut header = [0u8; 4];
    let filled = read_as_much_as_possible(reader, &mut header)?;

    if filled == 0 {
        // 프레임 경계에서 스트림이 닫혔다. 정상 종료다.
        return Ok(None);
    }
    if filled < header.len() {
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            format!("길이 헤더가 {filled} 바이트에서 끊겼습니다 · 4 바이트가 필요합니다"),
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

    let text = String::from_utf8(body).map_err(|error| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "본문 {declared} 바이트가 UTF-8 이 아닙니다 · {} 바이트째에서 어긋납니다",
                error.utf8_error().valid_up_to()
            ),
        )
    })?;

    let value = serde_json::from_str::<Value>(&text).map_err(|error| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "본문 {declared} 바이트를 JSON 으로 읽지 못했습니다 · {}행 {}열",
                error.line(),
                error.column()
            ),
        )
    })?;

    Ok(Some(value))
}

/// 프레임 하나를 쓴다. 쓰고 나서 바로 flush 한다(확장이 기다리고 있으므로).
pub fn write_message<W: Write>(writer: &mut W, value: &Value) -> io::Result<()> {
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

    let header = (body.len() as u32).to_le_bytes();
    writer.write_all(&header)?;
    writer.write_all(&body)?;
    writer.flush()
}

/// `buf` 를 채울 수 있는 만큼 채우고 실제로 채운 바이트 수를 돌려준다.
/// `read_exact` 와 달리 "0바이트 EOF" 와 "중간에 끊긴 EOF" 를 호출한 쪽이 구분할 수 있다.
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

    /// 테스트용: 길이 헤더를 손으로 붙인 프레임을 만든다.
    fn frame(body: &[u8]) -> Vec<u8> {
        let mut bytes = (body.len() as u32).to_le_bytes().to_vec();
        bytes.extend_from_slice(body);
        bytes
    }

    #[test]
    fn round_trip_returns_the_same_value() {
        let original = json!({ "type": "ping", "at": "10:32:18" });

        let mut written = Vec::new();
        write_message(&mut written, &original).expect("쓰기가 되어야 한다");

        let mut cursor = io::Cursor::new(written);
        let read = read_message(&mut cursor).expect("읽기가 되어야 한다");

        assert_eq!(read, Some(original));
        // 프레임을 다 읽고 나면 그 다음은 깨끗한 EOF 다.
        assert_eq!(
            read_message(&mut cursor).expect("EOF 는 오류가 아니다"),
            None
        );
    }

    #[test]
    fn empty_stream_yields_none() {
        let mut cursor = io::Cursor::new(Vec::<u8>::new());
        assert_eq!(
            read_message(&mut cursor).expect("EOF 는 오류가 아니다"),
            None
        );
    }

    #[test]
    fn declared_length_over_limit_is_rejected() {
        // 본문을 실제로 만들지 않고 길이 헤더만 상한 + 1 로 선언한다.
        let mut bytes = ((MAX_MESSAGE_BYTES + 1) as u32).to_le_bytes().to_vec();
        bytes.extend_from_slice(b"{}");

        let mut cursor = io::Cursor::new(bytes);
        let error = read_message(&mut cursor).expect_err("상한을 넘으면 오류여야 한다");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("상한"), "{error}");
    }

    #[test]
    fn truncated_length_header_is_unexpected_eof() {
        let mut cursor = io::Cursor::new(vec![0x02, 0x00]); // 4바이트여야 하는데 2바이트
        let error = read_message(&mut cursor).expect_err("잘린 헤더는 오류여야 한다");

        assert_eq!(error.kind(), io::ErrorKind::UnexpectedEof);
        assert!(error.to_string().contains("길이 헤더"), "{error}");
    }

    #[test]
    fn truncated_body_is_unexpected_eof() {
        let mut bytes = 32u32.to_le_bytes().to_vec(); // 32바이트라고 해 놓고
        bytes.extend_from_slice(b"{\"type\":\"pi"); // 11바이트만 준다

        let mut cursor = io::Cursor::new(bytes);
        let error = read_message(&mut cursor).expect_err("잘린 본문은 오류여야 한다");

        assert_eq!(error.kind(), io::ErrorKind::UnexpectedEof);
        assert!(error.to_string().contains("잘렸습니다"), "{error}");
    }

    #[test]
    fn invalid_json_is_invalid_data_without_echoing_body() {
        let mut cursor = io::Cursor::new(frame(b"not json at all"));
        let error = read_message(&mut cursor).expect_err("JSON 이 아니면 오류여야 한다");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(
            !error.to_string().contains("not json"),
            "원문이 새면 안 된다: {error}"
        );
        assert!(error.to_string().contains("15 바이트"), "{error}");
    }

    #[test]
    fn invalid_utf8_is_invalid_data() {
        let mut cursor = io::Cursor::new(frame(&[0x22, 0xff, 0xfe, 0x22]));
        let error = read_message(&mut cursor).expect_err("UTF-8 이 아니면 오류여야 한다");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("UTF-8"), "{error}");
    }

    #[test]
    fn write_over_limit_is_rejected() {
        let huge = json!({ "text": "가".repeat(MAX_MESSAGE_BYTES) });
        let mut written = Vec::new();
        let error = write_message(&mut written, &huge).expect_err("상한을 넘으면 오류여야 한다");

        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(
            written.is_empty(),
            "거절한 메시지는 한 바이트도 나가면 안 된다"
        );
    }

    #[test]
    fn header_is_little_endian() {
        let mut written = Vec::new();
        write_message(&mut written, &json!({})).expect("쓰기가 되어야 한다");

        assert_eq!(&written[..4], &[0x02, 0x00, 0x00, 0x00]);
        assert_eq!(&written[4..], b"{}");
    }
}
