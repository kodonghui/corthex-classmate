//! 다시 물어보기 간격표 — [`RetryPolicy`] 하나뿐인 **순수 값 타입** 모듈입니다.
//!
//! # 무엇이고 무엇이 아닌가
//!
//! 이 모듈은 "몇 초 뒤에 다시 물어볼지" 를 **표로만** 답합니다. 타이머를 돌리지도, 잠들지도,
//! 제공자를 다시 부르지도 않습니다. 실제로 기다렸다가 다시 부르는 일은 이 크레이트 위의
//! 파이프라인(단위 6)이 합니다. 여기서 자는 코드를 두면 큐의 작업 스레드가 통째로 멈춰
//! 뒤에 선 질문들이 함께 밀리기 때문입니다.
//!
//! ```text
//! 파이프라인                         RetryPolicy
//!   │ 1회차 실패                        │
//!   ├── delay_for(0) ─────────────────▶ │ Some(5초)
//!   │ ◀──────────────────────────────── │
//!   │ (파이프라인이 5초 기다림 · queued 표시)
//!   │ 2회차 실패
//!   ├── delay_for(1) ─────────────────▶ │ Some(15초)
//!   │ …
//!   ├── delay_for(3) ─────────────────▶ │ None  → 더 시도하지 않고 실패로 닫습니다
//! ```
//!
//! # 기본값이 5·15·45초인 이유
//!
//! Gate C2 실측(`docs/spikes/gate-c2-provider-latency.md`)에서 CLI 를 띄우는 데만 4~6초,
//! 첫 글자까지 p50 6.6초가 들었습니다. 그래서 첫 간격은 **한 회차가 실패로 판정될 만한 시간**인
//! 5초로 두고, 그다음은 3배씩 벌립니다(5 → 15 → 45). 로그인 만료처럼 사람이 손대야 낫는 실패에
//! 매달려 돈과 시간을 태우지 않도록 세 번에서 멈춥니다.

use std::time::Duration;

/// 기본 간격표입니다. 3번까지 다시 물어보고 그 뒤로는 멈춥니다.
const DEFAULT_DELAYS_SECS: [u64; 3] = [5, 15, 45];

/// 실패한 회차를 몇 초 뒤에 다시 물어볼지 적어 둔 표입니다.
///
/// 값 하나로 다 끝나는 타입입니다. 상태도 시계도 들고 있지 않으므로 복사해 나눠 써도 됩니다.
///
/// ```text
/// let policy = RetryPolicy::default();
/// policy.delay_for(0)   // Some(5초)
/// policy.delay_for(2)   // Some(45초)
/// policy.delay_for(3)   // None — 표 밖입니다. 더 시도하지 않습니다.
/// policy.max_attempts() // 4 — 첫 시도 1 + 다시 물어보기 3
/// ```
///
/// 위 네 줄은 아래 `tests` 모듈이 그대로 시험합니다(`delay_for_counts_from_zero_and_ends_with_none`
/// · `max_attempts_counts_the_first_try_too`). 이 크레이트는 doctest 를 쓰지 않습니다 — 시험용
/// target 폴더를 다른 단위와 함께 쓰는 자리라 doctest 가 링크하는 rlib 가 남의 빌드로 바뀔 수
/// 있고, 그러면 내 코드와 상관없이 빨간불이 켜집니다.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetryPolicy {
    delays: Vec<Duration>,
}

impl Default for RetryPolicy {
    /// 5초 · 15초 · 45초입니다. 고른 이유는 모듈 머리말에 있습니다.
    fn default() -> Self {
        Self {
            delays: DEFAULT_DELAYS_SECS
                .iter()
                .map(|secs| Duration::from_secs(*secs))
                .collect(),
        }
    }
}

impl RetryPolicy {
    /// 간격표를 직접 정합니다. 빈 표는 "다시 물어보지 않음" 이라는 뜻이며 그대로 받습니다.
    pub fn new(delays: Vec<Duration>) -> Self {
        Self { delays }
    }

    /// 아예 다시 물어보지 않는 표를 만듭니다.
    ///
    /// `RetryPolicy::new(Vec::new())` 와 같습니다. 시험이나 "한 번만 해 보고 끝" 설정에서
    /// 뜻이 드러나게 쓰려고 이름을 붙여 두었습니다.
    pub fn never() -> Self {
        Self { delays: Vec::new() }
    }

    /// `attempt` 번째 시도가 실패한 뒤 기다릴 시간입니다. **`attempt` 는 0 부터 셉니다.**
    ///
    /// 표 밖이면 `None` 이고, 그것이 "이제 그만" 이라는 신호입니다.
    /// 이 함수는 기다리지 않습니다. 기다리는 것은 부르는 쪽의 몫입니다.
    pub fn delay_for(&self, attempt: usize) -> Option<Duration> {
        self.delays.get(attempt).copied()
    }

    /// 한 질문에 허용하는 **총 시도 횟수**입니다. 첫 시도 1회 + 표에 적힌 다시 물어보기 횟수입니다.
    ///
    /// 기본값의 표는 3칸이므로 총 4회입니다. "다시 물어보기 횟수" 가 아니라 "총 시도 횟수" 인 이유는,
    /// 부르는 쪽이 `for attempt in 0..policy.max_attempts()` 로 그대로 돌 수 있게 하려는 것입니다.
    pub fn max_attempts(&self) -> usize {
        self.delays.len() + 1
    }

    /// 표에 적힌 간격들입니다. 진단·기록용입니다.
    pub fn delays(&self) -> &[Duration] {
        &self.delays
    }

    /// 표에 적힌 간격을 모두 더한 시간입니다. "최악의 경우 얼마나 오래 매달리는가" 를 봅니다.
    ///
    /// 기본값은 5 + 15 + 45 = 65초입니다. 회차 자체가 걸리는 시간은 여기에 들어가지 않습니다.
    pub fn total_delay(&self) -> Duration {
        self.delays.iter().copied().sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_default_table_is_five_fifteen_forty_five_seconds() {
        let policy = RetryPolicy::default();
        assert_eq!(
            policy.delays(),
            [
                Duration::from_secs(5),
                Duration::from_secs(15),
                Duration::from_secs(45),
            ]
        );
        assert_eq!(policy.total_delay(), Duration::from_secs(65));
    }

    #[test]
    fn delay_for_counts_from_zero_and_ends_with_none() {
        let policy = RetryPolicy::default();
        assert_eq!(policy.delay_for(0), Some(Duration::from_secs(5)));
        assert_eq!(policy.delay_for(1), Some(Duration::from_secs(15)));
        assert_eq!(policy.delay_for(2), Some(Duration::from_secs(45)));
        // 표 밖입니다. 마지막 값을 되풀이하지 않고 멈춥니다.
        assert_eq!(policy.delay_for(3), None);
        assert_eq!(policy.delay_for(usize::MAX), None);
    }

    #[test]
    fn max_attempts_counts_the_first_try_too() {
        assert_eq!(RetryPolicy::default().max_attempts(), 4);
        assert_eq!(RetryPolicy::never().max_attempts(), 1);
        assert_eq!(
            RetryPolicy::new(vec![Duration::from_millis(10)]).max_attempts(),
            2
        );
    }

    #[test]
    fn an_empty_table_never_retries() {
        let policy = RetryPolicy::never();
        assert_eq!(policy.delay_for(0), None);
        assert!(policy.delays().is_empty());
        assert_eq!(policy.total_delay(), Duration::ZERO);
        assert_eq!(policy, RetryPolicy::new(Vec::new()));
    }

    #[test]
    fn a_caller_loop_stops_exactly_at_the_end_of_the_table() {
        // 부르는 쪽이 어떻게 도는지를 시험으로 못 박습니다. 실제로 자지는 않습니다.
        let policy = RetryPolicy::default();
        let mut waited = Vec::new();
        for attempt in 0..policy.max_attempts() {
            // 이 자리에서 회차를 한 번 돌립니다(여기서는 언제나 실패한다고 칩니다).
            match policy.delay_for(attempt) {
                Some(delay) => waited.push(delay),
                None => break,
            }
        }
        assert_eq!(
            waited,
            vec![
                Duration::from_secs(5),
                Duration::from_secs(15),
                Duration::from_secs(45),
            ]
        );
        // 시도는 4번, 기다린 것은 3번입니다.
        assert_eq!(waited.len() + 1, policy.max_attempts());
    }
}
