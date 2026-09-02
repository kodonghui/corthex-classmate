//! Codex 제공자 — **아직 스텁이다.**
//!
//! Gate C2(2026-09-02) 시점에 계정 사용 한도가 소진되어 실측을 하지 못했다. 네트워크 호출 없이
//! 확인한 것은 프로토콜의 **모양**뿐이다(메소드 이름 188개 · 요청/응답 타입 307개).
//! 지연·비용·실제 이벤트 순서는 **미측정**이므로 여기서 흉내 내지 않고 [`ProviderError::NotImplemented`]
//! 를 그대로 돌려준다. 겉보기에 되는 척하는 구현이 가장 나쁜 결과이기 때문이다.
//!
//! # 프로토콜 메모 (실측 전 · `codex app-server` stdio · experimental 표시)
//!
//! 전송은 stdio 위의 JSON-RPC 다. `codex app-server` 를 자식 프로세스로 띄우고 stdin 으로 요청을,
//! stdout 으로 응답·알림을 주고받는다. 어댑터가 쓸 최소 흐름은 넷이다.
//!
//! ```text
//! 우리 → codex   thread/start          대화 하나를 연다 (이어 하려면 thread/resume)
//! 우리 → codex   turn/start            이번 차례에 보낼 문맥·질문을 넘긴다
//! codex → 우리   turn/started          차례가 시작됐다는 알림
//! codex → 우리   item/agentMessage/delta   답변 조각 (Claude 의 완성 메시지보다 이른 표시가 가능하다)
//! codex → 우리   item/reasoning/textDelta  생각 조각 (화면에 그대로 쓰지 않는다)
//! codex → 우리   item/started · item/completed  항목 경계
//! codex → 우리   turn/completed        차례가 끝났다는 알림
//! 우리 → codex   turn/interrupt        타임아웃·취소 때 차례를 끊는다
//! ```
//!
//! 승인 경계 메소드 세 가지는 수업 모드에서 **전부 거절**로 고정한다(불변 원칙 §4-6 읽기 전용).
//!
//! ```text
//! item/commandExecution/requestApproval   → 거절
//! item/fileChange/requestApproval         → 거절
//! item/permissions/requestApproval        → 거절
//! ```
//!
//! # 실측 후 채울 칸
//!
//! | 칸 | 지금 | 채우는 방법 |
//! |---|---|---|
//! | TTFT p50 / p95 | 미측정 | 한도 복구 후 Claude 와 같은 질문·같은 회차로 측정 |
//! | 총 소요 p50 / p95 | 미측정 | 같음 |
//! | 회차당 비용 | 미측정 | 같음 |
//! | `turn/start` 파라미터 이름 | 미확인 | `codex app-server generate-ts` 산출물에서 확인 |
//! | 델타 이벤트의 실제 필드 이름 | 미확인 | 같음 |
//! | 종료·타임아웃 시 `turn/interrupt` 응답 모양 | 미확인 | 실측 |
//! | 로그인 만료 때의 오류 모양 | 미확인 | 실측 |
//!
//! 채우는 순서와 사람이 할 일은 `docs/spikes/gate-c2-provider.md` 의 "사람이 할 일" 2·3번에 있다.

use std::path::{Path, PathBuf};

use crate::provider::{AskOutcome, AskRequest, ProviderError, ProviderEvent, TutorProvider};

/// `codex app-server` 를 띄울 때 붙는 하위 명령.
///
/// 실행 파일 이름은 여기에 없다. Claude 쪽과 같은 규칙으로 **호출자가 경로를 준다**.
pub const APP_SERVER_ARGS: [&str; 1] = ["app-server"];

/// Codex app-server 제공자(스텁).
#[derive(Debug, Clone)]
pub struct CodexAppServerProvider {
    cli_path: PathBuf,
}

impl CodexAppServerProvider {
    /// CLI 실행 파일 경로 하나로 스텁을 만든다. 기본값도 PATH 탐색도 없다.
    ///
    /// 경로를 받아 두는 이유는 실측이 끝난 뒤 이 자리에 구현을 채우기 위해서다.
    /// 지금은 **아무것도 실행하지 않는다.**
    pub fn new(cli_path: PathBuf) -> Self {
        Self { cli_path }
    }

    /// 나중에 띄울 CLI 경로.
    pub fn cli_path(&self) -> &Path {
        &self.cli_path
    }
}

impl TutorProvider for CodexAppServerProvider {
    fn name(&self) -> &str {
        "codex"
    }

    fn ask(
        &self,
        _req: &AskRequest,
        _on_event: &mut dyn FnMut(ProviderEvent),
    ) -> Result<AskOutcome, ProviderError> {
        Err(ProviderError::NotImplemented)
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;
    use crate::provider::ContextSnapshot;

    #[test]
    fn the_stub_answers_not_implemented_and_runs_nothing() {
        let provider = CodexAppServerProvider::new(PathBuf::from("C:/nowhere/does-not-exist"));
        assert_eq!(provider.name(), "codex");
        assert_eq!(provider.cli_path(), Path::new("C:/nowhere/does-not-exist"));

        let req = AskRequest::new(
            ContextSnapshot::default(),
            "질문",
            Duration::from_millis(10),
        );
        let mut seen = Vec::new();
        let err = provider
            .ask(&req, &mut |event| seen.push(event))
            .expect_err("스텁은 언제나 실패한다");
        assert!(matches!(err, ProviderError::NotImplemented), "{err:?}");
        // 이벤트가 하나도 없다는 것이 "자식 프로세스를 띄우지 않았다"의 방증이다.
        assert!(seen.is_empty());
    }

    #[test]
    fn app_server_args_do_not_carry_an_executable_name() {
        assert_eq!(APP_SERVER_ARGS, ["app-server"]);
    }
}
