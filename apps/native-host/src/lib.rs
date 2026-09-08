//! Corthex Classmate 로컬 도우미의 속살.
//!
//! 실행 파일(`src/main.rs`)과 통합 테스트(`tests/`)가 같은 코드를 보게 하려고
//! 메시지 분배와 세션 저장소를 라이브러리로 내놓는다. 실행 파일 쪽에는 stdin/stdout 을
//! 빌려 [`router::serve`] 를 부르는 일만 남는다.
//!
//! - [`router`] — 프레임 읽기 루프 · 봉투 검사 · 갈래 나누기 · 공유 출력 채널.
//! - [`store`] — 교시 하나를 담는 SQLite(WAL) 세션 저장소.
//! - [`tutor`] — 질문 봉인 → 제공자 호출 → 답 기록 파이프라인(2라운드 단위 6).
//!
//! 프레이밍(4바이트 길이 + JSON)은 이 크레이트에 없다. `crates/transport` 의
//! `classmate_transport::framing` 하나가 정본이다 (2라운드에서 복사본이던
//! `src/protocol.rs` 를 지웠다).

pub mod router;
pub mod connection;
pub mod provider_setup;
pub mod store;
pub mod study;
pub mod tutor;
