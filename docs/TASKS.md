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

- [x] Gate A `gate-a-tiro.md` — **PASS(부분)**: 공유 페이지 커넥터(`src/tiro/` 파서·MutationObserver 관찰기·content script·MCP 스텁) + fixtures 4종 단위 테스트 36건 · 관찰 하네스 `spikes/tiro-share-observe.mjs` · 검증자 minor 4건 수정 완료(문단별 2겹 판별 · 마지막 문단은 명시적 확정 표시만 · stateSource 4값 · stop() 가드 · 공백 계산은 첫 사건부터)
- [!] 대기 — Gate A 실측 (a) MCP 녹음 중 문단 반환 (b) 60분 연속 유지 (c) 발화→화면 지연: 사람이 Real-time 공유 링크를 채팅으로 주면 `TIRO_SHARE_URL=… node spikes/tiro-share-observe.mjs --minutes 60`
- [x] Gate B `gate-b-meet.md` — **PASS(부분)**: `src/capture/`(dHash·FrameStore·pipeline·WebP 인코더) + `SamplingLoop`(겹침 방지·재예약) + offscreen 엔트리 + background 캡처 메시지 + manifest 권한(tabCapture·offscreen) · 실측 dHash 2.75ms · WebP 2.7~607 KiB(실제 인코더 클래스) · capture 테스트 42건 · 검증자 minor 5건 수정 완료
- [!] 대기 — Gate B 실측: 실제 Meet 탭 tabCapture 5분 · 실제 화면 바이트 · 60분 메모리 곡선 (사람이 `.output/chrome-mv3` 를 압축해제 확장으로 로드해 측정, 절차는 문서 §사람이 할 일)
- [x] Gate C `gate-c-intellij.md` — **BLOCKED(부분)**: 탐침 `spikes/intellij-mcp-probe.mjs` + 읽기 전용 허용 목록 `spikes/lib/intellij-readonly.mjs` 를 스텁 서버로 검증(21건) · 토큰은 `INTELLIJ_MCP_TOKEN` 만 · 실제 IDE 는 64342 미개방
- [!] 대기 — IntelliJ Settings → Tools → MCP Server → Enable 후 `node spikes/intellij-mcp-probe.mjs` 재실행 (도구 개수·인증 방식 실측)
- [x] Gate C2 `gate-c2-provider.md` — Claude **PASS(25자 단문 기준)**: 2세트 10/10 성공 · TTFT p50 6.6~6.8s · 모델 claude-opus-5[1m] · 누적 실측 비용 2.72 USD(그중 1.25 USD 는 검증 중 import 부작용으로 승인 없이 지출 → 모든 스파이크에 진입점 가드) · Windows `.cmd` 래퍼 해제 + `taskkill /T /F` 트리 종료 수정 완료(1.5s 타임아웃에서 1.7~1.8s 정리, 모의 바이너리 테스트 13건 · spikes 62건)
- [!] 대기 — Gate C2 비용 승인: 골든 컨텍스트(2,893바이트) 기준 5회 재측정 `node spikes/provider-claude.mjs --fixture fixtures/synthetic-class/golden-ioc --runs 5` (단문 5회가 1.25~1.47 USD 였음)
- [!] 대기 — Codex 한도 복구 후 `spikes/provider-codex.mjs` 작성 + 골든 컨텍스트 5회 측정 (지금은 `provider-codex-probe.mjs` 로 app-server 프로토콜 188 메소드만 확인)
- [ ] Gate C2 후속(Phase 2 `apps/native-host/providers` 로 이월): `.cmd` 래퍼 미해제 폴백 감지(`spawnedThroughCmdWrapper`) · `taskkill` 가용성 점검 · 비용 보고에 `timeoutCount` 포함 · 골든 재측정은 18:05 이후 빌드로
- [x] Gate D `gate-d-recovery.md` — **PASS(부분)**: `apps/native-host` 세션 저장소(`src/store/`, rusqlite =0.30.0 `winsqlite3` · SQLite 3.51.1 · WAL) + 호스트 메시지 3종(event.append / session.status / session.export) + 강제 종료 복구 통합 테스트(손실 창 표본 최대 10ms · 중앙값 4ms · 25회) · cargo test 41개 · clippy 0 · 확장 쪽 장애 3개(패널 재열기·공유 페이지 새로고침·캡처 중단)는 Phase 2 통합 테스트로 미측정
- [x] DECISIONS.md 에 기본값 기록: Tiro 커넥터(2순위)·Host(Rust)·저장소(winsqlite3 WAL)·Gate B 임계값·IntelliJ 읽기 전용 규칙·Provider(Claude, 단문 기준 측정 조건 명시)·스파이크 진입점 가드 공통 규칙·비용 사고 기록 완료 (18:15)

## Phase 2 — MVP 수직 슬라이스

- [x] 준비: contracts 고정 — `packages/contracts/frozen.sha256` + `test/frozen.test.ts` + `pnpm run freeze`(승인 뒤에만) · README "고정 상태"
- [x] 준비: TS 스켈레톤 5개 `packages/{design-tokens,ui-base,ui-classmate,tutor-core,report-ui}` — package.json·tsconfig·vitest·src/index.ts·smoke 시험·README(정본 경로·1라운드 공유 규칙·완료 조건) · `pnpm --filter <pkg> test` exit 0
- [x] 준비: `apps/native-host` Cargo 워크스페이스 — 루트 `classmate-host` + `crates/providers`(단위 8) + `crates/transport`(단위 9) · `cargo test --workspace` 43
- [x] 준비: 교시 세션 번들 정의 `fixtures/README.md`(golden-ioc 폴더 그대로 · 번들 스키마 없음)
- [x] 준비: DECISIONS — 계약 고정·1라운드 구조 / 디자인 정본 적용 기본값(함정 판정·폰트·아이콘·개인정보 문구)
- [!] 대기 — origin: `gh repo create`(비공개) 허락 전까지 워커는 브랜치 `batch-1/<단위>` 만 남김 (`gh auth status` 로그인 확인됨 · `git remote -v` 비어 있음)
- [!] 대기(예약) — 사용자가 2026-09-02 17:3x 에 `/batch` 1라운드 프롬프트(10단위)를 미리 보냄. 본문은 docs/master-prompt.md A-6 1라운드와 동일. **실행 시점: Phase 1 커밋 + "Phase 2 준비 완료 — contracts 고정 · fixtures · 스켈레톤 · origin(대기)" 보고 직후**, 그때 계획 모드 → 사용자 승인 → worktree 워커 10개. origin 이 없으면 브랜치 `batch-1/<단위>` 만 남김. Phase 1 게이트가 이미 만든 코드(5 tiro-connectors · 6 meet-capture · 7 session-store · 9 transport)는 갈아엎지 않고 완성·정리 단위로 다룸.
- [~] `/batch` 1라운드 실행 중 (2026-09-02 23:04 기준) — 계획 승인 · worktree `cc-wt/<단위>` 10개 · 브랜치 `batch-1/<단위>` · 병합 순서 1·4·10·2·3 → 5·6 → 7·8·9 · 검토 워크플로(검토 → 반박 검증) 병행
  - [x] (1) design-tokens `f3d950c` — test 17 · 정본 6 css 바이트 동일(예외 `--panel-header-h` 44 한 줄) · 고유 변수 196 스냅샷 · fonts.css npm(`pretendard@1.3.9`·`@fontsource/ibm-plex-mono@5.3.0`) · `src/tokens.ts` 는 생성물(`pnpm --filter @classmate/design-tokens generate`)
  - [x] (4) tutor-core `823daed` — test 54 · 전이표 6상태×20입력(규칙 93) · 봉인 · FoldTimer(주입 시계) · fixtures 재생(state.changed 4건·snapshot 2건 일치)
  - [x] (10) report-ui `0a9b5a3` — test 56(Playwright 포함) · `scripts/generate.mjs`(Node 24 타입 스트리핑, esbuild 불필요) · 허브 8칸 · 토큰 CSS 인라인(44px 치환)
  - [x] (2) ui-base `dab3512` — test 65 · 22 jsx → 25 export · CSS 21 블록 동일성(Icon 은 css() 없음) · Icon 선별 맵 22 · `lucide-react@1.38.0`
  - [x] (3) ui-classmate `d65735f` — test 88 · 10개 + internal/base 8개 · MarginNote children 계약 · AnswerCard compare/rows · Icon 맵 31
  - [x] (5) tiro-connectors `904e2f3` — 확장 test 122(tiro 36→71) · flush() · tiro.hint_degraded · periodNumber 주입 · MCP/API 스텁 · 관찰기가 class 속성 변화를 놓치던 버그 수정
  - [x] (6) meet-capture `a817def` — 확장 test 169(capture 42→89) · threshold/sampleIntervalMs · EncoderSurface 주입 · FrameSink/MemoryFrameSink · frame.store 봉투 + 1 MiB 가드
  - [ ] (7) session-store · (8) providers · (9) transport — 워커 진행 중
- [ ] 1라운드 후속(워커 메모 이월)
  - [ ] 사이드패널(2라운드): CSS 적재 순서 = design-tokens → `@classmate/ui-base/styles.css` → `@classmate/ui-classmate/styles.css` · fonts.css 의 bare specifier `@import` 가 WXT/Vite 빌드에서 해석되는지 확인
  - [ ] 사이드패널(2라운드): Alt+S 는 화면이 `e.code === "KeyS"` 로 듣기(StuckButton 은 kbd 안내만) · 접힘 타이머는 tutor-core FoldTimer · SourceFooter count 는 term 있을 때만 화면이 셈 · 대기 문구 3종은 tutor-core 상수 재사용 · 화면 분기는 TutorState 가 아니라 note 축
  - [ ] ui-classmate internal/base → `@classmate/ui-base` 교체(index.ts 한 줄 + tsx 8개·base.css 삭제 + styles.css 첫 줄 + structure.test.ts 기대값) — 두 포팅의 어긋남은 검토 결과 참고
  - [ ] Evidence 이름 대응표(디자인 verified/delayed ↔ 계약 confirmed/stale)를 2라운드에서 한 곳에 두기
  - [ ] design-tokens 에 실제로 정의돼 있는지 확인: --transcript-1/2/3 · --term-* · --evidence-*-{bg,text,border} · --code-* · --panel-inset · --control-h-hero · 키프레임 cm-sweep/cm-breathe/cm-fade-in/cm-spin (컴포넌트 CSS 가 참조)
  - [ ] report-ui: 토큰을 정본 파일 대신 `@classmate/design-tokens` 에서 읽기 · 오개념/값 흐름/변형과 허브 5절은 회상 기록이 붙으면 채움 · 프레임 출력 경로 규약 `frames/p<교시>/` 는 `src/assets.ts`
  - [ ] tutor-core: 확장 쪽 Clock/Scheduler 구현체 · question.asked 에 봉인을 싣는 문맥 수집기 · `next` 입력의 실제 트리거 정의
  - [ ] tiro: background 가 tiro.hint_degraded/selector_broken 을 connector.status payload 로 싣기 · tiro.stop 보내는 쪽(세션 관리) · classmate.periodNumber 쓰는 쪽(설정) · 새로고침 뒤 seq 이어 붙이기(세션 스토어) · 배너 등급(class-partial/structure) 결정
  - [ ] capture: background.ts 의 frameSink 를 NativeHostFrameSink 로 교체 · frame.stored/error 응답 처리 · 재연결 정책 · 캡처 버튼이 생기면 onClicked 갈래·`classmateCapture` 콘솔 손잡이 제거
- [x] 부채 해소(Gate D): `protocol::read_frame` 이 본문을 끝까지 읽은 UTF-8·JSON 오류는 `{"type":"error","message":"unreadable message"}` 로 답하고 계속 삶 · 헤더/본문 절단·상한 초과만 종료 (테스트 `serve_survives_a_frame_it_cannot_read`)
- [ ] 부채: native-host `store::SESSION_EVENT_TYPES` 는 contracts `session-event.schema.json` enum 의 손 사본(테스트가 시험 시점에 대조) → Rust 타입 생성(typify)이 붙으면 생성물로 교체
- [ ] 부채: rusqlite `=0.30.0` 고정(winsqlite3 기능이 0.31 부터 삭제) → MSVC 전환 시 `bundled` 로 바꾸고 고정 해제
- [ ] 부채: SessionEvent.payload 를 type 별 oneOf 판별 유니온으로
- [x] 부채 해소: rusqlite `bundled` 대신 `winsqlite3`(System32 내장 SQLite) 링크로 확정 (DECISIONS 2026-09-02) · MSVC 환경이 생기면 `bundled` 로 교체 검토
- [ ] 메모: TypeScript 7.0.2 는 `node_modules/@types/*` 전역 타입을 자동 포함하지 않음 → 패키지마다 `/// <reference types="…" />` 한 줄 .d.ts
- [ ] 메모: Rust 빌드는 짧은 경로에서만 (MAX_PATH 260) — 임시 폴더에서 돌리면 `CARGO_TARGET_DIR` 을 60자 이내로
- [ ] 메모: 제품 코드에서 `@classmate/contracts` 는 `import type` 만 (Ajv 의 new Function 이 MV3 CSP 에 막힘) · 검증은 테스트에서만
- [ ] Phase 2 사이드패널에 캡처 시작/중지 버튼 필요(tabCapture 는 사용자 제스처 요구) → 생기면 background.ts 의 `chrome.action.onClicked` 손시험 갈래 제거
- [ ] Phase 2 background 가 받을 메시지: `tiro.segment` / `tiro.partial` / `tiro.selector_broken` (커넥터) · `capture.start` / `capture.stop` / `capture.frame` (캡처)
- [ ] 결정 필요: Phase 2 제공자 호출 시 `--model` 을 명시 고정할지 CLI 기본값(현재 claude-opus-5[1m])을 따를지
- [ ] spikes 에 esbuild 를 넣어 `node:module stripTypeScriptTypes`(ExperimentalWarning) 우회를 안정 도구로 교체할지 검토
- [ ] contracts `screen-frame.schema.json` 에 bytes·mime 를 넣지 않기로 함(내부 기록 전용) — Phase 2 저장소가 필요로 하면 재검토
- [ ] Phase 2 세션 저장소: 교시 종료(period.ended) 시 남아 있는 진행 중 문단(partial)을 확정 세그먼트로 마무리하는 처리 (Gate A 후속)
- [ ] 선택: `spikes/test/tiro-share-observe.test.mjs` 로 관찰 하네스 `summarize()` 공백 계산 5케이스 회귀 테스트화
- [ ] Gate B 손 시험 때 확인 항목 (d) `skippedWhileBusy` 실측값 기록 (설계상 0)
- [ ] Phase 2 사이드패널: `PipelineStats` 새 모양(`loop` 포함) 기준으로 SourceFooter 배선 · 완료 시 `chrome.action.onClicked` 갈래와 `globalThis.classmateCapture` 손잡이 제거
- [ ] 선택: WebP 인코더가 캔버스를 직접 받게 바꿔 getImageData → putImageData 이중 복사 제거 (측정상 압축 시간에 묻혀 우선순위 낮음)

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
- [!] 다음 녹음 때 Real-time 공유 링크로 Gate A (a)(b)(c) 실측 (링크·비밀번호는 채팅으로만)
- [!] IntelliJ MCP Server 켜기 (Settings → Tools → MCP Server → Enable) → Gate C 재측정
- [!] Meet 탭에서 압축해제 확장으로 Gate B 실측 (tabCapture 5분 · 화면 바이트 · 60분 메모리)
- [!] Gate C2 골든 컨텍스트 재측정 비용 승인 (약 1.5 USD 이상 예상)
- [!] Codex 사용 한도 복구 확인 → Gate C2 Codex 측정
- [!] 선생님께 Drive "뷰어 다운로드 허용" 요청
- [!] `gh repo create` 허락
- [!] `design/_to_delete/` 삭제 여부
- [!] `%TEMP%/ccsq`(스크래치 Rust target 폴더) 삭제 여부
