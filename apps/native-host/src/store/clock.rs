//! 시각 한 종류만 다루는 아주 작은 도구 상자.
//!
//! 세션 기록의 `at` 은 계약(`packages/contracts/schemas/common.schema.json` 의 `IsoDateTime`)에
//! 따라 ISO 8601 문자열이다. 여기서는 그중 두 가지만 한다.
//!
//! 1. 지금 시각을 `2026-09-02T01:32:18.123Z`(UTC · 밀리초 3자리) 로 적는다.
//! 2. 적혀 있는 ISO 8601 문자열을 다시 epoch 밀리초로 읽는다. 오프셋(`+09:00`)도 받는다.
//!
//! 날짜 계산 crate 를 새로 들이지 않은 이유는 필요한 것이 이 둘뿐이고, 의존성이 늘면
//! 이 crate 의 빌드 조건(C 컴파일러 없는 gnu 툴체인)이 다시 까다로워지기 때문이다.
//! 그레고리력 변환은 Howard Hinnant 의 `days_from_civil` / `civil_from_days` 공식을 쓴다.

use std::time::{SystemTime, UNIX_EPOCH};

const MILLIS_PER_DAY: i64 = 86_400_000;

/// 지금 시각을 `YYYY-MM-DDTHH:MM:SS.sssZ` (UTC) 로 적는다.
pub fn now_rfc3339_millis() -> String {
    epoch_millis_to_rfc3339(now_epoch_millis())
}

/// 지금 시각의 epoch 밀리초. 시스템 시계가 1970 년 이전이면 음수가 된다.
pub fn now_epoch_millis() -> i64 {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(elapsed) => elapsed.as_millis() as i64,
        Err(error) => -(error.duration().as_millis() as i64),
    }
}

/// epoch 밀리초를 `YYYY-MM-DDTHH:MM:SS.sssZ` 로 적는다.
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

/// ISO 8601 문자열을 epoch 밀리초로 읽는다. 모양이 아니면 `None`.
///
/// 받는 모양: `YYYY-MM-DDTHH:MM:SS` 뒤에 소수점 이하(선택)와 `Z` 또는 `+HH:MM` / `-HH:MM`(선택).
/// 소수점 이하는 앞 세 자리만 본다(밀리초까지). 오프셋이 없으면 UTC 로 본다.
pub fn rfc3339_to_epoch_millis(text: &str) -> Option<i64> {
    let bytes = text.as_bytes();
    if bytes.len() < 19 {
        return None;
    }
    // 날짜와 시각 사이 구분자는 'T' 또는 ' ' 를 받는다.
    if !matches!(bytes[10], b'T' | b't' | b' ') {
        return None;
    }
    if bytes[4] != b'-' || bytes[7] != b'-' || bytes[13] != b':' || bytes[16] != b':' {
        return None;
    }

    let year = parse_number(&text[0..4])?;
    let month = parse_number(&text[5..7])?;
    let day = parse_number(&text[8..10])?;
    let hour = parse_number(&text[11..13])?;
    let minute = parse_number(&text[14..16])?;
    let second = parse_number(&text[17..19])?;

    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    if hour > 23 || minute > 59 || second > 60 {
        return None;
    }

    let mut rest = &text[19..];

    let mut millis = 0i64;
    if let Some(fraction) = rest.strip_prefix('.') {
        let digits: String = fraction.chars().take_while(char::is_ascii_digit).collect();
        if digits.is_empty() {
            return None;
        }
        let mut three = digits.chars().take(3).collect::<String>();
        while three.len() < 3 {
            three.push('0');
        }
        millis = parse_number(&three)?;
        rest = &rest[1 + digits.len()..];
    }

    let offset_millis = parse_offset(rest)?;

    let days = days_from_civil(year, month as u32, day as u32);
    let time_of_day = hour * 3_600_000 + minute * 60_000 + second * 1_000 + millis;

    Some(days * MILLIS_PER_DAY + time_of_day - offset_millis)
}

/// 꼬리에 붙는 시간대 표기를 밀리초로 바꾼다. 비어 있으면 UTC(0)로 본다.
fn parse_offset(rest: &str) -> Option<i64> {
    if rest.is_empty() || rest.eq_ignore_ascii_case("z") {
        return Some(0);
    }

    let sign = match rest.as_bytes()[0] {
        b'+' => 1,
        b'-' => -1,
        _ => return None,
    };
    let body = &rest[1..];
    let (hours, minutes) = match body.len() {
        5 if body.as_bytes()[2] == b':' => (parse_number(&body[0..2])?, parse_number(&body[3..5])?),
        4 => (parse_number(&body[0..2])?, parse_number(&body[2..4])?),
        2 => (parse_number(body)?, 0),
        _ => return None,
    };
    if hours > 23 || minutes > 59 {
        return None;
    }

    Some(sign * (hours * 3_600_000 + minutes * 60_000))
}

/// 숫자만 있는 짧은 조각을 정수로 읽는다.
fn parse_number(text: &str) -> Option<i64> {
    if text.is_empty() || !text.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    text.parse::<i64>().ok()
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
    }
}
