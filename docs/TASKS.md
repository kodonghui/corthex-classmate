# 할 일

`- [ ]` 미완 · `- [x]` 완료 · `- [~]` 진행 중 · `- [!] 대기` 사람 결정 필요.
상세 기준은 `docs/master-prompt.md` §7. 완료 판정 근거는 `docs/WORKLOG.md` 의 검증 출력.

## Phase 0 — 저장소·도구·규약

- [x] §0 환경 점검 표 (claude 2.1.252 · git 2.54 · node 24.15 · gh 로그인 · winget 1.29 · codex-cli 0.152)
- [x] kickoff.md · research 2종 · HANDOFF-README.md 읽기
- [x] pnpm 11.25.0 설치 (corepack EPERM → `npm i -g pnpm`)
- [x] rustup 설치 → MSVC 링커 없음 → `stable-x86_64-pc-windows-gnu` 를 루트 rust-toolchain.toml 로 고정 (smoke 빌드 OK)
- [x] `git init -b main` · `.gitignore` · `.gitattributes` · `.editorconfig`
- [x] README.md · AGENTS.md · CLAUDE.md(@AGENTS.md) · SECURITY.md · CONTRIBUTING.md
- [x] docs/DECISIONS.md · docs/TASKS.md · docs/WORKLOG.md
- [x] `.claude/settings.json` (permissions allow/ask/deny · env TODO 도구)
- [x] `.claude/agents/` scout · implementer · reviewer · researcher
- [x] `.mcp.json` 에 tiro (HTTP · OAuth)
- [!] 대기 — Tiro MCP: 대화형 `claude` 에서 프로젝트 MCP 승인 → `/mcp` → tiro → Authenticate (사람)
- [x] pnpm 워크스페이스 루트 (`package.json` · `pnpm-workspace.yaml` · `tsconfig.base.json`)
- [x] `apps/browser-extension` WXT 0.21.4 React 19 TS 스캐폴드 (듣는 중 빈 화면 + 서비스워커 + Vitest 9건 + 빌드 manifest side_panel 확인)
- [x] `apps/native-host` Rust hello Native Messaging Host (protocol.rs · cargo test 14건) + `scripts/register-host.mjs` (dry-run 기본 · HKCU 만)
- [x] `packages/contracts` JSON Schema 8종(common 포함) + generate.mjs + Ajv 테스트 49건
- [x] `fixtures/synthetic-class/golden-ioc` 골든 시나리오 (전사 9 · 프레임 2 · 편집기 1 · 질문/답 · 이벤트 27줄)
- [x] `pnpm install` (186 패키지 · lockfile) · `pnpm -r test` exit 0
- [x] `cargo build` · `cargo test` exit 0 (GNU 툴체인)
- [x] 첫 커밋 + WORKLOG 첫 항목
- [!] 대기 — `gh repo create corthex-classmate --private` (사용자 허락 후)

- [x] 검토자 지적 수정: fixtures 두 번째 질문 갈래 파일 · 참조 무결성 테스트 · SessionEvent.payload additionalProperties · id 접두사 통일 · settings.json 권한 좁힘
- [ ] 다음 대화형 세션에서 `.claude/settings.json` ask 규칙이 실제로 뜨는지 1회 확인 (`git push` 시도)

## Phase 1 — 기술 게이트 스파이크 (`docs/spikes/`)

- [~] Gate A `gate-a-tiro.md` — 실측 기록 옮김(2순위 PASS 부분) · 공유 페이지 커넥터 구현 + fixtures 단위 테스트 · (a)(c) 는 사람 실측 대기
- [ ] Gate B `gate-b-meet.md` — tabCapture + Offscreen + dHash 변화 감지
- [~] Gate C `gate-c-intellij.md` — 정찰 완료(IDEA 2025.3.6.1 · 63342 만 열림 · MCP 서버 꺼짐 → BLOCKED) · 사람이 켜면 도구 목록화
- [~] Gate C2 `gate-c2-provider.md` — CLI 확인(claude --print stream-json · codex app-server) · 측정 스크립트 작성 예정 · Codex 는 한도 복구 후
- [ ] Gate D `gate-d-recovery.md` — 장애 복구 자동 테스트
- [ ] DECISIONS.md 에 Tiro 기본 커넥터 · Host · Provider 기본값 기록

## Phase 2 — MVP 수직 슬라이스

- [ ] 부채: native-host `serve` 가 JSON 파싱 실패 한 건에 프로세스를 끝냄 → InvalidData 는 error 응답 후 계속, EOF·상한 초과만 종료
- [ ] 부채: SessionEvent.payload 를 type 별 oneOf 판별 유니온으로
- [ ] 부채: rusqlite `bundled` 는 C 컴파일러가 필요(GNU 툴체인에 없음) → 시스템 SQLite 링크 또는 pure-Rust 대안 검토
- [ ] 메모: TypeScript 7.0.2 는 `node_modules/@types/*` 전역 타입을 자동 포함하지 않음 → 패키지마다 `/// <reference types="…" />` 한 줄 .d.ts

- [ ] packages/tutor-core 상태기계 + ContextSnapshot
- [ ] apps/native-host session-store · context-builder · provider 연결
- [ ] packages/design-tokens 포팅 → 사이드패널 4화면 · 상태 A~H
- [ ] Playwright E2E + docs/screenshots/ 9장
- [ ] reviewer 검토 · docs/architecture.md · docs/privacy.md

## Phase 3 — 교시 종료 후

- [ ] EXIT_RECALL → FEEDBACK → FADE_SUPPORT → DELAYED_CHECK
- [ ] Tiro 최종본 교정 + 보정 사전
- [ ] packages/report-ui 교시 상세 8 + 하루 허브 1

## 사람이 할 일 (대기)

- [!] Tiro MCP OAuth 인증 (`/mcp` → tiro → Authenticate)
- [!] Tiro Max 결제 (월 무제한)
- [!] 다음 녹음 때 Real-time 공유 링크로 Gate A (a)(b)(c) 실측
- [!] 선생님께 Drive "뷰어 다운로드 허용" 요청
- [!] `gh repo create` 허락
- [!] `design/_to_delete/` 삭제 여부
