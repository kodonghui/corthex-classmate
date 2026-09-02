# Gate C — IntelliJ 공식 MCP (읽기 전용)

> 2026-09-02 갱신 3판(정찰 → 탐침 구현·측정 → 검증 지적 반영). 형식: 판정 → 측정값 → 재현 명령 → 결정에 미치는 영향 → 사람이 할 일 → 남은 위험.

## 판정

판정: BLOCKED (부분 — 탐침·읽기 전용 규칙·비밀값 차단은 스텁 MCP 서버로 검증 완료, 실제 IntelliJ MCP 서버가 꺼져 있어 실측 3항목 미측정. §사람이 할 일 참조)

| 하위 항목 | 판정 | 근거 |
|---|---|---|
| 읽기 전용 허용/차단 규칙 (`spikes/lib/intellij-readonly.mjs`) | PASS | Gate C 시험 21개 통과(워크스페이스 전체 44개 중 23개는 Gate C2 소유). 쓰기·실행·터미널 도구 차단, 모르는 이름 기본 차단 |
| MCP 탐침 (`spikes/intellij-mcp-probe.mjs`) — initialize → tools/list → 필터 → 읽기 도구 1회 호출 | PASS (스텁 기준) | SDK `McpServer` 스텁에 붙어 도구 5개 목록화, 읽기 3개 허용·쓰기 2개 차단, 쓰기 호출 0건 |
| 비밀값이 콘솔·문서로 새지 않음 | PASS | URL 은 `origin + 경로`만 출력(쿼리·해시·userinfo 삭제), 토큰은 `INTELLIJ_MCP_TOKEN` 에서만 읽어 `Authorization` 헤더로만 전송하고 값은 출력하지 않음. 시험 8개가 이 경로를 확인 |
| 실제 IntelliJ MCP 서버 연결 | BLOCKED | 64342 미개방. 탐침 종료 코드 3 · 원인 `ECONNREFUSED` |
| 실제 도구 목록(tools/list) 확보 | BLOCKED | 위와 같은 이유. 허용 목록은 JetBrains 문서상 이름으로 먼저 고정해 둠 |
| 현재 편집기 코드 ↔ 디스크 파일 비교 예제 | BLOCKED | 서버가 켜져야 가능 |
| 인증 방식(토큰 유무) 확인 | BLOCKED | 설정 화면을 사람이 열어야 확인 가능 |

### 검증 지적 반영 (2026-09-02 17:2x)

| 지적 | 심각도 | 조치 |
|---|---|---|
| 해석한 MCP URL 전문을 stdout/stderr 에 출력. 문서는 토큰을 그 URL 환경 변수에 담으라고 안내 → 토큰이 콘솔 → 채팅 → 커밋 문서로 흐를 수 있음 | major | `maskUrl()` 추가(쿼리·해시·사용자·비밀번호 삭제). 성공·실패·오류 메시지·`attempts` 모두 가린 URL 만 사용. 토큰 전용 환경 변수 `INTELLIJ_MCP_TOKEN` 추가(헤더 전송, 값 미출력). CLI·문서 안내 문구 교체 |
| §만든 것 표의 "시험 12개" 가 실제(13개)와 다름 | minor | 현재 수(21개)로 갱신 |
| §판정 표가 PASS 근거로 워크스페이스 전체 31개를 듦 | minor | Gate C 소유 시험 수만 근거로 적음 |
| `roundTripMs`·`connectMs`·`listMs` 를 `toBeGreaterThanOrEqual(0)` 로만 확인 | minor | `Number.isFinite` + 상한(`testTimeout` 과 같은 20000 ms) 확인으로 교체 |

## 측정값

| 항목 | 값 | 측정 방법 | 시각 |
|---|---|---|---|
| IntelliJ 프로세스 | `idea64.exe` PID 468 실행 중 | `tasklist \| grep -i idea64` | 2026-09-02 17:27 |
| IntelliJ 버전 | `IntelliJ IDEA 2025.3.6.1` (내장 웹 서버 응답 헤더) | `curl -D -` (정찰) | 2026-09-02 (정찰) |
| 열린 로컬 포트 | `127.0.0.1:63342` 하나 (PID 468, 내장 웹 서버) | `netstat -ano \| grep LISTENING` | 2026-09-02 17:27 |
| MCP 포트 64342 | 미개방 (`curl` 종료 코드 7 = couldn't connect) | `curl -s -m 3 http://127.0.0.1:64342/sse` | 2026-09-02 17:27 |
| 설정 파일 | `%APPDATA%/JetBrains/IntelliJIdea2025.3/options/` 에 mcp 관련 xml 없음 | 폴더 목록 (정찰) | 2026-09-02 (정찰) |
| 탐침 실제 실행 | 종료 코드 3 · 원인 코드 `ECONNREFUSED` · 소요 `real 0m0.293s` | `time node spikes/intellij-mcp-probe.mjs` | 2026-09-02 17:27 |
| 탐침 출력의 URL | `http://127.0.0.1:64342/sse` (쿼리 없는 URL 은 그대로) / `http://127.0.0.1:64342/sse (쿼리·자격 부분 가림)` (쿼리 있는 URL) | 아래 재현 명령 §4 | 2026-09-02 17:27 |
| 탐침 출력의 토큰 값 | 0회 노출 (`인증: INTELLIJ_MCP_TOKEN 헤더 사용 (값은 출력하지 않음)` 만 출력) | 아래 재현 명령 §4 | 2026-09-02 17:27 |
| 실제 tools/list 도구 개수 | 미측정 (서버 비활성) | — | — |
| 실제 편집기 ↔ 파일 비교 | 미측정 (서버 비활성) | — | — |
| 인증 방식(토큰 유무) | 미측정 (설정 화면 필요) | — | — |
| 스텁 initialize 왕복 | 42 ms | 시험 stdout `[gate-c 측정]` | 2026-09-02 17:27 |
| 스텁 tools/list 왕복 | 9.1 ms | 같음 | 2026-09-02 17:27 |
| 스텁 `get_all_open_file_paths` 왕복 | 5.8 ms | 같음 | 2026-09-02 17:27 |
| 스텁 응답 크기 | 104 bytes (본문은 남기지 않고 길이만 잼) | 같음 | 2026-09-02 17:27 |
| 스텁 허용/차단 | 허용 3 (`get_all_open_file_paths`, `get_open_in_editor_file_text`, `get_project_modules`) / 차단 2 (`replace_file_text_by_path`, `execute_terminal_command`) | 같음 | 2026-09-02 17:27 |
| 쓰기 도구 호출 횟수 | 0건 (스텁 쓰기 도구가 불리면 시험이 실패하도록 표시를 남김) | 시험 `쓰기 도구는 한 번도 호출되지 않는다` | 2026-09-02 17:27 |
| 스텁이 받은 `Authorization` 헤더 | 토큰 지정 시 모든 요청에 `Bearer …` 1종, 미지정 시 전부 `null` | 시험 `토큰은 URL 이 아니라 Authorization 헤더로 간다` · `토큰이 없으면 Authorization 헤더를 붙이지 않는다` | 2026-09-02 17:27 |
| Gate C 시험 수 | 21개 (verbose 출력의 `✓ test/intellij-mcp-probe.test.mjs >` 줄 수) | `vitest run --reporter=verbose \| grep -c` | 2026-09-02 17:27 |
| 시험 결과 (워크스페이스 전체) | 44 passed / 2 files / exit 0 (Gate C 21개 + Gate C2 `stream-json.test.mjs` 23개) | `pnpm --filter @classmate/spikes test` | 2026-09-02 17:27 |

## 재현 명령

모두 저장소 루트 `C:/Users/elddl/kodonghui_myWs/corthex-classmate` (Windows · Git Bash) 에서 실행한다.

### 1. IntelliJ 프로세스와 열린 포트

```bash
tasklist | grep -i idea64
netstat -ano | grep -i LISTENING | grep -E ":64342|:63342"
```

실제 출력:

```
idea64.exe                     468 Console                    3  1,853,596 K
  TCP    127.0.0.1:63342        0.0.0.0:0              LISTENING       468
```

63342(내장 웹 서버)만 있고 64342(MCP)는 없다.

### 2. 탐침 실행 (실제 IntelliJ 대상)

```bash
node spikes/intellij-mcp-probe.mjs
echo "EXIT=$?"
```

실제 출력:

```
후보 URL(default): http://127.0.0.1:64342/sse, http://127.0.0.1:64342/mcp
인증: 없음
판정: BLOCKED — IntelliJ 내장 MCP 서버에 붙지 못했습니다.
원인 코드    ECONNREFUSED
시도한 URL   http://127.0.0.1:64342/sse, http://127.0.0.1:64342/mcp
  http://127.0.0.1:64342/sse  streamable-http=ECONNREFUSED · sse=UNKNOWN
  http://127.0.0.1:64342/mcp  streamable-http=ECONNREFUSED · sse=UNKNOWN
...
EXIT=3
```

포트가 다르면 `--url` 또는 `INTELLIJ_MCP_URL` 로 넘긴다. **토큰은 URL 에 넣지 않고 `INTELLIJ_MCP_TOKEN` 으로만 넘긴다.**

```bash
node spikes/intellij-mcp-probe.mjs --url http://127.0.0.1:64342/mcp
INTELLIJ_MCP_URL=http://127.0.0.1:64342/sse node spikes/intellij-mcp-probe.mjs
INTELLIJ_MCP_TOKEN="$(cat ~/.intellij-mcp-token)" node spikes/intellij-mcp-probe.mjs   # 값은 셸 히스토리에도 남기지 않는다
```

### 3. 스텁 MCP 서버로 하는 시험

```bash
pnpm --filter @classmate/spikes test
```

실제 출력(끝부분):

```
 Test Files  2 passed (2)
      Tests  44 passed (44)
   Duration  737ms (transform 84ms, setup 0ms, import 425ms, tests 171ms, environment 0ms)
```

측정값 줄과 Gate C 시험 수까지 보려면 `spikes/` 에서 verbose 로 돌린다.

```bash
cd spikes && ./node_modules/.bin/vitest run --reporter=verbose
cd spikes && ./node_modules/.bin/vitest run --reporter=verbose 2>&1 | grep -c "✓ test/intellij-mcp-probe.test.mjs >"
```

실제 출력(발췌):

```
[gate-c 측정] 스텁 initialize 42 ms · tools/list 9.1 ms · get_all_open_file_paths 왕복 5.8 ms · 응답 104 bytes

 ✓ test/intellij-mcp-probe.test.mjs > 스텁 MCP 서버에 붙는 탐침 > tools/list 를 받아 읽기 3개를 허용하고 쓰기 2개를 차단한다
 ✓ test/intellij-mcp-probe.test.mjs > 스텁 MCP 서버에 붙는 탐침 > 쓰기 도구는 한 번도 호출되지 않는다
 ✓ test/intellij-mcp-probe.test.mjs > 연결 실패 처리 > 닫힌 포트에서는 ProbeError 를 던지고 원인 코드를 담는다
 ✓ test/intellij-mcp-probe.test.mjs > URL 가리기와 토큰 취급 > 토큰은 URL 이 아니라 Authorization 헤더로 간다
 ✓ test/intellij-mcp-probe.test.mjs > URL 가리기와 토큰 취급 > 연결 실패 오류 메시지와 attempts 에 원본 URL 이 남지 않는다
```

`grep -c` 결과: `21` (Gate C 소유 시험 수).

### 4. 비밀값이 출력으로 새지 않는지 확인

가짜 값(`abc123` · `stub-token-not-a-secret`)으로 확인한다. 실제 토큰으로 이 확인을 하지 않는다.

```bash
INTELLIJ_MCP_URL='http://127.0.0.1:64342/sse?token=abc123' node spikes/intellij-mcp-probe.mjs 2>&1 | head -3
INTELLIJ_MCP_TOKEN=stub-token-not-a-secret node spikes/intellij-mcp-probe.mjs 2>&1 | head -2
```

실제 출력:

```
후보 URL(INTELLIJ_MCP_URL): http://127.0.0.1:64342/sse (쿼리·자격 부분 가림)
인증: 없음
주의: URL 에 쿼리·자격 정보가 있어 출력에서 가렸습니다. 토큰은 INTELLIJ_MCP_TOKEN 으로 넘기세요.

후보 URL(default): http://127.0.0.1:64342/sse, http://127.0.0.1:64342/mcp
인증: INTELLIJ_MCP_TOKEN 헤더 사용 (값은 출력하지 않음)
```

`abc123` 도 `stub-token-not-a-secret` 도 출력 어디에도 나오지 않는다.

## 만든 것

| 파일 | 역할 |
|---|---|
| `spikes/lib/intellij-readonly.mjs` | 도구 이름 허용/차단 규칙. `classifyTool` · `filterTools` · `pickProbeTool` |
| `spikes/intellij-mcp-probe.mjs` | initialize(Streamable HTTP → SSE 폴백) → tools/list → 필터 → 읽기 도구 1회 호출. `probe(url, {token})` · `probeAny(urls, {token})` · 비밀값 차단용 `maskUrl` · `urlCarriesSecretSlot` · `readToken` · `makeAuthFetch` 를 export |
| `spikes/test/intellij-mcp-probe.test.mjs` | SDK `McpServer` 스텁(읽기 3 + 쓰기 2)에 붙는 시험 21개 |
| `spikes/vitest.config.mjs` | `**/*.test.mjs` 를 찾고 `node_modules/`·`out/` 은 뺀다 |

비밀값 취급 (검증 지적 major 반영):

- 출력되는 URL 은 `maskUrl()` 을 지난 값뿐이다. `origin + pathname` 만 남기고 `search`·`hash`·`username`·`password` 를 지운다. 성공 출력, 실패 출력, `ProbeError.message`, `ProbeError.url`, `attempts[].url`, `attempts[].message` 가 모두 이 값을 쓴다.
- 토큰은 `INTELLIJ_MCP_TOKEN` 환경 변수에서만 읽어 `Authorization: Bearer …` 헤더로만 보낸다(Streamable HTTP 는 `requestInit` + `fetch` 래퍼, SSE 는 `fetch` 래퍼로 GET 스트림까지 덮는다). 값은 콘솔·파일·오류 메시지 어디에도 나오지 않는다.
- URL 에 쿼리·userinfo 가 있으면 실행할 때 "토큰은 `INTELLIJ_MCP_TOKEN` 으로 넘기세요" 주의 줄을 찍는다.

허용 목록(읽기 전용 14개): `get_open_in_editor_file_text` · `get_open_in_editor_file_path` · `get_selected_in_editor_text` ·
`get_all_open_file_texts` · `get_all_open_file_paths` · `get_file_text_by_path` · `list_files_in_folder` ·
`list_directory_tree_in_folder` · `search_in_files_content` · `find_files_by_name_substring` · `get_project_modules` ·
`get_project_dependencies` · `get_project_problems` · `get_run_configurations`.

차단 규칙: `replace_*` · `create_new_file*` · `execute_terminal_command` · `execute_action_by_id` · `run_configuration` ·
`open_file_in_editor` · `toggle_debugger_breakpoint` · `reformat_*` · `rename_*` · `get_terminal_text` ·
실행 계열 접두사 · 상태를 바꾸는 동사 접두사 · 이름에 `terminal` 포함. **차단을 먼저 보고, 허용에 정확히 걸리지 않으면 기본 차단**이다.

응답 본문은 화면·파일 어디에도 남기지 않는다. 길이(바이트)와 왕복 시간만 남긴다(소스 코드가 로그로 새지 않게).

## 결정에 미치는 영향

- Gate C 가 열리기 전까지 `EditorContext` 는 fixtures 로만 채운다. 사이드패널 SourceFooter 는 "IntelliJ —" 로 표시(자료 지연).
- 로컬 도우미가 MCP **클라이언트**로 붙을 때 쓸 도구는 `spikes/lib/intellij-readonly.mjs` 의 허용 목록을 그대로 옮긴다. 쓰기·실행·터미널 도구는 목록에 있어도 호출하지 않는다(불변 원칙 §4-6).
- 얇은 자체 플러그인(`study_get_live_editor_context`)의 필요성은 실제 `tools/list` 를 본 뒤 판단한다. 지금은 판단 근거가 없다.
- 전송 방식은 Streamable HTTP 를 먼저 쓰고 실패하면 SSE 로 폴백한다. 어느 쪽으로 붙었는지 탐침 결과 `transport` 에 남는다.

## 사람이 할 일

1. **IntelliJ 내장 MCP 서버 켜기** — IntelliJ IDEA → `Settings` → `Tools` → `MCP Server` → `Enable MCP Server` 를 켭니다.
   그 화면에 나오는 **포트 번호**와 **인증 방식(토큰 요구 여부)** 를 확인해 알려 주세요.
   - **포트 번호만** 채팅으로 알려 주시면 됩니다. 실행할 때는 `--url` 또는 `INTELLIJ_MCP_URL` 로 넘깁니다.
   - **토큰이 있으면 값 자체는 채팅에도 붙이지 마세요.** "토큰이 필요하다" 는 사실만 알려 주시고,
     값은 실행할 때 `INTELLIJ_MCP_TOKEN` 환경 변수로만 넘깁니다. **URL 에 넣지 않습니다.**
     탐침은 토큰 값을 출력하지 않고, URL 도 `origin + 경로`만 찍습니다. — **대기**
2. **골든 시나리오 프로젝트 열어 두기** — `OrderService.java` 가 있는 창(예: `04_spring/…/chap01-ioc-container-practice`)을
   IntelliJ 에서 열고 그 파일을 편집기 탭으로 띄워 둡니다. — **대기**
3. **탐침 재실행** — 저장소 루트에서 아래를 실행하고 출력을 붙여 주세요.
   ```bash
   node spikes/intellij-mcp-probe.mjs
   # 포트가 64342 가 아니면
   node spikes/intellij-mcp-probe.mjs --url http://127.0.0.1:<화면에서 본 포트>/sse
   # 토큰이 필요하면 (값은 명령줄에 직접 쓰지 말고 파일이나 셸 변수에서 읽습니다)
   INTELLIJ_MCP_TOKEN="$(cat <토큰 파일>)" node spikes/intellij-mcp-probe.mjs
   ```
   기대 출력: `판정: 연결됨` + 허용/차단 도구 목록 + `호출 시험 … bytes … ms`.
   출력에는 토큰 값이 나오지 않고 URL 도 가려져 있으므로 그대로 붙여 주셔도 됩니다.
4. **결과 반영** — 위 출력이 나오면 이 문서의 측정값 표에서 `미측정` 세 칸(도구 개수 · 편집기 ↔ 파일 비교 · 인증 방식)을 채우고,
   실제 도구 이름이 허용 목록과 다르면 `spikes/lib/intellij-readonly.mjs` 의 `ALLOW_RULES` 를 고칩니다(아래 절차).
5. **편집기 ↔ 파일 비교 예제** — 서버가 켜진 뒤에 `get_open_in_editor_file_path` 와 `get_file_text_by_path` 로
   같은 파일의 편집기 내용과 디스크 내용을 받아 길이·해시만 비교해 기록합니다. 본문은 문서에 옮기지 않습니다.

사람 결정 항목(IntelliJ 설정 변경·토큰 확인)은 이 스파이크에서 실행하지 않았습니다. IntelliJ 설정 파일을 건드리지 않았습니다.

## 남은 위험

| 위험 | 내용 | 대응 |
|---|---|---|
| 도구 이름이 버전마다 바뀜 | JetBrains 가 2025.x 사이에서도 도구 이름을 바꿀 수 있다. 기본 차단이라 이름이 바뀌면 **조용히 아무 도구도 못 쓰게** 된다 | 탐침 출력의 `차단된 도구` 목록에 `허용 목록에 없음(기본 차단)` 이유로 읽기 도구가 보이면, 그 이름을 `ALLOW_RULES` 에 앵커(`^…$`)로 추가하고 왜 읽기 전용인지 한 줄을 함께 적는다. 시험의 `READ_TOOLS` 도 같이 늘린다 |
| 이름만 보고 판단함 | 이름이 읽기처럼 보여도 실제로는 상태를 바꾸는 도구가 있을 수 있다 | 도구 설명(`description`)과 `annotations.readOnlyHint` 를 실제 `tools/list` 에서 확인한 뒤 허용 목록을 확정한다. 지금은 확인하지 못했다 |
| 포트·경로가 다를 수 있음 | 64342 `/sse`·`/mcp` 는 문서상 기본값이다. 설정에서 바뀌었거나 stdio 전용일 수 있다 | `--url` / `INTELLIJ_MCP_URL` 로 넘긴다. stdio 만 지원하면 `StdioClientTransport` 로 탐침을 한 갈래 더 만든다 |
| 인증이 붙을 수 있음 | IntelliJ 가 토큰을 요구할 수 있다 | 구현 완료. 토큰은 `INTELLIJ_MCP_TOKEN` 에서만 읽어 `Authorization: Bearer …` 헤더로 보낸다(`requestInit` + `fetch` 래퍼). 값은 출력하지 않는다. **다만 IntelliJ 가 요구하는 인증 방식(Bearer 인지 다른 헤더인지)을 아직 못 봤다.** 401 이 나오면 실제 헤더 이름에 맞춰 `makeAuthFetch` 를 고친다 |
| 토큰이 URL 로 들어옴 | 사람이 습관적으로 `?token=…` 형태로 URL 에 넣을 수 있다 | `maskUrl()` 이 출력에서 지우고, 실행 시 "토큰은 `INTELLIJ_MCP_TOKEN` 으로 넘기세요" 주의 줄을 찍는다. 다만 **셸 히스토리와 프로세스 목록에는 남는다** — 그 자리는 코드로 막을 수 없으니 §사람이 할 일 1번 절차를 지켜야 한다 |
| SSE 폴백의 원인 코드가 `UNKNOWN` | SSE 전송 오류에는 errno 가 실리지 않아 원인 코드를 뽑지 못한다 | 첫 시도(Streamable HTTP)의 코드를 대표 코드로 쓴다. 실제 서버가 SSE 전용이면 그때 오류 문구를 보고 보강한다 |
| 스텁 ≠ 실제 서버 | 스텁은 인자 없는 도구만 두었다. 실제 도구가 인자를 요구하면 호출 시험이 실패할 수 있다 | 호출 시험은 인자 없는 조회 도구만 고른다(`pickProbeTool`). 후보가 없으면 호출을 건너뛰고 그렇게 출력한다 |
| 응답이 매우 클 수 있음 | `get_all_open_file_texts` 같은 도구는 소스 전체를 실어 온다 | 탐침은 그 도구를 호출하지 않는다(후보 목록에서 뺐다). 본선 구현에서는 크기 상한과 잘라내기 규칙을 따로 정한다 |
