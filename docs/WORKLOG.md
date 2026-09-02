# 작업 기록

형식: `## YYYY-MM-DD HH:MM — <한 줄>` 아래에 **변경 / 검증 / 위험 / 다음 행동** 네 줄.
변경이 없는 시간에는 `heartbeat` 한 줄만 남깁니다. 시각은 로컬(KST) 기준.
시간당 체크포인트 루프(/loop 1h)가 이 파일에 항목을 추가하고 로컬 커밋만 합니다. push 는 하지 않습니다.

## 2026-09-02 16:46 — Phase 0 완료: 저장소·규약·도구 고정, 스캐폴드 4개, 첫 커밋
- 변경: `git init -b main` · 규약 문서(AGENTS·CLAUDE·SECURITY·CONTRIBUTING·README) · docs(DECISIONS 10건·TASKS·WORKLOG·spikes 5종 초안: A 부분 PASS·C BLOCKED·B/C2/D 측정 예정) · `.claude/settings.json` + 서브에이전트 4개 · `.mcp.json` tiro(HTTP·OAuth) · pnpm 워크스페이스(루트 · `@classmate/browser-extension` WXT 0.21.4 듣는 중 화면 · `@classmate/contracts` 스키마 8종+생성기 · fixtures golden-ioc 두 갈래) · `apps/native-host` Rust hello 호스트 + `register-host.mjs`(dry-run 기본) · `rust-toolchain.toml`(gnu) · 검토자 지적 수정(fixtures 2번째 질문 파일 · 참조 무결성 테스트 4건 · payload additionalProperties · id 접두사 통일 · seq≥1 · anchor.segmentId 필수 · settings 권한 좁힘)
- 검증: `pnpm typecheck` exit 0 · `pnpm test` exit 0 (browser-extension 9 · contracts 55) · `cargo test` 14 passed · 호스트 exe ping → `{"type":"hello","protocol":1,"version":"0.1.0"}` exit 0 · 빌드 manifest 에 side_panel·sidePanel·storage 확인 · 비밀값 grep 0건 · git check-ignore 9항목 정상
- 위험: MSVC 링커 없음(gnu 고정 · rusqlite bundled 는 C 컴파일러 필요 → Phase 2 검토) · TypeScript 7.0.2 가 @types 전역을 자동 포함 안 함(패키지별 reference .d.ts) · settings.json ask 규칙 실제 매칭 미확인 · claude 2.1.252 < 권장 2.1.255 · Tiro MCP 승인·OAuth 미완(사람) · IntelliJ MCP 서버 꺼짐(사람) · Codex 한도 소진
- 다음 행동: Phase 1 Gate A — `apps/browser-extension` 에 공유 페이지 커넥터(MutationObserver · 확정/진행 구분 · arrivedAt 기록)를 fixtures 단위 테스트까지 구현하고 60분 관찰 하네스(`spikes/tiro-share-observe.mjs`)를 작성
