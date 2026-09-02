//! 시각 한 종류만 다루는 아주 작은 도구 상자입니다.
//!
//! 세션 기록의 `at` 은 계약(`packages/contracts/schemas/common.schema.json` 의 `IsoDateTime`)에
//! 따라 ISO 8601 문자열입니다. 여기서는 그중 두 가지만 합니다.
//!
//! 1. 지금 시각을 `2026-09-02T01:32:18.123Z`(UTC · 밀리초 3자리) 로 적습니다.
//! 2. 적혀 있는 ISO 8601 문자열을 다시 epoch 밀리초로 읽습니다. 오프셋(`+09:00`)도 받습니다.
//!
//! 날짜 계산 crate 를 새로 들이지 않은 이유는 필요한 것이 이 둘뿐이고, 의존성이 늘면
//! 이 crate 의 빌드 조건(C 컴파일러 없는 gnu 툴체인)이 다시 까다로워지기 때문입니다.
//! 그레고리력 변환은 Howard Hinnant 의 `days_from_civil` / `civil_from_days` 공식을 씁니다.
//!
//! 왜 글자가 아니라 바이트로 자르는가
//! ---------------------------------
//! 여기 들어오는 문자열은 **확장이 보낸 값**입니다. `&text[17..19]` 처럼 `&str` 을 바이트 자리로
//! 자르면 그 자리가 글자 한가운데일 때 Rust 가 패닉을 냅니다(`"2026-09-02T10:32:1한"` 이 그런
//! 값입니다). 값 하나로 호스트 프로세스가 죽으면 안 되므로, 자르는 자리는 전부 `as_bytes()` 위의
//! `get(..)` 과 길이가 확인된 바이트 슬라이스로 다룹니다. 바이트 슬라이스는 글자 경계를 따지지
//! 않으므로 **어떤 입력에도 패닉하지 않고** 모양이 아니면 `None` 이 됩니다.

use std::time::{SystemTime, UNIX_EPOCH};

const MILLIS_PER_DAY: i64 = 86_400_000;

/// 지금 시각을 `YYYY-MM-DDTHH:MM:SS.sssZ` (UTC) 로 적습니다.
pub fn now_rfc3339_millis() -> String {
    epoch_millis_to_rfc3339(now_epoch_millis())
}

/// 지금 시각의 epoch 밀리초입니다. 시스템 시계가 1970 년 이전이면 음수가 됩니다.
pub fn now_epoch_millis() -> i64 {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(elapsed) => elapsed.as_millis() as i64,
        Err(error) => -(error.duration().as_millis() as i64),
    }
}

/// epoch 밀리초를 `YYYY-MM-DDTHH:MM:SS.sssZ` 로 적습니다.
pub fn epoch_millis_to_rfc3339(epoch_millis: i64) -> String {
    let days = epoch_millis.div_euclid(MILLIS_PER_DAY);
    let millis_of_day = epoch_millis.rem_euclid(MILLIS_PER_DAY);

    let (year, month, day) = civil_from_days(days);
    let hour = millis_of_day / 3_600_000;
    let minute = (millis_of_day % 3_600_000) / 60_000;
    let second = (millis_of_day % 60_000) / 1_000;
    let millis = millis_of_day % 1_000;

    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millis:03}Z")
}

/// ISO 8601 문자열을 epoch 밀리초로 읽습니다. 모양이 아니면 `None` 입니다.
///
/// 받는 모양: `YYYY-MM-DDTHH:MM:SS` 뒤에 소수점 이하(선택)와 `Z` 또는 `+HH:MM` / `-HH:MM`(선택).
/// 소수점 이하는 앞 세 자리만 봅니다(밀리초까지). 오프셋이 없으면 UTC 로 봅니다.
///
/// 확장이 보낸 값이 그대로 들어오는 자리이므로 **어떤 문자열에도 패닉하지 않습니다.**
pub fn rfc3339_to_epoch_millis(text: &str) -> Option<i64> {
    // 여기서부터 끝까지 `text` 를 다시 `&str` 로 자르지 않습니다. 전부 바이트로 봅니다.
    let bytes = text.as_bytes();
    if bytes.len() < 19 {
        return None;
    }
    // 날짜와 시각 사이 구분자는 'T' 또는 ' ' 를 받습니다.
    if !matches!(bytes[10], b'T' | b't' | b' ') {
        return None;
    }
    if bytes[4] != b'-' || bytes[7] != b'-' || bytes[13] != b':' || bytes[16] != b':' {
        return None;
    }

    // `get` 은 자리가 없으면 `None` 이고, 바이트 슬라이스라 글자 한가운데여도 패닉하지 않습니다.
    let year = parse_number(bytes.get(0..4)?)?;
    let month = parse_number(bytes.get(5..7)?)?;
    let day = parse_number(bytes.get(8..10)?)?;
    let hour = parse_number(bytes.get(11..13)?)?;
    let minute = parse_number(bytes.get(14..16)?)?;
    let second = parse_number(bytes.get(17..19)?)?;

    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    if hour > 23 || minute > 59 || second > 60 {
        return None;
    }

    let mut rest = bytes.get(19..)?;

    let mut millis = 0i64;
    if rest.first() == Some(&b'.') {
        let fraction = &rest[1..];
        let digits = fraction
            .iter()
            .take_while(|letter| letter.is_ascii_digit())
            .count();
        if digits == 0 {
            return None;
        }
        // 앞 세 자리까지가 밀리초입니다. 모자라면 뒤를 `0` 으로 채웁니다.
        // 숫자가 아닌 자리는 섞지 않습니다(`.1Z` 의 `Z` 가 밀리초에 들어가면 안 됩니다).
        let mut three = [b'0'; 3];
        for (slot, digit) in three.iter_mut().zip(fraction[..digits].iter().take(3)) {
            *slot = *digit;
        }
        millis = parse_number(&three)?;
        rest = &rest[1 + digits..];
    }

    let offset_millis = parse_offset(rest)?;

    let days = days_from_civil(year, month as u32, day as u32);
    let time_of_day = hour * 3_600_000 + minute * 60_000 + second * 1_000 + millis;

    Some(days * MILLIS_PER_DAY + time_of_day - offset_millis)
}

/// 꼬리에 붙는 시간대 표기를 밀리초로 바꿉니다. 비어 있으면 UTC(0)로 봅니다.
///
/// 들어오는 값이 바이트 슬라이스이고 자르는 자리마다 길이를 먼저 보므로 패닉하지 않습니다.
fn parse_offset(rest: &[u8]) -> Option<i64> {
    if rest.is_empty() || rest.eq_ignore_ascii_case(b"z") {
        return Some(0);
    }

    let sign = match rest[0] {
        b'+' => 1,
        b'-' => -1,
        _ => return None,
    };
    let body = &rest[1..];
    let (hours, minutes) = match body.len() {
        // `+HH:MM`
        5 if body[2] == b':' => (parse_number(&body[0..2])?, parse_number(&body[3..5])?),
        // `+HHMM` — 자리 하나하나가 ASCII 숫자인지는 `parse_number` 가 봅니다.
        4 => (parse_number(&body[0..2])?, parse_number(&body[2..4])?),
        // `+HH`
        2 => (parse_number(body)?, 0),
        _ => return None,
    };
    if hours > 23 || minutes > 59 {
        return None;
    }

    Some(sign * (hours * 3_600_000 + minutes * 60_000))
}

/// 숫자만 있는 짧은 바이트 조각을 정수로 읽습니다. ASCII 숫자가 아닌 바이트가 하나라도 있으면 `None`.
fn parse_number(bytes: &[u8]) -> Option<i64> {
    if bytes.is_empty() || !bytes.iter().all(u8::is_ascii_digit) {
        return None;
    }

    let mut value = 0i64;
    for letter in bytes {
        value = value
            .checked_mul(10)?
            .checked_add(i64::from(letter - b'0'))?;
    }
    Some(value)
}

/// 1970-01-01 로부터 며칠째인지 → 그 날의 (년, 월, 일).
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let shifted = days + 719_468;
    let era = if shifted >= 0 {
        shifted
    } else {
        shifted - 146_096
    } / 146_097;
    let day_of_era = shifted - era * 146_097; // [0, 146096]
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153; // [0, 11] · 3월이 0
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = if month_prime < 10 {
        month_prime + 3
    } else {
        month_prime - 9
    };

    (if month <= 2 { year + 1 } else { year }, month, day)
}

/// (년, 월, 일) → 1970-01-01 로부터 며칠째인지.
fn days_from_civil(year: i64, month: u32, day: u32) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let year_of_era = year - era * 400; // [0, 399]
    let month_prime = if month > 2 { month - 3 } else { month + 9 } as i64;
    let day_of_year = (153 * month_prime + 2) / 5 + day as i64 - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;

    era * 146_097 + day_of_era - 719_468
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn epoch_zero_is_the_unix_birthday() {
        assert_eq!(epoch_millis_to_rfc3339(0), "1970-01-01T00:00:00.000Z");
    }

    #[test]
    fn a_known_moment_round_trips() {
        // 2026-09-02T10:32:18.123+09:00 == 2026-09-02T01:32:18.123Z
        let seoul = rfc3339_to_epoch_millis("2026-09-02T10:32:18.123+09:00").expect("읽혀야 한다");
        let utc = rfc3339_to_epoch_millis("2026-09-02T01:32:18.123Z").expect("읽혀야 한다");

        assert_eq!(seoul, utc);
        assert_eq!(epoch_millis_to_rfc3339(seoul), "2026-09-02T01:32:18.123Z");
    }

    #[test]
    fn fixture_shaped_values_are_readable() {
        // fixtures 의 at 은 소수점 없이 +09:00 오프셋을 쓴다.
        let first = rfc3339_to_epoch_millis("2026-09-02T10:31:35+09:00").expect("읽혀야 한다");
        let last = rfc3339_to_epoch_millis("2026-09-02T10:33:14+09:00").expect("읽혀야 한다");

        assert!(last > first);
        assert_eq!(last - first, 99_000, "99초 차이여야 한다");
    }

    #[test]
    fn every_offset_shape_is_still_read() {
        // 콜론이 있는 표기·없는 표기(4자)·시간만 있는 표기(2자)가 모두 같은 순간을 가리킨다.
        let utc = rfc3339_to_epoch_millis("2026-09-02T01:32:18Z").expect("읽혀야 한다");

        assert_eq!(
            rfc3339_to_epoch_millis("2026-09-02T10:32:18+09:00"),
            Some(utc)
        );
        assert_eq!(
            rfc3339_to_epoch_millis("2026-09-02T10:32:18+0900"),
            Some(utc)
        );
        assert_eq!(rfc3339_to_epoch_millis("2026-09-02T10:32:18+09"), Some(utc));
        assert_eq!(
            rfc3339_to_epoch_millis("2026-09-01T16:32:18-0900"),
            Some(utc)
        );
        // 소수점 이하는 앞 세 자리까지만 본다. 모자라면 뒤를 0 으로 채운다.
        assert_eq!(
            rfc3339_to_epoch_millis("2026-09-02T01:32:18.1Z"),
            Some(utc + 100)
        );
        assert_eq!(
            rfc3339_to_epoch_millis("2026-09-02T01:32:18.123456Z"),
            Some(utc + 123)
        );
    }

    #[test]
    fn leap_day_is_handled() {
        let leap = rfc3339_to_epoch_millis("2024-02-29T12:00:00Z").expect("읽혀야 한다");
        assert_eq!(epoch_millis_to_rfc3339(leap), "2024-02-29T12:00:00.000Z");
    }

    #[test]
    fn now_is_written_in_the_expected_shape() {
        let text = now_rfc3339_millis();

        assert_eq!(text.len(), 24, "{text}");
        assert!(text.ends_with('Z'), "{text}");
        let parsed = rfc3339_to_epoch_millis(&text).expect("스스로 적은 값은 읽혀야 한다");
        assert!((parsed - now_epoch_millis()).abs() < 5_000, "{text}");
    }

    #[test]
    fn broken_shapes_are_rejected() {
        assert_eq!(rfc3339_to_epoch_millis(""), None);
        assert_eq!(rfc3339_to_epoch_millis("2026-09-02"), None);
        assert_eq!(rfc3339_to_epoch_millis("2026-13-02T00:00:00Z"), None);
        assert_eq!(rfc3339_to_epoch_millis("2026-09-02T00:00:00+9"), None);
        assert_eq!(rfc3339_to_epoch_millis("2026-09-02T00:00:00."), None);
        assert_eq!(rfc3339_to_epoch_millis("2026-09-02T00:00:00+09:0"), None);
        assert_eq!(rfc3339_to_epoch_millis("2026-09-02T24:00:00Z"), None);
    }

    /// 확장이 보낸 값 하나로 호스트가 죽지 않는지 본다.
    ///
    /// 예전에는 `&text[17..19]` 와 `&body[0..2]` 가 글자 한가운데를 잘라 **패닉**했다.
    /// 여기 있는 값이 하나라도 패닉하면 이 시험이 그 자리에서 죽으므로, 통과 자체가
    /// "어떤 입력에도 살아남는다" 는 증거다.
    #[test]
    fn multibyte_values_are_rejected_without_panicking() {
        for broken in [
            "",
            "짧다",
            "2026-09-0",
            "2026-09-02T10:32:1한",       // 바이트 18 이 '한' 의 한가운데
            "2026-09-02T10:32:1🙂",       // 네 바이트 글자
            "2026-09-02T10:32:가나",      // 초 자리 전체가 한글
            "2026-09-02T10:32:18가",      // 오프셋 자리가 한글
            "2026-09-02T00:00:00+가1",    // 4자 오프셋의 한가운데
            "2026-09-02T00:00:00+1가",    // 4자 오프셋의 뒤쪽
            "2026-09-02T00:00:00-가1",    // 부호가 달라도 같다
            "2026-09-02T00:00:00+가나",   // 6바이트라 길이에서 먼저 걸린다
            "2026-09-02T00:00:00+09:0가", // 콜론 있는 표기의 꼬리
            "2026-09-02T00:00:00+가:00",  // 콜론 있는 표기의 머리
            "2026-09-02T00:00:00.1+가1",  // 소수점을 지난 뒤의 오프셋
            "2026-09-02T00:00:00.한Z",    // 소수점 뒤가 숫자가 아니다
            "한글한글한글한글한글",       // 길이만 넉넉한 완전한 다른 값
            "🙂🙂🙂🙂🙂🙂",               // 이모지만
        ] {
            assert_eq!(rfc3339_to_epoch_millis(broken), None, "{broken:?}");
        }
    }
}
