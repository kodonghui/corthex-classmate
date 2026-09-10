# classmate-core — Classmate Core (v0.3 · 1단계 진행 중)

수업 중 **지금 화면 + 방금 들은 말**을 붙잡아 순정 Claude / Codex 앱에 건네는 Windows 상주 프로그램입니다.
정본은 `docs/kickoff-v0.3.md`, 실행 계획은 `docs/plan/core-mvp-handoff.md` 입니다. 이 README 는 크레이트 안내만 적습니다.

## 1. 한 exe, 네 진입점

| 명령 | 하는 일 | 상태 |
|---|---|---|
| `classmate-core` | 트레이 상주 데몬 — Tiro 폴링 · 변화 감지 타임라인 · Alt+S · 보존 정리 | 커밋 (3)(4) |
| `classmate-core mcp` | stdio MCP 서버(앱마다 하나) — 툴 7개 | 커밋 (5) |
| `classmate-core setup` | Tiro 키 입력(숨김) → 자격 증명 관리자 · 캡처 창 선택 · `--claude-desktop` 설정 병합 | 커밋 (6) |
| `classmate-core doctor` | 연결 · 키 있음/없음 · 노트 · 캡처 창 · 표 건수(비밀값 없음) | 커밋 (6) |

지금(커밋 (2))은 골격 · 설정 · SQLite 저장소까지 있고, 데몬 · mcp · setup · doctor 는 "아직 만들지 않았다" 로 끝납니다.

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
src/tiro/          (3) WinHTTP 클라이언트 · 폴러 · 자격 증명
src/capture/       (4) 창 찾기 · GDI · dHash · WebP/JPEG
src/daemon/        (4) 트레이 · 단축키 · 스레드
src/mcp/           (5) JSON-RPC stdio
src/setup.rs · src/doctor.rs   (6)
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
