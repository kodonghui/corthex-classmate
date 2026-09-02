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
