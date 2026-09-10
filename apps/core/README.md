# classmate-core — Classmate Core (v0.3 · 1단계 진행 중)

수업 중 **지금 화면 + 방금 들은 말**을 붙잡아 순정 Claude / Codex 앱에 건네는 Windows 상주 프로그램입니다.
정본은 `docs/kickoff-v0.3.md`, 실행 계획은 `docs/plan/core-mvp-handoff.md` 입니다. 이 README 는 크레이트 안내만 적습니다.

## 1. 한 exe, 네 진입점

| 명령 | 하는 일 | 상태 |
|---|---|---|
| `classmate-core` | 트레이 상주 데몬 — Tiro 폴링 · 변화 감지 타임라인 · Alt+S · 보존 정리 · heartbeat | 있음 (4) |
| `classmate-core mcp` | stdio MCP 서버(앱마다 하나) — 툴 7개 · 데몬 자동 시작 | 있음 (5) |
| `classmate-core setup --key-file <경로>` | 파일의 키(`keyId.secret`)를 검사 → `/workspaces/me` 확인 → 자격 증명 관리자 저장 | 있음 (3) |
| `classmate-core setup --check` | 저장된 키로 워크스페이스 · 노트 · 문단 수 확인(비밀값 · 본문 없음) | 있음 (3) |
| `classmate-core setup --delete-key` | 저장된 키 지우기 | 있음 (3) |
| `classmate-core setup` (인자 없음) | 숨김 콘솔 입력 · 캡처 창 선택 · `--claude-desktop` 설정 병합 | 커밋 (6) |
| `classmate-core doctor` | 연결 · 키 있음/없음 · 노트 · 캡처 창 · 표 건수(비밀값 없음) | 커밋 (6) |

지금(커밋 (5))은 MCP 도구와 학습 스킬까지 연결되어 있습니다. 대화형 setup·doctor·Desktop 연결은 (6)에서 이어집니다. 1단계는 이미지 content와 텍스트 도구만 제공하며 인라인 전사 패널·그림 UI는 아직 없습니다.

### MCP 연결과 자동 시험

저장소 루트 `.mcp.json`은 기존 Tiro 항목을 보존하고 `classmate`를 추가합니다. 먼저 `cargo build --release --manifest-path apps/core/Cargo.toml`로 실행 파일을 만들고 Claude Code를 이 저장소에서 새로 시작해 MCP 연결을 승인합니다. 초기화 응답이 스킬과 같은 학습 지침을 제공합니다. `/classmate:classmate`를 명시적으로 쓸 때는 `claude --plugin-dir ./plugins/classmate`로 이 저장소 안 플러그인을 로드합니다. 이 플러그인은 아직 마켓플레이스 독립 설치용이 아닙니다.

`node apps/core/scripts/mcp-roundtrip.mjs`는 debug exe를 실제로 실행해 7개 도구·이미지·출력 계약·SQLite 재시작 복원을 검사합니다. 임시 DB, 합성 문단, 16px 캡처를 쓰고 `mcp --no-daemon`으로 Tiro/상주 수집을 시작하지 않습니다. 마지막 인자로 release exe를 주어 동일 검사할 수 있습니다. 테스트 임시 자료는 OS 임시 폴더에 남고 실제 학습 폴더는 읽지 않습니다.

### 데몬 띄우기

```powershell
classmate-core            # 콘솔에 로그가 남는다. 트레이 아이콘 오른쪽 클릭 → 상태 · 지금 붙잡기 · 연속 캡처 · 설정 확인 · 데이터 폴더 · 종료
# Alt+S = 지금 화면 + 직전 60초 전사 + 최근 문답 3개 → moments · 트레이 풍선 "붙잡았어요"
# 종료: 트레이 메뉴 "종료" 또는 콘솔 Ctrl+C. 두 번째 실행은 "이미 실행 중" 으로 바로 끝난다.
```

타임라인은 `timeline.enabled`(기본 켬)일 때 약 1초마다 찍어 dHash 가 `timeline.dhash_threshold`(10/64) 이상 다른 장면만 남깁니다. 찍는 대상은 제목에 `capture.window_title_contains`("Chrome")가 든 가장 큰 창, 없으면 `capture.fallback`("left-half")입니다.

### Tiro 키 넣기

```powershell
# 키를 한 줄로 담은 파일을 만들고(예: 바탕 화면), 별도 PowerShell 창에서:
classmate-core setup --key-file "$env:USERPROFILE\Desktop\tiro-api.txt"
classmate-core setup --check          # 워크스페이스 이름 · 노트 수 · 문단 수
# 저장이 끝나면 키 파일은 지웁니다. 키를 채팅에 붙이지 않습니다.
```

응답 모양이 실측과 다를 때는 `CLASSMATE_TIRO_TRACE=1` 을 켜면 상태 · 경로 · 최상위 열쇠 · 배열 길이만 stderr 로 찍힙니다(본문 · 키 없음).

## 2. 자리

```
%LOCALAPPDATA%\CorthexClassmate\core\        ← 시험용 환경 변수 CLASSMATE_CORE_DIR
├─ core.sqlite                               ← paragraphs · frames · moments · qa_log · segments · status (WAL · busy_timeout 5초)
├─ config.json                               ← 사람이 고쳐도 되는 설정. Tiro 키는 여기 없다
└─ frames\<묶음 id>\fr-<epoch ms>.(webp|jpg|png)
```

- 호스트 0.1.6 의 `sessions\` 와는 다른 폴더입니다(DECISIONS 2026-09-10 (2)·(3)). 그쪽은 읽지도 쓰지도 않습니다.
- Tiro 키는 Windows 자격 증명 관리자(`CorthexClassmate` / `tiro`)에만 둡니다. 채팅에 붙이지 않습니다.
- 오류 문구 · 응답 · 표에 절대 경로(사용자 이름)와 키를 담지 않습니다.

## 3. 소스 지도

```
src/main.rs        진입점 분기(인자 없음 · mcp · setup · doctor · --version)
src/lib.rs         모듈 목록
src/paths.rs       데이터 폴더 · 파일 자리
src/config.rs      config.json (deny_unknown_fields · 없는 칸은 기본값)
src/clock.rs       RFC3339 ↔ epoch ms (native-host 것을 그대로 복사)
src/error.rs       CoreError (경로 · 키 없는 문구)
src/store/         SQLite: mod(열기 · 묶음 · status) · paragraphs · frames(파일 + 보존 정리) · moments · qa
src/tiro/          http(WinHTTP GET) · client(/workspaces · /notes · /paragraphs) · poller(노트 추적 · upsert) · credential(CredRead/WriteW) · fake(시험용 HTTP 스텁)
src/capture/       window(창 찾기 · 폴백 영역) · gdi(PrintWindow → BitBlt) · dhash · encode(WebP→JPEG) · moment(순간 묶기)
src/daemon/        mod(메시지 루프 · 창 프로시저) · single_instance(뮤텍스) · hotkey · tray(Shell_NotifyIconW) · timeline(스레드) · poll(스레드)
src/mcp/           (5) JSON-RPC stdio
src/setup.rs       --key-file · --check · --delete-key (인자 없는 대화형은 (6))
src/doctor.rs      (6)
scripts/           (5) mcp-roundtrip.mjs
```

계약은 `packages/contracts/schemas/core-*.schema.json` 이 정본이고, 저장소 시험이 enum · 툴 이름을 그 JSON 과 맞댑니다.

## 4. 빌드 · 시험

이 크레이트는 `apps/native-host` 와 **다른** Cargo 워크스페이스입니다(`[workspace]` 빈 표). 루트에서:

```bash
cargo build --manifest-path apps/core/Cargo.toml
cargo test  --manifest-path apps/core/Cargo.toml
cargo clippy --manifest-path apps/core/Cargo.toml --all-targets -- -D warnings
cargo fmt   --manifest-path apps/core/Cargo.toml -- --check
```

`pnpm test` 의 `cargo-core` 갈래가 같은 시험을 돌립니다.

### 의존성 규칙 (DECISIONS 2026-09-10 (4))

이 PC 의 툴체인은 `stable-x86_64-pc-windows-gnu` 에 C 컴파일러 · 어셈블러가 없습니다. `raw-dylib` 을 쓰는
`windows-sys 0.61+` · `windows 0.6x` 갈래는 링크되지 않으므로(rustc 가 `dlltool` 을 부르는데 `as` 가 없어 실패)
**tokio · rmcp · reqwest · keyring · rpassword 를 쓰지 않습니다.** 대신:

| 필요 | 쓰는 것 |
|---|---|
| SQLite | `rusqlite =0.30.0` + `winsqlite3`(`build.rs` 가 `System32\winsqlite3.dll` 복사 · native-host 와 같음) |
| 이미지 | `image 0.25` (webp · jpeg · png · 순수 Rust) |
| Win32 | `windows 0.58` (windows-targets 0.52 · 미리 만든 import lib) |
| HTTPS · 자격 증명 · 콘솔 · 트레이 · 단축키 · 캡처 | `windows 0.58` 의 WinHTTP · CredRead/WriteW · SetConsoleMode · Shell_NotifyIconW · RegisterHotKey · GDI |
| MCP | 손으로 쓴 JSON-RPC 2.0 stdio(줄 단위) |

새 의존성을 더할 때는 `cargo tree -i windows-sys` 로 0.61 이상이 들어오지 않는지 봅니다.
