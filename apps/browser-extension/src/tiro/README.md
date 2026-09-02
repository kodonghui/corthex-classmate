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
| `share-parser.ts` | 순수 함수. DOM → 문단 목록. 클래스 힌트 + 구조 폴백 + 선택자 깨짐 판정 |
| `share-observer.ts` | `MutationObserver` 관찰기. 확정 → 세그먼트, 진행 → partial, `flush()`, 등급 전이 신호 |
| `period.ts` | 교시 식별자(`YYYY-MM-DD-p<n>`) 만들기와 교시 번호 읽기 |
| `lifecycle.ts` | 탭이 숨겨지거나 사라질 때 `flush()` 를 부르는 배선 |
| `index.ts` | 커넥터 조립. `createShareConnector`(구현) · `createMcpConnector` · `createApiConnector`(스텁) |

## 내보내는 것 네 가지

| 신호 | 언제 | 무엇이 들었나 |
|---|---|---|
| `onSegment` | 문단이 확정됐을 때, 그리고 `flush()` 했을 때 | `TranscriptSegment`. `flush()` 로 나온 것만 `state: 'partial'` 입니다 |
| `onPartial` | 진행 중 문단의 글자가 바뀔 때 | `TiroPartial`. **순번도 id 도 없습니다** — 화면에 잠깐 보여 주는 용도입니다 |
| `onHintDegraded` | 확정/진행 판별 근거 등급이 **바뀐 순간** | `HintDegradedSignal { at, stateSource, previousStateSource, degraded }` |
| `onSelectorBroken` | 문단 0개가 유예 시간(기본 30초) 넘게 이어질 때 | `SelectorBrokenSignal { at, emptyForMs, lastMatchedSelector }` |

스텁 커넥터(`createMcpConnector` · `createApiConnector`)는 `start()` 에서
`not-implemented` 이 든 오류(`TiroNotImplementedError`)를 던집니다. 이벤트가 아니라 오류인
이유는 스텁이 리스너를 붙일 기회를 주지 않기 때문입니다 — 조용히 돌아오면 부르는 쪽이 전사를
영원히 기다립니다. 두 스텁은 **자격증명 인자를 받지 않습니다**(불변 원칙 §4).

세 신호 모두 **본문 문장을 담지 않습니다**(세그먼트만 담습니다). 콘솔에도 개수·등급 이름만 남깁니다.

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
```

`beforeunload` 는 쓰지 않습니다. bfcache 에서 불리지 않는 경우가 있고 `pagehide` 가 그 자리를 대신합니다.

## 교시 번호 규칙

교시 식별자는 계약이 `YYYY-MM-DD-p<n>` 로 못 박아 두었습니다(`common.schema.json` 의 `PeriodId`).

1. `createShareConnector({ periodId })` 로 식별자를 통째로 넣으면 그것을 씁니다.
2. 없으면 `periodNumber` 와 `now()` 의 **로컬 날짜**로 만듭니다.
3. `periodNumber` 도 없으면 1 입니다.
4. 확장 안에서는 content script 가 `readPeriodNumber()` 로 `chrome.storage.local` 의
   `classmate.periodNumber` 를 먼저 읽어 `periodNumber` 로 넣어 줍니다.
5. 값이 정수 1~8 이 아니면 **막지 않고 1 로 되돌립니다.** 교시 번호 하나 때문에 전사가
   통째로 멈추는 것보다 낫습니다.

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

## 2라운드에 넘기는 일

- **`connector.status` 로 옮겨 싣기.** `tiro.hint_degraded` 는 계약 밖 **커넥터 내부
  이벤트**입니다. `session-event.schema.json` 의 `type` 열거 14개는 고정이고 이번 라운드에서
  계약을 고치지 않기로 했습니다. background 가 이 신호를 받아 `connector.status` 세션 이벤트의
  payload 로 실어 보내는 것이 다음 자리입니다. `tiro.selector_broken` 도 같습니다.
- **background 수신부.** `entrypoints/background.ts` 는 다른 단위 소유라 이 단위가 만들지
  않았습니다. 지금 content script 의 `sendMessage` 는 받는 쪽이 없어 조용히 떨어집니다.
- **`tiro.stop` 을 보내는 쪽.** 듣는 쪽만 붙여 두었습니다. 교시 종료를 아는 세션 관리가 보냅니다.
- **새로고침 뒤 순번 이어 붙이기.** 지금은 새 문서에서 `seq` 가 1부터 다시 시작합니다.
  교시 전체를 아는 세션 스토어가 맡아야 합니다.
- **1순위 커넥터 채우기.** `createMcpConnector` · `createApiConnector` 는 스텁입니다.
  Gate A 의 (a) 측정(사람의 MCP 인증)이 끝나야 무엇을 어떻게 폴링할지 정해집니다.
