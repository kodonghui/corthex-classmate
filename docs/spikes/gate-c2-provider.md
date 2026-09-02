# Gate C2 — 두뇌 어댑터 (TutorProvider)

> 2026-09-02 실측 반영. 형식: 판정 → 측정값 → 재현 명령 → 결정에 미치는 영향 → 사람이 할 일 → 남은 위험.
> 공통 인터페이스: `TutorProvider { ask(context, question) → stream }`. 인증은 각 CLI 의 사용자 로그인을 그대로 쓰고
> 앱은 자격 증명·토큰을 저장·전송하지 않는다(§4-2). 측정 스크립트는 질문·답변 본문을 콘솔에도 출력 파일에도 남기지 않고
> 길이만 남긴다(§4-3).

## 판정

판정: PASS (부분 — **골든 컨텍스트 미포함 · 25자 단문 기준** Claude 실측 PASS, 게이트 정의대로의 골든 컨텍스트 재측정은 BLOCKED(비용 승인 대기), Codex 실측 BLOCKED, §사람이 할 일 참조)

| 항목 | 판정 | 근거 |
|---|---|---|
| Claude · 25자 단문 (argv) | **PASS** | 표본 2세트 · 10회 전부 exit 0 · TTFT p50 6,614ms / 6,787ms → 합격 기준 상한 10,000ms 이내 (단, 2세트의 TTFT p95 는 8,511ms, 총 소요 p95 는 **10,769ms 로 10초를 넘겼다**) |
| Claude · 골든 시나리오 컨텍스트 (stdin, 2,893바이트) | **BLOCKED** | 프롬프트 조립·stdin 전달 경로는 무료로 검증했으나 실제 호출은 비용이 들어 승인 대기. 지연·비용 **미측정** |
| Codex (`codex app-server`, stdio) | **BLOCKED** | 사용 한도 소진. 프로토콜 형태(188 메소드 · 307 타입)는 네트워크 호출 없이 확인 완료, 지연은 미측정 |

**측정 조건이 게이트 정의보다 좁다는 점을 먼저 밝힌다.** `docs/master-prompt.md` §6 Gate C2 는
"골든 시나리오 컨텍스트를 넣고 첫 토큰·완료 시간을 측정"이라고 정의한다. 2026-09-02 실측은 그 컨텍스트를
넣지 않고 고정 **25자 단문**(`IoC 가 무엇인지 한 문장으로 답해 주세요.`) 하나로만 했다.
골든 컨텍스트(전사 9문단 + 편집기 발췌 + `OrderService.java` + 질문 = 조립 후 2,006자 / 2,893바이트)를 붙이면
입력 토큰이 늘어 **TTFT 와 비용이 모두 올라가는 방향**이므로, 아래 PASS 는 게이트 조건보다 유리한 쪽으로 편향돼 있다.
6,614ms 대 10,000ms 의 3.4초 여유가 골든 컨텍스트에서도 남는지는 **확인되지 않았다**(사람이 할 일 1번).
게다가 그 여유는 p50 기준이다. 2세트에서 TTFT p95 가 8,511ms 까지 올라 실제 여유는 1.5초로 좁아졌다.

**합격 기준** — `docs/master-prompt.md` §3-6 "첫 결론 표시 = 질문 후 5~10초"를 그대로 쓴다.
측정 대상은 TTFT(자식 프로세스 spawn → 첫 `assistant` 텍스트 이벤트 도착). 상한 10,000ms 를 판정선으로,
5,000ms 를 목표선으로 둔다. 5회 표본이므로 p95 는 최댓값과 같다(최근접 순위법).

| 기준선 | 값 | 실측 1세트 (25자 단문) | 실측 2세트 (25자 단문) | 실측 (골든 컨텍스트) | 결과 |
|---|---|---|---|---|---|
| 판정선 (§3-6 상한) | TTFT p50 ≤ 10,000ms | 6,614ms | 6,787ms | **미측정** | 단문 기준 통과 · 게이트 조건 미확인 |
| 목표선 (§3-6 하한) | TTFT p50 ≤ 5,000ms | 6,614ms | 6,787ms | **미측정** | 두 세트 모두 미달 — 아래 "결정에 미치는 영향" 참조 |
| (참고) 총 소요 p95 | — | 9,522ms | **10,769ms** | **미측정** | 2세트에서 총 소요가 10초를 넘었다. 판정선은 TTFT 기준이라 판정은 그대로지만 꼬리 지연 위험이 실측으로 드러났다 |

## 측정값

측정은 모두 로컬 Windows · Git Bash · `claude` 2.1.252, `codex-cli` 0.152.0, Node v24.15.0.
비용이 드는 Claude 실측은 두 세트다: 1세트 2026-09-02 17:07~17:10 KST(UTC+9), 2세트 같은 날 17:32 KST.
비용이 들지 않는 조립·배관·테스트 검증은 17:23~17:27 KST 와 17:36 KST 에 했다. 시각은 각 행에 따로 적는다.

> **2세트는 계획된 측정이 아니다.** 검증 단계에서 `buildFixturePrompt` 를 확인하려고 모듈을 `import` 했는데,
> 당시 `provider-claude.mjs` 가 최상위에서 `main()` 을 조건 없이 실행해 실제 `claude` 5회가 돌았다
> (승인 없이 1.251323 USD 지출 · 산출물 `spikes/out/provider-claude-short-2026-09-02T08-32-20-767Z.json`).
> 결함은 진입점 가드로 고쳤다(아래 "진입점 가드" 행). 이미 지출된 실측이므로 데이터는 버리지 않고 2세트로 기록한다.

### Claude 1세트 — 회차별 (5회 · **골든 컨텍스트 미포함** · 고정 짧은 질문 25자를 argv 로 · `--model` 미지정)

| 항목 | 값 | 측정 방법 | 시각 |
|---|---|---|---|
| 1회차 TTFT / 총 / result.duration_ms / duration_api_ms / num_turns / total_cost_usd / 답변 길이 | 7,064ms / 9,522ms / 4,611ms / 3,487ms / 1 / 0.506307 USD / 90자 | `node spikes/provider-claude.mjs --runs 5` | 2026-09-02 17:09 KST |
| 2회차 | 6,263ms / 8,830ms / 4,585ms / 4,132ms / 1 / 0.236577 USD / 92자 | 같음 | 같음 |
| 3회차 | 6,334ms / 8,354ms / 4,231ms / 3,600ms / 1 / 0.236653 USD / 92자 | 같음 | 같음 |
| 4회차 | 6,614ms / 8,740ms / 4,572ms / 3,928ms / 1 / 0.251082 USD / 101자 | 같음 | 같음 |
| 5회차 | 7,008ms / 9,261ms / 4,982ms / 4,088ms / 1 / 0.237397 USD / 115자 | 같음 | 같음 |

### Claude 1세트 — 요약

| 항목 | 값 | 측정 방법 | 시각 |
|---|---|---|---|
| 성공 회차 | 5 / 5 (exit 0 · `result.subtype = "success"` · `is_error = false`) | 위 명령의 표 출력 | 2026-09-02 17:09 KST |
| TTFT p50 / p95 / 최소 / 최대 | 6,614 / 7,064 / 6,263 / 7,064 ms | `percentile()` (최근접 순위법) | 같음 |
| 총 소요 p50 / p95 | 8,830 / 9,522 ms | 같음 | 같음 |
| result.duration_ms 범위 | 4,231 ~ 4,982 ms | stream-json `result` 이벤트 | 같음 |
| CLI 부대비용 (총 − result.duration_ms) | 4,123 ~ 4,911 ms (중앙값 4,245ms) | 위 두 값의 차 | 같음 |
| 회차당 비용 | 0.236577 ~ 0.506307 USD (합계 1.468017 USD) | `result.total_cost_usd` 합 | 같음 |
| stream-json 이벤트 수 / 비JSON 줄 수 | 회차마다 5개 / 0줄 | `StreamJsonParser.summary()` | 같음 |
| 중첩 실행 차단 (`CLAUDECODE`) | **발생하지 않음** — `CLAUDECODE=1`, `CLAUDE_CODE_ENTRYPOINT=claude-desktop` 이 설정된 Claude Code 세션 안에서 그대로 실행됨. `env -u` 재시도 경로는 쓰이지 않았다(`stripNestingEnv=false`) | 스크립트가 첫 회차 실패 시에만 재시도하도록 되어 있고 실패가 없었음 | 같음 |
| 성공 회차의 stderr 본문 | **1세트는 미보존** — 5회 모두 `stderrLength = 300`, `stderrHead = ""`. 당시 판본이 `exit 0` 이면 stderr 를 버렸다. **2세트에서 배너 본문이 확인됐다**(아래 2세트 표) | 산출물 `spikes/out/provider-claude-2026-09-02T08-09-47-247Z.json` 의 `runs[].stderrHead` | 같음 |
| 사용된 모델 이름 | **1세트는 미측정** — 당시 실행본이 `system/init` 의 `model` 을 요약에 담지 않았다. **2세트에서 `claude-opus-5[1m]` 으로 확인됐다** | 아래 2세트 표 | — |
| `--include-partial-messages` 를 쓴 진짜 첫 토큰 시각 | **미측정** — 이번 측정은 완성된 `assistant` 메시지 단위이므로 TTFT 는 "첫 문장 도착"이 아니라 "답변 전체 도착"에 가깝다 | — | — |

### Claude 2세트 — 5회 (같은 25자 단문 · argv · `--model` 미지정 · 계획 외 실행)

산출물 `spikes/out/provider-claude-short-2026-09-02T08-32-20-767Z.json`. 1세트와 조건이 같고 판본만 다르다
(모델 이름·stderr 보존이 이 판본부터 기록된다).

| 항목 | 값 | 측정 방법 | 시각 |
|---|---|---|---|
| 성공 회차 | 5 / 5 (exit 0 · `subtype = "success"`) | 산출물 `stats.successCount` | 2026-09-02 17:32 KST |
| 회차별 TTFT | 7,388 / 6,644 / 8,511 / 6,787 / 6,437 ms | 산출물 `runs[].ttftMs` | 같음 |
| 회차별 총 소요 | 9,993 / 9,397 / 10,769 / 9,322 / 8,641 ms | 산출물 `runs[].totalMs` | 같음 |
| TTFT p50 / p95 / 최소 / 최대 | 6,787 / 8,511 / 6,437 / 8,511 ms | 산출물 `stats` | 같음 |
| 총 소요 p50 / p95 | 9,397 / **10,769** ms — 3회차 한 번이 10초를 넘겼다 | 같음 | 같음 |
| `result.duration_ms` 범위 | 4,611 ~ 5,143 ms | 산출물 `runs[].summary.result.durationMs` | 같음 |
| 회차당 비용 | 0.241658 ~ 0.256193 USD (합계 **1.251323 USD**) | 산출물 `stats.totalCostUsdSum` | 같음 |
| **사용된 모델 이름** | **`claude-opus-5[1m]`** (5회 모두 동일) | 산출물 `models` · `runs[].model` | 같음 |
| **성공 회차의 stderr 본문** | 보존됨 — 5회 모두 300자. 내용은 워크스페이스 신뢰 경고다: `.claude/settings.json` 의 permissions.allow 항목을 무시한다는 안내. **중첩 실행 차단과 무관**하므로 "중첩 실행 차단 미발생" 결론이 exit code·`result` 이벤트뿐 아니라 배너 본문으로도 뒷받침된다 | 산출물 `runs[].stderrHead` | 같음 |
| 중첩 실행 차단 | 발생하지 않음 (`stripNestingEnv = false`) | 산출물 최상위 필드 | 같음 |

### Claude — 골든 시나리오 컨텍스트 (게이트 정의 조건 · 지연은 미측정)

`fixtures/synthetic-class/golden-ioc/` 의 `transcript.json` · `editor-context.json` · `OrderService.java` · `question.json`
네 파일을 하나의 프롬프트로 조립해 **stdin** 으로 넣는 경로(`--fixture`)를 만들었다. 조립·전달 경로는 비용 없이 검증했고,
실제 `claude` 호출(=지연·비용)은 비용 승인 대기로 **BLOCKED** 다.

| 항목 | 값 | 측정 방법 | 시각 |
|---|---|---|---|
| 조립된 프롬프트 규모 | 2,006자 / **2,893바이트** (전사 9문단 · 붙잡은 문단 3 · 편집기 발췌 480자 · 소스 788자 · 질문 19자) | `node spikes/provider-claude.mjs --fixture fixtures/synthetic-class/golden-ioc --dry-run` · exit 0 | 2026-09-02 17:23 KST |
| stdin 전달 검증 (보낸 바이트 = 자식이 받은 바이트) | 2,893 = 2,893 (2회 모두 일치) | `--self-test` (claude 대신 node 가짜 CLI · 네트워크·비용 없음) · exit 0 | 2026-09-02 17:23 KST |
| 성공 회차 stderr 보존 검증 | `24자 / "self-test stderr banner"` (버려지지 않음) | 같은 `--self-test` 실행 | 같음 |
| 골든 컨텍스트 TTFT / 총 소요 / 비용 / 모델 | **미측정 (BLOCKED — 비용 승인 대기)** | 실제 `claude` 호출을 하지 않음 | — |
| `claude -p` 가 프롬프트 인자 없이 stdin 을 읽는지 (실제 CLI 기준) | **미검증** — 가짜 CLI 로만 확인했다. 실제 `claude` 2.1.252 에서의 stdin 수용 여부는 1번 사람이 할 일에서 함께 확인한다 | — | — |

### 파서·성공 판정 (비용 없음)

| 항목 | 값 | 측정 방법 | 시각 |
|---|---|---|---|
| 이 게이트의 단위 테스트 | **28개 통과** (파서 23개 + `buildFixturePrompt` 5개) · 253ms | `pnpm --filter @classmate/spikes exec vitest run test/stream-json.test.mjs` · exit 0 | 2026-09-02 17:36 KST |
| 이 게이트의 실행 경로 시험 (새로 추가) | **13개 통과** (`.cmd` 셈 해석 4 + 회차 타임아웃 2 + 중첩 차단 회계 5 + 회차 종결 2) · 4.04s | `pnpm --filter @classmate/spikes exec vitest run test/provider-claude.test.mjs` · exit 0 | 2026-09-02 18:02 KST |
| spikes 패키지 전체 테스트 | **62개 통과** (Test Files 3 passed · 이 게이트 28+13개 + Gate C `intellij-mcp-probe.test.mjs` 21개) · 4.03s. 뒤 숫자는 Gate C·Gate B 가 같은 세션에서 고치는 중이라 실행 시각마다 달라진다 | `pnpm --filter @classmate/spikes test` · exit 0 | 2026-09-02 18:03 KST |
| **진입점 가드 (import 부작용 차단)** | `import` 만으로는 측정이 돌지 않음 — `typeof buildFixturePrompt` 만 `function` 으로 찍히고 exit 0, `spikes/out/` 에 새 산출물 없음. 테스트 28개가 253ms 에 끝나는 것도 자식 CLI 가 뜨지 않았다는 증거다 | `node -e "import('./spikes/provider-claude.mjs').then(m=>console.log(typeof m.buildFixturePrompt))"` + `ls spikes/out/` | 2026-09-02 17:35 KST |
| 골든 프롬프트 조립 자동 검증 | 전사 9문단 · 붙잡은 문단 3(`> ` 로 시작하는 줄 3개) · 2,006자 / 2,893바이트 · 편집기 `filePath`·`caretLine`·`visibleRange` 반영 · 주입 방어 문구 포함 | `buildFixturePrompt` 테스트 5개 (`spikes/test/stream-json.test.mjs`) | 같음 |
| 회차 성공 판정 기준 | `exit 0` **및** `result.subtype === "success"` **및** `is_error !== true`. `is_error` 필드가 없는 오류 result(예: `subtype: "error_max_turns"`)를 성공으로 세지 않기 위해 `subtype` 검사를 더했다. 2026-09-02 5회는 모두 `subtype = "success"` 라 판정은 바뀌지 않는다 | `isSuccessResult()` 단위 테스트 5개 | 2026-09-02 17:23 KST |
| 비용 가드 | `--runs 6` → exit 2, `--runs 0` → exit 2, 알 수 없는 옵션 → exit 2, `--timeout abc` → exit 2, `--timeout 500` → exit 2, 없는 fixture 경로 → exit 2 | 각 명령 직접 실행 | 2026-09-02 17:35 KST |
| `--timeout` 검사 추가 이유 | 검사 전에는 `--timeout abc` 가 `NaN` 이 되어 `setTimeout(fn, NaN)` 이 즉시 발화 → 자식이 곧바로 죽고 인자 오류가 회차 실패(TIMEOUT · exit 1)로 둔갑했다. 실제 `claude` 였다면 spawn 은 되고 부분 비용이 났다 | 수정 전 `--self-test --runs 1 --timeout abc` 재현(검증자) · 수정 후 exit 2 | 2026-09-02 17:35 KST |

### Windows 실행 경로와 회차 타임아웃 (비용 없음 · 2026-09-02 18:00~18:05 KST 수정)

이전 판본의 회차 타임아웃은 **Windows 실제 경로에서 무력**했다. `claude` 는 `%APPDATA%\npm\claude.cmd`
래퍼라 `cmd.exe /c` 를 거쳐 뜨고, 실제 CLI 는 **손자** 프로세스가 된다. 타임아웃에 `child.kill()` 을
부르면 cmd 래퍼만 죽고 손자가 살아남아 (1) 모델 호출이 계속돼 **과금이 이어지고**, (2) 손자가 stdout
파이프를 쥔 채라 `close` 가 오지 않아 `runOnce()` 의 Promise 가 **영영 resolve 되지 않았다**.

| 항목 | 값 | 측정 방법 | 시각 |
|---|---|---|---|
| **결함 재현 (수정 전 동작)** | cmd 래퍼 뒤 손자(node) PID 27448 · `child.kill()` 1.5초 뒤 **손자 생존 = true · close 도착 = false** | 저장소 밖 임시 스크립트로 `cmd.exe /c <래퍼>` 를 띄우고 `child.kill()` 만 호출 (실제 claude 아님 · 60초 자는 node 손자) | 2026-09-02 18:01 KST |
| **수정 후 동작** | 회차 종결 **1,791ms** (타임아웃 1,500ms) · `status = timeout` · `killMethod = taskkill /T /F` · **손자 생존 = false** | 같은 스크립트의 `runOnce({ timeoutMs: 1500 })` 경로 | 같음 |
| 회차 종결 실측 3회 | 1,721 / 1,791 / 1,845 ms — 모두 요구선 2초 안 | 위 스크립트 + `provider-claude.test.mjs` | 2026-09-02 18:02 KST |
| 종결 예산 | 타임아웃 + `taskkill` 소요(실측 200~330ms) + 안전망 `TIMEOUT_GRACE_MS` 250ms. 트리를 죽인 뒤 `close` 는 1ms 안에 왔으므로 안전망은 순수 백업이다 | 코드 상수 + 위 실측 | 같음 |
| **래퍼 해석 (실행하지 않고 경로만)** | `claude.cmd` → `…\@anthropic-ai\claude-code\bin\claude.exe` (직접 실행) · `codex.cmd` → `C:\Program Files\nodejs\node.exe ["…\@openai\codex\bin\codex.js"]` | `resolveCmdWrapper()` 를 두 실물 셈에 적용 (파일을 **읽기만** 한다) | 같음 |
| 해석 성공 시 실행 경로 | `cmd.exe` 를 거치지 않는다 → 실제 CLI 가 **자식**이 되어 손자 문제 자체가 사라진다 | `node spikes/provider-claude.mjs --fixture … --dry-run` 의 `실행 경로:` 줄 · exit 0 | 2026-09-02 18:04 KST |
| 해석 실패 시 | `%dp0%` 표식이 없는(=npm 셈이 아닌) 배치는 해석하지 않고 `cmd.exe /c` 로 폴백한다. 이 경로는 `taskkill /T /F` 가 덮는다 | 단위 시험 `%dp0% 표식이 없는 손수 쓴 배치는…` | 2026-09-02 18:02 KST |
| **중첩 실행 차단 재시도 회계** | 첫 회차가 차단돼도 spawn 총 횟수 = `--runs` (예전에는 1+N). 차단된 회차는 버리지 않고 `status: "nesting_block"` 으로 `runs[]` 에 남아 집계에 든다 | 단위 시험 `collectRuns` 5개 (가짜 spawner 주입) | 같음 |
| 출력 JSON 에 추가된 필드 | `stats.spawnCount` · `stats.runsRequested` · `stats.timeoutCount` · `stats.nestingBlockCount` · `runs[].status` · `runs[].killMethod` · `runs[].spawnedVia` · `runs[].spawnedThroughCmdWrapper` | `--self-test` 산출물 | 2026-09-02 18:03 KST |

### Codex — 프로토콜 정찰 (네트워크 호출 없음)

| 항목 | 값 | 측정 방법 | 시각 |
|---|---|---|---|
| 버전 | `codex-cli 0.152.0` | `codex --version` (646ms, exit 0) | 2026-09-02 17:10 KST |
| `app-server` 하위 명령 | `daemon` · `proxy` · `generate-ts` · `generate-json-schema` · `help` | `codex app-server --help` (504ms, exit 0) | 같음 |
| TypeScript 바인딩 생성 | 701개 파일, 1,724ms, exit 0 | `codex app-server generate-ts --out spikes/out/codex-protocol` | 같음 |
| JSON-RPC 메소드 이름 수 | 188개 | 생성물에서 메소드 리터럴 추출 | 같음 |
| 요청/응답 타입 이름 수 | 307개 | 생성물에서 `export type|interface *(Request\|Response\|Notification\|Params\|Event)` 추출 | 같음 |
| 튜터 어댑터에 필요한 핵심 메소드 | `thread/start` · `thread/resume` · `turn/start` · `turn/started` · `turn/completed` · `turn/interrupt` · `item/started` · `item/agentMessage/delta` · `item/completed` · `item/reasoning/textDelta` | 위 추출 목록에서 선별 | 같음 |
| 승인 경계에 걸리는 메소드 | `item/commandExecution/requestApproval` · `item/fileChange/requestApproval` · `item/permissions/requestApproval` | 같음 | 같음 |
| Codex TTFT / 총 소요 / 비용 | **미측정 (BLOCKED)** — 사용 한도 소진으로 프롬프트 실행을 하지 않음 | — | — |

`item/agentMessage/delta` 가 있으므로 Codex 경로는 Claude 의 완성 메시지 단위보다 **더 이른 첫 문장 표시**가
구조적으로 가능하다. 다만 실제 지연은 한도 복구 후 측정해야 한다.

## 재현 명령

모두 저장소 루트 `C:\Users\elddl\kodonghui_myWs\corthex-classmate` (Git Bash) 에서 실행한다.

### 1. 단위 테스트 (stream-json 줄 파서 + 골든 프롬프트 조립)

```bash
pnpm --filter @classmate/spikes exec vitest run test/stream-json.test.mjs
```

```
 RUN  v4.1.11 C:/Users/elddl/kodonghui_myWs/corthex-classmate/spikes

 Test Files  1 passed (1)
      Tests  28 passed (28)
   Duration  253ms
```
exit 0. 패키지 전체는 `pnpm --filter @classmate/spikes test` → `Test Files 3 passed (3)` · `Tests 62 passed (62)` ·
`Duration 4.03s` · exit 0 (2026-09-02 18:03 KST 기준. 21개는 Gate C 소유 파일이라 그쪽 작업에 따라 수가 달라진다).
이 파일은 `provider-claude.mjs` 를 `import` 하므로, 253ms · 비용 0 으로 끝난다는 사실이 진입점 가드가 살아 있다는 증거다.

### 1-0. 실행 경로·타임아웃 시험 (비용 없음 · 가짜 CLI 만 띄운다)

```bash
pnpm --filter @classmate/spikes exec vitest run test/provider-claude.test.mjs --reporter=verbose
```

```
 ✓ resolveCmdWrapper … > node + cli.js 모양 셈을 process.execPath + js 경로로 푼다 5ms
 ✓ resolveCmdWrapper … > .exe 를 직접 부르는 모양 셈을 그 .exe 로 푼다 (claude.cmd 와 같은 형태) 2ms
 ✓ resolveCmdWrapper … > %dp0% 표식이 없는 손수 쓴 배치는 해석하지 않고 cmd.exe /c 로 폴백한다 2ms
 ✓ resolveCmdWrapper … > 셈이 가리키는 진입점이 없으면 null 이다 (있다고 속이지 않는다) 2ms
stdout | 회차 타임아웃 — cmd 래퍼 뒤의 손자까지 끝낸다 > TIMEOUT 으로 2초 안에 끝나고 손자 PID 가 사라진다
[타임아웃 트리 종료] 경과 1845ms · status=timeout · killMethod=taskkill /T /F · 손자 PID 4408 생존=false
 ✓ 회차 타임아웃 … > TIMEOUT 으로 2초 안에 끝나고 손자 PID 가 사라진다 2273ms
 ✓ 회차 타임아웃 … > 타임아웃 회차는 성공으로 세지 않는다 (result 이벤트가 있어도) 1479ms
 ✓ collectRuns … > 첫 회차가 차단되면 spawn 은 정확히 --runs 회이고 그 회차는 nesting_block 으로 남는다 1ms
 ✓ collectRuns … > --runs 1 에서 첫 회차가 차단돼도 재시도로 한 번 더 띄우지 않는다 0ms
 ✓ collectRuns … > 차단이 없으면 상태를 건드리지 않고 --runs 회만 돈다 0ms
 ✓ collectRuns … > 환경변수를 뺀 뒤에도 계속 차단되면 두 번 다시 판정하지 않는다 (회차만 소진한다) 0ms
 ✓ collectRuns … > looksLikeNestingBlock 은 stderr 배너와 spawn 오류를 모두 본다 0ms
 ✓ 회차 종결 … > 바로 끝나는 자식은 ok 로 끝나고 taskkill 을 부르지 않는다 58ms
 ✓ 회차 종결 … > 없는 실행 파일은 spawn_error 로 끝난다 2ms

 Test Files  1 passed (1)
      Tests  13 passed (13)
```
exit 0. 여기서 띄우는 것은 **실제 `claude` 가 아니라 60초 자는 node 손자**다. 시험은 `cmd 래퍼 → node 손자`
모양을 임시 `.cmd` 로 만들어 `--timeout 1500` 상당으로 돌리고, 손자 PID 가 `tasklist` 에서 사라지는지 본다.

### 1-0-1. 타임아웃 트리 종료 실증 (수정 전/후 비교 · 비용 없음)

`taskkill` 이 손자까지 끊는지는 PID 로 직접 확인한다. `<pid>` 는 손자가 파일에 적어 둔 값이다.

```bash
tasklist /FI "PID eq <pid>"
```

살아 있을 때(=수정 전 재현)와 없을 때(=수정 후)의 출력 모양은 이렇다. 콘솔 코드페이지가 949(한국어)라
Git Bash 로 그대로 받으면 깨진다. 아래는 디코드한 것이다.

```
--- 손자가 살아 있을 때 (수정 전: child.kill() 만 호출) ---
이미지 이름                    PID 세션 이름              세션#  메모리 사용
========================= ======== ================ =========== ============
node.exe                     27448 Console                    3     46,812 K

--- 손자가 사라졌을 때 (수정 후: taskkill /PID <pid> /T /F) ---
정보: 실행 중인 작업 중 지정된 조건에 일치하는 작업이 없습니다.
```

같은 스크립트가 찍은 요약이다.

```
== [before] 예전 판본 재현 · cmd.exe /c + child.kill() ==
cmd.exe(자식) PID = 4736 · node(손자) PID = 27448
child.kill() 뒤 1.5초 — 손자 생존 = true · close 이벤트 도착 = false

== [after] 지금 판본 · runOnce(timeoutMs 1500) ==
회차 종결 = 1791ms (타임아웃 1500ms) · status = timeout · ok = false
killMethod = taskkill /T /F · cmd 래퍼 경유 = true · via = cmd.exe /c (래퍼 해석 실패 · 폴백)
손자(node) PID = 18608 · 생존 = false

== 실물 npm 셈 해석 (실행하지 않음 · 경로만) ==
claude.cmd → C:\Users\elddl\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe []
codex.cmd → C:\Program Files\nodejs\node.exe ["…\@openai\codex\bin\codex.js"]
```

두 줄이 핵심이다. **수정 전에는 손자가 살아 있고 `close` 가 오지 않았다**(=회차가 끝나지 않고 과금이
이어진다). **수정 후에는 1,791ms 에 회차가 `timeout` 으로 끝나고 손자가 사라진다.**
이 비교 스크립트는 저장소가 아니라 임시 디렉터리에 두고 실행했다(§10).

### 1-1. 진입점 가드 확인 (비용 없음 · 이 게이트에서 가장 중요한 안전장치)

`provider-claude.mjs` 는 직접 실행할 때만 측정을 돌린다. `import` 만으로 실제 `claude` 가 뜨면 안 된다.

```bash
node -e "import('./spikes/provider-claude.mjs').then(m=>console.log('export type:', typeof m.buildFixturePrompt))"
ls spikes/out/
```

```
export type: function
exit=0
--- out dir after import ---
codex-protocol
gate-b
provider-claude-2026-09-02T08-09-47-247Z.json
provider-claude-short-2026-09-02T08-32-20-767Z.json
```
즉시 끝나고 `spikes/out/` 에 새 산출물이 생기지 않아야 한다. 새 파일이 생겼다면 가드가 깨진 것이고 비용이 난 것이다.

**2026-09-02 18:05 KST 에 스파이크 다섯 개 전부를 한 번에 감사했다**(임시 스크립트로 순서대로 `import` 하고
`spikes/out/` 파일 수를 앞뒤로 비교). 출력은 이렇다.

```
spikes/out 파일 수 (import 전): 705
import provider-claude.mjs         3ms · exports: buildFixturePrompt, collectRuns, looksLikeNestingBlock, resolveCmdWrapper, runOnce, toSpawnArgs
import provider-codex-probe.mjs    1ms · exports: (없음)
import tiro-share-observe.mjs      1ms · exports: DEFAULT_MINUTES, …, main, parseArgs, percentile, stampFor, summarize
import meet-capture-measure.mjs  212ms · exports: main
import intellij-mcp-probe.mjs    139ms · exports: DEFAULT_MCP_URLS, ProbeError, TOKEN_ENV, …, probe, …
spikes/out 파일 수 (import 후): 705
import 으로 늘어난 산출물: 없음 (가드 정상)
intellij-mcp-probe.mjs 의 probe export: function
```
exit 0. 다섯 개 모두 `import` 부작용이 없다. 감사 시점에 가드가 **없던 것은
`meet-capture-measure.mjs` 하나**였고(최상위에서 `await main()` 을 조건 없이 호출 →
`import` 한 번에 Chromium 이 뜨고 측정이 돌았다), 나머지 넷은 이미 가드가 있었다.
그 파일에 같은 모양의 가드를 넣고 `main` 을 export 했다. 직접 실행 동작은 그대로다
(가드를 넣은 뒤 `node spikes/meet-capture-measure.mjs` 가 여전히 Chromium 을 띄우고 `main()` 안까지
들어가는 것을 확인했다). Gate C 시험이 쓰는 `intellij-mcp-probe.mjs` 의 `probe` export 도 그대로다.

### 2. Claude 지연 측정 — 25자 단문 (비용 발생 · 5회 상한 · **골든 컨텍스트 미포함**)

```bash
node spikes/provider-claude.mjs --runs 5
```

```
claude 실행 파일: C:\Users\elddl\AppData\Roaming\npm\claude.cmd
인자: -p <질문 25자> --output-format stream-json --verbose
회차: 5 · 타임아웃: 120000ms
1회차 완료 · TTFT 7064ms · 총 9522ms · exit 0
...
회차  TTFT(ms)  총(ms)  result.duration_ms  num_turns  cost_usd  답변 길이  이벤트  exit
 1      7064   9522                4611          1  0.506307     90    5     0
 2      6263   8830                4585          1  0.236577     92    5     0
 3      6334   8354                4231          1  0.236653     92    5     0
 4      6614   8740                4572          1  0.251082    101    5     0
 5      7008   9261                4982          1  0.237397    115    5     0

성공 5/5 · TTFT p50 6614ms · p95 7064ms · 총 p50 8830ms · p95 9522ms
누적 비용: 1.468017 USD
결과 저장: …\spikes\out\provider-claude-2026-09-02T08-09-47-247Z.json
```
exit 0. 실행 없이 명령만 확인하려면 `node spikes/provider-claude.mjs --dry-run`.
`--runs` 는 1..5 만 받는다(비용 보호). 출력 파일은 `spikes/out/` 이고 `.gitignore` 의 `out/` 규칙으로 커밋되지 않는다
(`git check-ignore -v` 로 확인: `.gitignore:25:out/`).

> **위 출력은 1세트(판본이 다름)다.** 저 숫자를 만든 산출물
> `spikes/out/provider-claude-2026-09-02T08-09-47-247Z.json` 은 검증 지적을 반영하기 전 판본이 남긴 것이다.
> 지금 판본의 출력 JSON 은 모양이 다르다: (a) `models` 와 회차별 `model` 이 있고,
> (b) `promptMode` · `promptStats` · `stdinBytes` · `stdinBytesEcho` 가 있고,
> (c) 성공 회차의 `stderrHead` 가 빈 문자열이 아니라 실제 앞 300자이고,
> (d) 파일 이름에 `short` / `golden` / `selftest` 라벨이 붙는다.
> 그 모양의 실물이 2세트 산출물 `spikes/out/provider-claude-short-2026-09-02T08-32-20-767Z.json` 이다.
> 지연·비용 숫자 자체(TTFT·총 소요·`result.duration_ms`·`total_cost_usd`)의 계산 방식은 두 판본이 같다.

### 2-1. Claude 지연 측정 — 골든 시나리오 컨텍스트 (게이트 정의 조건 · **비용 승인 대기 · 아직 실행하지 않음**)

```bash
node spikes/provider-claude.mjs --fixture fixtures/synthetic-class/golden-ioc --runs 5
```

이 명령은 아직 돌리지 않았다(사람이 할 일 1번). 비용 없이 프롬프트 조립만 확인하는 것은 아래 4번.

### 3. Codex 프로토콜 정찰 (네트워크 호출 없음 · 무료)

```bash
node spikes/provider-codex-probe.mjs
```

```
== codex --version ==
codex-cli 0.152.0
exit=0 · 646ms

== codex app-server --help (하위 명령) ==
  daemon                Manage the local app-server daemon
  proxy                 Proxy stdio bytes to the running app-server control socket
  generate-ts           [experimental] Generate TypeScript bindings for the app server protocol
  generate-json-schema  [experimental] Generate JSON Schema for the app server protocol
  help                  Print this message or the help of the given subcommand(s)
exit=0 · 504ms

== codex app-server generate-ts --out spikes\out\codex-protocol ==
exit=0 · 1724ms
생성 파일 701개:
  AbsolutePathBuf.ts (575 bytes)
  ...
총 188개 중 20개 표시   (메소드 리터럴)
총 307개 중 20개 표시   (요청/응답 타입)
```
exit 0. 전체 목록은 `--top 200` 으로 본다.

### 4. 골든 컨텍스트 프롬프트 조립 확인 (비용 없음 · claude 를 실행하지 않음)

```bash
node spikes/provider-claude.mjs --fixture fixtures/synthetic-class/golden-ioc --dry-run
```

```
실행 파일: C:\Users\elddl\AppData\Roaming\npm\claude.cmd
실행 경로: 직접 실행 (claude.exe) → cmd.exe 를 거치지 않음
인자: -p --output-format stream-json --verbose
프롬프트 경로: stdin (골든 컨텍스트) · 전사 9문단(붙잡음 3) · 편집기 발췌 480자 · 소스 788자 · 질문 19자
조립된 프롬프트: 2006자 / 2893바이트 (본문은 출력하지 않음)
회차: 5 · 타임아웃: 120000ms
```
exit 0 (2026-09-02 18:04 KST 재실행). 질문·전사 본문은 화면에 찍지 않고 길이만 찍는다(§4-3).
질문이 argv 에서 사라진 것에 주목한다 — 골든 모드에서는 프롬프트가 **stdin** 으로만 흐른다(§4-7).

`실행 경로:` 줄이 새로 생겼다. `claude.cmd` 래퍼를 벗겨 `claude.exe` 를 직접 띄운다는 뜻이고,
`cmd.exe /c` 를 거치지 않으므로 실제 CLI 가 손자가 아니라 자식이다. 이 줄이
`… → 실제 CLI 는 손자 프로세스 (타임아웃 시 taskkill /T /F 로 트리 종료)` 로 바뀌어 있으면
래퍼 해석에 실패해 폴백을 탄 것이고, 그때는 타임아웃이 `taskkill` 에 기댄다.
**이 명령은 `claude` 를 실행하지 않는다.** 래퍼 파일을 읽어 경로만 해석한다.

### 5. stdin 전달·stderr 보존 검증 (비용 없음 · 가짜 CLI)

`claude` 대신 `node -e` 로 띄운 가짜 CLI 가 stdin 을 전부 읽어 받은 바이트 수를 `result` 이벤트에 실어 돌려준다.
spawn → stdin 쓰기 → stream-json 파싱 → 종료까지의 배관을 네트워크·비용 없이 확인한다.

```bash
node spikes/provider-claude.mjs --self-test --fixture fixtures/synthetic-class/golden-ioc --runs 2 --timeout 1500 --out "$TEMP/c2-selftest"
```

```
--self-test: claude 대신 node 가짜 CLI 를 띄웁니다 (네트워크·비용 없음)
실행 파일: C:\Program Files\nodejs\node.exe
실행 경로: 직접 실행 (래퍼 아님) → cmd.exe 를 거치지 않음
인자: -e <가짜 CLI 612자>
프롬프트 경로: stdin (골든 컨텍스트) · 전사 9문단(붙잡음 3) · 편집기 발췌 480자 · 소스 788자 · 질문 19자
조립된 프롬프트: 2006자 / 2893바이트 (본문은 출력하지 않음)
회차: 2 · 타임아웃: 1500ms
1회차 완료 · TTFT 54ms · 총 59ms · 상태 ok · exit 0
2회차 완료 · TTFT 46ms · 총 52ms · 상태 ok · exit 0
spawn 총 2회 (상한 --runs 2)

회차  TTFT(ms)  총(ms)  result.duration_ms  num_turns  cost_usd  답변 길이  이벤트  상태  exit
--  --------  -----  ------------------  ---------  --------  -----  ---  --  ----
 1        54     59                   1          1  0.000000      2    3  ok     0
 2        46     52                   1          1  0.000000      2    3  ok     0

stdin 전달 검증: 보낸 2893바이트 · 자식이 받은 2893, 2893 → 일치
stderr 보존 검증: 24자/"self-test stderr banner" | 24자/"self-test stderr banner"

성공 2/2 · TTFT p50 46ms · p95 54ms · 총 p50 52ms · p95 59ms
누적 비용: 0.000000 USD
```
exit 0 (2026-09-02 18:03 KST 재실행). 네 가지가 확인된다: 2,893바이트가 잘리지 않고 자식에게 도달한다는 것,
`exit 0` 인 회차에서도 stderr 앞 300자가 보존된다는 것(이전 판본은 버렸다),
회차마다 `상태` 가 찍힌다는 것, 그리고 **`spawn 총 N회 (상한 --runs N)`** 줄로 spawn 횟수가 상한을
넘지 않았음을 매 실행이 스스로 보고한다는 것이다.
`--out` 을 임시 디렉터리로 돌리면 저장소에 산출물을 남기지 않는다(빼면 `spikes/out/` 에
`provider-claude-selftest-*.json` 이 생기고, `out/` 은 `.gitignore` 대상이라 커밋되지 않는다).

### 6. 비용 가드

```bash
node spikes/provider-claude.mjs --runs 6        # exit 2  --runs 는 1..5 사이 정수여야 합니다 (비용 보호)
node spikes/provider-claude.mjs --runs 0        # exit 2  같은 메시지
node spikes/provider-claude.mjs --bogus         # exit 2  알 수 없는 옵션: --bogus
node spikes/provider-claude.mjs --timeout abc   # exit 2  --timeout 은 1000 이상 정수(ms)여야 합니다
node spikes/provider-claude.mjs --timeout 500   # exit 2  같은 메시지
node spikes/provider-claude.mjs --fixture /no/such/dir --dry-run   # exit 2  ENOENT … transcript.json
```

여섯 줄 모두 2026-09-02 17:35 KST 에 그대로 실행해 exit 2 를 확인했고,
실행 경로·타임아웃 수정 뒤 18:04 KST 에 앞 다섯 줄을 다시 실행해 전부 exit 2 임을 확인했다.
`--timeout` 검사가 없던 판본에서는 `--timeout abc` 가 exit 2 가 아니라 `NaN` 타임아웃 → 즉시 kill → 회차 실패(TIMEOUT · exit 1)
였다. 인자 오타가 측정 실패로 보이고, 실제 `claude` 였다면 부분 비용이 났다.

## 결정에 미치는 영향

- **Provider 기본값 = Claude** (§3-2·§2-5 유지). 실측으로 뒷받침됨: 두 세트 합쳐 10/10 성공,
  TTFT p50 6.6초·6.8초로 §3-6 의 5~10초 창 안.
  다만 **그 실측은 골든 컨텍스트 없이 25자 단문으로 잰 것**이므로, 이 결정은 "Codex 실측이 없는 지금 시점의 기본값"
  이상으로 읽지 않는다. 골든 컨텍스트 재측정(사람이 할 일 1번)에서 10초를 넘기면 이 결정이 아니라
  프로세스 프리워밍·부분 스트리밍 대응책이 먼저 바뀐다.
  `docs/DECISIONS.md` 에 "Provider 기본 = Claude" 를 기록하는 것은 오케스트레이터 몫이다(이 게이트는 문서를 건드리지 않는다).
- **한 질문당 CLI 를 새로 띄우면 4.0~6.0초를 모델과 무관하게 잃는다** (1세트 4.1~4.9초, 2세트 4.0~6.0초).
  총 소요 8.8~9.4초 가운데 모델 호출은 4.6~4.9초뿐이다.
  Phase 2 의 native-host 는 질문마다 `claude -p` 를 새로 spawn 하지 말고
  (a) 교시 시작 시 프로세스를 미리 띄워 두거나, (b) `--input-format stream-json` 으로 한 프로세스를 유지하며 질문을 흘려보내는
  방식을 먼저 시험해야 한다. 이것만으로 목표선 5초에 들어갈 여지가 있다.
- **첫 문장을 더 일찍 보여야 한다.** 이번 TTFT 는 완성된 `assistant` 메시지 기준이라 UI 의 "결론 한 문장"이
  6.6초 뒤에야 뜬다. `--include-partial-messages` 로 부분 청크를 받아 MarginNote 의 결론 줄을 먼저 채우고
  나머지를 뒤에 붙이는 UI(§3-6 대응책)를 Phase 2 기본 설계로 삼는다.
- **Codex 는 대안 경로로 남긴다.** `item/agentMessage/delta` 가 프로토콜에 있으므로 델타 단위 표시가 가능하고,
  `thread/start` → `turn/start` → `item/agentMessage/delta` → `turn/completed` 가 어댑터가 쓸 최소 흐름이다.
  승인 요청 메소드 3종(`*/requestApproval`)은 수업 모드에서 전부 거절로 고정해 §4-6(읽기 전용)을 지킨다.
- `TutorProvider` 는 두 CLI 를 모두 감쌀 수 있다: Claude 는 줄 단위 JSON(stream-json), Codex 는 JSON-RPC 알림.
  `spikes/lib/stream-json.mjs` 의 버퍼링·비JSON 무시 규칙은 두 경로 모두에 재사용 가능하다.

## 사람이 할 일

1. **골든 시나리오 컨텍스트 기준 재측정 (BLOCKED — 비용 승인 대기)** — 게이트 정의(§6 Gate C2)가 요구하는 조건이다.
   지금 PASS 는 25자 단문 기준이므로, 이 항목이 끝나야 게이트 조건에서의 판정이 확정된다.
   - 먼저 무료 확인: `node spikes/provider-claude.mjs --fixture fixtures/synthetic-class/golden-ioc --dry-run`
     → `조립된 프롬프트: 2006자 / 2893바이트` 가 나오는지 본다.
   - 비용을 승인할지 정한다. 25자 단문 5회가 1.468017 USD 였으므로, 입력이 2,893바이트로 늘어나는 이번 5회는
     **그보다 더 든다**(정확한 금액은 돌려 봐야 안다). 승인 없이는 에이전트가 실행하지 않는다.
   - 승인 후 실행: `node spikes/provider-claude.mjs --fixture fixtures/synthetic-class/golden-ioc --runs 5`
   - 확인할 것 세 가지. (a) `성공 N/5` 가 5/5 인가. 0/5 이고 stderr 에 프롬프트 없음/stdin 관련 경고가 보이면
     실제 `claude` 가 stdin 프롬프트를 받지 않는다는 뜻이므로, 인자 전달 방식을 다시 정해야 한다
     (argv 로 되돌리는 것은 §4-7 위반이므로 `--input-format stream-json` 을 먼저 본다).
     (b) TTFT p50 이 10,000ms 이내인가. (c) 출력 JSON 의 `models` 가 여전히 `claude-opus-5[1m]` 인가
     (다르면 기본 모델이 바뀐 것이므로 1·2세트와 직접 비교하면 안 된다).
   - 그 뒤 이 문서의 "Claude — 골든 시나리오 컨텍스트" 표와 `## 판정` 첫 줄을 실측값으로 바꾼다.
   - **2026-09-02 18:05 KST 이후 판본으로 돌릴 것.** 그전 판본은 회차 타임아웃이 Windows 에서 무력해
     (`cmd.exe` 래퍼만 죽고 실제 CLI 손자가 살아남아) 타임아웃이 걸려도 **과금이 계속되고 회차가 끝나지
     않았다**. 지금은 래퍼를 벗겨 직접 띄우고, 폴백이면 `taskkill /T /F` 로 트리째 끊는다.
     또 중첩 실행 차단 재시도가 `--runs` 를 넘겨 spawn 하던 것도 막혔으므로, 이제 `--runs 5` 는
     **최대 5회 spawn** 을 뜻한다(예전에는 최대 6회였고 버려진 1회의 비용이 집계에서 빠졌다).
     실행 뒤 출력의 `spawn 총 N회 (상한 --runs 5)` 줄과 산출물의 `stats.spawnCount` 로 확인한다.
2. **Codex 사용 한도 복구 확인 (대기)** — 사람 결정·계정 항목이므로 에이전트가 실행하지 않는다.
   - 절차: 터미널에서 `codex` 를 한 번 실행해 로그인 상태와 한도 안내를 눈으로 확인한다.
     한도 안내가 사라졌으면 아래 3번으로 넘어간다. 로그아웃 상태면 `codex login` 을 **사람이 직접** 실행한다
     (OAuth 브라우저 로그인은 사람만 한다).
3. **Codex 지연 측정 재실행 (한도 복구 후)** — Codex 측정 스크립트는 아직 없다. 한도가 복구되면 다음 순서로 진행한다.
   - `node spikes/provider-codex-probe.mjs` 로 프로토콜이 그대로인지 먼저 확인(무료).
   - 그 뒤 `thread/start` → `turn/start` → `item/agentMessage/delta` → `turn/completed` 를 stdio 로 주고받는
     `spikes/provider-codex.mjs` 를 새로 만들어 Claude 와 같은 질문·같은 5회로 측정하고 이 문서의 표를 채운다.
4. **사용 모델 확인 — 완료 (2026-09-02 17:32 KST)** — 2세트 산출물의 `models` 가 `claude-opus-5[1m]` 이었다.
   `--model` 을 지정하지 않은 상태의 CLI 기본값이므로 별도 실행은 필요 없다. 남은 결정은 Phase 2 에서
   모델을 명시적으로 고정할지 여부뿐이다(아래 남은 위험 "기본 모델 변경").
5. **비용 승인 (대기)** — 지금까지 Claude 실측에 든 비용은 **합계 2.719340 USD** 다
   (1세트 5회 1.468017 + 2세트 5회 1.251323, 2세트는 진입점 가드 결함으로 승인 없이 나간 지출).
   재측정·회귀 측정을 정기적으로 돌릴지, 돌린다면 몇 회로 할지는 사람이 정한다. 에이전트는 요청 없이 다시 돌리지 않는다.
   가드가 들어간 지금은 `import` 로 우발 지출이 나지 않는다(재현 명령 1-1 번으로 확인).

## 남은 위험

- **로그인 만료**: `claude` 도 `codex` 도 자체 로그인 상태에 의존한다(§4-2 에 따라 앱은 토큰을 저장하지 않는다).
  수업 중 로그인이 만료되면 제공자만 죽고 기록은 계속돼야 한다 → Gate D 의 "제공자 응답 실패 → queued → recovered" 경로가
  이 실패를 반드시 덮어야 한다. 어댑터는 비정상 종료와 `result.is_error` 를 구분해 다뤄야 한다.
- **기본 모델 변경**: 2세트에서 기본 모델이 `claude-opus-5[1m]` 로 확인됐지만 `--model` 을 지정하지 않았으므로
  CLI 기본값이 바뀌면 지연과 비용이 예고 없이 달라진다. 1세트에는 모델 기록이 없어 두 세트가 같은 모델이었다는 보장도 없다.
  Phase 2 에서 모델을 명시적으로 고정할지, 기본값을 따를지 결정이 필요하다.
- **측정 조건이 게이트 정의보다 좁다 (가장 큰 위험)**: PASS 근거인 6,614ms 는 골든 컨텍스트 없이 25자 단문으로 잰 값이다.
  게이트 정의(§6 Gate C2)는 골든 시나리오 컨텍스트를 요구하고, 그 컨텍스트(2,893바이트)는 TTFT·비용을 **올리는** 방향이다.
  10초 상한까지의 여유 3.4초가 게이트 조건에서도 남는지는 사람이 할 일 1번을 돌려야 안다.
- **비용**: 25자 질문 하나에 0.24 USD 였다. 실제 수업 문맥(전사 9문단 + 편집기 발췌 + 열린 파일 = 2,893바이트)을 붙이면
  입력 토큰이 늘어 더 커진다. 8교시 × 질문 여러 개면 하루 비용이 무시할 수 없다.
- **표본이 세트당 5회뿐 — 꼬리 지연이 실제로 관측됐다**: p95 가 최댓값과 같아 꼬리를 못 본다는 위험이 2세트에서 그대로 드러났다.
  같은 조건인데 TTFT p95 가 7,064ms(1세트) → **8,511ms**(2세트), 총 소요 p95 가 9,522ms → **10,769ms** 로 벌어졌고
  2세트 3회차는 총 소요가 10초를 넘겼다. 판정선은 TTFT 기준이라 판정은 유지되지만, §3-6 의 "5~10초" 창을
  총 소요 기준으로 읽으면 이미 한 번 벗어난 것이다. 골든 컨텍스트를 붙이면 이 꼬리가 더 길어진다.
- **우발 실행 비용 (고쳤지만 기록해 둔다)**: 진입점 가드가 없던 판본은 모듈 `import` 만으로 실제 `claude` 5회를 돌려
  승인 없이 1.251323 USD 를 썼다. 지금은 `import.meta.url === pathToFileURL(process.argv[1]).href` 가드로 막혀 있고
  단위 테스트가 그 경로를 매번 지난다. 같은 모양(최상위 `main()` 무조건 실행)이 남아 있던 다른 스파이크
  `meet-capture-measure.mjs` 도 2026-09-02 18:05 KST 에 같은 가드로 막았고, 다섯 개 전부를 감사했다(재현 명령 1-1).
  **새 스파이크를 추가할 때 이 가드를 빠뜨리면 사고가 반복된다** — 최상위에서 `main()` 을 조건 없이 부르지 않는다.
- **측정 지점 차이**: 이번 TTFT 는 "완성된 답변 도착"에 가깝다. `--include-partial-messages` 로 다시 재면
  더 짧은 값이 나올 수 있고, 그 값이 UI 의 "첫 결론 표시"에 더 가깝다.
- **중첩 실행**: 이번에는 `CLAUDECODE=1` 인 환경에서도 자식 `claude -p` 가 정상 동작했지만, CLI 버전이 오르면
  차단이 생길 수 있다. 스크립트에 `CLAUDECODE`·`CLAUDE_CODE_ENTRYPOINT` 를 뺀 재시도 경로가 이미 들어 있다.
- **Windows 실행 경로 (고쳤지만 폴백이 남는다)**: `claude`·`codex` 는 `.cmd` 셈이고 Node 는 `.cmd` 를
  `shell:false` 로 직접 실행하지 못한다. 지금은 셈 파일을 읽어 실제 진입점을 뽑아 직접 띄운다
  (`claude.cmd` → `claude.exe`, `codex.cmd` → `node + codex.js`). 남는 위험은 셋이다.
  (a) 해석 규칙이 **npm 셈 모양(`%dp0%` 표식)에만** 맞춰져 있다. npm 이 셈 모양을 바꾸거나 다른 설치 방식
  (pnpm·volta·scoop 셈, `.ps1` 만 있는 설치)이면 해석에 실패해 `cmd.exe /c` 폴백을 탄다.
  (b) 폴백에서는 실제 CLI 가 손자라 타임아웃이 `taskkill /T /F` 에 기댄다. `taskkill` 이 PATH 에 없거나
  권한이 없으면 `child.kill('SIGKILL')` 로 내려앉고 **손자가 다시 살아남을 수 있다**(그 경우에도 스트림을
  끊어 회차 자체는 끝나므로 "끝나지 않는" 문제는 재발하지 않는다. `runs[].killMethod` 에 어느 쪽이었는지 남는다).
  (c) 다른 사람 PC 에서 설치 경로가 다르면 `resolveExecutable()` 이 그보다 먼저 깨진다.
- **타임아웃 회차의 부분 비용**: 트리를 죽여도 **그 회차에서 이미 발생한 모델 호출 비용은 돌아오지 않는다.**
  타임아웃은 "더 이상 쌓이지 않게 막는 것"이지 "공짜로 만드는 것"이 아니다. 타임아웃 회차는 `total_cost_usd`
  를 실은 `result` 이벤트가 오기 전에 끊기므로 **누적 비용 집계에서 그 회차가 빠진다** — 즉 출력의
  `누적 비용` 은 타임아웃이 있으면 실제보다 **낮게** 나온다. `stats.timeoutCount` 로 그 사실을 함께 읽어야 한다.
- **argv 주입 경계 (§4-7)**: 래퍼를 벗기면 `cmd.exe` 해석 지점이 사라지지만, **폴백 경로에서는 그대로 남는다.**
  경로가 실행 시점에 갈리므로 규칙은 하나로 둔다 — **Phase 2 에서 전사·화면·학생 질문 문자열을 argv 로 넘기면 안 된다.**
  넘기는 자리는 stdin(지금 `--fixture` 경로) 또는 `--input-format stream-json` 이다.
  기본 모드가 25자 고정 상수를 argv 로 넘기는 것은 외부 입력이 아니어서 지금은 문제가 없지만, 같은 spawn 모양을
  그대로 복사해 사용자 문자열을 실으면 경계가 깨진다.
- **회차 타임아웃 예산은 시간에 기댄다**: 회차는 `--timeout` + `taskkill` 소요 + `TIMEOUT_GRACE_MS`(250ms) 안에
  끝나도록 되어 있고, 실측은 1,721~1,845ms(타임아웃 1,500ms)였다. `taskkill` 이 크게 느린 PC 에서는 이 예산이
  늘어난다. 시험은 그래서 3초를 방어선으로 잡았다 — 재는 것은 "빠른가"가 아니라 "끝나기는 하는가"다.
- **중첩 실행 차단 재시도의 남은 성질**: 차단된 첫 회차도 spawn 1회로 세므로 `--runs 1` 로 돌리다 차단되면
  환경변수를 뺀 측정이 **한 번도 실행되지 않는다**(그 경우 안내 문구가 나온다). 비용 상한을 지키기 위한 의도된
  성질이고, 차단이 실제로 생기면 `--runs 2` 이상으로 다시 돌려야 한다.
- **fixtures 스키마 결합**: `buildFixturePrompt` 는 `question.snapshot.transcriptSegmentIds` ·
  `editor.visibleRange` · `editor.caretLine` 필드 이름에 그대로 기댄다. 지금은 단위 테스트 5개가 이 결합을 지키지만,
  fixtures 가 바뀌면 테스트가 먼저 깨진다. 깨질 때 테스트 숫자만 고치지 말고 이 문서의 2,893바이트·비용 추정을 함께 고쳐야 한다.
- **실제 CLI 의 stdin 수용은 미검증**: `--fixture` 경로는 가짜 CLI 로만 확인했다(2,893바이트 왕복 일치).
  실제 `claude` 2.1.252 가 프롬프트 인자 없이 stdin 을 읽는지는 사람이 할 일 1번에서 처음 확인된다.
- **파서 성공 판정**: `result` 이벤트에 `is_error` 가 없어도 `subtype` 이 오류를 뜻할 수 있어 `subtype === "success"` 를
  함께 본다. 다만 `subtype` 값의 전체 목록은 관측된 것(`success`)뿐이라, 새 성공 subtype 이 생기면 성공을 실패로 셀 수 있다.
- **`codex app-server` 는 experimental** 표시다. 0.152.0 에서 뽑은 188개 메소드 이름이 다음 버전에서 바뀔 수 있다.

## 부록 — 1라운드 구현 (2026-09-02)

이 절은 **추가만** 한다. 위의 판정·측정값·비용 사고 문단은 고치지 않았다.

Phase 2 1라운드 단위 (8) 이 이 게이트의 결론을 Rust 크레이트 `classmate-providers`
(`apps/native-host/crates/providers`)로 옮겼다. **이 구현 작업 중 실제 `claude`·`codex` 호출은 0회다.**

### 무엇을 옮겼나

| 이 문서의 근거 | 옮긴 자리 |
|---|---|
| `TutorProvider { ask(context, question) → stream }` | `src/provider.rs` — 동기 trait + `AskRequest`·`ProviderEvent`·`AskOutcome`·`ProviderError` |
| `spikes/lib/stream-json.mjs` 의 줄 파서 규칙 | `src/stream_json.rs` — 청크 버퍼링 · 비JSON 줄 무시·계수 · `assistant` content 두 모양 · `isSuccessResult` |
| `-p --output-format stream-json --verbose` | `src/claude.rs` 의 `CLI_ARGS` (고정 리터럴 4개) |
| `resolveCmdWrapper()` — `%dp0%` 표식 · `.js` → node · `.exe` 직접 · 모르는 배치는 폴백 | `src/claude.rs` 의 `resolve_cmd_wrapper()` · `plan_launch()` |
| 타임아웃 시 `taskkill /PID <pid> /T /F` 트리 종료 + 유예 250ms | `src/claude.rs` 의 `kill_tree()` · `TIMEOUT_GRACE` |
| 성공 회차에도 stderr 를 버리지 않는다 | 오류에 stderr **마지막 200자**를 실어 준다(`NonZeroExit::stderr_tail`) |
| "질문 문자열을 argv 로 넘기지 않는다"(남은 위험 · argv 주입 경계) | 프롬프트는 **stdin 전용**. spike 의 argv 기본 모드는 옮기지 않았다 |
| "한 질문당 CLI 를 새로 띄우면 4~6초를 잃는다" | `src/queue.rs` — 작업 스레드 1개 · 동시 1건 · 대기 줄 상한 4 |
| Codex 실측 BLOCKED | `src/codex.rs` — `NotImplemented` 스텁 + app-server 프로토콜 메모 + 실측 후 채울 칸 표 |

### 우발 실행 비용 사고를 막는 장치 (이 게이트의 가장 비싼 교훈)

1. 제공자 생성자가 **CLI 경로를 필수 인자로** 받는다. 기본값도 PATH 탐색도 없다.
2. `src/**` · `tests/**` 어디에도 실행 파일 이름을 못 박은 프로세스 생성이 없다.
   `tests/no_real_cli.rs` 가 매 시험마다 확인한다(찾는 낱말은 그 파일이 스스로 걸리지 않게
   실행 시점에 이어 붙인다).
3. 시험은 언제나 `node` + 크레이트 안 `tests/fake-claude.mjs` 를 띄운다. 그 가짜 CLI 에도
   이 문서가 요구한 **진입점 가드**(`import.meta.url === pathToFileURL(process.argv[1]).href`)가 있다.
4. `.cmd` 해석 시험은 임시 폴더에 가짜 `.cmd`·가짜 `node.exe`·가짜 진입점을 만들어 쓴다.
   존재 여부만 보는 함수라 실행되지 않는다.

### 검증 (2026-09-02 · 로컬 Windows · Git Bash)

```bash
cargo test -p classmate-providers --manifest-path apps/native-host/Cargo.toml
```

```
running 29 tests   (단위) → ok
running  8 tests   (tests/claude_fake_cli.rs · 가짜 CLI 통합) → ok
running  3 tests   (tests/no_real_cli.rs · 비용 안전) → ok
running  1 test    (tests/queue_e2e.rs · 정상 → 타임아웃 → 비정상 종료) → ok
```
exit 0 · 합계 41개 통과. `cargo clippy -p classmate-providers --all-targets -- -D warnings` 와
`cargo fmt -p classmate-providers -- --check` 도 exit 0.

e2e(`tests/queue_e2e.rs`)는 큐 하나에 세 시나리오를 순서대로 넣어 (1) 정상 응답의 이벤트 순서와
outcome, (2) 타임아웃 뒤 `tasklist` 로 **자식과 손자 PID 가 모두 사라졌는지**, (3) 비정상 종료의
stderr 꼬리를 확인한다. 띄우는 것은 60초 자는 node 손자를 포함해 전부 가짜 CLI 다.

### 이 문서의 값이 바뀌면 함께 봐야 할 자리

- `result` 의 새 성공 `subtype` 이 생기면 `src/stream_json.rs` 의 `ResultMetrics::is_success()` 와
  이 문서 "남은 위험 · 파서 성공 판정"을 같이 고친다.
- npm 셈 모양이 바뀌면 `resolve_cmd_wrapper()` 시험 4개가 먼저 깨진다. 시험 숫자만 고치지 말고
  이 문서 "Windows 실행 경로" 항목을 함께 고친다.
- 골든 컨텍스트 재측정(사람이 할 일 1번)이 끝나면 프롬프트 조립 자리가 바뀔 수 있다.
  지금 크레이트의 프롬프트는 계약 `question.snapshot` 이 식별자만 담기 때문에 **자료 요약**만 싣는다.
