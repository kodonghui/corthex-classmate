# @classmate/contracts

Corthex Classmate 의 계약 정본입니다. 확장·로컬 도우미·복습자료 생성기가 같은 필드 이름과
같은 값 범위를 쓰도록 여기 한곳에서 정합니다.

## 규칙: 스키마가 정본, 타입은 생성물

```
schemas/*.schema.json        ← 정본. 사람이 고치는 곳
        │
        │  pnpm --filter @classmate/contracts generate
        ▼
src/generated/*.ts           ← 생성물. 손으로 고치지 않는 곳 (커밋은 함)
        │
        ▼
src/index.ts                 ← 생성물 재수출 + 상수 + createValidator
```

- `src/generated/` 는 `.gitignore` 에 넣지 않습니다. 의존성을 설치하지 않은 사람도
  타입을 읽을 수 있어야 하고, 스키마와 타입이 어긋난 커밋을 diff 로 잡아내기 위함입니다.
- 생성 파일 머리에는 `생성물 · 직접 고치지 말 것` 주석이 붙습니다. 그 파일을 고치면
  다음 `generate` 에서 지워집니다.

## 스키마를 고치는 절차

1. `schemas/<이름>.schema.json` 을 고칩니다. 객체에는 `additionalProperties: false` 와
   `required` 를 반드시 적고, `description` 은 한국어 한 문장으로 답니다.
2. 새 파일을 만들었으면 `scripts/generate.mjs` 의 `SCHEMA_NAMES` 와
   `src/index.ts` 의 `SCHEMA_NAMES` 두 곳에 이름을 더합니다.
   (빠뜨리면 `generate` 와 시험이 각각 막아 줍니다.)
3. `schemas/examples/` 에 통과 예시를 하나 이상 더합니다. 파일 이름의 첫 마디가
   스키마 이름이어야 합니다. 보기 `answer.1.json` · `session-event.2.json`
4. 값 범위를 좁혔으면 `schemas/examples/invalid/` 에 거부 예시를 함께 더합니다.
   보기 `answer.long-conclusion.json`
5. `pnpm --filter @classmate/contracts test` 를 돌립니다.
   `pretest` 가 `generate` 를 먼저 실행하므로 생성물이 항상 최신입니다.
6. 바뀐 `src/generated/*` 도 함께 커밋합니다.

## 명령

| 목적 | 명령 |
|---|---|
| 타입 생성 | `pnpm --filter @classmate/contracts generate` |
| 시험 | `pnpm --filter @classmate/contracts test` |
| 타입 검사 | `pnpm --filter @classmate/contracts typecheck` |

## 담긴 계약

| 스키마 | 무엇 |
|---|---|
| `common` | `Id` · `IsoDateTime` · `PeriodId` · `SourceAges` · `TutorState` |
| `evidence-level` | 근거 단계 네 가지. 한국어 문구는 `x-labels-ko` 에 함께 적혀 있습니다 |
| `transcript-segment` | 전사 문장 한 조각 |
| `screen-frame` | 화면이 바뀐 순간의 WebP 프레임 한 장 |
| `editor-context` | 읽기 전용으로 본 편집기 화면 문맥 |
| `question` | 붙잡은 순간과 그때 봉인한 자료 묶음 |
| `answer` | 40자 이내 결론 · 근거 · 칩 2~3개 · 접힌 상세 |
| `session-event` | 교시 세션에 시간 순서로 쌓이는 기록 한 줄 |

### id 접두사 규칙

| 규칙 | 보기 |
|---|---|
| `q-` 질문 · `ans-` 답 · `ts-` 전사 조각 · `sf-` 화면 프레임 · `ec-` 편집기 문맥 · `ev-` 세션 이벤트 뒤에 `-<교시>-<3자리 일련번호>` 를 붙입니다. `schemas/examples/` 와 `fixtures/` 가 같은 규칙을 씁니다. | `q-p3-001` |

## 알아 둘 점

- `Answer.chips` 는 스키마에서 2~3개로 묶여 있지만 생성되는 TypeScript 타입은
  `string[]` 입니다. `generate` 가 `ignoreMinAndMaxItems` 를 켜서 튜플로 굳지 않게
  합니다. 개수는 `createValidator("answer")` 가 실행 시점에 봅니다.
- `SessionEvent.payload` 는 `type` 마다 모양이 달라 자유 객체입니다. `additionalProperties: true`
  라서 생성 타입은 `{ [k: string]: unknown }` 이 됩니다. 다만 `state.changed` 일 때는
  `{ from, to }` 만 받도록 스키마 안 `if`/`then` 이 막습니다.
  `json-schema-to-typescript` 는 `if`/`then` 을 타입으로 옮기지 않으므로, 이 제약은
  타입이 아니라 검증기에서만 보입니다.
- `payload` 판별 유니온(`type` 별 `oneOf`)은 Phase 2 에서 붙입니다.
- `x-labels-ko` 는 JSON Schema 표준 키워드가 아닙니다. `getAjv()` 가
  `addVocabulary(["x-labels-ko"])` 로 미리 알려 둡니다.
- `src/index.ts` 는 스키마 JSON 을 `import` 로 읽습니다. 번들러(Vite·WXT)와 Vitest 는
  그대로 되지만, 순수 Node ESM 으로 직접 실행할 때는 JSON import 지원이 필요합니다.

## Rust 쪽 계획

Rust 타입은 아직 만들지 않습니다. Phase 2 에서 `apps/native-host` 의 `build.rs` 가
`typify` 로 같은 `schemas/*.schema.json` 을 읽어 crate 안에 타입을 만드는 방향으로 붙입니다.
그때도 정본은 이 폴더의 JSON Schema 하나뿐입니다.
