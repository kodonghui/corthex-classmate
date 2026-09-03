# 회고 (retrospective)

이 파일은 **일하는 방식**에 대한 회고의 정본입니다. 무엇을 만들었는지는 `WORKLOG.md`,
무엇을 왜 정했는지는 `DECISIONS.md`, 무엇이 남았는지는 `TASKS.md` 가 맡고, 여기는
"이 방식이 다음 프로젝트에도 통하나 · 무엇이 되풀이됐나 · 무엇을 하네스(스킬·스크립트·
체크리스트·템플릿)로 옮길 만한가" 만 적습니다. 라운드가 끝날 때마다 날짜 절을 하나 더합니다.
근거는 저장소 파일 경로로 답니다. 추정은 "추정" 이라고 씁니다.

## 2026-09-03 — Phase 0·1·2 (/batch 1·2라운드) 회고

### 0. 한눈에

| 항목 | 1라운드 (09-02) | 2라운드 (09-03) | 근거 |
|---|---|---|---|
| 단위 · 워커 | 10 · 10 (+ 수정 워커 9) | 9 · 9 (+ 통합 커밋 3 · 검토자 4 · 수정 워커 4) | `WORKLOG.md` 09-02 23:18 · 09-03 08:42 |
| 검토 발견 | 표 92건 (실재 21 · 반박 15 · 낮음 56) | 65건 (실재 60 · 보류 5 · 반박 0 · 높음 10) | `reviews/batch-1-review.md` · `reviews/batch-2-review.md` |
| 반박률 (medium 이상) | 15 / 36 ≈ 42 % | 0 / 65 | 같은 파일 |
| pnpm 시험 | 218 → 568 → 664 → 714 | 844 → 893 | `WORKLOG.md` 각 항목의 검증 줄 |
| cargo 시험 | 43 → 149 → 175 | 254 → 264 | 같은 줄 |
| node --test · e2e · 스크린샷 | 42 → 99 · 10 · 9장 | 139 · 16 · 14장 + 비교 9장 | 같은 줄 |
| 실제 CLI 지출 | 0 USD (Phase 1 실측 2.72 USD 는 라운드 밖) | 0 USD | `WORKLOG.md` 09-02 18:15 · `spikes/gate-c2-provider.md` |
| main 커밋 · 병합 | 138 커밋 중 병합 32 (batch-1 10 · batch-1-fix 9 · batch-2 9 · batch-2-fix 4) | | `git log --merges` (main `2c854be`) |
| 소요 (추정) | 워커 마지막 커밋 22:36~23:13 → 검토·수정 완료 00:05 | 선커밋 07:20 → 워커 07:39~08:19 → 통합·문서 08:42 → 검토·수정 완료 10:24 (약 3시간) | 병합 커밋 ^2 시각 |

`WORKLOG.md` 09-02 23:18 항목은 1라운드 검토를 "84건 표" 라고 적었는데 `reviews/batch-1-review.md` 의 표는 92건입니다. 표를 따릅니다.

### 1. 잘 된 것 (다음에도 그대로)

1. **계약을 먼저 얼리고 워커에게는 제안만 허용.** `packages/contracts` 의 스키마 8종을 `frozen.sha256` 로 고정하고 시험이 매번 대조합니다(`packages/contracts/test/frozen.test.ts`). 두 라운드 워커 19명이 contracts·fixtures 를 한 번도 바꾸지 않았고, 바꾸고 싶은 것은 보고 줄 `DECISIONS_PROPOSAL` 로만 왔습니다(`DECISIONS.md` 2026-09-02 "contracts 고정").
2. **계약을 문장으로 써서 워커 프롬프트에 똑같이 동봉.** 2라운드의 (다) 패널 포트 · (라) 사건 payload · (마) 봉투 · (바) 확장 id 를 9명에게 같은 문장으로 주니, 병합 뒤 통합 커밋 세 개(A 라우터→파이프라인 · B App.tsx 라이브 · C 비교)만으로 확장↔호스트가 이어졌습니다(`DECISIONS.md` 2026-09-03 "2라운드 고정 계약").
3. **공유 자리 선커밋 + 의존 순서 `--no-ff` 병합.** 2라운드는 `22f4058` 로 Cargo 의존·`src/router.rs`·`src/tutor/`·`ports.ts` 자리를 미리 파 두었고, 병합 충돌은 1라운드 pnpm lock 1회뿐이었습니다.
4. **검토자 → 반박 검증자 → 실재만 수정.** 1라운드에서 medium 이상 36건 중 15건이 반박돼 헛수정을 막았고, 실재 21건은 전부 "되돌리면 실패하는 시험" 과 함께 고쳤습니다(`DECISIONS.md` 2026-09-02 "병합 뒤 검토는 검토자 → 반박 검증자").
5. **검토 표에 재현 조건을 미리 적게 하니 반박 0.** 2라운드 검토자에게 "어떤 입력·상태에서 무엇이 틀리게 나오나" 를 적게 했더니 수정 워커 4명이 65건 중 60건을 그대로 재현해 고쳤습니다. 시나리오가 틀린 곳(background #1 냉시동)은 워커가 실제 경로(교시 전환 경합)로 근거를 바꿔 적었습니다(`reviews/batch-2-review.md`).
6. **실제 claude/codex 호출 0회.** 가짜 CLI 두 종(`crates/providers/tests/fake-claude.mjs` · `tests/fake-tutor-cli.mjs`)과 `no_real_cli` 가드로 두 라운드 전 구간 시험이 돈을 쓰지 않았습니다.
7. **결정적 e2e·스크린샷.** `?replay=manual` 체크포인트 9종 + `animations: 'disabled'` + 정본 dc.html 의 `setInterval` 가로채기로 스크린샷 14장·비교 9장을 재생성 가능하게 만들었습니다(`DECISIONS.md` 2026-09-03 "사이드패널의 첫 데이터 소스").
8. **기록 4종이 복구 지점 구실.** WORKLOG 4줄(변경/검증/위험/다음 행동) · DECISIONS 3줄(결정/근거/대안) · 검토 표 · §9 보고가 남아 있어 이 회고를 문서와 git 만으로 쓸 수 있었습니다.
9. **읽는 곳 없는 설정은 정직하게 잠금.** 저장만 되고 읽는 곳이 0인 스위치 5칸을 `disabled` + 까닭 한 줄로 잠가 "오늘 기록 지우기" 같은 거짓 확인을 없앴습니다(`DECISIONS.md` 2026-09-03 "검토 후속").
10. **검토 결과를 저장소 표로 정본화.** 검토 원문은 세션 scratchpad 에만 남는 구조라 `docs/reviews/batch-N-review.md` 표를 정본으로 두고 보류는 TASKS 로 이월했습니다.

### 2. 안 된 것 · 사고

| # | 무엇 | 결과 | 지금 상태 | 근거 |
|---|---|---|---|---|
| 1 | Phase 1 Gate C2 검증 에이전트가 `spikes/provider-claude.mjs` 를 import 하자 최상위 `main()` 이 실행돼 실제 claude 5회 호출 | 승인 없이 1.25 USD 지출 | 모든 `.mjs` 에 진입점 가드 | `WORKLOG.md` 09-02 18:15 · `spikes/gate-c2-provider.md` |
| 2 | 2라운드 worktree 9개가 같은 `CARGO_TARGET_DIR` 을 써 rlib 을 서로 덮음 | 워커 5·6·7 시험이 어긋남 | main 만 전용 `_target_main` 으로 우회, worktree 별 분리는 TASKS | `WORKLOG.md` 09-03 08:42 · `TASKS.md` |
| 3 | 라우터 단위시험이 `TutorSources::from_env()` 로 환경의 `CLASSMATE_CLAUDE_CLI` 를 물려받음 · 설치 스모크 ② 가 부모 환경을 물려줌 | 시험·스모크가 실제 CLI 를 부를 수 있었음(검토 높음 2건) | `TutorSources::default()` · `no_real_cli_root` 가 `router.rs` 까지 · 스모크 자식 환경 격리 | `reviews/batch-2-review.md` 호스트 R1 · installer R1 |
| 4 | 1라운드 검토 반박률 42 % | 검토자가 시험 파일·정본을 덜 읽은 오판 15건 | 2라운드부터 재현 조건 칸 | `reviews/batch-1-review.md` |
| 5 | `clock.rs` 가 UTF-8 경계를 안 보고 `&text[17..19]` 를 잘라 `at` 값 하나로 호스트 사망 | 워커 자체 시험이 못 잡고 검토 2파가 잡음 | 수정됨 | `reviews/batch-1-review.md` 호스트 |
| 6 | transport 표↔`router.rs` 대조 스크레이퍼가 주석까지 세어 통합 A 가 두 번 빨갛게 됨 | 문구 변경으로 우회 | 검토에서 `handle` 본문 한정 + `//` 줄 건너뜀 | `WORKLOG.md` 09-03 08:42 · `reviews/batch-2-review.md` 호스트 L1 |
| 7 | 문서의 숫자·문장 표류 19건("9장면" 실제 14 · exe 1.8 MB 실제 2.4 MiB · "(49개 통과)" · "두 zip 이 같다") | installer/문서 검토 19건 전부 실재 | 실측대로 고침 | `reviews/batch-2-review.md` installer |
| 8 | 루트 `pnpm test` 가 호스트 워커의 cargo 빌드와 겹쳐 spikes 1파일 4건 실패 | 단독·재실행은 통과 | 원인 격리 없이 "조용할 때 돌릴 것" | `WORKLOG.md` 09-03 10:24 |
| 9 | 검토자·수정 워커 원문이 scratchpad 에만 남음 | 요약 표만 정본 | 다음 라운드부터 `docs/reviews/` 아래 원문 자리 | `reviews/batch-*-review.md` 머리 |
| 10 | 사람 대기 항목 13건이 두 라운드 내내 미해결 | Chrome 안 실제 확장↔도우미 왕복 0회 | 09-03 오전 사용자가 레지스트리 등록 시도 시작 | `TASKS.md` 대기 절 |
| 11 | 오케스트레이션 자체: 서브에이전트·워크플로 `agent()` 에 `model` 을 생략해 세션 모델(fable)을 물려줌 | 문서 초안·근거 대조 같은 잡 작업에 비싼 모델이 돎(사용자 지적 2회) | 워크플로 중단 → 완료된 초안 4개는 파일로 재사용, 남은 5단계는 sonnet 으로 재실행 | 이 회고를 쓰던 세션 |
| 12 | 오케스트레이션 자체: 세션 스냅샷 시험 저장이 scratchpad 의 긴 경로에서 `WinError 206` | Windows MAX_PATH | 짧은 경로(`cc-wt/…`)로 재시험 통과 | `DECISIONS.md` 2026-09-02 "Rust 빌드는 짧은 경로" 와 같은 뿌리 |

정정(2026-09-03 사용자 지적): 위 "1.25 USD" 와 Phase 1 의 "2.72 USD" 는 CLI 결과의 `total_cost_usd` 를 더한 **참고 숫자**입니다. 이 PC 에는 `ANTHROPIC_API_KEY` 가 없어 `claude -p` 는 Claude 구독 한도로 돌고 달러 청구가 아닙니다. 그래도 "자동화가 실제 CLI 를 부르지 않는다" 는 규칙은 한도 소모와 실제 교시 파일 오염을 막으므로 그대로 둡니다.

### 3. 되풀이된 함정

"시험이 실제 CLI 에 닿는 경로" 가 세 번, 매번 다른 자리에서 되살아났습니다.

    Phase 1            1라운드/2라운드 워커            2라운드 설치 스모크
    import 부작용  ──▶  라우터 시험이 환경변수 상속  ──▶  자식 프로세스가 부모 환경 상속
    (main() 실행)       (TutorSources::from_env)        (CLASSMATE_*_CLI 그대로)
        │                    │                              │
        ▼                    ▼                              ▼
    진입점 가드           no_real_cli_root 스캐너          SCRUBBED_ENV_NAMES + 임시 폴더
                                                          + 1999년 교시 id

가드가 셋이 된 것은 "어디서 새는가" 를 처음에 다 못 본 탓입니다. 다음 라운드부터는 세 가드를
워커 완료 조건에 함께 적습니다(§5).

그 밖의 되풀이:

- **헐거운 시험.** report-ui 의 언제나 참인 단언, ui-classmate 문구 시험이 형제 시험 파일 글자를 봄, session-store 의 단언 없는 시험 둘, 패널 기존 시험이 결함(옛 답 얹힘)을 고정. 시험 수는 늘어도 회귀를 못 잡는 형태(`reviews/batch-1-review.md` · `batch-2-review.md` 패널 #3).
- **문서 숫자 표류.** 시험 수·장 수·크기가 실측이 바뀔 때마다 뒤처짐. 호스트 L5 만 "수를 적지 않는 표현" 으로 바꿈.
- **Windows 함정 재출현.** `.cmd` 직접 spawn(Phase 1 claude · providers L21 · installer pnpm) · MAX_PATH 260 · happy-dom 전역 URL. 세 번 모두 README 에 적고서야 멈춤.
- **id·순번 충돌로 기록 소실.** 프레임 id 가 재시작마다 `sf-001`(1R R5) · `ev-<frame id>` 중복 무시로 screen.frame 소실(1R R9) · 호스트가 되민 `question.asked` 로 Moment 중복(2R 패널 R1). 계약 (라)로 id 규칙을 고정한 뒤에도 한 번 더 남.
- **워커 간 말투 표류.** 존댓말/반말/해라체가 한 단위 안에서도 갈리고 영어 주석 86곳. 프롬프트에 말투 규칙이 없었음.
- **스크린샷 타이밍.** fade-in 도중 빈 화면(animations disabled 로 해결) · `golden-09` 1바이트 되돌림 2회 · 비교 이미지 캡션 sha 가 문서 커밋보다 하나 뒤처짐.

### 4. 하네스 후보 (다른 프로젝트로 옮길 만한 것)

우선순위 1 은 돈·안전, 2 는 병렬 작업의 뼈대, 3 은 기록·품질입니다. 형태는 그때 정합니다.

| 우선 | 후보 | 무엇을 자동화하나 | 형태(안) | 근거가 된 사건 | 지금 있는 자리 |
|---|---|---|---|---|---|
| 1 | 진입점 가드 한 줄 | 실행 가능한 `.mjs` 마다 `import.meta.url === pathToFileURL(process.argv[1]).href` 를 강제, 없으면 lint 실패 | 스크립트 템플릿 + 검사 | §2-1 (1.25 USD) | `spikes/provider-claude.mjs` 등 13개 |
| 1 | 실제 CLI 호출 차단 스캐너 | 프로세스 생성 자리(`Command::new`·`spawn`·PATH 탐색·제공자 생성자)의 문자열을 실행 파일 이름으로 정규화해 금지 이름·환경변수 읽기를 잡는 시험 | Rust/Node 시험 템플릿 | §2-3 | `apps/native-host/tests/no_real_cli_root.rs` |
| 1 | 환경 격리 스모크 래퍼 | 자식 env 에서 제공자 변수 삭제 + 임시 데이터 폴더 + 실수업과 겹칠 수 없는 가짜 id + 시간 상한 | 스크립트 | §2-3 | `installer/windows/smoke-host.mjs` |
| 2 | 계약 고정 스냅샷 | 병렬 라운드 전 공유 스키마 해시를 파일로 고정 · 시험이 대조 · 워커는 제안만 | 스크립트 + 시험 템플릿 | §1-1 | `packages/contracts/scripts/freeze.mjs` · `test/frozen.test.ts` |
| 2 | /batch 라운드 체크리스트 | 계약 고정 → 스켈레톤(시험 exit 0) → 공유 자리 선커밋 → 완료 조건(test exit 0 · README 한 단락 · 비밀값 grep · 돈 가드 3) → 의존 순서 `--no-ff` 병합 → 워커 브랜치의 docs 3종·contracts·fixtures 무변경 확인 → worktree 정리 · 브랜치 정책 | 체크리스트 | §1-2·3 · §2-2 | `docs/master-prompt.md` §7 · 이 파일 |
| 2 | 검토 → 반박 검증 → 실재만 수정 | 검토 표에 "입력·상태 → 틀린 출력" 칸 필수 · 수정 워커는 발견마다 반박을 먼저 · 실재는 되돌리면 실패하는 시험과 함께 | 스킬 + 체크리스트 | §1-4·5 (반박률 42 % → 0) | `DECISIONS.md` 2026-09-02 · `reviews/` |
| 2 | 검토 기록 표 템플릿 | 요약 표(영역·발견·실재·보류·반박·브랜치→병합) + R/L/X/D 표(#·심각도·파일:줄·내용·처리) + "굳힌 것" 절 + 원문 보존 자리 | 템플릿 | §1-10 · §2-9 | `reviews/batch-2-review.md` |
| 2 | worktree 별 빌드 캐시 분리 | cargo 는 worktree 마다 `CARGO_TARGET_DIR`, main 은 전용, 경로 60자 이내 · pnpm 은 cargo 와 직렬 | 스크립트/체크리스트 | §2-2 · §2-8 | `TASKS.md` · `DECISIONS.md` 2026-09-03 통합 결정 |
| 2 | 서브에이전트 모델 규칙 | `agent()`·Agent 에 `model` 필수: 초안·대조·요약 = sonnet, 구현·검토 = opus, 세션 모델 상속 금지 | 체크리스트 + 워크플로 템플릿 | §2-11 | 이 파일 |
| 3 | 병합 뒤 전체 검증 묶음 | pnpm test/typecheck · cargo test/clippy/fmt · build · e2e · roundtrip · smoke · 비밀값·URL grep · `git diff --check` · frozen 무변경 · `git status --short` 비어 있음을 한 번에 | 스크립트 | §1-8 | `WORKLOG.md` 검증 줄 |
| 3 | 가짜 CLI 모드 프로그램 | stream-json 을 흉내 내며 `--fail/--hang/--delay-ms/--bad-json/--too-long/--dump-stdin` 으로 실패 경로 시험 | 템플릿 | §1-6 | `apps/native-host/tests/fake-tutor-cli.mjs` |
| 3 | 결정적 스크린샷 레시피 | 체크포인트 손잡이 · animations disabled · `setInterval` 가로채기 · `node:http` 정적 서버로 정본과 구현을 같은 장면에서 | 체크리스트/스킬 | §1-7 | `apps/browser-extension/scripts/compare-design.mjs` |
| 3 | 기록 템플릿 세트 | WORKLOG 4줄(+heartbeat) · DECISIONS 3줄 · §9 보고 · 워커 보고의 `DECISIONS_PROPOSAL` 줄 · 이 회고 형식 | 템플릿 | §1-8 | `docs/WORKLOG.md` 머리 · `docs/DECISIONS.md` 머리 |
| 3 | 표↔원문 대조 시험 패턴 | 정적 표를 `include_str!` 로 읽은 원문(함수 본문 한정 · 주석 제외)과 대조해 한쪽만 늘면 빨갛게 | 시험 템플릿 | §2-6 | `crates/transport/src/lib.rs` |
| 3 | "읽는 곳 없는 설정" 검토 축 | 저장만 되고 읽는 곳이 0인 UI 스위치를 grep 으로 찾아 `disabled` + 까닭 | 검토 체크리스트 항목 | §1-9 | `reviews/batch-2-review.md` |
| 3 | 세션 스냅샷 + 프로젝트 WORKLOG 매시간 | `kdh-save-session`(snapshot·handoff·events) 을 프로젝트 저장소 안 짧은 경로에 남기고 WORKLOG 항목과 같은 커밋으로 | 스킬 조합(이미 있음) | 이 세션 | `.kdh-sessions/` (2026-09-03 부터) |

### 5. 다음 라운드에서 바꿀 것

1. 워커 완료 조건에 **돈 가드 3항목**(진입점 가드 · 환경변수·PATH 상속 금지 · `no_real_cli` 통과)을 "test exit 0 + README" 옆에 명시합니다.
2. worktree 마다 `CARGO_TARGET_DIR` 을 배정하거나 cargo 단위를 순차로 돌립니다. 루트 `pnpm test` 는 cargo 뒤에 직렬로 둡니다.
3. 검토자 프롬프트에 **재현 조건 칸을 필수**로 승격하고, 검토자·수정 워커 원문을 `docs/reviews/` 아래에 남깁니다.
4. README 에는 시험 수·장 수·크기 같은 숫자를 적지 않거나 생성물로 만듭니다. 숫자는 WORKLOG 에만.
5. 워커 프롬프트에 말투 규칙(한국어 존댓말 주석)을 한 줄 넣어 검토 표에서 뺍니다.
6. 보류 항목(1라운드 낮음 11 + 2라운드 보류 5)을 라운드 계획 단계에서 넣을지 버릴지 정합니다.
7. 사람 대기 항목 중 최소 두 개(레지스트리 등록 · 실제 claude 첫 호출)를 다음 라운드 **전에** 해소해 fixture 밖 통합 결함을 봅니다.
8. 비교 이미지는 코드 마지막 커밋 뒤 한 번만 재생성하고, 로컬 브랜치(32개) 정리 정책을 라운드 종료 체크리스트에 넣습니다.
9. 서브에이전트·워크플로에 `model` 을 항상 명시합니다(§4 "서브에이전트 모델 규칙").

### 6. 이 회고를 어떻게 썼나 · 어떻게 갱신하나

- 재료: `WORKLOG.md` 전체 · `DECISIONS.md` · `reviews/batch-1-review.md`·`batch-2-review.md` · `TASKS.md` · `git log --merges`. 초안은 워크플로 워커가 저장소만 읽어 만들고, 근거 대조 워커가 파일·줄을 다시 열어 고친 뒤 오케스트레이터가 세션에서 본 것(§2-11·12)을 더했습니다.
- 갱신: 라운드가 끝날 때마다 "## 날짜 — 라운드 이름 회고" 절을 위에 하나 더합니다. §4 표는 누적이고, 후보가 실제로 하네스가 되면 "지금 있는 자리" 칸에 그 위치를 적습니다.
- 여러 프로젝트를 모을 때는 §0 표와 §4 표만 뽑아 비교하면 됩니다. 나머지 절은 프로젝트 안 문맥입니다.
