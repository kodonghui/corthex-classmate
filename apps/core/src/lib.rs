//! Corthex Classmate Core 의 속살.
//!
//! 실행 파일(`src/main.rs`)은 인자를 보고 네 갈래 중 하나를 부르는 일만 한다.
//!
//! | 갈래 | 모듈 | 하는 일 |
//! |---|---|---|
//! | `classmate-core` | [`daemon`] | 트레이 상주: Tiro 폴링 · 변화 감지 타임라인 · Alt+S · 보존 정리 |
//! | `classmate-core mcp` | [`mcp`] | 앱이 띄우는 stdio MCP 서버(얇은 브리지). SQLite 를 직접 읽고 쓴다 |
//! | `classmate-core setup` | [`setup`] | Tiro 키 숨김 입력 → 자격 증명 관리자 · 키 검증 · 캡처 창 선택 |
//! | `classmate-core doctor` | [`doctor`] | 연결 · 키 · 노트 · 창 · 데이터 폴더 상태(비밀값 없이) |
//!
//! 데몬과 브리지가 나누는 것은 **SQLite(WAL) 하나**([`store`])다. 앱마다 브리지가 하나씩 뜨므로
//! 프로세스 사이 조율은 WAL + `busy_timeout` 으로 한다(인수인계 §4.1).
//!
//! 경계 (AGENTS.md §2)
//! - 수업 데이터는 이 PC 의 `%LOCALAPPDATA%\CorthexClassmate\core\` 에만 남는다([`paths`]).
//! - Tiro 키는 자격 증명 관리자에만 있고 로그 · 오류 문구 · 설정 파일에 나오지 않는다.
//! - 오류 문구와 로그에 절대 경로(사용자 이름 포함)를 넣지 않는다.
//! - 화면은 바뀐 장면의 정지 이미지만 남긴다. 영상은 저장하지 않는다.

pub mod capture;
pub mod clock;
pub mod config;
pub mod daemon;
pub mod doctor;
pub mod error;
pub mod mcp;
pub mod paths;
pub mod setup;
pub mod store;
pub mod tiro;

pub use error::{CoreError, Result};

/// 실행 파일과 MCP `serverInfo` 가 같이 쓰는 이름과 판입니다.
pub const NAME: &str = "classmate-core";
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
