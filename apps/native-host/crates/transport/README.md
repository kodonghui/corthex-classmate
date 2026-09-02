# classmate-transport

Chrome Native Messaging 전송층입니다. 확장이 보낸 바이트를 값으로 푸는 **프레이밍**, 그 값이 `packages/contracts` 의 계약에 맞는지 보는 **손 검증기**, 봉투의 `type` 을 보고 무엇을 어떤 스키마로 검사할지 정하는 **표** 세 가지를 담습니다. 스키마는 `include_str!` 로 실행 파일 안에 박아 읽기만 하고 절대 고치지 않습니다(계약은 `packages/contracts/frozen.sha256` 로 고정 상태입니다). 오류 문구에는 확장이 준 문자열을 되돌려 담지 않고 어긋난 자리와 까닭만 적습니다. 이 크레이트에는 파일을 열거나 프로세스를 띄우거나 네트워크로 내보내는 코드가 없습니다. 검증: `cargo test -p classmate-transport --manifest-path apps/native-host/Cargo.toml`.

```
확장  ──stdin──▶  framing  ──Value──▶  validate_envelope  ──payload──▶  schema::validate
               4바이트 길이+JSON        type 로 갈래 나눔          contracts 스키마로 검사
```

## 1. framing — 4바이트 길이 + JSON

한 메시지는 `리틀엔디언 u32 길이` + `그 길이만큼의 UTF-8 JSON` 입니다. 상한은 1 MiB(`MAX_MESSAGE_BYTES`)입니다.

읽기는 **살릴 수 있는 오류와 없는 오류를 가릅니다.**

| 무슨 일 | 결과 | 왜 |
|---|---|---|
| 정상 | `Ok(Frame::Message(값))` | |
| 프레임 경계에서 스트림이 닫힘 | `Ok(Frame::Eof)` | 정상 종료입니다 |
| 본문은 다 읽었는데 UTF-8·JSON 이 아님 | `Ok(Frame::Undecodable { bytes, detail })` | 다음 프레임 경계가 그대로라 오류로 답하고 계속 삽니다 |
| 길이 헤더가 끊김 · 본문이 잘림 · 상한 초과 | `Err` | 다음 프레임이 어디서 시작하는지 알 수 없습니다 |

`detail` 에는 길이(바이트 수)만 담고 본문 원문은 담지 않습니다. 확장이 보낸 문장이 로그·응답으로 되돌아가면 프롬프트 주입 경로가 되기 때문입니다(`docs/master-prompt.md` §4-7).

## 2. schema — 손으로 쓴 계약 검증기

TypeScript 쪽은 Ajv 를 쓰지만 Rust 쪽에는 계약 검증기가 없었고, 이 PC 의 windows-gnu 툴체인에는 C 컴파일러가 없어 새 크레이트를 함부로 늘리지 않습니다. 그래서 **계약 스키마가 실제로 쓰는 키워드만** 다루는 작은 검증기를 두었습니다.

```rust
use classmate_transport::schema::{describe, validate, SchemaKind};

let event = serde_json::json!({ /* … */ });
if let Err(violations) = validate(SchemaKind::SessionEvent, &event) {
    eprintln!("{}", describe(&violations));   // "/payload/to · 꼭 있어야 하는 값이 없습니다"
}
```

### 다루는 키워드

| 키워드 | 다루는 범위 |
|---|---|
| `type` | 낱개(`"string"`)와 배열(`["integer", "null"]`) 둘 다. `1.0` 도 정수로 봅니다. 배열은 이름을 **전부** 훑어서 모르는 이름이 뒤에 숨어 있어도 잡습니다 |
| `properties` · `required` | 있는 것만 내려가서 보고, 없는 것은 그 자리를 가리켜 알립니다 |
| `additionalProperties` | **참/거짓만.** 스키마 형태로 주면 "지원하지 않음" 오류입니다 |
| `enum` · `const` | 값 그대로 비교합니다 |
| `minimum` · `maximum` | 숫자 비교 |
| `minLength` · `maxLength` | **글자(코드 포인트) 수**로 셉니다. 한글 한 글자는 UTF-8 로 3바이트라 바이트로 세면 어긋납니다 |
| `minItems` · `maxItems` | 배열 길이 |
| `items` | **스키마 낱개만.** 배열 형태(튜플)는 다루지 않습니다 |
| `pattern` | 계약에 실제로 있는 **두 가지만** 손으로 맞춰 봅니다 (아래) |
| `format` | `date-time` 하나만. RFC 3339 을 손으로 읽습니다(윤년·윤초·시간대 포함). 윤초는 **UTC 기준** 23:59:60 만 받습니다 — 시간대를 뺀 뒤에 보므로 `2016-12-31T18:59:60-05:00` 도 통과합니다(TypeScript 쪽 `ajv-formats` 와 같은 답입니다) |
| `$ref` | `#/definitions/…` · `common.schema.json#/definitions/…` · 조각 없는 파일 통째 |
| `allOf` · `if`/`then` | `session-event` 의 `state.changed` 갈래에 씁니다. `else` 는 다루지 않습니다 |
| `$schema` · `$id` · `title` · `description` · `definitions` · `x-labels-ko` | 설명·창고라서 검사에 쓰지 않습니다 |

손으로 맞춰 보는 정규식 둘:

```
^[0-9]{4}-[0-9]{2}-[0-9]{2}-p[1-9][0-9]*$   PeriodId    보기 2026-09-02-p3
^[0-9a-f]+$                                 dHash       보기 9f3c1a6d20b45e88
```

### 모르는 것은 조용히 통과시키지 않습니다

`Violation` 에는 `kind` 가 붙습니다.

- `ViolationKind::Value` — 값이 계약과 다릅니다. 보낸 쪽에 알려 주면 됩니다.
- `ViolationKind::UnsupportedSchema` — 스키마 쪽에 이 검증기가 모르는 것이 들어 있습니다. **검증기를 늘려야 합니다.**

계약이 자라 새 키워드·새 정규식·새 `format` 이 들어오면 값이 맞더라도 시험이 먼저 빨갛게 됩니다. 조용히 통과해서 "검사하고 있는 줄 알았는데 아니었다" 가 되는 것을 막으려는 것입니다.

## 3. 봉투 표 — 어떤 type 을 어떤 스키마로 볼까

`ENVELOPE_RULES` 는 `apps/native-host/src/router.rs` 의 `Router::handle` 이 실제로 나눠 주는 이름과 같습니다. 2라운드에서 튜터 갈래 둘이 붙어 **일곱**입니다. 한쪽만 늘어나면 `the_table_matches_the_router_in_router_rs` 시험이 `src/router.rs` 원문을 읽어 대조하다가 먼저 빨갛게 됩니다.

| `type` | `periodId` | `questionId` | 딸림 값 → 스키마 | 추가 검사 |
|---|---|---|---|---|
| `ping` | 필요 없음 | 필요 없음 | 없음 | 없음 |
| `event.append` | 필요 | 필요 없음 | `event` → `session-event` | 없음 |
| `session.status` | 필요 | 필요 없음 | 없음 | 없음 |
| `session.export` | 필요 | 필요 없음 | 없음 | 없음 |
| `frame.store` | 필요 | 필요 없음 | `frame` → `screen-frame` | `bytesBase64` · `path` |
| `tutor.ask` | 필요 | 필요 | 없음 | `provider` · `snapshot` · `question` |
| `tutor.retry` | 필요 | 필요 | 없음 | 없음 |

스키마 하나로 끝나지 않는 봉투 둘에는 `ExtraCheck` 가 붙습니다.

**`ExtraCheck::FrameBody`** — `frame.store` · 고정 계약 (가)

- `bytesBase64` 는 비어 있지 않은 문자열입니다. 본문을 실제로 푸는 것은 저장소 몫이라 여기서는 자리와 모양만 봅니다.
- `frame.path` 는 `frames/<frame.id>.webp` 여야 합니다. 어긋나면 `/frame/path` 를 가리킵니다. 파일 이름을 `id` 로 못 박아 두면 확장이 준 경로가 교시 폴더 밖을 가리킬 자리가 없어집니다.

**`ExtraCheck::AskSnapshot`** — `tutor.ask` · 고정 계약 (마)

- `provider` 는 `ASK_PROVIDERS`(`claude` · `codex`) 안의 이름입니다. 이 값으로 어떤 CLI 를 부를지 갈리므로 목록 밖의 값을 흘려보내지 않습니다.
- `snapshot` 은 `question.schema.json` 의 **`/properties/snapshot`**(QuestionSnapshot) 정의로 봅니다. 계약 파일 전체가 아니라 속성 하나만 봐야 하므로 `schema::validate_pointer(kind, pointer, value)` 를 씁니다. `#/definitions/…` 창고만 가리킬 수 있던 `validate_definition` 과 여기서 갈립니다.
- `question` 은 없어도 되지만, 있으면 **UTF-8 `QUESTION_MAX_BYTES`(4096) 바이트 이하**의 문자열입니다. 다른 길이 검사와 달리 글자 수가 아니라 바이트 수입니다 — 모델에 넘길 문맥의 크기를 재는 값이기 때문입니다. 한글만 쓰면 약 1,365자입니다.
- `kind` 와 `word` 는 보지 않습니다. 무엇을 어떻게 물었는지는 파이프라인(단위 6)이 봉인할 때 다시 봅니다.

`validate_envelope(&message)` 는 통과하면 걸린 규칙을, 어긋나면 봉투 기준 자리를 돌려줍니다(`/event/payload/to` 처럼 필드 이름이 앞에 붙습니다). 모르는 `type` 은 그 이름을 되뇌지 않고 아는 이름 목록만 알려 줍니다.

`periodId` 는 계약의 `PeriodId` 모양, `questionId` 는 계약의 `Id` 모양으로 봅니다. `../../etc/passwd` 같은 값이 저장 폴더 이름으로 내려가지 못하게 여기서 먼저 막습니다.

### 어긋난 자리 → 확장이 분기할 낱말

호스트는 어긋난 자리 목록을 그대로 확장에 주지 않고 `envelope_reason(&violations)` 으로 낱말 하나를 고릅니다. 보는 순서가 곧 우선순위입니다.

```
/question 이 어긋났나?      ─예─▶ question-too-long
       │아니오
/snapshot 아래가 어긋났나?  ─예─▶ malformed-snapshot
       │아니오
       └───────────────────────▶ envelope-invalid
```

세 낱말은 `REASON_QUESTION_TOO_LONG` · `REASON_MALFORMED_SNAPSHOT` · `REASON_ENVELOPE_INVALID` 상수로 내놓습니다. 사람이 읽을 자세한 문구는 `describe(&violations)` 이고, 둘 다 확장이 보낸 값을 담지 않습니다.

## 4. 무엇으로 검사했나

| 자료 | 개수 | 결과 |
|---|---|---|
| `packages/contracts/schemas/examples/*.json` | 14 | 전부 통과해야 합니다 |
| `packages/contracts/schemas/examples/invalid/*.json` | 3 | 전부 막히고, 어긋난 **자리까지** 기대와 같아야 합니다 |
| `fixtures/synthetic-class/golden-ioc/*.json` | 8 파일(배열 포함) | 전부 통과해야 합니다 |
| `fixtures/synthetic-class/golden-ioc/session-events.jsonl` | 27 줄 | 줄마다 `session-event` 로 통과해야 합니다 |

파일 → 스키마 대응은 `packages/contracts/test/fixtures.test.ts` 와 같게 맞추었습니다. 개수도 못 박아 두었으므로 계약에 예시가 늘면 시험이 먼저 알려 줍니다.

## 5. 스크립트 (`apps/native-host/scripts/`)

```bash
# ① 왕복 확인(e2e): 실행 파일을 띄워 ping 을 보내고 hello 를 받는다
node apps/native-host/scripts/host-roundtrip.mjs
node apps/native-host/scripts/host-roundtrip.mjs --exe <실행 파일 경로>

# ② Chrome 등록 계획 보기(아무것도 바꾸지 않는다)
node apps/native-host/scripts/register-host.mjs --extension-id <a~p 32자>
node apps/native-host/scripts/register-host.mjs --extension-id <a~p 32자> --remove

# ③ 두 스크립트의 단위 시험(레지스트리도 실행 파일도 건드리지 않는다)
node --test apps/native-host/scripts/*.test.mjs
```

`register-host.mjs` 는 dry-run 이 기본이고 **`--apply` 가 있을 때만** 매니페스트 파일을 쓰고 `reg` 를 실행합니다(Phase 1 에는 dry-run 인데도 파일을 썼습니다). 실행 파일이 아직 없으면 `--apply` 를 거절합니다 — 없는 경로를 적어 두면 Chrome 이 아무 말 없이 안 붙기 때문입니다. `host-roundtrip.mjs` 는 자식이 15초(`ROUNDTRIP_TIMEOUT_MS`) 안에 끝나지 않으면 멈춰 세우고 실패로 알립니다. 두 스크립트 모두 진입점 가드가 있어 `import` 만으로는 움직이지 않습니다. 자세한 사용법은 `apps/native-host/README.md` §4 에 있습니다.

## 6. 2라운드에 바뀐 것

1라운드에는 루트 크레이트의 `src/protocol.rs` 와 이 크레이트의 `src/framing.rs` 가 **같은 프레이밍을 두 벌** 들고 있었습니다(단위끼리 같은 파일을 고치지 않으려고 일부러 둔 복사본입니다). 2라운드에서 정리했습니다.

1. `src/protocol.rs` 를 지웠습니다. 프레이밍은 `classmate_transport::framing` 하나뿐이고 `apps/native-host/src/router.rs` 가 그것을 그대로 씁니다. 지운 파일의 시험은 전부 `framing.rs` 에 이미 같거나 더 넓은 모양으로 있어서 옮길 것이 없었습니다(0바이트 본문·상한 경계 1 MiB±1 까지 여기서 봅니다).
2. `Router::handle` 이 갈래를 나누기 **전에** `validate_envelope` 를 지납니다. 계약에 어긋난 메시지는 저장소를 열지도 파일을 만들지도 못합니다. 걸린 것은 `envelope-invalid` · `question-too-long` · `malformed-snapshot` 셋 중 하나로 답합니다. 봉투 표에 아예 없는 `type` 만 예전처럼 `unknown-message-type` 입니다.
3. 봉투 표가 다섯에서 **일곱**으로 늘었습니다(`tutor.ask` · `tutor.retry`). `include_str!` 대조 시험도 `src/main.rs` 가 아니라 `src/router.rs` 를 봅니다.
4. 루트 `Cargo.toml` 의 `classmate-transport` 의존성은 2라운드 선커밋에서 이미 들어갔습니다.
