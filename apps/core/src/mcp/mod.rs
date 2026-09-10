//! stdio MCP 서버 (커밋 단위 5 · 인수인계 §4.5).
//!
//! 공식 rust-sdk(`rmcp`)는 tokio → mio → windows-sys 0.61(raw-dylib) 때문에 이 툴체인에서 링크되지
//! 않는다(DECISIONS 2026-09-10 (4)). 그래서 JSON-RPC 2.0 · 줄 단위 stdio 전송 · `initialize` ·
//! `tools/list` · `tools/call` · `ping` 만 여기서 직접 만든다(2단계 MCP App 리소스는 그때 더한다).
//!
//! 툴 와이어 이름(밑줄)과 입력 · 출력 모양은 `packages/contracts/schemas/core-tools.schema.json` 이 정본이다.
//! 이미지는 `{"type":"image","data":"<base64>","mimeType":"image/webp"}` content 로 낸다.
//!
//! 브리지는 SQLite 를 직접 읽고 쓴다. 데몬이 없으면(heartbeat 없음) 데몬을 창 없이 띄운다.
//! `moment_capture` 는 브리지가 직접 캡처한다.

use crate::error::{CoreError, Result};

/// `classmate-core mcp` 진입점.
pub fn serve(_args: &[String]) -> Result<()> {
    Err(CoreError::NotImplemented("MCP 서버(커밋 단위 5)"))
}
