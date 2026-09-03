# src/tutor — 질문 봉인 → 자료 조립 → 제공자 호출 → 기록 파이프라인

Phase 2 2라운드 단위 6(context-builder)입니다. 학생이 낱말이나 문장을 붙잡은 순간부터
답이 화면에 뜨거나 "잠시 멈췄어요" 로 자리를 잡을 때까지의 한 줄기를 맡습니다.

crate 는 `classmate-host`, 모듈 경로는 `classmate_host::tutor` 입니다.

---

## 1. 흐름

```
라우터 스레드                              파이프라인 스레드 (스레드 하나 · 한 번에 한 물음)
    │                                           │  SessionStore::open(data_dir, periodId)
    │ handle.ask(AskEnvelope)                   │  ← 라우터와 다른 두 번째 WAL 연결
    │   ├ periodId · provider 확인               │
    │   ├ snapshot → ContextSnapshot            │
    │   ├ askedAt = 지금(+09:00)   ← 봉인        │
    │   └ Question 계약 검사                     │
    │        (여기서 실패하면 라우터에 바로 오류) │
    ├──────────── mpsc ────────────────────────▶│
    │                                           ├─ ① question.asked   저장 + push
    │                                           │
    │                                           ├─ ② 자료 조립
    │                                           │     list_since(0, 10000)
    │                                           │     · 봉인된 segmentId 의 payload.segment.text (도착 순)
    │                                           │     · 봉인된 editorContextId 의 payload.context.excerpt
    │                                           │     · 봉인된 screenFrameId 의 screen.frame 만 장 수로
    │                                           │     (하나도 없어도 "자료 없음" 으로 진행)
    │                                           │
    │                                           ├─ ③ 제공자 호출
    │                                           │     AskRequest::new(snapshot, 본문, 45초)
    │                                           │     본문 = 역할·규칙·출력형식 + 자료 + 질문
    │                                           │     ★ 본문은 자식 프로세스 stdin 으로만 간다
    │                                           │
    │                                           ├─ ④ 답 검사
    │                                           │     앞뒤 코드펜스·공백 제거
    │                                           │     → JSON 5칸 {conclusion, evidence, chips, nowLine?, details?}
    │                                           │     → 호스트가 3칸(id·questionId·createdAt) + 2칸(provider·status)
    │                                           │     → validate(SchemaKind::Answer)
    │                                           │     ✗ 걸리면 같은 질문으로 1회 재요청, 또 걸리면 실패
    │                                           │
    │                                    성공 ──┴─▶ ⑤ answer.completed (또는 answer.recovered)
    │                                                  + 끊겨 있었으면 connector.status connected
    │                                    실패 ────▶ ⑥ answer.failed
    │                                                + answer.queued (질문마다 한 번)
    │                                                + connector.status off (붙어 있었으면)
    │                                                + 5·15·45초 뒤 자동 재시도 (최대 3회)
    │ handle.retry(questionId)                        자동 재시도를 다 쓰면 여기서만 다시 묻는다
    ├──────────── mpsc ────────────────────────▶│
    │ handle.shutdown()                          │
    └──────────── mpsc ────────────────────────▶ 스레드 종료 (걸린 물음 하나는 끝까지 기다린다)

                                                 ▲
    out: Sender<Value> ─────────────────────────┘
    {"type":"tutor.event","periodId":"…","event":{SessionEvent 다섯 칸}}
    {"type":"tutor.delta","periodId":"…","questionId":"…","seq":0,"chars":15,"text":"결론 조각"}
```

`out` 으로 나가는 것은 **이 파이프라인이 만든 것뿐입니다.** 확장이 보낸 사건은 되밀지 않습니다.

### 답이 만들어지는 동안 흐르는 조각 (`tutor.delta`)

2026-09-03 실측에서 학생은 질문 뒤 7~24초(중앙값 13초) 동안 화면에서 글자를 하나도 못
봤습니다. 제공자는 `--include-partial-messages` 로 조각을 이미 흘리고 있었는데,
파이프라인이 받는 자리를 빈 클로저로 두어 전부 버렸기 때문입니다.

| 칸 | 무엇 |
|---|---|
| `seq` | 이 회차에서 몇 번째 조각인지. `0` 은 "이 답을 처음부터 다시 그리세요" 입니다 |
| `chars` | 지금까지 받은 날 본문 글자 수. "생각하는 중" 자리의 진행도입니다 |
| `text` | 지금까지 해독한 **결론 전체**(증분이 아닙니다). 아직 없으면 칸 자체가 없습니다 |

- **`SessionEvent` 가 아닙니다.** 저장소에 붙지 않고 `packages/contracts` 와도 무관합니다.
  놓쳐도 뒤따르는 `answer.completed` 가 정본으로 덮습니다.
- **날 JSON 을 흘리지 않습니다.** 답은 JSON 한 덩어리라 조각은 `{"conclusion":"생성 …` 처럼
  생겼습니다. `src/tutor/delta.rs` 가 그 안에서 `conclusion` 값만 뽑아 해독합니다.
- 모아 보내기는 **40자 또는 120밀리초 가운데 먼저 닿는 쪽**입니다
  (`delta::FLUSH_CHARS` · `delta::FLUSH_INTERVAL`). 결론이 닫히는 순간은 기다리지 않고 바로 보냅니다.
- 결론이 닫힌 뒤에는 더 보내지 않습니다. `details` 본문이 화면으로 새는 자리가 없습니다.
- 이름표는 `classmate_transport::PUSH_TUTOR_DELTA` 하나입니다. 파이프라인이 이름을 직접
  적지 않는지는 transport 의 `the_tutor_pipeline_names_its_pushes_from_this_table` 이 봅니다.

---

## 2. 남기는 사건

저장소(`<data_dir>/<periodId>.sqlite`)와 `out` 에 **같은 것**이 들어갑니다.
사건 봉투는 계약의 다섯 칸(`id`·`periodId`·`at`·`type`·`payload`)입니다.

| 사건 | 언제 | payload |
|---|---|---|
| `question.asked` | `ask` 를 받자마자 | `{questionId, kind, word?, question}` · `question` 은 계약의 Question 본문(`id`·`periodId`·`askedAt`·`kind`·`text?`·`snapshot`) |
| `answer.completed` | 처음 물어 바로 답을 받았을 때 | `{questionId, answerId, evidence, provider, answer}` · `answer.status = "answered"` |
| `answer.failed` | 한 번의 물음이 실패할 때마다 | `{questionId, provider, message}` · `message` 는 고정 문구(아래 3절) |
| `answer.queued` | 그 질문이 **처음** 실패했을 때 한 번 | `{questionId, answerId: "<ans-id>-queued", evidence: "stale", answer}` · `answer.status = "queued"` |
| `answer.recovered` | 멈췄던 질문이 다시 물어 답을 받았을 때 | `{questionId, answerId, evidence: "partial", provider, answer}` · `answer.status = "recovered"` |
| `connector.status` | 제공자가 끊기거나 돌아올 때(상태가 바뀔 때만) | `{connector: "provider", state: "off"\|"connected", reason?}` |

읽기만 하는 사건은 둘입니다. 확장이 이미 저장소에 넣어 둔 것입니다.

| 사건 | 파이프라인이 보는 자리 | 없으면 |
|---|---|---|
| `transcript.segment` | `payload.segmentId` · `payload.segment.text` | 본문 없음으로 두고 진행 |
| `editor.context` | `payload.editorContextId` · `payload.context.{excerpt, filePath, visibleRange}` | 편집기 자료 없음으로 진행 |
| `screen.frame` | 봉인한 `screenFrameId` 와 같은 것만 장 수로 셉니다 | 0장 |

### 이름 짓기

| 무엇 | 모양 | 보기 |
|---|---|---|
| 사건 id | `ev-<periodId>-<여덟 자리 순번>` | `ev-2026-09-02-p3-00000012` |
| 답 id | `ans-<periodId>-<세 자리 순번>` · **질문마다 하나** | `ans-2026-09-02-p3-002` |
| 멈춘 답 id | 답 id + `-queued` | `ans-2026-09-02-p3-002-queued` |

사건 순번은 파이프라인이 열릴 때 저장소에 있던 기록 수에서 이어 셉니다. 같은 id 가 이미
있으면 다음 번호로 넘어가 다시 넣습니다(최대 8번). 저장이 끝내 실패해도 stderr 에 이유표만
남기고 파이프라인은 계속 돕니다 — 화면이 멈추는 것이 기록이 비는 것보다 나쁘기 때문입니다.

---

## 3. 시간과 고정 문구

| 이름 | 값 | 근거 |
|---|---|---|
| `DEFAULT_TIMEOUT` | 45초 | Gate C2 실측 TTFT p50 6.6~6.8초 · 총 소요 p95 10.8초(`docs/spikes/gate-c2-provider.md`). 자료를 붙이면 더 늘어나므로 판정선 10초의 네 배를 상한으로 둡니다 |
| `DEFAULT_RETRY_DELAYS` | 5초 · 15초 · 45초 | 뒤로 갈수록 벌립니다. 목록이 모자라면 마지막 값을 되풀이합니다 |
| `DEFAULT_MAX_AUTO_RETRIES` | 3 | 여기까지 쓰면 `retry()` 로만 다시 묻습니다 |
| `DEFAULT_MAX_MATERIAL_CHARS` | 2,000자 | 2026-09-03 실측에서 오늘 실제로 나간 자료 문단은 289~601자였습니다. 봉인 문단이 20개까지 늘어난 최악의 경우는 약 6,993자입니다. **오늘 쓰는 자료를 한 글자도 건드리지 않으면서** 최악의 경우를 3분의 1 아래로 묶는 자리입니다 |
| `delta::FLUSH_CHARS` | 40자 | 계약이 `conclusion` 을 40자 이내로 묶으므로, 결론 한 줄이 다 차기 전에 화면이 최소 한 번은 움직입니다 |
| `delta::FLUSH_INTERVAL` | 120밀리초 | 사람이 "끊겼다" 고 느끼기 전의 자리입니다. 더 촘촘하면 한 회차에 수백 건이 오갑니다 |
| 시각 표기 | `YYYY-MM-DDTHH:MM:SS+09:00` | 수업이 열린 자리의 시각. `src/tutor/clock.rs` 가 `SystemTime` 으로 직접 계산합니다(날짜 crate 를 들이지 않습니다) |

자료가 상한을 넘으면 **앞을 버리고 뒤를 남깁니다.** 학생이 묻는 것은 방금 들은 말이기
때문입니다. 버리는 순서는 ① 오래된 전사 줄 → ② 편집기 발췌의 앞부분이고, 요약 머리와
"뺐습니다" 표시는 언제나 남습니다(`materials::render_with_limit`).

멈춤 문구(고정):

```
튜터 답변이 잠시 멈췄어요. 수업 기록과 질문 지점은 계속 저장하고 있어요. 연결되면 설명을 완성해 둘게요.
```

멈춘 자리 답(고정): `conclusion` = `한 줄로 정리하고 있어요` · `chips` = `["더 쉽게", "지금 화면 코드"]` ·
`evidence` = `stale` (fixture `fixtures/synthetic-class/golden-ioc/answer-queued.json` 과 같은 모양).

---

## 4. 오케스트레이터가 읽는 환경 변수

파이프라인은 환경 변수를 **읽지 않습니다.** 읽는 것은 `src/router.rs` 의 `TutorSources::from_env`
하나이고, 파이프라인은 거기서 받은 값만 씁니다(`tests/no_real_cli_root.rs` 가 그 사실을 봅니다).

| 이름 | 무엇 | 없으면 |
|---|---|---|
| `CLASSMATE_CLAUDE_CLI` | 띄울 CLI 실행 파일의 **절대 경로** | `tutor.ask` 가 `provider-unavailable` 로 답하고 파이프라인을 띄우지 않습니다 |
| `CLASSMATE_TUTOR_MODEL` | CLI 에 `--model <값>` 으로 그대로 넘길 모델 이름 | CLI 기본값을 그대로 씁니다 |
| `CLASSMATE_TUTOR_SESSION` | `1` 이면 한 교시 동안 자식 프로세스 하나를 다시 씁니다 | 물음마다 새로 띄웁니다(지금까지와 같음) |

### 어디에 넣는가 — **매니페스트가 아닙니다**

Native Messaging 호스트 매니페스트(레지스트리 `HKCU\Software\Google\Chrome\NativeMessagingHosts\…`
가 가리키는 JSON)에는 환경 변수를 적는 칸이 없습니다. 그 JSON 이 가진 것은 `name`·`description`·
`path`·`type`·`allowed_origins` 뿐입니다. 넣는 자리는 **사용자 환경 변수**(`HKCU\Environment`)입니다.

```bash
# 지금 값 보기 (Git Bash)
reg query "HKCU\Environment" //v CLASSMATE_TUTOR_MODEL

# 값 넣기 · 지우기 (PowerShell)
setx CLASSMATE_TUTOR_MODEL "<CLI 가 받는 모델 이름>"
reg delete "HKCU\Environment" /v CLASSMATE_TUTOR_MODEL /f
```

```text
사용자 환경 변수(HKCU\Environment)
        │  프로세스는 뜰 때 부모의 환경을 물려받습니다
        ▼
   Chrome (뜰 때의 환경이 굳습니다)
        │
        ▼
   classmate-host  ──▶ TutorSources::from_env()
```

그래서 **값을 바꾼 뒤에는 Chrome 을 완전히 끄고 다시 켜야 합니다.** 이미 떠 있던 Chrome 과
그것이 띄운 호스트는 바꾸기 **전**의 환경을 그대로 들고 있습니다. 값이 잡혔는지 헷갈릴 때는
바꾼 뒤 새로 연 터미널에서 `reg query` 로 먼저 확인하세요.

값을 코드에 박지 않습니다. 이 저장소는 받은 문자열을 검사하지 않고 `--model` 인자 하나로만
넘기므로, **어떤 값을 받는지는 CLI 쪽 문서**가 정본입니다.

> 참고: `installer/windows/ask-once.mjs` 는 모델을 손으로 주지 않으면 이 변수를 **지우고** 부릅니다.
> 그 스크립트로는 지금 잡힌 값을 관측할 수 없습니다(이 저장소 밖의 자리라 여기서 고치지 않았습니다).

`CLASSMATE_TUTOR_SESSION` 을 켜는 값은 **`1` 하나뿐입니다.** `true`·`yes` 는 켜지지 않습니다.
확인되지 않은 길이라(`crates/providers/src/session.rs` 머리말) 켜려는 뜻이 분명할 때만 켜기
위해서입니다.

---

## 5. 라우터가 부르는 자리 (통합 지점)

```rust
use std::path::PathBuf;
use std::sync::mpsc;

use classmate_providers::ClaudeCliProvider;
use classmate_host::tutor::{AskEnvelope, TutorConfig, TutorPipeline, retry_question_id};

// ① 오케스트레이터가 CLI 경로와 모델을 정합니다. 파이프라인은 env 를 읽지 않습니다.
//    (CLASSMATE_CLAUDE_CLI · CLASSMATE_CODEX_CLI · CLASSMATE_TUTOR_MODEL)
let provider = Box::new(ClaudeCliProvider::new(PathBuf::from(cli_path)));

// ② out 은 확장으로 자발 push 를 보내는 통로입니다.
let (out, outbox) = mpsc::channel();

let handle = TutorPipeline::start(
    data_dir,            // <data_dir>/<periodId>.sqlite 를 스레드 안에서 엽니다
    "2026-09-02-p3",     // 교시 하나에 파이프라인 하나
    provider,
    out,
    TutorConfig { model, ..TutorConfig::default() },
);

// ③ tutor.ask 갈래
let envelope = AskEnvelope::from_ask_message(&message)?;   // Value → AskEnvelope 도우미
handle.ask(envelope)?;                                     // Err 면 error 응답의 reason 에 err.reason()

// ④ tutor.retry 갈래
let question_id = retry_question_id(&message)?;
handle.retry(&question_id)?;

// ⑤ 교시가 끝나면
handle.shutdown();
```

`outbox` 에서 꺼낸 값은 그대로 내보낼 수 있는 메시지라 프레이밍만 씌우면 됩니다. 종류는 둘이고
이름표는 `classmate_transport::PUSH_KINDS` 에 있습니다 — 저장까지 끝난 사건 `tutor.event` 와
답이 만들어지는 동안 흐르는 조각 `tutor.delta` 입니다(1절).

### 되돌아오는 오류

| `TutorError` | `reason()` | 언제 |
|---|---|---|
| `ProviderUnavailable` | `provider-unavailable` | 봉투의 `provider` 가 이 파이프라인의 제공자와 다를 때 |
| `MalformedSnapshot(_)` | `malformed-snapshot` | 봉투에 칸이 빠졌거나 Question 계약 검사에 걸릴 때 |
| `UnknownQuestion` | `unknown-question` | `retry` 가 이 파이프라인이 모르는 질문 id 일 때 · **이미 답이 붙어 다시 물을 것이 없는 질문**일 때(답이 붙으면 손잡이의 집합에서 빠집니다 · 낱말은 늘리지 않습니다) |
| `Stopped` | `stopped` | 파이프라인 스레드가 이미 끝났을 때 |

`ask` 와 `retry` 는 **부르는 쪽 스레드에서 곧바로** 판정합니다. 앞선 물음이 45초를 쓰고 있어도
오류 응답은 기다리지 않습니다.

---

## 6. 지키는 경계 (`AGENTS.md` §2)

- **§4-7 · 명령 실행 금지** — 학생 질문과 전사 본문은 `AskRequest` 의 본문으로만 흐르고, 그것은
  제공자가 자식 프로세스의 **stdin** 으로만 씁니다. 이 모듈에 명령 인자를 만드는 자리가 없습니다.
  `tests/no_real_cli_root.rs` 가 그 사실을 파일 검사로 못 박습니다.
- **§4-7 · 모델 출력 직접 실행 금지** — 모델이 낸 것은 JSON 으로 읽어 계약으로 검사한 뒤에만
  기록이 됩니다. `id`·`status` 같은 신원 칸은 모델이 무엇을 적었든 호스트 값으로 덮어씁니다.
- **§4-5 · 최근 자료만** — 프롬프트에 들어가는 것은 봉인한 식별자에 해당하는 본문뿐입니다.
  화면 그림은 장 수만 알리고 바이트를 보내지 않습니다.
- **§4-2 · 자격증명 금지** — 이 모듈에 토큰 칸이 없고, 제공자 CLI 경로도 스스로 찾지 않습니다.
- **§4-3 · 로그에 본문 금지** — stderr 로 나가는 것은 고정된 이유표(`provider-timeout` ·
  `answer-invalid` 등)뿐입니다.

---

## 7. 파일

| 경로 | 내용 |
|---|---|
| `mod.rs` | 공개 API(`TutorConfig`·`AskEnvelope`·`TutorError`·`TutorPipeline`·`TutorHandle`)와 스레드 본체 |
| `clock.rs` | 한국 시간(`+09:00`) 표기 · 시험용 고정 시계(`FixedClock`) |
| `delta.rs` | 제공자 조각에서 `conclusion` 만 뽑아 모아 보내기(`tutor.delta` 의 속) |
| `materials.rs` | 봉인한 식별자로 저장소에서 본문을 되찾아 자료 문단 만들기 · 길이 상한 |
| `prompt.rs` | 역할·규칙·출력 형식 + 자료 + 질문을 한 본문으로 |
| `answer.rs` | 코드펜스 제거 → JSON → 호스트 칸 채우기 → 계약 검사 · 멈춘 자리 답 |
| `events.rs` | 사건 id · 답 id · 고정 문구 |

## 8. 시험

```bash
export PATH="$HOME/.cargo/bin:$PATH"

# 단위 + 통합 전부
cargo test -p classmate-host --manifest-path apps/native-host/Cargo.toml

# 파이프라인 통합만 (가짜 CLI 를 실제 자식 프로세스로 띄웁니다)
cargo test -p classmate-host --manifest-path apps/native-host/Cargo.toml --test tutor_pipeline

# 비용 안전 가드만
cargo test -p classmate-host --manifest-path apps/native-host/Cargo.toml --test no_real_cli_root
```

`tests/tutor_pipeline.rs` 가 띄우는 것은 `node` 와 `tests/fake-tutor-cli.mjs` 뿐입니다.
**실제 튜터 CLI 는 어떤 시험에서도 실행되지 않습니다.**
