# classmate-transport (스켈레톤)

Chrome Native Messaging 전송층입니다. 4바이트 길이 + JSON 프레이밍, `packages/contracts` 스키마 검증, Windows 레지스트리 매니페스트 생성/제거, 왕복 시험을 맡습니다. Phase 2 1라운드 단위 (9) 가 채우되, 프레이밍은 루트 크레이트 `src/protocol.rs` 에 이미 있으므로(살릴 수 있는 오류 vs 치명 오류 구분) 이 크레이트로 옮겨 정리하고, 등록 스크립트 `scripts/register-host.mjs`(dry-run 기본)와 `manifest/` 템플릿을 이어서 씁니다. 완료 조건: `cargo test -p classmate-transport` exit 0 · 이 README 한 단락 갱신 · 비밀정보·Tiro URL 없음.
