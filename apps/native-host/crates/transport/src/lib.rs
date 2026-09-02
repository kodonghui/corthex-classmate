//! Native Messaging 전송 크레이트 — Phase 2 1라운드 단위 (9) 가 채운다. 지금은 스켈레톤이다.
//!
//! 맡는 것: Chrome Native Messaging 프레이밍(리틀엔디언 4바이트 길이 + UTF-8 JSON) · contracts
//! JSON Schema 에 맞는지 검증 · Windows 레지스트리 매니페스트 생성/제거 · 왕복(round-trip) 시험.
//!
//! 이미 있는 것(완성·정리 대상): 루트 크레이트 `src/protocol.rs` 의 `read_frame`/`write_frame`
//! (살릴 수 있는 프레임 오류 vs 치명 오류 구분, docs/DECISIONS.md Gate D), `scripts/register-host.mjs`
//! (dry-run 기본 레지스트리 등록 스크립트), `manifest/` 템플릿. 이 크레이트로 옮기고 루트는 이 크레이트를 쓴다.
//!
//! 규칙: 확장이 준 문자열이 경로가 되는 자리는 좁혀 받고, 오류·로그에 파일 경로를 담지 않는다(Gate D 결정).
//! 계약 스키마는 packages/contracts/schemas/*.schema.json 이 정본이고 고정 상태다(frozen.sha256).

/// 이 크레이트가 맡는 단위 이름. 스켈레톤이 워크스페이스에 붙었는지 확인하는 용도다.
pub const UNIT: &str = "transport";

#[cfg(test)]
mod tests {
    #[test]
    fn skeleton_is_wired_into_workspace() {
        assert_eq!(super::UNIT, "transport");
    }
}
