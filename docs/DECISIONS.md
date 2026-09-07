# 결정 기록

## 2026-09-07 — 실사용 후 문단 바로 아래 문답으로 재변경

- 합의 출처: 사용자가 '그냥 전사문 아래에 질문 답변 나오게' 요청함. 아래 0.1.0 상하 분리 결정을 이 요청이 대체한다.
- 질문 시점 전사 식별자로 배치하고 없어진 원문은 별도 보존 영역으로 표시한다. 화면 배치 변경은 저장 기록 삭제가 아니다.
- 속도는 medium 사용자 설정과 실제 완료 지연을 확인한 뒤 계측/점진 표시 개선을 먼저 제안한다. effort와 제공자·모델은 임의 변경하지 않는다.
- Cowork에는 원본 DB가 아닌 특정 세션의 독립 사본을 제공한다. 공개 발행은 별도 검토 단계다.

## 2026-09-07 — 0.1.0 전사/대화 분리와 데이터형 다이어그램

- 합의 출처: 현재 작업에서 사용자가 0.1.0 리빌딩·AI 자동/직접 그림 요청을 승인했고, 위 전사 전용/아래 통합 대화 선택에 ‘응 그래줘’라고 응답했다. 기존 inline 배치의 최신 변경이다.
- 구현: 동작 중인 STT·캡처·호스트를 보존하며 live presentation을 교체한다. 과거 fixture UI는 재생 전용으로 유지한다. 아래 대화는 자동 접기 대신 전체 설명·근거·그림·후속을 보여준다.
- 계약: Answer.diagram과 TutorResponseV2.diagram은 선택적 v1 데이터다. 8종, 2~12 노드/24 관계 이내. 이전 답은 유효하고 잘못된 그림만 제외하여 정상 답을 보존한다. Rust 검사기 식별자 패턴과 TS 경계·V2 저장 변환도 함께 갱신한다. 사용자 승인한 기능의 필수 계약 변경이므로 frozen 해시를 갱신한다.
- 렌더: Mermaid 11.17.2를 로컬 번들로 지연 로드한다. AI는 Mermaid/HTML/JS를 만들지 않는다. 앱이 내부 식별자·문법으로 변환하고 strict 보안 + DOMPurify SVG 정화를 적용한다. 비교표·타임라인은 React 텍스트 템플릿이다. 확대는 native dialog로 키보드 포커스를 가둔다.
- UX: 위/아래 독립 스크롤, 기본 60/40·조절값 기억·대화 넓게. 내 질문 16px/결론 18px/본문 16px, 시각 11px 분리. 질문한 전사와 대화 링크, 선택 해제/새 질문, 여러 줄 입력/한글 조합 보호.
- 범위: 기존 Claude·Tiro 경로 유지. Codex 활성화, 자체 STT, Notion 자동 블로그 발행, 웹 검증 보장은 이번 릴리스에 새로 포함하지 않는다. 소스 비공개·공개 다운로드 전용 저장소 경계 유지.

## 2026-09-07 — 친구 공유는 Windows 프로그램 전용 ZIP

- 결정: 수신자 Windows 확인에 따라 ZIP + 더블클릭 PowerShell 설치 + Chrome 수동 확장 추가를 1차 베타로 제공한다. 개발용 Git clone/install.sh나 서명되지 않은 Setup.exe 포장 대신 실제 필요 조건을 안내한다.
- 범위: 현재 동작하는 Claude CLI만 지원한다고 명시한다. class/exam/meeting 프로필과 전문 영역 정확성 보장은 구별한다. 사용자는 자신의 Tiro·Claude 계정을 사용한다.
- 보호: 개인 데이터/인증 제외, 파일 해시·공개키 ID·제3자 라이선스 검증. 기존 설치/등록 덮어쓰기 거부. 연결 해제는 자료 삭제와 분리한다.
- 검증 경계: 현재 PC의 사용자 등록을 건드리지 않는 격리 설치를 먼저 검증하고, 친구의 새 PC 첫 설치를 별도 실사용 검증으로 남긴다. 자동 업데이트·스토어·공개 GitHub 배포는 별도다.

## 2026-09-07 — 기존 전사 중심 UX 안에서 답의 가독성 개선

- 추가 합의: 사용자의 corthex-design UX/UI 개선 요청. 밝은 종이색/초록 강조·전사 75%·설명 기본 펼침을 유지한다. 화면 전체 확대 대신 인라인 답 제목/본문을 키우고 중첩 테두리 제거·질문과 답 구분·최근 질문 표시를 적용한다.
- 근거 상태: 동일하게 보이는 추론 칩만 하나로 합친다. 서로 다른 이유와 확인된 출처/지연은 유지하며 단순 화면 정리를 근거 검증 기능 개선으로 설명하지 않는다.
- 완료 행동: 320/380/790px와 큰 글씨에서 읽기, 키보드 질문 전송, 이전 문단 답과 후속 대화 보존을 Chromium에서 확인한다. 블로그·자료 저장 구조는 변경하지 않는다.

## 2026-09-07 — 문단 답 보존을 답 대기 상태에서 분리

- 결정: 새 문단 질문 시 이전 문단 질문의 ID를 완료·대기·실패와 무관하게 carried에 보존한다. 현재 선택만 이동하고, 기존 인라인 상세와 질문별 후속 대화 구조를 사용한다.
- 이유: 대기 질문만 남기던 조건 때문에 완료 답을 읽은 후 다음 질문으로 넘어가면 기존 설명이 사라졌다. 기록 화면으로 이동시키는 대안은 사용자가 수업 문단 옆에서 공부하는 흐름을 끊으므로 채택하지 않는다.
- 확인: 수정 전 회귀 실패, 수정 후 같은 문단 반복·실패 보존·지연 응답 단위 검사 및 완료 답 2개/후속 대화 공존 Chromium 검사 통과. 새 저장 체계나 원본 수업 DB 변경 없이 0.0.6으로 반영한다.

## 2026-09-06 — 상세 기능을 전사 옆으로 통합하고 전사 비중을 75%로 조정

- 결정: 사용자 요청에 따라 라이브 전사 카드에 기존 상세 화면 기능을 직접 표시한다. 설명 섹션은 기본 펼침이며 개별 접기는 가능하다. 기록·재생용 독립 상세 화면은 유지한다. 아래 대화 기본 비율은 앞선 60% 결정 대신 25%로 변경하고 조절 기능은 유지한다.
- 근거: 사용자는 기록보다 그 자리의 문답을 활용한다. 현재 선택 카드에만 상세 이동 콜백을 연결하고 이전 카드에는 연결하지 않은 렌더링 차이 때문에 자세히 보기 노출이 일관되지 않았다. 이는 AI가 답의 중요도를 판단한 결과가 아니다.
- 대안: 별도 상세 화면으로 이동하는 기존 방식 대신 동일한 상세 컴포넌트를 인라인으로 재사용해 후속 질문·입력·근거 표시를 유지한다. 이전 카드도 원래 질문 ID로 이어 묻는다.


## 2026-09-06 — 라이브 대화를 주 학습 화면으로 사용한다

- 결정: 사용자 실사용 피드백에 따라 대화창에서 첫 줄과 상세 설명을 함께 표시하고 대화 영역을 기본 60%로 넓힌다. 기록은 기존 로컬 자동 저장을 유지하며 설명을 읽기 위해 기록 화면으로 이동하도록 요구하지 않는다. 이 결정은 v0.2 킥오프의 짧은 답 중심 표현을 보완한다.
- 근거: 첫 줄 40자만 표시하고 상세 본문을 숨겼으며, 다음 질문에 과거 문답을 전달하지 않아 지시어 질문이 최신 전사 주제로 바뀌었다. 중학생 수준의 쉬운 설명, 용어 풀이, 구체적 예, 충분한 이유 설명을 공통 튜터 프롬프트에 지정한다.
- 대안: CLI 프로세스의 암묵적인 대화 기억 대신 로컬 SQLite의 최근 완성 문답 최대 6개·12,000자(한 답 최대 6,000자)를 전달한다. 현재 질문 이전 사건만 읽어 재시도 시 미래 답 유입을 막고 교시별 DB로 범위를 제한한다. 오래된 대화 자동 요약은 구현하지 않았으며 전체 하루 기억으로 표시하지 않는다. 기존 40자 `conclusion` 계약은 첫 줄 호환용으로 유지하고 `details.why` 전체를 표시한다.

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
- 결정: 샘플링 간격을 정하는 곳은 `src/capture/sampling-loop.ts` 한 곳(파이프라인의 간격 필터 제거). 회차는 `setInterval` 이 아니라 앞 회차가 끝난 뒤 재예약하고, 겹침 시도는 큐에 쌓지 않고 `skippedWhileBusy` 로 센다. `FrameStore` 의 기록 타입은 `import type { ScreenFrame } from '@classmate/contracts'` + `{ bytes, mime }` 확장이고 `toScreenFrame()` 이 계약 검증기를 통과한다. 서비스 워커 콘솔에서 `runtime.sendMessage` 로 자기 자신을 부르는 손 시험 절차는 문서에서 지우고, 대신 background 에 `globalThis.classmateCapture = { start, stop, currentPeriodId }` 손잡이를 둔다. 당시 제거 계획은 2026-09-04 U-35에서 폐기했습니다. `chrome.action.onClicked`는 수업 탭 지정·`activeTab` 부여·패널 열기의 제품 입구로 유지하고, 연속 캡처 제어 UI를 실제 채택할 때만 `globalThis.classmateCapture` 제거를 검토합니다.
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

## 2026-09-03 — 사이드패널의 첫 데이터 소스는 fixture 재생기(`ReplayStore`), 점선 낱말은 fixture 에 답이 있는 것만, 모의 제공자는 문장을 지어내지 않는다 (/goal 3 · Phase 2 수직 슬라이스)

- 결정: (1) 사이드패널은 tutor-core 상태기계를 fixture 사건(`session-events.jsonl` 27줄)과 사용자 손짓(낱말·문장 붙잡기 · 짐작 고르기 · 칩 · 자세히 · 돌아가기 · 펴기)으로만 굴리는 `ReplayStore` 를 첫 데이터 소스로 갖는다. 실제 커넥터는 2라운드에서 같은 `pushEvent` 자리에 꽂는다. (2) `?replay=manual` 은 1초 시계를 끄고 `window.classmateReplay.goto(<체크포인트 9종>)` 를 노출해 E2E 가 장면을 결정적으로 고른다. 체크포인트 시각은 fixture 사건에서 유도한다(첫 질문 −2초, answer.completed +1초 …). (3) 점선 낱말(`GOLDEN_TERMS`)은 fixture 에 답이 있는 `new` · `생성자` 둘뿐이고, 모의 제공자는 fixture 의 답을 돌려주거나 `answer.failed` 를 내며 문장을 만들지 않는다. (4) 디자인 Evidence 이름(verified/partial/inferred/delayed)과 계약 EvidenceLevel(confirmed/partial/inferred/stale)의 대응은 `src/panel/evidence.ts` 한 곳에만 둔다. (5) 화면 분기는 TutorState 가 아니라 `note` 축(none/preparing/minimal/waiting/detail/folded)이고, Alt+S 는 `e.code === "KeyS"` 로 듣는다. (6) 스크린샷은 `animations: 'disabled'` 로 찍는다 — `.cm-tf__ln` · `.cm-ans` 의 `cm-fade-in` 도중에 찍으면 `toBeVisible` 은 통과해도 빈 화면이 남는다.
- 근거: /goal (3) 은 "fixtures 만으로" 재현을 요구한다. 실제 Tiro · Meet · IntelliJ 는 사람 손이 필요해 BLOCKED 이므로, 같은 계약 이벤트를 fixture 에서 흘려 넣는 재생기가 유일한 결정적 경로다. 패널 시험 50건 · E2E 10건 통과 · 스크린샷 9장을 눈으로 확인했다. 고정 "지금 · …" 줄이 헤더 아래와 흐름 안에 두 번 보이는 것은 디자인 정본 readme("듣는 중 화면에서는 헤더 아래에도 고정")대로다.
- 대안·보류: 기계는 두 번째 답을 `period.ended`(10:33:14) 에서 접는데 fixture 27번째 줄은 손으로 10:33:09 라고 적혀 있다. 시험은 from·to 만 대조하고 앞 3건만 시각까지 본다. fixture 를 기계 답으로 고칠지는 contracts·fixtures 고정 상태라 보류(TASKS). ui-classmate 의 `internal/base` 복제 교체 · 기록·설정 화면 · 개인정보 문구 · `Classmate Side Panel.dc.html` 나란히 비교 이미지는 2라운드.

## 2026-09-03 — 2라운드 고정 계약: (다) 패널 포트 · (라) 사건 payload 와 id · (마) 확장 ↔ 호스트 튜터 봉투 · (바) 확장 id (/batch 2라운드)

- 결정: (다) 패널과 서비스 워커 사이의 문은 `apps/browser-extension/src/panel/ports.ts` 의 `AskRequest{questionId, provider, kind, word?, question, snapshot}` · `AskPort` · `PanelInbox{pushEvent, pushSegment, pushFrame, pushEditor}` · `PanelOutbox{subscribeEmitted}` · `ReconnectTarget`(tiro-share · meet-tab · intellij-mcp · native-host · provider) 뿐이고, 설정 저장 키는 `classmate.periodNumber · provider · subject · autoFold · altS · answerLength · capture.{transcript,screen,editor}` 이다. (라) 사건 payload 는 fixture 와 같은 모양(`transcript.segment {segmentId, seq, state, segment}` · `question.asked {questionId, kind, word?, question?}` · `answer.completed|recovered {questionId, answerId, evidence, provider, answer}` · `answer.queued`(evidence stale · 기록용) · `answer.failed {questionId, provider, message}` · `connector.status {connector, state, reason?, latencySec?}` · `period.started|ended` · `panel.opened|closed`) 이고, 확장이 만든 사건 id 는 `ev-<periodId>-x<8자리 토큰>-<순번>`, 질문 id 는 `q-<periodId>-x<토큰>-<순번>`, 호스트가 만든 사건은 `ev-<periodId>-<8자리 seq>`, 답은 `ans-<periodId>-<n>`(`-queued` 접미), 호스트가 만드는 `at` 은 언제나 `+09:00` 표기이다. (마) 호스트 이름은 `com.corthex.classmate`, `tutor.ask {periodId, questionId, kind, word?, question?(≤4096 바이트), provider, snapshot}` → 즉시 `tutor.accepted {periodId, questionId}` 또는 네 칸 `error`(reason `question-too-long` · `envelope-invalid` · `malformed-snapshot` · `provider-unavailable`), `tutor.retry {periodId, questionId}` → `tutor.accepted` 또는 `unknown-question`, 파이프라인 사건은 응답이 아니라 자발 push `tutor.event {periodId, event}` 로만 나가고 `tutor.ask` 를 한 번도 안 받은 세션에서는 push 0 이다. 시간은 제공자 45초 · 자동 재시도 5·15·45초 최대 3회 · 패널 워치독 60초. (바) 확장 id 는 `CLASSMATE_EXTENSION_KEY`(base64 DER SPKI)로만 매니페스트 `key` 에 들어가고 파생 id 와 공개키는 `installer/windows/extension-key.json` 에 둔다.
- 근거: 9개 단위가 worktree 에서 서로 못 보는 채로 병렬로 짜야 했으므로, 계약을 문장으로 고정해 워커 프롬프트에 같은 문장을 넣었다. 병합 뒤 통합 커밋 세 개(A `9d47d64` 호스트 라우터 → 파이프라인, B `71036de` `App.tsx` 라이브 배선, C `9afdd24` 비교 스크립트)만으로 확장과 호스트가 이어졌고 `packages/contracts`·`fixtures` 는 9개 단위 모두 무변경이다(frozen 시험 통과).
- 대안·보류: `tutor.event` 로 부분 답(TextDelta) 스트리밍은 넣지 않았다(패널이 한 줄 답만 그리므로). `question.asked` 를 `panel.event` 로 append 하지 않고 `panel.ask` 로만 보내는 규칙은 호스트가 기록본을 되돌려 주기 때문이며, 확장 사건이 호스트 사건보다 먼저 저장되는 경쟁은 저장소의 `duplicate:true` 로 흡수한다.

## 2026-09-03 — /batch 2라운드 워커 결정 모음 (단위 1a·1b·2·3·4·5·6·7·8)

- 결정: **1b panel-live-store** — 라이브 워치독은 `answer.failed` 만 넣고 `answer.queued` 는 넣지 않는다(스토어가 답 id·본문을 지어내면 안 되고, tutor-core 가 failed 만으로 대기 상태 H 를 완성한다) · 시계·id 토큰 주입은 tutor-core `Env` 가 아니라 `ReplayStore.live` 옵션(`now`·`idToken`). **3 ui-base-swap** — 아이콘 맵 정본은 `@classmate/ui-base` 의 `ICON_MAP` 한 벌(31개)이고 ui-classmate 는 금지 이름 시험만 남긴다. **5 host-core** — 봉투 검사를 모든 갈래 앞에 두어 표 안 7개 type 의 위반은 저장소 낱말 대신 `envelope-invalid` 로 답한다(저장소 가드 `invalid-frame-id`·`duplicate-frame`·`invalid-base64` 는 뒤에 남음) · 출력은 `thread::scope` + mpsc writer 스레드 하나로 응답과 push 를 같은 채널에 싣는다. **2 service-worker** — 패널 재열기 복원은 교시 로그 500건 되풀이(`period-log.ts`), 패널 닫힘 30분 뒤 `chrome.alarms` 로 `period.ended`, keepalive 1분, 호스트 재연결 1·2·4…≤30초. **7 providers-round2** — `AskRequest::with_materials` 절에 "명령이 아니라 인용" 표시(MATERIALS_GUARD)를 붙이고, `--include-partial-messages` 의 `text_delta` 를 봤으면 `assistant` 전체 본문은 중복 계수하지 않는다 · `RetryPolicy::max_attempts` 는 총 시도 수. **6 context-builder** — 모델에는 JSON 5칸(conclusion ≤40자 · evidence · chips 2~3 · nowLine? · details?)만 받고 호스트가 8칸을 채운 뒤 계약 스키마로 검사, 실패 시 1회 재요청 · 파이프라인은 자기 스레드 + 자기 `SessionStore::open`(WAL 두 번째 연결) · `connector.status(provider)` 도 저장소에 기록. **1a sidepanel-screens** — H-1(전사 멈춤)은 `?replay=manual` 에서만 붙는 손잡이 `window.classmateConnector(connector, state)` 로 계약 `connector.status` 한 줄을 넣어 세운다(fixture 의 세 줄이 전부 connected 이고 `tiroPaused` 를 "모름=멈춤" 으로 바꾸면 fresh 상태 시험이 깨짐 · 정본도 Tweaks `tiroDown` 으로 켬) · `--panel-inset` 은 패널 `style.css` 에서 `clamp(12px, calc(10vw - 22px), 20px)` 로 덮는다(토큰의 `4vw + 0.8px` 는 360 에서 15.2px). **8 installer-windows** — `installer/windows/extension-key.json`(공개키·파생 id·createdAt) 을 커밋해 어느 PC 에서 묶어도 dev zip 의 id 가 같게 한다(비밀키는 만들지 않음) · Windows 에서 pnpm 은 shell 한 줄로 부른다(Node 24 가 `.cmd` 직접 spawn 을 막음 · 붙는 조각은 전부 파일 상수) · `winsqlite3.dll` 은 dist 에 넣지 않는다(System32 원본을 로더가 찾음). **4 design-compare** — 정본 dc.html 은 `node:http` 정적 서버 + `animations: 'disabled'` + `setInterval(1000)` 가로채기(`__dcTick`) 로 결정적으로 캡처하고, 구현은 e2e 로더를 복사해 `?replay=manual` 로 연다.
- 근거: 각 워커의 최종 보고(`DECISIONS_PROPOSAL` 줄)와 브랜치 `batch-2/<단위>` README. 병합 뒤 main 실측은 WORKLOG 2라운드 항목에 있다.
- 대안·보류: (1b) failed→queued 를 스토어가 만드는 안은 본문을 지어내야 해서 버림. (1a) `tiroPaused` 재정의는 금지 파일 시험(`replay-store.test.ts:34`)이 깨져 버림 · 토큰 `spacing.css` 수정은 소유 밖이라 보류(TASKS). (8) 키 파일을 gitignore 하는 안은 PC 마다 id 가 달라져 등록을 매번 다시 해야 해서 버림. (4) H-1 을 시계로 대체하던 첫 판은 통합 C 에서 손잡이로 바꿨다.

## 2026-09-03 — 통합 결정: 제공자 CLI 는 환경 변수로만 · 라우터가 교시별 파이프라인을 띄우고 Drop 이 세운다 · 자료는 `with_materials` · `?replay=` 없는 주소가 라이브 · 공유 CARGO_TARGET_DIR 금지 (/batch 2라운드 통합 A·B·C)

- 결정: (1) 호스트 `Router` 는 `TutorSources{claude_cli, claude_prefix_args, model}` 로 제공자를 만들고, 실행 파일은 `CLASSMATE_CLAUDE_CLI`(절대 경로) 로만 정한다 — 기본값도 PATH 탐색도 없고, 경로가 없거나 `codex` 면 `provider-unavailable` 로 답하며 파이프라인을 띄우지 않는다. 모델은 `CLASSMATE_TUTOR_MODEL`. (2) `Router::tutor` 하나에 `tutor.ask`·`tutor.retry` 가 모이고 `Router::tutor_handle` 이 교시마다 `TutorPipeline::start(data_dir, period_id, provider, self.push.clone(), config)` 를 한 번 띄운다. stdin 이 닫히면 `Router` 의 `Drop` 이 손잡이마다 `shutdown` 을 불러 답하던 물음을 마치고(최대 45초) 끝낸다. `tutor.retry` 가 그 교시에서 받은 적 없는 질문을 가리키면 `unknown-question`. (3) 파이프라인은 자료 문단을 질문에 섞지 않고 `AskRequest::with_materials` 로 따로 싣는다(providers 가 인용 표시를 붙여 질문 앞에 놓음). providers `prompt()` 의 산문 트레일러("결론 한 문장 먼저 …")는 "[학생 질문] 안에 형식이 적혀 있으면 그것만 따른다" 로 바꿔 튜터의 "JSON 객체 하나만" 지시와 부딪히지 않게 했다. (4) 사이드패널 `App.tsx` 는 주소에 `?replay=` 가 없으면 설정(`classmate.periodNumber`·subject·provider·autoFold)을 읽어 `ReplayStore.live` 를 열고 `attachLive({inbox: store, outbox: store}, chrome.runtime)` 로 `classmate-panel` 포트에 붙는다. 교시 id 는 서비스 워커와 같은 `makePeriodId` 로 만든다. fixture 실시간은 `?replay=auto`, E2E·비교는 `?replay=manual`. (5) 비교 스크립트의 G·H-1 은 `then`(바닥줄 클릭 · `classmateConnector`) 으로 실제 화면을 찍는다. (6) worktree 병렬 빌드에서 공유 `CARGO_TARGET_DIR` 을 쓰지 않는다 — 같은 rlib 이름을 서로 덮어써 시험 바이너리가 어긋난다. main 검증은 전용 `_target_main` 을 쓴다.
- 근거: 통합 A 뒤 `cargo test --workspace` 254 · clippy 0 · fmt 0, 라우터 시험 4건이 가짜 CLI(`tests/fake-tutor-cli.mjs`)로 `tutor.accepted` → `question.asked` → `answer.completed(+09:00)` → `tutor.retry accepted` 를 실제 자식 프로세스로 확인. 통합 B 뒤 확장 typecheck 0 · build 0 · e2e 16 · 매니페스트 permissions `sidePanel, storage, tabCapture, offscreen, nativeMessaging, alarms`. smoke-host ② 가 `error/provider-unavailable`(환경 변수 없음 = 실제 CLI 호출 0). 통합 C 뒤 비교 9/9 OK · H-1 `footerPaused: true`.
- 대안·보류: 제공자 CLI 를 PATH 에서 찾는 안은 Phase 1 비용 사고(실제 CLI 5회 1.25 USD)의 재발 경로라 버렸다. 교시가 바뀌어도 손잡이를 닫지 않는 것(하루 8교시 = 스레드 8개)은 허용하고, 교시 종료 시 닫는 정리는 TASKS 후속. 설정의 "오늘 기록 지우기"(`onClearToday`) 는 호스트 삭제 봉투가 없어 패널 안에서만 닫힌다(TASKS). 실제 Chrome 안 확장 ↔ 호스트 왕복은 레지스트리 등록(사람 확인 `--apply`)이 필요해 '대기'.

## 2026-09-03 — 2라운드 검토 수정에서 굳힌 규칙: 읽는 곳 없는 설정은 잠근다 · 복원 자리는 `storage.session` 하나 · 프레임은 한 통 · 시험·스모크는 CLI 환경을 지운다 · `word` 도 4096 · 끝난 질문의 retry 는 `unknown-question` (/batch 2라운드 검토 후속)

- 결정: (1) 설정 화면에서 저장만 되고 읽는 곳이 없는 스위치(답변 길이 · 붙잡을 때 함께 저장 3칸 · 오늘 기록 지우기)는 배선 전까지 `disabled` 와 까닭 한 줄로 잠근다. 제공자·자동 접기는 `ReplayStore.updateEnv` 로 수업 중 즉시 적용하고, 교시·주제는 패널을 다시 열 때부터(교시 중간에 바꾸면 사건 id 체계가 갈라진다). (2) 답 사건은 `questionId` 가 지금 질문과 다르면 기계에 얹지 않고 기록에만 남긴다. 호스트가 되민 `question.asked` 기록본은 같은 questionId 의 순간을 다시 만들지 않는다. 라이브 자리표시 편집기는 IntelliJ 나이를 세지 않는다. (3) 서비스 워커의 복원 자리는 `chrome.storage.session` 하나(`classmate.periodLog` · `classmate.routerState` = 교시 id·질문 수·화면 장 수·커넥터·`period.started`)이고 `storage.local` 로 물러서지 않는다(불변 원칙 §4-1). 도우미가 꺼져 `tutor.ask` 가 버려질 때만 `question.asked` 를 `event.append` 로 남긴다. 교시 전환 중 겹친 부름은 새 교시를 한 번만 시작한다. (4) 프레임을 들고 있는 자리는 `NativeHostFrameSink` 한 통뿐이고 `frame.store` 봉투는 `resend:false`. 호스트 응답 FIFO 는 모양이 다른 말을 짝짓지 않고 버린다. (5) 호스트 라우터 시험은 `TutorSources::default()` 만 쓰고 `no_real_cli_root` 가드가 `src/router.rs` 까지 훑는다. 설치 스모크는 자식 환경에서 `CLASSMATE_CLAUDE_CLI`·`CLASSMATE_CODEX_CLI` 를 지우고 임시 `CLASSMATE_DATA_DIR`·1999년 교시 id 로 돈다. (6) `tutor.ask` 의 `word` 도 `question` 과 같은 4096바이트 자로 재어 `question-too-long`. 답이 끝난 질문의 `tutor.retry` 는 `unknown-question`. 수동 재시도는 남은 자동 재시도를 소비하지 않는다. 1 MiB 를 넘는 자발 push 한 건은 stderr 한 줄로 버리고 호스트는 계속 산다. 성공 경로의 자식 대기에도 마감을 두고 넘기면 `kill_tree`. (7) transport 의 대조 스크레이퍼는 `handle` 본문만 보고 `//` 줄을 건너뛴다. (8) dev zip 에 key 가 없으면 `package-extension.mjs` 는 실패(exit 1). 비교 스크립트는 정본 전멸도 실패로 센다. 루트 `engines.node` 는 `>=24`.
- 근거: 검토 4명의 발견 65건(높음 10)을 수정 워커 4명이 반박 먼저 시도해 실재 60 · 보류 5 · 반박 0. 높음 중 돈이 걸린 두 건(라우터 시험이 환경의 실제 CLI 경로를 쓰던 것 · 스모크 ② 가 실제 CLI 를 부를 수 있던 것)은 되돌린 채 돌려 `provider-spawn` 까지 가는 것을 실측했다. 각 수정은 되돌리면 실패하는 시험과 함께 들어갔다(확장 411 → 460 · 호스트 254 → 264 · node --test 139). 정본은 `docs/reviews/batch-2-review.md`.
- 대안·보류: 캡처 시작 버튼(사용자 제스처)은 이번 라운드 밖이라 실제 설치본에는 Meet 캡처를 켜는 길이 콘솔 손잡이뿐이다(README 명시 · TASKS). 재시도 간격표 두 벌(`RetryPolicy` 는 끝나면 멈춤 · 파이프라인은 마지막 값 되풀이)의 정본, 워커 스레드가 죽은 뒤 손잡이 재기동, `tutor.accepted` 선행 보장은 계약 변경이라 TASKS 로. `buildFrameStore` 의 `skipped` 결말 절반은 캡처 단위 시험과 함께. 전사 중복 걸름 기억(`seenSegments`)은 스냅숏에 담지 않아 워커 재기동 사이 같은 문단이 한 줄 더 남을 수 있다.

## 2026-09-03 — 실측 단계의 운영 규칙: 세션 스냅샷은 `.kdh-sessions/` · 매시간 루프는 스냅샷+WORKLOG+로컬 커밋 · 서브에이전트는 모델을 명시(sonnet/opus) · 실제 첫 호출은 `ask-once.mjs` 로 사람만 · 대시보드는 생성기로 마일스톤마다 재배포

- 결정: (1) 범용 세션 스냅샷(`kdh-save-session` 의 snapshot.json · handoff.md · events.jsonl)은 이 저장소 안 `.kdh-sessions/corthex-classmate/<스냅샷 id>/` 에 두고 WORKLOG 항목과 같은 커밋으로 남긴다. 스크립트는 학습 저장소(`Study-saltlux-ai-agent-service/scripts`)의 것을 `PYTHONPATH` 로 빌려 쓰되 그 저장소에는 아무것도 쓰지 않는다(§4-11). `--no-verify --no-wiki-capture` 고정. (2) 매시간 루프 한 개가 "스냅샷 → WORKLOG 항목(변경 없으면 heartbeat) → 마일스톤이면 대시보드 재생성·재배포 → 로컬 커밋" 을 한다. push·배포·`--apply`·실제 CLI 는 계속 사람 몫. (3) 서브에이전트·워크플로의 `agent()` 에는 `model` 을 반드시 적는다 — 문서 초안·근거 대조·요약은 `sonnet`, 구현·검토 워커는 `opus`, 세션 모델(fable) 상속 금지. (4) 실제 제공자 첫 호출의 사람용 길은 `installer/windows/ask-once.mjs` 하나다. `--i-accept-cost` 가 없으면 아무것도 띄우지 않고, 교시 id 는 1999-01-02-p1, 저장 폴더는 임시 폴더, `CLASSMATE_CODEX_CLI` 는 지운다. 자동화는 이 파일을 돌리지 않는다. (5) 진행 대시보드는 scratchpad 의 `build_dashboard.py` 가 손 자료(로드맵·파이프라인·사람 항목·논의)와 워커가 저장소에서 뽑아 근거 대조한 절(기능 명세·사용자 여정·화면 지도·워크플로·회고)을 합쳐 만들고, 같은 파일 경로로 재배포해 URL 을 유지한다. 회고의 정본은 `docs/retrospective.md`.
- 근거: 사용자 공통 프롬프트("Dashboard · /loop 1h kdh-save-session + 프로젝트 worklog · 회고 · 하네스화")에서 이미 하던 것(로드맵·진척률·WORKLOG 루프)을 빼고 빠진 것만 더했다. 세션 스냅샷은 scratchpad 의 긴 경로에서 `WinError 206`(MAX_PATH) 이 나 짧은 경로가 필요했고, 학습 저장소는 이 프로젝트에서 읽기 전용이라 이 저장소 안이 유일한 자리다. 대시보드 첫 워크플로가 `model` 생략으로 fable 을 물려받아 사용자가 두 번 지적했다(중단 → 끝난 초안 4개는 파일로 재사용 · 남은 5단계만 sonnet). 실측: 사용자가 `install.mjs --apply` 를 직접 실행해 `reg query` 로 확인했고(10:4x), 사이드패널을 열자 도우미가 `sessions/2026-09-03-p2.sqlite` 를 만들어(10:49) Chrome → 레지스트리 → exe → SQLite 왕복이 실측됐다.
- 대안·보류: 세션 스냅샷을 `$HOME/.kdh/state/sessions`(하네스 기본값)에 두면 저장소 밖이라 다른 PC 로 못 옮긴다. Vercel `design.md` 는 남의 브랜드 셸(워드마크·삼각형·외부 CSS)이라 쓰지 않고 절제·근거 표·초점 하나 원칙만 차용했다. 대시보드 근거 대조에서 요구 원문 §3-7 의 "자세히 화면 맨 아래 자유 텍스트 입력창" 이 구현에 없는 것과 라이브 전사의 점선 낱말 원천이 없는 것이 드러나 TASKS 로 보냈다.

## 2026-09-03 — 「듣는 중 화면에 입력창 없음」(master-prompt §3-7)을 뒤집어 듣는 중 화면 아래에 늘 열린 대화 칸을 둔다 (batch-4 askbar → batch-6 chat)

- 결정: `docs/master-prompt.md:245` 의 "단어를 누르는 것이 곧 질문(문장 누름 = 문장 전체, Alt+S = 마지막 문장). **입력창 없음**" 과 `:252` 의 "텍스트 입력창은 여기(자세히) 맨 아래에만" 두 줄을 뒤집는다. 듣는 중 화면에도 입력창을 두고, 붙잡는 길을 **넷**으로 넓힌다 — 점선 낱말 누름 · 문장 누름 · `Alt+S`(마지막 문장) · 대화 칸에 직접 적기. 낱말·문장 붙잡기는 그대로 두고 없애지 않는다.
- 구현: `5f0c692`(2026-09-03 13:59 · `batch-4/askbar`, 병합 `652f834`)가 듣는 중 화면 맨 아래에 한 줄 입력창을 넣었고, `bf09996`(14:38 · `batch-6/chat`, 병합 `bf35970`)이 그 한 줄을 화면 아래 1/3 의 늘 열린 대화 칸으로 넓히면서 전사와의 경계를 끌 수 있게 했다. 지금 코드는 `apps/browser-extension/src/panel/screens/ListeningScreen.tsx:383`(`placeholder="지금 궁금한 걸 적어요"`) · `:384`(`aria-label="바로 묻기"`) · `:202`(경계 끌기) 이고, 적은 문장은 `onAsk`(`:171`) → `ReplayStore#askTyped`(`replay-store.ts:736`) → `panel.ask` → `tutor.ask` 의 `question` 칸으로 나간다. 두 커밋 모두 `HEAD` 의 조상이다(`git merge-base --is-ancestor`).
- 근거: (1) 물을 길이 붙잡기뿐이면 **전사에 없는 것을 못 묻는다.** 2026-09-03 11:24 실전에서 라이브 짐작이 fixture 문장으로 나가 모델이 "자료에 없다" 고 답했고(WORKLOG 11:32), 화면에만 있는 코드나 선생님이 말하지 않은 낱말은 붙잡을 대상 자체가 없다. (2) **자세히 화면만으로는 첫 질문을 만들 수 없다.** `onDetail` 을 넘기는 자리는 `ListeningScreen.tsx:291` 의 `case "ready"` 하나뿐이라 답이 오기 전에는 「자세히 보기」 단추가 화면에 없다. §3-7 대로면 "먼저 붙잡아 답을 받아야 입력창을 볼 수 있다". (3) 벗어남의 크기를 재 보았다 — 화면 3안 겨루기 판정(WORKLOG 12:51)에서 코드 238/5,414줄(4.4%) · 계약 변경 0건 · 정면으로 어기는 문서 줄은 `master-prompt.md:245`·`:252` **두 줄뿐**이었다. (4) 답을 기다리는 21~25초 동안 화면이 비어 학습자가 9초에 4번 클릭한 실측(WORKLOG 15:15 고장 3)이 있어, 그 자리를 채울 그릇이 어차피 필요했다.
- 대안·보류: (가) §3-7 을 글자 그대로 지키고 붙잡기만 남기기 → 위 (1)(2) 때문에 버렸다. (나) 자세히 화면 입력창(`d83e0d7`)만으로 버티기 → 그 입력창은 §3-7 을 어기지 않는 **이어 묻기** 자리이고 첫 질문 자리가 아니라서 부족했다. (다) 채팅 버블·아바타·"AI가 생각 중" 애니메이션은 §3-7 금지 그대로 두었다 — 대화 칸은 입력 한 줄과 답 줄이지 채팅 UI 가 아니다. 당시 남은 빚이던 정본 렌더(`design/claude-design-export/`)와 `docs/screenshots/` 골든 이미지 갱신은 U-35 `acd21bc`의 13장 재생성과 후속 눈검수로 해소했습니다(`docs/TASKS.md` 「4~7라운드에서 남은 일」).

## 2026-09-04 — 수업 화면은 Meet URL이 아니라 학습자가 아이콘을 누른 탭이며, `activeTab` 기반 질문별 한 장 경로를 기본 제품 경로로 쓴다 (9라운드 U-35)

- 결정: 영상·녹화·LMS 탭에서 확장 아이콘을 누르면 그 탭의 `{tabId, windowId, at}`만 `chrome.storage.session`에 기억하고, 같은 사용자 동작 안에서 사이드패널을 연다. 질문을 붙잡을 때 품질 사다리 60→30에 따라 `captureVisibleTab(windowId)`를 최대 두 번 시도하되, 성공한 프레임은 질문마다 최대 한 장만 저장·봉인한다. `activeTab`은 유지하고 `<all_urls>`와 영구 `host_permissions`는 쓰지 않으며 탭 URL·제목은 읽거나 저장하지 않는다. 사용자 문구는 `수업 화면`으로 일반화한다. 다만 고정 계약과 fixture의 선 위 낱말 `connector/source: "meet-tab"` 및 UI 내부 key `meet`는 이번 라운드에 바꾸지 않는다(`packages/contracts`·`fixtures` 무변경).
- 근거: 제품 요구가 Google Meet 자체가 아니라 선생님이 공유한 영상 화면을 함께 보는 것이므로 Meet URL 자동 탐색은 Drive·YouTube·LMS 녹화에 맞지 않는다. 로컬 확장 빌드 매니페스트에서 `activeTab` 1개, `<all_urls>` 0개, `meet.google.com` 0개를 확인했고, 확장 Vitest 728건·Playwright 18건·ui-base 74건·ui-classmate 78건·typecheck·build가 통과했다(`acd21bc`·경합 보강 `6bb9c43`). Playwright E2E는 확장 사이드패널 문서를 직접 열어 fixture 화면을 검사하므로 Chrome 도구막대 아이콘 클릭·`activeTab` 부여·실제 `captureVisibleTab` 왕복을 검증하지 않는다. Chrome의 `activeTab`은 사용자가 확장 동작을 호출했을 때 탭에 임시 접근을 주고 다른 origin으로 이동하거나 탭을 닫으면 거둔다. `sidePanel.open()`도 사용자 동작 안에서 불러야 하므로 아이콘 클릭 핸들러에서 기다림 없이 호출한다.
- 정확성 한계: `captureVisibleTab`에 `activeTab` 또는 `<all_urls>`가 필요하다는 기술 조건은 Chrome 공식 문서와 Chromium 구현으로 확인했다. 그러나 U-36의 과거 설치판 오류 원문은 채집하지 못했으므로, 2026-09-03 이 PC의 `screen.frame 0`이 특정 Meet 호스트 권한만 둔 탓이었다는 인과는 실측 확정하지 않는다. 이번 권한 제거는 **여러 수업 탭 지원 + 주소 비접근 + 최소 권한**이라는 제품·개인정보 결정이다. `6bb9c43` 기준 빌드를 실제 설치했을 때 `screen.frame ≥ 1`을 남기는지는 U-06′ 사람 실측이 남았다.
- 대안·보류: Meet 호스트 권한을 폴백으로 유지하면 Meet만 특별 취급하고 탭 주소를 읽는 길이 남아 버렸다. `<all_urls>`는 모든 사이트에 지속적인 접근 범위를 만들어 거부했다. 연속 `tabCapture` 파이프라인은 삭제하지 않고 실험용으로 남기되, 한 장으로 학습에 부족하다는 실측이 나오기 전에는 제품 기본값이나 패널 버튼으로 올리지 않는다.

## 2026-09-04 — v0.2는 기존 Classmate를 근거 기반 세션 동반자로 확장하고 V1 호환 어댑터로 옮긴다

- 결정: 저장소와 `Corthex Classmate` 이름을 유지한 채 공통 코어에 `class`, `exam`, `meeting` 프로필을 얹는다. 구현 순서는 (1) 실제 SQLite → 과거 세션 → 근거 포함 HTML, (2) 중립 프로필 + 화면 이해 증명 + `RECALL/EXPLAIN/INSPECT/APPLY/TRANSFER` 다섯 활동, (3) 공식 Codex app-server 제공자다. 기존 `periodId`와 V1 DB·답 계약은 지우거나 일괄 변환하지 않고 `LegacyPeriodAdapter`와 V2 뷰를 추가한다. Tiro는 기본 입력이지만 공통 전사 계약 밖의 한 어댑터로 두고, 공식 증분 API가 확인되기 전까지 현재 DOM 경로를 폴백으로 유지한다. 현재 합의 정본은 `docs/kickoff-v0.2.md`, `docs/kickoff.md`는 v0.1 역사 기록이다.
- 근거: 2026-09-04 실제 PoC에서 전사·질문·화면·Claude 답·SQLite 저장이 이어졌지만 과거 세션 UI, 실제 DB→HTML, 화면 픽셀 이해 증명, 다섯 활동, Codex는 미완성이다. 법무사·세무사·회계사 수험생과 회의 사용 가능성을 원하는 사용자 승인이 있었고, 넓은 제품명을 먼저 만드는 것보다 현재 검증된 한 번의 붙잡기 흐름을 보존하는 편이 위험이 작다.
- 대안: 별도 범용 플랫폼을 새로 시작하기 → 공통화는 깨끗하지만 현재 작동하는 확장·호스트·저장 경로를 중복시키고 공개 데모를 늦춰 보류. 현재 코드에 분야별 if문만 추가하기 → 계약과 UI가 더 굳어져 거부. 기존 DB를 V2로 일괄 마이그레이션하기 → 사용자 실측 기록 손상 위험 때문에 거부.

## 2026-09-05 — 활동은 세션당 한 묶음으로 저장하고 정답은 저장 ACK 뒤에만 공개한다

- 결정: `ActivitySetV2`는 세션 SQLite의 `activity_state` 단일 행에 원자적으로 저장한다. 저장 전 모든 `evidenceRefIds`가 실제 세션의 자료·순간·자산 id인지 확인하고, 확장과 호스트는 `sessionId`뿐 아니라 요청·응답의 활동 묶음 전체가 같을 때만 성공으로 인정한다. 정적 HTML도 최신 시도에 `revealedAt`이 없으면 정답 원문을 생성물에 넣지 않으며, 사용하지 않은 힌트는 `hintLevel` 이후부터 제외한다.
- 근거: 이벤트 표에 활동 상태 전이 여러 종류를 더하면 기존 V1 사건 재생과 장시간 세션 로그가 불필요하게 커진다. 반대로 한 행 전체 교체는 정확히 다섯 카드라는 작은 계약에 맞고 트랜잭션 실패 때 옛 묶음을 보존한다. 닫힌 `<details>` 안에 정답 원문을 미리 넣는 방식은 UI만 가릴 뿐 답 공개 전 시도를 보장하지 못한다. 응답·자기 수정·피드백의 `trim()`은 빈값 검사에만 쓰고 들여쓰기·개행을 포함한 원문을 저장한다. 구현 근거는 호스트 `da3430c`, 확장 브리지 `7cc1e44`, 보고서 공개 게이트 `bc74019`, 원문 보존 `67f38f9`, 다섯 활동 화면 `4f82240`이다.
- 대안·보류: 카드·시도별 관계형 표는 조회 요구가 생기기 전까지 보류한다. 여러 패널의 동시 편집을 위한 `revision/expectedRevision`, AI가 만드는 근거 기반 피드백, 자기 수정과 다음 회상 시각의 실제 UX는 V2-107에서 다룬다.

## 2026-09-05 — 세션 프로필은 첫 시작 사건에 고정하고 설치판은 숫자판과 Git 식별자를 함께 쓴다

- 결정: 설정 키 `classmate.profile`은 `class | exam | meeting`만 허용하고 예전 값·깨진 값은 `class`로 읽는다. 새 세션의 최초 `period.started.payload.profile`이 그 세션의 정본이며, 진행 중 설정 변경이나 두 번째 시작 사건은 프로필·주제·슬롯을 소급 변경하지 않는다. 시험·회의 UI에는 IntelliJ를 필수 자료원처럼 표시하지 않는다. 다음 설치 후보 숫자판은 `0.0.3`, 표시판은 `0.0.3+g<commit>[.dirty]`로 두고 WXT·개발 ZIP·스토어 ZIP이 모두 일치하지 않으면 패키징을 실패시킨다.
- 근거: 같은 SQLite 세션의 의미가 중간에 바뀌면 질문·화면·활동의 도메인 해석이 갈라진다. 또한 이전 설치 폴더는 `0.0.1`, 과거 ZIP과 최신 소스 빌드는 서로 다른 코드인데 모두 `0.0.2`로 보이는 상태가 실측됐다. Chrome은 업데이트용 `version`과 표시용 `version_name`을 구분하며, WXT는 앱 `package.json`의 version을 매니페스트 기본값으로 쓴다. 구현은 프로필 `3e5db4e`, 릴리스 식별 `1f1a70e`, 설정 화면의 현재 manifest 표시 `9a54ecd`다.
- 대안·보류: 타임스탬프만 표시하면 어느 소스 커밋인지 재현하기 어려워 쓰지 않는다. 실제 `C:\\CorthexClassmate\\extension` 교체와 Chrome 재로드는 사람 관문이며 자동화하지 않는다. 설정 화면은 manifest의 `version_name → version → 확인 불가`만 표시하고 이름·URL·설치 경로·Git 환경은 읽지 않는다.

## 2026-09-05 — Codex app-server PoC는 안전 경계가 실제 설치판에서 증명될 때까지 비활성으로 둔다

- 결정: 공식 JSONL 순서(`initialize → initialized → thread/start → turn/start`), 스트리밍, 완료, 취소, 시간 제한과 `localImage` 격리 복사를 가짜 app-server로 구현하되 사용자 라우터에서는 계속 `provider-unavailable`로 둔다. V2-201은 공식 `account/read` 인증 확인 전, V2-202는 제한된 읽기 루트와 전용 설정·환경 격리 전에는 완료로 표시하지 않는다.
- 근거: 이 PC의 설치된 Codex CLI 0.152.0 생성 스키마에서 `readOnly`는 네트워크 차단만 표현하고 허용 읽기 루트를 좁히는 필드가 없다. `approvalPolicy: never`도 도구 실행 금지가 아니라 승인 질문을 하지 않는 정책이며, 부모 `CODEX_HOME`, MCP와 환경 상속도 아직 차단하지 않았다. `item/started` 뒤 위험 도구를 감지해 interrupt하는 것은 결과 저장을 막을 뿐 실행 전 차단 증거가 아니다. 비활성 PoC 커밋은 `b4f9dd1`이다.
- 대안·보류: 지원하지 않는 필드를 보내거나 안전하다고 가정해 Codex 설정을 여는 안은 거부한다. 전용 `CODEX_HOME`과 최소 환경, 설치 버전의 제한 읽기 지원 탐지, 실제 로그인·화면 골든 시험을 통과한 뒤 V2-203에서 활성화한다.

## 2026-09-05 — 독립 보고서는 브라우저를 우회해 호스트가 앱 전용 staging에서 만든다

- 결정: 확장은 `report.generate {sessionId}`만 보내고, Rust 호스트가 실제 SQLite와 JPG를 직접 읽어 `<data-dir>/reports/.part-<exportId>`에서 생성한 뒤 같은 볼륨의 `<exportId>` 폴더로 원자 rename한다. 응답에는 불투명 `exportId`, 상태와 개수만 싣고 전사·질문·절대경로·이미지 바이트·worker stderr는 싣지 않는다. 검증된 `report-ui`는 단일 CommonJS worker로 묶고 설치 패키지에 고정 portable Node 런타임과 버전·SHA-256·라이선스를 포함한다.
- 근거: Native Messaging의 1 MiB 한계 때문에 하루 수업 번들과 JPG를 Chrome으로 왕복시키면 긴 세션에서 실패한다. 호스트에는 이미 실제 SQLite→`SessionBundleV2`와 asset id→실제 파일 해석 경로가 있고, `report-ui`에는 React 텍스트 이스케이프와 출력 파일 경계가 있다. 이를 Rust로 다시 쓰면 템플릿·CSS·안전 검사를 이중 유지해야 한다. Node SEA는 현재 공식 문서상 Active Development이므로 첫 배포 기본값으로 고정하지 않는다.
- 대안·보류: 시스템 PATH의 Node 사용, 실행 중 다운로드, 브라우저가 `outDir`·HTML·바이트를 지정하는 안은 거부한다. SEA 단일 EXE, 임의 위치로 저장, 보고서 목록·삭제·보존 기간은 설치형 경로가 검증된 뒤 다룬다.
