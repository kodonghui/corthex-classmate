# src/tiro — Tiro 전사 커넥터

수업 중 흘러가는 Tiro 전사를 확장 안으로 들여오는 자리입니다. 공유 페이지 DOM 을
`MutationObserver` 로 읽어 문단을 `TranscriptSegment`(계약 정본
`packages/contracts/schemas/transcript-segment.schema.json`)로 바꿔 내보내고, 화면이
바뀌어 더 못 읽게 되면 그 사실을 신호로 알립니다. 확정 문단은 한 번만, 진행 중 문단은
순번 없이, 교시가 끝날 때 남은 문단은 `flush()` 로 건집니다. 실제 Tiro 사이트에는
접속하지 않고 `fixtures/tiro/**` 의 합성 스냅샷으로만 시험합니다.

## 파일

| 파일 | 무엇 |
|---|---|
| `types.ts` | `TiroConnector` 인터페이스와 신호 타입들. 계약 타입은 `import type` 으로만 빌려 옵니다 |
| `share-url.ts` | 이 주소가 공유 페이지인지(`isSharePageUrl`)와 매치 목록. `index.ts` 가 그대로 다시 내보냅니다 |
| `share-parser.ts` | 순수 함수. DOM → 문단 목록. 클래스 힌트 + 구조 폴백 + 선택자 깨짐 판정 + 깨졌을 때의 DOM 모양 요약 |
| `iso-time.ts` | 시각을 로컬 오프셋 표기(`+09:00`)로 적습니다. `toISOString()` 의 `Z` 를 쓰면 패널 시계가 9시간 어긋납니다 |
| `share-observer.ts` | `MutationObserver` 관찰기. 확정 → 세그먼트, 진행 → partial, `flush()`, 등급 전이 신호 |
| `period.ts` | 교시 식별자(`YYYY-MM-DD-p<n>`) 만들기와 교시 번호 읽기 |
| `lifecycle.ts` | 탭이 숨겨지거나 사라질 때 `flush()` 를 부르는 배선과 주소가 바뀔 때의 시작·정지 판정 |
| `index.ts` | 커넥터 조립. `createShareConnector`(구현) · `createMcpConnector` · `createApiConnector`(스텁) |

## 내보내는 것 네 가지

| 신호 | 언제 | 무엇이 들었나 |
|---|---|---|
| `onSegment` | 문단이 확정됐을 때, 그리고 `flush()` 했을 때 | `TranscriptSegment`. `flush()` 로 나온 것만 `state: 'partial'` 입니다 |
| `onPartial` | 진행 중 문단의 글자가 바뀔 때 | `TiroPartial`. **순번도 id 도 없습니다** — 화면에 잠깐 보여 주는 용도입니다 |
| `onHintDegraded` | 확정/진행 판별 근거 등급이 **바뀐 순간** | `HintDegradedSignal { at, stateSource, previousStateSource, degraded, shape? }` |
| `onSelectorBroken` | 문단 0개가 유예 시간(기본 30초) 넘게 이어질 때 | `SelectorBrokenSignal { at, emptyForMs, lastMatchedSelector, shape }` |

스텁 커넥터(`createMcpConnector` · `createApiConnector`)는 `start()` 에서
`not-implemented` 이 든 오류(`TiroNotImplementedError`)를 던집니다. 이벤트가 아니라 오류인
이유는 스텁이 리스너를 붙일 기회를 주지 않기 때문입니다 — 조용히 돌아오면 부르는 쪽이 전사를
영원히 기다립니다. 두 스텁은 **자격증명 인자를 받지 않습니다**(불변 원칙 §4).

세 신호 모두 **본문 문장을 담지 않습니다**(세그먼트만 담습니다). 콘솔에도 개수·등급 이름만 남깁니다.

시각(`at` · `arrivedAt`)은 `iso-time.ts` 의 `toLocalIso` 로 **로컬 오프셋 표기**로 적습니다.
`Date.prototype.toISOString()` 은 언제나 UTC(`…Z`) 라, 그대로 쓰면 패널 시계가 `11:20:46` 을
`02:20:46` 으로 보여 줍니다(실측 2026-09-03 2교시). 계약 `IsoDateTime` 은 `format: date-time`
이라 오프셋 표기와 소수점 초를 모두 받습니다. 도우미가 만드는 `at` 도 `+09:00` 이라 두 쪽 표기가
같아집니다. 받는 쪽(`src/panel/clock.ts`)도 `Z` 표기를 로컬 시각으로 옮겨 그리는 그물을 둡니다.

## 확정/진행을 가르는 두 겹

문단 하나를 문단마다 따로 가릅니다. 다른 문단의 클래스를 근거로 쓰지 않습니다.

```
문단에 font-semibold 가 있나? ──예──▶ 진행 중
        │아니오
        ▼
문단에 font-medium · text-tds-fg-subtle 이 있나? ──예──▶ 확정
        │아니오
        ▼
구조 폴백: 마지막 문단이면 진행 중, 앞 문단이면 확정
```

마지막 문단은 **확정 표시가 명시적으로 있을 때만** 확정입니다. 확정 세그먼트는 한 번 나가면
취소가 안 되므로 애매하면 진행 중 쪽에 둡니다.

클래스를 얼마나 믿을 수 있었는지는 `stateSource` 로 나옵니다.

| 값 | 뜻 | 등급 |
|---|---|---|
| `class` | 진행 힌트와 확정 힌트가 둘 다 보임 | 정상 |
| `class-partial` | 한 쪽만 보임 (녹음이 멈춘 것인지 이름이 바뀐 것인지 페이지만으로는 모름) | 약한 경보 |
| `structure` | 힌트가 하나도 없어 전부 구조 폴백 | 강한 경보 |
| `none` | 문단을 하나도 못 잡음 | 선택자 깨짐 신호가 맡음 |

`onHintDegraded` 는 이 등급이 **바뀐 순간**에만 한 번 옵니다. 등급 자체는 훑을 때마다 나오므로
그대로 흘리면 초당 수십 건이 됩니다. 정상(`class`)으로 시작하면 아무것도 내지 않고, 처음부터
낮은 등급이면 첫 훑기에서 한 번 냅니다. `none` 구간은 전이로 세지 않습니다 — 깨졌다가 같은
등급으로 돌아왔을 때 없던 전이를 지어내지 않기 위해서입니다.

## flush() 규칙

교시가 끝나거나 탭이 닫히면 마지막 문단은 영영 확정 표시를 못 받습니다. 그대로 두면 그 한
문단이 통째로 버려지므로 `flush()` 로 건집니다.

- 아직 확정되지 않은 문단을 `state: 'partial'` 세그먼트로 냅니다.
- 도착 시각(`arrivedAt`)은 **`flush()` 를 부른 시각**입니다. `spokenAt` 은 붙이지 않습니다
  — 녹음 중 공유 페이지에는 문단 시각이 없습니다.
- 부르기 전에 한 번 훑습니다. 그 사이에 확정된 문단이 있으면 그건 `'final'` 로 먼저 나갑니다.
- **id 중복 정책**: `flush()` 는 그 문단의 순번과 id 를 확정 때 쓸 값으로 **미리 잡아 둡니다.**
  나중에 같은 문단이 확정되면 새 번호를 매기지 않고 그 값을 그대로 다시 씁니다. 그래서 받는
  쪽에는 `id` 가 같은 세그먼트가 두 번 옵니다 — 먼저 `partial`, 나중에 `final`. **나중 것이
  앞 것을 덮습니다**(id 가 문단 하나를 가리키는 키입니다). 서로 다른 id 를 주면 문단 하나가
  두 문장으로 세어 요약과 복습이 어긋납니다.
- 같은 문단을 두 번 `flush()` 하면 글자가 그대로일 때는 내지 않고, 자랐을 때만 같은 id 로 다시 냅니다.
- `stop()` 뒤에는 아무것도 내지 않습니다. 그래서 부르는 순서는 언제나 **flush → stop** 입니다.

부르는 자리는 `lifecycle.ts` 가 정합니다.

```
pagehide                 → flush() 하고 stop()   탭이 닫히거나 뒤로 감
visibilitychange(hidden) → flush() 만            다른 탭으로 옮긴 것뿐 · 관찰은 이어 감
tiro.stop 요청            → flush() 하고 stop()   사람이 교시를 끝냄
주소만 바뀜(SPA)          → 아래 표대로            decideNavigationAction 이 정함
```

`beforeunload` 는 쓰지 않습니다. bfcache 에서 불리지 않는 경우가 있고 `pagehide` 가 그 자리를 대신합니다.

## 언제 시작하고 언제 멈추나 (SPA 이동 포함)

content script 는 `document_idle` 에 **한 번** 뜨고 그 뒤로는 다시 뜨지 않습니다. 매치가
`https://tiro.ooo/*` 라 홈·설정 페이지에서도 뜨는데, 그 자리에서 곧바로 돌아가고 주소를 다시
보지 않으면 두 가지가 깨집니다 — tiro.ooo 안에서 클릭으로 노트를 열었을 때 관찰이 아예 시작되지
않고, 반대로 공유 페이지에서 나갔을 때 관찰기가 그 화면에 남아 없는 `selector_broken` 을 냅니다.

그래서 content script 가 WXT 의 `ctx.addEventListener(window, 'wxt:locationchange', …)` 를 듣고
`decideNavigationAction(이전 주소, 새 주소)` 의 답을 따릅니다.

| 이전 | 새 | 결과 | 왜 |
|---|---|---|---|
| 공유 아님 | 공유 | `start` | 이제부터 읽을 것이 있습니다 |
| 공유 | 공유 아님 | `stop` | flush 하고 멈춥니다(순서는 언제나 flush → stop) |
| 공유 | 공유 | `none` | 노트만 바뀐 것이라 관찰을 이어 갑니다 |
| 공유 아님 | 공유 아님 | `none` | 처음부터 볼 것이 없었습니다 |

tiro.ooo 가 실제로 클라이언트 라우팅으로 노트를 여는지는 아직 재어 보지 않았습니다(Gate A 관찰에
기록이 없습니다). **양쪽 다 안전합니다** — 라우팅을 쓰면 이 배선이 놓치던 시작·정지를 살리고,
쓰지 않아 매번 전체 새로고침이면 `wxt:locationchange` 자체가 오지 않아 지금까지와 똑같이 돕니다.

멈출 때는 생명주기 배선(`pagehide` · `visibilitychange`)도 **함께 뗍니다.** `attachLifecycleFlush`
가 돌려준 해제 함수를 버리면 멈춘 커넥터의 `flush()` 를 부르는 리스너가 페이지에 남습니다.

커넥터의 `stop()` 은 관찰만 멈추고 **구독은 남깁니다.** stop → start 로 되살렸을 때 받는 사람이
없어 전사가 조용히 사라지는 것을 막기 위해서입니다. 구독을 정말 끊으려면 `onSegment()` 가
돌려준 해제 함수를 부릅니다.

## 교시 번호 규칙

교시 식별자는 계약이 `YYYY-MM-DD-p<n>` 로 못 박아 두었습니다(`common.schema.json` 의 `PeriodId`).

1. `createShareConnector({ periodId })` 로 식별자를 통째로 넣으면 그것을 씁니다. 단,
   **계약 모양을 검사하고 어긋나면 `RangeError` 로 막습니다.** 교시 번호와 달리 되돌릴 안전한
   값이 없고, 이 값은 손대지 않은 채 모든 세그먼트에 실려 나가 받는 쪽 스키마 검증에 걸립니다.
   정규식은 `period.ts` 의 `PERIOD_ID_PATTERN` 하나이고, 계약 원본과 같은지는 시험이 지킵니다.
2. 없으면 `periodNumber` 와 `now()` 의 **로컬 날짜**로 만듭니다.
3. `periodNumber` 도 없으면 1 입니다.
4. 확장 안에서는 content script 가 `readPeriodNumber()` 로 `chrome.storage.local` 의
   `classmate.periodNumber` 를 먼저 읽어 `periodNumber` 로 넣어 줍니다.
5. 값이 정수 1~8 이 아니면 **막지 않고 1 로 되돌립니다.** 교시 번호 하나 때문에 전사가
   통째로 멈추는 것보다 낫습니다.

`readPeriodNumber()` 는 숫자만 주지 않고 `{ value, source }` 를 줍니다. `source` 가 없으면
"값이 없어 1" 과 "읽다 실패해서 1" 이 똑같이 보여, 3교시 수업이 저장소 오류로 조용히 `…-p1` 에
섞여도 아무도 알아채지 못합니다.

| `source` | 뜻 |
|---|---|
| `storage` | 저장소 값을 그대로 썼습니다 |
| `default` | 값이 없거나 쓸 수 없는 값이라 1 로 되돌렸습니다 |
| `error` | 읽다가 실패해 1 로 때웠습니다 (content script 가 콘솔에 한 줄 남깁니다) |

저장소 읽기는 커넥터 안에서 하지 않습니다. 비동기 읽기가 커넥터를 만드는 자리까지 비동기로
물들이고, 시험이 `chrome.storage` 를 흉내 내야 하기 때문입니다. 그래서 값을 **주입**받습니다.

## 시험

`pnpm --filter @classmate/browser-extension exec vitest run src/tiro`

명세는 jsdom 이라고 적혀 있지만 이 저장소는 **happy-dom** 을 씁니다. 같은 DOM 시험을 돌리는
데 이미 설치돼 있고(시험 파일 맨 위의 `// @vitest-environment happy-dom` 한 줄로 켭니다), 이
단위는 새 의존성을 더하지 않기로 했기 때문입니다.

Tiro 사이트에는 접속하지 않습니다. `fixtures/tiro/**` 의 합성 스냅샷을 happy-dom 에 넣고
`MutationObserver` 로 문단을 자라게 만드는 것이 이 단위의 e2e 입니다
(`share-observer.test.ts` 의 「스냅샷 재생 시나리오」).

## 멈췄을 때 무엇을 보나

전사가 멈추면 패널에 「전사가 잠시 멈췄어요 … 다시 연결」이 뜹니다. 그 줄만으로는 **왜** 못
읽는지 알 수 없어 파서를 고칠 수 없습니다. 그래서 멈춤 신호에 그 순간의 DOM 모양 요약을
함께 싣고, 서비스 워커가 그것을 자기 콘솔에 한 줄 적습니다.

### 1. 서비스 워커 콘솔 여는 법

```
Chrome 주소창 → chrome://extensions
  → Corthex Classmate 카드의 「서비스 워커」 링크 클릭
  → 열린 DevTools 의 Console 탭
```

카드에 「서비스 워커(비활성)」로 적혀 있으면 잠든 것입니다. 사이드패널을 열거나 공유 페이지에서
문단이 하나 더 생기면 깨어납니다. 콘솔은 워커가 내려가면 비므로, 멈춘 직후에 열어 두세요.
공유 페이지 쪽 콘솔(그 탭의 DevTools)에는 등급 이름만 적힙니다 — 모양 요약은 워커 콘솔입니다.

### 2. shape 로그 읽는 법

```
[classmate] tiro selector shape  selector-broken  그릇 main · 문단 후보 3개 · 클래스 tds-transcript-line×3 leading-7×3 tds-tone-subtle×2
                                 └─ 왜 멈췄나 ─┘  └─ 그때 페이지가 어떤 모양이었나 ────────────────────────────┘
```

| 칸 | 뜻 | 이렇게 읽습니다 |
|---|---|---|
| `selector-broken` | 문단을 **하나도** 못 잡았습니다 | 선택자 네 개가 전부 빗나갔습니다 |
| `hint-class-partial` | 진행·확정 힌트 중 한 쪽만 보였습니다 | 녹음이 멈춘 것일 수도, 클래스 한 쪽 이름이 바뀐 것일 수도 있습니다 |
| `hint-structure` | 힌트가 하나도 없어 전부 구조 폴백입니다 | `font-*` 계열 이름이 통째로 바뀌었습니다 |
| `그릇 main` | 문단을 담고 있던 그릇의 태그입니다 | `없음`·`body` 면 `main` 자체가 사라진 배포입니다 |
| `문단 후보 3개` | 글자를 품은 **가장 안쪽** 요소 수입니다 | `0개` 면 화면이 아직 안 그려졌거나 다른 문서(iframe)입니다 |
| `클래스 …×3` | 그 후보들에 붙은 클래스 이름 상위 5개와 개수입니다 | 여기 보이는 이름이 다음 파서가 잡아야 할 이름입니다 |

고치는 자리는 `share-parser.ts` 의 상수 셋입니다.

```
문단을 못 잡음(selector-broken)        → PARAGRAPH_SELECTORS 에 새 이름 한 줄 추가
확정/진행을 못 가름(hint-structure)     → IN_PROGRESS_CLASS · FINAL_CLASSES 갱신
```

요약에는 **개수와 클래스 이름만** 들어갑니다. 본문 문장·주소·`id` 값은 넣지 않고, 주소가 숨을 수
있는 대괄호 임의값 클래스(`bg-[url('…')]`)는 이름 대신 `(임의값)` 한 자리로 모아 셉니다
(불변 원칙 §4-3). 길이는 500자에서 자릅니다.

요약은 **계약 사건에 싣지 않습니다.** 도우미로 가는 `connector.status` 의 payload 는 그대로
`{connector, state, reason}` 뿐입니다. 이 값은 세션 기록이 아니라 사람이 그 자리에서 읽고
파서를 고칠 단서이기 때문입니다(계약을 늘리지 않기로 한 약속도 그대로 지킵니다).

### 3. 고친 뒤 다시 붙이기

패널 바닥줄의 「다시 연결」을 누르면 `classmate.reconnect {connector:"tiro-share"}` 가
서비스 워커로 가고, 워커가 공유 페이지 탭에 `tiro.stop` → `tiro.start` 를 보냅니다.
`tiro.start` 는 관찰기를 **새로** 만들어 붙자마자 한 번 훑으므로, 깨진 채로 있던 페이지도
그 자리에서 다시 읽힙니다(`share-observer.test.ts` 의 「다시 연결」 시험이 이 길을 못 박습니다).
확장 코드를 고쳤다면 `chrome://extensions` 에서 새로고침한 뒤 공유 페이지도 새로고침해야 합니다.

## 알려진 한계

### `seq` 는 문단 순서가 아니라 **내보낸 순서**입니다

`seq` 는 문단이 **확정될 때** 1씩 떼어 붙입니다(`share-observer.ts` 의 `takeSeqAndId`).
문단은 하나씩 따로 판정하므로, 앞 문단이 아직 진행 중인데 뒤 문단이 먼저 확정되는 배포에서는
뒤 문단이 작은 `seq` 를, 앞 문단이 큰 `seq` 를 받습니다. `seq` 로만 정렬하면 두 문장이 뒤집힙니다.

```
화면 순서   문단 A (in_progress)   문단 B (final)     ← 앞이 아직 자라는 중
확정 순서   B 먼저 → seq 1          A 나중 → seq 2
seq 정렬    B, A                                     ← 화면과 반대
```

고치지 않고 적어 두는 이유:

- 계약(`transcript-segment.schema.json`)에 문단 위치를 담을 `index` 칸이 없어, 위치 순서를
  그대로 실어 보낼 자리가 없습니다. 계약은 이번 라운드에서 고치지 않기로 했습니다.
- 실측 DOM(`docs/spikes/gate-a-tiro.md`)에서는 마지막 문단만 `font-semibold` 라 정상 배포에서는
  이 상태가 나오지 않습니다. 클래스 이름이 바뀐 배포에서만 열립니다.
- 받는 쪽인 세션 스토어가 **자체 순번(도착 순)** 으로 정렬합니다(`apps/native-host` 의
  `events` 표는 `seq INTEGER PRIMARY KEY AUTOINCREMENT` 입니다). 전사가 도착한 순서는
  화면 순서와 같으므로 저장·복원 경로에서는 이 뒤집힘이 드러나지 않습니다.

`seq` 로 직접 정렬하는 새 소비자를 붙일 때는 이 줄을 먼저 읽어야 합니다.

### 다시 시작하면 `seq` 가 1부터 다시 셉니다

`stop()` → `start()` 를 하면 새 관찰기가 만들어져 순번이 1 로 돌아갑니다(SPA 안에서 공유
페이지를 나갔다 돌아오는 경우). 새로고침과 같은 상황이고, 교시 전체를 아는 세션 스토어가
이어 붙이는 것으로 이미 넘겨 두었습니다(아래 「2라운드에 넘기는 일」).

### 문단 신원이 위치(`index`)입니다

문단 목록이 앞에서 잘려 번호가 밀리면 이미 낸 문단을 다시 내거나 새 문단을 건너뜁니다.
실측에서 60분 교시도 문단 60개 남짓이라 가상 스크롤로 잘릴 규모가 아니고, 지속 신원은
세션 스토어 몫으로 넘겨 두었습니다.

## 받는 쪽 — 2라운드에 붙었습니다

네 가지 메시지를 받는 쪽이 생겼습니다. 말의 이름과 좁힘 함수는 이제
`src/background/tiro-messages.ts` 가 정본이고, content script 는 그것을 그대로 다시 냅니다
(`entrypoints/**` 는 vitest 대상이 아니라 판정 함수를 `src/` 로 옮겨야 시험할 수 있습니다).

| 보내는 말 | 라우터가 하는 일 (`src/background/router.ts`) |
|---|---|
| `tiro.segment` | 도우미에 `event.append` `transcript.segment {segmentId, seq, state, segment}` + 패널에 `live.segment` · 같은 사건 + `connector.status {tiro-share, connected}` |
| `tiro.partial` | **패널에만** `live.segment`(`state: "partial"`). 기록하지 않습니다 — 아직 순번도 신원도 없고 확정되면 `tiro.segment` 로 다시 옵니다. 식별자는 문단 자리로 고정해 같은 줄이 갱신되게 합니다 |
| `tiro.hint_degraded` | `connector.status {tiro-share, paused, "hint-<등급>"}` · `degraded:false` 로 돌아오면 `connected` |
| `tiro.selector_broken` | `connector.status {tiro-share, paused, "selector-broken"}` |

예고한 대로 **계약을 고치지 않고** 커넥터 내부 이벤트를 `connector.status` payload 로 옮겨
실었습니다. 같은 상태가 이어지면 사건을 다시 내지 않습니다(공유 페이지가 조용히 깨진 채로
있어도 기록이 초당 한 줄씩 늘지 않습니다).

받는 쪽이 붙었으므로 `sendMessage` 는 이제 대개 성공합니다. 사이드패널이 닫혀 있고 서비스
워커가 잠들어 있으면 잠깐 떨어질 수 있는데, 다음 문단이 워커를 다시 깨웁니다.

### `tiro.stop` 과 `tiro.start` 를 보내는 쪽

사람이 사이드패널에서 「전사 다시 연결」을 누르면 라우터가 `classmate.reconnect
{connector:"tiro-share"}` 를 받아 `tiro.stop` → `tiro.start` 를 이 순서로 보냅니다.
`stop` 이 진행 중 문단을 partial 세그먼트로 한 번 건지므로 마지막 한 문단이 버려지지
않습니다. `tiro.start` 를 받아도 **주소가 공유 페이지가 아니면 시작하지 않습니다** — 시작
판정은 언제나 주소가 합니다.

## 아직 남은 일

- **새로고침 뒤 순번 이어 붙이기.** 지금은 새 문서에서 `seq` 가 1부터 다시 시작합니다.
  교시 전체를 아는 세션 스토어가 맡아야 합니다. 다만 기록이 겹치지는 않습니다 — 라우터가
  만드는 사건 `id` 가 서비스 워커 세대마다 다르고, 도우미가 같은 `id` 를 `duplicate: true`
  로 걸러 주기 때문입니다.
- **1순위 커넥터 채우기.** `createMcpConnector` · `createApiConnector` 는 스텁입니다.
  Gate A 의 (a) 측정(사람의 MCP 인증)이 끝나야 무엇을 어떻게 폴링할지 정해집니다.
