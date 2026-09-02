# 결정 기록

형식: `## YYYY-MM-DD — 결정 한 줄` 아래에 **결정 / 근거 / 대안** 세 줄. 최신 항목이 아래에 쌓입니다.
kickoff.md 와 master-prompt.md 가 충돌하면 kickoff.md 가 우선하고 여기에 기록합니다.

## 2026-09-02 — 저장소는 로컬 `git init -b main` 으로만 시작하고 원격은 만들지 않는다
- 결정: `C:\Users\elddl\kodonghui_myWs\corthex-classmate` 를 로컬 git 저장소로 초기화. `gh repo create` 는 사용자 허락 전까지 실행하지 않음.
- 근거: master-prompt §7 Phase 0-7 ("사용자가 허락했을 때만"). `gh auth status` 는 kodonghui 로 로그인 성공.
- 대안: 즉시 비공개 원격 생성 → 사용자 확인 없이 외부 서비스에 기록하므로 보류.

## 2026-09-02 — pnpm 은 corepack 대신 `npm install -g pnpm` 으로 설치한다
- 결정: 전역 pnpm 을 npm 으로 설치하고 루트 `package.json` 의 `packageManager` 필드로 버전을 고정.
- 근거: `corepack enable` 이 `C:\Program Files\nodejs` 에 shim 을 쓰지 못해 EPERM (관리자 권한 없음). `corepack prepare` 는 성공했지만 shim 이 없어 `pnpm` 명령이 없음.
- 대안: 관리자 권한으로 corepack enable → 사람이 해야 하므로 보류. `corepack pnpm …` 접두 호출 → 명령 사전이 길어져 채택하지 않음.

## 2026-09-02 — `design/_to_delete/` 는 git 에서 제외하고 삭제는 사용자에게 맡긴다
- 결정: `.gitignore` 에 `design/_to_delete/` 추가. 폴더 자체는 지우지 않음.
- 근거: 원본 zip 2개(약 355KB)는 `design/claude-design-export/` 로 이미 풀려 있어 중복. 파일 삭제는 사용자 확인 후에만.
- 대안: zip 을 커밋 → 바이너리 중복이라 제외.

## 2026-09-02 — `docs/master-prompt.md` 는 이미 있는 v1.3 전체(A 사용 안내 + B 본문)를 그대로 둔다
- 결정: 첫 메시지 본문(B)만 다시 저장하지 않고 기존 파일을 정본으로 유지.
- 근거: master-prompt §0 "이 문서는 docs/master-prompt.md 에 이미 있다(없으면 저장)". 파일이 있고 본문이 첫 메시지와 같음.
- 대안: B 만 남기고 A 를 지움 → 사람용 사용 안내(/goal 조건·/loop 문구)가 유용하므로 유지.

## 2026-09-02 — Rust 는 `stable-x86_64-pc-windows-gnu` 툴체인을 루트 `rust-toolchain.toml` 로 고정한다
- 결정: MSVC 대신 GNU 툴체인(자체 링커 `rust-mingw` 포함)을 쓰고 저장소 루트 `rust-toolchain.toml` 로 고정. Host 는 **Rust** 로 확정(Node 스파이크 불필요).
- 근거: 이 PC 에 Visual Studio Build Tools·Windows SDK 가 없어 MSVC 타깃은 `link.exe` 부재로 링크 실패. `winget install Rustlang.Rustup` 은 설치기 종료 코드 3221225786 로 중단됐지만 rustup 1.29.1 과 msvc 툴체인은 남았고, `rustup toolchain install stable-x86_64-pc-windows-gnu --profile minimal` 이 성공. 스크래치 hello 크레이트가 `cargo build` 2.36초 뒤 실행됨("smoke ok").
- 대안: (1) VS Build Tools 설치 → 수 GB · 관리자 권한 · 사람 필요 → 대기. (2) Node Host 스파이크 → Rust 가 되므로 불필요. 부채: `rusqlite` bundled(C 컴파일)는 gnu 툴체인에 C 컴파일러가 없어 Phase 2 에서 `bundled` 대신 시스템 SQLite 또는 pure-Rust 대안을 검토해야 함.

## 2026-09-02 — Tiro MCP 는 프로젝트 `.mcp.json`(HTTP · OAuth) 에 두고 승인·인증은 사람이 한다
- 결정: `claude mcp add --transport http --scope project tiro https://mcp.tiro.ooo/mcp` 로 등록. API 키 헤더 없음.
- 근거: master-prompt §7 Phase 0-5. `claude mcp list` 결과 `tiro … ⏸ Pending approval` — 프로젝트 범위 MCP 는 대화형 `claude` 시작 시 사용자가 한 번 승인해야 하고, 그 뒤 `/mcp` → tiro → Authenticate 로 OAuth 를 한다. 두 단계 모두 사람.
- 대안: user 범위(`--scope user`) 등록 → 친구 배포 시 저장소에 설정이 안 남으므로 채택하지 않음.

## 2026-09-02 — `.claude/settings.json` 의 `Bash(node *)` 허용을 스크립트 두 개로 좁히고 규칙을 `:*` 접두 형태로도 함께 적는다
- 결정: allow 에서 `Bash(node *)` 를 빼고 `node --check`, `node apps/native-host/scripts/register-host.mjs`, `node packages/contracts/scripts/generate.mjs` 만 허용. `git push`·`rm`·`gh repo create`·`reg add/delete`·`register-host.mjs --apply` 는 ask. deny 는 `Read(**/.env*)`·`Read(**/*.token)`·`Read(.claude/settings.local.json)` 로 넓힘. 각 규칙은 문서 형태 `Bash(cmd:*)` 와 지시서 형태 `Bash(cmd *)` 를 둘 다 둠.
- 근거: 검토자 지적 — `node -e "require('child_process').execSync('git push')"` 는 `Bash(git push …)` ask 규칙을 지나가지 않아 무인 Auto 모드에서 사람 확인을 우회할 수 있음(AGENTS §1 "자동화는 commit 까지"). 접두 규칙의 공식 표기가 `Bash(git push:*)` 라 공백+별표 형태만으로는 매칭이 보장되지 않고, 맨 명령(`git push` 단독)은 어느 형태로도 매칭되지 않아 `Bash(git push)` 를 별도로 추가.
- 대안: 지시서 원문(`Bash(node *)`) 그대로 유지 → 우회 통로가 열려 채택하지 않음. 사용자가 원하면 되돌릴 수 있음. 실제 매칭 여부는 다음 대화형 세션에서 `git push` 를 시도해 ask 가 뜨는지 1회 확인 필요.

## 2026-09-02 — 오류 문구는 §3-5 원문("…계속 저장하고 있어요…")을 그대로 쓴다 (§3-7 금지 동사 '저장'과 충돌)
- 결정: fixtures 와 UI 의 튜터 불통 문구는 master-prompt §3-5 의 "튜터 답변이 잠시 멈췄어요. 수업 기록과 질문 지점은 계속 저장하고 있어요. 연결되면 설명을 완성해 둘게요." 를 글자 그대로 유지.
- 근거: §3-5 가 이 문장을 "오류 문구" 로 지정하고 Gate D 도 "오류 상태 문구는 §3-5 그대로" 라고 못 박음. §3-7 의 금지 동사(저장/제출/전송/질문하기)는 사용자 행동 버튼 문구를 겨냥한 규칙이고, 여기서 '저장' 은 시스템이 기록을 잃지 않았다는 안심 문구임. kickoff.md 에는 이 문구에 대한 규정이 없음.
- 대안: "수업 기록과 질문 지점은 그대로 남아 있어요" 로 바꾸기 → §3-7 에는 맞지만 §3-5 원문을 어김. 디자인 시스템 문구 정본(design/claude-design-export/design-system/readme.md CONTENT FUNDAMENTALS)을 Phase 2 포팅 때 대조해 필요하면 그때 바꾼다.

## 2026-09-02 — 계약 id 접두사 규칙은 fixture 규칙(q-/ans-/ts-/sf-/ec-/ev- + 3자리)으로 통일한다
- 결정: `packages/contracts/schemas/examples` 의 qst-/seg-/frm-/edt-/evt- 4자리 표기를 fixture 규칙으로 바꾸고 contracts README 에 표로 적음.
- 근거: 검토자 지적 — 두 참고 자료의 작명이 갈려 커넥터·저장소 구현자가 기준을 알 수 없음. fixtures 는 파일 간 참조가 많아 바꾸면 위험이 크고, examples 는 파일마다 독립이라 변경 폭이 작음.
- 대안: examples 규칙(4자리)로 fixtures 를 바꾸기 → session-events.jsonl 27줄과 교차 참조를 전부 고쳐야 해 채택하지 않음.

## 2026-09-02 — `TranscriptSegment.seq` 는 1 부터(minimum 1), `Question.anchor.segmentId` 는 필수
- 결정: 스키마 설명("0 부터")과 자료(1 부터)가 어긋나 자료 쪽을 정본으로 삼아 minimum 1. 앵커는 문단 없이 존재할 수 없으므로 segmentId 필수, word 는 선택.
- 근거: 검토자 지적. "단어를 누르는 것이 곧 질문"(§3-7)에서 앵커의 문단은 필수 정보. 0 기반 외부 자료는 현재 없음.
- 대안: 0 기준으로 fixtures·examples 를 다시 매기기 → 변경 폭이 커 채택하지 않음.

## 2026-09-02 — 세션 저장소는 rusqlite + `winsqlite3`(Windows 내장 SQLite) · WAL 로 확정한다
- 결정: `rusqlite = { features = ["winsqlite3"] }` 로 Windows 10/11 이 System32 에 내장한 `winsqlite3.dll` 에 링크한다. `bundled` 기능(C 소스 컴파일)은 쓰지 않는다. build.rs 는 `%SystemRoot%/System32/winsqlite3.dll` **한 파일만** OUT_DIR 로 복사해 그 폴더를 `cargo:rustc-link-search` 로 준다. 저널은 WAL, 교시마다 독립 파일.
- 근거: GNU 툴체인 self-contained 의 `x86_64-w64-mingw32-gcc.exe` 는 링커 전용(GCC-WARNING.txt: "cannot be used for compiling C files")이라 `bundled` 는 빌드 불가. 스크래치 crate 실측: `cargo +stable-x86_64-pc-windows-gnu build` exit 0, 실행 출력 `journal_mode=wal rows=1000 sqlite_version=3.51.1`. System32 전체를 `-L` 로 주면 kernel32 등 다른 DLL 까지 직접 잡혀 빌드 스크립트 링크가 깨지므로 DLL 하나만 복사하는 방식을 택했다. 실행 시 추가 배포 파일이 없다(System32 의 DLL 이 자동 로드).
- 대안: (1) VS Build Tools + MSVC 로 `bundled` → 수 GB 설치·관리자 권한 → 대기 항목. (2) redb 등 pure-Rust KV → 빌드는 가장 쉽지만 지시서 §3 의 "SQLite WAL(rusqlite)" 와 `/batch` 단위(7) 정의에서 벗어나고 SQL 조회·JSONL 내보내기를 직접 구현해야 함. (3) Node `node:sqlite` 호스트 → Host=Rust 결정(위)과 충돌. 부채: MSVC 환경이 생기면 `bundled` 로 바꿔 SQLite 버전을 고정할 수 있다(현재는 Windows 가 주는 버전에 따름).

## 2026-09-02 — Rust 빌드는 짧은 경로에서만 돈다 (Windows MAX_PATH 260자)
- 결정: `cargo` 는 저장소 안(`apps/native-host`, 경로 약 60자)에서 실행한다. 임시 폴더에서 돌려야 하면 `CARGO_TARGET_DIR` 을 60자 이내의 짧은 경로(예: `C:/Users/elddl/AppData/Local/Temp/ccsq`)로 준다. 이 제약을 `docs/spikes/gate-d-recovery.md` 와 native-host README 에 남긴다.
- 근거: 세션 scratchpad 경로가 194자여서 `target/debug/build/<crate>-<hash>/rustcXXXX/linker-arguments` 가 260자를 넘었다. rustc 는 링커 인자가 6KB 를 넘으면 이 파일을 `@파일` 로 넘기는데 MinGW gcc 가 파일을 열지 못해 그 안의 `-fno-use-linker-plugin` 을 못 보고 `'-fuse-linker-plugin', but liblto_plugin.dll not found` 라는 오도된 오류를 냈고, 빌드 스크립트 exe 실행도 `지정된 경로를 찾을 수 없습니다 (os error 3)` 로 실패했다. 같은 인자를 명령줄로 직접 주면 플러그인 검사를 통과했고(`--print link-args` 재실행), 객체 수를 1개로 줄이거나(codegen-units=1) target 을 짧은 경로로 옮기면 정상 빌드됐다. 실측 셸 출력은 이 세션 기록에 있다.
- 대안: (1) Windows 긴 경로 정책(LongPathsEnabled) 켜기 → 관리자 권한·MinGW 바이너리가 지원하지 않음. (2) `codegen-units=1` 을 프로필에 박기 → 빌드가 느려지고 원인을 가리는 우회라 채택하지 않음. 남은 것: `%TEMP%/ccsq` 스크래치 target 폴더(약 7MB×N)는 사용자가 지워도 된다.

## 2026-09-02 — Tiro 기본 커넥터는 2순위(공유 페이지 DOM) 로 확정하고, 1순위(MCP) 는 이유를 던지는 스텁으로 둔다 (Gate A)
- 결정: `apps/browser-extension/src/tiro/` 의 공유 페이지 커넥터(MutationObserver · 클래스 힌트 + 구조 폴백 · 셀렉터 깨짐 감지)를 기본으로 쓴다. MCP 커넥터 `createApiConnector` 는 `start()` 에서 조용히 실패하지 않고 이유를 담아 throw 하는 스텁이다. 진행 중 문단은 `TranscriptSegment` 로 만들지 않고 별도 타입 `TiroPartial`(periodId·index·text·arrivedAt, id·seq 없음) 로 보낸다. 셀렉터 깨짐 유예(기본 30초)는 타이머가 아니라 다음 DOM 변경이 왔을 때 잰다. content script 의 `matches` 는 `https://tiro.ooo/*` 로 넓게 두고 런타임 `isSharePageUrl()` 이 `/s/<id>` 경로만 활성화한다. 제품 코드에서 `@classmate/contracts` 는 **`import type` 만** 쓴다.
- 근거: (a) MCP 가 녹음 중에도 문단을 주는지는 사람의 OAuth 인증 뒤에만 잴 수 있어(BLOCKED) 추측 구현은 버릴 확률이 높다. 진행 중 문단에 임시 id·seq 를 붙이면 세션 기록으로 새어 나가 진짜 순번과 충돌한다. 백그라운드 탭에서 setTimeout 은 스로틀되지만 MutationObserver 알림은 계속 오므로 스캔 시점 측정이 더 정확하고 결정론적이다. Ajv 는 `new Function` 으로 검증기를 만들어 MV3 CSP 에 막히므로 값 import 를 하면 content script 번들이 깨진다. 실측: 단위 시험 28개(패키지 69개) exit 0, typecheck exit 0, 합성 페이지 6초 스모크 사건 17건·본문 유출 0건.
- 대안: MCP 를 기본으로 두고 먼저 구현 → 측정 전. `state:'partial'` 세그먼트를 내기 → 가짜 id·seq 필요. `https://tiro.ooo/*/s/*` 로 매치를 좁히기 → 로케일 없는 경로를 놓칠 수 있음.

## 2026-09-02 — 화면 변화 감지 기본값: dHash 9×8 · 동률 여유 1 · 임계값 10/64 · 1fps · 프레임 통 상한 60분/48 MiB/3600장, 계약 스키마는 바꾸지 않는다 (Gate B)
- 결정: `src/capture/dhash.ts` 는 '왼쪽 칸이 오른쪽보다 1 회색 단계 이상 밝을 때만 1'(HASH_EPSILON=1) 로 비트를 만든다. 변화 판정은 해밍 거리 ≥ 10/64, 샘플링 1000ms. `FrameStore` 는 내부 기록에 bytes·mime 두 칸을 더 갖고 `toScreenFrame()` 이 계약(screen-frame.schema.json) 의 칸만 남긴다. 스키마는 고치지 않는다. 변화 시에만 WebP 폭 1280·품질 0.8 로 인코딩한다.
- 근거: 실측(gate-b-meet.md) — 코드↔슬라이드 거리 25/64, 코드↔다른 배치 30/64, 균일 잡음 ±4~±20 은 여유값 덕에 0(여유값 없을 때 ±4 잡음에서 시험 실패). dHash 1280×720 은 Node 2.76ms / Chromium 2.75ms. WebP 는 글자 빽빽한 장면 66.7 KiB, 잡음 상한 606.8 KiB → 60분·분당 6회 기준 23.4 MiB, 48 MiB 상한은 그 두 배. 계약은 교환 형식이고 바이트 크기는 저장소 메타이므로 스키마에 넣지 않는다(Phase 2 저장소가 필요로 하면 그때 재검토).
- 대안: 임계값을 낮추기 → Meet 타일·자막 같은 국소 움직임에 헛 프레임. 스키마에 bytes·mime 추가 → 계약 변경은 소유자 결정 사항이라 보류. 남은 위험: 실제 Meet 탭 tabCapture(사용자 제스처)·실제 화면 바이트·60분 메모리 곡선은 BLOCKED(사람이 확장을 로드해 측정).

## 2026-09-02 — IntelliJ MCP 는 읽기 전용 허용 목록 · Streamable HTTP 우선 · 토큰은 환경 변수 `INTELLIJ_MCP_TOKEN` 으로만 (Gate C, 모든 스파이크 공통 규칙)
- 결정: 도구 허용/차단 규칙 정본은 `spikes/lib/intellij-readonly.mjs` (이름 패턴, 알 수 없는 도구는 기본 차단, `replace_*`·`create_new_file*`·`execute_terminal_command`·`run_configuration`·`get_terminal_text` 등 차단). 전송은 Streamable HTTP 를 먼저 시도하고 SSE 로 폴백한다. 인증 토큰은 URL 이 아니라 `INTELLIJ_MCP_TOKEN` 환경 변수로만 받아 `Authorization: Bearer` 헤더로 보내고 값은 어디에도 출력하지 않는다. 출력되는 URL 은 `maskUrl()` 로 origin+경로만 남긴다. 이 "토큰은 URL 에 넣지 않고 전용 환경 변수로, 출력 URL 은 가린다" 규칙은 다른 스파이크와 Phase 2 코드에도 같이 적용한다.
- 근거: §4-6(읽기 전용, 셸·패치·쓰기 금지)·§4-2(자격 증명 로그 금지). 검증자가 "해석된 URL 전문을 콘솔에 출력 → URL 에 실린 토큰이 문서·커밋으로 흐를 수 있음" 을 major 로 지적해 고쳤다. 스텁 서버로 initialize 42ms · tools/list 9.1ms · 읽기 도구 호출 5.8ms · 쓰기 도구 호출 0건 확인. 실제 IntelliJ(2025.3.6.1, PID 468) 는 63342 만 열려 있고 64342 는 ECONNREFUSED → BLOCKED(사람: Settings → Tools → MCP Server → Enable).
- 대안: 도구 설명·`annotations.readOnlyHint` 로 판정 → 실제 서버를 봐야 가능(사람이 켠 뒤 허용 목록 재검토). URL 쿼리로 토큰 전달 → 셸 히스토리·로그에 남아 채택하지 않음.

## 2026-09-02 — 세션 저장소 세부: rusqlite `=0.30.0` 고정 · WAL + synchronous=NORMAL · busy_timeout 5s · 교시별 `<data_dir>/<periodId>.sqlite` (Gate D)
- 결정: 위 "rusqlite + winsqlite3" 결정의 세부. `winsqlite3` 기능은 rusqlite 0.30 / libsqlite3-sys 0.27 이 마지막이라(0.31 / 0.28 부터 삭제, 실측) 버전을 `=0.30.0` 으로 고정한다. journal_mode=WAL, synchronous=NORMAL, busy_timeout 5초. 데이터 폴더 기본값 `%LOCALAPPDATA%/CorthexClassmate/sessions/`(환경 변수 `CLASSMATE_DATA_DIR` 로 덮어쓰기). 같은 이벤트 id 재삽입은 무시하고 기존 seq 를 돌려준다(재연결 안전).
- 근거: 강제 종료(TerminateProcess) 뒤 재시작 실측 25회 — integrity_check ok · journal_mode wal 25/25, 손실 창 표본 최대 10ms · 중앙값 4ms(검증자 독립 6회차 최대 11ms), §3-6 기준 "재시작 시 최근 수초 이내" 를 크게 여유 있게 통과. synchronous=NORMAL 은 프로세스 강제 종료에는 안전하고 전원 차단 때만 마지막 트랜잭션을 잃을 수 있다. 골든 27건 append → export_jsonl 27줄 id 순서 동일. 테스트 41개(lib 30 · bin 9 · 통합 2) · clippy 경고 0.
- 대안: rusqlite 최신(0.40) → gnu 툴체인에서 링크 불가. 전원 차단 대비 synchronous=FULL → 커밋마다 fsync 로 느려짐; 필요하면 period.ended 직전 한 번만 FULL 로 올리는 방법을 Phase 2 에서 검토. 부채: MSVC 로 전환하면 `bundled` 로 바꾸고 고정을 푼다.

## 2026-09-02 — 호스트는 "살릴 수 있는 프레임 오류" 에는 error 응답 후 계속 살고, 확장이 준 문자열이 경로가 되는 자리는 좁혀 받고, 오류·로그에 파일 경로를 담지 않는다 (Gate D)
- 결정: `protocol::read_frame` 이 본문을 끝까지 읽은 뒤의 UTF-8·JSON 오류(다음 프레임 경계가 확정됨)는 `{"type":"error","message":"unreadable message","bytes":n}` 로 답하고 계속 산다. 길이 헤더·본문 절단, 상한 초과처럼 경계를 잃는 오류만 종료한다. `periodId` 는 영문·숫자·`-`·`_`·`.` 1~64자만, `session.export` 의 `path` 는 이미 있는 폴더 안의 `.jsonl` 만 받는다(폴더를 새로 만들지 않음). StoreError·stderr 로그는 짧은 이유와 ErrorKind 만 담고 경로는 담지 않는다.
- 근거: TASKS 부채 "serve 가 JSON 파싱 오류에 종료" 해소. §4-7(화면·전사 문장을 명령으로 실행 금지) 경계가 파일 이름·쓰기 대상에서 무너질 수 있어 `../../…` 류 값은 파일을 만들지 않고 error 로 답한다(테스트 `period_ids_that_would_escape_the_folder_are_refused` · `export_refuses_paths_it_should_not_write`). 경로에는 사용자 계정 이름이 들어가므로(§4-2·§4-3) 로그·응답에서 제외.
- 대안: 모든 InvalidData 에서 계속 살기 → 상한 초과는 본문을 읽지 않아 경계를 모름. `path` 를 data_dir 아래로만 제한 → Downloads 로 내보내는 정상 사용을 막음; 더 조여야 하면 Phase 2 결정.

## 2026-09-02 — Tiro 문단 확정 판별은 문단별 2겹(클래스 → 구조)이고, 마지막 문단은 확정 표시가 명시적일 때만 확정한다 (Gate A 검증 후속)
- 결정: `share-parser.ts` 는 문단마다 클래스 힌트를 먼저 보고 없으면 구조 폴백으로 가른다. 마지막 문단은 확정 표시(`font-medium`·`text-tds-fg-subtle`)가 있을 때만 `final`, 아니면 `in_progress` 후보로 둔다. `ParseResult.stateSource` 는 4값 — `class`(두 힌트 모두 관측) / `class-partial`(한 쪽만) / `structure` / `none`. `class-partial` 은 녹음 정지와 클래스 변경을 구분하지 못하는 약한 경보다. `share-observer.stop()` 뒤의 `scanNow()` 는 마지막 결과만 돌려주고 아무것도 내보내지 않는다. 관찰 하네스의 이벤트 공백은 사건 사이만 세고 관찰 시작~첫 사건은 `firstEventAfterMs` 로 분리한다. 확장의 contracts 참조는 `@classmate/contracts` 패키지 import 로 통일한다(제품 코드 `import type` 만).
- 근거: 확정 세그먼트는 취소가 불가능하므로 애매하면 진행 중에 두는 편이 안전하다. 검증자가 지적한 두 결함(진행 힌트 이름만 바뀌어도 `class` 로 보임, 앞 문단에 `font-semibold` 가 붙으면 마지막 문단이 곧바로 `final`)을 `fixtures/tiro/share-page-marker-drift.html` 로 재현하고 고쳤다. 실측: `src/tiro` 테스트 36개 통과, 패키지 87개 통과, typecheck 0.
- 대안: 마지막 문단을 항상 `in_progress` 로 두기 → 정상 확정도 놓침. `class-partial` 에서 즉시 경보 → 정상 종료된 녹음에서도 오경보. 남은 위험: 진행 표시 이름만 바뀌면 교시 마지막 문단이 영영 확정되지 않음 → 교시 종료 시 남은 partial 을 확정으로 넘기는 처리는 Phase 2 세션 저장소 몫(TASKS).

## 2026-09-02 — 캡처 샘플링은 `SamplingLoop` 한 곳에서 "앞 회차 종료 후 재예약" 으로 하고, 계약 타입은 `import type` 으로만 들여온다 (Gate B 검증 후속)
- 결정: 샘플링 간격을 정하는 곳은 `src/capture/sampling-loop.ts` 한 곳(파이프라인의 간격 필터 제거). 회차는 `setInterval` 이 아니라 앞 회차가 끝난 뒤 재예약하고, 겹침 시도는 큐에 쌓지 않고 `skippedWhileBusy` 로 센다. `FrameStore` 의 기록 타입은 `import type { ScreenFrame } from '@classmate/contracts'` + `{ bytes, mime }` 확장이고 `toScreenFrame()` 이 계약 검증기를 통과한다. 서비스 워커 콘솔에서 `runtime.sendMessage` 로 자기 자신을 부르는 손 시험 절차는 문서에서 지우고, 대신 background 에 `globalThis.classmateCapture = { start, stop, currentPeriodId }` 손잡이를 둔다(Phase 2 사이드패널 버튼이 생기면 `chrome.action.onClicked` 갈래와 함께 제거).
- 근거: 타이머 + 파이프라인 이중 필터는 지터로 회차가 통째로 버려져 실효 0.5fps 에 잠길 수 있었고, `setInterval` 은 인코딩이 1초를 넘기면 같은 `OffscreenWebpEncoder` 의 scratch 캔버스를 두 회차가 공유했다. Chrome 은 `runtime.sendMessage` 를 보낸 컨텍스트 자신에게 배달하지 않는다. 값 import 는 Ajv 가 MV3 번들에 섞여 CSP 에 막힌다(빌드 산출물 `background.js`·`offscreen-*.js` 에 ajv 0회 확인). 실측: capture 테스트 42개(패키지 87개) 통과, typecheck 0, build 통과, 실제 인코더 클래스로 4장면 재측정 — 바이트는 이전과 동일(2,960 / 2,730 / 68,282 / 621,396 B), 1920×1080 입력 → 1280×720 출력 확인.
- 대안: 파이프라인이 직접 스케줄 → 브라우저 타이머에 묶여 Node 시험이 어려움. 겹침을 큐에 쌓기 → 지연이 누적됨. 남은 위험: `skippedWhileBusy` 는 설계상 0 이고 실제 Meet 탭 실측은 BLOCKED; `PipelineStats` 모양이 바뀌어(`sampled`·`skippedBySampling` 제거, `loop` 추가) Phase 2 사이드패널은 새 모양 기준.

## 2026-09-02 — 라이브 튜터 Provider 기본값은 Claude CLI(`claude -p … --output-format stream-json`)로 확정한다 — 단, 25자 단문 기준 실측이며 골든 컨텍스트 재측정은 비용 승인 대기 (Gate C2)
- 결정: 기본 Provider = Claude CLI 자식 프로세스. 어댑터 규칙 — (1) Windows 에서는 `claude.cmd` 래퍼를 풀어 실제 진입 파일을 node 로 직접 띄운다(`resolveCmdWrapper`), (2) 타임아웃은 `taskkill /PID <pid> /T /F` 로 프로세스 트리를 끊고 stdout/stderr 스트림을 destroy 한다, (3) `--runs` 는 "실제로 띄운 자식 수" 상한(1..5)이고 중첩 차단(`nesting_block`)은 회차로 세지 않는다, (4) **모든 스파이크 파일은 `import.meta.url === pathToFileURL(process.argv[1]).href` 가 참일 때만 `main()` 을 부른다** — 테스트·검증용 import 가 실제 모델 호출로 이어지지 않게 하는 공통 규칙. Codex 는 app-server 프로토콜(188 메소드) 탐침까지만 확인한 스텁으로 두고 한도 복구 후 측정한다.
- 근거: 실측(2026-09-02, 모델 claude-opus-5[1m], 골든 컨텍스트 미포함 25자 단문) 2세트 10/10 성공 · TTFT p50 6,614ms / 6,787ms · 회차당 0.24~0.30 USD. `.cmd` 래퍼 경유 시 `child.kill()` 이 cmd.exe 만 끝내 `close` 가 오지 않았고, 수정 후 1,500ms 타임아웃에서 1,721~1,845ms 에 정리됨(`spikes/test/provider-claude.test.mjs` 13건, 모의 바이너리). **비용 사고**: 검증 에이전트가 `provider-claude.mjs` 를 import 하는 순간 최상위 `main()` 이 실행되어 실제 `claude` 5회 호출, 승인 없이 1.251323 USD 지출(Claude 실측 누적 2.719340 USD) → (4) 를 공통 규칙으로 올렸다.
- 대안: Codex app-server 기본 → 한도 소진으로 측정 불가. Anthropic API 직접 호출 → 앱이 API 키를 보관해야 하므로 §4-(2) 위반. 남은 위험: 골든 컨텍스트(2,893바이트) 기준 TTFT·비용은 미측정(BLOCKED, 승인 후 18:05 이후 빌드로 5회) · Phase 2 `apps/native-host/providers` 에서 `.cmd` 미해제 폴백 감지와 taskkill 가용성 점검 필요.
