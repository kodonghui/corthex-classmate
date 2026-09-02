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

## 2026-09-02 — `packages/contracts` 를 고정(frozen)하고 Phase 2 1라운드를 잎 패키지 10단위로 나눈다 (Phase 2 준비)
- 결정: (1) 스키마 8종의 SHA-256 을 `packages/contracts/frozen.sha256` 에 스냅샷하고 `test/frozen.test.ts` 가 매 시험마다 맞대어 본다. 계약을 바꿔야 하는 단위는 코드를 고치지 말고 이 파일에 제안(무엇을·왜·대안)을 적고 멈춘다. 승인 뒤에만 `pnpm --filter @classmate/contracts freeze` 로 갱신한다. (2) TS 스켈레톤 5개(`design-tokens`·`ui-base`·`ui-classmate`·`tutor-core`·`report-ui`)를 만들어 `pnpm --filter <pkg> test` 가 지금 exit 0 이게 한다. 단위 간 공유는 contracts 타입(`import type`)과 design-tokens CSS 변수 이름만 — ui-classmate 는 ui-base 를, report-ui 는 design-tokens 패키지를 이번 라운드에 import 하지 않는다. (3) `apps/native-host` 는 루트 패키지 `classmate-host` + 워크스페이스 멤버 `crates/providers`(단위 8)·`crates/transport`(단위 9). session-store(단위 7)는 루트 `src/store` 정리. (4) 단위 5·6(확장 커넥터·캡처)·7·9 는 Phase 1 산출물이 있으므로 "완성·정리" 단위로 다룬다. (5) 교시 세션 번들 = `fixtures/synthetic-class/golden-ioc/` 폴더 그대로(번들 스키마를 새로 만들지 않음). (6) origin 은 `gh repo create` 허락 대기 → 워커는 브랜치 `batch-1/<단위>` 만 남긴다.
- 근거: `/batch` 워커는 서로 다른 worktree 에서 동시에 도므로 공유 파일(계약·`Cargo.toml`·`lib.rs`)을 여럿이 건드리면 합칠 때 깨진다. 스냅샷 시험은 "계약 고정" 을 말이 아니라 실패하는 시험으로 만든다. `cargo test -p <crate>` 완료 조건은 크레이트가 따로 있어야 성립한다. 실측: `pnpm test` 전체 exit 0(contracts 57 · 스켈레톤 5개 12 · browser-extension 87 · spikes 62), `pnpm typecheck` 0, `cargo test --workspace` 43(41+1+1), clippy 0.
- 대안: 계약을 자유롭게 고치게 두기 → 1라운드 중 타입이 흔들려 10개 단위가 서로 어긋난다. native-host 를 크레이트 하나로 두기 → 단위 7·8·9 가 같은 `lib.rs`·`Cargo.toml` 을 고쳐 충돌. 남은 위험: `Cargo.lock` 은 워크스페이스 하나가 공유 → 병합 시 충돌 가능(`cargo update -w` 로 재생성). happy-dom 환경은 전역 `URL` 이 happy-dom 것이라 `fileURLToPath(new URL(…, import.meta.url))` 이 "The URL must be of scheme file" 로 실패 → `dirname(fileURLToPath(import.meta.url))` 을 쓴다(스켈레톤 시험에서 실측, README 에 기록).

## 2026-09-02 — 디자인 정본 적용 기본값: 함정 13개의 판정과 폰트·아이콘·개인정보 문구 (Phase 2 준비)
- 결정: `docs/design-map.md` §7 함정 13개 중 판정이 필요한 것을 이렇게 고정한다 — (4) `--panel-header-h` 48 → **44**; (5) 패널 최소 폭은 앱이 **360** 을 지킨다(토큰 `--panel-min-width: 320px` 값은 이번 라운드에 바꾸지 않음); (7) 오타 `멈췼어요` → **`멈췄어요`**; (8) `new` 결론 문장은 **해요체**(kit 판); (9) 접힘 타이머는 칩 클릭 시 **리셋**(dc 판); (10) Alt+S 는 **`e.code === "KeyS"`**(dc 판); (12) SourceFooter count 는 term 이 있는 순간만(dc 판); (13) Toast `tone="dark"` 는 다크 모드가 아니며 다크 모드는 만들지 않는다. 소스 정본은 `components/**/*.jsx` + `ui_kits/sidepanel/*.jsx` 이고 `_ds_bundle.js`·`_ds/…/readme.md`·`_ds_manifest.json` 은 구버전으로 읽지 않는다. 폰트는 CDN 대신 npm 셀프호스팅(`pretendard`, `@fontsource/ibm-plex-mono`), 아이콘은 `lucide-react`. 개인정보 문구 3칸("이 PC 에 보관해요 / 선택한 AI 제공자로 보내질 수 있어요 / Corthex 서버로는 기본으로 보내지 않아요")은 소스에 없으므로 해요체로 새로 쓰고 사이드패널 설정 화면에 둔다.
- 근거: dc.html 과 ui kit 이 서로 다른 값을 가진 자리는 워커 10명이 각자 고르면 화면이 어긋난다. 해요체는 §3-7 UX 정본의 말투이고, `e.code` 는 한글 입력 상태에서도 S 키를 잡는다. CDN 폰트는 오프라인 수업·MV3 CSP 와 맞지 않는다. 문구 3칸은 §4-(5) 불변 원칙의 표시 의무다.
- 대안: 다크 모드 추가 → 정본에 없음, 범위 밖. 개인정보 문구를 합니다체로 → 정본 말투와 어긋남. 남은 위험: `--panel-min-width` 토큰과 실제 최소 폭이 다른 상태가 남는다(2라운드 사이드패널 단위에서 토큰 수정 여부 재결정).

## 2026-09-02 — `/batch` 1라운드 워커 결정 모음 (단위 1·2·3·4·5·6·9·10)
- 결정: (1) design-tokens — 정본 6 css 는 바이트 동일, 예외는 `--panel-header-h` 44 한 줄뿐. `fonts.css` 는 CDN 대신 npm `pretendard`·`@fontsource/ibm-plex-mono` 의 bare specifier `@import`(폰트 파일은 소비 번들러가 해석). `token-names.snapshot.txt`(196) 는 자동 갱신하지 않고 사람이 고친다. (2) ui-base — 정본 `.d.ts` 가 HTML 속성과 부딪히는 자리(Input·Select 의 `size`)는 `Omit<…, "size">` 로 계약 값을 살린다(공통 규칙). Icon 은 lucide-react 선별 맵, 모르는 이름은 빈 span. 정본에서 `css()` 를 부르는 파일은 21개(Icon 없음). (3) ui-classmate — 1라운드 공유 규칙 때문에 기본 요소 8개를 `src/internal/base` 에 복제하고 2라운드에 barrel 한 줄로 `@classmate/ui-base` 로 교체. Alt+S 는 컴포넌트가 아니라 화면이 듣는다(정본 그대로). (4) tutor-core — TutorState 6값 축 + note 축(none·preparing·minimal·waiting·detail·folded) + provider 축(idle·asking·queued·failed)으로 나눈다. 접힘 후 CAPTURE 복귀. 명세에 없는 사용자 입력 `next` 로 EXIT_RECALL→FEEDBACK→FADE_SUPPORT→DELAYED_CHECK 를 움직인다. fixture 4번째 state.changed(10:33:09, 사람 조작)는 `period.ended`(10:33:14)로 대신 재현한다. (5) report-ui — CLI 는 esbuild 없이 Node 24 타입 스트리핑(`allowImportingTsExtensions` + `./x.ts` import). CSS 만 React 밖에서 잇고 나머지는 전부 React 텍스트 노드. `PeriodBundle` 타입은 패키지 안에 둔다(번들 스키마 없음). (6) tiro — `flush()` 는 id·seq 를 예약해 뒤의 final 이 같은 id 로 덮는다. 약한 경보 `tiro.hint_degraded` 는 계약 밖 커넥터 내부 이벤트(전이당 1회). 교시 번호는 `chrome.storage.local` 의 `classmate.periodNumber`(1~8, 기본 1)를 주입. 관찰기는 `attributes: class` 도 감시한다. (7) meet-capture — Offscreen 은 connectNative 를 못 쓰므로 WebP 바이트를 base64 로 `capture.frame` 에 실어 background 로 넘기고, 1 MiB 가드는 FrameSink 안의 `buildFrameStore` 가 판정한다. (8) transport — 프레이밍은 `src/protocol.rs` 를 크레이트로 복사(루트는 2라운드에 교체). 계약 검증은 `jsonschema` crate 대신 손 검증기(실제 쓰이는 키워드만, 모르는 키워드·정규식·format 은 오류). register-host 는 `--apply` 에서만 쓴다.
- 근거: 각 워커의 최종 보고와 브랜치 `batch-1/<단위>` README. 계약 `packages/contracts` 는 8개 단위 모두 무변경(frozen.sha256 시험 통과). 병합 뒤 main 실측: design-tokens 17 · tutor-core 54 · report-ui 56 · ui-base 65 · ui-classmate 88 · 확장 169 · transport 40+3 · scripts 27 · exe 왕복 hello.
- 대안·보류 제안: tiro — `transcript-segment.schema.json` 의 `source` 열거에 `tiro-mcp` 추가(지금은 MCP/API 스텁이 `tiro-api` 를 공유) → 실측 후 재검토. report-ui — `period-bundle.schema.json` 과 `session-event` payload 의 type 별 판별 유니온을 계약에 → 2라운드에 tutor-core·session-store 와 같은 모양이 필요해지면. ui-base — lucide-react 가 `<title>` 을 path 뒤에 그려 정본과 자식 순서가 다름(접근 이름은 같음) → 첫 자식이어야 하면 iconNode 직접 렌더. tutor-core — `next` 의 실제 트리거(회상 카드 제출 등)는 2라운드 사이드패널에서 정의.

## 2026-09-02 — 프레임 저장은 "파일 먼저 · 표는 한 트랜잭션" 이고, fixture 프레임 경로는 계약 (가) 모양으로 맞춘다 (1라운드 단위 7)
- 결정: `frame.store` 는 검사(id 형식 `^sf-[A-Za-z0-9_-]{1,60}$` · periodId 형식 · path 는 호스트가 id 로 다시 계산해 대조) → `.part` 파일 쓰기 → `rename` → 한 트랜잭션으로 `frames` 행 + `screen.frame` 기록 순서로 한다. 강제 종료 시 짝 없는 파일은 남을 수 있어도 "표에는 있는데 파일이 없는" 프레임은 생기지 않는다. `fixtures/synthetic-class/golden-ioc` 의 프레임은 파일명·`path` 를 `frames/sf-p3-001.webp`·`frames/sf-p3-002.webp` 로 바꿔(A 안) 계약과 맞췄다. 계약 `packages/contracts` 는 무변경.
- 근거: Gate D 결정(확장이 준 문자열을 경로로 쓰지 않음)과 고정 계약 (가). 복구 시험 3회 실측: 41~42장 남음 · 손실 창 5·7·9 ms · 어긋난 짝 0. fixture 를 그대로 두면 호스트가 `frame-path-mismatch` 로 거절하므로 fixture 쪽을 고쳤다(report-ui·tutor-core·contracts 시험 모두 통과: 56·54·57).
- 대안: B(파일명은 두고 path 만 고침) → fixtures 안에서 path 와 실제 파일이 어긋나 버림. C(계약 (가)의 대조를 "frames/ 로 시작하는 .webp" 로 완화) → 단위 6 과 다시 합의해야 하고 경로 검증이 느슨해져 버림.

## 2026-09-02 — 라이브 튜터 제공자는 학생 질문을 argv 가 아니라 stdin 으로만 넘기고, 봉인 본문은 상위 단위가 조립해 넘긴다 (1라운드 단위 8)
- 결정: `classmate-providers` 의 Claude CLI 제공자는 질문·문맥을 **stdin** 으로만 보낸다(`cmd.exe /c` 폴백 경로에서 셸 해석 지점을 없애기 위해; Gate C2 "argv 주입 경계" 위험 항목). 생성자는 CLI 경로를 필수 인자로 받고 기본값·PATH 탐색이 없으며, 시험은 `tests/fake-claude.mjs` 만 띄운다(`tests/no_real_cli.rs` 가 실행 파일 이름 리터럴 부재를 매번 확인). 깨진 JSON 줄은 `{` 로 시작하면 `Protocol` 오류, 아니면 배너로 무시·계수. Codex 는 `NotImplemented` 스텁 + 프로토콜 메모.
- 근거: Phase 1 비용 사고(실제 CLI 5회, 1.25 USD)의 재발 방지가 최우선이고, 지시서의 "인자 하나" 보다 Gate C2 문서의 명시 위험이 우선한다. 실측: cargo 41 tests · 실제 CLI 호출 0회.
- 대안·보류 제안: 계약 `question.snapshot` 은 식별자만 담아 제공자가 보낼 수 있는 것이 "자료 요약 + 질문" 뿐이다. (a) 계약에 봉인 본문 자리를 더한다 → 스냅샷이 커지고 저장·전송 면이 넓어져 비권장. (b) **tutor-core(단위 4)가 봉인 식별자로 본문을 조회해 조립한 문자열을 `AskRequest` 의 본문 칸(materials)으로 넘긴다** → 권장, 2라운드에 확정. 계약은 무변경.

## 2026-09-02 — 병합 뒤 검토는 "검토자 → 반박 검증자" 워크플로로 하고 실재 판정만 고친다 · report-ui 프레임 경로는 id 기준 · Icon 경고는 production 에서만 조용 (1라운드 검토 1파 후속)

- 결정: (1) 배치 병합 뒤 단위별 검토자가 낸 medium 이상 발견은 반박 검증자가 "실재/반박" 을 가르고, 실재만 `batch-1-fix/<단위>` 브랜치에서 고친다. 반박된 건은 고치지 않는다. 낮음은 같은 브랜치에서 싸게 고칠 수 있는 것만 고치고 나머지는 TASKS 후속으로 보낸다. (2) report-ui 의 프레임 링크는 `ref` 문자열이 아니라 `FrameRef{id,path}` 의 id 로 만들고 같은 id 가 두 번 오면 경고한다. (3) `Icon` 의 모르는 이름 경고는 모듈 로드 시점이 아니라 호출 시점에 판정하고 `NODE_ENV === "production"` 일 때만 조용하다(`process` 없는 MV3 에서도 경고가 켜짐). (4) tutor-core 는 `at` 파싱 오류를 삼키지 않고 `MachineError` 로 드러내며, `import type` 강제 시험은 주석과 문장 머리를 구분한다.
- 근거: 1파 검토(에이전트 20)에서 실재 8·반박 7·낮음 28. 반박 7건은 검토자가 시험 파일이나 정본을 덜 읽어 생긴 오판이었고, 실재 8건은 모두 되돌리면 실패하는 시험으로 못 박을 수 있었다. 수정 브랜치 4개(tutor-core 71 · report-ui 74 · ui-base 73 · ui-classmate 96)를 병합해도 계약과 fixtures 는 그대로다.
- 대안·보류: 검토 원문(증거·제안)은 세션 임시 폴더에만 있어 `docs/reviews/batch-1-review.md` 표를 정본으로 남겼다. 반박 판정을 한 명이 아니라 셋의 다수결로 하는 안은 비용 때문에 보류.

## 2026-09-02 — 검토 2파 수정에서 굳힌 규칙: 프레임 id 는 교시·시작시각·순번, 이벤트 id 는 저장소 seq, 오류 응답은 네 칸, 봉투 검증 표에 `frame.store` (1라운드 검토 후속)

- 결정: (1) 확장이 짓는 프레임 id 는 `sf-p<교시>-<캡처 시작 UTC hhmmss>-<3자리 순번>`(예 `sf-p3-103210-001`) 로, 같은 교시에서 재시작해도 호스트의 `duplicate-frame` 에 걸리지 않게 한다. fixture 의 `sf-p3-001` 도 계약 정규식을 통과하므로 fixtures·contracts 는 그대로 둔다. (2) 호스트가 `screen.frame` 이벤트에 붙이는 id 는 `ev-<periodId>-<저장소 seq 8자리>` 로, 프레임 id 와 겹칠 수 없게 하고 같은 트랜잭션에서 이벤트 삽입이 0행이면 프레임 파일까지 되돌린다. (3) 호스트의 모든 `error` 응답은 `{type, message, reason, received}` 네 칸을 항상 문자열로 채운다(`received` 는 모르면 `"unknown"`). `event.ack` 는 id 중복이면 `duplicate: true` 를 싣는다. (4) transport 의 봉투 검증 표는 main.rs 의 요청 type 다섯 개(`ping`·`event.append`·`session.status`·`session.export`·`frame.store`)와 시험으로 대조하고, `frame.store` 는 스키마 밖 두 검사(`bytesBase64` 비어 있지 않음 · `/frame/path == frames/<id>.webp`)를 `ExtraCheck` 로 갖는다. (5) `host-roundtrip.mjs` 는 15초 timeout, `register-host.mjs` 는 `--exe` 존재 검사와 `$CARGO_TARGET_DIR` 우선 탐색. (6) 윤초는 오프셋을 뺀 UTC 23:59:60 만 허용해 ajv-formats 와 같게 한다. (7) Tiro content script 는 `wxt:locationchange` 를 들어 SPA 이동을 따라가고, 커넥터 `stop()` 은 관찰만 멈추고 구독은 남긴다. (8) 캡처 세션은 회차 한 번 실패로 멈추지 않고 5연속 실패에서만 종료한다.
- 근거: 검토 2파(에이전트 26, 반박 검증)에서 실재 13건 — high 2건은 `clock.rs` 의 `&text[17..19]` 바이트 슬라이스가 `at` 값 하나로 호스트를 패닉시키는 문제였고, 나머지는 재시작 시 프레임 id 충돌·이벤트 id 충돌로 기록이 사라지는 문제·확장 판별 타입과 어긋난 오류 모양·봉투 검증 표 누락이었다. 각 수정은 되돌렸을 때 실패하는 시험으로 못 박았다.
- 대안·보류: 프레임 id 유일성은 1초 단위라 같은 초에 두 번 시작하면 겹친다(사람 손짓 뒤에만 시작되므로 실제로 닿지 않음, README 에 명시). `store_failure` 의 reason 은 아직 한국어 문구(고정 낱말 목록은 TASKS 후속). Tiro seq 는 방출 순서라 뒤집힐 수 있고 계약에 index 칸이 없어 세션 스토어의 도착 순 seq 에 맡긴다(README 알려진 한계).
