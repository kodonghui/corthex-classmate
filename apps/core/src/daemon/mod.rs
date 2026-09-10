//! 트레이 상주 데몬 (커밋 단위 4 · 인수인계 §4.1 · §4.4 · §4.7).
//!
//! 여기 채워질 것:
//! - 단일 실행 뮤텍스 `Local\CorthexClassmateCore`.
//! - Win32 메시지 루프 하나: `RegisterHotKey`(Alt+S) · `Shell_NotifyIconW` 트레이(상태 · 지금 붙잡기 ·
//!   연속 캡처 켬/끔 · 설정 열기 · 데이터 폴더 열기 · 종료) · 풍선 "붙잡았어요".
//! - 스레드: Tiro 폴러([`crate::tiro`]) · 변화 감지 타임라인([`crate::capture`]) · 1시간마다 보존 정리.
//! - heartbeat([`crate::store::Store::heartbeat`])로 브리지 · `doctor` 가 살아 있는지 안다.

use crate::error::{CoreError, Result};

/// `classmate-core` (인자 없음) 진입점.
pub fn run(_args: &[String]) -> Result<()> {
    Err(CoreError::NotImplemented("데몬(커밋 단위 4)"))
}
