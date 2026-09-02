//! Corthex Classmate 로컬 도우미의 속살.
//!
//! 실행 파일(`src/main.rs`)과 통합 테스트(`tests/`)가 같은 코드를 보게 하려고
//! 프레이밍과 세션 저장소를 라이브러리로 내놓는다. 실행 파일 쪽에는 stdin 루프와
//! 메시지 분배만 남는다.
//!
//! - [`protocol`] — Chrome Native Messaging 프레이밍(4바이트 길이 + JSON).
//! - [`store`] — 교시 하나를 담는 SQLite(WAL) 세션 저장소.
//! - [`router`] — 메시지 분배(2라운드 단위 5 가 `main.rs` 에서 옮긴다).
//! - [`tutor`] — 질문 봉인 → 제공자 호출 → 답 기록 파이프라인(2라운드 단위 6).

pub mod protocol;
pub mod router;
pub mod store;
pub mod tutor;
