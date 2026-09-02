//! 튜터 제공자 어댑터 크레이트 — Phase 2 1라운드 단위 (8).
//!
//! 맡는 것: [`TutorProvider`] trait · Claude CLI 제공자([`ClaudeCliProvider`]) ·
//! FIFO 큐([`ProviderQueue`]) · Codex 스텁([`CodexAppServerProvider`]).
//!
//! ```text
//! 상위 단위 ──▶ ProviderQueue ──▶ TutorProvider ──▶ 자식 프로세스 (stdout: stream-json)
//!               (한 번에 1건)      claude / codex        │
//!                                                        └─▶ StreamJsonParser ─▶ ProviderEvent
//! ```
//!
//! 정본·근거: `docs/spikes/gate-c2-provider.md`, `spikes/provider-claude.mjs`
//! (Windows `.cmd` 래퍼 해제 · 타임아웃 시 `taskkill /PID <pid> /T /F` 트리 종료),
//! `spikes/lib/stream-json.mjs`(stream-json 줄 해석 규칙).
//!
//! # 지키는 규칙
//!
//! - **자격증명을 저장·전송하지 않는다**(불변 원칙 §4-2). 값 어디에도 토큰 칸이 없고,
//!   로그인은 각 CLI 가 이미 해 둔 것을 그대로 쓴다.
//! - **사람이 만든 문자열을 명령행에 싣지 않는다**(§4-7). 질문·문맥은 자식 프로세스의
//!   **stdin** 으로만 흐르고, 명령행에는 고정 리터럴 인자만 실린다. 셸 해석 지점이 없다.
//! - **시험은 실제 CLI 를 부르지 않는다.** 제공자 생성자는 CLI 경로를 필수 인자로 받고
//!   기본값·PATH 탐색이 없으며, 시험은 언제나 `node` + 저장소 안 가짜 CLI 를 넘긴다.
//!   `tests/no_real_cli.rs` 가 그 사실을 시험으로 못 박는다.

pub mod claude;
pub mod codex;
pub mod provider;
pub mod queue;
pub mod stream_json;

pub use claude::{plan_launch, resolve_cmd_wrapper, ClaudeCliProvider, LaunchPlan, Resolved};
pub use codex::CodexAppServerProvider;
pub use provider::{
    AskOutcome, AskRequest, ContextSnapshot, ProviderError, ProviderEvent, SourceAges,
    TutorProvider,
};
pub use queue::{OutcomeReceiver, ProviderQueue, DEFAULT_CAPACITY};
pub use stream_json::{ResultMetrics, StreamItem, StreamJsonParser};

/// 이 크레이트가 맡는 단위 이름. 워크스페이스에 붙었는지 확인하는 용도다.
pub const UNIT: &str = "providers";

#[cfg(test)]
mod tests {
    #[test]
    fn skeleton_is_wired_into_workspace() {
        assert_eq!(super::UNIT, "providers");
    }
}
