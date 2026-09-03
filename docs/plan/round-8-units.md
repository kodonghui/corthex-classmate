# 8라운드 작업 단위 — 요구사항에서 역으로 뽑은 정본

**이 문서의 실행 정본은 아래 §0 입니다.** §0 밖의 U-01~U-32 서술은 조사 근거 기록이지
작업 지시가 아닙니다. 과설계 검토(2026-09-03 저녁)로 34단위 중 6개만 남았습니다.

2026-09-03. 저장소 여섯 영역을 병렬로 읽어 기능 111개를 세고, 거기서 요구사항 22개를
역으로 도출한 뒤 의존성으로 위상 정렬한 결과입니다. 조사 근거는 각 단위의 `파일` 줄에
저장소 상대 경로로 적혀 있습니다.

**읽는 법**
- `계약` = 여럿이 기다리는 것. 먼저 세우지 않으면 그 위 화면을 두 번 만듭니다.
- `고침` = 코드가 있는데 조건이 좁아 결과가 안 나오는 것.
- `신규` = 그 일을 하는 코드가 아예 없는 것.
- `사람` = 로그인·승인·실측처럼 사람만 할 수 있는 것. 워커가 하지 않습니다.
- `충돌` = 같은 파일을 건드려 **같은 파에 둘이 못 들어가는** 단위들입니다.

**먼저 할 일 (모든 워커 공통)**
인벤토리의 줄 번호는 이미 밀렸습니다. 예를 들어 `lesson-view.ts:318`(짐작)은 지금
`:403` 근처입니다. 그 사이에 `meetTrouble` · `MEET_TROUBLE_LINE` · `streamOf` 가
새로 들어왔습니다. **줄 번호를 그대로 믿고 패치를 만들지 말고, 심벌 이름으로 다시 찾으십시오.**

---

## §0 과설계 검토 결과 — 이번 라운드는 34개가 아니라 6개입니다

2026-09-03 저녁. 세 관점(과설계 사냥 · 중복 포섭 · 과소설계 반대편)이 34단위를 각각
전수 판정하고 네 번째가 조정했습니다. **아래 목록이 이 문서의 실행 정본입니다.**
§0 밖의 U-01~U-32 서술은 근거 기록으로 남겨 둔 것이지 작업 지시가 아닙니다.

판정 근거가 된 사실: 쓰는 사람은 한 명, 하루 8교시, 오늘 실측 질문 29건·저장 2.1 MB.
학습자가 입으로 말한 불만은 다섯뿐입니다 — 21~25초 지연 · 문단 연달아 못 누름 ·
한 줄 결론이 도움 안 됨 · 밀려난 질문이 대화 칸에 뜸 · 화면 0장.
**34단위 중 이 다섯에 닿는 것은 U-06·U-10·U-33·U-34 넷입니다.**

### 이번 라운드 (순서대로)

| # | 무엇 | 크기 | 근거 |
|---|---|---|---|
| U-33 | 한 줄 결론 옆에 답 본문 첫 문단을 그 자리에 | S | 학습자 발언 ③ |
| U-34 | 밀려난 붙잡기 질문을 대화 칸에서 빼고 그 줄에 | M | 학습자 발언 ④ |
| U-22 | 시험 네 갈래를 루트 명령 하나로 (**CI 는 만들지 않음**) | S | 위 둘을 잡아 줄 그물 |
| U-23 | 코드와 반대로 말하는 문서 두 줄 | S | 되돌림 방지 |
| U-21 | 기록 저장이 거절돼도 화면이 모르는 통로 | S | `router.ts:1002` |
| U-06 | Meet 캡처 실측 — 숫자 두 개 (사람) | M | 학습자 발언 ⑤ |

**U-33 은 M 이 아니라 S 입니다.** `MarginNote` 의 `children` 이 `collapsed` 를 뺀
모든 상태에서 헤더 아래에 그려지고 `details.why` 는 `lesson-view` 가 이미 뽑습니다.
새 컴포넌트도 새 prop 도 필요 없습니다. `answerLength` 배선(U-04·U-15)을 기다리지 말고
full 고정으로 갑니다. U-10 의 남은 시험 한 건과 U-24 의 접기 가드를 같은 커밋에 흡수합니다.

**U-34 는 `#carryOverPending`(replay-store.ts:1211)을 지우는 것으로 구현하면 안 됩니다.**
지우면 앞 질문의 답이 `#isStaleAnswer`(:511)에 걸려 라이브 화면 어디에도 안 뜹니다.
대화 칸은 못생긴 자리이지 쓸데없는 자리가 아닙니다. **옮길 자리(그 줄 메모 자리
「기다리는 중」)를 먼저 만들고 나서 걷어냅니다.** U-18·U-20③ 을 흡수하며,
U-33 과 파일 둘을 공유하므로 같은 사람이 이어서 합니다.

**U-22 에서 `.github/workflows` 는 뺍니다.** `.github` 폴더가 없고 로컬 main 이
`origin/main` 보다 37커밋 앞선 채 멈춰 있습니다. push 를 재개하는 날 그때 만듭니다.

### 삭제 (되살릴 계획 없음)

| # | 왜 |
|---|---|
| U-08 | `#clearDelta` 가 답 사건 네 갈래에서 조각을 비우고, 답이 안 오면 60초 워치독이 `answer.failed` 를 내 같은 길로 비웁니다. 「영원한 쓰는 중」이 실제로 안 생깁니다 |
| U-12 | 자세히는 몇 초 보는 화면이고 돌아가면 바닥줄이 바로 보입니다. 붙일 대상(U-01)도 안 만듭니다 |
| U-19 | 대화 칸 비율 기억. P2 편의이고 아무도 말한 적 없습니다 |
| U-24 | 전제가 화면에서 못 밟는 경로입니다 — `onDetail` 을 넘기는 곳은 `case "ready"` 하나뿐이라 답 오기 전에는 「자세히 보기」 단추가 없습니다 |
| U-25 | 리듀서 4상태와 120칸 전수 시험이 있는데 `kind:"next"` 를 내는 곳이 제품에 0곳. 만들 단위가 아니라 기능 셈에서 뺄 후보입니다 |

### 연기 — 되살릴 조건을 함께 적습니다

| # | 언제 되살리나 |
|---|---|
| U-01 | 학습자가 「연결 표시가 사실과 다르다」고 말할 때. 새 계약이 아니라 `history-view` 의 `footerSourceOf` 를 공용으로 옮기는 S 로 |
| U-02 | 기록에서 멈춘 질문이 「정리 중」으로 남아 헷갈린다고 말할 때 |
| U-03 | U-13 이나 U-14 를 집는 날 — 같은 커밋에 |
| U-04 | U-15 를 집는 날 — 같은 커밋에 |
| U-05 | U-28 이나 U-30 을 집기 직전 (앞선 30분짜리 일) |
| U-07 | 학습자가 「지금 보는 코드를 놓고 묻고 싶다」고 말할 때 |
| U-09 | U-06 이 「앞 탭에서도 0장」으로 나올 때 |
| U-11 | 「잘못 눌렀는데 닫을 수가 없다」고 말할 때. 그때도 Esc 한 줄부터 |
| U-13 | 「Meet 보다가 붙잡으려면 패널을 눌러야 해서 놓친다」고 말할 때 |
| U-14 | U-06 이 「한 장으로 부족」이라 하고 **또한** 지우는 길(U-30 축소판)이 먼저 선 뒤. 두 조건을 다 채워야 |
| U-15 | 학습자가 특정 칸을 「이걸 끄고 싶다」고 말할 때. 배선 먼저·잠금 해제 나중 |
| U-16 | 「다시 연결이 안 먹는다」고 말하거나 기록에 같은 문단이 두 줄 보일 때. **연기한 것 중 물릴 확률이 가장 높음** |
| U-17 | 확장을 다른 사람 PC 에 얹기로 정한 날. `if` 한 줄 |
| U-18 | U-34 에 흡수됨 |
| U-20 | ③ 은 U-34 에 흡수. ①② 는 U-02 와 함께 |
| U-26 | U-34 뒤에도 「연달아 물으면 두 번째가 조용하다」고 말할 때. `ProviderQueue` 배선은 하지 않음 |
| U-27 | 호스트 재시작 뒤 「다시」가 거절되는 것을 한 번 실측했을 때 |
| U-28 | API 요금제로 갈아타거나 한도 경고를 다시 볼 때. `model`·`cost_usd` 두 칸만 |
| U-29 | 「오늘 배운 걸 복습자료로 뽑아 줘」라고 말할 때 |
| U-30 | 「잘못 담긴 걸 지우고 싶다」고 말할 때, 또는 U-14 직전. 「설정에 세션 폴더 절대 경로 한 줄」 XS 부터 |
| U-31 | U-07 이 「포트가 열리고 발췌가 나온다」고 말한 뒤 |
| U-32 | 끌다 손 떼면 문장 전체가 붙잡히는 오발을 겪을 때. 끌기·클릭을 가르는 규칙 하나만 |

### 이으면 안 되는 죽은 코드

제품 경로에서 호출 0곳임을 확인했습니다 — `ProviderQueue`(생성은 시험에서만) ·
`RetryPolicy`(`lib.rs` 재수출뿐, 자기 주석이 "표만 답하고 기다리지는 않습니다") ·
`CodexAppServerProvider`(재수출 + 가드 시험뿐) · `cancelChoosing` · `pushEditor` ·
`FoldTimer` · `kind:"next"`. **배선을 이으면 한 번도 실행된 적 없는 경로가 그 순간
제품에 들어옵니다.** U-25·U-26·U-31 을 미루는 실질 근거가 이것입니다.

### 34단위 밖이지만 값싼 것 하나

호스트 `hello` 답의 `protocol` 칸을 읽는 코드가 `src/background` 전체에 0곳입니다
(`host-messages.ts:105` 에 선언만). 확장과 호스트 exe 를 사람이 따로 얹는 구조라
**exe 만 잊는 일이 손으로 설치하기 때문에 오히려 잘 일어납니다.** U-01 을 되살리는 날
커넥터 계약에 한 줄로 얹으면 거의 공짜입니다.

---

## 학습자가 직접 말한 것 (2026-09-03 16:0x · 최우선)

### U-33 한 줄 결론만으로는 도움이 안 된다 — 본문까지 그 자리에 (고침/M)

지금 붙잡기 메모는 40자 결론과 칩만 보여 주고, 답 본문(「왜 그런가요」)은
**「자세히 보기」를 눌러야** 나옵니다. 학습자 말 그대로: 「한 줄로 설명해줘서 뭐 도움이 안돼」.

- 메모(`MarginNote` ready 갈래)에 결론 다음으로 `details.why` 의 **첫 문단**을 그대로 보여 준다.
- 「자세히 보기」는 남기되, 그것은 나머지 절(내 코드와 비교 · 선생님이 말한 부분)로 가는 길이 된다.
- 접기 시계(18초)는 본문이 보이는 동안에는 **걸지 않는다** — 읽는 중에 접히면 안 된다.
- 설정 `answerLength`(short|full)가 이미 저장소에 있으나 읽는 곳이 0줄이다. U-04·U-15 가
  그 배선을 만들면 이 단위의 기본값을 설정으로 바꿀 수 있게 된다. **이 단위는 기본값을 full 로 둔다.**

파일: `apps/browser-extension/src/panel/lesson-view.ts` ·
`apps/browser-extension/src/panel/screens/ListeningScreen.tsx` ·
`packages/ui-classmate/src/components/MarginNote.tsx`
의존: 없음 · 충돌: U-01, U-10, U-12, U-18 · REQ: REQ-01, REQ-13
검증: `pnpm --filter @classmate/browser-extension test -- panel-dom screens` —
답이 온 뒤 메모 안에 결론과 본문 첫 문단이 함께 있고, 30초를 밀어도 접히지 않는다.

### U-34 밀려난 질문이 대화 칸에 뜨는 것을 멈춘다 (고침/M)

답을 기다리는 중에 다른 문단을 누르면 `#carryOverPending`(`replay-store.ts:1211`)이
앞 질문을 `FollowUpAsk` 로 만들어 **아래 대화 칸에 넣습니다.** 학습자 말 그대로:
「대화창은 내가 따로 질문하는거면 좋겠는데」.

- 대화 칸은 **학습자가 직접 친 질문**(kind `free`)만 담는다.
- 밀려난 붙잡기 질문은 전사 옆에 그대로 남는다 — 그 줄의 메모 자리에 「기다리는 중」으로
  두거나, 전사 위 고정 띠에 둔다. 어느 쪽인지 이 단위에서 정하고 근거를 주석에 적는다.
- 답이 늦게 와도 그 자리에서 채워져야 한다. **버리지 않는 것이 이 단위의 핵심**이다(REQ-11).
- U-20 이 같은 파일(`replay-store.ts`)을 건드리므로 같은 파에 두지 않는다.

파일: `apps/browser-extension/src/panel/replay-store.ts` ·
`apps/browser-extension/src/panel/lesson-view.ts` ·
`apps/browser-extension/src/panel/screens/ListeningScreen.tsx`
의존: 없음 · 충돌: U-01, U-10, U-12, U-18, U-20, U-33 · REQ: REQ-11
검증: `pnpm --filter @classmate/browser-extension test -- live-store panel-dom` —
Q1 을 기다리는 중 Q2 를 붙잡아도 대화 칸 줄 수가 늘지 않고, Q1 의 답이 오면 전사 옆에 채워진다.

---

## 요구사항 22개

| ID | 우선 | 상태 | 요구사항 |
|---|---|---|---|
| REQ-01 | P0 | 충족 | 수업이 흘러가는 중에 걸린 낱말이나 문장을 그 자리에서 눌러, 화면을 떠나지 않고 한 줄 답을 받을 수 있다. |
| REQ-02 | P0 | 충족 | 선생님 말이 자동으로 글자가 되어 화면에 계속 흘러 들어온다. |
| REQ-03 | P0 | 충족 | 수업 내용과 화면이 이 PC 밖으로 새어 나가지 않고, 밖으로 나가는 것이 있으면 그것이 무엇인지 학습자가 읽을 수 있다. |
| REQ-04 | P0 | 충족 | 질문을 던진 뒤 답이 올 때까지 화면이 죽어 있지 않고, 결론이 자라는 것이 보인다. |
| REQ-05 | P0 | 부분 | 무엇이 막혔는지 스스로 말하지 못할 때, 문장을 통째로 눌러 짐작 두세 개 중에서 고를 수 있고 잘못 열었으면 닫을 수 있다. |
| REQ-06 | P0 | 부분 | 오늘 붙잡은 순간을 교시별로 다시 열어 보고, 그때 답이 왔는지 멈췄는지 구분할 수 있다. |
| REQ-07 | P0 | 부분 | 무엇이 멈췄고 무엇이 계속 도는지 화면이 사실대로 말하고, 어느 화면에 있든 같은 말을 한다. |
| REQ-08 | P1 | 부분 | 질문할 때 그 순간의 수업 화면(칠판)이 함께 붙어, 튜터가 무엇을 보고 있었는지 알고 답한다. |
| REQ-09 | P1 | 미충족 | 지금 IntelliJ 에서 보고 있는 코드를 놓고 물으면 튜터가 그 코드를 보고 답한다. |
| REQ-10 | P1 | 미충족 | Meet 이나 IntelliJ 를 보고 있는 중에도 손을 떼지 않고 방금 들은 문장을 붙잡을 수 있다. |
| REQ-11 | P1 | 미충족 | 답을 기다리는 중에 또 붙잡아도 앞 질문이 조용히 사라지지 않는다. |
| REQ-12 | P1 | 미충족 | 교시가 끝나면 회상 → 피드백 → 나중 확인으로 이어져 그날 배운 것이 복습으로 넘어간다. |
| REQ-13 | P1 | 미충족 | 설정에서 끄면 실제로 꺼지고, 켜면 지금 수업에 바로 먹힌다. |
| REQ-14 | P2 | 미충족 | 쌓인 수업 기록을 학습자가 직접 지우거나 파일로 꺼낼 수 있다. |
| REQ-15 | P1 | 미충족 | 붙잡은 문장이 화면 위로 밀려나도 그 답을 볼 자리가 남는다. |
| REQ-16 | P1 | 미충족 | 배포한 확장에 개발용 뒷문이 붙어 있지 않다. |
| REQ-17 | P1 | 미충족 | 한 교시에 돈이 얼마나 나갔고 어떤 모델이 얼마나 걸려 답했는지 남는다. |
| REQ-18 | P1 | 미충족 | 도우미가 다시 떠도 멈춘 질문의 「다시」가 살아난다. |
| REQ-19 | P1 | 부분 | 고친 것이 정말 도는지 명령 하나로 확인되고, 아무도 안 쳐도 시험이 돈다. |
| REQ-20 | P2 | 부분 | 저장소의 문서가 지금 코드와 같은 말을 한다. |
| REQ-21 | P2 | 미충족 | 전사 문단에서 내가 고른 부분만 끌어서 물을 수 있다. |
| REQ-22 | P2 | 미충족 | 화면 비율처럼 내가 한 번 맞춘 것이 다음에도 그대로다. |

각 요구사항의 「왜」와 「수용 기준」은 현황판 아티팩트 ②절에 있습니다.

---

## 작업 단위 32개 (파별)

### 0파

> 여럿이 기다리는 계약 넷(커넥터 뷰·기록 줄 상태·manifest commands·설정 읽는 자리)과 사람만 할 수 있는 셋(계약 승인·Meet 실측·IntelliJ 포트), 그리고 다른 작업자가 이미 붙잡고 있는 셋을 먼저 세웁니다. 계약이 흔들리는 동안 그 위에 화면을 얹으면 두 번 만듭니다.

#### U-01 커넥터 상태 한 벌 계약 — 바닥줄·메모·자세히가 같은 값을 읽는다 (계약/M)

지금 meetTrouble 하나만 하고 있는 일을 커넥터 넷(tiro-share·meet-tab·native-host·intellij-mcp) 전부로 넓혀, 상태 낱말과 까닭을 한 순수 함수가 내게 한다. 바닥줄 세 칸의 meet·intellij 하드코딩(lesson-view.ts:465-467)과 메모 안 SourceStatus 하드코딩(preparingSources:380-381)을 그 함수로 갈아 끼우고, else-if 사슬이던 경고를 여러 줄 배열로 바꿔 둘 이상 멈추면 둘 다 보이게 한다. 이 함수가 나와야 자세히 화면 바닥줄(U-12)이 붙을 자리가 생긴다.

- 파일: `apps/browser-extension/src/panel/lesson-view.ts` · `apps/browser-extension/src/panel/screens/screens.test.tsx`
- 의존: 없음 · 충돌: U-10, U-12, U-18 · REQ: REQ-07
- 검증: pnpm --filter @classmate/browser-extension test -- lesson-view screens — meet-tab off 일 때 바닥줄 점·메모 SourceStatus·경고 셋이 모두 바뀌고, 제공자 실패와 전사 멈춤이 동시에 오면 경고가 두 줄이다

#### U-02 기록 줄 상태 네 값 계약 (ready·preparing·queued·error) (계약/S)

history-view.ts:21 의 두 값(ready|preparing)을 네 값으로 넓히고 MomentRow 에 그 갈래를 그린다. 이것이 나와야 버려진 답·멈춘 워치독(U-20)이 기록에 정직하게 앉을 자리가 생긴다.

- 파일: `apps/browser-extension/src/panel/history-view.ts` · `packages/ui-classmate/src/components/MomentRow.tsx` · `packages/ui-classmate/test/components.test.tsx`
- 의존: 없음 · 충돌: 없음 · REQ: REQ-06
- 검증: pnpm --filter @classmate/ui-classmate test && pnpm --filter @classmate/browser-extension test -- history-view — 네 상태가 각각 다른 DOM 을 낸다

#### U-03 매니페스트 commands 선언과 명령 이름 계약 (계약/S)

wxt.config.ts 에 chrome.commands 두 개(classmate.catch-last = Alt+S, classmate.capture-toggle)를 선언하고 명령 이름 상수를 src/background 에 정본으로 둔다. 이것 없이는 전역 단축키(U-13)도 캡처 시작 제스처(U-14)도 만들 수 없다. 빌드 산출물 manifest.json 에 실제로 실리는지까지 이 단위에서 확인한다.

- 파일: `apps/browser-extension/wxt.config.ts` · `apps/browser-extension/src/background/commands.ts`
- 의존: 없음 · 충돌: 없음 · REQ: REQ-10, REQ-08
- 검증: pnpm --filter @classmate/browser-extension build 뒤 .output/chrome-mv3/manifest.json 에 commands 키가 있고 Alt+S 가 실려 있다

#### U-04 설정 네 칸을 워커가 읽는 자리 계약 (계약/S)

지금 background/settings.ts 는 periodNumber·subject·provider 세 칸만 읽는다. capture.transcript / capture.screen / capture.editor / answerLength 를 읽어 ClassmateSettings 에 실어 주는 자리를 만들고 정규화 규칙(없거나 상하면 기본값)을 정한다. 이것이 나와야 U-15 가 실제 동작을 바꿀 수 있다.

- 파일: `apps/browser-extension/src/background/settings.ts` · `apps/browser-extension/src/background/settings.test.ts`
- 의존: 없음 · 충돌: 없음 · REQ: REQ-13
- 검증: pnpm --filter @classmate/browser-extension test -- settings — 네 칸이 기본값과 저장값 모두에서 올바로 읽힌다

#### U-05 계약 변경 승인 — 기록 삭제 봉투와 비용 기록 칸 (사람/S)

frozen.sha256 이 잠근 계약을 두 곳 넓힐지 사람이 정한다. ① 오늘 기록을 지우는 봉투를 확장→호스트 표에 넣을지 ② 모델 이름·비용·회차 시간을 남길 자리를 session-event.schema.json 의 닫힌 14종 enum 안에 어떻게 넣을지(새 type 인지 answer.completed payload 인지). 결정과 근거를 DECISIONS.md 에 적고 freeze 를 같은 커밋에 담는다. 워커는 계약을 못 바꾼다.

- 파일: `docs/DECISIONS.md` · `packages/contracts/schemas/session-event.schema.json` · `packages/contracts/frozen.sha256`
- 의존: 없음 · 충돌: U-23 · REQ: REQ-14, REQ-17
- 검증: pnpm --filter @classmate/contracts test 통과하고 DECISIONS.md 에 그날 날짜 항목이 결정·근거·대안 세 줄로 있다

#### U-06 Meet 캡처 실측 — 고친 판으로 한 교시를 실제로 치른다 (사람/M)

모든 창에서 Meet 탭을 찾도록 고친 판(226a641)이 실제 수업에서 프레임을 남기는지 사람이 한 교시 재 본다. Meet 이 그 창의 앞 탭인 경우와 뒷 탭인 경우 둘 다. 결과(screen.frame 건수·frames/ 파일 수·실패 낱말)를 WORKLOG 검증 줄에 적는다. 이 숫자가 나와야 U-14 를 만들 값어치가 있는지 판단할 수 있다.

- 파일: `docs/WORKLOG.md`
- 의존: 없음 · 충돌: 없음 · REQ: REQ-08
- 검증: 교시 SQLite 의 screen.frame 건수와 frames/ 폴더 파일 수를 세어 WORKLOG 에 적는다

#### U-07 IntelliJ MCP 포트 열기와 실측 (사람/M)

Gate C 가 BLOCKED 로 남은 원인인 IntelliJ MCP 포트(64342)를 사람이 켜고, 읽기 전용으로 현재 파일·보이는 줄 범위·발췌를 뽑을 수 있는지 spikes/intellij-mcp-probe.mjs 로 재 본다. 이 실측 없이는 U-31 이 무엇을 상대로 만드는지 모른다.

- 파일: `docs/spikes/gate-c-intellij.md`
- 의존: 없음 · 충돌: 없음 · REQ: REQ-09
- 검증: node spikes/intellij-mcp-probe.mjs 가 파일 경로·언어·발췌를 실제로 되돌려 주고 그 출력을 gate-c 문서에 붙인다

#### U-08 답 조각 수신과 자라는 답 UI (진행 중) (신규/M)

진행 중 — cc-wt/delta 에서 작업 중이고 일부는 이미 main(226a641)에 들어왔다. host-client 가 tutor.delta 를 push 로 갈라내 live.delta 로 흘리고 패널이 streamOf → AnswerStream 으로 글자를 늘린다. 남은 것: 회차가 두 번째일 때 seq 가 0 으로 되돌아오는 것을 화면이 '다시 그리기'로 읽을지 정하는 것(봉투에 회차 칸이 없다)과 조각이 오다 끊겼을 때의 갈래.

- 파일: `apps/browser-extension/src/background/host-client.ts` · `apps/browser-extension/src/panel/replay-store.ts` · `apps/browser-extension/src/panel/screens/AnswerStream.tsx`
- 의존: 없음 · 충돌: U-18, U-20, U-24 · REQ: REQ-04
- 검증: pnpm --filter @classmate/browser-extension test -- host-client replay-store 와 e2e 에서 조각이 도는 동안 메모 글자가 늘어난다

#### U-09 모든 창에서 Meet 탭 찾기와 실패 까닭 기록 (진행 중) (고침/M)

진행 중 — main(226a641)에 들어왔다. chrome.tabs.query 가 모든 창을 훑고 pickMeetTab 이 활성 탭을 고르며 실패 낱말 다섯(no-meet-tab·not-active·capture-failed·too-large·host-offline)이 connector.status 로 흐른다. 남은 것: 뒷 탭인 Meet 도 찍을 길과 U-06 실측 결과 반영.

- 파일: `apps/browser-extension/src/capture/snapshot.ts` · `apps/browser-extension/src/background/router.ts`
- 의존: 없음 · 충돌: U-15, U-16, U-21, U-29, U-31 · REQ: REQ-08, REQ-07
- 검증: pnpm --filter @classmate/browser-extension test -- snapshot — 다섯 실패 낱말이 각각 커넥터로 나간다

#### U-10 문단 클릭 자리를 메모와 떼어 놓기 (진행 중) (고침/S)

진행 중 — main 에 들어왔다. ListeningView 에 choosing 칸을 따로 두어(lesson-view.ts:554) 짐작 목록이 noteOf 의 none 갈래에 갇히지 않게 했고 ListeningScreen:238 이 그 칸을 별도로 그린다. 그래서 한 교시에서 두 번째로 문장을 눌러도 목록이 뜬다. 남은 것: 두 번째 붙잡기를 밟는 시험이 없다 — 체크포인트 sentence 가 reset 뒤 첫 질문 이전으로 시계를 되돌려 늘 note===none 만 본다.

- 파일: `apps/browser-extension/src/panel/lesson-view.ts` · `apps/browser-extension/src/panel/screens/ListeningScreen.tsx`
- 의존: 없음 · 충돌: U-01, U-11, U-12, U-18, U-19 · REQ: REQ-05
- 검증: 답이 이미 떠 있는 상태(goto('answer'))에서 catchSentence 를 부르면 짐작 목록이 화면에 그려지는 시험 한 건을 더한다


### 1파

> 계약 하나만 기다리거나 아무것도 안 기다리는 고침을 몰아 넣습니다. 같은 파일(lesson-view.ts · replay-store.ts · ListeningScreen.tsx · background.ts · router.ts)을 건드리는 것끼리는 conflictsWith 로 갈라 한 파에 둘이 못 들어오게 했습니다. 시험 묶기와 CI(U-22)는 아무 파일과도 겹치지 않아 이 파에서 가장 먼저 끝낼 값어치가 있습니다 — 이후 모든 단위의 확인이 그 위에 섭니다.

#### U-11 짐작 목록을 닫는 손짓 (신규/S)

GuessList 에 닫기 단추를 달고 ListeningScreen 이 store.cancelChoosing 을 부르게 잇는다. Esc 키도 같게 본다. 지금 cancelChoosing(replay-store.ts:671)은 부르는 곳이 0곳인 죽은 코드다.

- 파일: `packages/ui-classmate/src/components/GuessList.tsx` · `apps/browser-extension/src/panel/screens/ListeningScreen.tsx` · `apps/browser-extension/src/panel/replay-handle.ts`
- 의존: U-10 · 충돌: U-10, U-18, U-19, U-32 · REQ: REQ-05
- 검증: pnpm --filter @classmate/browser-extension test -- panel-dom — 짐작 목록에서 닫기를 누르면 cm-gl 이 사라지고 전사가 그대로 남는다

#### U-12 자세히 화면에 바닥줄 붙이기 (고침/M)

DetailScreen 에 SourceFooter 를 붙여 자세히를 보는 동안에도 연결 경고·자료 신선도·「기록 N」·설정 아이콘이 보이게 한다. 지금은 그 화면에 바닥줄 자체가 없어 전사가 멈추든 도우미가 끊기든 표시가 없고, 설정을 열려면 수업으로 먼저 돌아가야 한다.

- 파일: `apps/browser-extension/src/panel/screens/DetailScreen.tsx` · `apps/browser-extension/src/panel/lesson-view.ts`
- 의존: U-01 · 충돌: U-01, U-10 · REQ: REQ-07
- 검증: e2e 에서 자세히 화면을 연 뒤 classmateConnector('native-host','off') 를 밀면 그 화면 바닥줄에 경고가 뜬다

#### U-13 전역 단축키로 마지막 문장 붙잡기 (신규/M)

서비스 워커에 chrome.commands.onCommand 리스너를 달아 classmate.catch-last 를 패널 포트로 흘리고 패널이 그것을 store.catchSentence 로 잇는다. 사이드패널이 닫혀 있으면 열고 나서 붙잡는다. 화면 안내 글도 '패널이 앞에 있을 때만' 이라는 실제 조건이 사라졌음을 반영해 고친다.

- 파일: `apps/browser-extension/entrypoints/background.ts` · `apps/browser-extension/src/live/messages.ts` · `apps/browser-extension/src/panel/PanelApp.tsx`
- 의존: U-03 · 충돌: U-14, U-15, U-16, U-17, U-31 · REQ: REQ-10
- 검증: Meet 탭에 포커스를 둔 채 Alt+S 를 눌러 사이드패널에 짐작 목록이 뜨는 것을 사람이 한 번 확인하고 워커 리스너는 단위 시험으로 덮는다

#### U-14 연속 화면 캡처를 켤 길 만들기 (신규/L)

capture.start 를 보내는 실효 경로를 만든다. 사이드패널 클릭은 크롬이 tabCapture 의 사용자 제스처로 세지 않으므로 chrome.commands 로 켠다. background.ts:73 의 setPanelBehavior 가 action.onClicked 를 먹어 591행 리스너가 안 불리는 것도 함께 정리한다. U-06 실측이 '질문용 한 장으로 충분' 으로 나오면 이 단위는 접는다.

- 파일: `apps/browser-extension/entrypoints/background.ts` · `apps/browser-extension/src/panel/screens/SettingsScreen.tsx`
- 의존: U-03, U-06 · 충돌: U-13, U-15, U-16, U-30, U-31 · REQ: REQ-08
- 검증: 단축키를 눌러 capture.stats 가 워커 콘솔에 오고 frames/ 에 1fps 로 파일이 쌓이는 것을 한 교시로 확인

#### U-15 설정 네 칸을 실제 동작에 반영하고 그 뒤에 잠금을 푼다 (고침/M)

capture 세 칸을 라우터·스냅숏·프레임 통이 실제로 읽어 끄면 안 찍히게 하고 answerLength 를 tutor.ask 에 실어 보낸다. 그 다음에만 SettingsScreen 의 disabled 를 푼다 — 순서가 이 단위의 핵심이다. 잠금을 먼저 풀면 「끄기」가 거짓말이 된다. 교시·주제를 바꿨을 때 패널을 다시 열지 않아도 스토어에 먹히게 하는 것(PanelApp.tsx:100-104)도 함께 고친다.

- 파일: `apps/browser-extension/src/background/router.ts` · `apps/browser-extension/src/panel/screens/SettingsScreen.tsx` · `apps/browser-extension/src/panel/PanelApp.tsx`
- 의존: U-04 · 충돌: U-09, U-13, U-14, U-16, U-21, U-29, U-31 · REQ: REQ-13
- 검증: pnpm --filter @classmate/browser-extension test -- router — capture.screen 을 끄면 panel.ask 에 screenFrameId 가 붙지 않는다

#### U-16 재연결이 워커 재기동을 넘게 하기 (고침/M)

lastTiroTabId(background.ts:470)와 lastCaptureTabId(:382)를 RouterSnapshot 과 chrome.storage.session 에 담아, 워커가 30초 놀고 내려갔다 떠도 「다시 연결」이 실제로 동작하게 한다. 지금은 둘 다 워커 지역 변수라 재기동 뒤 콘솔 경고 한 줄만 남고 학습자 눈에는 단추가 먹통이다. seenSegments 를 스냅숏에 담을지도 여기서 함께 판단한다(지금은 재기동 뒤 같은 문단이 한 줄 더 기록된다).

- 파일: `apps/browser-extension/entrypoints/background.ts` · `apps/browser-extension/src/background/router.ts`
- 의존: 없음 · 충돌: U-09, U-13, U-14, U-15, U-21, U-29, U-31 · REQ: REQ-07
- 검증: pnpm --filter @classmate/browser-extension test -- router period-log — 스냅숏을 저장·복원한 뒤 reconnect{tiro-share} 가 탭 번호를 찾는다

#### U-17 배포 빌드에서 개발용 창 손잡이 떼기 (고침/S)

installReplayHandle(PanelApp.tsx:115)이 조건 없이 붙어 라이브 배포 빌드에도 window.classmateReplay 가 생긴다. 개발 빌드이거나 ?replay= 가 있을 때만 붙게 한다. replay-handle.ts:5 주석이 이미 그렇게 옮기겠다고 적어 두었다. E2E 는 fixture 모드로 도니 손잡이를 계속 쓸 수 있다.

- 파일: `apps/browser-extension/src/panel/PanelApp.tsx` · `apps/browser-extension/src/panel/replay-handle.ts`
- 의존: 없음 · 충돌: U-11, U-13, U-15 · REQ: REQ-16
- 검증: 프로덕션 빌드를 얹고 사이드패널 콘솔에서 typeof window.classmateReplay 가 'undefined' 이며 e2e 18건은 그대로 통과

#### U-18 붙잡은 줄이 밀려나도 메모를 보이게 (신규/M)

renderAfter 가 note.lineId 와 같은 줄이 없으면 아무것도 안 그린다(ListeningScreen.tsx:230). 붙잡은 줄이 보이는 줄 창 밖으로 나갔을 때 메모를 어디에 둘지 규칙을 정한다 — 전사 위쪽 고정 띠로 붙이거나 「붙잡은 문장으로 가기」 한 줄을 내거나. 답은 스토어에 남아 있으니 볼 자리만 만들면 된다.

- 파일: `apps/browser-extension/src/panel/screens/ListeningScreen.tsx` · `apps/browser-extension/src/panel/lesson-view.ts`
- 의존: 없음 · 충돌: U-01, U-08, U-10, U-11, U-12, U-19, U-32 · REQ: REQ-15
- 검증: pnpm --filter @classmate/browser-extension test -- panel-dom — 붙잡은 뒤 pushSegment 를 창 크기보다 많이 밀어도 결론 글이 화면 어딘가에 남는다

#### U-19 대화 칸 비율을 기억하기 (신규/S)

chatRatio(ListeningScreen.tsx:133)를 settings-store 의 키 하나로 저장하고 패널을 열 때 되살린다. 포인터로 끄는 길(onPointerDown/Move/Up·setPointerCapture)에는 지금 시험이 하나도 없으니 그 길도 함께 덮는다.

- 파일: `apps/browser-extension/src/panel/settings-store.ts` · `apps/browser-extension/src/panel/screens/ListeningScreen.tsx` · `apps/browser-extension/src/panel/panel-dom.test.tsx`
- 의존: 없음 · 충돌: U-10, U-11, U-18, U-32 · REQ: REQ-22
- 검증: pnpm --filter @classmate/browser-extension test -- panel-dom — 비율을 바꾸고 다시 그리면 그 값이 남고 포인터 끌기가 aria-valuenow 를 바꾼다

#### U-20 버려진 답과 남은 워치독을 화면에 되살리기 (고침/L)

세 가지가 한 뭉치다. ① #isStaleAnswer(replay-store.ts:510)가 버린 답을 기록 화면에서 올바른 상태로 보이게 한다(U-02 의 네 값 사용) ② 질문을 갈아탈 때 앞 질문의 워치독을 정리하거나 그것이 낸 answer.failed 가 자기 자신에게 걸려 또 버려지지 않게 한다 ③ 답을 기다리는 중 붙잡은 다음 질문을 담을 자리를 정한다 — 지금은 machine.questionId 한 칸이라 새 질문이 앞 질문을 통째로 밀어낸다.

- 파일: `apps/browser-extension/src/panel/replay-store.ts` · `apps/browser-extension/src/panel/live-store.test.ts`
- 의존: U-02 · 충돌: U-08, U-24, U-25, U-32 · REQ: REQ-11, REQ-06
- 검증: pnpm --filter @classmate/browser-extension test -- live-store — Q1 을 기다리는 중 Q2 를 붙잡고 60초를 밀면 Q1 의 멈춤이 기록 줄에 error 로 남는다

#### U-21 기록이 도우미에 안 붙었을 때 화면에 알리기 (고침/S)

router.ts 의 publish 가 event.append 의 결과를 받아 놓고 버린다. 호스트가 {type:'error'} 로 거절해도 경고 한 줄도, connector.status 도 안 나간다. 결과를 읽어 거절이면 커넥터를 내리고 그 까닭을 흘린다.

- 파일: `apps/browser-extension/src/background/router.ts` · `apps/browser-extension/src/background/router.test.ts`
- 의존: 없음 · 충돌: U-09, U-15, U-16, U-29, U-31 · REQ: REQ-07
- 검증: pnpm --filter @classmate/browser-extension test -- router — 가짜 호스트가 error 를 되돌리면 connector.status 가 나간다

#### U-22 시험 네 갈래를 한 명령으로 묶고 CI 를 켠다 (신규/M)

지금 node --test 145건(installer 72 · native-host scripts 42 · compare-design 31)과 cargo 326건이 어떤 pnpm 스크립트에도 걸려 있지 않고 .github 폴더 자체가 없어 CI 가 0개다. 루트 package.json 에 네 갈래를 다 도는 스크립트를 두고 워크플로 하나를 만든다. 실제 CLI 를 부르지 않는다는 가드(no_real_cli)는 반드시 그 안에서 돌게 한다. 이 단위가 먼저 서면 나머지 모든 단위의 확인이 그 위에 선다.

- 파일: `package.json` · `.github/workflows/test.yml` · `apps/browser-extension/vitest.config.ts`
- 의존: 없음 · 충돌: 없음 · REQ: REQ-19
- 검증: pnpm test 한 번으로 vitest·cargo·node --test 가 모두 돌고 exit 0 이며 각 갈래 건수가 출력에 찍힌다

#### U-23 문서를 지금 코드와 맞춘다 (고침/M)

TASKS.md 의 이미 병합된 7항목(:136-142)을 완료로 옮기고 batch-4~7 라운드에서 남은 일을 새로 적는다. architecture.md 의 봉투 표에 tutor.delta 를 넣고 손으로 적은 시험 수를 지운다(회고 §5-4 가 정한 규칙). master-prompt §3-7 의 '듣는 중 화면 입력창 없음' 을 뒤집은 근거를 DECISIONS.md 에 한 항목으로 남긴다. first-class.md §4-2 의 '끌어서 붙잡거나' 는 코드가 0줄이니 지운다.

- 파일: `docs/TASKS.md` · `docs/architecture.md` · `docs/DECISIONS.md` · `docs/first-class.md`
- 의존: 없음 · 충돌: U-05 · REQ: REQ-20
- 검증: git diff --check 가 깨끗하고 TASKS.md 의 미완 항목을 하나씩 저장소에서 확인했을 때 정말 미완이다


### 2파

> wave 1 의 결과를 딛는 것들입니다. replay-store.ts 를 두고 U-20(wave 1)과 U-24 가 부딪히므로 갈랐고, 호스트 쪽 tutor/mod.rs 는 U-26 하나만 이 파에 둡니다. 복습자료 경로(U-29)와 IntelliJ 커넥터(U-31)는 각각 승인·실측이 끝난 뒤라야 무엇을 상대로 만드는지 알 수 있습니다.

#### U-24 자세히를 보는 동안 18초 시계가 몰래 도는 것 막기 (고침/M)

openDetail 은 note 가 preparing·waiting 이어도 통과시킨다. 그 뒤 답이 오면 landAnswer 가 note 를 minimal 로 되돌리고 18초 시계를 다시 건다 — 자세히 화면을 보고 있는데도. 18초가 지나면 tick 이 folded 로 옮겨 screen='detail' 과 어긋나고 그 뒤 back() 이 back 입력을 넣지 않는다. 답이 오기 전에 자세히를 연 경로를 세우는 시험이 하나도 없다.

- 파일: `apps/browser-extension/src/panel/replay-store.ts` · `packages/tutor-core/src/machine.ts`
- 의존: U-20 · 충돌: U-08, U-20, U-25 · REQ: REQ-11
- 검증: pnpm --filter @classmate/browser-extension test -- live-store — 답이 오기 전에 openDetail 하고 30초를 밀어도 screen 이 detail 이고 note 가 folded 가 아니다

#### U-26 호스트가 겹친 질문을 순서대로 접수하고 화면에 알리기 (고침/L)

on_ask(tutor/mod.rs:658)가 attempt 를 동기로 부르므로 앞 질문이 도는 동안 뒤 질문의 Command::Ask 는 inbox 에 서 있고 question.asked 조차 안 나간다. 라우터는 이미 tutor.accepted 로 답한 뒤라 화면에는 최대 45~90초 아무 반응이 없다. 접수 즉시 question.asked 를 내고 '줄 서는 중' 을 화면에 알리는 길을 만든다. providers 의 ProviderQueue(부르는 곳 0곳)를 여기서 실제로 쓸지도 함께 판단한다.

- 파일: `apps/native-host/src/tutor/mod.rs` · `apps/native-host/tests/tutor_pipeline.rs`
- 의존: 없음 · 충돌: U-27, U-28 · REQ: REQ-11
- 검증: cargo test -p classmate-host — 질문 둘을 연달아 넣으면 두 번째의 question.asked 가 첫 답보다 먼저 나간다

#### U-29 실수업 기록으로 복습자료를 만드는 길 (신규/L)

지금 report-ui 의 generate.mjs 는 fixture 번들 폴더 하나만 입력으로 받아 out/2026-09-02 와 out/2026-09-03 이 md5 까지 같다. 확장에서 session.export 봉투를 보내 교시 JSONL 을 뽑고 그것을 report-ui 입력으로 잇는다. 호스트 쪽 갈래와 시험은 이미 있고 보내는 쪽만 없다(확장 소스에 그 문자열이 0건). coverage 판정 기준(무엇이 빠지면 실패인가)도 여기서 문서로 정한다.

- 파일: `apps/browser-extension/src/background/router.ts` · `packages/report-ui/scripts/generate.mjs` · `docs/architecture.md`
- 의존: 없음 · 충돌: U-09, U-15, U-16, U-21, U-31 · REQ: REQ-12
- 검증: 실제 교시 SQLite 를 JSONL 로 뽑아 generate.mjs 에 넣으면 out/ 에 그 교시 내용이 든 HTML 이 나온다(fixture 판과 md5 가 다르다)

#### U-31 IntelliJ 코드 문맥을 실제로 흘려보내기 (신규/L)

router.pushEditor(router.ts:675)와 live.editor 통로, 패널 받는 쪽(attach.ts:147 · replay-store.ts), 호스트의 materials editor.context 갈래가 모두 완성돼 있는데 문맥을 만들어 넣는 코드가 0줄이다. U-07 실측을 바탕으로 IntelliJ MCP 커넥터를 서비스 워커에 붙이고 editor.context 를 event.append 로 저장소에도 넣어 프롬프트의 [편집기 화면] 절이 실제로 나가게 한다. classmate.reconnect{intellij-mcp} 도 경고 한 줄이 아니라 실제 재접속으로 바꾼다.

- 파일: `apps/browser-extension/src/background/intellij.ts` · `apps/browser-extension/entrypoints/background.ts` · `apps/browser-extension/src/background/router.ts`
- 의존: U-07, U-16 · 충돌: U-09, U-13, U-14, U-15, U-16, U-21, U-29 · REQ: REQ-09
- 검증: IntelliJ 를 열어 둔 채 한 문장을 붙잡으면 세션 DB 에 editor.context 가 남고 바닥줄 IntelliJ 칸에 파일 이름이 뜬다

#### U-32 전사 문단에서 고른 부분만 물기 (신규/L)

관련 코드가 한 줄도 없다(getSelection·selectionchange 검색 결과 0건). 게다가 줄마다 role="button"+onClick 이 붙어 있어(TranscriptFlow.tsx:68-79) 끌다 손을 떼면 클릭으로 읽혀 문장 전체 붙잡기가 발동한다. 끌기와 클릭을 가르는 규칙(움직인 거리·선택 길이)을 정하고 고른 글로 질문을 만드는 길을 잇는다. 짐작 목록을 건너뛰고 바로 물을지도 여기서 정한다.

- 파일: `packages/ui-classmate/src/components/TranscriptFlow.tsx` · `apps/browser-extension/src/panel/screens/ListeningScreen.tsx` · `apps/browser-extension/src/panel/replay-store.ts`
- 의존: U-11, U-18, U-19 · 충돌: U-11, U-18, U-19, U-20 · REQ: REQ-21
- 검증: pnpm --filter @classmate/ui-classmate test — 문단 안에서 끌어 고른 뒤 손을 떼면 onSelect 가 고른 글로 불리고 onSentence 는 불리지 않는다


### 3파

> 같은 파일을 두고 앞 파와 부딪히는 것만 남겼습니다. U-25(교시 뒤 입구)는 replay-store.ts 에서 U-24 와, U-27(재시작 뒤 다시)은 tutor/mod.rs 에서 U-26 과 겹칩니다.

#### U-25 교시 뒤 네 단계로 들어가는 입구 (신규/L)

리듀서 쪽 EXIT_RECALL → FEEDBACK → FADE_SUPPORT → DELAYED_CHECK 는 120칸 전수 시험까지 통과하는데 next 입력을 내는 곳이 제품 코드에 0곳이라 6상태 중 4개가 도달 불가다. periodEnded 가 true 일 때 화면에 다음 단계로 가는 자리를 두고 스토어에 next 메소드와 E2E 손잡이를 더한다. 함께 고칠 잠복 결함: #stuck 이 Moment 를 리듀서에 묻기 전에 먼저 써서, stuck 칸이 없는 세 상태에서는 '영원한 정리 중' 줄이 기록에 남는다.

- 파일: `apps/browser-extension/src/panel/replay-store.ts` · `apps/browser-extension/src/panel/replay-handle.ts` · `apps/browser-extension/src/panel/screens/ListeningScreen.tsx`
- 의존: U-20, U-24 · 충돌: U-20, U-24 · REQ: REQ-12
- 검증: period.ended 를 밀고 next 를 부르면 data-tutor-state 가 EXIT_RECALL 로 바뀌는 e2e 한 장면을 더한다

#### U-27 호스트 재시작 뒤에도 「다시」가 살아나게 (고침/L)

Worker.pending 과 Router.tutors 가 프로세스 메모리에만 있어 호스트가 다시 뜨면 앞 교시의 멈춘 질문이 전부 unknown-question 이 된다. 저장소에는 answer.queued 가 남아 화면에는 '다시' 자리가 그대로 보이는데 눌러도 되살아나지 않는다. 교시 손잡이를 열 때 저장소에서 미해결 질문을 되살린다. 함께 정리할 것: 교시가 끝나도 SessionStore 손잡이와 파이프라인 스레드를 거두는 자리가 없어 열린 파일과 스레드가 늘기만 한다.

- 파일: `apps/native-host/src/tutor/mod.rs` · `apps/native-host/src/router.rs` · `apps/native-host/tests/tutor_pipeline.rs`
- 의존: U-26 · 충돌: U-26, U-28, U-30 · REQ: REQ-18
- 검증: cargo test -p classmate-host — 저장소에 answer.queued 를 남긴 뒤 새 Router 를 세워 tutor.retry 를 보내면 accepted 가 온다


### 4파

> 계약 승인과 호스트 쪽 두 단위가 모두 끝난 뒤에야 손댈 수 있는 것들입니다. 비용 기록(U-28)은 tutor/mod.rs 를 세 번째로 건드리고, 기록 지우기(U-30)는 확장·호스트 양쪽이 다 정리된 뒤라야 안전합니다.

#### U-28 모델 이름·비용·회차 시간을 기록에 남긴다 (신규/M)

AskOutcome 의 model·cost_usd·duration 과 ProviderEvent::Usage 를 받아 놓고 아무 데도 쓰지 않는다(tutor/mod.rs:758,779 · sink 가 TextDelta 아닌 이벤트를 그 자리에서 버린다). U-05 에서 정한 자리에 실어 남긴다. 승인 없이 1.25 USD 가 나간 사고를 겪은 프로젝트라 재는 값이 버려지는 것이 위험이다.

- 파일: `apps/native-host/src/tutor/mod.rs` · `apps/native-host/src/tutor/events.rs`
- 의존: U-05, U-26, U-27 · 충돌: U-26, U-27 · REQ: REQ-17
- 검증: cargo test -p classmate-host — 가짜 CLI 로 한 회차를 돌리면 세션 DB 에 모델 이름과 비용이 남는다

#### U-30 오늘 기록 지우기를 끝까지 잇는다 (신규/L)

세 곳이 끊겨 있다. ① entrypoints/sidepanel/App.tsx:123 이 PanelApp 의 onClearToday prop 을 안 넘긴다 ② 여는 단추가 disabled 다 ③ 호스트에 삭제 봉투 자체가 없다(저장소·설치 스크립트를 통틀어 지우는 코드가 0줄이고 retention·purge 같은 낱말도 없다). U-05 가 정한 봉투를 호스트에 만들고 확장에서 보낸 뒤 잠금을 푼다.

- 파일: `apps/browser-extension/entrypoints/sidepanel/App.tsx` · `apps/browser-extension/src/panel/screens/SettingsScreen.tsx` · `apps/native-host/src/router.rs` · `apps/native-host/src/store/mod.rs`
- 의존: U-05, U-15, U-27 · 충돌: U-14, U-27 · REQ: REQ-14
- 검증: 설정에서 지우기를 누르면 확인 창이 뜨고 지운 뒤 교시 SQLite 의 count 가 0 이고 frames/ 폴더가 비어 있다

---

## 구조상 못 하는 것 — 순서에 넣지 않는다

- **사이드패널 안의 단추 클릭으로 연속 화면 캡처(tabCapture)를 시작하기**
  크롬이 사이드패널 클릭을 tabCapture 가 요구하는 사용자 제스처로 세지 않습니다(Chromium 40926394 · 40916430, 둘 다 Won't fix — docs/WORKLOG.md 102행). 단추를 아무리 잘 만들어도 그 자리에서는 스트림이 열리지 않습니다. 켜는 길은 chrome.commands 단축키뿐이라 U-14 가 그쪽으로 갑니다.
- **매니페스트를 건드리지 않고 Alt+S 를 브라우저 전역 단축키로 만들기**
  지금 Alt+S 는 사이드패널 문서의 window keydown 리스너라 그 문서가 포커스를 가진 동안에만 듣습니다. 전역으로 만들려면 manifest 의 commands 항목이 있어야 하고 그것은 빌드 설정(wxt.config.ts) 변경입니다 — 패널 코드만 고쳐서는 절대 안 됩니다. 그래서 U-03 을 wave 0 계약으로 따로 뽑았습니다.
- **워커가 packages/contracts 의 스키마 여덟 개를 고치기**
  frozen.sha256 이 해시로 잠그고 있어 고치는 순간 시험이 먼저 빨갛게 됩니다(현재 8/8 OK 확인). 두 라운드 워커 19명이 계약을 한 번도 안 바꾼 것이 이 게이트 덕입니다. 기록 삭제 봉투와 비용 칸은 DECISIONS 에 제안을 적고 사람이 승인해야 하므로 U-05 를 kind:"사람" 으로 두었습니다.
- **실제 claude / codex CLI 를 부르는 자동 회귀 시험을 붙이기**
  Gate C2 에서 승인 없이 1.25 USD 가 나간 사고 뒤 '어떤 소스도 실제 CLI 이름을 스폰하지 않는다' 를 소스 훑기 시험(no_real_cli.rs 5건 · no_real_cli_root.rs 7건)으로 못 박았습니다. 세션 모드가 진짜로 도는지, 모델이 그림 경로를 열어 보는지, --strict-mcp-config 를 모르는 낡은 CLI 에서 회차가 죽는지는 사람이 installer/windows/ask-once.mjs 로 한 번씩 재는 수밖에 없습니다.
- **tutor.delta 조각을 놓쳤을 때 '앞 회차가 버려진 것' 과 '처음부터 다시 그리기' 를 구분하기**
  seq 가 회차마다 0 으로 되돌아가는데 몇 번째 회차인지 알리는 칸이 봉투에 없습니다. 계약 스키마 자체가 없는 값이라(놓쳐도 되는 일회성 알림) 구분하려면 봉투를 넓혀야 하고 그것은 U-05 와 같은 승인 게이트를 지나야 합니다. 지금 구조로는 화면이 추측할 수밖에 없습니다.
- **질문에 그림을 첨부로 넘기기 (여러 장 · PDF · 소스 파일)**
  지금 화면 그림은 자료 문단에 절대 경로 한 줄을 적는 방식이고, 바이트를 프롬프트에 싣거나 CLI 인자로 파일을 건네는 길이 없습니다(CLI_ARGS 는 고정 여섯 개). 넘길 수 있는 것은 봉인한 한 장뿐이며, 그 CLI 가 경로를 열어 본다는 사실 자체가 아직 시험으로도 실측으로도 확인되지 않았습니다.
- **provider:"codex" 로 실제 답을 받기**
  봉투 검증은 codex 를 통과시키지만 router.rs:558 이 이름이 claude 가 아니면 곧바로 거절하고, CodexAppServerProvider 는 ask 가 NotImplemented 만 내는 스텁이며 그 타입을 만드는 자리가 호스트 어디에도 없습니다(사용처가 자기 모듈 시험과 no_real_cli.rs 뿐). codex app-server 의 JSON-RPC 필드 이름·타임아웃 응답 모양이 전부 미측정이라(Gate C2 때 한도 소진) 실측 없이는 구현을 시작할 수 없습니다.

---

## 순서대로 만들다 터질 위험

- **인벤토리 기준 커밋이 영역마다 다릅니다.** 3영역은 226a641, 5영역은 57943a2, 4영역은 그보다 앞선 판을 기준으로 적혀 있고 지금 HEAD 는 5690bfd 입니다. 그래서 같은 tutor.delta 를 3영역은 「됨」, 4·5영역은 「고장」이라고 서로 다르게 말합니다. 순서대로 고치면 **이미 고쳐진 자리를 다시 고치게** 됩니다 — 첫 일은 각 항목을 현재 HEAD 로 다시 찍는 것입니다.
- **줄 번호가 이미 밀렸습니다.** 인벤토리가 가리키는 lesson-view.ts:318(짐작)·:380(바닥줄)·:383(경고)은 지금 각각 :403·:465·:475 근처이고, 그 사이에 meetTrouble·MEET_TROUBLE_LINE·streamOf 가 새로 들어왔습니다. 줄 번호를 그대로 믿고 패치를 만들면 엉뚱한 자리를 고칩니다.
- **고쳤다는 것을 잡아 줄 그물이 없습니다.** entrypoints/**(background.ts·offscreen/main.ts·tiro-share.content.ts)에 단위 시험이 0건이고(vitest include 가 src/** 뿐), .github 가 없어 CI 가 0개이며, node --test 로만 도는 145건은 어떤 pnpm 스크립트에도 걸려 있지 않습니다. 이 영역의 끊긴 배선 대부분이 바로 그 사각지대에 있으므로, 고친 뒤 회귀를 못 잡습니다.
- **죽은 코드를 '있는 기능'으로 세고 배선만 이으면 시험 없는 길이 늡니다.** 부르는 곳이 0곳인 것을 확인한 것만 — cancelChoosing(replay-store.ts:671) · FoldTimer(packages/tutor-core/src/fold-timer.ts) · pushEditor(router.ts:675) · `kind: "next"`(machine.ts:156, 시험 밖 0건) · ProviderQueue · RetryPolicy · CodexAppServerProvider. 배선을 이으면 그 순간부터 한 번도 실행된 적 없는 경로가 제품에 들어옵니다.
- **같은 규칙이 두 곳에 적혀 있어 한쪽만 고치면 조용히 갈라집니다.** 재시도 간격 5·15·45초가 crates/providers/src/retry.rs 와 src/tutor/mod.rs 두 벌, 교시 식별자 정규식이 확장과 호스트 두 벌, 전사 조각 id 계열이 확정(ts-001)과 진행 중(ts-…-partial-N) 두 계열입니다. 대조하는 시험이 있는 것은 봉투 표뿐입니다.
- **배포 빌드에 개발 손잡이가 그대로 붙습니다.** PanelApp.tsx:115 의 `useEffect(() => installReplayHandle(store), [store])` 가 조건 없이 돕니다. 순서대로 만들다 실수업에 올리면 사이드패널 콘솔에서 누구나 상태를 밀어 넣을 수 있습니다.
- **문서가 코드보다 뒤처져 있어 그 문서를 근거로 되돌릴 위험이 있습니다.** master-prompt §3-7 은 아직 「듣는 중 화면에 입력창 없음」이라고 적고 있고 DECISIONS.md 는 그것을 뒤집은 근거를 담고 있지 않습니다. 인벤토리를 순서대로 따르는 다음 작업자가 정본 문서를 근거로 대화 칸을 걷어낼 수 있습니다.
- **저장 보존 정책이 없는 채로 기능을 늘리면 되돌리기가 어려워집니다.** 세션 SQLite·WAL·frames/*.webp 를 지우거나 줄이는 코드가 저장소 전체에 없고(retention·purge·expire 낱말 0건), 확장에는 session.status·session.export 를 보내는 자리조차 없습니다. 캡처를 실제로 켜는 순간부터 디스크가 무제한으로 자랍니다.

---

## 코드만으로는 판정 불가 — 사람이 재야 하는 것

- 시험이 실제로 통과하는지. 읽기 전용 조사라 pnpm test · cargo test --workspace · node --test · playwright e2e 를 한 번도 돌리지 않았습니다. 인벤토리의 시험 건수는 전부 소스에서 센 값이고, 초록인지는 실측이 필요합니다.
- 실제 Claude CLI 의 행동 셋 — ① `--strict-mcp-config` 를 모르는 옛 판에서 회차가 곧바로 죽는지 ② `--input-format stream-json` 세션 모드가 프로세스를 살린 채 여러 물음을 받는지 ③ 자료 문단에 적어 준 그림 절대 경로를 CLI 가 스스로 열어 보는지. 저장소 시험은 가짜 CLI 만 쓰고 실제 CLI 를 0회 부릅니다.
- Meet 탭 화면 한 장 찍기가 실제 수업에서 프레임을 남기는지. 모든 창에서 Meet 탭을 찾는 고침 뒤의 실측이 없고, 직전 실측은 고침 이전 판이며 결과가 0장이었습니다.
- tiro.ooo 가 클라이언트 라우팅을 쓰는지, 그래서 `wxt:locationchange` 갈래가 실제로 도는지. content script 는 시험 대상 밖이라 브라우저에서 재 봐야 합니다.
- 자정을 넘긴 수업의 교시 식별자. apps/browser-extension/src/tiro/period.ts:53 이 기준을 **로컬 날짜**라고 적어 두었으므로 23:50 에 시작한 교시가 00:10 에 다시 세워지면 날짜가 바뀔 수 있는데, 언제 다시 세워지는지는 서비스 워커 생명주기에 달려 있어 코드만으로는 못 정합니다.
- MV3 서비스 워커가 30초 놀아 내려갔다 뜬 뒤의 실제 복원 — 교시 이어가기, seenSegments 유실로 인한 전사 중복, lastTiroTabId·lastCaptureTabId 유실로 인한 「다시 연결」 먹통.
- 두 질문이 겹쳤을 때 뒤 질문이 실제로 얼마나 기다리는지(코드 경로로는 최대 45~90초). 호스트 파이프라인을 실행해 재 봐야 합니다.
- 호스트를 다시 띄운 뒤 멈춘 질문의 「다시」가 unknown-question 으로 거절되는지. pending 이 메모리에만 있다는 것은 코드로 보이지만 실제 왕복은 실행 확인이 필요합니다.

---

## 여섯 영역 어디에도 안 잡힌 것

- 호스트 프로토콜 세대 협상이 없습니다. `hello` 답에 `protocol` 칸이 있는데(apps/browser-extension/src/background/host-messages.ts:105) 그 값을 읽는 코드가 apps/browser-extension/src/background 전체에 0곳입니다. 확장만 판올림되고 호스트 exe 가 옛 판인 PC 에서 봉투 모양이 어긋나도 감지하는 자리가 없고, 여섯 영역 어디에도 이 항목이 없습니다.
- 제거(uninstall) 절차가 없습니다. installer/windows 에 install.mjs·build-host.mjs·package-extension.mjs 는 있으나 uninstall 스크립트가 없고, install.mjs·README.md 에 'uninstall' 문자열이 0건입니다. 등록한 Native Messaging 레지스트리 키와 %LOCALAPPDATA% 세션 폴더를 되돌리는 길이 코드에도 문서에도 없습니다.
- 판올림 이행(migration) 갈래가 없습니다. apps/browser-extension/entrypoints/background.ts:78 의 `chrome.runtime.onInstalled` 리스너는 console.log 한 줄뿐이고 reason(install/update)을 보지 않습니다. `chrome.runtime.onUpdateAvailable` 도 0건입니다. chrome.storage.local 의 설정 키 10칸이나 storage.session 스냅숏 모양이 바뀌었을 때 옛 값을 옮기거나 버리는 코드가 없습니다.
- 접근성이 여섯 영역 어디에도 항목으로 없습니다. 실측한 것 넷 — ① 화면을 갈아탈 때 초점을 옮기는 코드가 없습니다(패널·ui 전체에서 `.focus()` 호출은 packages/ui-base/src/components/overlay/Dialog.tsx:58 한 곳뿐). ② 그 Dialog 도 첫 요소에 초점을 주기만 하고 초점 가두기(Tab 순환)와 닫은 뒤 되돌리기가 없습니다. ③ 바닥줄 경고(전사 멈춤·튜터 멈춤·화면 못 찍음)에 aria-live 나 role="alert" 가 없어 화면 낭독기에 알려지지 않습니다(aria-live 는 대화 로그·Toast·StuckButton 세 곳뿐). ④ `forced-colors`·`prefers-contrast` 대응이 스타일 전체에 0건입니다(`prefers-reduced-motion` 만 style.css:506·539 에 있습니다).
- 자동 접근성 검사가 없습니다. apps/browser-extension/e2e 와 packages/design-tokens/test 에 axe·a11y·contrast 관련 코드가 0건이라, 대비비·초점 순서·이름표를 확인하는 시험이 한 건도 없습니다.
- 학습자가 볼 오류·진단 화면이 없습니다. 실패는 바닥줄 한 줄과 메모 문구로만 나오고, 무엇이 왜 안 되는지 모아 보는 자리(로그·상태 점검·자가 진단)가 없습니다. master-prompt §3-3 이 저장소 구조로 적어 둔 docs/troubleshooting.md 도 실제로 없습니다.
- 성능 예산과 부하 시험이 없습니다. 라이브 전사는 400줄을 붙잡아 두고(lesson-view.ts:458 LIVE_VISIBLE) 라우터는 seenSegments 를 2000건까지 쥐는데, 긴 교시에서 렌더·메모리가 어떻게 되는지 재는 시험이 한 건도 없습니다.
