//! `classmate-core doctor` (커밋 단위 6 · 인수인계 §4.1).
//!
//! 연결 · 키 있음/없음 · 노트 제목 · 마지막 문단 시각 · 캡처 창 · 데이터 폴더 상태 · 표 건수를 **비밀값 없이**
//! 출력한다. 값은 `status` 표([`crate::store::status_keys`])와 [`crate::store::Store::counts`] 에서 읽는다.

use crate::error::{CoreError, Result};

pub fn run(_args: &[String]) -> Result<()> {
    Err(CoreError::NotImplemented("doctor(커밋 단위 6)"))
}
