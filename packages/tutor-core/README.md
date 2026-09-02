# @classmate/tutor-core

튜터의 머리 부분입니다. 화면도 저장소도 네트워크도 없는 **순수 TypeScript** 묶음이라, 확장·네이티브 도우미·시험이
같은 규칙을 함께 씁니다. 붙잡은 순간의 자료를 굳히는 봉인(`sealSnapshot`), 앱이 통제하는 상태기계(`transition`),
18초 접힘 시계(`FoldTimer`), 그리고 답 한 장이 지나는 길(`answerView`)까지 네 가지를 맡습니다. 상태기계는 부수
효과를 내지 않고 **효과를 데이터로 돌려주기만** 합니다. 실제로 시각을 읽고 예약을 거는 일은 `Clock`·`Scheduler`
를 넣어 주는 바깥쪽이 하고, 시험에서는 손으로 미는 가짜 시계를 넣습니다. 계약 타입은 `import type` 으로만
들여옵니다(값으로 들여오면 Ajv 가 MV3 CSP 에 막힙니다).

- 정본: `docs/master-prompt.md` §3-4(상태기계·적응형 신호), `docs/design-map.md` §4(PREP=1600 · FOLD=18000 · 칩 클릭 시 리셋 · START 10:32:10), 계약 `packages/contracts`(TutorState · SessionEvent · Question · Answer).
- 재생 원본: `fixtures/synthetic-class/golden-ioc/` (읽기만 합니다).

## 상태기계

앱이 단계를 통제합니다. 프롬프트 하나에 맡기지 않습니다.

```
CAPTURE ──question.asked/stuck──▶ ANSWER_MINIMAL ──18초 접힘·period.ended·back──▶ CAPTURE
   │                                    │
   │                                    ├─ preparing ──PREP 1.6초──▶ minimal ──detail──▶ detail ──back──▶ minimal
   │                                    └─ answer.failed ─▶ waiting ─▶ answer.recovered ─▶ minimal
   │
   └──next(교시 끝난 뒤)──▶ EXIT_RECALL ──next──▶ FEEDBACK ──next──▶ FADE_SUPPORT ──next──▶ DELAYED_CHECK ──next──▶ CAPTURE
```

- 계약이 정한 상태는 6가지(`TutorState`)입니다. 그 안쪽 메모 자리는 `note`(none · preparing · minimal · waiting · detail · folded)로 따로 셉니다. 메모가 접히면 메모는 `folded` 로 남고 튜터 상태는 `CAPTURE` 로 돌아갑니다.
- 제공자 형편은 또 다른 축(`provider`: idle · asking · queued · failed)이고, 답의 진행 상태(`answerStatus`)는 계약 `Answer.status`(answered · queued · error · recovered) 값을 그대로 씁니다.
- 입력은 **세션 사건 14가지 + 사람 조작 6가지 = 20가지**입니다. 조작은 `stuck`(붙잡기) · `chip`(칩 클릭) · `detail`(자세히) · `back`(수업으로 돌아가기) · `next`(다음 단계) · `tick`(시계).
- 전이는 함수에 흩어 두지 않고 `TRANSITION_TABLE` 이라는 **표**에 모았습니다. 6 × 20 = 120칸 중 93칸에 규칙이 있고, 나머지 27칸은 상태를 바꾸지 않고 `ignored` 효과만 남깁니다. 칸이 있어도 조건이 맞지 않으면(예: 교시가 끝나지 않았는데 `next`) 똑같이 무시됩니다.
- 상태 이름이 바뀌면 `state.changed` 초안이 **효과 맨 앞에** 자동으로 붙습니다. 규칙이 깜빡해도 기록이 비지 않습니다.

| 효과 | 뜻 |
|---|---|
| `emit` | 이 세션 사건을 기록에 남겨 주세요(`state.changed` · `question.asked`) |
| `schedule` / `cancel` | 접힘 시계를 이 시각에 걸어 주세요 / 지워 주세요 |
| `ask` | 이 질문과 봉인을 제공자에게 물어봐 주세요 |
| `ignored` | 표에 칸이 없거나 조건이 맞지 않아 아무것도 하지 않았습니다. 따로 알릴 까닭이 있으면 `reason` 이 붙습니다 |

## 입력 규칙

상태기계에 넣는 입력이 지켜야 할 것들입니다. 시각을 잘못 읽으면 그 시각이 `state.changed` 의 `at` 과 접힘 예약에
그대로 실려 **영구 기록에 남기 때문에**, 시각만큼은 조용히 넘어가지 않습니다.

1. **시각의 출처.** 사건(`{ kind: "event" }`)은 자기 `at`, 사람 조작은 넣어 준 `now`(epoch 밀리초)를 씁니다.
2. **읽을 수 없는 시각은 예외입니다.** 사건의 `at` 이 ISO-8601 이 아니거나 조작의 `now` 가 유한한 수가 아니면
   `transition` 이 `MachineError` 를 던집니다. 직전 시각으로 슬쩍 넘어가지 않습니다(`time.ts` 의 `parseIso` 와 같은
   취지). 사건을 넣는 쪽이 기록에 남기기 전에 잡아야 하는 오류입니다.
3. **`state.now` 는 뒤로 가지 않습니다.** 늦게 도착한 사건은 처리하되 시계는 직전 시각에 머뭅니다. 뒤로 가는
   `tick` 은 새로 알려 주는 것이 없어 통째로 무시하고 `{ kind: "ignored", reason: "time-went-backward" }` 만 남깁니다.

```ts
try {
  const { next, effects } = transition(state, { kind: "event", event }, env);
} catch (error) {
  if (error instanceof MachineError) {
    // error.input 에 어느 입력이었는지 들어 있습니다. 그 사건은 기록에 넣지 않습니다.
  }
}
```

## 봉인 규칙 (`sealSnapshot`)

붙잡은 순간의 자료만 골라 계약 `Question.snapshot` 모양으로 굳힙니다.

1. **질문 시각(`askedAt`)보다 뒤에 도착한 자료는 넣지 않습니다.** 뒤에 전사가 이어져도 이 묶음은 그대로 남습니다.
2. 전사는 **최근 N문단**(기본 3)만 넣고 오래된 것이 앞, 최근 것이 뒤로 옵니다. 도착 시각이 같으면 `seq` 순입니다.
3. 화면 프레임과 편집기 문맥은 기준선까지 들어온 것 중 **가장 마지막 한 개**를 넣습니다.
4. 자료 나이는 `askedAt - arrivedAt/capturedAt` 을 초로 **내림**해 셉니다. 자료가 없으면 그 자리를 아예 넣지 않고 나이만 `null` 로 둡니다.

골든 시나리오 첫 질문(10:32:18)이면 전사 3개(`ts-p3-003·004·005`) · 프레임 `sf-p3-001` · 문맥 `ec-p3-001` · 나이 4초·2초·1초가 나옵니다.

## 주입 인터페이스

브라우저 API 를 직접 부르지 않습니다(`src/**` 에 0건인지 시험이 확인합니다).

```ts
interface Clock { now(): number }                                   // epoch 밀리초
interface Scheduler { schedule(delayMs: number, run: () => void): Cancel }

const timer = new FoldTimer({ clock, scheduler, onFold: (at) => send({ kind: "tick", now: at }) });
const { next, effects } = transition(state, { kind: "chip", now: clock.now(), chipId: "더 쉽게" }, env);
timer.apply(effects);   // schedule · cancel 효과를 그대로 반영합니다
```

`createEnv(periodId, { provider, foldMs, prepMs, autoFold, tzOffsetMinutes })` 로 환경을 만듭니다. 설정의 "자동 접기"
를 끄면(`autoFold: false`) 접힘 시계를 아예 걸지 않고 메모가 그대로 남습니다.

## 시험

```bash
pnpm --filter @classmate/tutor-core test        # vitest run
pnpm --filter @classmate/tutor-core typecheck   # tsc --noEmit
```

- `test/machine-table.test.ts` — 120칸 전수. 어느 칸에 규칙이 있는지, 밀었을 때 어디로 가는지를 표로 적어 두고 순회합니다.
- `test/machine.test.ts` — 준비 1.6초 · 18초 접힘 · 칩 리셋 · 자세히 정지 · 교시 뒤 단계 이동 · 입력 시각 규칙(깨진 `at` → `MachineError`, 뒤로 가는 `tick` → `ignored`).
- `test/snapshot.test.ts` — 봉인이 질문 이후 자료를 섞지 않는지, 나이 계산, 계약 검증기 통과.
- `test/fold-timer.test.ts` — 가짜 시계·가짜 예약기로 18초를 손으로 밉니다.
- `test/answer-flow.test.ts` — 오류 → 대기(queued) → 되살아남(recovered)과 계약 `Answer.status` 값.
- `test/replay-fixtures.test.ts` — **e2e.** `session-events.jsonl` 27줄을 1초 간격으로 흘려보내 `state.changed` 4건(from·to)과 두 질문의 봉인을 fixture 그대로 다시 만듭니다.
- `test/source-rules.test.ts` — `src/**` 에 브라우저 API 0건 · 계약은 `import type` 만. 검사기 자체도 가짜 소스로 확인합니다(값 재수출은 잡고, `export type { … } from` 은 통과하고, 주석 속 "import type" 에 속지 않습니다).

### e2e 재생에서 알아 둘 것

fixture 의 네 번째 `state.changed`(10:33:09)는 사람이 "수업으로 돌아가기" 를 누른 시각입니다. 사람 조작은 JSONL 에
없으므로 재생에서는 `period.ended`(10:33:14)가 그 자리를 대신합니다. `from`·`to` 와 순서는 fixture 와 같고 시각만
5초 늦습니다. 앞의 세 건은 시각까지 같으며, 특히 두 번째(10:32:42)는 답이 뜬 10:32:24 에서 18초를 센 결과입니다.
