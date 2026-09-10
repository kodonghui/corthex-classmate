//! `classmate-core setup` (커밋 단위 6 · 인수인계 §4.6).
//!
//! 여기 채워질 것:
//! - 콘솔 숨김 입력(`SetConsoleMode` 에서 `ENABLE_ECHO_INPUT` 을 끈다)으로 Tiro 키를 받는다.
//!   `keyId.secret` 모양(점 하나 · 양쪽 비어 있지 않음)을 검사한 뒤 자격 증명 관리자에 저장하고
//!   `/workspaces/me` 로 검증한다. 401 → "키 형식(keyId.secret) 확인", 404 → "키 범위 밖 노트".
//! - 캡처 창 선택(제목 목록에서 고르기) → `config.json`.
//! - `--claude-desktop`: `%APPDATA%\Claude\claude_desktop_config.json` 의 `mcpServers.classmate` 병합(백업 남김).
//!
//! **키를 채팅에 붙이라고 요청하지 않는다.** 사용자는 별도 PowerShell 창에서 이 명령을 직접 실행한다.

use crate::error::{CoreError, Result};

pub fn run(_args: &[String]) -> Result<()> {
    Err(CoreError::NotImplemented("setup(커밋 단위 6)"))
}
