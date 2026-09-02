# classmate-providers

튜터 제공자 어댑터입니다. `TutorProvider` trait 하나 뒤에 두 제공자를 붙입니다. **Claude CLI 제공자**는 호출자가 준 실행 파일 경로를 `-p --output-format stream-json --verbose` 로 띄우고, 질문과 문맥은 명령행이 아니라 **stdin** 으로만 흘려보낸 뒤 stdout 을 줄 단위 stream-json 으로 읽어 `Status → TextDelta… → Usage` 순서의 이벤트로 바꿉니다. 제한 시간을 넘기면 `taskkill /PID <pid> /T /F` 로 프로세스를 **트리째** 끊고 `Timeout` 을 돌려줍니다. **Codex 제공자**는 사용 한도 소진으로 실측을 못 해 지금은 `NotImplemented` 스텁이고, app-server stdio 프로토콜 메모와 실측 후 채울 칸만 `src/codex.rs` 주석에 적어 두었습니다. 앞단의 `ProviderQueue` 는 작업 스레드 하나로 **한 번에 한 건만** CLI 를 띄우고 대기 줄 상한(기본 4)을 넘으면 곧바로 거절합니다. 자격증명은 어디에도 저장·전송하지 않고(불변 원칙 §4-2) 로그인은 각 CLI 가 스스로 한 것을 그대로 씁니다. 시험은 실제 CLI 를 **0회** 부르고 언제나 `node tests/fake-claude.mjs` 만 띄웁니다. 검증은 `cargo test -p classmate-providers --manifest-path apps/native-host/Cargo.toml` 입니다(41개 통과).

## 1. 무엇이 어디에 있나

| 파일 | 맡는 일 |
|---|---|
| `src/provider.rs` | `TutorProvider` trait · `AskRequest` · `ContextSnapshot` · `ProviderEvent` · `AskOutcome` · `ProviderError` |
| `src/stream_json.rs` | `claude --output-format stream-json` 의 줄 → 이벤트 (`spikes/lib/stream-json.mjs` 이식) |
| `src/claude.rs` | 자식 프로세스 구동 · `.cmd` 래퍼 해석 · 타임아웃 · 트리 종료 · stderr 꼬리 |
| `src/queue.rs` | FIFO 큐 (동시 1건 · 상한 4 · `shutdown`) |
| `src/codex.rs` | Codex 스텁 + app-server 프로토콜 메모 |
| `tests/fake-claude.mjs` | 시험이 띄우는 **가짜** CLI (진입점 가드 있음) |
| `tests/claude_fake_cli.rs` · `tests/queue_e2e.rs` · `tests/no_real_cli.rs` | 통합 시험 · e2e · 비용 안전 시험 |

## 2. 흐름

```
상위 단위
  │  submit(AskRequest)
  ▼
ProviderQueue ── 대기 줄(상한 4) ── 작업 스레드 1개
                                      │  ask(&req, &mut on_event)
                                      ▼
                              ClaudeCliProvider
                                      │  spawn (셸 없음)
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
   stdin 쓰기 스레드            stdout 읽기 스레드            stderr 읽기 스레드
   프롬프트 전체를 넣고 닫음     한 줄씩 mpsc 로 보냄          마지막 2,000자만 보관
                                      │
                                      ▼
                             StreamJsonParser
                                      │
                    Status("init") → TextDelta… → Usage{…}
                                      │
                                      ▼
                                 AskOutcome
```

본 스레드는 `mpsc::Receiver::recv_timeout` 하나로 마감 시각을 지킵니다. 자식이 한 줄도 내놓지 않아도 마감이 오면 깨어납니다.

## 3. Claude CLI 인자표

| 자리 | 값 | 왜 |
|---|---|---|
| 실행 파일 | **호출자가 준 경로** | 기본값·PATH 탐색이 없습니다(아래 §6) |
| 앞 인자 | `with_prefix_args` 로 받은 것 | 런타임을 앞세울 때(`node <진입점>`)와 시험이 가짜 CLI 를 넣을 때 |
| 고정 인자 | `-p` `--output-format` `stream-json` `--verbose` | Gate C2 측정 스크립트와 같은 조합 |
| 모델 | `--model <이름>` (지정했을 때만) | `AskRequest::model` 기본값은 `None` = CLI 기본값 그대로 |
| 질문·문맥 | **인자에 없음. stdin 으로만** | §4-7 — 사람이 만든 문자열에 셸 해석 지점을 만들지 않습니다 |

`AskRequest::prompt()` 가 만드는 stdin 본문은 (1) 주입 방어 두 줄, (2) 봉인한 자료 요약(조각 수·화면/편집기 유무·자료 나이), (3) 질문, (4) 답변 형식 요청 순서입니다.

> **spike 와 다른 점 하나.** `spikes/provider-claude.mjs` 의 기본 모드는 25자 고정 질문을 argv 로 넘깁니다(상수라서 외부 입력이 아닙니다). 이 크레이트는 그 경로를 옮기지 않고 `--fixture` 쪽(stdin)만 옮겼습니다. Gate C2 의 "남은 위험 · argv 주입 경계"가 **Phase 2 에서는 질문 문자열을 argv 로 넘기지 말 것**을 명시하기 때문입니다.

## 4. `.cmd` 래퍼 해석

npm 이 설치한 CLI 는 `.cmd` 배치 래퍼입니다. `cmd.exe /c <래퍼>` 로 띄우면 실제 CLI 가 **손자**가 되어, 타임아웃에 부모만 죽고 손자는 살아남습니다(과금이 이어지고 stdout 파이프가 닫히지 않아 회차가 끝나지 않습니다 — Gate C2 실측 결함). 그래서 래퍼 파일을 **읽어서** 진짜 진입점을 뽑아 직접 띄웁니다.

| 입력 | 결과 | 비고 |
|---|---|---|
| `%dp0%` 표식 + 실재하는 `.js` | `node` + 그 `.js` | node 는 셈 옆 → PATH 순서로 찾습니다(런타임만, 튜터 CLI 아님) |
| `%dp0%` 표식 + 실재하는 `.exe` | 그 `.exe` 를 직접 | `node.exe` 는 대상에서 뺍니다 |
| `%dp0%` 표식이 없는 손수 쓴 배치 | 해석하지 않음 → `cmd.exe /c` 폴백 | 모르는 배치를 뜯지 않습니다 |
| 표식은 있으나 가리키는 파일이 없음 | 해석하지 않음 | 있다고 속이지 않습니다 |
| `.cmd`/`.bat` 이 아닌 경로 | 그대로 실행 | |

`resolve_cmd_wrapper()` 는 파일을 **읽기만 합니다.** 아무것도 실행하지 않습니다. 폴백을 탔는지는 `LaunchPlan::through_cmd_wrapper` 로 알 수 있습니다.

## 5. 타임아웃과 종료

```
t=0 ─────────────── req.timeout ────────────────▶ 마감
                                                  │
                                                  ├─ 우리 쪽 파이프를 쥔 스레드는 그대로 두고
                                                  ├─ taskkill /PID <pid> /T /F  (트리째)
                                                  ├─ 실패하면 child.kill()      (최소한 자식은)
                                                  └─ 최대 250ms 유예 뒤 Err(Timeout)
```

| 상황 | 돌려주는 것 |
|---|---|
| 마감까지 스트림이 끝나지 않음 | `Timeout` (자식 트리 종료) |
| 실행 파일을 띄우지 못함 | `Spawn(io::Error)` |
| `{` 로 시작하는데 JSON 이 아닌 줄 | `Protocol` (본문은 담지 않고 길이·위치만) |
| `result` 줄 없이 스트림 종료 | `Protocol("result 이벤트 없이 …")` |
| `result.subtype` 이 `success` 가 아님 | `Protocol("… subtype=…")` |
| 종료 코드가 0 이 아님 | `NonZeroExit { code, stderr_tail }` — stderr **마지막 200자** |
| 큐 상한 초과 | `Queue("full")` |
| 큐가 이미 닫힘 | `Queue("shutdown")` |

JSON 이 아닌 배너 줄(`{` 로 시작하지 않는 줄)은 실패가 아니라 무시하고 개수만 셉니다(`StreamJsonParser::non_json_lines`).

## 6. 비용 안전 규칙 — 실제 CLI 를 부르는 자리와 시험의 분리

Gate C2 에서 **검증 스크립트가 모듈을 `import` 했다는 이유만으로 실제 `claude` 5회가 실행되어 승인 없이 1.251323 USD 가 나간 사고**가 있었습니다. 이 크레이트는 같은 사고가 구조적으로 일어나지 못하게 네 겹으로 막습니다.

1. **생성자가 경로를 요구합니다.** `ClaudeCliProvider::new(cli_path)` · `CodexAppServerProvider::new(cli_path)` 둘 다 경로가 필수 인자이고, 기본값도 PATH 탐색도 없습니다. 경로를 모르는 코드는 제공자를 만들 수 없습니다.
2. **실행 파일 이름 리터럴이 없습니다.** `src/**` · `tests/**` 어디에도 `claude`·`codex` 를 이름으로 띄우는 자리가 없고, `tests/no_real_cli.rs` 가 매 시험마다 그 사실을 확인합니다(찾는 낱말은 이 파일이 스스로 걸리지 않게 실행 시점에 이어 붙여 만듭니다).
3. **시험은 가짜 CLI 만 띄웁니다.** `tests/support/mod.rs` 가 PATH 에서 찾는 것은 **node 런타임**뿐이고, 스크립트는 언제나 이 크레이트 안의 `tests/fake-claude.mjs` 입니다.
4. **가짜 CLI 에 진입점 가드가 있습니다.** `import.meta.url === pathToFileURL(process.argv[1]).href` 일 때만 돕니다. 사고를 낸 그 결함을 그대로 막는 장치입니다.

`.cmd` 해석 시험은 임시 폴더에 가짜 `.cmd`·가짜 `node.exe`·가짜 진입점 파일을 만들어 씁니다. 존재 여부만 보는 함수라 실행되지 않습니다.

**이 크레이트를 실제 CLI 에 붙이는 것은 상위 단위의 몫이고, 비용이 드는 첫 실행은 사람 승인 뒤에만 합니다**(Gate C2 "사람이 할 일" 1·5번).

## 7. 큐

| 성질 | 값 |
|---|---|
| 동시 실행 | 1건 (작업 스레드 하나) |
| 순서 | FIFO — 넣은 순서대로 실행하고 그 순서로 끝납니다 |
| 대기 줄 상한 | 기본 4 (`ProviderQueue::with_capacity` 로 바꿉니다. 0 은 1 로 올립니다) |
| 넘쳤을 때 | 막지 않고 곧바로 `Err(Queue("full"))` 이 담긴 `Receiver` 를 돌려줍니다 |
| 실패한 작업 | 다음 작업을 막지 않습니다(타임아웃·비정상 종료 모두) |
| 진행 조각 | `submit_with_events(req, sink)` 로 받습니다. `submit` 은 버립니다 |
| 접기 | `shutdown()` — 남은 작업을 끝내고 작업 스레드를 join 합니다. `Drop` 도 같은 일을 합니다 |

## 8. Codex — 프로토콜 메모와 실측 후 채울 칸

Gate C2 시점에 사용 한도가 소진되어 **지연·비용은 미측정**입니다. 되는 척하지 않으려고 `ask()` 는 언제나 `NotImplemented` 를 돌려주고 자식 프로세스를 띄우지 않습니다. 최소 흐름은 `thread/start` → `turn/start` → `item/agentMessage/delta` → `turn/completed` 이고, 승인 요청 메소드 세 가지(`item/commandExecution/requestApproval` · `item/fileChange/requestApproval` · `item/permissions/requestApproval`)는 수업 모드에서 전부 거절로 고정합니다(§4-6 읽기 전용). 채울 칸(TTFT·총 소요·회차당 비용·`turn/start` 파라미터 이름·델타 필드 이름·`turn/interrupt` 응답 모양·로그인 만료 오류 모양)의 표는 `src/codex.rs` 맨 위 주석에 있고, 채우는 순서는 `docs/spikes/gate-c2-provider.md` 의 "사람이 할 일" 2·3번입니다.

## 9. 계약과 맞닿은 자리

`ContextSnapshot` 은 `packages/contracts/schemas/question.schema.json` 의 `snapshot` 칸 이름을 그대로 씁니다(`transcriptSegmentIds` · `screenFrameId` · `editorContextId` · `ages`). `SourceAges` 는 `common.schema.json#/definitions/SourceAges` 와 같습니다. `TutorProvider::name()` 이 돌려주는 `claude` · `codex` 는 `answer.schema.json` 의 `provider` enum 값과 같은 낱말입니다.

계약의 스냅샷은 **식별자만** 담고 전사·편집기 발췌의 본문은 담지 않습니다. 그래서 지금 프롬프트에는 자료의 "요약"(조각 수·유무·나이)만 들어가고 본문은 들어가지 않습니다. 본문까지 넣으려면 계약을 늘리거나 상위 단위가 조립한 문자열을 받아야 하는데, 계약은 이 라운드에서 고정이므로 **제안만** 남기고 여기서는 바꾸지 않았습니다.

## 10. 검증

```bash
cd apps/native-host
cargo test -p classmate-providers                       # 41개 통과
cargo clippy -p classmate-providers --all-targets -- -D warnings
cargo fmt -p classmate-providers -- --check
```

시험은 Node 런타임을 씁니다(가짜 CLI 를 띄우는 용도). PATH 에 `node` 가 없으면 통합 시험이 그 사실을 말하며 멈춥니다.
