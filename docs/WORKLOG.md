# 작업 기록

형식: `## YYYY-MM-DD HH:MM — <한 줄>` 아래에 **변경 / 검증 / 위험 / 다음 행동** 네 줄.
변경이 없는 시간에는 `heartbeat` 한 줄만 남깁니다. 시각은 로컬(KST) 기준.
시간당 체크포인트 루프(/loop 1h)가 이 파일에 항목을 추가하고 로컬 커밋만 합니다. push 는 하지 않습니다.

## 2026-09-02 16:46 — Phase 0 완료: 저장소·규약·도구 고정, 스캐폴드 4개, 첫 커밋
- 변경: `git init -b main` · 규약 문서(AGENTS·CLAUDE·SECURITY·CONTRIBUTING·README) · docs(DECISIONS 10건·TASKS·WORKLOG·spikes 5종 초안: A 부분 PASS·C BLOCKED·B/C2/D 측정 예정) · `.claude/settings.json` + 서브에이전트 4개 · `.mcp.json` tiro(HTTP·OAuth) · pnpm 워크스페이스(루트 · `@classmate/browser-extension` WXT 0.21.4 듣는 중 화면 · `@classmate/contracts` 스키마 8종+생성기 · fixtures golden-ioc 두 갈래) · `apps/native-host` Rust hello 호스트 + `register-host.mjs`(dry-run 기본) · `rust-toolchain.toml`(gnu) · 검토자 지적 수정(fixtures 2번째 질문 파일 · 참조 무결성 테스트 4건 · payload additionalProperties · id 접두사 통일 · seq≥1 · anchor.segmentId 필수 · settings 권한 좁힘)
- 검증: `pnpm typecheck` exit 0 · `pnpm test` exit 0 (browser-extension 9 · contracts 55) · `cargo test` 14 passed · 호스트 exe ping → `{"type":"hello","protocol":1,"version":"0.1.0"}` exit 0 · 빌드 manifest 에 side_panel·sidePanel·storage 확인 · 비밀값 grep 0건 · git check-ignore 9항목 정상
- 위험: MSVC 링커 없음(gnu 고정 · rusqlite bundled 는 C 컴파일러 필요 → Phase 2 검토) · TypeScript 7.0.2 가 @types 전역을 자동 포함 안 함(패키지별 reference .d.ts) · settings.json ask 규칙 실제 매칭 미확인 · claude 2.1.252 < 권장 2.1.255 · Tiro MCP 승인·OAuth 미완(사람) · IntelliJ MCP 서버 꺼짐(사람) · Codex 한도 소진
- 다음 행동: Phase 1 Gate A — `apps/browser-extension` 에 공유 페이지 커넥터(MutationObserver · 확정/진행 구분 · arrivedAt 기록)를 fixtures 단위 테스트까지 구현하고 60분 관찰 하네스(`spikes/tiro-share-observe.mjs`)를 작성

- 2026-09-02 16:49 · heartbeat · 새 변경 없음 (직전 항목 16:46 와 커밋 b58269f 에 지난 1시간 내용 포함)

## 2026-09-02 18:15 — Phase 1 완료: 다섯 게이트 판정 문서·스파이크·제품 코드, 검증자 지적 수정, 비용 사고 1건
- 변경: Gate A 공유 페이지 커넥터(`src/tiro/` 파서·MutationObserver 관찰기·content script·MCP 스텁 · fixtures/tiro 합성 4종 · `spikes/tiro-share-observe.mjs`) · Gate B 캡처(`src/capture/` dHash·FrameStore·pipeline·WebP 인코더·SamplingLoop · offscreen 엔트리 · background 캡처 메시지 · manifest tabCapture·offscreen · `spikes/meet-capture-measure.mjs`) · Gate C 탐침(`spikes/intellij-mcp-probe.mjs` + 읽기 전용 허용 목록 `spikes/lib/intellij-readonly.mjs`) · Gate C2 Claude 어댑터(`spikes/provider-claude.mjs` + `lib/stream-json.mjs` · Codex 프로토콜 탐침 · Windows `.cmd` 래퍼 해제·타임아웃 트리 종료) · Gate D 세션 저장소(`apps/native-host` rusqlite =0.30.0 `winsqlite3` WAL · build.rs · 메시지 3종 · 복구 통합 테스트) · 문서(게이트 5종 판정 · DECISIONS 9건 추가 · TASKS · `docs/design-map.md`) · browser-extension 에 `@classmate/contracts` 워크스페이스 의존 추가 · 검증자 지적 A 4건·B 5건·C2 major 1+minor 1 수정
- 검증: `pnpm test` exit 0 (contracts 55 · browser-extension 87 · spikes 62) · `pnpm typecheck` exit 0 · `cargo test` 41 passed(lib 30·bin 9·통합 2) · clippy 0 · `node spikes/meet-capture-measure.mjs` exit 0(WebP 2.9/2.7/66.7/606.8 KiB · 1920×1080→1280×720) · 복구 손실 창 표본 최대 10ms(독립 회차 11ms) · `git diff --check` 통과 · 비밀값·Tiro URL grep: 시험용 가짜 `tiro.ooo/s/abcdef` 1건만(실제 링크 아님)
- 위험: **비용 사고** — Gate C2 검증 에이전트가 `provider-claude.mjs` 를 import 하는 순간 최상위 `main()` 이 실행되어 실제 `claude` 5회 호출, 승인 없이 1.251323 USD 지출(Claude 실측 누적 2.719340 USD). 모든 스파이크에 `import.meta.url === pathToFileURL(process.argv[1]).href` 진입점 가드를 넣어 차단하고 DECISIONS 에 공통 규칙으로 기록 · 골든 컨텍스트 기준 C2 재측정은 비용 승인 대기(BLOCKED) · Codex 한도 소진(BLOCKED) · IntelliJ MCP 서버 꺼짐(BLOCKED, 64342) · Tiro 실측 (a)(b)(c) 는 Real-time 공유 링크 필요(BLOCKED) · Meet 실제 탭 tabCapture 는 사람 손 시험 필요(BLOCKED) · Rust 빌드는 짧은 경로에서만(MAX_PATH) · background 의 `globalThis.classmateCapture` 임시 손잡이는 Phase 2 사이드패널 버튼 생기면 제거 · `%TEMP%/ccsq` 스크래치 target 삭제 여부 대기
- 다음 행동: Phase 2 준비 — contracts 고정 선언 · 스켈레톤 패키지(design-tokens·ui-base·ui-classmate·tutor-core·report-ui, native-host providers/transport 골격) · origin 은 `gh repo create` 허락 대기로 표시 → "Phase 2 준비 완료" 보고 후 예약된 `/batch` 1라운드(10단위) 실행

## 2026-09-02 18:36 — Phase 2 준비 완료: contracts 고정 · fixtures 번들 정의 · 스켈레톤(TS 5 + Rust 크레이트 2) · origin 대기
- 변경: `packages/contracts` 고정(`frozen.sha256` 스냅샷 · `test/frozen.test.ts` · `scripts/freeze.mjs`(진입점 가드) · README "고정 상태") · TS 스켈레톤 5개 `packages/{design-tokens,ui-base,ui-classmate,tutor-core,report-ui}`(package.json·tsconfig·vitest·src/index.ts·smoke 시험·README 에 정본 경로·1라운드 공유 규칙·완료 조건) · `apps/native-host` 를 Cargo 워크스페이스로(루트 `classmate-host` + `crates/providers` + `crates/transport` · README §7) · `fixtures/README.md` 에 교시 세션 번들 정의 · DECISIONS 2건(계약 고정·1라운드 구조 / 디자인 정본 적용 기본값) · TASKS Phase 2 준비 항목
- 검증: `pnpm install` exit 0 · `pnpm test` exit 0 (contracts 57 · design-tokens 2 · ui-base 3 · ui-classmate 2 · tutor-core 2 · report-ui 3 · browser-extension 87 · spikes 62 = 218) · `pnpm typecheck` exit 0 · `cargo test --workspace` 43 passed(41+1+1) · `cargo fmt --check` ok · clippy 0 · `sha256sum -c frozen.sha256` 8개 OK · `gh auth status` 로그인 확인 · `git remote -v` 비어 있음 · 비밀값·Tiro URL grep 0건
- 위험: origin 없음 → `/batch` 워커는 PR 대신 브랜치 `batch-1/<단위>` 만 남김(`gh repo create` 허락 대기) · `Cargo.lock` 워크스페이스 공유로 병합 충돌 가능(`cargo update -w`) · happy-dom 전역 URL 함정(UI 패키지 README 에 기록) · 단위 5·6·7·9 는 Phase 1 산출물 위에서 "완성·정리" 로 진행해야 함(새로 만들면 중복) · 워커가 제안 없이 `freeze` 로 스냅샷을 갱신하는 우회는 시험이 못 잡으므로 병합 리뷰에서 `frozen.sha256` 변경 여부를 본다
- 다음 행동: 사용자가 예약한 `/batch` 1라운드(10단위) 실행 — EnterPlanMode 로 계획(단위 10개·worktree·완료 조건·e2e 레시피)을 제시하고 승인 뒤 워커 10개를 띄움

## 2026-09-02 23:18 — /batch 1라운드: 10단위 전부 main 병합 · 전체 검증 통과 · 검토 1차(실재 8건) 수정 진행 중
- 변경: 승인된 계획대로 worktree `cc-wt/<단위>` 10개에서 워커 10명이 각자 브랜치 `batch-1/<단위>` 에 커밋 → main 에 `--no-ff` 병합(순서 1·4·10·2·3 → 5·6 → 9·7·8, lock 충돌 1회는 `pnpm install` 재생성). 단위별: design-tokens(17) · tutor-core(54) · report-ui(56, Playwright) · ui-base(65) · ui-classmate(88) · tiro-connectors(확장 122, 관찰기 class 감시 버그 수정) · meet-capture(확장 169, frame.store 봉투 + 1 MiB 가드) · transport(cargo 43, 손 검증기, exe 왕복) · session-store(cargo 65, frames 표·복구) · providers(cargo 41, 실제 CLI 0회). fixture 프레임 경로를 계약 (가) 모양으로 고침(`5484f2d`). TASKS·DECISIONS·native-host README §6 갱신.
- 검증(main): `cargo test --workspace` 149 passed · `cargo clippy --workspace -- -D warnings` 0 · `cargo fmt --check` ok · `pnpm test` 568 passed(design-tokens 17 · contracts 57 · ui-base 65 · tutor-core 54 · browser-extension 169 · report-ui 56 · ui-classmate 88 · spikes 62) · `pnpm typecheck` 0 · `node apps/native-host/scripts/host-roundtrip.mjs` hello 수신 · `packages/contracts` 무변경(frozen 시험 통과) · 비밀값·Tiro 공유 URL grep 0(패턴 설명 문구 제외).
- 위험: 1파 검토 워크플로(에이전트 20)에서 실재 8건 — tutor-core 의 `at` 파싱 오류 삼킴·`import type` 강제 시험 구멍, report-ui 의 카드 그림자·프레임 경로 평평화·프레임 40px, ui-base 아이콘 맵이 classmate/ui_kits 이름을 빠뜨림(고정 계약 (나) 미준수), ui-classmate 문구 시험이 형제 시험 파일을 읽음 → `batch-1-fix/<pkg>` 4개에서 수정 중. 2파 검토 워크플로 진행 중. origin 없음(`gh repo create` 대기). 골든 시나리오 사이드패널 재현·스크린샷(goal 항목 3)은 2라운드 몫.
- 다음 행동: 수정 브랜치 4개 병합 → 2파 검토 발견 수정 → 전체 재검증 → worktree 정리 → §9 보고 후 사용자의 2라운드 프롬프트 대기

## 2026-09-03 00:05 — /batch 1라운드 완료: 검토 1·2파 실재 21건 수정 9브랜치 병합 · 전체 재검증 통과 · worktree 정리
- 변경: 검토 2파(에이전트 26) 실재 13(high 2: `clock.rs` 바이트 슬라이스가 `at` 값 하나로 호스트 패닉) · 반박 8 · 낮음 28 → 수정 워커 5명(tiro `75db8b6` · capture `46da1d1` · session-store `c37a148` · providers `2af101b` · transport `15527f0`) + 1파 잔여 ui-classmate `4a2a0bb` 를 main 에 `--no-ff` 병합(`4b096ec`…`83957e3`) · native-host README §1 오류 응답 표를 네 칸 통일에 맞춤(`516cf4b`) · 검토 기록 `docs/reviews/batch-1-review.md`(실재/낮음/반박 84건 표, 처리 상태) · TASKS 1라운드 `[x]` + 보류 11건 후속 · DECISIONS 2건(검토 워크플로·1파 규칙 / 2파 규칙: 프레임 id·이벤트 id·오류 네 칸·봉투 표)
- 검증(main `83957e3`): `pnpm install --frozen-lockfile` ok · `pnpm test` 664 passed(design-tokens 17 · contracts 57 · ui-base 73 · tutor-core 71 · browser-extension 214 · report-ui 74 · ui-classmate 96 · spikes 62; 1라운드 병합 직후 568) · `pnpm typecheck` 0 · `cargo test --workspace` 175 passed(host 58+14+4 · providers 32+11+5+1 · transport 47+3; 이전 149) · clippy `-D warnings` 0 · fmt ok · `node --test scripts` 42 · `host-roundtrip.mjs` hello · `report-ui generate` hub+period-3+frames 2 · `meet-capture-measure.mjs` exit 0 · 비밀값·Tiro URL grep 0 · `git diff --check` 0 · 실제 claude/codex 호출 0
- 위험: 검토 낮음 11건 보류(design-tokens 생성기 중복 선언·표본 시험, tutor-core EXIT_RECALL/DELAYED_CHECK 잔여 상태, report-ui 모서리·전사 서체, ui-classmate 안 쓰는 의존) · 프레임 id 유일성 1초 단위 · `store_failure` reason 이 고정 낱말 아님 · Tiro seq 뒤집힘은 세션 스토어 정렬에 의존 · ui-classmate 의 internal/base 복제는 2라운드 barrel 교체 전까지 두 벌
- 미결·블로커(사람 결정 '대기'): origin 없음(`gh repo create` 대기, 브랜치 `batch-1/*` 10 + `batch-1-fix/*` 9 는 로컬만) · Tiro 실제 공유 페이지·Meet 탭·IntelliJ 실측 대기 · Gate C2 골든 컨텍스트 재측정 비용 승인 대기 · 골든 시나리오 사이드패널 재현·스크린샷(/goal 3)은 2라운드(사이드패널·통합) 몫
- 다음 행동: 사용자의 2라운드 `/batch` 프롬프트(사이드패널·통합 4단위) 대기 — 그때까지 push·배포·공개 전환 없음

## 2026-09-03 00:39 — /goal (3) 골든 시나리오 사이드패널 재현: fixture 재생기 + 듣는 중·자세히 화면 + Playwright 9장면 스크린샷
- 변경: `apps/browser-extension/src/panel/`(golden-bundle 로더 · evidence 대응표 · clock · transcript-lines · `ReplayStore`(모의 제공자 · 체크포인트 9종) · lesson-view · ListeningScreen/DetailScreen · replay-handle · PanelApp) · `entrypoints/sidepanel/{App,main,style}` 를 design-tokens → ui-base → ui-classmate CSS 순서로 갈아끼움 · `e2e/extension.spec.ts` 를 skip 골격에서 실제 확장 로드 E2E 로(체크포인트마다 확인 + `docs/screenshots/golden-0N-*.png`, `animations: 'disabled'`) · 확장 package.json 에 워크스페이스 의존 5개 · 시험 4파일 50건 · docs(screenshots README · 앱 README 전면 · architecture·privacy 초안 · TASKS · DECISIONS)
- 검증: `pnpm --filter @classmate/browser-extension build` exit 0(`.output/chrome-mv3`, side_panel) · `pnpm … e2e` 10 passed(1.6s, 콘솔·페이지 오류 0) · `pnpm test` exit 0 — 714 passed(design-tokens 17 · contracts 57 · ui-base 73 · tutor-core 71 · ui-classmate 96 · spikes 62 · report-ui 74 · browser-extension 264; 직전 664) · `pnpm typecheck` exit 0 · `cargo test --workspace` exit 0 — 175 passed(host 58+14+4 · providers 32+11+5+1 · transport 47+3) · 스크린샷 9장 눈으로 확인(01·06 은 fade-in 도중 찍혀 빈 화면 → `animations: 'disabled'` 로 재촬영 뒤 정상) · `git diff --check` 0 · 비밀값·Tiro URL grep 0 · 실제 claude/codex 호출 0
- 위험: fixture 4번째 `state.changed` 시각(10:33:09)과 기계(`period.ended` 10:33:14) 불일치는 시험에서 from·to 만 대조 · 화면은 2개(듣는 중·자세히)뿐이고 기록·설정 화면과 상태 G 는 2라운드 · 실제 커넥터 미배선(`ReplayStore.pushEvent` 자리) · ui-classmate `internal/base` 복제 두 벌 · 강조 줄은 `"= new "` 문자열 검색이라 fixture 편집기 발췌에만 맞음 · 시험 실행 시간이 늘어 `pnpm test` 는 `--maxWorkers=2` 권장(RAM)
- 미결·블로커(사람 결정 '대기'): origin 없음(`gh repo create` 대기, push 없음 · 브랜치 `batch-1/*` 10 + `batch-1-fix/*` 9 는 로컬만) · Tiro 실제 공유 페이지 · Meet 탭 · IntelliJ 실측 대기 · Gate C2 골든 컨텍스트 재측정 비용 승인 대기 · Codex 한도 소진 · Web Store · 배포 · 공개 전환 없음
- 다음 행동: 사용자의 2라운드 `/batch` 프롬프트(side-panel 마무리 · context-builder · service-worker · installer) 대기 — 그때까지 push · 배포 · 공개 전환 없음

## 2026-09-03 08:42 — /batch 2라운드 진행: 9단위 전부 main 병합 · 통합 A/B/C · 전체 검증 통과 · 문서 1차 · worktree 정리 · 검토 4명 진행 중
- 변경: 선커밋 `22f4058`(Cargo 의존 2 · `src/router.rs`·`src/tutor/` 자리 · `ports.ts` 고정 계약 (다)) 뒤 worktree `cc-wt/<단위>` 9개의 브랜치 `batch-2/<단위>` 를 main 에 `--no-ff` 병합(host-core `6fb413d` · ui-base-swap `6ddb99f` · panel-live-store `001846d` · service-worker `a6916a0` · providers-round2 `414572c` · context-builder `7ff0747` · sidepanel-screens `8c85101` · installer-windows `2d7e175` · design-compare `4b528e9`) · 통합 A `9d47d64`(`Router::tutor` → 교시별 `TutorPipeline` · `TutorSources` 는 `CLASSMATE_CLAUDE_CLI`/`CLASSMATE_TUTOR_MODEL` 환경 변수로만 · `unknown-question` · Drop 이 손잡이 shutdown · 자료는 `with_materials` · providers 트레일러가 튜터 JSON 지시와 부딪히던 것 수정 · 라우터 시험 4건) · 통합 B `71036de`(`App.tsx`: `?replay=` 없으면 설정을 읽어 `ReplayStore.live` + `attachLive(chrome.runtime)` · 교시 id 는 서비스 워커와 같은 `makePeriodId` · 바닥줄 다시 연결 → `live.reconnect` · fixture 실시간은 `?replay=auto`) · 통합 C `9afdd24`(비교 스크립트 G 는 answer → 바닥줄 클릭, H-1 은 `classmateConnector` 손잡이로 실제 캡처 · 비교 이미지 9장 재생성 · `docs/first-class.md` 병합 전 문단 제거) · 문서 `5f33d7f`(DECISIONS 2026-09-03 세 항목: 고정 계약 (다)~(바) · 워커 9단위 결정 · 통합 결정 / TASKS 완료·후속·대기 / architecture §1·2·4·5·6 / gate-c2 CLI 인자 5 · gate-d 주석) · worktree 9개 제거(브랜치 `batch-2/*` 9 는 남김 · `cc-wt/` 에 node_modules 잔여 폴더 6개 남음)
- 검증(main `5f33d7f`): `pnpm test` 844 passed(design-tokens 17 · contracts 57 · ui-base 74 · tutor-core 71 · ui-classmate 78 · report-ui 74 · browser-extension 411 · spikes 62; 직전 714) · `pnpm typecheck` 0 · `cargo test --workspace` 254(host 105 · recovery 7 · 4 · tutor_pipeline 11 · providers 48+13+5+1 · transport 54 · doctest 2+4; 직전 175 · 전용 `_target_main`) · clippy `-D warnings` 0 · fmt 0 · 확장 build 0(manifest permissions `sidePanel, storage, tabCapture, offscreen, nativeMessaging, alarms`) · e2e 16 passed(스크린샷 14장 · `golden-09` 1바이트 타이밍 차는 되돌림) · `node --test` host scripts + installer 99 · compare 24 · `host-roundtrip.mjs` hello · `build-host.mjs` → `dist/classmate-host.exe` 1,829,636 B · `smoke-host.mjs` ① hello ② `error/provider-unavailable`(실제 CLI 호출 0) · `package-extension.mjs` dev `key=있음` / store `key=없음` · `install.mjs` dry-run(reg add 계획만 출력) · `compare-design.mjs` 정본 9/9 · 구현 9/9(H-1 `footerPaused: true` · G/H-1 PNG 눈으로 확인) · report-ui generate · meet-capture-measure · `git diff --check` 0 · 비밀값·Tiro URL grep 0 · 워커 9 브랜치 모두 `docs/DECISIONS·WORKLOG·TASKS`·contracts·fixtures 무변경 · `git status --short` 비어 있음
- 위험: 공유 `CARGO_TARGET_DIR` 이 worktree 끼리 rlib 을 덮어써 워커 5·6·7 이 시험 어긋남을 겪음(main 은 `_target_main` 전용 · DECISIONS 통합 (6)) · transport 대조 시험이 `router.rs` 주석의 따옴표 이름 뒤 화살표까지 세어 통합 A 가 두 번 실패(문구 변경) · `Body` 삽입이 `Sealed` 의 `#[derive(Clone)]` 을 가로채 1회 컴파일 실패(즉시 수정) · 교시가 바뀌어도 호스트 손잡이를 닫지 않음(하루 8 스레드 허용 · TASKS) · 설정 변경(교시·제공자)은 패널 재열기 필요 · "오늘 기록 지우기" 미배선 · 서비스 워커 메모리 상태 손실 범위와 FIFO 응답 대응은 검토 결과 대기 · 실제 Chrome 왕복은 레지스트리 등록 뒤에만 가능 · 검토 4명(확장 패널 · 확장 background/live · 호스트 · installer/문서, opus)이 아직 보고 전
- 미결·블로커(사람 결정 '대기'): 레지스트리 등록 `install.mjs --apply` · 깨끗한 Win11 VM 설치 1회 · 65분 리허설 · Chrome 안 실제 확장 ↔ 도우미 왕복 · 실제 `claude` 첫 호출(비용 승인) · Tiro 결제/OAuth · Meet 탭 · IntelliJ 실측 · Drive 요청 · origin(`gh repo create`) · Web Store · 코드 서명 · Codex 한도 — push · 배포 · 공개 전환 없음
- 다음 행동: 검토 4명 보고 → 반박 검증 → 실재만 수정·병합 → `docs/reviews/batch-2-review.md` · WORKLOG 완료 항목 → /goal 재확인(`pnpm test`·`cargo test` exit 0 · 스크린샷 · `git status --short` 비어 있음) → §9 보고

## 2026-09-03 10:24 — /batch 2라운드 완료: 검토 4명 65건 → 수정 워커 4명(실재 60 수정 · 보류 5 · 반박 0) · main 병합 4 · 전체 검증 통과 · 문서 정리 · worktree 정리
- 변경(08:42 항목 이후): 검토 4명 보고(패널 10 · background/live 19 · 호스트 14+문서 3 · installer/문서 22→19, 높음 10) → worktree `cc-wt/fix-<영역>` 4개에서 수정 워커 4명(opus)이 발견마다 반박을 먼저 시도하고 실재만 되돌리면 실패하는 시험과 함께 수정 → main `--no-ff` 병합: ext-panel `b855642`→`d42dfca`(순간 중복 · 옛 질문 답 얹힘 · IntelliJ 나이 · 배선 안 된 설정 3종 잠금 · `ReplayStore.updateEnv` · 뷰포트 정리 · happy-dom DOM 시험) · installer-docs `8047f96`→`ae4f8f4`(스모크 자식 환경에서 CLI 변수 제거 + 임시 데이터 폴더 + 1999년 교시 id · dev key 없으면 exit 1 · 비교 정본 전멸 exit 1 · first-class §3-3 `reg` 우선 · 문서 실측 맞춤 · engines `>=24`) · ext-bg `566d2cf`→`e847c61`(교시 전환 겹침 잠금 · 프레임 한 통 `frame-port.ts` · `session-area.ts` 로 라우터 상태 복원 · 오프라인 질문 `question.asked` · FIFO 문지기 · `panel.ask` 칸 검사 · `storage.local` 폴백 제거 · push periodId 대조) · host `7254465`→`76a8f13`(라우터 시험 `TutorSources::default()` + `no_real_cli_root` 가 `router.rs` 까지 · `word` 4096 · `store_failure` reason 낱말 · 끝난 질문 retry `unknown-question` · 수동 재시도가 자동 횟수 안 소비 · 자식 대기 마감 `wait_until`+`kill_tree` · `stopping` · 1 MiB 초과 push 생존 · 스크레이퍼 본문 한정 · 봉인 프레임만 셈 · 문서 경로 4곳) · 확장 README `173663d`·`e5869ae` · TASKS `de0b2b9`·`0285e7f` · 문서 `1bf05b0`(정본 `docs/reviews/batch-2-review.md` · DECISIONS 2026-09-03 검토 후속 규칙 · TASKS reviewer 완료 + 보류 5 이월 · 비교 이미지 9장 재생성) · fix worktree 4개 제거(브랜치 `batch-2-fix/*` 4 는 남김 · `cc-wt/` 잔여 node_modules 3개 삭제)
- 검증(main `76a8f13`, 10:10~10:22): `pnpm test` 893 passed(design-tokens 17 · contracts 57 · ui-base 74 · tutor-core 71 · spikes 62 · ui-classmate 78 · report-ui 74 · browser-extension 460; 직전 844 — 첫 루트 실행 때 spikes 1파일 4건이 호스트 워커의 cargo 빌드와 겹쳐 흔들렸고 단독·재실행 모두 통과) · `pnpm typecheck` 0 · 확장 build 0(permissions `sidePanel, storage, tabCapture, offscreen, nativeMessaging, alarms` · key 없음) · e2e 16 passed(`golden-09` 1바이트 타이밍 되돌림) · `cargo test --workspace` 264(host 109 · no_real_cli_root 7 · recovery 4 · tutor_pipeline 14 · providers 48+14+5+1 · transport 56 · doctest 2+4; 직전 254 · `_target_main`) · clippy `-D warnings` 0 · fmt 0 · `host-roundtrip.mjs` hello · `node --test` 139 pass · `build-host.mjs` → `dist/classmate-host.exe` 2,523,918 B · `smoke-host.mjs` ① hello ② `error/provider-unavailable`(자식 환경에서 CLI 변수 제거 · 교시 `1999-01-01-p1` · 임시 폴더 = 실제 CLI 호출 0) · `package-extension.mjs` dev `key=있음` / store `key=없음`(3,305,256 B) · `install.mjs` dry-run(reg add 계획만) · `compare-design.mjs` 정본 9/9 · 구현 9/9(A 화면 눈으로 확인: 구현 바닥줄 `IntelliJ —`) · report-ui generate · meet-capture-measure · `git diff --check` 0 · 비밀값·Tiro URL grep 0(수정 브랜치 4개) · 수정 브랜치 4개 모두 소유 경로 안 · `docs/DECISIONS·WORKLOG·TASKS`·contracts·fixtures 무변경 · 새 의존성 0 · `git status --short` 비어 있음
- 위험: 실제 설치본에는 Meet 캡처 시작 버튼이 아직 없음(콘솔 손잡이만 · README 명시) · 설정의 답변 길이·캡처 3칸·오늘 기록 지우기는 잠금 · 교시·주제 변경은 패널 재열기 · 워커 재기동 사이 같은 전사 문단이 한 줄 더 남을 수 있음(`seenSegments` 미보존) · 재시도 간격표 두 벌의 정본 미결(기본 설정에선 동일) · 워커 스레드 패닉 뒤 손잡이 재기동 없음 · `tutor.accepted` 선행 순서 미보장(확률 매우 낮음) · 비교 이미지 캡션 sha 는 코드 마지막 커밋 `76a8f13`(문서 커밋보다 하나 뒤) · 루트 `pnpm test` 는 cargo 빌드와 겹치면 spikes 가 흔들릴 수 있음(조용할 때 돌릴 것)
- 미결·블로커(사람 결정 '대기'): 레지스트리 등록 `install.mjs --apply` · 깨끗한 Win11 VM 설치 1회 · 65분 리허설 · Chrome 안 실제 확장 ↔ 도우미 왕복(dev zip id = `extension-key.json` id 확인 포함) · 실제 `claude` 첫 호출(비용 승인 · 스모크는 이제 실제 CLI 를 부르지 않음) · Tiro 결제/OAuth · Meet 탭 실측 · IntelliJ MCP 켜기 · Drive 요청 · origin(`gh repo create`) · Web Store · 코드 서명 · Codex 한도 · Gate C2 재측정 비용 — push · 배포 · 공개 전환 없음
- 다음 행동: /goal 재확인(`pnpm test`·`cargo test` exit 0 · 스크린샷 14+9 · `git status --short` 비어 있음 · 이 항목의 미결 목록) 결과와 함께 §9 보고 → 사람 '대기' 항목 실행 결과를 기다림. 다음 라운드 후보는 TASKS "2라운드 후속"

## 2026-09-03 10:59 — 실측 2/13(레지스트리 등록 · Chrome 실제 왕복) · 회고 정본 · 대시보드 9탭 · ask-once.mjs · 매시간 루프 교체 · 첫 세션 스냅샷
- 변경: `docs/retrospective.md` 신설(`7b36a38` · 잘 된 것 10 · 사고 12 · 되풀이 함정 · 숫자 · 하네스 후보 16 · 다음 라운드 변경 9) · `installer/windows/ask-once.mjs` + 시험 6 + README §9(`b5d73e9` · `--i-accept-cost` 없으면 거부 · 1999-01-02-p1 · 임시 폴더 · 180초) · 진행 대시보드를 9탭(로드맵 · 지금·다음 · 내가 할 일 · 논의·정렬 · 워크플로 · 기능 명세 · 사용자 여정 · 화면 지도 · 회고)으로 확장해 같은 URL 로 재배포 — 제품 절 5개는 워커가 저장소 문서에서 초안 → sonnet 워커 5명이 파일·줄을 다시 열어 대조(항목 281 · 미확인 2) · 매시간 루프를 "kdh-save-session → `.kdh-sessions/` + WORKLOG + 로컬 커밋" 으로 교체(cron `1389d937`, :07) · 첫 스냅샷 `.kdh-sessions/corthex-classmate/` · TASKS(레지스트리 `[x]` · Chrome 왕복 `[x]` · 첫 호출에 길 A/B · Phase 3 에 텍스트 입력창) · DECISIONS 실측 단계 운영 규칙 · 메모리에 "서브에이전트 fable 금지" 저장
- 검증: `node --test installer/windows/*.test.mjs` 72 pass(ask-once 6) · `node installer/windows/ask-once.mjs` 플래그 없이 exit 1(아무것도 띄우지 않음) · `--help` 출력 · 대시보드 인라인 스크립트 `new Function` 구문 검사 통과 · `git diff --check` 0 · **사용자 실측**: `node installer/windows/install.mjs`(dry-run) → `--apply` → `reg query HKCU\…\com.corthex.classmate` 가 매니페스트 경로를 가리킴 · dev 확장(id `meldoohgnggckjahcchmfjnngpafcjon`) 얹고 사이드패널 '수업 · 2교시' 를 열자 `%LOCALAPPDATA%\CorthexClassmate\sessions\2026-09-03-p1.sqlite`(10:48) · `2026-09-03-p2.sqlite`(10:49) 생성 = Chrome → 레지스트리 → exe → `period.started` → SQLite 왕복 · 바닥줄에 '로컬 도우미와 잠시 끊겼어요' 없음
- 위험: 대시보드 첫 워크플로가 `model` 생략으로 세션 모델(fable)을 물려받아 중단·재실행(끝난 초안 4개 재사용 · 남은 5단계 sonnet) — 규칙으로 굳힘 · 근거 대조에서 요구 §3-7 "자세히 화면 자유 텍스트 입력창" 미구현과 라이브 점선 낱말 원천 없음이 드러남(TASKS) · 세션 스냅샷은 긴 경로에서 `WinError 206` → 짧은 경로 필수 · 실제 첫 호출은 `.cmd` 래퍼를 도우미가 푸는 경로라 첫 실행 때 stderr 를 봐야 함 · 대시보드 본문에 `&lt;` 1건 잔존(사소)
- 미결·블로커(사람 결정 '대기'): 실제 `claude` 첫 호출 — 길 A(수업 중 Tiro 전사) / 길 B(`ask-once.mjs`) 선택과 비용 승인 대기 · '논의·정렬' 탭 결정 6건(재시도 표 정본 · 캡처 버튼 자리 · Phase 3 시작 시점 · 교시 중간 변경 · 텍스트 입력창 · 첫 호출 비용 상한) · 나머지 대기 11건(VM·리허설 · Tiro OAuth/결제 · Gate A/B/C 실측 · C2 비용 · Drive · origin · Web Store · 서명 · Codex) — push · 배포 · 공개 전환 없음
- 다음 행동: 사용자가 길과 승인을 정하면 `ask-once.mjs --i-accept-cost` 실행을 안내하고 결과(answer.completed 한 줄 · 소요 · 비용)로 TASKS·대시보드 '내가 할 일' 3번을 갱신

## 2026-09-03 11:10 — 사용자 "모두 승인" · 비용 전제 정정(구독 한도 · API 키 없음) · 오늘 바로 쓰는 절차 안내
- 변경: 사용자가 '논의·정렬' 결정 6건과 실제 claude 첫 호출을 모두 승인 → 대시보드 답 칸 채우고 재배포 · `ask-once.mjs`·README §9·TASKS·회고의 "돈이 듭니다/1.25 USD 지출" 을 "구독 한도 사용 · `total_cost_usd` 는 참고 숫자" 로 정정(이 PC 에 `ANTHROPIC_API_KEY` 없음 실측) · 오늘 바로 쓰는 절차(setx 2개 → Chrome 재시작 → ask-once → 수업 때 Tiro 공유 탭 + 패널) 안내
- 검증: `[ -n "$ANTHROPIC_API_KEY" ]` → no · `docs/spikes/gate-c2-provider.md` 의 비용 표가 `result.total_cost_usd` 합임을 확인 · `node --test installer/windows/ask-once.test.mjs` 6 pass · `git diff --check` 0
- 위험: 세션 모델(fable) 한도 소진으로 오케스트레이터 응답이 끊길 수 있음 — 진도는 WORKLOG·`.kdh-sessions/`·대시보드에 있음 · 실제 첫 호출은 이 세션 안에서 돌리면 `CLAUDECODE=1` 중첩 차단에 걸리므로 사용자 PowerShell 에서 · 라이브 전사에는 점선 낱말이 거의 없어 문장 클릭·Alt+S 로 물어야 함
- 미결·블로커: 첫 호출 결과(answer.completed 한 줄) 보고 대기 · Meet 캡처 버튼·복습 페이지는 3라운드
- 다음 행동: 첫 호출 결과를 받으면 TASKS `[x]` · 대시보드 '내가 할 일' 3번 완료 → /batch 3라운드 계획(텍스트 입력창 · 점선 낱말 원천 · 캡처 버튼 · Phase 3)

## 2026-09-03 11:11 — heartbeat · 변경 없음 (사용자의 ask-once.mjs 첫 호출 결과 대기 · 세션 스냅샷만 갱신)

## 2026-09-03 11:32 — 실제 첫 호출 성공(ask-once 8.2초 · Chrome 실전 9초) · 실측 결함 6건 · 3라운드 워커 시작
- 변경: `docs/TASKS.md` 첫 호출 항목 `[x]`(관측값 포함) · 결함 6건을 항목으로 추가 · 대시보드(실측 단계 done · 내가 할 일 3·4번 done · 발견 3건 · 지금 문단) 재생성·재배포 · worktree `cc-wt/live-quality`(`batch-3/live-quality`) · `cc-wt/panel-ask`(`batch-3/panel-ask`) 생성
- 검증: `%LOCALAPPDATA%\CorthexClassmate\sessions\2026-09-03-p2.sqlite` events 74건 — `connector.status tiro-share connected` 11:20:46 · `transcript.segment` ts-025~057 final · `question.asked` 11:24:27(confused, q-2026-09-03-p2-x9fb2ccfb-001) · `answer.completed` 11:24:36 provider claude(결론 "자료에는 new 직접 생성 관련 설명이 없어서 확인할 수 없어요") · ts-058 partial·partial·final 3회 append · `paused hint-class-partial` 11:27:19 → connected 11:29:02 → `paused selector-broken` 11:29:34 ; 사용자 PowerShell `ask-once.mjs --cli <claude.cmd>` 출력 `+8.2s answer.completed` · 성공 · 프레임 3개 ; 사용자 스크린샷 — 기록 1 · 자세히 화면 시각 02:20:46 · 후속 칩 3개가 결론 되풀이
- 위험: 수업 중 확장을 갈아끼우면 사용자가 chrome://extensions 리로드 + 공유 탭 F5 를 해야 함 → 병합·커밋까지만 자동, 리로드 시점은 사용자 · 세션 모델 한도(fable) 소진 임박 — 진도는 이 파일·TASKS·`.kdh-sessions/`·대시보드에 있음
- 미결·블로커: 3라운드 A·B 보고 대기 · Meet 캡처 버튼 · 복습 페이지 · selector-broken 원인은 DOM 로그가 있어야 알 수 있음
- 다음 행동: 워커 보고 → opus 검토 → 병합(`git merge --no-ff`) → 전체 검증 → 로컬 커밋 → 대시보드 재배포

## 2026-09-03 11:36 — 낱말 붙잡기 경로는 이미 좋다(실측) · 문장 경로만 더미
- 변경: 없음(기록만). 3라운드 워커 A·B 는 실행 중.
- 검증: 2교시 sqlite 사건 89건 — 11:32:45 `question.asked` kind=confused word="생성자" text="생성자 이 무슨 뜻이에요?" → 11:32:56 `answer.completed`(11초) 결론 "생성자는 객체 만들 때 자동으로 값 채워주는 특수 메서드예요." · `details.teacherSaid` "기본 생성자와 모든 매개변수 있는 생성자, 게터 세터까지 만들어주면 된다고 했어요." · `details.why` 가 자료에 없는 부분을 밝힘 · `chips` 2개가 수업 맥락("기본 생성자랑 매개변수 생성자 차이가 뭐예요?"). 즉 **낱말 붙잡기는 질문 문장을 낱말에서 만들어 보내므로 이미 제대로 돕니다.** 11:24 문장 붙잡기가 헛돈 것은 짐작 라벨이 fixture 고정이었기 때문(3라운드 B1 이 고침).
- 위험: 11:32:35 `paused hint-class-partial` → 11:32:37 `connected` 로 전사가 짧게 끊김(3라운드 A4 진단 로그 대상) · 사용자 화면의 인용 시각 "Tiro 02:32:40" 이 UTC 로 보이는 것을 두 번째로 확인(결함 4).
- 미결·블로커: 워커 A·B 보고 대기.
- 다음 행동: 보고 → 반박 검토 → 수정 → 병합 → 전체 검증 → 대시보드 재배포.

## 2026-09-03 11:47 — 라이브 점선 낱말을 전사에서 뽑는다(수업 중 급한 수정)
- 변경: `apps/browser-extension/src/panel/live-terms.ts` 신설(우리말 기술 용어 사전 60여 개 + 대문자 약자 + 가운데 대문자 낱말 + `@어노테이션` + 소문자 Java 예약어 · 조각 수/마지막 길이로 memo) · `replay-store.ts` `lines()` 가 라이브에서만 이 목록을 쓰고 재생은 `GOLDEN_TERMS` 유지 · 시험 7건
- 검증: `pnpm --filter @classmate/browser-extension test` 468 pass(34 파일) · `typecheck` exit 0 · `build` 3.61 MB 성공 · 실제 3교시 문장으로 확인 — "의존성 주입 | 컴포넌트 | 레포지토리" · "@Autowired | AOP | 빈 | 프록시" · "new | 의존성 주입" · "ApplicationContext | 오토 와이어드" · "DTO | 생성자 | 게터 | 세터"
- 근거: 3교시 sqlite 를 15초마다 읽어 확인 — 11:34~11:41 전사가 partial→final 로 정상 도착(실시간은 문제 없음). 못 붙잡은 이유는 `GOLDEN_TERMS` 가 ["new","생성자"] 두 개뿐이어서였음. 2교시 종료는 11:33:55 `period.ended` 로 기록되어 그 뒤 사건은 3교시 파일로 감.
- 위험: 3라운드 워커 B 가 같은 `replay-store.ts` `lines()` 근처를 만지면 한 줄 충돌 — 병합 때 라이브 분기를 살리는 쪽으로 해결 · 적용하려면 사용자가 확장을 새로고침해야 함(수업 중이면 쉬는 시간에)
- 다음 행동: 워커 A·B 보고 → 검토 → 병합.

## 2026-09-03 12:51 — 3라운드 검토·수정 완료(미병합) · 조사 3건 · 화면 설계 판정 · 백업 위험 발견
- 변경: main 무변경(`252e217`). 워커 브랜치에 수정 커밋만 — `batch-3/live-quality` `360c2ec`(A: 라우터 재전송 걸름 시험 · `toLocalIso` +09:00 · 기록 바닥줄이 커넥터 형편 반영 · 선택자 깨짐 DOM 모양 진단 로그 · 「다시 연결」 회복 범위를 사실대로 정정) · `batch-3/panel-ask` `de9440e`(B: 라이브 짐작 · 이어 묻기 · `pushSegment` 갈아끼우기 · 자세히 화면 입력창). 두 워크트리 모두 clean.
- 검증: 워크플로 4건 완료 — 3라운드 구현·검토·수정(에이전트 6 · 54분) · 라이브 영상 가능성 조사(36 · 27분) · 목적 대비 산출물 판정(33 · 21분) · 화면 3안 겨루기(16 · 19분). A 자체 검증 `pnpm test` 498 pass · typecheck · build 3.61 MB · e2e 16 pass 모두 exit 0.
- 발견(반박 검증을 통과한 것만):
  1. **사이드패널에서 `chrome.tabCapture` 를 켤 수 없음.** activeTab 을 부여하는 자리는 action 클릭 · 컨텍스트 메뉴 · commands 단축키 · omnibox 넷뿐이고 사이드패널은 없음. Chromium 40926394 Won't fix(2023-08-17) · 40916430 Won't Fix / Intended(2025-11-11). 캡처 시작 경로를 단축키나 아이콘으로 바꿔야 함.
  2. **프레임이 모델에 가지 않음.** `apps/native-host/src/tutor/materials.rs:170` 이 "화면 프레임 N장" 글자만 넣고, `.webp` 를 다시 읽는 프로덕션 코드가 0줄. 실수업 DB 3개 모두 `frames` 0행(한 번도 시도된 적 없음).
  3. **교시 종료 후 4상태(EXIT_RECALL·FEEDBACK·FADE_SUPPORT·DELAYED_CHECK) 도달 불가.** `kind:"next"` 를 보내는 코드가 확장에 0줄.
  4. `out/2026-09-03` 이 `out/2026-09-02` 와 바이트까지 동일(38,893 B) = 픽스처 재출력. 실수업 데이터로 만든 복습자료 0회.
  5. **원격 저장소 없음 — 커밋 162개가 이 PC 한 대에만 있음. 현재 최대 위험.**
  6. 전사 갱신 주기 정정: 확정 문단이 약 10초가 아니라 **진행 중 문단이 약 0.1초 간격**으로 도착하고 패널이 그것을 버리는 중(B 가 고침). 앞선 기록의 "10초마다" 는 확정 문단만 센 것.
  7. 문서-코드 불일치: `docs/privacy.md` §2 는 제공자에게 "최신 장면" 이 간다고 적었으나 코드는 장 수만 보냄 · `apps/browser-extension/src/capture/README.md` 두 곳(간격 규칙 한 곳뿐 · `skippedWhileBusy`)이 코드와 어긋남.
- 판정(화면 3안): **「조용한 한 단」 15점 채택** · 위아래 두 칸 13 보류 · 별도 넓은 창 11 탈락(모니터 1대면 질문마다 Meet 을 가려야 함 · 근거 없는 조건에 생사가 걸림). 좌우 2단은 380px 에서 한 단 164px = 한글 8.6자이고 확장이 패널 폭을 못 정해 영구 불가(520px 로 늘려도 12.3자). 낱말 지목 폐기의 벗어남은 코드 238/5,414줄(4.4% · 재사용 95.6%) · 계약 변경 0건 · `docs/master-prompt.md:245`·`:252` 두 줄만 정면 위반. 덤: 질문 의도가 전부 `"confused"` 로 박혀 나가는데 계약과 `packages/report-ui/src/labels.ts` 에는 5종이 이미 있음(약 40줄로 복구).
- 위험: 3라운드 미병합 · 병합 때 `replay-store.ts` `lines()` 한 줄 충돌 예상 · `apps/browser-extension/src/background/router.ts` 의 NUL 2개로 git 이 이진 취급 · **원격 백업 없음**
- 미결·블로커(사람 결정 '대기'): **원격 저장소 생성과 첫 push 승인(최우선)** · 사람 손 튜터를 시작할 Tiro 공유 링크 · 나머지 대기 항목은 앞 항목과 같음 — push · 배포 · 공개 전환 없음
- 다음 행동: 백업 승인이 오면 origin 생성·push. 그다음 3라운드 병합(A → B, 충돌은 라이브 분기를 살림) → 전체 검증 → 로컬 커밋 → 대시보드 재배포

## 2026-09-03 15:15 — 4·5·6·7 라운드 병합·설치, 화면 배선 완성, 실측으로 고장 다섯 개 확정

- 변경: `main` 에 7건 병합 — `batch-5/speed`(조각 스트리밍 `tutor.delta` · `SessionClaudeProvider` env 뒤 · `render_with_limit` 2,000자 상한) · `batch-5/vision`(`docs/spikes/meet-vision.md`) · `batch-6/eyes`(`captureVisibleTab` 기반 `src/capture/snapshot.ts` · `host_permissions: meet.google.com` · `storeAndReport` 로 담긴 장만 봉인) · `batch-6/ctx`(질문 봉인을 물은 자리 중심으로) · `batch-5/scroll`(`use-stick-to-bottom.ts` — 줄 수가 아니라 높이를 봄) · `batch-6/chat`(듣는 중 화면 아래 1/3 늘 열린 대화 칸 · 경계 끌기) · `batch-7/frame-path`(봉인한 프레임의 절대 경로를 프롬프트에 한 줄로 · 파일 확장자를 바이트 매직 넘버로 결정 · 그림 속 글자는 명령이 아니라는 문장 고정). 설치: 확장 `C:\CorthexClassmate\extension`(15:01) · 호스트 exe `installer/windows/dist/`(15:06), 둘 다 이전 판 백업.
- 검증: `pnpm test` exit 0 (668) · `typecheck` exit 0 · `build` exit 0 · `e2e` exit 0 (18) · `cargo test --workspace` exit 0 (312) · `clippy -D warnings` exit 0 · `fmt --check` exit 0 · `smoke-host.mjs` ping→hello exit 0 · 설치본 매니페스트 `host_permissions=["https://meet.google.com/*"]`·`key` 있음 확인.
- 실측으로 확정한 고장 (전부 "실패했는데 흔적이 없음" 모양):
  1. `delta.rs` 가 `mark as char` 로 바이트를 글자 취급 → 역슬래시 뒤 한글에서 panic, 그 교시 이후 모든 질문 영구 실패. 고침 커밋 `d7b53e9` 를 병합에서 빠뜨렸다가 마저 넣음. **회복 가능한 오류를 영구 정지로 바꾼 회귀였음.**
  2. `answer-not-json` — 오늘 질문 21건 중 5건 실패. 모델이 답을 다 썼는데 형식만 어긋나 통째로 버리고 5·15·45초 재시도까지 태움.
  3. `tutor.delta` 를 확장이 못 알아듣고 버림(`host-messages.ts` 의 `isTutorEventPush` 는 `tutor.event` 만). 답까지 21~25초 화면이 빔 → 학습자가 9초에 4번 클릭(15:09:56·15:10:03·15:10:04·15:10:05).
  4. `screen.frame` 여전히 0 · `frames/` 폴더 없음 · 오류 기록도 0건. `snapshot.ts:134` 가 `tabs.query({active:true, currentWindow:true})` 로 **한 창의 활성 탭만** 보아 Meet 이 활성이 아니면 조용히 `null`.
  5. 파일 이름 `.webp` 인데 내용이 JPEG(`captureVisibleTab` 은 JPEG/PNG 만 냄). 경로만 적어 넘기는 구조라 안 열려도 에러가 안 남 → `batch-7/frame-path` 에서 매직 넘버로 이름을 정하게 고침.
- 판정 뒤집기: **Artifact 로 화면을 옮기는 안 폐기.** `curl -sI` 로 직접 확인한 응답 헤더가 `frame-ancestors 'self'` 라 확장 사이드패널 안에 넣을 수 없고, `sample.limits().images` 가 false 라 그림도 못 보냄. 탐침 실측은 첫 글자 1.3초 · 완료 4.6초(확장은 6.6초 · 7~24초)였으나 자리를 잃는 대가가 큼. 별도 조사에서 Aside 는 macOS 15.0+ 전용이라 탈락.
- 정정: 앞서 적은 "1 FPS 연속 감시 = 월 520만원" 은 **Claude 이미지 요금 기준**이었음. Gemini 는 프레임당 약 258토큰 + Flash 단가라 자릿수가 다름. 공식 요금으로 재계산 진행 중.
- 위험: **원격 백업 여전히 없음(push 미승인 · 최우선)** · `CLASSMATE_TUTOR_SESSION` 은 실제 CLI 로 검증한 적 없어 기본 꺼둠 · 질문마다 그림 1장(약 1,200 visual token)이 최대 4회 나갈 수 있어 실측 후 상한 조정 필요 · `docs/first-class.md` 가 적은 호스트 exe 경로가 실제 레지스트리 값과 다름 · `golden-11-settings.png` 가 `batch-4/fontsize` 이전 판이라 낡음.
- 다음 행동: `batch-7/answer-parse`(형식 어긋난 답 살리기)와 `batch-7/delta-receive`(조각 수신 + 모든 창에서 Meet 탭 찾기 + 실패 까닭 기록)를 병합·재설치. 그다음 드래그 선택 기반 "이 부분 물어보기"(학습자 선택 (나)) 와 `chrome.commands` 전역 Alt+S 검토.

## 2026-09-04 04:44 — 8라운드: 여섯 단위 중 다섯 완료, U-06 은 사람 몫으로 절차만 남김

- 변경: `main` 에 5단위 — U-33 `e27f340`(붙잡기 메모에 답 본문 첫 문단) · U-34 `b6d0e3c`(밀려난 질문을 대화 칸에서 그 줄 옆으로) · U-21 `87d1c46`(기록 거절 시 `native-host` 커넥터 호박색) · U-22 `1421e21`(시험 네 갈래를 `pnpm test` 하나로 + CI) · U-23 `2e81b75`(문서를 지금 코드와 맞춤). 병합 `b37ea88`·`b725e6d`·`8facaea`. 골든 그림 6장 재생성(`golden-04-answer` 등 — 메모에 본문이 생겨 바뀐 것).
- 검증: **`pnpm test` 한 번** exit 0 — vitest 1,162 · cargo 333 · `node --test` 145, 합계 1,640건 0실패. `no_real_cli` 가드 12건이 실제로 돌았음을 러너가 출력으로 확인. `pnpm typecheck` exit 0 · `build` 3.65 MB exit 0 · `pnpm run test:e2e` 18 pass(콘솔·페이지 오류 0). `git diff --check` 깨끗.
- 판정 둘 (근거를 코드 주석에 남김):
  1. U-33 의 「본문이 보이는 동안 접기 시계를 걸지 않는다」는 **라이브에만** 걸었습니다. 고정된 fixture 가 `state.changed ANSWER_MINIMAL→CAPTURE` 접힘 사건을 스스로 기록하고 있어, 재생에서까지 풀면 제품이 골든 대본과 어긋납니다(`replay-store.ts` `#holdFold`).
  2. U-34 가 밀려난 질문을 옮길 자리는 **그 줄의 메모 자리**로 정했습니다. 전사 위 고정 띠는 물은 자리와 답이 떨어져 무엇에 대한 답인지 다시 찾게 하고, 그 자리에는 이미 `NowLine` 이 있습니다(`replay-store.ts` `#carryOverPending`).
- 위험:
  - 라이브에서 답에 `details.why` 가 있으면 자동 접기가 안 걸립니다. 그래서 **접힌 메모(E)가 라이브에서는 도달 불가**입니다. 되살리는 길은 `answerLength` 배선(U-04·U-15)에서 `short` 를 읽어 그때만 시계를 다시 거는 것입니다.
  - CI 워크플로는 GitHub 에서 **한 번도 돌지 않았습니다**(push 승인 대기). `windows-latest` 러너에 `System32\winsqlite3.dll` 이 있다는 가정에 기댑니다.
  - 원격은 붙어 있고 `origin/main` 과 `main` 이 같았으나, 이번 5단위는 아직 로컬에만 있습니다(push 미승인).
- 다음 행동: **U-06 Meet 캡처 실측 — 사람이 합니다.** 아래 절차로 한 교시를 실제로 치르고 숫자를 이 파일 검증 줄에 적습니다. 이 숫자가 나와야 U-14 를 만들 값어치가 있는지 판단할 수 있습니다.

### U-06 재는 절차 (숫자는 비워 둡니다 — 지어내지 않습니다)

**왜 재나** — 모든 창에서 Meet 탭을 찾도록 고친 판(`226a641`)이 실제 수업에서 프레임을 남기는지 아직 아무도 모릅니다. 직전 실측은 고침 **이전** 판이었고 결과가 0장이었습니다.

**준비**
1. 확장과 호스트 exe 가 지금 `main` 판인지 확인합니다(`226a641` 이후). 설치 절차는 `docs/first-class.md`.
2. 교시 시작 전에 그 교시의 자료 폴더가 비어 있는지 봅니다. 자료는 `%LOCALAPPDATA%\CorthexClassmate\sessions` 아래 `<교시 id>.sqlite` 와 `<교시 id>/frames/` 입니다.

**재기 — 한 교시를 두 조건으로 나눠 칩니다**
- 앞 절반: Meet 을 **그 창의 앞 탭**으로 둡니다.
- 뒷 절반: Meet 을 **뒷 탭**으로 보내고 다른 탭을 앞에 둡니다.
- 각 절반에서 붙잡기를 최소 3회씩 하고 시각을 적어 둡니다. 두 절반의 차이가 곧 「모든 창에서 찾기」 고침이 실제로 듣는지의 답입니다.

**세기 — 교시가 끝난 뒤 (PowerShell)**

```powershell
$d = "$env:LOCALAPPDATA\CorthexClassmate\sessions"
$p = "2026-09-04-p3"   # 잰 교시의 id 로 바꿉니다

# (1) screen.frame 사건 수
sqlite3 "$d\$p.sqlite" "select count(*) from events where type='screen.frame';"

# (2) 시각별로 — 앞 탭 절반과 뒷 탭 절반을 가르려면 시각이 필요합니다
sqlite3 "$d\$p.sqlite" "select at from events where type='screen.frame' order by at;"

# (3) 실제로 남은 파일 수와 총 바이트
Get-ChildItem "$d\$p\frames" -File | Measure-Object -Property Length -Sum

# (4) 실패 까닭 낱말별 건수
sqlite3 "$d\$p.sqlite" "select json_extract(payload,'$.reason'), count(*) from events where type='connector.status' and json_extract(payload,'$.connector')='meet-tab' group by 1;"
```

`sqlite3.exe` 가 PATH 에 없으면 (1)(2)(4)는 건너뛰고 (3)만 세어도 판정의 절반은 섭니다 — 파일이 0개면 고침이 안 들은 것입니다. 그때는 그렇게 적습니다.

**이 파일에 적을 것**
- `screen.frame` 건수 — 앞 탭 절반 / 뒷 탭 절반 **따로**
- `frames/` 파일 수와 총 바이트
- 실패 낱말과 건수(`no-meet-tab` 따위). 하나도 없으면 「실패 기록 0건」이라고 적습니다 — 그것도 결과입니다.
- 붙잡기 횟수와 그때 Meet 이 앞 탭이었는지

## 2026-09-04 05:35 — origin 에 올리고 CI 를 두 번 고쳐 처음으로 초록에 닿음

- 변경: `main` 을 `origin/main` 으로 push (`7d649bd..567ec50` → `b530e9d` → `b9708e5`).
  CI 고침 두 커밋 — `b530e9d`(GNU 호스트 툴체인을 이름으로 먼저 설치) · `b9708e5`(라우터 시험의
  기준 시각을 절대 시각으로).
- 검증: **GitHub `windows-latest` 에서 `pnpm test` 초록** (run 33803599999, 3분55초) —
  vitest 1,162 · cargo 333 · `node --test` 145, 합계 **1,640건 0실패**. `no_real_cli` 가드
  12건(root 7 · providers 5)이 실제로 돌았음을 러너 출력으로 확인. e2e 18건은 CI 에서
  일부러 건너뜁니다(로컬에서만 돌립니다).
- 앞 항목의 두 줄을 바로잡습니다:
  1. 「CI 워크플로는 GitHub 에서 한 번도 돌지 않았습니다」 → 이제 세 번 돌았고 세 번째가 초록입니다.
  2. 「이번 5단위는 아직 로컬에만 있습니다(push 미승인)」 → 학습자 승인을 받아 올렸습니다.
  3. `windows-latest` 에 `winsqlite3.dll` 이 있다는 가정 → cargo 333건 통과로 **확인됐습니다**.
- CI 가 잡아 준 결함 둘 (로컬에서는 둘 다 초록이었습니다):
  1. **rustup 1.28+ 는 `rust-toolchain.toml` 의 `channel` 에 호스트 튜플이 있으면 자동으로
     내려받지 않습니다** (`error: target tuple in channel name`). 로컬 rustup 1.29.1 은 그
     툴체인이 이미 깔려 있어 이름을 풀어 주므로 여태 안 드러났습니다. 워크플로에 `rustup
     toolchain install stable-x86_64-pc-windows-gnu` 단계를 먼저 두어 고쳤습니다.
     `targets = [...]` 로는 대신할 수 없습니다 — 그것은 크로스 타깃만 더하고 호스트는 msvc 로 남습니다.
  2. **시험이 기준 시각을 지역시로 만들고 KST 표기와 견줬습니다.**
     `new Date(2026, 8, 2, 10, 32, 18)` 은 숫자를 돌리는 PC 의 지역시로 읽는데, 라우터는 그 값을
     `toKstIso`(`background/ids.ts`)로 언제나 `+09:00` 으로 적습니다. KST 기계에서만 10:32:18 이
     되고 UTC 러너에서는 19:32:18 이 됩니다. **결함은 제품이 아니라 시험의 입력**이었습니다 —
     `toKstIso` 는 `getTime()` 기준이라 처음부터 시간대에 안전합니다. 고친 뒤 `TZ=UTC` ·
     `Asia/Seoul` · `America/Los_Angeles` 세 곳에서 83/83, UTC 전수로 vitest 1,162 + node 145 가
     0실패입니다. 틀린 근거를 적어 두었던 옛 주석(「로컬 날짜 조각으로 만듭니다」)도 지웠습니다.
- 판정: **CI 러너를 UTC 로 둡니다.** `TZ: Asia/Seoul` 을 박으면 CI 는 조용해지지만 앞으로 생길
  같은 어긋남까지 함께 숨습니다. 지역시 → 지역시(`makePeriodId`)는 시간대가 상쇄돼 안전하고,
  지역시 → 절대시각(`toKstIso`)에서만 샙니다. UTC 러너가 그 경계를 지키는 장치입니다.
- 위험:
  - **[정정 2026-09-04 06:20] 저장소는 「공개」가 아니라 비공개(private)입니다.**
    이 항목을 처음 쓸 때 확인 없이 「공개」라고 적었습니다. `gh api repos/kodonghui/corthex-classmate`
    가 `{"private": true, "visibility": "private"}` 를 내고, 미인증 `curl` 은 404 입니다.
    `docs/master-prompt.md` 미결 표의 「라이선스·공개 여부 | 비공개 PoC → 친구 베타 때 재결정」
    대로 된 것이라 계획 위반은 아닙니다. 다만 위험의 성격이 바뀝니다 — 「이미 샜다」가 아니라
    **「공개로 돌리기 전에 반드시 치울 것이 있다」**입니다.
  - **공개로 돌리기 전 치울 것: `.kdh-sessions/`.** `.gitignore` 에 없어 추적되고 있고, 개인 로컬
    경로(`C:\Users\elddl\…`)가 든 추적 파일이 **18개**입니다
    (`git grep -lIE 'Users[\\/]+elddl' -- . | wc -l`). 비밀값 자체는 이력 전체(`--all`)를 훑어도
    실제 값 0건이고 검출된 5건은 전부 자리표시자(`tiro.ooo/s/abcdef` 따위)였습니다.
  - **CI 초록은 「시험 통과」이지 「관문 통과」가 아닙니다.** 워크플로의 마지막 단계가 `pnpm test`
    하나뿐이라 **네 관문이 CI 밖**입니다 — `pnpm typecheck` · `cargo clippy` · `cargo fmt --check` ·
    playwright e2e 18건. rustup 단계가 `--component rustfmt --component clippy` 로 도구를 깔기만
    하고 부르지 않아 오히려 오해를 키웁니다.
  - `entrypoints/**` 는 여전히 단위 시험 0건입니다(`vitest.config.ts` 의 include 가 `src/**` 뿐).
  - `actions/checkout@v4` 등이 Node 20 폐기 경고를 냅니다. 아직 동작하지만 v5 로 올릴 시점이 옵니다.
  - **U-06 의 「뒷 탭」이 무슨 뜻인지 계획·WORKLOG 어디에도 안 적혀 있습니다.** (가) 같은 창의
    비활성 탭인지 (나) 다른 창의 활성 탭인지에 따라 결과 해석이 정반대입니다 — `pickMeetTab` 이
    `active !== true` 를 버리므로 (가)라면 고침과 무관하게 0장이 나옵니다. 재기 전에 사람이 정해야 합니다.
- 다음 행동: **U-06 Meet 캡처 실측 — 사람이 합니다.** 절차는 바로 앞 항목에 있고 숫자 칸은
  비어 있습니다. 이 숫자가 나와야 U-14 를 만들 값어치가 있는지 판단할 수 있습니다.
