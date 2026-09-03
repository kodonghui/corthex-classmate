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
```

`out` 으로 나가는 것은 **이 파이프라인이 만든 사건뿐입니다.** 확장이 보낸 사건은 되밀지 않습니다.

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
| 시각 표기 | `YYYY-MM-DDTHH:MM:SS+09:00` | 수업이 열린 자리의 시각. `src/tutor/clock.rs` 가 `SystemTime` 으로 직접 계산합니다(날짜 crate 를 들이지 않습니다) |

멈춤 문구(고정):

```
튜터 답변이 잠시 멈췄어요. 수업 기록과 질문 지점은 계속 저장하고 있어요. 연결되면 설명을 완성해 둘게요.
```

멈춘 자리 답(고정): `conclusion` = `한 줄로 정리하고 있어요` · `chips` = `["더 쉽게", "지금 화면 코드"]` ·
`evidence` = `stale` (fixture `fixtures/synthetic-class/golden-ioc/answer-queued.json` 과 같은 모양).

---

## 4. 라우터가 부르는 자리 (통합 지점)

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

`outbox` 에서 꺼낸 값은 그대로 `{"type":"tutor.event", …}` 메시지라 프레이밍만 씌워 내보내면 됩니다.

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

## 5. 지키는 경계 (`AGENTS.md` §2)

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

## 6. 파일

| 경로 | 내용 |
|---|---|
| `mod.rs` | 공개 API(`TutorConfig`·`AskEnvelope`·`TutorError`·`TutorPipeline`·`TutorHandle`)와 스레드 본체 |
| `clock.rs` | 한국 시간(`+09:00`) 표기 · 시험용 고정 시계(`FixedClock`) |
| `materials.rs` | 봉인한 식별자로 저장소에서 본문을 되찾아 자료 문단 만들기 |
| `prompt.rs` | 역할·규칙·출력 형식 + 자료 + 질문을 한 본문으로 |
| `answer.rs` | 코드펜스 제거 → JSON → 호스트 칸 채우기 → 계약 검사 · 멈춘 자리 답 |
| `events.rs` | 사건 id · 답 id · 고정 문구 |

## 7. 시험

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
