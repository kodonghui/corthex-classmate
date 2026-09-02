//! 표준 base64(RFC 4648 §4)를 std 만으로 읽는 아주 작은 디코더.
//!
//! 왜 crate 를 들이지 않는가
//! ------------------------
//! 이 crate 의 빌드 조건이 까다롭습니다. C 컴파일러가 없는 gnu 툴체인에서 링크되어야 하고,
//! SQLite 도 OS 것을 빌려 쓰고 있습니다(`README.md` 2-3). 의존성이 하나 늘 때마다 그 조건을
//! 다시 확인해야 하는데, 여기서 필요한 것은 **읽기 한 방향**뿐입니다. 그래서 직접 씁니다.
//!
//! 무엇을 받고 무엇을 거절하는가
//! ----------------------------
//! - 알파벳은 표준 `A-Z a-z 0-9 + /` 입니다. URL 안전판(`-` `_`)은 받지 않습니다.
//! - 꼬리 `=` 는 **있어도 없어도** 됩니다. 확장이 `btoa` 로 만들면 붙고, 손으로 자르면 없습니다.
//! - 공백·줄바꿈은 **거절**합니다. 알파벳에 없는 글자이기 때문입니다. MIME 처럼 76자마다 줄을
//!   바꾸는 모양은 우리 프로토콜에 오지 않습니다(한 줄짜리 JSON 문자열로 옵니다).
//!
//! 알아 둘 느슨한 자리
//! ------------------
//! 마지막 조각의 남는 비트가 0 인지까지는 보지 않습니다. 예를 들어 `Zg==` 와 `Zh==` 는 둘 다
//! `f` 한 글자로 읽힙니다. 여기서 얻는 값은 바이트 배열이고 그 바이트가 다시 파일로만 가므로,
//! 표준을 어긴 인코더를 가려내는 일이 이 자리의 몫은 아닙니다.

use std::fmt;

/// base64 를 읽지 못한 이유. 원문은 담지 않습니다(확장이 보낸 값이기 때문입니다).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Base64Error {
    /// 글자 수를 4로 나눈 나머지가 1입니다. 어떤 바이트 수로도 떨어지지 않습니다.
    Length,
    /// 표준 알파벳에 없는 글자입니다. 공백·줄바꿈·URL 안전판 글자가 여기에 듭니다.
    Character,
    /// `=` 가 끝이 아닌 자리에 있거나 개수가 맞지 않습니다.
    Padding,
}

impl fmt::Display for Base64Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Length => write!(formatter, "base64 길이가 맞지 않습니다"),
            Self::Character => write!(formatter, "base64 에 쓸 수 없는 글자가 있습니다"),
            Self::Padding => write!(formatter, "base64 의 = 자리가 맞지 않습니다"),
        }
    }
}

impl std::error::Error for Base64Error {}

/// base64 문자열을 바이트로 읽습니다. 빈 문자열은 빈 배열입니다.
pub fn decode(text: &str) -> Result<Vec<u8>, Base64Error> {
    let all = text.as_bytes();

    // 꼬리의 `=` 를 먼저 떼어 냅니다. `=` 는 끝에만, 많아야 둘입니다.
    let mut body_len = all.len();
    let mut padding = 0usize;
    while body_len > 0 && all[body_len - 1] == b'=' {
        body_len -= 1;
        padding += 1;
    }
    if padding > 2 {
        return Err(Base64Error::Padding);
    }
    // 패딩을 붙였다면 전체 길이는 반드시 4의 배수입니다.
    if padding > 0 && all.len() % 4 != 0 {
        return Err(Base64Error::Padding);
    }

    let body = &all[..body_len];
    // 떼어 낸 뒤에도 `=` 가 남아 있으면 가운데에 있었다는 뜻입니다.
    if body.contains(&b'=') {
        return Err(Base64Error::Padding);
    }
    // 6비트씩 모아 8비트가 차면 한 바이트씩 꺼냅니다.
    //
    // 글자 검사를 길이 검사보다 **먼저** 합니다. `"Zm9v Ymfy"` 처럼 둘 다 어긋난 값에서는
    // "길이가 이상하다" 보다 "쓸 수 없는 글자가 있다" 가 고칠 곳을 바로 가리키기 때문입니다.
    let mut decoded = Vec::with_capacity(body.len() / 4 * 3 + 2);
    let mut accumulator = 0u32;
    let mut filled = 0u32;
    for letter in body {
        let sextet = sextet_of(*letter).ok_or(Base64Error::Character)?;
        accumulator = (accumulator << 6) | u32::from(sextet);
        filled += 6;
        if filled >= 8 {
            filled -= 8;
            decoded.push(((accumulator >> filled) & 0xFF) as u8);
        }
    }

    // 남은 조각이 6비트뿐이면 어떤 바이트로도 떨어지지 않습니다(글자 수 % 4 == 1).
    if filled == 6 {
        return Err(Base64Error::Length);
    }

    Ok(decoded)
}

/// 글자 하나를 0~63 값으로 바꿉니다. 알파벳에 없으면 `None`.
fn sextet_of(letter: u8) -> Option<u8> {
    match letter {
        b'A'..=b'Z' => Some(letter - b'A'),
        b'a'..=b'z' => Some(letter - b'a' + 26),
        b'0'..=b'9' => Some(letter - b'0' + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// RFC 4648 §10 의 시험 벡터 그대로.
    #[test]
    fn the_rfc_4648_vectors_round_trip() {
        let vectors: [(&str, &str); 7] = [
            ("", ""),
            ("Zg==", "f"),
            ("Zm8=", "fo"),
            ("Zm9v", "foo"),
            ("Zm9vYg==", "foob"),
            ("Zm9vYmE=", "fooba"),
            ("Zm9vYmFy", "foobar"),
        ];

        for (encoded, expected) in vectors {
            let decoded = decode(encoded).unwrap_or_else(|error| panic!("{encoded:?} · {error}"));
            assert_eq!(decoded, expected.as_bytes(), "{encoded:?}");
        }
    }

    #[test]
    fn padding_may_be_left_out() {
        assert_eq!(decode("Zg").expect("읽혀야 한다"), b"f");
        assert_eq!(decode("Zm8").expect("읽혀야 한다"), b"fo");
        assert_eq!(decode("Zm9vYg").expect("읽혀야 한다"), b"foob");
        assert_eq!(decode("Zm9vYmE").expect("읽혀야 한다"), b"fooba");
    }

    #[test]
    fn the_fixture_webp_header_is_readable() {
        // fixtures 의 1x1 자리표시자 WebP 34바이트를 그대로 base64 로 적은 값.
        let decoded =
            decode("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==").expect("읽혀야 한다");

        assert_eq!(decoded.len(), 34);
        assert_eq!(&decoded[0..4], b"RIFF");
        assert_eq!(&decoded[8..12], b"WEBP");
    }

    #[test]
    fn lengths_that_cannot_become_bytes_are_refused() {
        assert_eq!(decode("Z"), Err(Base64Error::Length));
        assert_eq!(decode("Zm9vY"), Err(Base64Error::Length));
    }

    #[test]
    fn letters_outside_the_alphabet_are_refused() {
        assert_eq!(decode("Zm9v Ymfy"), Err(Base64Error::Character));
        assert_eq!(decode("Zm9v\nYmFy"), Err(Base64Error::Character));
        assert_eq!(decode("Zm9vYmF*"), Err(Base64Error::Character));
        // URL 안전판 알파벳은 받지 않는다.
        assert_eq!(decode("Zm9-YmFy"), Err(Base64Error::Character));
        assert_eq!(decode("가나다라"), Err(Base64Error::Character));
    }

    #[test]
    fn misplaced_padding_is_refused() {
        assert_eq!(decode("="), Err(Base64Error::Padding));
        assert_eq!(decode("Zg="), Err(Base64Error::Padding));
        assert_eq!(decode("Zg==="), Err(Base64Error::Padding));
        assert_eq!(decode("Zm=9v"), Err(Base64Error::Padding));
        assert_eq!(decode("Zm9v="), Err(Base64Error::Padding));
    }

    #[test]
    fn every_byte_value_survives_a_hand_written_round_trip() {
        // 0..=255 를 손으로 인코딩해 넣고 그대로 돌아오는지 본다(인코더는 시험 안에만 둔다).
        let original: Vec<u8> = (0..=255u8).collect();
        let encoded = encode_for_test(&original);

        assert_eq!(decode(&encoded).expect("읽혀야 한다"), original);
    }

    /// 시험에서만 쓰는 인코더. 본 코드에는 인코딩이 필요 없다.
    fn encode_for_test(bytes: &[u8]) -> String {
        const ALPHABET: &[u8; 64] =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

        let mut out = String::new();
        for chunk in bytes.chunks(3) {
            let mut block = [0u8; 3];
            block[..chunk.len()].copy_from_slice(chunk);
            let packed =
                (u32::from(block[0]) << 16) | (u32::from(block[1]) << 8) | u32::from(block[2]);

            for slot in 0..4 {
                if slot <= chunk.len() {
                    let sextet = (packed >> (18 - 6 * slot)) & 0x3F;
                    out.push(ALPHABET[sextet as usize] as char);
                } else {
                    out.push('=');
                }
            }
        }
        out
    }
}
