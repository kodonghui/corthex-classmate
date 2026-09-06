# 할 일

## 2026-09-07 — 0.0.6 완료된 문단 답 보존

- [x] 완료 답 후 다른 문단 질문 시 이전 카드가 빠지는 회귀 테스트 실패 재현
- [x] 완료·대기·실패와 무관하게 원래 문단에 질문 ID 보존; 자유 대화·fixture 경계 유지
- [x] 같은 문단 반복 질문, 실패 안내 유지, 늦은 응답 포함 확장 869 tests 통과
- [x] Chromium 5 tests 통과: 완료 답 2개와 이전 후속 대화 공존, 이전 카드에 추가 질문, 380px·790px 가로 넘침 없음
- [x] TypeScript·확장 빌드 통과
- [x] 사용자 추가 UX 요청: 첫 답 18px/16px, 이중 테두리 제거, 주제/시각/최근 질문, 후속 질문 구분, 동일 추론 표시 합치기
- [x] UI 포함 872 tests, Chromium 4 tests: 320px·380px·790px, 확대 글씨, 키보드 전송 확인
- [ ] 0.0.6 설치본 교체·공개키 및 파일 해시 확인
- [ ] 사용자 Chrome 새로고침 후 실제 수업에서 확인

블로그·Notion 집필 기능과 내부 근거 ID의 문장 변환은 별도입니다. 첫 답 글자 크기는 추가 UX 요청으로 함께 개선했습니다.

## 2026-09-06 — 0.0.5 전사 옆에서 바로 이어 묻기

- [x] 라이브 현재·이전 답 카드에서 상세 설명, 화면 설명, 교수자 맥락, 후속 질문과 입력창 바로 표시
- [x] 기본 전사 75%·대화 25%, 분할 조절 유지
- [x] 이전 카드의 후속 질문도 해당 질문에 연결; 빈 편집기 코드가 화면 설명을 가리지 않도록 보강
- [x] TypeScript, 확장 867개 테스트, Chromium 4개 테스트 통과; 380px·790px 화면 확인
- [x] 0.0.5 설치 파일 교체, 공개키 유지·121개 파일 SHA-256 일치, 구버전 백업 보존
- [ ] 사용자 Chrome 새로고침 후 실수업에서 0.0.5 확인


## 2026-09-06 — 0.0.4 연속 대화형 튜터

- [x] 듣는 중·상세 화면 후속 문답에 `details.why` 전체 기본 표시, 문단 줄바꿈 보존
- [x] 대화창 기본 60%, 20~85% 조절, 더 쉽게·예시로·왜 필요한가요 바로 묻기
- [x] 긴 답 도착 시 읽던 위치 유지, 새 질문을 보낼 때 아래로 이동
- [x] 같은 교시 SQLite에서 질문 시점 이전 최근 완성 문답 최대 6개·12,000자를 공통 튜터 프롬프트에 전달
- [x] 첫 줄 40자 계약은 호환 유지, 본문은 제한하지 않고 초보자 설명·용어 풀이·예시 지침 추가
- [x] 재시작 뒤 이전 질문과 전체 설명을 제공자 stdin에 전달하는 통합 시험
- [x] 확장 867개·호스트 단위 179개·Chromium 대화 화면 2개 통과
- [x] 실제 OAuth Claude 합성 2회: 832자/5문단 → 호스트 재시작 → 앞 별명 기억하며 480자/4문단
- [x] 0.0.4 확장 121개 설치 파일·로컬 도우미 교체, 백업 보존, 빌드/설치 해시 일치 및 호스트 ping 확인
- [ ] Chrome 새로고침 후 사용자 수업에서 0.0.4 대화 품질 확인

설치 확인은 WORKLOG의 0.0.4 항목을 따릅니다. 기존 보고서 worker 및 V2-008/009, 전체 하루 대화 요약·자동 복습 생성은 별도 미완료 항목입니다.

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
- [x] 원격 저장소 `corthex-classmate` 생성과 첫 push — 지금 `origin` 이 있고 `main` 이 올라가 있습니다. 확인: `git ls-remote origin refs/heads/main` → `7d649bd…` = 로컬 `main`

- [x] 검토자 지적 수정: fixtures 두 번째 질문 갈래 파일 · 참조 무결성 테스트 · SessionEvent.payload additionalProperties · id 접두사 통일 · settings.json 권한 좁힘
- [ ] 다음 대화형 세션에서 `.claude/settings.json` ask 규칙이 실제로 뜨는지 1회 확인 (`git push` 시도)

## Phase 1 — 기술 게이트 스파이크 (`docs/spikes/`)

- [x] Gate A `gate-a-tiro.md` — **PASS(부분)**: 공유 페이지 커넥터(`src/tiro/` 파서·MutationObserver 관찰기·content script·MCP 스텁) + fixtures 4종 단위 테스트 36건 · 관찰 하네스 `spikes/tiro-share-observe.mjs` · 검증자 minor 4건 수정 완료(문단별 2겹 판별 · 마지막 문단은 명시적 확정 표시만 · stateSource 4값 · stop() 가드 · 공백 계산은 첫 사건부터)
- [!] 대기 — Gate A 실측 (a) MCP 녹음 중 문단 반환 (b) 60분 연속 유지 (c) 발화→화면 지연: 사람이 Real-time 공유 링크를 채팅으로 주면 `TIRO_SHARE_URL=… node spikes/tiro-share-observe.mjs --minutes 60`
- [x] Gate B `gate-b-meet.md` — **PASS(부분)**: `src/capture/`(dHash·FrameStore·pipeline·WebP 인코더) + `SamplingLoop`(겹침 방지·재예약) + offscreen 엔트리 + background 캡처 메시지 + manifest 권한(tabCapture·offscreen) · 실측 dHash 2.75ms · WebP 2.7~607 KiB(실제 인코더 클래스) · capture 테스트 42건 · 검증자 minor 5건 수정 완료
- [ ] 조건부 보류 — 역사적 Gate B의 연속 `tabCapture` 5분·실제 WebP 바이트·60분 메모리 곡선은 U-35의 질문별 한 장 방식이 학습에 부족하다는 실측이 생길 때만 별도로 재개합니다. 현재 사람이 확인할 항목은 U-06′에서 `6bb9c43`을 포함한 로컬 빌드를 해시로 묶어 설치판과 일치시킨 뒤 `screen.frame ≥ 1`과 실제 JPEG 바이트가 남는지입니다
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
- [x] origin: 1라운드 당시에는 원격이 없어 워커가 브랜치 `batch-1/<단위>` 만 남겼습니다. 그 뒤 원격이 생겨 지금은 `main` 과 라운드 브랜치들이 올라가 있습니다(`git remote -v` → `origin`)
- [x] 예약분 실행 완료(바로 아래 「/batch 1라운드 완료」) — 사용자가 2026-09-02 17:3x 에 `/batch` 1라운드 프롬프트(10단위)를 미리 보냄. 본문은 docs/master-prompt.md A-6 1라운드와 동일. **실행 시점: Phase 1 커밋 + "Phase 2 준비 완료 — contracts 고정 · fixtures · 스켈레톤 · origin(대기)" 보고 직후**, 그때 계획 모드 → 사용자 승인 → worktree 워커 10개. origin 이 없으면 브랜치 `batch-1/<단위>` 만 남김. Phase 1 게이트가 이미 만든 코드(5 tiro-connectors · 6 meet-capture · 7 session-store · 9 transport)는 갈아엎지 않고 완성·정리 단위로 다룸.
- [x] `/batch` 1라운드 완료 (2026-09-03 00:05, main `83957e3`) — 계획 승인 · worktree `cc-wt/<단위>` 10개 · 브랜치 `batch-1/<단위>` · 병합 순서 1·4·10·2·3 → 5·6 → 7·8·9 · 검토 워크플로(검토 → 반박 검증) 병행
  - [x] (1) design-tokens `f3d950c` — test 17 · 정본 6 css 바이트 동일(예외 `--panel-header-h` 44 한 줄) · 고유 변수 196 스냅샷 · fonts.css npm(`pretendard@1.3.9`·`@fontsource/ibm-plex-mono@5.3.0`) · `src/tokens.ts` 는 생성물(`pnpm --filter @classmate/design-tokens generate`)
  - [x] (4) tutor-core `823daed` — test 54 · 전이표 6상태×20입력(규칙 93) · 봉인 · FoldTimer(주입 시계) · fixtures 재생(state.changed 4건·snapshot 2건 일치)
  - [x] (10) report-ui `0a9b5a3` — test 56(Playwright 포함) · `scripts/generate.mjs`(Node 24 타입 스트리핑, esbuild 불필요) · 허브 8칸 · 토큰 CSS 인라인(44px 치환)
  - [x] (2) ui-base `dab3512` — test 65 · 22 jsx → 25 export · CSS 21 블록 동일성(Icon 은 css() 없음) · Icon 선별 맵 22 · `lucide-react@1.38.0`
  - [x] (3) ui-classmate `d65735f` — test 88 · 10개 + internal/base 8개 · MarginNote children 계약 · AnswerCard compare/rows · Icon 맵 31
  - [x] (5) tiro-connectors `904e2f3` — 확장 test 122(tiro 36→71) · flush() · tiro.hint_degraded · periodNumber 주입 · MCP/API 스텁 · 관찰기가 class 속성 변화를 놓치던 버그 수정
  - [x] (6) meet-capture `a817def` — 확장 test 169(capture 42→89) · threshold/sampleIntervalMs · EncoderSurface 주입 · FrameSink/MemoryFrameSink · frame.store 봉투 + 1 MiB 가드
  - [x] (9) transport `4735e53` — cargo 40+3(doc) · clippy 0 · fmt ok · `scripts/*.test.mjs` 27 · `host-roundtrip.mjs` hello 수신 · framing 복사(루트 protocol.rs 무변경) · 손 검증기(스키마 8종 include_str!, 유효 예시 14·무효 3·golden-ioc 통과, 모르는 키워드는 오류) · register-host dry-run 이 파일을 쓰지 않음 + 진입점 가드 · Cargo.lock 은 serde_json 3줄
  - [x] (7) session-store `08c6932` — cargo 65(lib 50·bin 11·통합 4) · clippy 0 · fmt ok · std base64 디코더 · `frames` 표 + `frame.store` Router 왕복 · `state.changed` from/to 검증 · 프레임 포함 복구 시험(손실 창 5~9 ms, 어긋난 짝 0) · fixture 경로 불일치는 A 안으로 해소(`5484f2d`)
  - [x] (8) providers `202fa91` — cargo 41(unit 29 · fake CLI 8 · no_real_cli 3 · queue e2e 1) · clippy 0 · fmt ok · 실제 `claude`/`codex` 호출 0회 · `TutorProvider` 동기 trait + FIFO 큐(동시 1·상한 4) · stream-json 파서 이식 · `.cmd` 래퍼 해석 · `taskkill /T /F` · Codex 스텁 + 프로토콜 메모 · 질문은 argv 가 아니라 stdin 으로만
  - [x] 10단위 전부 main 병합 완료(`4a403c3`) · fixture 프레임 경로 A 안(`5484f2d`) · 검토 1·2파 실재 21건 + 낮음 45건을 `batch-1-fix/<단위>` 9개에서 고쳐 전부 병합 · 기록 `docs/reviews/batch-1-review.md`
  - [x] 검토 1파(단위 1·2·3·4·10, 에이전트 20 · 반박 검증) 실재 8 · 반박 7 · 낮음 28 → 수정 브랜치 4개 병합: tutor-core `be72d12`(MachineError 로 `at` 파싱 오류 드러냄 · `import type` 강제 시험이 주석·문장 머리를 구분 · 시계 단조 · 무시 이유 기록 · 71) · report-ui `736badf`(카드 그림자 제거 · `frameHref(ref, frame)` id 기준 경로 + 중복 경고 · `.frame-image` 반응형 · `joinInlineCss` 가 `</style` 거부 · 74) · ui-base `37e5c0f`(Icon 맵 23(`trash-2`) · 커버리지 시험이 components + ui_kits/sidepanel 재귀 · 한국어 주석 시험 · `process` 가드 · 73) · ui-classmate `4a2a0bb`(copy 시험이 정본 HTML 문구를 렌더 결과로 대조 · 영어 주석 86곳 한국어 · structure 시험 정본 .d.ts prop 집합·cm-* 클래스 18쌍 대조 · StatusDot role·AnswerCard 절 키 정본대로 · Icon 경고 호출 시점 판정 · 96)
  - [x] 검토 2파(단위 5·6·7·8·9, 에이전트 26 · 반박 검증) 실재 13(high 2) · 반박 8 · 낮음 28 → 수정 브랜치 5개 병합: tiro `75db8b6`(`wxt:locationchange` 로 SPA 이동 추적 · stop 이 구독을 남겨 재시작 가능 · periodId 계약 패턴 검사 · 가장 안쪽 문단만) · capture `46da1d1`(스트림 열기 전 검증 + 실패 시 트랙·video 정리 · 5연속 실패 예산 리듀서 · 프레임 id `sf-p<n>-<hhmmss>-<seq>` · 봉투 크기 산술 1회 · FrameStore 검사 호스트와 동일) · session-store `c37a148`(`clock.rs` 바이트 슬라이스 패닉 13곳 제거 + `Router::store` expect 제거 · 이벤트 id `ev-<periodId>-<seq>` + 0행이면 롤백 · 오류 응답 네 칸 통일 · `.part` 정리 · ack `duplicate` · `deny_unknown_fields` · 76) · providers `2af101b`(stdin 도착 실측 · 실행 모양 자리 검사 · 프롬프트 쓰기 실패 보고 · Timeout stderr_tail · `.cmd` 런타임 거절 · 49) · transport `15527f0`(`ENVELOPE_RULES` 에 `frame.store` + `ExtraCheck` · main.rs 원문 대조 · type 배열 전수 검사 · roundTrip 15초 timeout + 실패 갈래 8건 · `--exe` 존재 검사 · 윤초 UTC · cargo 50 · node 42)
  - [x] 최종 검증(main `83957e3`): `pnpm test` 664(design-tokens 17 · contracts 57 · ui-base 73 · tutor-core 71 · browser-extension 214 · report-ui 74 · ui-classmate 96 · spikes 62) · `pnpm typecheck` 0 · `cargo test --workspace` 175 · clippy 0 · fmt ok · `node --test scripts` 42 · `host-roundtrip` hello · `report-ui generate` ok · `meet-capture-measure` ok · 비밀값 grep 0 · `git diff --check` 0
- [ ] 1라운드 후속(워커 메모 이월)
  - [x] 사이드패널(2026-09-03 `entrypoints/sidepanel/main.tsx` · fonts.css 의 bare specifier `@import` 는 WXT/Vite 빌드에서 번들됨): CSS 적재 순서 = design-tokens → `@classmate/ui-base/styles.css` → `@classmate/ui-classmate/styles.css` · fonts.css 의 bare specifier `@import` 가 WXT/Vite 빌드에서 해석되는지 확인
  - [x] 사이드패널(2026-09-03 `src/panel/PanelApp.tsx` · `lesson-view.ts`): Alt+S 는 화면이 `e.code === "KeyS"` 로 듣기(StuckButton 은 kbd 안내만) · 접힘 타이머는 tutor-core FoldTimer · SourceFooter count 는 term 있을 때만 화면이 셈 · 대기 문구 3종은 tutor-core 상수 재사용 · 화면 분기는 TutorState 가 아니라 note 축
  - [x] ui-classmate internal/base → `@classmate/ui-base` 교체(index.ts 한 줄 + tsx 8개·base.css 삭제 + styles.css 첫 줄 + structure.test.ts 기대값) — 두 포팅의 어긋남은 검토 결과 참고 — 완료(2라운드 단위 3 `6f5f631` · ui-base ICON_MAP 31 · ui-classmate 78)
  - [x] Evidence 이름 대응표(디자인 verified/delayed ↔ 계약 confirmed/stale)를 한 곳에 두기 — `apps/browser-extension/src/panel/evidence.ts` (2026-09-03)
  - [ ] 사이드패널 후속: fixture `session-events.jsonl` 27번째 `state.changed` 시각(10:33:09)을 기계 답(`period.ended` 10:33:14 에서 접힘)으로 맞출지 결정 — contracts·fixtures 고정 상태라 지금은 시험이 from·to 만 대조하고 앞 3건만 시각까지 본다
  - [x] 사이드패널 2라운드: 실제 커넥터(Tiro·Meet·로컬 도우미)를 `ReplayStore.pushEvent` 자리에 배선 · ui-classmate `internal/base` → `@classmate/ui-base` barrel 교체 · 기록·설정 화면(상태 G) · 개인정보 문구(`docs/privacy.md`) · `Classmate Side Panel.dc.html` 렌더와 나란히 비교 이미지 · 강조 줄 계산(`"= new "` 문자열 검색)을 편집기 발췌 일반형으로 — 완료(2라운드: 단위 1b `ReplayStore.live` · 단위 2 `attachLive`/service worker · 단위 1a 기록·설정·개인정보 3칸 · 통합 B `App.tsx` `71036de`)
  - [ ] design-tokens 에 실제로 정의돼 있는지 확인: --transcript-1/2/3 · --term-* · --evidence-*-{bg,text,border} · --code-* · --panel-inset · --control-h-hero · 키프레임 cm-sweep/cm-breathe/cm-fade-in/cm-spin (컴포넌트 CSS 가 참조)
  - [ ] report-ui: 토큰을 정본 파일 대신 `@classmate/design-tokens` 에서 읽기 · 오개념/값 흐름/변형과 허브 5절은 회상 기록이 붙으면 채움 · 프레임 출력 경로 규약 `frames/p<교시>/` 는 `src/assets.ts`
  - [ ] tutor-core: 확장 쪽 Clock/Scheduler 구현체 · question.asked 에 봉인을 싣는 문맥 수집기 · `next` 입력의 실제 트리거 정의
  - [x] tiro: background 가 tiro.hint_degraded/selector_broken 을 connector.status payload 로 싣기 · tiro.stop 보내는 쪽(세션 관리) · classmate.periodNumber 쓰는 쪽(설정) · 새로고침 뒤 seq 이어 붙이기(세션 스토어) · 배너 등급(class-partial/structure) 결정 — 2라운드 단위 2 가 `connector.status tiro-share paused/connected` 로 실음 · `tiro.stop` 은 `classmate.reconnect` 가 보냄 · `classmate.periodNumber` 는 설정 화면(단위 1a)이 씀. 남음: 새로고침 뒤 seq 이어 붙이기(세션 스토어 도착 순 seq 로 정렬) · 배너 등급 결정
  - [x] capture: `background.ts`의 `frameSink`를 `NativeHostFrameSink`로 교체 · `frame.stored/error` 응답 처리 · 재연결 정책 — 2라운드 단위 2 완료(`NativeHostFrameSink` · `frame.stored/error` · 재연결 1·2·4…≤30초 · 오프라인 60장 폴백). 후속 U-35부터 `chrome.action.onClicked`는 수업 탭 지정·`activeTab` 부여·패널 열기의 제품 입구라 유지합니다. `globalThis.classmateCapture`는 별개의 연속 `tabCapture` 손시험 손잡이이며, 연속 캡처를 제품 기능으로 채택해 별도 제어 UI를 만들 때만 제거를 검토합니다
  - [x] transport 후속: 2라운드에 `src/main.rs` 가 `classmate_transport::framing` 을 쓰고 `src/protocol.rs` 삭제 · 루트 Cargo.toml 에 의존성 추가 · `Router::handle` 앞에 `validate_envelope` · 계약이 새 키워드/정규식/format 을 쓰면 `schema.rs` 도 함께 확장(UnsupportedSchema 로 멈춤) — 2라운드 단위 5 완료(`protocol.rs` 삭제 · 루트 의존성 · `validate_envelope` · ENVELOPE_RULES 7). 남음: 계약이 새 키워드/format 을 쓰면 `schema.rs` 확장
  - [ ] session-store 후속: 강제 종료 때 남는 짝 없는 `.webp`/`.part` 정리 시점(교시 종료 vs 복습자료 생성) 결정 · `StoreError::reason_code()` 낱말 목록(invalid-frame-id · frame-path-mismatch · duplicate-frame · invalid-base64 · malformed-frame · period-id-shape · invalid-state-transition)을 확장이 분기값으로 쓸지와 계약 문서화 여부 · 2라운드 뒤 확장이 보는 낱말: 봉투 검사 `envelope-invalid` · `question-too-long` · `malformed-snapshot`, 튜터 `provider-unavailable` · `unknown-question`(DECISIONS 2026-09-03 고정 계약 (마)) — 저장소 낱말은 그대로 뒤에 남음
  - [x] providers 후속: `AskRequest` 에 본문 칸(materials) 추가 여부 확정(DECISIONS 제안 (b)) — tutor-core 가 봉인 식별자로 본문을 조립해 넘기는 구조 · Gate C2 골든 재측정(비용 승인 대기) 뒤 프롬프트 조립과 README §3·§9 갱신 · Codex 한도 복구 뒤 `src/codex.rs` 실측 칸 7행 채우고 스텁 교체 · 프리워밍/`--input-format stream-json` 상시 프로세스는 다음 라운드 — materials 칸은 2라운드 단위 7 `with_materials` + 통합 A 로 확정(파이프라인이 조립해 넘김). 남음: Gate C2 골든 재측정(비용 승인 대기) · Codex 스텁 교체 · 프리워밍
  - [ ] 검토 보류(1파 낮음) 11건 — design-tokens: 생성기가 같은 이름의 뒤 선언을 남기게(L1) · 값 시험 표본 6→전수(L2) · 저장소 상대 경로·시험 상수를 공개 API 에서 빼기(L3) · README/vitest 주석(L4·L5) — tutor-core: EXIT_RECALL 에서 새 질문 붙잡을 때 이전 answerId·answerStatus 초기화(L7) · DELAYED_CHECK→CAPTURE 에서 periodEnded 초기화(L8) — report-ui: 칩·근거 알약 모서리 4/6px(L12) · 전사에 `--type-transcript`(L17) · labels 주석 근거(L11) — ui-classmate: 안 쓰는 `@classmate/contracts` 의존 제거(L27). 표: `docs/reviews/batch-1-review.md`
  - [ ] 검토에서 문서로만 남긴 한계 — session-store `store_failure` 의 reason 을 고정 낱말로(지금은 한국어 문구) · 프레임 id 유일성은 1초 단위(같은 초 재시작이면 `duplicate-frame`) · Tiro seq 는 방출 순서라 뒤집힐 수 있어 세션 스토어 도착 순 seq 로 정렬(2라운드에서 확인) · `chrome.action.onClicked`는 U-35 제품 입구로 유지 · 연속 캡처를 제품 기능으로 채택해 별도 제어 UI가 생길 때만 `globalThis.classmateCapture` 제거 검토
- [x] 부채 해소(Gate D): `protocol::read_frame` 이 본문을 끝까지 읽은 UTF-8·JSON 오류는 `{"type":"error","message":"unreadable message"}` 로 답하고 계속 삶 · 헤더/본문 절단·상한 초과만 종료 (테스트 `serve_survives_a_frame_it_cannot_read`)
- [x] `/batch` 2라운드 완료 (2026-09-03) — 9단위 `batch-2/<단위>` 전부 main 병합 + 통합 커밋 A `9d47d64`(라우터 → TutorPipeline) · B `71036de`(App.tsx 라이브) · C `9afdd24`(비교 G/H-1) · 기록 `docs/WORKLOG.md` 2라운드 항목 · 결정 `docs/DECISIONS.md` 2026-09-03 세 항목
  - [x] (1b) panel-live-store `7b86fed` — `ReplayStore.live` · 빈 번들 · questionId 당 ask 1회 · 60초 워치독 · id 규칙 `event-ids.ts`
  - [x] (5) host-core `37ff677` — `src/router.rs` · `protocol.rs` 삭제 · writer 스레드 · ENVELOPE_RULES 7 · ping 만 오간 세션 push 0
  - [x] (3) ui-base-swap `6f5f631` — internal/base 삭제 · ICON_MAP 31 · 스크린샷 바이트 동일
  - [x] (2) service-worker — 라우터 표 · `NativeHostClient` FIFO/재연결 · `NativeHostFrameSink` · 교시 로그 500 · `attachLive` · permissions `nativeMessaging, alarms` · `key` env
  - [x] (7) providers-round2 — `with_materials` · `--include-partial-messages` 파서 · `RetryPolicy`
  - [x] (6) context-builder — `TutorPipeline` · 시험 11 + `no_real_cli_root` · `fake-tutor-cli.mjs`
  - [x] (1a) sidepanel-screens `4571512` — 기록(G) · 설정 · 개인정보 3칸 · H-1 다시 연결 · 360/380/520 · e2e 16 · 스크린샷 14장
  - [x] (8) installer-windows `224114a` — build-host · extension-key(공개키·id) · package-extension(dev/store) · install dry-run · smoke-host · `docs/first-class.md` · 시험 57
  - [x] (4) design-compare `e24b331` + 통합 C — 정본 dc.html ↔ 구현 9상태 비교 이미지 · README 차이 목록
- [ ] 2라운드 후속(워커 메모 이월)
  - [ ] 사이드패널: 설정 값 배선 — `answerLength`("바로 자세히" 자동 이동 — 검토 수정 뒤 라디오는 잠금 · 배선할 때 questionId 당 한 번만 자동으로 열어야 `back()` 과 무한 왕복이 안 생김) · `periodNumber`/`subject` 가 헤더·교시 id 에 즉시 반영(지금은 패널 재열기 · 교시 중간에 바꾸면 사건 id `ev-<periodId>-x…` 가 갈라지므로 계약 논의 먼저 · 제공자·자동 접기는 `ReplayStore.updateEnv` 로 즉시 적용됨 · `autoFold` 를 다시 켜도 지금 떠 있는 메모에는 접힘 시계를 새로 걸지 않음) · `capture.*` 3칸(검토 수정 뒤 잠금)을 `ReplayStore#seal` 의 sealSnapshot 입력과 라이브 수집 양쪽에서 읽어 서비스 워커 캡처에 · 점선 낱말 목록을 `GOLDEN_TERMS` 대신 설정/라이브 옵션에서(라이브 전사에 밑줄 거의 없음) · "오늘 기록 지우기"(검토 수정 뒤 잠금 · Dialog 와 `onClearToday` 배선은 남김)는 호스트 삭제 봉투가 생기면 `LiveApp` 이 `onClearToday` 를 넘기고 `disabled`·설명 한 줄만 걷어 냄 · 라이브 편집기 자리표시 문구("아직 열린 파일 없음")가 preparing 자료줄에 보임 · 기록에서 연 지난 순간에 후속 칩(스토어에 "어느 질문에 대해 묻는가" 축 필요) · 설정 화면 380×720 스크롤 · `replay-handle`·`classmateConnector` 는 개발 빌드에서만 · 라이브 첫 수십 ms 빈 화면
  - [ ] design-tokens: `spacing.css` 의 `--panel-inset` 식(`4vw + 0.8px` → 360 에서 15.2px)을 토큰 쪽에서 바로잡을지 결정(지금은 패널 `style.css` 만 `10vw - 22px` 로 덮음)
  - [ ] 서비스 워커: `chrome.action.onClicked` 는 이제 수업 탭 선택 + `activeTab` 권한 + 패널 열기의 **제품 입구**라 제거하지 않음(`acd21bc`) · `classmateCapture` 만 연속 `tabCapture` 손시험용 레거시 손잡이 · IntelliJ MCP 는 `router.pushEditor`/`live.editor` 자리만 · 확장이 `event.append` 에 segment/context 본문을 실어야 호스트 자료가 모임(라우터 표대로 실리는지 실제 Chrome 왕복 '대기') · 서비스 워커가 내려갔다 올라올 때 메모리 상태 — 검토 수정(`e847c61`)으로 교시 id·질문 수·화면 장 수·커넥터·`period.started` 를 `chrome.storage.session` 의 `classmate.routerState` 에 되살림(`storage.local` 폴백 없음). 남음: 전사 중복 걸름 기억(`seenSegments`)은 담지 않아 재기동 사이 같은 문단이 오면 한 줄 더 남을 수 있음 · 연속 캡처를 제품 기능으로 채택할 때만 패널 시작/중지 버튼과 `classmateCapture` 제거를 함께 검토 · `buildFrameStore` 를 던지지 않고 `{skipped, reason}` 으로 바꾸는 절반은 `src/capture/host-messages.test.ts:122` 가 던짐을 단언해 캡처 소유자와 함께(검토 #15 절반 보류)
  - [ ] 호스트: 교시가 바뀌어도 `Router.tutors` 손잡이를 닫지 않음 → `period.ended` 때 닫는 정리 · 검토 보류 3건 — 재시도 간격표 두 벌의 정본 결정(`RetryPolicy::delay_for` 는 표가 끝나면 멈춤 vs 파이프라인 `delay_at` 은 마지막 값 되풀이 · 기본 3칸·3회에선 동일) · 워커 스레드가 죽으면 그 교시 손잡이가 영구 `stopped`(회복 경로는 `tutor_handle` 대여 구조 변경 + 패닉 주입 통로 필요) · `tutor.accepted` 가 워커의 `question.asked` 보다 먼저 나가는 순서 보장(`Router::handle` 이 "답 없음" 을 낼 수 있어야 해 응답 계약 변경) · 가짜 CLI 모드 추가됨(`tests/fake-tutor-cli.mjs --delay-ms` · `crates/providers/tests/fake-claude.mjs --break-stdout-and-linger`) · `ProviderEvent`(TextDelta) 는 버림(부분 답 스트리밍은 패널이 한 줄 답만 그리므로 보류) · 손잡이의 제공자와 봉투 `provider` 가 다르면 `provider-unavailable`(교시 중 제공자 변경은 패널 재열기) · transport 대조 시험이 `router.rs` 의 따옴표 이름 뒤 화살표를 전부 세므로 주석에도 그 모양을 쓰지 않음 · `docs/spikes/gate-c2-provider.md` 의 CLI 인자 표는 5개(`--include-partial-messages`)로 갱신함 · `docs/spikes/gate-d-recovery.md:224` 의 `frame-path-mismatch` 는 이제 봉투 검사 `envelope-invalid` 로 먼저 잡힘(주석 추가)
  - [ ] installer/문서: dev zip 확장 id 는 `extension-key.json` 과 같은지 chrome://extensions 에서 사람이 확인('대기') · 자동 업데이트·.crx 서명·설치 마법사는 `docs/first-class.md` §7 보류 · 비교 이미지 캡션 sha 는 한 커밋 뒤처짐(스크립트 커밋을 가리킴) · 비교 README "차이 있음" 11번(설정의 제공자 선택·개인정보 문구는 정본 밖에서 새로 쓴 것)
  - [ ] 도구: worktree 병렬 cargo 빌드는 공유 `CARGO_TARGET_DIR` 을 쓰지 않는다(rlib 이름 충돌 · DECISIONS 2026-09-03 통합 (6)) — worktree 마다 target 을 나누거나 순차로
- [ ] 부채: native-host `store::SESSION_EVENT_TYPES` 는 contracts `session-event.schema.json` enum 의 손 사본(테스트가 시험 시점에 대조) → Rust 타입 생성(typify)이 붙으면 생성물로 교체
- [ ] 부채: rusqlite `=0.30.0` 고정(winsqlite3 기능이 0.31 부터 삭제) → MSVC 전환 시 `bundled` 로 바꾸고 고정 해제
- [ ] 부채: SessionEvent.payload 를 type 별 oneOf 판별 유니온으로
- [x] 부채 해소: rusqlite `bundled` 대신 `winsqlite3`(System32 내장 SQLite) 링크로 확정 (DECISIONS 2026-09-02) · MSVC 환경이 생기면 `bundled` 로 교체 검토
- [ ] 메모: TypeScript 7.0.2 는 `node_modules/@types/*` 전역 타입을 자동 포함하지 않음 → 패키지마다 `/// <reference types="…" />` 한 줄 .d.ts
- [ ] 메모: Rust 빌드는 짧은 경로에서만 (MAX_PATH 260) — 임시 폴더에서 돌리면 `CARGO_TARGET_DIR` 을 60자 이내로
- [ ] 메모: 제품 코드에서 `@classmate/contracts` 는 `import type` 만 (Ajv 의 new Function 이 MV3 CSP 에 막힘) · 검증은 테스트에서만
- [ ] 선택: 한 장 캡처로 학습에 부족하다는 실측이 나올 때만 연속 `tabCapture` 시작/중지 버튼을 만든다. `chrome.action.onClicked` 는 수업 탭 지정 입구라 유지하고, 버튼이 생기면 콘솔 손잡이 `classmateCapture` 만 제거한다
- [x] Phase 2 background 가 받을 메시지: `tiro.segment` / `tiro.partial` / `tiro.selector_broken` (커넥터) · `capture.start` / `capture.stop` / `capture.frame` (캡처) — 2라운드 단위 2 라우터 표(`src/background/router.ts`)에 전부 있음
- [ ] 결정 필요: Phase 2 제공자 호출 시 `--model` 을 명시 고정할지 CLI 기본값(현재 claude-opus-5[1m])을 따를지
- [ ] spikes 에 esbuild 를 넣어 `node:module stripTypeScriptTypes`(ExperimentalWarning) 우회를 안정 도구로 교체할지 검토
- [ ] contracts `screen-frame.schema.json` 에 bytes·mime 를 넣지 않기로 함(내부 기록 전용) — Phase 2 저장소가 필요로 하면 재검토
- [ ] Phase 2 세션 저장소: 교시 종료(period.ended) 시 남아 있는 진행 중 문단(partial)을 확정 세그먼트로 마무리하는 처리 (Gate A 후속)
- [ ] 선택: `spikes/test/tiro-share-observe.test.mjs` 로 관찰 하네스 `summarize()` 공백 계산 5케이스 회귀 테스트화
- [ ] Gate B 손 시험 때 확인 항목 (d) `skippedWhileBusy` 실측값 기록 (설계상 0)
- [ ] Phase 2 사이드패널: `PipelineStats` 새 모양(`loop` 포함) 기준으로 SourceFooter 배선 · 연속 캡처를 채택해 패널 제어가 생기면 `globalThis.classmateCapture` 손잡이만 제거
- [ ] 선택: WebP 인코더가 캔버스를 직접 받게 바꿔 getImageData → putImageData 이중 복사 제거 (측정상 압축 시간에 묻혀 우선순위 낮음)

- [x] packages/tutor-core 상태기계 + ContextSnapshot (1라운드 단위 4 · 71 tests)
- [x] apps/native-host session-store · context-builder · provider 연결 (session-store 1라운드 · context-builder 2라운드 단위 6 · 라우터 연결 통합 A `9d47d64`)
- [x] packages/design-tokens 포팅 → 사이드패널 4화면 · 상태 A~H — 듣는 중·자세히 2화면과 상태 A·B·C·D·E·F·H 는 `apps/browser-extension/src/panel/` 에 완료(2026-09-03), 기록·설정 화면과 G 는 2라운드 · 기록·설정 화면과 G · H-1 은 2라운드 단위 1a(`4571512`) 완료 — 스크린샷 14장(`docs/screenshots/`) · 정본 비교 9장(`docs/screenshots/compare/`)
- [x] Playwright E2E + docs/screenshots/ 9장 (2026-09-03 · `e2e/extension.spec.ts` 10 passed · `docs/screenshots/README.md`)
- [x] docs/architecture.md · docs/privacy.md 초안 (2026-09-03)
- [x] reviewer 검토 (사이드패널 2라운드 병합 뒤) — 2라운드 검토 4명(확장 패널 · 확장 background/live · 호스트 · installer/문서) 발견 65건(높음 10) → 수정 워커 4명이 반박 먼저 · 실재 60 수정 · 보류 5 · 반박 0 → `batch-2-fix/*` 4브랜치 main 병합(`d42dfca` · `ae4f8f4` · `e847c61` · `76a8f13`) · 정본 `docs/reviews/batch-2-review.md` (2026-09-03)

## Phase 3 — 교시 종료 후

- [ ] EXIT_RECALL → FEEDBACK → FADE_SUPPORT → DELAYED_CHECK — 이 네 상태로 들어가는 문(`kind:"next"`)을 내는 제품 코드가 아직 0곳입니다(`grep -rn 'kind: *"next"' apps packages` 의 시험 밖 한 줄은 `packages/tutor-core/src/machine.ts:156` 의 타입 선언뿐). 8라운드 과설계 검토(`docs/plan/round-8-units.md` §0)는 이것을 「만들 단위가 아니라 기능 셈에서 뺄 후보」로 판정했습니다
- [ ] Tiro 최종본 교정 + 보정 사전
- [ ] packages/report-ui 교시 상세 8 + 하루 허브 1

## 3라운드 실측 결함 — 7건 전부 병합 완료 (2026-09-03)

2026-09-03 오전 실전 수업에서 나온 결함 목록입니다. `batch-3/live-quality`(A) 와
`batch-3/panel-ask`(B) 로 고쳐 `9df97e8` · `fff67dd` 로 main 에 들어갔습니다.

- [x] 자세히 화면 맨 아래 자유 텍스트 질문 입력창(`docs/master-prompt.md` §3-7) — 3라운드 B `d83e0d7`. 지금 `screens/DetailScreen.tsx:134` 에 `placeholder="이어서 물어볼 말을 적어요"` · `aria-label="이어서 묻기"` 가 있고 `onAsk` 가 `tutor.ask` 로 나갑니다
- [x] 라이브 짐작 라벨이 fixture 고정(`golden-bundle.ts:165` "왜 new로 직접 만들면 안 되는지") — 3라운드 B `a3ed7f0`·`38513d2`. 붙잡은 문장에서 짐작을 만드는 순수 함수 `src/panel/guesses.ts` 가 생겼고 `live-store.test.ts:268` 이 fixture 짐작이 라이브에 안 나오는 것을 못 박습니다
- [x] 후속 칩이 모델을 부르지 않고 결론을 되풀이 · 모델이 준 `answer.chips` 2개가 화면에 없음 — 3라운드 B. 지금 `replay-store.ts:710` 의 `followUp` 이 실제 `#ask` 를 걸고, 모델 칩은 `model-0`·`model-1` id 로 들어옵니다(`#modelChip` `:1332`)
- [x] partial 문단 중복(`ts-058` 이 3번 `event.append`) — 3라운드 A `9a7be6d`. 워커가 `(id, state, text)` 지문을 `seenSegments`(`background/router.ts:291`)로 걸러 같은 조각을 다시 붙이지 않습니다
- [x] 자세히 화면 문단 시각이 UTC — 3라운드 A `75025c3`·`bac90e3`. `src/panel/clock.ts` 가 `Z`·`+09:00`·`+0900` 을 다 읽어 KST 한 축으로 옮깁니다
- [x] 기록 화면 바닥줄이 Meet·IntelliJ 도 "기록 중" 으로 고정 — 3라운드 A `1a45bb2`. `history-view.ts:81` 의 `footerSourceOf` 가 `connected`→`기록 중`, `off`·보고 없음→`—` 로 나눕니다
- [x] Tiro 공유 페이지가 잠시 멈췄을 때 DOM 모양이 안 남음 — 3라운드 A `746f813`·`b1fd1eb`·`360c2ec`. `share-parser.ts:234` 의 `domShape`/`formatDomShape` 가 등급이 떨어진 순간에만 모양을 재고(`share-observer.ts:178`), 「다시 연결」이 어디까지 회복하는지는 `src/tiro/README.md` 에 사실대로 적혔습니다

## 4~7라운드에서 남은 일

`docs/WORKLOG.md` 2026-09-03 12:51·15:15 항목과 `docs/plan/round-8-units.md` §0 이 근거입니다.
각 줄 끝의 확인 명령은 이 문서를 쓸 때(HEAD `7d649bd`) 실제로 돌려 본 것입니다.

- [ ] 드래그로 고른 부분을 그대로 묻는 길이 없음 — 붙잡는 길은 낱말 누름 · 문장 누름 · `Alt+S` · 대화 칸 입력 넷뿐입니다. 확인: `grep -rn -E "dragstart|dragend|onDrag|draggable|selectionchange|getSelection" apps packages installer` → 0줄
- [ ] 패널이 닫혀 있으면 `Alt+S` 가 안 먹음 — 전역 단축키(`chrome.commands`) 배선이 0곳입니다. 확인: `grep -rn "chrome.commands|\"commands\"" apps/browser-extension` → 0줄. 확장 아이콘 클릭은 `activeTab` 권한과 패널 열기를 해결했지만(`acd21bc`), 패널 밖 `Alt+S` 는 별도 `commands` 입구가 필요합니다
- [~] 수업 화면 한 장 길은 `acd21bc`에서 **영상 탭의 확장 아이콘 클릭 → 탭 선택 + `activeTab` + 패널 열기 → 질문 때 품질 60→30으로 최대 두 번 촬영을 시도하고 성공 프레임 최대 한 장 저장**으로 구현했고, `6bb9c43`이 느린 옛 캡처·탭 조회가 최신 선택을 지우는 경합을 막았습니다. 현재 작업트리에서 `pnpm test` 1,639건, 확장 Vitest 728건, typecheck·build, Playwright E2E 18건이 통과했고 빌드 매니페스트는 `activeTab` 1 · `<all_urls>` 0 · Meet 호스트 0입니다. 다만 E2E는 사이드패널 문서를 직접 열어 검사하므로 Chrome 도구막대 클릭·`activeTab` 부여·실제 `captureVisibleTab` 왕복을 검증하지 않습니다. 정확한 설치판의 `screen.frame ≥ 1`은 아직 미측정이며, `globalThis.classmateCapture`는 별개의 연속 `tabCapture` 손시험 손잡이로 남아 있습니다
- [x] batch-4~7 뒤 낡았던 스크린샷을 U-35 `acd21bc`에서 골든 13장으로 재생성했습니다. Playwright E2E 18건이 통과했고 대표 장면(듣는 중·붙잡은 직후·자세히·기록)을 눈으로 확인했습니다. 후속 검증에서 다시 생성된 `golden-04-answer.png`도 같은 화면임을 확인했습니다
- [ ] `docs/first-class.md` §3-3 이 예로 든 매니페스트 자리(`C:\CorthexClassmate\com.corthex.classmate.json`)와 이 PC 의 실제 등록 값이 다름 — 실제 값은 저장소 `installer/windows/dist/com.corthex.classmate.json` 의 절대 경로입니다. 확인: `reg query "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.corthex.classmate"`. 깨끗한 PC 절차(문서)와 개발자 PC 실제(레지스트리) 중 어느 쪽을 정본으로 둘지 리허설 전에 정합니다
- [ ] `CLASSMATE_TUTOR_SESSION=1`(교시 하나에 튜터 프로세스 하나 다시 쓰기)을 실제 CLI 로 검증한 적이 0회라 기본값이 거짓입니다(`apps/native-host/src/router.rs:156` "**기본값은 거짓**"). 확인: 그 줄과 `WORKLOG.md:126`
- [!] U-36 과거 오류 원문 채집은 **미실행/waived**입니다. 공식 API 조건상 `captureVisibleTab`은 `activeTab` 또는 `<all_urls>`가 필요하고 특정 Meet 호스트 권한만으로는 부족하지만, 2026-09-03 이 PC의 `screen.frame 0`이 바로 그 오류 때문이었다는 인과는 원문을 얻지 못해 확정하지 않습니다
- [!] 수업 화면 실측 — `6bb9c43`을 포함한 로컬 빌드를 해시로 묶어 설치판과 일치시킨 뒤 9라운드 인계서 §5 절차로 `screen.frame` 수와 실제 그림 바이트를 잽니다. 현재 새 경로의 숫자 칸은 비어 있으며, 알려진 `screen.frame 0`은 U-35 이전 설치판의 역사 기록일 뿐 현재 경로의 성공·실패 근거가 아닙니다 → U-06′(사람)
- [ ] 프레임 한 장 단가를 Gemini 기준으로 다시 계산하기 — `docs/spikes/meet-vision.md:383` 은 Claude 기준(약 1,196 시각 토큰 · 약 0.006 USD)만 적혀 있습니다. 확인: `grep -ric "gemini" docs/spikes/meet-vision.md` → 0
- [x] 시험 네 갈래(vitest · cargo · node --test · e2e)를 루트 명령으로 분리 실행 — `1421e21` 이 `test:all`/`test:vitest`/`test:cargo`/`test:node`/`test:e2e` 를 만들었고, CI 수정 `b530e9d`·시간대 시험 수정 `b9708e5` 뒤 첫 초록 run `33803599999`, 마지막으로 확인한 원격 `1ea20b5` run `33836539868`도 성공했습니다. `pnpm test`는 빠른 세 갈래만 실행하고 E2E는 목록만 셉니다
- [~] U-38 CI 관문 — `991dc95`가 typecheck·Rust fmt·clippy를 로컬 GitHub Actions 워크플로에 추가했고 세 명령은 로컬에서 통과했습니다. 로컬 main은 아직 push되지 않아 마지막 원격 성공 `1ea20b5` run `33836539868`에는 이 관문들이 없으며, 새 관문을 포함한 원격 CI 실행은 아직 없습니다
- [~] 기록 저장 거절은 라우터가 `connector.status {native-host, paused}` 로 내지만 패널 표시는 아직 `off`만 별도 처리합니다. 사건 통로는 생겼고 사용자 화면 표현이 남았습니다 → 8라운드 U-21
- [x] 한 줄 결론 바로 아래에 답 본문 첫 문단(U-33 `e27f340`) · 밀려난 붙잡기 질문을 대화 칸에서 물어본 원 전사 줄 옆 메모로 이동(U-34 `b6d0e3c`)

## 사람이 할 일 (대기)

- [!] Tiro MCP OAuth 인증 (`/mcp` → tiro → Authenticate)
- [!] Tiro Max 결제 (월 무제한)
- [!] 다음 녹음 때 Real-time 공유 링크로 Gate A (a)(b)(c) 실측 (링크·비밀번호는 채팅으로만)
- [!] IntelliJ MCP Server 켜기 (Settings → Tools → MCP Server → Enable) → Gate C 재측정
- [!] 영상 탭에서 `6bb9c43` 압축해제 확장을 로드해 한 장 캡처 실측(`screen.frame ≥ 1` · 실제 바이트). 연속 `tabCapture` 5분·60분 메모리 실측은 한 장 방식이 부족하다는 근거가 생길 때 별도로 진행
- [!] Gate C2 골든 컨텍스트 재측정 비용 승인 (약 1.5 USD 이상 예상)
- [!] Codex 사용 한도 복구 확인 → Gate C2 Codex 측정
- [!] 선생님께 Drive "뷰어 다운로드 허용" 요청
- [x] `gh repo create` 허락 — 끝났습니다. `origin` 이 붙어 있고 `main` 이 원격과 같습니다(`git ls-remote origin refs/heads/main`)
- [x] 로컬 도우미 레지스트리 등록 `node installer/windows/install.mjs --apply` — 2026-09-03 오전 사용자가 직접 실행 · `reg query HKCU\Software\Google\Chrome\NativeMessagingHosts\com.corthex.classmate` 가 `dist/com.corthex.classmate.json` 을 가리킴 (해제는 `--remove --apply`)
- [!] 깨끗한 Windows 11 VM 에서 `docs/first-class.md` §2~§4 를 처음부터 1회 · 65분 리허설 1회 + §4-2 다섯 항목 기록
- [x] Chrome 안 실제 왕복 손 시험 — 2026-09-03 10:49 dev 확장(id `meldoohgnggckjahcchmfjnngpafcjon`)을 얹고 사이드패널 '수업 · 2교시' 를 열자 도우미가 `%LOCALAPPDATA%\CorthexClassmate\sessions\2026-09-03-p2.sqlite` 를 만듦(패널 → 워커 → `connectNative` → `period.started` → SQLite). `tutor.ask` → `tutor.event` 는 실제 첫 호출 항목과 함께
- [x] 실제 `claude` 첫 호출 — **2026-09-03 완료** · 11:19 길 B `ask-once.mjs --i-accept-cost --model sonnet --word 생성자 --cli <claude.cmd>` → `answer.completed` 8.2초(sonnet · inferred · 1999-01-02-p1 임시 폴더) · 11:24:36 길 A Chrome 실전 — 2교시 Tiro 공유 탭 전사 33문단 → 문장 붙잡기 → `question.asked`(confused) → `answer.completed` 9초, 답이 전사 ts-057·058 을 인용해 "자료에 없다" 고 답함(질문이 fixture 짐작 문장이었기 때문 · 아래 3라운드 항목) — 원래 항목: 길 A: 수업 중 Tiro 전사로 낱말 붙잡기 / 길 B: `installer/windows/ask-once.mjs --i-accept-cost --word 생성자`(`b5d73e9` · 플래그 없으면 거부 · 1999-01-02-p1 · 임시 폴더) — 2026-09-03 사용자 "모두 승인" · `ANTHROPIC_API_KEY` 없음 = 구독 한도 사용(과금 아님) · `CLASSMATE_CLAUDE_CLI` 를 절대 경로로 두고 질문 1건(승인 뒤 · `installer/windows/smoke-host.mjs` 는 자식 환경에서 CLI 변수를 지우고 임시 데이터 폴더·1999년 교시 id 로 돌므로 스모크로는 실제 CLI 가 불리지 않음, 검토 수정 `ff74cf3`) · Chrome Web Store 업로드 · 코드 서명 인증서 구입 여부
- [!] `design/_to_delete/` 삭제 여부
- [!] `%TEMP%/ccsq`(스크래치 Rust target 폴더) 삭제 여부
- [ ] 같은 글인데 세그먼트 id 가 갈리는 경우 — 2026-09-03 11:48 실측: `ts-014 partial(len 238)` 뒤에 `ts-013 partial(len 238, 같은 글)` 이 오고 `ts-013` 만 final 이 됨(id 가 뒤로 감). 패널 재열기(11:48:13 `panel.opened`) 직후라 관찰기가 문단 번호를 다시 세는 것으로 보임. 워커는 (id 말고) 글 내용이 같은 최근 조각을 겹치지 않게 걸러야 함 → 3라운드 A 후속
- [ ] `src/background/router.ts` 에 NUL 바이트 2개가 소스에 그대로 들어가 git 이 이 파일을 이진으로 봄(`file` → data · `git diff` 가 내용을 안 보여 주고 텍스트 병합이 안 됨) — 전사 조각 지문을 `${segment.state}` + NUL + `${segment.text}` 로 적으면서 이스케이프(`\u0000`) 대신 진짜 제어 문자를 넣었기 때문(오프셋 10207 · 27604). 이스케이프로 바꿀 것. **3라운드 A 병합 뒤**에 고침(지금 고치면 A 브랜치와 이진 충돌)

## v0.2 — 근거 기반 세션 동반자

### Slice 1 — Evidence replay

- [x] V2-001 `SessionBundleV2`와 V1 호환 읽기 모델을 계약 패키지에 추가 — `3147dc1`
- [x] V2-002 호스트 `session.list`·`session.getSummary`·`session.bundle` 읽기 봉투와 시험 추가 — `5b0eb5b`
- [x] V2-003 프레임 id로 실제 `.jpg/.png/.webp`를 해결하는 asset manifest 추가 — `5b0eb5b`
- [x] V2-004 실제 SQLite 사건을 전사·질문·답·화면이 연결된 번들로 조립 — `5b0eb5b`
- [x] V2-005 report-ui가 V2 번들에서 독립 세션 HTML과 묶음 허브 생성 — 생성 `7f53595`, 출력 경계 `46ce7c0`, 시도 전 정답 원문 제외 `bc74019`
- [ ] V2-006 Chrome 완전 재시작 뒤 과거 세션 목록·상세 열기 — 확장 읽기·재시도·복원 코드는 `d0c8d56`, 실제 설치판 완전 재시작 관문은 남음
- [ ] V2-007 명시적 내보내기·삭제 UI와 보존 경계 추가
- [ ] V2-008 브라우저는 `sessionId`만 보내고 호스트가 앱 전용 staging에서 독립 HTML을 생성·원자 게시하는 보고서 경로 추가
- [ ] V2-009 시스템 Node·저장소 원본 없이 설치 묶음만으로 1 MiB 초과 세션과 실제 JPG 보고서 E2E 통과

### Slice 2 — Profiles, vision, five activities

- [x] V2-101 `class`·`exam`·`meeting` 프로필과 중립 레이블 추가 — `3e5db4e`
- [x] V2-102 `TutorResponseV2` 동적 섹션과 V1 답 어댑터 추가 — 계약 `3147dc1`, 읽기 어댑터 `5b0eb5b`
- [x] V2-103 다섯 슬롯 `ActivityCard`·시도·힌트·피드백·지연 변형 계약 추가 — `3147dc1`; 실제 생성 엔진은 V2-104에서 검증
- [x] V2-104 세 모드 비식별 합성 fixture와 결정적 다섯 활동 시험 추가 — `46d7ea2`
- [ ] V2-105 화면 픽셀에만 답이 있는 Claude/Codex 시각 E2E 관문 추가
- [x] V2-106 과거 세션에서 다섯 활동을 생성하고 시도·확신·힌트·정답 공개를 저장 ACK 뒤에만 진행 — 호스트 저장 `da3430c`, 확장 브리지 `7cc1e44`, 원문 보존 `67f38f9`, 화면 흐름 `4f82240`
- [ ] V2-107 활동 자기 수정·근거 기반 피드백·다음 회상 시각과 65분 세션 재진입 UX 검증

### Slice 3 — Codex provider

- [ ] V2-201 공식 Codex app-server handshake·인증·스트리밍 가짜 서버 시험 — `b4f9dd1`에서 fake handshake·스트리밍 완료, 공식 `account/read`와 실제 서버 확인은 남음
- [ ] V2-202 취소·시간 초과·로그인 실패·읽기 전용 안전 경계 추가 — `b4f9dd1`에서 fake 취소·시간 제한은 완료, 설치된 CLI의 제한 읽기 루트와 전역 설정 격리는 남음
- [ ] V2-203 Claude와 같은 텍스트·화면 골든 시험 통과 뒤 설정 활성화

### 공개·장시간 사람 관문

- [!] V2-H01 65분 한 세션과 하루 8교시 리허설
- [!] V2-H02 깨끗한 Windows 설치와 자기 Tiro·Claude·Codex 인증
- [!] V2-H03 합성 fixture·비밀·개인경로·의존성 라이선스 공개 감사
- [!] V2-H04 LICENSE 선택과 GitHub 공개 전환·push·배포 승인
