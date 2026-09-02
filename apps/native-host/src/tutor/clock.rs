//! 튜터 파이프라인이 적는 시각입니다. **언제나 한국 시간(`+09:00`)** 으로 적습니다.
//!
//! 왜 `src/store/clock.rs` 를 그대로 쓰지 않는가
//! ---------------------------------------------
//! 저장소의 시계는 `2026-09-02T01:32:18.123Z` 처럼 **UTC + `Z`** 만 냅니다. 그런데 사이드패널이
//! 보여 주는 질문·답의 시각은 수업이 열린 자리의 시각(한국)이어야 하고, 골든 시나리오
//! (`fixtures/synthetic-class/golden-ioc/*.json`)의 `askedAt`·`createdAt` 도 전부 `+09:00` 입니다.
//! 그래서 이 모듈이 같은 계약(`common.schema.json` 의 `IsoDateTime`)을 만족하는 다른 표기를
//! 하나 더 냅니다. 저장소 시계는 건드리지 않습니다.
//!
//! 왜 날짜 crate 를 들이지 않는가
//! ------------------------------
//! 이 단위는 새 crate 를 더하지 않습니다(빌드 조건: C 컴파일러 없는 gnu 툴체인).
//! 필요한 것은 "epoch 밀리초 → 달력" 하나뿐이라 Howard Hinnant 의 `civil_from_days` 공식을
//! 그대로 옮겨 씁니다. 저장소 시계와 같은 공식입니다.
//!
//! 시험이 시각을 고정할 수 있게 [`TutorClock`] 으로 한 겹 감쌌습니다.
//! 실제 실행은 [`SystemClock`], 시험은 [`FixedClock`] 을 씁니다.

use std::sync::atomic::{AtomicI64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// 하루의 밀리초입니다.
const MILLIS_PER_DAY: i64 = 86_400_000;

/// 한국 표준시의 UTC 차이입니다. 서머타임이 없어 언제나 +9시간입니다.
const KST_OFFSET_MILLIS: i64 = 9 * 60 * 60 * 1_000;

/// 파이프라인이 "지금"을 묻는 자리입니다.
///
/// 스레드 하나가 들고 다니고 손잡이(`TutorHandle`)도 같은 것을 보므로 `Send + Sync` 입니다.
pub trait TutorClock: Send + Sync {
    /// 지금의 epoch 밀리초입니다.
    fn now_epoch_millis(&self) -> i64;

    /// 지금을 `YYYY-MM-DDTHH:MM:SS+09:00` 으로 적습니다.
    fn now_kst(&self) -> String {
        kst_from_epoch_millis(self.now_epoch_millis())
    }
}

/// 이 PC 의 시계입니다. 실제 실행에서 쓰는 것입니다.
#[derive(Debug, Default, Clone, Copy)]
pub struct SystemClock;

impl TutorClock for SystemClock {
    fn now_epoch_millis(&self) -> i64 {
        match SystemTime::now().duration_since(UNIX_EPOCH) {
            Ok(elapsed) => elapsed.as_millis() as i64,
            // 시스템 시계가 1970 년 이전이면 음수가 됩니다. 그래도 패닉하지 않습니다.
            Err(error) => -(error.duration().as_millis() as i64),
        }
    }
}

/// 시험용 시계입니다. 부를 때마다 정해진 만큼씩 앞으로 갑니다.
///
/// 한 번 부를 때마다 `step_millis` 만큼 나아가므로, 같은 시험 안에서 만들어진 사건들의
/// 시각이 서로 다르면서도 실행할 때마다 똑같습니다.
#[derive(Debug)]
pub struct FixedClock {
    start_millis: i64,
    step_millis: i64,
    calls: AtomicI64,
}

impl FixedClock {
    /// 시작 시각(epoch 밀리초)과 한 번 부를 때 나아갈 폭을 정해 만듭니다.
    pub fn new(start_millis: i64, step_millis: i64) -> Self {
        Self {
            start_millis,
            step_millis,
            calls: AtomicI64::new(0),
        }
    }

    /// 지금까지 몇 번 불렸는지입니다.
    pub fn calls(&self) -> i64 {
        self.calls.load(Ordering::SeqCst)
    }
}

impl TutorClock for FixedClock {
    fn now_epoch_millis(&self) -> i64 {
        let nth = self.calls.fetch_add(1, Ordering::SeqCst);
        self.start_millis + self.step_millis * nth
    }
}

/// epoch 밀리초를 `YYYY-MM-DDTHH:MM:SS+09:00` 으로 적습니다.
///
///     use classmate_host::tutor::clock::kst_from_epoch_millis;
///     // 2026-09-02T10:32:18+09:00 == 2026-09-02T01:32:18Z
///     assert_eq!(
///         kst_from_epoch_millis(1_788_312_738_000),
///         "2026-09-02T10:32:18+09:00"
///     );
pub fn kst_from_epoch_millis(epoch_millis: i64) -> String {
    let shifted = epoch_millis.saturating_add(KST_OFFSET_MILLIS);
    let days = shifted.div_euclid(MILLIS_PER_DAY);
    let millis_of_day = shifted.rem_euclid(MILLIS_PER_DAY);

    let (year, month, day) = civil_from_days(days);
    let hour = millis_of_day / 3_600_000;
    let minute = (millis_of_day % 3_600_000) / 60_000;
    let second = (millis_of_day % 60_000) / 1_000;

    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}+09:00")
}

/// 1970-01-01 로부터 며칠째인지를 (해, 달, 날)로 바꿉니다.
///
/// Howard Hinnant 의 `civil_from_days` 입니다. 3월을 한 해의 시작으로 보아 윤년 보정을
/// 뒤로 미루는 것이 요령입니다.
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let shifted = days + 719_468;
    let era = if shifted >= 0 {
        shifted
    } else {
        shifted - 146_096
    } / 146_097;
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = if month_prime < 10 {
        month_prime + 3
    } else {
        month_prime - 9
    };

    (if month <= 2 { year + 1 } else { year }, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kst_is_nine_hours_ahead_of_utc() {
        // 2026-09-02T01:32:18Z 는 한국에서 같은 날 10:32:18 입니다.
        assert_eq!(
            kst_from_epoch_millis(1_788_312_738_000),
            "2026-09-02T10:32:18+09:00"
        );
    }

    #[test]
    fn kst_rolls_over_to_the_next_day() {
        // 2026-09-02T16:00:00Z 는 한국에서 다음 날 01:00:00 입니다.
        assert_eq!(
            kst_from_epoch_millis(1_788_364_800_000),
            "2026-09-03T01:00:00+09:00"
        );
    }

    #[test]
    fn epoch_zero_is_the_ninth_hour_of_1970() {
        assert_eq!(kst_from_epoch_millis(0), "1970-01-01T09:00:00+09:00");
    }

    #[test]
    fn leap_day_survives_the_conversion() {
        // 2024-02-29T00:00:00Z → 같은 날 09:00 (윤년)
        assert_eq!(
            kst_from_epoch_millis(1_709_164_800_000),
            "2024-02-29T09:00:00+09:00"
        );
    }

    #[test]
    fn the_shape_matches_the_contract() {
        let text = kst_from_epoch_millis(1_788_312_738_000);
        assert!(classmate_transport::schema::is_rfc3339_date_time(&text));
        // 저장소도 같은 문자열을 읽을 수 있어야 `at` 으로 쓸 수 있습니다.
        assert!(crate::store::clock::rfc3339_to_epoch_millis(&text).is_some());
    }

    #[test]
    fn the_fixed_clock_steps_forward_every_call() {
        let clock = FixedClock::new(1_788_312_738_000, 1_000);
        assert_eq!(clock.now_kst(), "2026-09-02T10:32:18+09:00");
        assert_eq!(clock.now_kst(), "2026-09-02T10:32:19+09:00");
        assert_eq!(clock.calls(), 2);
    }

    #[test]
    fn the_system_clock_is_after_2020() {
        // 2020-01-01T00:00:00Z 의 epoch 밀리초입니다. 시계가 엉뚱하면 알아채려는 최소한의 확인입니다.
        assert!(SystemClock.now_epoch_millis() > 1_577_836_800_000);
    }
}
