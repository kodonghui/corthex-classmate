# Gate C — IntelliJ 공식 MCP (읽기 전용)

> 초안 · 2026-09-02 · 측정 전. 형식: 판정 → 측정값 → 재현 명령 → 결정에 미치는 영향 → 사람이 할 일.

## 판정

**BLOCKED** — IntelliJ 는 실행 중이지만 내장 MCP 서버가 켜져 있지 않다(MCP 포트 미개방). 사람이 설정에서 켜면 도구 목록화를 진행한다.

## 측정값 (2026-09-02 읽기 전용 정찰)

| 항목 | 값 |
|---|---|
| IntelliJ 프로세스 | `idea64.exe` PID 468 실행 중 |
| 버전 | `server: IntelliJ IDEA 2025.3.6.1` (내장 웹 서버 응답 헤더) |
| 열린 포트 | `127.0.0.1:63342` 하나 (내장 웹 서버). `/` → 404, `/sse` → 301 `/sse/`(정적 경로 처리), `/api/mcp` → 404 |
| MCP 포트 | 64342 등 추가 리스너 없음 → 내장 MCP 서버 비활성 상태로 판단 |
| 설정 파일 | `%APPDATA%\JetBrains\IntelliJIdea2025.3\options\` 에 mcp 관련 xml 없음 |

## 재현 명령 (Windows · Git Bash)

```bash
PID=$(tasklist | grep -i idea64.exe | awk '{print $2}' | head -1)
netstat -ano | grep -i LISTENING | awk -v p="$PID" '$NF==p{print $2}' | sort -u
curl -s -m 3 -D - -o /dev/null -H "Accept: text/event-stream" http://127.0.0.1:64342/sse
```

## 결정에 미치는 영향

- Gate C 가 열리기 전까지 `EditorContext` 는 fixtures 로만 채운다. 사이드패널 SourceFooter 는 "IntelliJ —" 로 표시(자료 지연).
- 로컬 도우미가 MCP **클라이언트**로 붙을 때 쓸 도구는 읽기 계열만 허용 목록으로 고정한다(파일 쓰기·실행·터미널 도구는 목록에 있어도 호출하지 않음 · §4-6).
- 얇은 자체 플러그인(`study_get_live_editor_context`)은 공식 MCP 도구 목록을 본 뒤 필요성만 판단한다.

## 사람이 할 일

1. IntelliJ → Settings → Tools → **MCP Server** → Enable (2025.2+ 내장). 포트와 인증 방식(토큰 여부)을 화면에서 확인해 알려 주세요. 토큰이 있으면 채팅에만 적고 파일에는 쓰지 않습니다.
2. 골든 시나리오용으로 `OrderService.java` 가 있는 프로젝트(예: `04_spring/…/chap01-ioc-container-practice`)를 열어 두세요.
3. 켜지면 도구 목록(`tools/list`)을 받아 읽기 도구만 표로 남기고, 현재 편집기 내용과 실제 파일을 비교하는 예를 기록합니다.
