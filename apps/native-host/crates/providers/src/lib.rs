//! 튜터 제공자 어댑터 크레이트 — Phase 2 1라운드 단위 (8) 이 채운다. 지금은 스켈레톤이다.
//!
//! 맡는 것: `TutorProvider` trait { ask(context, question) -> 스트림 } · provider-claude
//! (`claude -p --output-format stream-json --verbose` 자식 프로세스 · 타임아웃 · 큐잉) ·
//! provider-codex(app-server stdio · 한도 소진 시 스텁 + 프로토콜 메모).
//!
//! 정본·근거: docs/spikes/gate-c2-provider.md, spikes/provider-claude.mjs(Windows `.cmd` 래퍼 해제 ·
//! 타임아웃 시 `taskkill /PID <pid> /T /F` 트리 종료 · `--runs` 는 실제 자식 수 상한),
//! spikes/lib/stream-json.mjs 와 spikes/test/stream-json.test.mjs(stream-json 줄 해석 · 28건).
//!
//! 규칙: 자격증명을 저장·전송하지 않는다(§4-2). 시험은 실제 CLI 를 띄우지 않고 모의 바이너리로만 한다.
//! 비용이 드는 실제 호출은 사람 승인 뒤에만(Gate C2 비용 사고 참조).

/// 이 크레이트가 맡는 단위 이름. 스켈레톤이 워크스페이스에 붙었는지 확인하는 용도다.
pub const UNIT: &str = "providers";

#[cfg(test)]
mod tests {
    #[test]
    fn skeleton_is_wired_into_workspace() {
        assert_eq!(super::UNIT, "providers");
    }
}
