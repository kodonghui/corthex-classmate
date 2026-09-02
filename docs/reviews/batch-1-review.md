# /batch 1라운드 검토 기록 (2026-09-02)

10단위를 main 에 병합한 뒤 Workflow(단위별 검토자 → medium 이상은 반박 검증자 1명이 "실재/반박" 판정)를 두 파로 돌린 결과입니다.
실재로 판정된 항목은 전부 `batch-1-fix/<단위>` 브랜치에서 고쳐 main 에 병합했고, 낮음(low) 항목은 같은 브랜치에서 함께 고친 것과 보류한 것을 "처리" 칸에 적었습니다.
반박된 항목은 고치지 않았습니다. 원문 증거·제안은 세션 scratchpad 에만 있었으므로 이 표가 정본입니다.

| 파 | 대상 단위 | 실재 | 반박 | 낮음 | 수정 브랜치 → main 병합 |
|---|---|---|---|---|---|
| 1파 | design-tokens · tutor-core · report-ui · ui-base · ui-classmate | 8 | 7 | 28 | tutor-core `be72d12` · report-ui `736badf` · ui-base `37e5c0f` · ui-classmate `4a2a0bb` |
| 2파 | tiro-connectors · meet-capture · session-store · providers · transport | 13 | 8 | 28 | tiro `75db8b6` · capture `46da1d1` · session-store `c37a148` · providers `2af101b` · transport `15527f0` |

## 1파 (단위 1·2·3·4·10, 에이전트 20)

실재 8 · 반박 7 · 낮음 28. "심각도" 는 검토자 판정→반박 검증자의 정정입니다.

### 실재 (R)

| # | 단위 | 파일:줄 | 심각도 | 내용 | 처리 |
|---|---|---|---|---|---|
| R1 | tutor-core | `packages/tutor-core/src/machine.ts:759` | medium→low | 사건의 `at` 이 잘못돼도 조용히 이전 시각으로 넘어간다 (catch 가 오류를 삼킴) | 고침 (`batch-1-fix/tutor-core`) |
| R2 | tutor-core | `packages/tutor-core/test/source-rules.test.ts:66` | medium→medium | `import type` 강제 시험이 `export … from "@classmate/contracts"` 를 놓친다 | 고침 (`batch-1-fix/tutor-core`) |
| R3 | report-ui | `packages/report-ui/src/page-css.ts:73` | medium→low | .card 에 box-shadow 를 넣어 정본의 그림자 제한을 어깁니다 | 고침 (`batch-1-fix/report-ui`) |
| R4 | report-ui | `packages/report-ui/src/assets.ts:53` | medium→low | 프레임 경로를 파일 이름만 남겨 평평하게 만들어 다른 그림이 조용히 덮어써집니다 | 고침 (`batch-1-fix/report-ui`) |
| R5 | report-ui | `packages/report-ui/src/page-css.ts:158` | medium→medium | Meet 장면 그림을 40px 상자에 넣어 복습에 못 쓰는 크기로 그립니다 | 고침 (`batch-1-fix/report-ui`) |
| R6 | ui-base | `packages/ui-base/src/icons.ts:9` | medium→low | 정본 ui_kits/sidepanel 이 쓰는 trash-2 가 아이콘 맵에 없고, 커버리지 시험도 그 폴더를 보지 않습니다 | 고침 (`batch-1-fix/ui-base`) |
| R7 | ui-classmate | `packages/ui-classmate/src/icons.ts:70` | medium→low | 아이콘 맵이 ui-base 와 어긋남 — 2라운드 교체 시 아이콘 9개가 조용히 사라진다 | 고침 (`batch-1-fix/ui-classmate`) |
| R8 | ui-classmate | `packages/ui-classmate/test/copy.test.ts:35` | medium→low | 문구 결정 시험 2개가 제품 코드가 아니라 형제 시험 파일의 글자를 본다 | 고침 (`batch-1-fix/ui-classmate`) |

### 낮음 (L)

| # | 단위 | 파일:줄 | 심각도 | 내용 | 처리 |
|---|---|---|---|---|---|
| L1 | design-tokens | `packages/design-tokens/scripts/generate-tokens.mjs:97` | low | 생성기가 같은 이름의 뒤 선언이 아니라 앞 선언을 남긴다 (CSS 종속 규칙과 반대, 지금은 잠재) | 보류 → TASKS 후속 |
| L2 | design-tokens | `packages/design-tokens/test/tokens.test.ts:75` | low | 토큰 값 시험이 196개 중 6개만 표본 검사한다 — 생성기 파싱 회귀를 아무 시험도 잡지 못한다 | 보류 → TASKS 후속 |
| L3 | design-tokens | `packages/design-tokens/src/index.ts:12` | low | 저장소 상대 경로 문자열과 시험 보조 상수가 패키지 공개 API 로 나가 있다 | 보류 → TASKS 후속 |
| L4 | design-tokens | `packages/design-tokens/README.md:31` | low | 정본과 다른 자리 목록이 styles.css 도 다시 쓴 사실을 빠뜨린다 | 보류 → TASKS 후속 |
| L5 | design-tokens | `packages/design-tokens/vitest.config.ts:3` | low | 패키지가 완성됐는데 vitest 설정 주석이 아직 "스켈레톤" 이라고 말한다 | 보류 → TASKS 후속 |
| L6 | tutor-core | `packages/tutor-core/src/machine.ts:135` | low | MachineState.now 의 "앞으로만 갑니다" 불변이 코드에 강제되지 않는다 | 고침 (`batch-1-fix/tutor-core`) |
| L7 | tutor-core | `packages/tutor-core/src/machine.ts:695` | low | EXIT_RECALL 에서 새 질문을 붙잡아도 이전 answerId·answerStatus 가 남는다 | 보류 → TASKS 후속 |
| L8 | tutor-core | `packages/tutor-core/src/machine.ts:424` | low | DELAYED_CHECK → CAPTURE 로 돌아와도 periodEnded 가 true 로 남아 교시 뒤 흐름이 되풀이된다 | 보류 → TASKS 후속 |
| L9 | tutor-core | `packages/tutor-core/src/machine.ts:616` | low | ANSWER_MINIMAL 의 chip 이 note 가 minimal 이 아닐 때 ignored 표시 없이 조용히 넘어가고, 그 갈래는 시험이 없다 | 고침 (`batch-1-fix/tutor-core`) |
| L10 | tutor-core | `packages/tutor-core/test/helpers.ts:3` | low | helpers.ts 머리말의 "여기에서만 계약을 값으로 들여옵니다" 가 사실과 다르다 | 고침 (`batch-1-fix/tutor-core`) |
| L11 | report-ui | `packages/report-ui/src/labels.ts:5` | low | 주석이 없는 시험 파일(test/labels.test.ts)을 근거로 댑니다 | 보류 → TASKS 후속 |
| L12 | report-ui | `packages/report-ui/src/page-css.ts:134` | low | 칩·근거 알약의 모서리가 정본 규칙(4px·6px)이 아니라 --radius-full 입니다 | 보류 → TASKS 후속 |
| L13 | report-ui | `packages/report-ui/test/page-css.test.ts:59` | low | 언제나 참인 단언이 하나 있고 그 상수는 코드에서 쓰이지 않습니다 | 고침 (`batch-1-fix/report-ui`) |
| L14 | report-ui | `packages/report-ui/src/templates/PeriodPage.ts:232` | low | 칸이 빠진 기록 하나가 하루 전체 생성을 멈춥니다 | 고침 (`batch-1-fix/report-ui`) |
| L15 | report-ui | `packages/report-ui/src/render.ts:41` | low | React 밖에서 잇는 <style> 에 </style> 를 막는 자리가 없습니다 | 고침 (`batch-1-fix/report-ui`) |
| L16 | report-ui | `packages/report-ui/src/templates/HubPage.ts:115` | low | 교시 번호가 겹치면 상세 HTML 이 조용히 덮어써지고 안내 문구도 틀립니다 | 고침 (`batch-1-fix/report-ui`) |
| L17 | report-ui | `packages/report-ui/src/page-css.ts:88` | low | 선생님 말 전사에 정본의 --type-transcript 대신 --type-body 를 씁니다 | 보류 → TASKS 후속 |
| L18 | ui-base | `packages/ui-base/src/components/core/Icon.tsx:27` | low | 배포 빌드 침묵 가드가 process 전역이 없는 브라우저 번들에서 반대로 동작합니다 | 고침 (`batch-1-fix/ui-base`) |
| L19 | ui-base | `packages/ui-base/test/source-hygiene.test.ts:72` | low | 색 하드코딩 시험이 hex 만 봅니다 — rgb()·hsl()·색 이름은 그냥 통과합니다 | 고침 (`batch-1-fix/ui-base`) |
| L20 | ui-base | `packages/ui-base/test/css-parity.test.ts:64` | low | CSS 동일성 시험이 "css() 를 한 번 부른다"고 이름 붙였지만 존재 여부만 봅니다 | 고침 (`batch-1-fix/ui-base`) |
| L21 | ui-base | `packages/ui-base/src/components/feedback/Evidence.tsx:34` | low | src 안에 정본에서 그대로 옮겨 온 영어 한 줄 주석 2개가 남아 있습니다 | 고침 (`batch-1-fix/ui-base`) |
| L22 | ui-classmate | `packages/ui-classmate/src/internal/base/StatusDot.tsx:19` | low | StatusDot 의 label 판정이 정본·ui-base 와 다르다 | 고침 (`batch-1-fix/ui-classmate`) |
| L23 | ui-classmate | `packages/ui-classmate/src/components/AnswerCard.tsx:149` | low | AnswerCard 의 절 key 가 정본의 || 대신 ?? 를 쓴다 | 고침 (`batch-1-fix/ui-classmate`) |
| L24 | ui-classmate | `packages/ui-classmate/src/internal/base/Icon.tsx:19` | low | Icon 의 개발 경고가 MV3 번들(process 없음)에서는 아예 켜지지 않는다 | 고침 (`batch-1-fix/ui-classmate`) |
| L25 | ui-classmate | `packages/ui-classmate/test/structure.test.ts:62` | low | structure.test.ts 의 규칙 번호가 (1)(3)(4) 로 (2) 가 비어 있고, (1) 은 주석이 약속한 것보다 적게 검사한다 | 고침 (`batch-1-fix/ui-classmate`) |
| L26 | ui-classmate | `packages/ui-classmate/src/components/TranscriptFlow.tsx:46` | low | src 의 주석·JSDoc 이 영어다 | 고침 (`batch-1-fix/ui-classmate`) |
| L27 | ui-classmate | `packages/ui-classmate/package.json:17` | low | @classmate/contracts 를 의존성에 두고 아무 데서도 쓰지 않는다 | 보류 → TASKS 후속 |
| L28 | ui-classmate | `packages/ui-classmate/src/styles.css:160` | low | styles.css 에 rgba() 하드코딩 색 3곳 | 고침 (`batch-1-fix/ui-classmate`) |

### 반박됨 (X)

| # | 단위 | 파일:줄 | 심각도 | 내용 | 처리 |
|---|---|---|---|---|---|
| X1 | tutor-core | `packages/tutor-core/src/machine.ts:501` | medium→low | 준비(PREP 1.6초) 만료를 깨울 예약 효과가 없어, 답이 1.6초 안에 오면 preparing 에서 풀리지 않는다 | 반박됨 · 고치지 않음 |
| X2 | tutor-core | `packages/tutor-core/src/machine.ts:68` | medium→low | 명세에 없는 사용자 입력 `next` 가 DECISIONS.md 에 기록되지 않았고, §3-4 의 "적응형 스케줄"과 어긋난다 | 반박됨 · 고치지 않음 |
| X3 | tutor-core | `packages/tutor-core/src/machine.ts:96` | medium→low | 디자인 상태 D(문장 붙잡음 · MarginNote choosing + GuessList)에 대응하는 메모 자리와 입력이 없다 | 반박됨 · 고치지 않음 |
| X4 | report-ui | `packages/report-ui/src/tokens.ts:54` | medium→low | 토큰 CSS 읽기 실패를 조용히 삼켜 꾸밈이 전혀 없는 HTML 을 성공으로 알립니다 | 반박됨 · 고치지 않음 |
| X5 | report-ui | `packages/report-ui/test/page-css.test.ts:96` | medium→low | 잎 패키지 import 금지 시험이 이름과 달리 design-tokens 한 개만 봅니다 | 반박됨 · 고치지 않음 |
| X6 | ui-classmate | `packages/ui-classmate/src/internal/base/Evidence.tsx:44` | medium→low | Evidence type 이름이 계약 EvidenceLevel 과 달라 stale 이 확인됨 으로 조용히 바뀐다 | 반박됨 · 고치지 않음 |
| X7 | ui-classmate | `packages/ui-classmate/src/internal/base/Icon.tsx:36` | medium→low | Icon 의 title="" 처리가 정본·ui-base 와 다르다 — 이름 없는 role=img 가 생긴다 | 반박됨 · 고치지 않음 |

## 2파 (단위 5·6·7·8·9, 에이전트 26)

실재 13 · 반박 8 · 낮음 28. "심각도" 는 검토자 판정→반박 검증자의 정정입니다.

### 실재 (R)

| # | 단위 | 파일:줄 | 심각도 | 내용 | 처리 |
|---|---|---|---|---|---|
| R1 | tiro-connectors | `apps/browser-extension/src/tiro/share-observer.ts:151` | medium→low | seq 를 문단 순서가 아니라 방출 순서로 매겨 전사 순서가 뒤집힐 수 있다 | 고침 (`batch-1-fix/tiro-connectors`) |
| R2 | tiro-connectors | `apps/browser-extension/entrypoints/tiro-share.content.ts:80` | medium→medium | content script 가 URL 을 document_idle 에 한 번만 보고 SPA 내부 이동을 따라가지 않는다 | 고침 (`batch-1-fix/tiro-connectors`) |
| R3 | meet-capture | `apps/browser-extension/entrypoints/offscreen/main.ts:183` | medium→medium | Offscreen startCapture 가 getUserMedia 뒤 예외에서 탭 스트림과 <video> 를 놓아 준다 | 고침 (`batch-1-fix/meet-capture`) |
| R4 | meet-capture | `apps/browser-extension/entrypoints/offscreen/main.ts:63` | medium→medium | 회차 한 번이 실패하면 capture 상태가 영원히 'error' 로 굳는다 | 고침 (`batch-1-fix/meet-capture`) |
| R5 | meet-capture | `apps/browser-extension/src/capture/frame-store.ts:155` | medium→medium | 프레임 id 가 교시를 담지 않고 캡처를 다시 시작할 때마다 sf-001 부터 다시 붙는다 | 고침 (`batch-1-fix/meet-capture`) |
| R6 | meet-capture | `apps/browser-extension/src/capture/host-messages.ts:220` | medium→low | 봉투 크기를 재려고 프레임 하나를 서비스 워커에서 세 번 더 통째로 만든다 | 고침 (`batch-1-fix/meet-capture`) |
| R7 | session-store | `apps/native-host/src/store/clock.rs:66` | high | clock.rs 가 UTF-8 경계를 보지 않고 &text[17..19] 를 잘라 at·capturedAt 값 하나로 호스트 프로세스가 패닉으로 죽는다 | 고침 (`batch-1-fix/session-store`) |
| R8 | session-store | `apps/native-host/src/store/clock.rs:113` | high→high | parse_offset 의 4자 오프셋 분기도 같은 방식으로 패닉한다 | 고침 (`batch-1-fix/session-store`) |
| R9 | session-store | `apps/native-host/src/store/frames.rs:249` | medium→medium | 프레임 이벤트 id 를 `ev-<frame id>` 로 지어 append 의 id 중복 무시와 겹치면 frames 행만 남고 screen.frame 기록이 사라진다 | 고침 (`batch-1-fix/session-store`) |
| R10 | session-store | `apps/browser-extension/src/capture/host-messages.ts:60` | medium→low | frame.stored 의 seq 를 확장은 "몇 번째 프레임", 호스트는 "이벤트 순번" 으로 서로 다르게 적어 두었다 | 고침 (`batch-1-fix/session-store`) |
| R11 | providers | `apps/native-host/crates/providers/tests/claude_fake_cli.rs:79` | medium→medium | stdin 전용 전달을 주장하는 시험이 실제로 stdin 도달을 확인하지 않는다 | 고침 (`batch-1-fix/providers`) |
| R12 | providers | `apps/native-host/crates/providers/tests/no_real_cli.rs:48` | medium→low | no_real_cli.rs 의 검사 낱말이 이 크레이트가 실제로 쓰는 실행 모양을 덮지 않는다 | 고침 (`batch-1-fix/providers`) |
| R13 | transport | `apps/native-host/crates/transport/src/lib.rs:53` | medium→medium | 봉투 표 ENVELOPE_RULES 에 frame.store 가 빠져 main.rs Router 와 어긋난다 | 고침 (`batch-1-fix/transport`) |

### 낮음 (L)

| # | 단위 | 파일:줄 | 심각도 | 내용 | 처리 |
|---|---|---|---|---|---|
| L1 | tiro-connectors | `apps/browser-extension/src/tiro/share-parser.ts:64` | low | 파서가 서로 겹치는 요소를 걸러 내지 않아 감싸는 div 하나로 전사 전체가 한 문단이 될 수 있다 | 고침 (`batch-1-fix/tiro-connectors`) |
| L2 | tiro-connectors | `apps/browser-extension/entrypoints/tiro-share.content.ts:116` | low | 생명주기 해제 함수를 버려 tiro.stop 뒤에도 리스너가 남는다 | 고침 (`batch-1-fix/tiro-connectors`) |
| L3 | tiro-connectors | `apps/browser-extension/src/tiro/index.ts:136` | low | 커넥터 stop() 이 리스너까지 지워 재시작하면 아무도 세그먼트를 못 받는다 | 고침 (`batch-1-fix/tiro-connectors`) |
| L4 | tiro-connectors | `apps/browser-extension/src/tiro/period.ts:87` | low | readPeriodNumber 가 '값 없음'과 '읽기 실패'를 똑같이 1 로 돌려줘 부르는 쪽이 구분할 수 없다 | 고침 (`batch-1-fix/tiro-connectors`) |
| L5 | tiro-connectors | `apps/browser-extension/src/tiro/period.ts:109` | low | 주입된 periodId 를 계약 모양으로 검사하지 않아 계약 위반 세그먼트가 만들어질 수 있다 | 고침 (`batch-1-fix/tiro-connectors`) |
| L6 | tiro-connectors | `apps/browser-extension/src/tiro/share-observer.test.ts:474` | low | 스텁 시험의 이름과 대상이 어긋나고 createMcpConnector 의 kind 를 아무도 확인하지 않는다 | 고침 (`batch-1-fix/tiro-connectors`) |
| L7 | meet-capture | `apps/browser-extension/src/capture/frame-store.ts:150` | low | FrameStore 가 계약·호스트보다 느슨해 호스트가 거절할 값을 그대로 통과시킨다 | 고침 (`batch-1-fix/meet-capture`) |
| L8 | meet-capture | `apps/browser-extension/src/capture/host-messages.ts:216` | low | buildFrameStore 가 프레임을 펼쳐 담아 계약 아홉 칸 밖의 값이 봉투에 실릴 수 있다 | 고침 (`batch-1-fix/meet-capture`) |
| L9 | meet-capture | `apps/browser-extension/src/capture/sampling-loop.ts:104` | low | SamplingLoop 은 간격 0 을 받아들여 resolveCaptureSettings 와 규칙이 어긋난다 | 고침 (`batch-1-fix/meet-capture`) |
| L10 | meet-capture | `apps/browser-extension/entrypoints/offscreen/main.ts:217` | low | 탭 공유 종료 리스너가 지나간 세션을 닫으며 지금 세션을 멈출 수 있다 | 고침 (`batch-1-fix/meet-capture`) |
| L11 | meet-capture | `apps/browser-extension/entrypoints/background.ts:210` | low | 손 시험용 chrome.action.onClicked 갈래와 globalThis.classmateCapture 손잡이가 배포 빌드에 그대로 남는다 | 고침 (`batch-1-fix/meet-capture`) |
| L12 | session-store | `apps/native-host/src/store/frames.rs:353` | low | write_then_rename 이 쓰기·flush 실패에서는 .part 임시 파일을 지우지 않는다 | 고침 (`batch-1-fix/session-store`) |
| L13 | session-store | `apps/native-host/src/store/mod.rs:501` | low | state.changed payload 의 여분 키와 SessionEvent 의 여분 최상위 칸을 계약보다 느슨하게 받는다 | 고침 (`batch-1-fix/session-store`) |
| L14 | session-store | `apps/native-host/src/main.rs:283` | low | frame.store 밖의 error 응답 두 종류가 확장의 HostErrorMessage 판별을 통과하지 못한다 | 고침 (`batch-1-fix/session-store`) |
| L15 | session-store | `apps/native-host/src/store/mod.rs:325` | low | append 의 id 기반 중복 무시가 내용이 다른 이벤트도 조용히 버리고 event.ack 로 답한다 | 고침 (`batch-1-fix/session-store`) |
| L16 | session-store | `apps/native-host/tests/recovery.rs:114` | low | 복구 시험이 자식이 500 ms 안에 한 줄이라도 쓰는 것에 기대어 부하가 걸린 기계에서 흔들릴 수 있다 | 고침 (`batch-1-fix/session-store`) |
| L17 | session-store | `apps/native-host/tests/recovery.rs:58` | low | 단언이 하나도 없는 시험 둘과 주변 환경에 따라 분기가 갈리는 시험 하나가 있다 | 고침 (`batch-1-fix/session-store`) |
| L18 | session-store | `apps/native-host/src/store/mod.rs:297` | low | 같은 단위 안에서 주석 말투가 존댓말(frames·base64)과 반말(mod·clock·main)로 갈린다 | 고침 (`batch-1-fix/session-store`) |
| L19 | providers | `apps/native-host/crates/providers/src/claude.rs:364` | low | 프롬프트 쓰기 실패를 `let _ =` 로 버려 원인이 사라진다 | 고침 (`batch-1-fix/providers`) |
| L20 | providers | `apps/native-host/crates/providers/src/claude.rs:429` | low | 타임아웃·프로토콜 오류 경로에서 stderr 읽기 스레드를 join 하지 않아 진단이 비어 있다 | 고침 (`batch-1-fix/providers`) |
| L21 | providers | `apps/native-host/crates/providers/src/claude.rs:261` | low | node 런타임 탐색이 `node.cmd` 를 받아들여 손자 프로세스 문제를 되살릴 수 있다 | 고침 (`batch-1-fix/providers`) |
| L22 | providers | `apps/native-host/crates/providers/src/stream_json.rs:160` | low | `type` 없는 JSON 객체 처리가 spike 와 같다고 적혀 있으나 실제로는 다르다 | 고침 (`batch-1-fix/providers`) |
| L23 | providers | `apps/native-host/crates/providers/src/lib.rs:1` | low | Rust 주석·doc comment 가 형제 크레이트와 달리 존댓말이 아니다 | 고침 (`batch-1-fix/providers`) |
| L24 | transport | `apps/native-host/scripts/host-roundtrip.test.mjs:3` | low | roundTrip() 이 시험 한 줄 없이 남아 실패 갈래가 전혀 확인되지 않는다 | 고침 (`batch-1-fix/transport`) |
| L25 | transport | `apps/native-host/scripts/register-host.mjs:51` | low | register-host 의 실행 파일 탐색이 CARGO_TARGET_DIR 을 보지 않고, 없는 --exe 도 막지 않는다 | 고침 (`batch-1-fix/transport`) |
| L26 | transport | `apps/native-host/crates/transport/src/schema.rs:437` | low | type 배열에서 앞 이름이 맞으면 뒤의 모르는 type 이름을 조용히 통과시킨다 | 고침 (`batch-1-fix/transport`) |
| L27 | transport | `apps/native-host/crates/transport/src/schema.rs:994` | low | 윤초 판정이 시간대 오프셋을 셈에 넣지 않아 ajv-formats 와 갈린다 | 고침 (`batch-1-fix/transport`) |
| L28 | transport | `apps/native-host/scripts/register-host.mjs:2` | low | 두 스크립트의 주석만 해라체라 단위 안에서도 저장소 다수와도 어긋난다 | 고침 (`batch-1-fix/transport`) |

### 반박됨 (X)

| # | 단위 | 파일:줄 | 심각도 | 내용 | 처리 |
|---|---|---|---|---|---|
| X1 | tiro-connectors | `apps/browser-extension/src/tiro/share-observer.ts:206` | medium→low | 문단 신원을 위치(index)로만 잡아 DOM 재색인이 일어나면 전사가 조용히 영구 손실된다 | 반박됨 · 고치지 않음 |
| X2 | tiro-connectors | `apps/browser-extension/src/tiro/share-observer.ts:188` | medium→low | 선택자 깨짐 유예를 DOM 변경에만 기대어 전사가 완전히 멈추면 경보가 영영 안 난다 | 반박됨 · 고치지 않음 |
| X3 | meet-capture | `apps/browser-extension/src/capture/frame-sink.ts:69` | medium→low | MemoryFrameSink 의 '60분·48MiB 보관' 은 MV3 서비스 워커에서 지켜지지 않는다 | 반박됨 · 고치지 않음 |
| X4 | session-store | `apps/native-host/src/main.rs:196` | medium→low | session.export 는 확장이 준 문자열을 그대로 파일 경로로 써서 쓰기 가능한 아무 폴더(UNC 포함)에나 교시 기록 전체를 쓴다 | 반박됨 · 고치지 않음 |
| X5 | providers | `apps/native-host/crates/providers/src/claude.rs:343` | medium→low | `--model` 값이 argv 로 실리고 cmd.exe /c 폴백에서 셸이 다시 해석한다 | 반박됨 · 고치지 않음 |
| X6 | providers | `apps/native-host/crates/providers/src/claude.rs:390` | medium→low | stdout 의 UTF-8 아닌 바이트 한 개가 스트림을 조용히 끝내 잘린 답이 성공으로 돌아갈 수 있다 | 반박됨 · 고치지 않음 |
| X7 | transport | `apps/native-host/crates/transport/src/schema.rs:643` | medium→low | safe_name 이 유니코드 is_alphanumeric 을 써서 한글·CJK 주입 문자열을 오류 문구로 되돌려 보낸다 | 반박됨 · 고치지 않음 |
| X8 | transport | `apps/native-host/scripts/host-roundtrip.mjs:151` | medium→low | host-roundtrip 의 spawnSync 에 timeout 이 없어 호스트가 안 끝나면 영원히 기다린다 | 반박됨 · 고치지 않음 |
