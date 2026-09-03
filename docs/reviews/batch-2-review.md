# /batch 2라운드 검토 기록 (2026-09-03)

9단위와 통합 커밋 A·B·C 를 main 에 병합하고 전체 검증을 통과한 뒤(main `7071751`), 영역별 검토자 4명(확장 패널 · 확장 background/live · 네이티브 호스트 · installer/문서)이 발견 65건(높음 10)을 냈습니다.
1라운드 규칙(DECISIONS 2026-09-02 "검토자 → 반박 검증자 → 실재만 수정")대로, 영역별 수정 워커 4명이 발견마다 **먼저 반박을 시도**하고 반박에 실패한 것만 `batch-2-fix/<영역>` 브랜치에서 되돌리면 실패하는 시험과 함께 고쳤습니다.
검토자 원문의 재현 조건과 워커의 판정 근거는 세션 scratchpad 에만 있었으므로 이 표가 정본입니다. "판정" 은 워커의 것이고, 검토자 판정과 다른 곳은 근거 칸에 적었습니다.

| 영역 | 발견 | 실재 | 보류 | 반박 | 수정 브랜치 → main 병합 |
|---|---|---|---|---|---|
| 확장 패널 | 10 (높음 3) | 10 | 0 | 0 | `batch-2-fix/ext-panel` `b855642` → `d42dfca` |
| 확장 background/live | 19 (높음 4) | 17 | 2 | 0 | `batch-2-fix/ext-bg` `566d2cf` → `e847c61` |
| 네이티브 호스트 | 14 + 문서 3 (높음 2) | 14 | 3 | 0 | `batch-2-fix/host` `7254465` → `76a8f13` |
| installer/문서 | 19 (높음 1 · #10·#11·#18 은 호스트로 이관) | 19 | 0 | 0 | `batch-2-fix/installer-docs` `8047f96` → `ae4f8f4` |
| 합계 | 65 | 60 | 5 | 0 | |

반박 0 은 반박 규칙이 헐거워서가 아니라, 2라운드 검토자가 "어떤 입력·상태에서 무엇이 틀리게 나오나" 를 표에 미리 적어 두어 워커가 그 조건을 그대로 재현할 수 있었기 때문입니다. 시나리오가 틀린 곳(background #1 냉시동)은 워커가 실제 경로(교시 전환)로 근거를 바꿔 적었습니다.

## 확장 패널 (`src/panel/**` · `entrypoints/sidepanel/**` · e2e)

실재 10 · 보류 0 · 반박 0. 확장 시험 411 → 428(happy-dom DOM 시험 파일 `src/panel/panel-dom.test.tsx` 추가 · vitest 기본 환경은 node 그대로) · e2e 16 · `golden-11-settings.png` 는 잠근 칸과 설명이 생겨 다시 찍음.

### 실재 (R)

| # | 심각도 | 파일:줄 | 내용 | 처리 |
|---|---|---|---|---|
| R1 | 높음 | `src/panel/replay-store.ts:354` | 호스트가 되민 `question.asked` 기록본(사건 id 가 다름)이 같은 questionId 의 Moment 를 하나 더 만들어 바닥줄 "기록 2"·기록 화면 중복 줄·엉뚱한 밑줄 | 고침 `5d2efc6` · "한 번 붙잡았으면 호스트가 되밀어도 순간은 하나다" |
| R2 | 높음 | `src/panel/lesson-view.ts:207` | 라이브 자리표시 편집기(`ec-live-none`)를 진짜 자료로 세어 IntelliJ 나이가 "0초 전" 부터 올라감 | 고침 `5d2efc6` · "IntelliJ 문맥이 아직 없으면 나이를 세지 않는다" |
| R3 | 높음 | `src/panel/replay-store.ts:352` | 답 사건을 questionId 대조 없이 기계에 얹어 Q1 의 답이 Q2 낱말에 붙음 | 고침 `5d2efc6` · "지금 보고 있는 질문의 답이 아니면 메모에 얹지 않고 기록에만 남긴다" — 기존 시험 한 건이 결함을 못 박고 있어 뜻을 바꿔 다시 씀 |
| R4 | 중간 | `src/panel/settings-store.ts:46` · `screens/SettingsScreen.tsx:73` | "붙잡을 때 함께 저장" 3칸을 읽는 곳이 저장소 전체에 0곳 | 잠금(`disabled` + "지금은 세 가지를 늘 함께 저장해요 — 골라 끄기는 다음 라운드에 켜져요") `fb97702` |
| R5 | 중간 | `entrypoints/sidepanel/App.tsx:114` | `LiveApp` 이 `onClearToday` 를 넘기지 않아 "오늘 기록 지우기" 확인 창이 거짓 확인 | 잠금("아직 지울 수 없어요 — 도우미 삭제 기능은 다음 라운드에 켜져요") `fb97702` · Dialog 와 배선은 남김 |
| R6 | 중간 | `entrypoints/sidepanel/App.tsx:79` | `env{provider, autoFold}` 가 `openLive` 한 번뿐이라 수업 중 설정 변경이 스토어에 닿지 않음 | `ReplayStore.updateEnv` + 설정 변경 배선 `5d2efc6`+`fb97702` · 교시·주제는 "패널을 다시 열 때부터" 설명 한 줄 |

### 낮음 (L)

| # | 심각도 | 파일:줄 | 내용 | 처리 |
|---|---|---|---|---|
| L1 | 낮음 | `src/panel/settings-store.ts:45` | `answerLength` 를 읽는 곳 0곳 | 잠금("지금은 늘 한 줄만 먼저 보여 줘요 — 고르기는 다음 라운드에 켜져요") `fb97702` |
| L2 | 낮음 | `src/panel/PanelApp.tsx:78` | 늦게 도착한 저장소 값이 방금 누른 값을 되돌림 | 고침 `fb97702` |
| L3 | 낮음 | `src/panel/settings-store.ts:105` | 빈 주제가 저장소에 `""` 로 들어가고 다음 열기에 "수업" 으로 어긋남 | 고침 `fb97702` — 제안(onChange)이 아니라 onBlur 로(타이핑을 막지 않음) |
| L4 | 낮음 | `e2e/extension.spec.ts:267` | 13·14 가 뷰포트를 되돌리지 않아 15 가 정리 담당 | 고침 `6027d6f`+`b855642` · afterEach + 15 첫 줄 뷰포트 단정 |

## 확장 background/live (`entrypoints/background.ts` · `src/background/**` · `src/live/**` · `src/capture/frame-sink.ts`·`host-messages.ts`)

실재 17 · 보류 2 · 반박 0. 확장 시험 428 → 443(`frame-port.test.ts` · `session-area.test.ts` · `live/messages.test.ts` 추가) · build 의 manifest permissions 6개 유지 · e2e 16.

### 실재 (R)

| # | 심각도 | 파일:줄 | 내용 | 처리 |
|---|---|---|---|---|
| R1 | 높음 | `src/background/router.ts:235` | 검토자의 냉시동 경합 시나리오는 **반박**(검사와 `beginPeriod` 첫 줄 사이에 await 없음). 그러나 교시 전환 중 `finishPeriod` 가 `currentPeriodId=null` 로 두고 호스트 응답을 기다리는 사이 두 번째 부름이 새 교시를 먼저 시작해 기억을 지움 | 고침 `01a6cef` · "교시가 바뀌는 사이에 겹쳐 불러도 새 교시를 한 번만 시작합니다" |
| R2 | 높음 | `entrypoints/background.ts:120` · `src/capture/frame-sink.ts:341` | 도우미가 꺼져 있을 때 같은 프레임이 `NativeHostClient.pending` 과 싱크 `waiting` 두 대기열에 담겨 재연결 때 `duplicate-frame` → 화면 커넥터 paused | 고침 `97f1330`+`48e681f` · 새 `src/background/frame-port.ts` · 프레임은 `NativeHostFrameSink` 한 통에만(`frame.store` 는 `resend:false`) |
| R3 | 높음 | `entrypoints/background.ts:171` | 라우터 상태(교시 id·카운터·커넥터)가 메모리뿐이라 30초 유휴 뒤 되뜬 워커가 `period.started` 를 또 붙이고 `period.ended` 가 마지막 세대만 셈 | 고침 `01a6cef`+`566d2cf` · 새 `src/background/session-area.ts`(`classmate.periodLog` · `classmate.routerState`) |
| R4 | 중간 | `src/background/period-log.ts:343` · `router.ts:302` | 로그 500건이 차면 `period.started` 가 밀려나고 `openPanel` 은 재생만 해 패널이 기본 과목·교시로 그림 | 고침 `01a6cef` · 새 패널 포트에 현재 `period.started` 를 먼저 보냄 |
| R5 | 중간 | `src/background/router.ts:495` | 도우미가 꺼졌을 때 `tutor.ask` 가 `dropped` 로 버려져 질문이 어디에도 안 남음 | 고침 `01a6cef` · dropped 일 때만 `question.asked` 를 `event.append` |
| R6 | 중간 | `src/background/host-client.ts:318` | `event` 가 객체가 아닌 push 하나가 FIFO 짝을 소비해 이후 응답이 영구히 밀림 | 고침 `48e681f` · "모양이 다른 말은 대기열을 건드리지 않고 버립니다" |
| R7 | 중간 | `entrypoints/background.ts:401` · `src/live/messages.ts:137` | `question` 이 문자열이 아닌 `panel.ask` 가 TypeError → 미처리 거부로 질문이 조용히 사라짐 | 고침 `da967eb`+`566d2cf` · 칸 검사 + `.catch` |

### 낮음 (L)

| # | 심각도 | 파일:줄 | 내용 | 처리 |
|---|---|---|---|---|
| L1 | 낮음 | `src/background/router.ts:135` | `clampUtf8` 이 서로게이트 쌍 한가운데를 자름(자른 자리에 3바이트 여유가 있을 때로 조건 보정) | 고침 `01a6cef` |
| L2 | 낮음 | `src/live/attach.ts:313` | 붙자마자 끊기면 백오프가 자라지 않음 | 고침 `da967eb` · 말이 한 번 오간 뒤에만 `attempts` 초기화 |
| L3 | 낮음 | `entrypoints/background.ts:171` | `storage.session ?? storage.local` 폴백이 전사 본문을 디스크로(불변 원칙 §4-1) | 고침 `566d2cf` · 폴백 제거, 없으면 복원 포기 |
| L4 | 낮음 | `src/background/router.ts:537` | 고정 계약에서 사라진 `not-implemented` 갈래 | 고침 `01a6cef` · `envelope-invalid`→paused · `provider-unavailable`→off 를 시험으로 못 박음 |
| L5 | 낮음 | `src/background/router.ts:638` | `echo:false` 면 `log.append` 도 건너뛰어 패널 사건이 로그에 안 남음 | 고침 `01a6cef` |
| L6 | 낮음 | `src/capture/frame-sink.ts:271` | 재전송 중 새 장이 남은 것보다 앞서고 `stats().bytes` 단위가 두 통에서 다름 | 고침 `97f1330` |
| L7 | 낮음 | `src/capture/host-messages.ts:272` | `buildFrameStore` 의 던짐을 `store()` 가 잡지 않고 `assertPeriodId` 는 미사용 | 절반 고침 `97f1330` · 던지지 않고 `skippedInvalid` 로 건너뜀. `skipped` 결말로 바꾸는 나머지 절반은 `src/capture/host-messages.test.ts:122` 가 던짐을 단언해 캡처 소유자와 함께(TASKS) |
| L8 | 낮음 | `entrypoints/background.ts:293` | `frameSink.clear()` 가 캡처 시작에만 | 고침 `01a6cef`+`566d2cf` · 교시 종료 `onPeriodEnd` |
| L9 | 낮음 | `src/live/messages.ts:115` | `{type:'live.event', event:{}}` 가 통과 | 고침 `da967eb` |
| L10 | 낮음 | `src/background/router.ts:369` | `handleHostPush` 가 `periodId` 를 대조하지 않음 | 고침 `01a6cef` |

### 보류 (D)

| # | 심각도 | 파일:줄 | 내용 | 처리 |
|---|---|---|---|---|
| D1 | 높음 | `entrypoints/background.ts:70` | 실제 설치본에 Meet 캡처를 시작하는 길이 없음(`capture.start` 를 보내는 코드 없음 · `openPanelOnActionClick:true` 라 아이콘 리스너가 안 불림 · 콘솔 손잡이만) | 보류(오케스트레이터 방침) → 패널 캡처 시작/중지 버튼(TASKS) · README 「손 시험 갈래를 언제 지우나」 에 명시 |
| D2 | 낮음(추정) | `entrypoints/background.ts:458` | 제스처 앞 `await currentPeriodId()` 가 `tabCapture` 의 사용자 제스처 문맥을 끊을 수 있음(D1 때문에 지금은 관측 불가) | 보류 → D1 과 함께 |

## 네이티브 호스트 (`apps/native-host/**`)

실재 14 · 보류 3 · 반박 0. `cargo test --workspace` 254 → 264 · clippy `-D warnings` 0 · fmt 0 · `host-roundtrip.mjs` hello. 가짜 CLI 두 개에는 모드를 더하기만 했습니다(`tests/fake-tutor-cli.mjs --delay-ms` · `crates/providers/tests/fake-claude.mjs --break-stdout-and-linger`). 새 reason 낱말은 만들지 않았습니다. `router.rs` 에는 따옴표 이름 뒤 화살표 모양을 코드에도 주석에도 새로 넣지 않았습니다.

### 실재 (R)

| # | 심각도 | 파일:줄 | 내용 | 처리 |
|---|---|---|---|---|
| R1 | 높음 | `src/router.rs:664` | 라우터 단위시험이 `TutorSources::from_env()` 로 주변 환경의 `CLASSMATE_CLAUDE_CLI` 를 물려받아, 실제 경로가 잡힌 PC 에서 `cargo test` 가 진짜 CLI 를 띄울 수 있었음(되돌린 채 돌리니 `provider-spawn` 까지 감) | 고침 `d54ac5f` · `router_with` 가 `TutorSources::default()` · `tests/no_real_cli_root.rs` 가 `src/router.rs` 도 훑음 · "a_router_for_tests_never_takes_the_cli_path_from_the_environment" |
| R2 | 높음 | `crates/transport/src/lib.rs:297` · `src/tutor/mod.rs:153` | `question` 만 4096바이트로 재고 `word` 에는 상한이 없어 1 MiB 짜리 `word` 가 CLI stdin 으로 흘러가고 되나가는 `tutor.event` 가 프레임 상한을 넘김 | 고침 `88f23aa`+`7254465` · `/word` 도 `question-too-long` · 라우터 끝까지 보는 시험 |
| R3 | 중간 | `src/router.rs:570` | `store_failure` 의 `reason` 이 고정 낱말이 아니라 한국어 문장 | 고침 `d54ac5f` · `reason_code()` |
| R4 | 중간 | `src/tutor/mod.rs:591` · `src/router.rs:284` | 답이 끝난 질문의 `tutor.retry` 가 `tutor.accepted` 를 받고 그 뒤로 영원히 조용함 | 고침 `f36c396` · `UnknownQuestion`("재시도할 것이 없는 질문") · 라우터 시험도 `unknown-question` 으로 |
| R5 | 중간 | `src/tutor/mod.rs:799` | 수동 재시도 한 번이 남은 자동 재시도(15·45초)를 통째로 지움 | 고침 `f36c396` · 수동 시도는 자동 횟수를 소비하지 않음 |
| R6 | 중간(추정) | `crates/providers/src/claude.rs:504` | 성공 경로의 `child.wait()` 에 마감이 없어 stdout 을 닫고도 살아 있는 자식이 회차를 잠금(실측: 20초 마감을 넘겨 실패) | 고침 `de6e950` · `wait_until` 뒤 `kill_tree` |
| R7 | 중간 | `src/tutor/mod.rs:627` | 세우는 중에도 같은 회차에서 다시 묻고 재시도가 먼저 돌아 종료가 45초를 넘김(가짜 CLI 호출 2회 실측) | 고침 `f36c396` · `stopping` 플래그 |
| R8 | 중간 | `src/router.rs:99` · `crates/transport/src/framing.rs:112` | 1 MiB 를 넘는 자발 push 한 건에 `pump_output` 이 되돌아와 호스트 전체가 종료 | 고침 `d54ac5f` · `InvalidData` 는 그 한 건만 stderr 로 버리고 계속 |

### 낮음 (L)

| # | 심각도 | 파일:줄 | 내용 | 처리 |
|---|---|---|---|---|
| L1 | 낮음 | `crates/transport/src/lib.rs:484` | 대조 스크레이퍼가 `router.rs` 전체(주석·시험)를 긁어 갈래를 지워도 통과할 수 있음 | 고침 `88f23aa` · `handle` 본문으로 좁히고 `//` 줄 건너뜀 |
| L2 | 낮음 | `src/tutor/mod.rs:251` | `known` 집합에서 id 가 절대 빠지지 않음(R4 의 원인) | 고침 `f36c396` · 워커가 `forget()` |
| L3 | 낮음 | `src/tutor/materials.rs:145` | `screen_frames` 가 봉인된 id 가 아니라 그 교시의 모든 `screen.frame` 을 세어 재시도마다 자료 문단이 달라짐 | 고침 `f36c396` |
| L4 | 중간 | `crates/providers/README.md:90` · `src/claude.rs:41` · `src/retry.rs:24` · `src/stream_json.rs:32` | 없는 `docs/spikes/gate-c2-provider-latency.md` 경로 4곳 | 고침 `de6e950` |
| L5 | 중간 | `crates/providers/README.md:3` | 시험 수 "(49개 통과)" 가 실제와 다름 | 고침 `de6e950` · 수를 적지 않는 표현 |
| L6 | 낮음 | `src/tutor/README.md:75` | 표 칸 안의 `\|` 미이스케이프 | 고침 `f36c396` |

### 보류 (D)

| # | 심각도 | 파일:줄 | 내용 | 처리 |
|---|---|---|---|---|
| D1 | 낮음 | `crates/providers/src/retry.rs:85` vs `src/tutor/mod.rs:916` | 재시도 간격표가 두 벌 — 다만 뜻이 다름(`RetryPolicy` 는 표가 끝나면 그만, 파이프라인은 마지막 값 되풀이). 기본 설정(3칸·3회)에서는 갈리지 않음 | 보류 → 어느 쪽이 정본인지 계약 결정(TASKS) |
| D2 | 낮음 | `src/router.rs:325` | 워커 스레드가 죽으면 그 교시의 손잡이가 영구 `stopped` 이고 회복 경로가 없음 | 보류 → `tutor_handle` 대여 구조 변경 필요 · 패닉을 주입할 통로가 없어 되돌리면 실패하는 시험을 둘 수 없음(TASKS) |
| D3 | 낮음(추정) | `src/router.rs:120` vs `src/tutor/mod.rs:587` | `tutor.accepted` 와 `question.asked` 의 순서가 보장되지 않음(확률 매우 낮음) | 보류 → `Router::handle` 이 "답 없음" 을 낼 수 있어야 해 응답 계약이 바뀜(TASKS) |

## installer/문서 (`installer/**` · `docs/first-class.md` · 비교 스크립트·README)

실재 19 · 보류 0 · 반박 0(#10·#11·#18 은 호스트 소유라 위 호스트 절에서 처리). `node --test` installer+compare 97 · install dry-run 0 · smoke-host ② `provider-unavailable`(부모 셸에 `CLASSMATE_CLAUDE_CLI` 를 넣고 재실행해도 동일 = 환경 누출 없음).

### 실재 (R)

| # | 심각도 | 파일:줄 | 내용 | 처리 |
|---|---|---|---|---|
| R1 | 높음 | `installer/windows/smoke-host.mjs:100` | 스모크 ② 가 부모 환경을 물려줘 실제 제공자 CLI 를 부를 수 있었고(과금), 15초 상한이 호스트 45초보다 짧아 SIGKILL, 실제 교시 세션 파일에 가짜 `question.asked` 가 쌓임 | 고침 `ff74cf3` · 자식 env 에서 `CLASSMATE_CLAUDE_CLI`·`CLASSMATE_CODEX_CLI` 삭제 · 임시 `CLASSMATE_DATA_DIR` · 1999년 교시 id · 60초 · 시험 "돈이 나가지 않게 하는 장치" 4건 · README §8 |
| R2 | 중간 | `installer/windows/README.md:147` | "두 zip 이 같다" 는 낡은 문장(실측 dev key=있음 / store key=없음) | 고침 `8047f96` |
| R3 | 중간 | `installer/windows/package-extension.mjs:275` | dev zip 에 key 가 없어도 안심 문구를 찍고 exit 0 | 고침 `5ea2b31` · `console.error` + exit 1 · 시험 "두 zip 의 key 판정" 4건 |
| R4 | 중간 | `installer/windows/smoke-host.mjs:8` · `smoke-host.test.mjs:82` | `unknown-message-type` 을 "기대값" 으로 적어 `tutor.ask` 갈래를 잃어도 통과 | 고침 `ff74cf3` · "퇴행 의심" 으로 뒤집음 |
| R5 | 중간 | `docs/first-class.md:137` | 쓰는 PC 절차가 옮기지 않은 저장소 스크립트를 부름(§0·§1-2·§2·§3-4·§6-1 도 같은 전제) | 고침 `8047f96` · §3-3 을 ①`reg` 한 줄(기본) / ②저장소가 있으면 `install.mjs` 로 |
| R6 | 중간 | `docs/screenshots/compare/README.md:67` | "설정 아이콘이 구현에 없다" 가 거짓(`ListeningScreen.tsx:136`) | 고침 `8047f96` |
| R7 | 중간 | `docs/screenshots/compare/README.md:74` | "설정 화면이 구현에 없다" 가 거짓 | 고침 `8047f96` · "정본 A~H 에 없어 비교 표 밖(구현에는 있음)" |
| R8 | 중간 | `apps/browser-extension/README.md:347` | ui-classmate `internal/base` 복제 "남음" 이 거짓 | 고침 `8047f96` |
| R9 | 중간 | `apps/browser-extension/README.md:33` | E2E "9장면"(실제 14) | 고침 `8047f96` |
| R10 | 중간 | `apps/browser-extension/scripts/compare-design.mjs:825` | 정본 9장이 전부 자리표시여도 exit 0 | 고침 `4b1db19` · 시험 "종료 코드 판정" 7건 |

### 낮음 (L)

| # | 심각도 | 파일:줄 | 내용 | 처리 |
|---|---|---|---|---|
| L1 | 낮음 | `installer/windows/build-host.mjs:46` | 후보 순서가 register-host 와 반대인데 "같다" 고 적음 | 고침 `5ea2b31` |
| L2 | 낮음 | `installer/windows/extension-key.test.mjs:52` | "알려진 벡터" 시험이 모듈 상수로 되계산 | 고침 `5ea2b31` · 실측 id `meldoohgnggckjahcchmfjnngpafcjon` 고정 |
| L3 | 낮음 | `installer/windows/README.md:31` · `docs/first-class.md:83` | exe 크기 "약 1.8 MB"(실측 ≈ 2.4 MiB) | 고침 |
| L4 | 낮음 | `installer/windows/paths.mjs:1` | "스크립트 넷"(다섯) | 고침 |
| L5 | 낮음 | `package.json` | `engines.node >=20` vs 문서 "24 이상" | 고침 `5ea2b31` · `>=24` |
| L6 | 낮음 | `apps/browser-extension/README.md:52` | `src/panel/` 그림·표가 2화면 시절 | 고침 `8047f96` |
| L7 | 낮음 | `docs/first-class.md:303` | §8 에 Tiro Max 결제 결정 누락 | 고침 `8047f96` |
| L8 | 낮음 | `packages/ui-classmate/README.md:64` | "9장"(14) | 고침 `8047f96` |
| L9 | 낮음 | `apps/native-host/scripts/register-host.mjs:11` | 형제 스크립트와 "dry-run" 뜻이 다름 | 고침 `5ea2b31` · 주석 1줄 |

## 이번 라운드에서 굳힌 것

- 설정 화면에서 읽는 곳이 없는 스위치는 배선하기 전까지 `disabled` 와 까닭 한 줄로 **정직하게 잠근다**(패널 R4·R5·L1).
- 서비스 워커 복원 자리는 `chrome.storage.session` 하나이고 `storage.local` 로 물러서지 않는다(background L3 · 불변 원칙 §4-1).
- 프레임을 들고 있는 자리는 `NativeHostFrameSink` 한 통뿐이고 `frame.store` 봉투는 `resend:false` 다(background R2).
- 스모크·시험은 자식 프로세스 환경에서 제공자 CLI 변수를 지우고 임시 데이터 폴더·가짜 교시 id 로 돈다(installer R1). 호스트 라우터 시험은 `TutorSources::default()` 만 쓰고 `no_real_cli_root` 가드가 `src/router.rs` 까지 훑는다(호스트 R1).
- 워커 보고의 후속 항목은 `docs/TASKS.md` "2라운드 후속" 블록에 이월했다.
