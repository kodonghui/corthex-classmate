# Corthex Classmate — Claude Code 마스터 프롬프트 (v1.3 · 2026-09-02)

> 이 문서는 두 부분입니다.
> **A. 사용 안내** — 사람(고동희)이 Claude Code에 보내기 전에 읽는 부분.
> **B. 본문** — `===== 본문 시작 =====` 아래를 통째로 복사해 Claude Code 첫 메시지로 보냅니다.
>
> 출처: Codex 스레드 `01a05aa0-…`(Classmate 설계·Tiro 검증·킥오프), Codex Sites 세션(UX 랩 4방향),
> 2026-09-02 Claude Code 공식 문서 리서치(CHANGELOG 2.1.258 기준).

---

## A. 사용 안내 (사람이 읽는 부분)

### A-1. 어디서 실행하나

| 항목 | 값 |
|---|---|
| 앱 | Claude 데스크톱 앱 → **Code 탭 → Local(Windows) 세션** (Cowork 탭 아님 — Cowork는 `.claude/`·`.mcp.json`을 읽지 않음) |
| 폴더 | `C:\Users\elddl\kodonghui_myWs\corthex-classmate` (현재 `docs/`·`design/` 만 있고 `.git` 없음) |
| 버전 | 시작 전 `claude --version` ≥ **2.1.255** (Fable 5.1 별칭·/goal 체크인·/workflow-authoring 포함) |
| 모델 | **권장: `/model fable` + `/effort ultracode`** (Fable 5.1 · xhigh + 자동 워크플로우 오케스트레이션). `max` 는 단일 스레드 최고 추론이라 Rust 디버깅 같은 난제 한 건에 `/effort max` 로 잠깐 올렸다가 되돌리는 용도이고, 스캐폴드·스파이크·패키지 병렬 구현이 대부분인 이 작업엔 ultracode 가 맞습니다. Fable 은 크레딧 과금(Opus 5 대비 사용량 2배 소진)이라 첫 턴에 동의 프롬프트를 사람이 눌러 주고, 예산이 걱정되면 `/model opus` + `/effort ultracode`. **서브에이전트(.claude/agents)에는 Fable 을 쓰지 않음**(무인 상태에서 동의 프롬프트가 5분 뒤 만료되며 턴이 멈춤). |
| 권한 | 자리를 비울 거면 **Auto** 모드. Desktop에서는 `/permissions`가 안 되므로 규칙은 `.claude/settings.json`에 파일로 씀(본문 Phase 0에서 Claude가 만듦). |

### A-2. 메시지 보내는 순서 (한 줄에 섞지 말 것)

```
① 본문(B) 전체를 첫 메시지로 붙여넣기
      ↓  Claude가 환경 점검 → 블로커 보고 → Phase 0 진행
② Phase 0 완료 보고를 받으면, 아래 A-4 의 /goal 조건을 **별도 메시지**로
      ↓  이후 Claude가 Met 판정까지 스스로 턴을 이어감
③ (선택) /loop 1h <체크포인트 프롬프트> 를 **별도 메시지**로
④ (선택) Phase 2 준비 완료 보고("계약·스켈레톤·원격 저장소 준비됨")를 받으면
   /batch <패키지별 병렬 구현 지시> 를 **별도 메시지**로 → 계획 승인 → worktree 별 PR
```

- `/batch` 는 git 저장소 + **원격(GitHub)** 이 있어야 PR 을 열 수 있고, 5~30개의 **서로 독립적인 코드 단위**에만 맞습니다. Phase 0(스캐폴드 전)과 Phase 1(스파이크는 코드 변경→PR 이 아님)에는 쓰지 말고, Phase 2·3에서 `packages/contracts` 가 고정된 뒤 tutor-core / session-store / side-panel 화면 / report-ui 처럼 나누어 쓰세요. ultracode 워크플로우와 /batch 는 별개이며 같이 써도 됩니다.

- `/goal … /batch … /loop …` 를 한 줄에 쓰면 뒤쪽이 전부 goal 조건 텍스트가 됩니다.
- `/loop` 프롬프트 안에 넣은 `/goal`·`/clear`·`ultracode`는 실행되지 않고 평문으로 전달됩니다.
- `/goal` 상태는 `/goal`, 판정 이유는 Ctrl+O, 중단은 `/goal clear`.
- `/loop`는 세션이 열려 있을 때만 돌고(최대 30분 지터, 7일 만료), 앱을 닫아도 돌려야 하면 Code 탭 사이드바 **Routines → Local**.

### A-3. Claude Code가 못 하고 사람이 해야 하는 일

1. **Tiro MCP OAuth 로그인** — Claude가 `.mcp.json`에 서버를 넣고 멈추면 `/mcp` → tiro → Authenticate(브라우저 구글 로그인).
2. **Gate A 잔여 실측** — 공유 페이지 스트리밍은 2026-09-02에 이미 확인(본문 §2-3). 남은 것: 다음 녹음 때 **Real-time 모드** 공유 링크를 Claude Code에 주고 (a) MCP `get_note_transcript` 가 녹음 중에도 문단을 주는지, (b) 60분 유지, (c) 발화→화면 지연을 눈으로 1회 확인. 끝나면 링크 회수.
3. **Tiro Max 결제**(월 무제한 · 웹 $29 / iOS 인앱 44,000원) — 무료 300분·노트당 50분 열람 제한으로는 60분 교시 불가.
4. **선생님께 Drive 다운로드 허용 요청** — Codex가 써 둔 문구 그대로 한 가지만 요청.
5. `gh auth login`(GitHub 비공개 저장소 생성 시), IntelliJ 실행·MCP 켜기(Gate C), Chrome Web Store 등록(Phase 4).
6. 마이크 구매 **불필요** — 결정 근거는 본문 §2.
7. 디자인이 바뀌면 `design/claude-design-export/` 를 다시 내려받아 교체(Cowork 세션에서 "DesignSync 로 다시 받아 줘" 또는 Claude Design Export → Download zip).

### A-4. `/goal` 조건 (Phase 0 완료 후 별도 메시지로 전송 · 약 800자, 한도 4,000자)

```
/goal docs/master-prompt.md 의 Phase 0·1·2 완료 조건을 모두 만족한다: (1) corthex-classmate 가 git 저장소이고 AGENTS.md·CLAUDE.md·.mcp.json(tiro)·.claude/agents/·docs/WORKLOG.md 가 커밋되어 있다. (2) docs/spikes/ 에 gate-a-tiro.md, gate-b-meet.md, gate-c-intellij.md, gate-c2-provider.md, gate-d-recovery.md 다섯 파일이 있고 각각 PASS/FAIL/BLOCKED 판정·측정값·재현 명령이 적혀 있다(BLOCKED 는 사람이 할 일이 정확히 적혀 있어야 함). (3) 골든 시나리오 "왜 new로 직접 만들면 안 돼요?" 가 fixtures 만으로 확장 사이드패널에서 CAPTURE→ANSWER_MINIMAL→상세 펼침→수업 복귀→오류/대기/복구 까지 재현되고, `pnpm test` 와 `cargo test` 가 exit 0 이며 docs/screenshots/ 에 각 상태 스크린샷이 있다. (4) 마지막 턴에 `git status --short` 가 비어 있고 WORKLOG 최신 항목에 남은 미결·블로커가 나열되어 있다. 매 턴 끝에 검증 명령을 실제로 실행하고 출력을 그대로 남길 것. 막히면 이유와 대안을 WORKLOG 에 적고 대안을 실행할 것. 사람 결정 항목(Tiro 결제·선생님 Drive 요청·마이크·Web Store·git push·OAuth 로그인)은 실행하지 말고 '대기' 로 표시할 것. 또는 80턴 후 중단.
```

### A-5. (선택) 시간당 체크포인트

```
/loop 1h docs/WORKLOG.md 에 지난 1시간의 실제 변경·검증 결과·위험·다음 행동을 한 항목으로 추가하고 로컬 커밋만 한다. 변경이 없으면 heartbeat 한 줄만 적는다. push·배포·공개 전환은 하지 않는다.
```

Codex 쪽 자동화(`corthex-classmate-hourly-save`, 매 1시간)는 `.git`과 `AGENTS.md`가 생기면 `docs/tutor-agent-worklog.md`에 따로 씁니다. 두 로그는 파일이 다르므로 충돌하지 않습니다.

---

===== 본문 시작 (여기부터 Claude Code 첫 메시지) =====

# Corthex Classmate 구현 지시서

## 0. 세션 규약

- 대화는 **한국어 존댓말**. 답변 맨 위에 결론 블록(동사가 든 한 문장 + 핵심 2~4개). 과정·순서는 ASCII 그림, 비교는 표.
- **첫 턴에 반드시**: `claude --version`, `git --version`, `node --version`, `pnpm --version`, `cargo --version`, `gh auth status`, `uname -s; pwd` 를 실제로 실행하고 결과를 표로 보고한다. 그다음 `docs/kickoff.md`, `docs/research/evidence-based-learning-system.md`, `docs/research/report-source.md` 를 읽는다. 그다음 **블로커 목록을 먼저** 말하고 Phase 0을 시작한다. 사용자가 답하지 않아도 Phase 0은 진행한다.
- 이 세션은 Claude 데스크톱 Code 탭 **Windows 로컬 세션**이다. 셸은 Git Bash. 경로·명령을 말할 때 Windows 기준임을 밝힌다. stdio MCP 서버를 등록할 일이 있으면 `cmd /c npx -y …` 로 감싼다(Tiro는 HTTP라 해당 없음).
- 할 일 관리: 이 모델에서는 TodoWrite/TaskCreate 도구가 기본 비활성이다. 대신 **`docs/TASKS.md`**(체크박스)와 **`docs/WORKLOG.md`**(시간순 항목: 변경·검증 명령과 출력·위험·다음 행동)로 관리한다. 매 Phase 경계와 매 시간마다 WORKLOG 항목을 추가하고 로컬 커밋한다. 향후 세션을 위해 `.claude/settings.json` `env` 에 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` 을 넣어 두되, 현재 세션에는 적용되지 않음을 안다.
- 매 턴 끝에 **검증 명령을 실제로 실행**하고 출력을 그대로 남긴다(`/goal` 평가자는 대화만 보고 판정한다). 도구 실행 없이 말만 하는 턴을 연속으로 만들지 않는다.
- 막히면: 이유 → 대안 → 대안 실행 → WORKLOG 기록. 사람 결정이 필요한 항목은 **'대기'** 로 표시하고 다른 작업으로 넘어간다.
- 자동화(체크포인트·loop)는 **commit까지만**. `git push`·배포·공개 전환·Web Store 업로드는 사용자 확인 후에만.
- 이 문서는 `docs/master-prompt.md` 에 이미 있다(없으면 첫 메시지 본문을 그대로 저장). 이후 결정은 `docs/DECISIONS.md` 에 날짜·결정·근거·대안 순으로 쌓는다.

## 1. 미션

**Corthex Classmate**: Java·Spring 부트캠프 수업 중, 학습자가 막힌 순간을 **한 번의 행동**으로 붙잡고, **한 문장 결론**을 보여 준 뒤 **수업으로 빠르게 돌아가게** 하는 Chrome 사이드패널 AI 튜터. 교시가 끝나면 3분 회상 → 피드백 → 교시별 상세 복습자료 8개 + 하루 허브 1개를 만든다. 성공 기준은 AI와 오래 대화하는 것이 아니라 **선생님 수업으로 빠르게 복귀했는가**다.

사용자(고동희)는 Corthex 창업자이며 본인이 첫 사용자다. 사용감이 괜찮으면 친구에게 배포한다(Windows 설치파일 + Chrome Web Store Unlisted; 친구는 자기 Codex/Claude 로그인만 연결).

## 2. 확정 사실 (바꾸지 말 것 · 근거는 실측)

### 2-1. 교실 환경
- 선생님은 Google Meet로 **화면만** 공유하고 **음성은 Meet에 송출하지 않는다**(교실에서 직접 들림). 별도 프로그램으로 화면+음성을 녹화해 공유 Google Drive에 MP4로 올린다.
- 하루 8교시 × 60분(월 9,600~10,560분). 월 600분급 전사 서비스는 탈락.
- 학습자 PC: Windows 11, RTX 3050 Laptop 4GB, RAM 16GB. Chrome + Google Meet 탭 + IntelliJ가 항상 떠 있다.

### 2-2. 선생님 음성 → **iPhone Tiro Real-time 으로 확정**
- 2026-09-01 교실 실측: iPhone Tiro로 25분 9초 녹음 → 25문단(12:01:18~12:21:03), 원문 6,620자, 문단별 시각 있음, 화자 구분 없음. Codex 판정 **"휴대폰 Tiro로 선생님 목소리를 받는 경로는 합격"**.
- 노트북 내장 마이크 녹화(3:08)는 **-46.4 LUFS**로 너무 작고 화면녹화 프로그램이 임의 종료 → 주력 불가. 노트북 마이크는 **학습자 본인의 누르고-말하기 질문**용으로만 쓴다.
- **마이크 구매 보류.** 필요해지면 블루투스가 아니라 2.4GHz 송신기+USB 수신기(DJI Mic Mini/Mic 3 계열)이지만, "마이크 가격보다 선생님과의 거리가 훨씬 중요"하고 선생님께 송신기를 채울 수 없으므로 iPhone과 실질 차이가 없다.
- Tiro Windows 앱 v4.8.3(`C:\Users\elddl\AppData\Local\tiro-desktop\app-4.8.3\Tiro.exe`)은 시스템 오디오 캡처용 → 선생님 음성이 Meet에 없으므로 **무의미**. iPhone을 Windows 마이크로 연결하지 않는다.
- Tiro 전사 오류 유형(보정 사전 초기값): 애노테이션→언어테이션, MVN→엔브이엔, Gradle→그레이드, 클래스명 음차. 교시 종료 후 Tiro 최종본 + IntelliJ 식별자로 교정한다.
- 휴대폰 새 노트 기본값은 **Offline** → 수업 시작 전 매번 **Real-time** 선택(온보딩 체크리스트에 포함).
- Tiro 요금: 무료 3주 300분(노트당 50분 열람·120분 중단), Lite $7/300분, Pro $13/1,000분, **Max $29 무제한(유일 적합)**.
- Tiro API 이벤트: `note.created`, `note.recording.completed`(일시정지 시), `note.ended`. **문장 단위 실시간 이벤트 없음.** MP4 업로드는 오디오만 전사(화면 분석 없음).

### 2-3. 실시간 전사 연결 우선순위 (Gate A에서 판정)
```
1순위  Tiro 공식 API(MCP get_note_transcript)가 녹음 중 갱신됨 ──▶ API 폴링 사용
2순위  API는 늦지만 공유 페이지 DOM이 갱신됨        ──▶ 확장 content script가 공유 페이지를 읽음
3순위  둘 다 실시간 불가                            ──▶ 임시 실시간 STT + 수업 후 Tiro 최종본으로 교체
        (GPT-Transcribe $0.0045/분≈$48/월, Deepgram Nova-3≈$51/월, GPT-Live-Transcribe≈$179/월)
```
- 로컬 faster-whisper large-v3-turbo CPU int8: 2분 전사에 85초 → 라이브 불가, 사후 처리용. GPU 경로 미검증.
- **2026-09-02 실측(Gate A 부분 합격, 2순위 경로)**: 녹음 중인 공유 페이지(`tiro.ooo/ko/s/<id>`)를 Chrome에서 4분 관찰 — 새로고침 없이 **단어 단위로 스트리밍**(약 0.1초 간격 글자 추가, 중간 인식 결과가 나중에 교정됨), 85초에 552→982자, 새로고침 뒤 90초에 1,151→1,508자. **탭이 hidden 상태에서도 215건 DOM 변경 계속 수신**(단, 백그라운드에서 `setInterval`은 스로틀되므로 폴링 말고 MutationObserver 사용). 최초 로드는 `POST api.tiro.ooo/v1/notes/share/<id>` 1회, 이후 갱신은 별도 실시간 채널(REST 폴링 아님). DOM: `main` 안에 문단 `div.whitespace-pre-wrap` 이 순서대로 쌓이고 **작성 중인 마지막 문단만 `font-semibold`**(확정 문단은 `font-medium text-tds-fg-subtle`) → 확정/진행 중 구분 가능. 녹음 중 공유 페이지에는 **문단 시각이 없음**(종료 후 노트에는 있음) → 확장이 도착 시각을 직접 기록. 따라서 **3순위 STT 폴백은 보류**하고 2순위 커넥터를 기본으로 구현한다.
- **아직 미검증(Gate A 잔여)**: 실제 발화→화면 지연(추정 1~3초, 사람이 눈으로 확인), 60분 연속 유지, 공식 API/MCP `get_note_transcript` 가 녹음 종료 전 문단을 반환하는지(1순위 여부).

### 2-4. Google Drive
- 공유 폴더 `1tlcb5hEW9kxCpPGWKcSquLJfI-_eYEq5`(소유자 owl.ohgiraffers): `01_java_foundation` MP4 76개, `02_database` ~43개, `04_spring_framework` 비어 있음. 모든 MP4 `can_download:false`, Transcript 비활성, Drive Gemini/NotebookLM 접근 불가(403).
- **우회 금지**(캐시·스트림 추출·다운로드 제한 회피 금지). 해결은 선생님께 "뷰어 다운로드 허용" 한 가지만 요청(사람이 함). 허용되면 MP4는 **사후 보강 자료**(Tiro 업로드 전사 + 화면 프레임)로만 쓴다.

### 2-5. AI 경계
- gpt-realtime-2.1: 음성/텍스트/이미지 입력(동영상 불가), 세션 최대 60분. ChatGPT Voice 화면 문맥은 macOS만. Claude Voice는 Code/Cowork 미지원. Meet Media API는 Developer Preview.
- **현재 Codex 사용 한도가 소진된 상태**다. Gate C2와 Phase 2 검증은 **Claude 어댑터(`claude -p`)를 먼저** 통과시키고, Codex app-server 어댑터는 한도가 복구된 뒤 같은 테스트를 재실행한다.

## 3. 확정 결정 (kickoff.md 와 일치해야 함 · 충돌 시 kickoff.md 우선하고 DECISIONS.md 에 기록)

### 3-1. 제품 구조
```
iPhone Tiro (Real-time) ──공유링크/MCP──▶ ┐
Google Meet 탭 ──tabCapture(변화 시 프레임만)─▶ │ Chrome 확장 (MV3, Side Panel 380px · 320~520)
IntelliJ 2025.2+ 공식 MCP (수업 모드 읽기 전용) ─▶ │        │ Native Messaging
                                             └────────▼──────────────
                                              Windows 로컬 도우미 (작은 Rust Host)
                                              ├─ provider-codex (codex app-server, stdio, ChatGPT 로그인)
                                              ├─ provider-claude (claude -p / Agent SDK, 사용자 로그인)
                                              ├─ session-store (SQLite WAL + 화면 WebP)
                                              ├─ context-builder (질문 시점 Tiro+Meet+IntelliJ 봉인)
                                              └─ html-exporter (JSON → React 정적 템플릿, 모델 HTML 직접 실행 금지)
포털 classmate.corthex-hq.com (Cloudflare Workers Static Assets · 설치 안내·선택적 공유) / D1·R2는 후속 선택
UX 시제품: Codex Sites 랩 (참고용) · 저장소: GitHub corthex-classmate (초기 비공개)
```

### 3-2. 기술 스택
| 영역 | 결정 |
|---|---|
| Chrome 확장 | React + TypeScript + **WXT**, Manifest V3, Side Panel API |
| 화면 캡처 | `tabCapture` + Offscreen Document, 지각 해시로 변화 감지 시에만 프레임 저장(전체 영상 저장 금지) |
| Tiro 연결 | 공식 API/MCP 커넥터 + 공유 페이지 커넥터(둘 다 구현, Gate A 결과로 기본값 선택) |
| 로컬 도우미 | **Rust Native Messaging Host**(핵심). `cargo` 툴체인이 없고 설치가 막히면 **Node Host로 스파이크만** 하고 부채로 기록 |
| 저장 | SQLite WAL(rusqlite) + WebP 파일. 교시마다 독립 세션 파일. 8시간 단일 세션 금지 |
| 계약 | `packages/contracts` 의 JSON Schema가 정본 → TS(json-schema-to-typescript)·Rust(typify) 타입 생성 |
| 복습자료 | `packages/report-ui` React 정적 HTML 생성기. 모델은 JSON만 만들고 렌더는 템플릿이 함 |
| 테스트 | Vitest(단위) + Playwright(확장 로드 E2E) + `cargo test` |
| 패키지 | pnpm workspace 모노레포 |

### 3-3. 저장소 구조 (Codex 합의안)
```
corthex-classmate/
├─ apps/
│  ├─ browser-extension/   side-panel · meet-capture · tiro-connectors · service-worker
│  ├─ native-host/         provider-codex · provider-claude · session-store · context-builder · html-exporter
│  ├─ portal/              install · docs · review-viewer   (Phase 4)
│  └─ intellij-context-plugin/   후속 (study_get_live_editor_context)
├─ packages/  contracts · session-schema · tutor-core · report-ui · design-tokens
├─ fixtures/  synthetic-class · tiro · meet
├─ installer/windows
├─ docs/  kickoff.md · master-prompt.md · architecture.md · privacy.md · provider-codex.md · provider-claude.md
│         intellij.md · first-class.md · troubleshooting.md · DECISIONS.md · TASKS.md · WORKLOG.md · spikes/ · screenshots/
├─ SECURITY.md · CONTRIBUTING.md · README.md · AGENTS.md · CLAUDE.md(@AGENTS.md 한 줄)
```

### 3-4. 논리 역할 4개와 상태기계
- **Context Curator**(조용히 전사·화면·코드 문맥 기록) · **Live Tutor**(질문 시점 봉인 → 한 문장 결론) · **Lesson Editor**(교시 종료 후 교정·회상·피드백) · **Artifact Director**(상세 복습자료·허브 생성).
- 앱이 단계를 통제한다(프롬프트 하나에 의존하지 않음):
```
CAPTURE → ANSWER_MINIMAL → EXIT_RECALL → FEEDBACK → FADE_SUPPORT → DELAYED_CHECK
```
- 라이브: 조용한 기록 → "못 들었어요/이해 안 돼요/코드 흐름" 한 번의 행동 → Tiro+Meet+IntelliJ 봉인 → **결론 한 문장** → 상세는 수업 뒤로 → 즉시 복귀.
- 교시 직후 3분: 핵심 한 문장(내 말) · 값/객체 하나 끝까지 추적 · 남은 질문 하나 → AI가 수업 근거와 비교 → 틀린 위치·이유·다음 행동.
- 코드 학습 순서: 결과 보기 → 예측 → 값 추적 → 재배열/빈칸 → 수정 → 디버깅 → 독립 작성 → 다음 날 재현. **Lead-and-Reveal / Trace-and-Predict** 기본. 간격 복습은 1·3·7일 고정이 아니라 정답·소요시간·확신도 불일치·변형 실패·반복 오류로 적응. "매우 확신했지만 틀림"을 최우선 오개념으로.
- 근거 표시 4단계를 색뿐 아니라 문구·형태로 구분: **확인됨 / 일부 확인 / 추론 / 자료 지연**.

### 3-5. 골든 시나리오 (첫 수직 슬라이스)
```
주제  IoC 컨테이너와 의존성 주입
전사  "객체를 직접 new로 만들면 클래스끼리 강하게 묶입니다. 이제 생성 책임을 컨테이너에 맡겨 볼게요."
질문  "왜 new로 직접 만들면 안 돼요?"   시각 10:32:18   파일 OrderService.java
자료  전사 4초 전 · Meet 화면 2초 전 · IntelliJ 1초 전
답    "new 자체가 틀린 것은 아니지만, 객체를 바꾸거나 테스트하기 어려워지기 때문에 생성 책임을 분리합니다."
진행  "선생님은 지금 생성자 주입 코드로 넘어갔어요."
빠른 요청 버튼  방금 내용 · 더 쉽게 · 지금 화면 코드 · 내 코드와 비교 · 왜 필요한데?
오류 문구  "튜터 답변이 잠시 멈췄어요. 수업 기록과 질문 지점은 계속 저장하고 있어요. 연결되면 설명을 완성해 둘게요."
흐름  listening → confused → saved → answer → details → returned  /  error → queued → recovered
```

### 3-6. 합격 기준 (Codex 합의표)
| 항목 | 기준 |
|---|---|
| 친구 최초 설치·연결 | 10분 이내 |
| 다음 교시 시작 | 30초 이내 |
| 빠른 질문 실행 | 클릭 또는 단축키 1회 |
| 첫 결론 표시 | 질문 후 5~10초 |
| Tiro 전사 지연 | 95%가 30초 이내, 초과 시 대체 경로 |
| 질문 후 수업 복귀 | 약 20초 이내 |
| 화면 변경 감지 | 3초 이내 |
| 60분 기록 손실 | 복구 불가 손실 0건 · 재시작 시 최근 수초 이내 |
| 교시 구분 | 8교시 모두 독립 저장 |
| IntelliJ 수업 모드 | 파일 변경·실행 0건 |
| Corthex 서버 기본 전송 | 수업 데이터 0건 |
| 복습자료 | 전체 타임라인 유지 · 한 장 요약은 선택 보기 · 근거 없는 설명은 '추론' 표시 |

### 3-7. UX 기준 — **정본은 Claude Design 디자인 시스템 "단어 잡기"** (`design/claude-design-export/`)
- UX 발산은 끝났고 **"단어 잡기(catch the word)"** 로 수렴됐다. 라이브 패널은 이 모델을 그대로 구현한다:
  ```
  선생님 전사가 패널 아래쪽에서 흐른다(19/31, 최근 4~5문장, 마지막 두 문장만 진한 잉크, 인식된 용어에 점선 밑줄)
    → 단어를 누르는 것이 곧 질문(문장 누름 = 문장 전체, Alt+S = 마지막 문장). 입력창 없음
    → 그 문장 바로 아래 MarginNote: 단어·시각 / 한 문장 결론 / 근거 태그(확인됨·일부 확인·추론·자료 지연) / 칩 2~3개 / "자세히 보기 ▸"
    → 18초 뒤 점선 한 줄로 접히고 기록에 남는다. 전사는 그 아래로 계속 흐르고 NowLine 이 "지금 · …" 을 알린다
    → 문장을 잡았으면 GuessList "혹시 이게 막혔나요?" 2~3개
    → 상태는 맨 아래 SourceFooter 한 줄("전사 4초 전 · Meet 2초 전 · IntelliJ 1초 전 · 기록 1"), 문제 시 호박색(무엇이 멈췄고 무엇이 계속되는지 + 행동 하나), 튜터 불통만 빨강
  ```
- Sites 랩에서 빌려와 디자인 시스템에 이미 반영된 것 3가지(2026-09-02, DesignSync로 적용·시제품 확인 완료): ① 초록 잉크 악센트 + Pretendard, ② **붙잡은 직후(preparing) 메모 첫 줄에 봉인한 세 자료** `● 전사 4초 전 · ● Meet 2초 전 · ● OrderService.java 1초 전`(`SourceStatus compact`) 다음에 "한 줄로 정리하고 있어요", ③ **듣는 중 화면 헤더 바로 아래에 `NowLine variant="plain"` 고정**("지금 · 생성자 주입 코드로 넘어갔어요", now 정보가 있을 때만). 구현 근거: `ui_kits/sidepanel/ListeningScreen.jsx`, `Classmate Side Panel.dc.html`.
- 화면은 셋 + 설정: **듣는 중**(버튼 0개, 채도 블록 0개) · **자세히**(AnswerCard: 결론 + 근거 + 접힌 섹션 왜 그런가요/내 코드와 비교/선생님 화면 코드/선생님이 말한 부분 + 후속 칩, 하단 고정 바에 NowLine 과 유일한 primary 버튼 **"수업으로 돌아가기"**, 텍스트 입력창은 여기 맨 아래에만) · **기록**(MomentRow 를 교시별로, 헤어라인만) · **설정**. 상태 A~H 는 `design-system/prompts/claude-design-prompt.md` 에 정의되어 있고 `project-classmate-side-panel/Classmate Side Panel.dc.html` 이 그 구현 시제품이다.
- **컴포넌트를 새로 그리지 말고 옮긴다**: `design-system/components/**/*.jsx`(React, `core/cm.js` 의 `css()`/`cx()`)와 `tokens/*.css`·`styles.css` 를 `packages/design-tokens` 와 확장 사이드패널로 포팅한다. 제품 컴포넌트: TranscriptFlow · MarginNote · GuessList · NowLine · SourceFooter · CodeCompare · MomentRow · AnswerCard · SourceStatus · StuckButton(전사 없는 모드의 폴백, 기본 화면엔 없음). 기반: Button · IconButton · Icon(Lucide, sparkles/bot/brain 금지) · Chip · Disclosure · CodeBlock · Evidence · StatusDot · Banner · Toast · Tooltip · Tabs · PanelHeader(44px) · Dialog · Card · Input/Select/Checkbox/Radio/Switch. 새 컴포넌트가 필요하면 왜 기존 것으로 안 되는지 한 줄을 DECISIONS.md 에.
- 문구 규칙(CONTENT FUNDAMENTALS): 해요체, 제품 동사는 **붙잡다·접히다·남다·돌아가다**(저장/제출/전송/질문하기 금지), 튜터는 자신을 "저"라고 부르지 않고 사용자를 호칭하지 않음, 느낌표 없음, 메타는 중간점(·), 시각은 `10:32:18`, 결론은 40자 이내 "~예요/~해요", 근거는 모든 주장에, 대기 문구 "한 줄로 정리하고 있어요", 빈 상태 "아직 붙잡은 순간이 없어요".
- 시각 규칙(VISUAL FOUNDATIONS, 2026-09-02 갱신본): 종이색 중립(`--paper-0…5`) + 잉크 텍스트(#1B212A) + 악센트 하나 `--ink-600` **#155D53 (Sites 랩 '수업 핀'의 깊은 초록, 파랑 #335493에서 교체)**, 상태색 초록=라이브·호박=부분·빨강=튜터 불통, 폰트 **Pretendard Variable**(jsDelivr) / IBM Plex Mono, 코드 타입명은 본문 잉크색(키워드 초록과 구분), `word-break: keep-all`, 4px 스페이싱, `--panel-inset` 14/16/20 @ 360/380/520, 모서리 3/4/6/8/12, 그림자는 Dialog/Toast 만, 모션 250ms 이하·바운스/스피너 없음, 포커스 링 2px `--ink-400`. **한 화면에 채도 있는 블록 하나까지, 듣는 중 화면엔 0개.**
- 금지: 채팅 버블·아바타·점 세 개 타이핑·"AI가 생각 중" 애니메이션·사이드바/탭바 내비·카드 격자·보라색·그라데이션·이모지·휴대폰 프레임·4방향 재발산. 8교시 봐도 피곤하지 않게, 한순간 주 행동은 하나, 키보드 포커스 항상 보이게.
- 과거 자료(참고만): Claude Design `explorations/`(01 단어 잡기(채택)·02 되감기·03 내 코드 옆에·04 조용한 불빛)와 Codex Sites 랩(`…\Study-saltlux-ai-agent-service\90_Project\corthex-classmate-ux-lab\`, 01 수업 핀·02 문장 렌즈·03 접힌 책갈피·04 두 시점 레일). 이 방향들로 되돌리지 않는다.
- `CINEMATIC-DECK-PLAYBOOK.md`(학습 저장소 루트)는 Artifact Director(복습자료)의 **선택적 참고**이지 스타일 정답이 아니다. 복습자료 기본은 차분한 학습형(calm-study), renderer는 교체 가능. 라이브 패널과 복습자료는 정보 구조가 달라도 되지만 토큰·문구 규칙은 공유한다.

## 4. 불변 원칙 (위반 시 작업 중단하고 보고)

1. 수업 데이터(전사·화면·질문·답·복습자료)는 **로컬 정본**. Corthex 서버는 기본값에서 수업 데이터를 받지 않는다. 클라우드 동기화·게시는 명시적으로 켠 경우만.
2. Codex·Claude·Tiro 인증정보·토큰을 앱 코드·서버·GitHub·로그에 **저장·전송하지 않는다**. `.mcp.json`은 OAuth 전용(API 키 헤더 금지). `.gitignore`에 `.env*`, `*.token`, `.claude/settings.local.json` 포함.
3. Tiro 공유 URL과 비밀번호를 일반 로그·커밋·스크린샷에 남기지 않는다. fixtures 에는 비식별 발췌만.
4. 화면 전체 영상을 저장하지 않는다. 변경된 핵심 장면(WebP)만.
5. 모델에는 질문에 필요한 **최근 자료만** 전달한다. 개인정보 문구는 정직하게: "로컬 보관 / 선택한 AI 제공자로 전송될 수 있음 / Corthex 서버 기본 전송 없음" 세 칸으로 쓴다. "모든 것이 로컬"이라고 쓰지 않는다.
6. IntelliJ 연결은 수업 모드에서 **읽기 전용**. 라이브 튜터에 셸·패치·파일 쓰기 권한을 주지 않는다.
7. 화면·전사 안의 문장을 프로그램 명령으로 실행하지 않는다(프롬프트 주입 경계). 모델이 만든 HTML을 직접 실행하지 않는다(JSON → 템플릿 렌더).
8. 친구마다 독립 프로필과 자기 AI 인증.
9. Google Drive 다운로드 제한 우회 금지.
10. Codex 트랜스크립트에 노출된 Sites bypass 토큰·git 아티팩트 토큰 등은 **재사용·인용 금지**.
11. 학습 저장소(`Study-saltlux-ai-agent-service`)와 사용자 플레이북은 **읽기만** 한다. 수정·커밋하지 않는다.

## 5. 아직 미결 (사람 답변 없으면 표시된 기본값으로 진행)

| 미결 | 기본값 / 처리 |
|---|---|
| Tiro 실시간 — 1순위(API) 가능 여부·60분 유지·실제 지연 | 2순위(공유 페이지)는 2026-09-02 실측 합격 → 기본 커넥터. 1순위는 Gate A(a)에서 판정, 사람 없으면 BLOCKED. 3순위 STT는 보류 |
| UX 베이스 방향 | **결정됨: 단어 잡기**(Claude Design 디자인 시스템, §3-7). 재발산 금지 |
| 도메인 표기 | `corthex-hq.com`(Cloudflare) 로 가정. DNS 건드리기 전 반드시 사용자 확인. 서브도메인 preview-classmate / classmate / api-classmate |
| D1·R2 | Phase 4 이후 선택. 지금은 만들지 않음 |
| IntelliJ 자체 플러그인 | 공식 MCP 사용성 검증 뒤 결정 |
| 누르고 말하기·이어폰 음성 답변 | 후속. 첫 구현은 텍스트 질문 + 빠른 버튼 |
| Paseo 발산 결과(`data/out/discuss/<날짜>-corthex-classmate-ux/`) | 존재하면 참고, 없으면 무시 |
| 라이선스·공개 여부 | 비공개 PoC → 친구 베타 때 재결정 |

## 6. 참고 자료 (경로 · Windows)

- **`C:\Users\elddl\kodonghui_myWs\corthex-classmate\design\claude-design-export\`** — Claude Design 두 프로젝트의 원본 사본(198개 파일, 2026-09-02 · 초록 잉크/Pretendard/preparing 자료/NowLine 고정 반영본과 동일). `HANDOFF-README.md` 의 읽는 순서를 따른다: `design-system/readme.md` → `SKILL.md` → `styles.css`·`tokens/` → `components/classmate/*.jsx`+`*.prompt.md` → `ui_kits/sidepanel/`(4화면 참고 구현 + `data.jsx` 샘플 데이터) → `project-classmate-side-panel/Classmate Side Panel.dc.html`(상태 A~H 시제품) → `design-system/prompts/claude-design-prompt.md`(그 시제품의 브리프). 원본 링크(브라우저 전용, fetch 금지): 프로젝트 `claude.ai/design/p/0a8a5e6c-8de1-4233-a18a-ef778e0125bd`, 디자인 시스템 `claude.ai/design/p/a7a4530d-ff4f-40af-90a3-324a5a784ac5`. 디자인이 바뀌면 사용자가 Cowork 의 DesignSync 또는 Export→Download zip 으로 다시 내려 이 폴더를 교체한다.
- `C:\Users\elddl\kodonghui_myWs\corthex-classmate\docs\kickoff.md` — 합의 정본(138줄). 참조 스레드 "Design integrated coding study path"(`01a05bb9-9f23-79b3-800d-b9895244151c`)는 Java→MySQL→JDBC 통합 학습 경로 담당이며 **여기서 중복 설계하지 않는다**. 공통 성취 기준: 예측 → 값 하나 추적 → 이유 설명 → 도움 없이 유사 기능 작성 → 다음 날 재현.
- `…\corthex-classmate\docs\research\evidence-based-learning-system.md`(676줄) · `report-source.md`(223줄) — 학습과학 근거.
- `…\Study-saltlux-ai-agent-service\90_Project\corthex-classmate-ux-lab\` — UX 랩(Next.js, `@openai/sites`, shadcn). 배포본 https://corthex-classmate-ux-lab.elddlwkd.chatgpt.site (브라우저 참고용).
- `…\Study-saltlux-ai-agent-service\CINEMATIC-DECK-PLAYBOOK.md`(1,043줄) — 선택적 참고.
- `~\Downloads\Spring_IoC_1일차_통합_복습자료_Codex검수본.md` — 복습자료 형태 예시(NotebookLM 초안의 오류를 Codex가 검수한 판본).
- Notion 수업자료 https://app.notion.com/p/ohgiraffers/1-IoC-Container-87a649136c11836092420147fb30ada9 (Notion MCP가 있으면 읽기, 없으면 생략).
- Tiro 실측 노트: 2026-09-01 "스프링 의존성 설정 및 바닐라 프로젝트 진행" — Tiro MCP 인증 후 `search_notes` → `get_note_transcript` 로 fixtures 원천으로 사용. 공유 링크는 채팅에 있어도 파일에 쓰지 않는다.
- V0 시안 PNG: `C:\Users\elddl\.codex\generated_images\01a05aa0-54ae-7da0-89da-f9dfe2535abb\exec-2c289358-6c61-4e5c-9a68-d35da1b897b4.png`.
- ChatGPT/Codex 공유 링크(`chatgpt.com/s/cx_…`)와 Claude Design 링크는 **로그인 브라우저 전용** — fetch 시도하지 말 것. 필요한 내용은 이 문서에 이미 요약되어 있다.

## 7. 작업 순서

### Phase 0 — 저장소·도구·규약 (첫 턴부터 · 사람 확인 불필요)

1. 환경 점검(§0). 없는 도구는 설치 시도: `winget install OpenJS.NodeJS.LTS`, `corepack enable && corepack prepare pnpm@latest --activate`, `winget install Rustlang.Rustup`(MSVC 빌드 도구가 필요해 막히면 **대기**로 표시하고 Node 스파이크로 진행), `winget install GitHub.cli`.
2. `git init -b main` → `.gitignore`(node, target, .env*, *.token, .claude/settings.local.json, out/, fixtures/**/private/) → `README.md` → `AGENTS.md`(정본: §0·§4 요약 + 명령 사전) → `CLAUDE.md`(내용은 `@AGENTS.md` 한 줄) → `SECURITY.md` → `docs/master-prompt.md`(이 문서) → `docs/DECISIONS.md` · `docs/TASKS.md` · `docs/WORKLOG.md`.
3. `.claude/settings.json`: `permissions.allow` 에 `Bash(pnpm *)`, `Bash(cargo *)`, `Bash(git add *)`, `Bash(git commit *)`, `Bash(node *)`, `Bash(npx playwright *)`; `permissions.ask` 에 `Bash(* git push *)`, `Bash(* rm -rf *)`, `Bash(gh repo create *)`; `permissions.deny` 에 `Read(./.env*)`, `Read(**/*.token)`; `env` 에 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`.
4. `.claude/agents/` 서브에이전트 4개(frontmatter `model:`·`effort:` 는 **별칭만**: `sonnet`/`opus`/`haiku`):
   - `scout` — `model: haiku`, 읽기 전용(Read/Grep/Glob), 코드·문서 위치 찾기.
   - `implementer` — `model: sonnet`, `effort: high`, 한 패키지 단위 구현+테스트.
   - `reviewer` — `model: opus`, `effort: xhigh`, 불변 원칙(§4)·계약 위반·보안 검토, 파일 수정 금지.
   - `researcher` — `model: sonnet`, `effort: high`, WebSearch/WebFetch 로 공식 문서 확인(Chrome/Tiro/JetBrains/OpenAI/Anthropic). 사용 후 `/tasks` 로 모델·effort 를 확인해 보고.
5. Tiro MCP: `.mcp.json` 중복 확인 후 `claude mcp add --transport http --scope project tiro https://mcp.tiro.ooo/mcp`. **OAuth 브라우저 로그인은 사람이 한다** → "`/mcp` → tiro → Authenticate 해 주세요"라고 알리고 **대기**. 인증되면 `auth_status` 도구를 먼저 호출해 스코프를 검증하고, 도구 이름만 지정(`list_notes`, `search_notes`, `get_note`, `get_note_transcript`, `get_share_link`)하며 인자 형식은 런타임 스키마를 따른다.
6. pnpm 워크스페이스 스캐폴드: `apps/browser-extension`(WXT React TS, side panel 빈 화면 + 서비스워커), `apps/native-host`(Rust `hello` Native Messaging Host + Windows 레지스트리 매니페스트 생성 스크립트; cargo 불가 시 `apps/native-host-node` 스파이크), `packages/contracts`(JSON Schema 초안: `TranscriptSegment`, `ScreenFrame`, `EditorContext`, `Question`, `Answer`, `EvidenceLevel`, `SessionEvent`) + 타입 생성 스크립트, `fixtures/`(골든 시나리오 §3-5).
7. 첫 커밋. `gh auth status` 가 성공하고 사용자가 허락했을 때만 `gh repo create corthex-classmate --private`; 아니면 로컬만.

**Phase 0 완료 조건**: `git log` 1개 이상, `pnpm install` 과 `pnpm -r test`(빈 테스트라도) exit 0, `cargo build` exit 0(또는 대기 사유 기록), `.mcp.json` 에 tiro, 위 문서 파일 존재, WORKLOG 첫 항목.

### Phase 1 — 기술 게이트 스파이크 (각각 버리는 코드 · 결과는 `docs/spikes/<gate>.md`)

각 파일은 **판정(PASS/FAIL/BLOCKED) · 측정값 · 재현 명령 · 결정에 미치는 영향 · 사람이 할 일** 순서로 쓴다.

- **Gate A `gate-a-tiro.md` — Tiro 실시간** (§2-3 의 2026-09-02 실측을 먼저 옮겨 적고 시작)
  2순위(공유 페이지 스트리밍)는 이미 합격이므로 **공유 페이지 커넥터를 기본으로 구현**한다: content script 가 `main` 의 문단 div 를 MutationObserver 로 읽고, 확정 문단(`font-medium`)/진행 중 문단(`font-semibold`)을 구분해 도착 시각을 찍어 Native Messaging 으로 보낸다. 클래스명은 바뀔 수 있으므로 **구조 기반 선택자 + 폴백**(마지막 문단 = 진행 중)으로 쓰고, 셀렉터 깨짐을 감지하면 사용자에게 알린다. 남은 측정: (a) MCP 경로 — 녹음 중 `get_note_transcript` 를 10초마다 호출해 녹음 종료 전 문단을 주는지·지연을 CSV 로(1순위 여부 판정); (b) 60분 연속 유지 — Playwright(Chromium)로 공유 URL 을 열고 MutationObserver 이벤트 시각을 1시간 기록(URL은 환경변수로만 받고 로그에 남기지 않음, 백그라운드 스로틀 대비 타이머 대신 이벤트 기반); (c) 발화→화면 지연은 사람이 눈으로 1회 확인. 합격: 지연 30초 이내 95%, 새로고침 불필요, 60분 유지. 사람이 없으면 (a)(c)는 **BLOCKED** + 절차서, 커넥터는 fixtures 로 단위 테스트까지 만들어 둔다.
- **Gate B `gate-b-meet.md` — Meet 탭 캡처 5분**
  확장 버튼 1회 클릭으로 `tabCapture` → Offscreen Document → 지각 해시(dHash) 변화 시에만 WebP 프레임을 Native Messaging 으로 전달. 실제 Meet 없이도 코드가 표시되는 아무 탭(예: GitHub 파일 뷰)으로 시험: 다른 탭을 봐도 캡처 유지, 코드↔슬라이드 전환 감지 3초 이내, 프레임 크기 상한(예: 1280px 폭·품질 80). 60분 메모리 곡선 기록.
- **Gate C `gate-c-intellij.md` — IntelliJ 공식 MCP**
  IntelliJ 2025.2+ 내장 MCP 서버에 로컬 도우미가 클라이언트로 붙어 **읽기 도구만** 사용: 열린 파일·현재 편집기 내용·프로젝트 오류. 어떤 도구가 있는지 목록화하고, `OrderService.java` 를 열어 현재 화면 코드와 실제 파일을 비교하는 예를 남긴다. IntelliJ 가 안 떠 있으면 BLOCKED + 켜는 절차. 후속 얇은 플러그인(`study_get_live_editor_context`)은 필요성만 판단.
- **Gate C2 `gate-c2-provider.md` — 두뇌 어댑터**
  공통 인터페이스 `TutorProvider { ask(context, question) → stream }`. **Claude 먼저**: `claude -p --output-format stream-json` 을 자식 프로세스로 띄워 골든 시나리오 컨텍스트를 넣고 첫 토큰·완료 시간을 측정. 그다음 Codex: `codex app-server`(stdio) 프로토콜 확인 → 같은 테스트(한도 소진 시 BLOCKED, 프로토콜 조사 결과만 기록). 인증정보는 프로세스가 사용자 로그인을 그대로 쓰고 앱은 저장하지 않는다.
- **Gate D `gate-d-recovery.md` — 장애 복구**
  사이드패널 닫기/열기, 공유 페이지 새로고침, 캡처 중단, 도우미 프로세스 강제 종료 후 재시작, 제공자 응답 실패 → 각각 **기록은 계속되고** 최근 수초 이내 손실로 복구되는지 자동 테스트(SQLite WAL 검증 포함). 오류 상태 문구는 §3-5 그대로.

Gate 결과가 나오면 `docs/DECISIONS.md` 에 "Tiro 기본 커넥터 = ?", "Host = Rust/Node", "Provider 기본 = Claude/Codex" 를 기록한다.

### Phase 2 — MVP 수직 슬라이스 (골든 시나리오 · fixtures 만으로 재현)

1. `packages/tutor-core`: 상태기계(§3-4) 순수 TS 구현 + 단위 테스트. 질문 시점 봉인(`ContextSnapshot`: 최근 전사 N문단·최신 프레임·에디터 문맥·각 자료의 나이).
2. `apps/native-host`: session-store(교시 세션 파일 분리, WAL, 이벤트 JSONL 내보내기), context-builder, provider 어댑터 연결, 화면 프레임 저장.
3. `apps/browser-extension` 사이드패널(380px 기본, 360~520 대응): **디자인 시스템 포팅이 먼저** — `packages/design-tokens` 에 `tokens/*.css`·`styles.css` 를 그대로 옮기고, `components/**/*.jsx` 를 TypeScript React 로 옮기되(런타임 `css()` 주입은 유지하거나 CSS 모듈로 치환, 시각 결과는 동일) `.d.ts` 의 props 계약을 지킨다. 그다음 `ui_kits/sidepanel/` 의 ListeningScreen·DetailScreen·HistoryScreen·SettingsScreen 을 실데이터 소스(전사 커넥터·세션 스토어·제공자)에 연결하고, 상태 A~H(듣는 중 → 붙잡은 직후 → 한 줄 답변 → 문장을 붙잡음 → 접힌 메모 → 자세히 → 기록 → 연결 문제 2종)를 `Classmate Side Panel.dc.html` 과 픽셀 수준으로 대조한다(스크린샷 나란히). Alt+S, hover·포커스 상태, 360px 에서 한국어 단어 끊김 없음, 520px 에서 전사 최대 폭 제한. 시연용 컨트롤(폭 전환·끊김 시뮬레이션)은 개발 빌드에서만.
4. E2E: Playwright 로 확장 로드 → fixtures 재생 → 질문 → 한 문장 결론 5~10초 이내(모의 제공자) → 상세 → 복귀 → 제공자 실패 시 queued → recovered. 각 상태 스크린샷을 `docs/screenshots/` 에 저장.
5. `reviewer` 서브에이전트로 §4 위반·계약 불일치 검토 후 수정.

**Phase 2 완료 조건**: `pnpm test`·`cargo test` exit 0, 스크린샷 9장, `docs/architecture.md`·`docs/privacy.md` 초안, WORKLOG 항목.

### Phase 3 — 교시 종료 후 (Lesson Editor · Artifact Director)

1. EXIT_RECALL 화면(3분: 한 문장·값 하나 추적·질문 하나) → FEEDBACK(수업 근거와 비교, 틀린 위치·이유·다음 행동) → FADE_SUPPORT·DELAYED_CHECK 스케줄(적응형 신호 §3-4).
2. Tiro 최종본 교정: `get_note_transcript` 최종본으로 라이브 전사 교체 + 보정 사전 + IntelliJ 식별자 대조.
3. `packages/report-ui`: 교시별 상세(선생님 설명 흐름·Meet 장면·전사·당시 코드·질문/답·오개념·값 흐름·직접 해볼 변형·근거 타임라인) 8개 + 하루 허브(8교시 지도·반복해서 막힌 개념·교시 간 연결·오늘 다시 할 3개·능동 복습·무AI 수행 기록). 한 장 요약은 **선택 보기**.
4. fixture 세션 1개로 `out/<날짜>/period-1.html` + `hub.html` 생성, HTML 검증, 모델 HTML 미실행 확인.

### Phase 4 — 리허설·친구 배포 준비 (사람 필요 · /goal 범위 밖)

65분 리허설 체크리스트(`docs/first-class.md`), Windows 설치파일(Native Messaging 레지스트리 등록·제거·업데이트), Chrome Web Store Unlisted 패키징, 개인정보 안내 3칸 문구, 진단 번들(토큰·URL 제외), 데이터 내보내기·삭제, 깨끗한 Windows VM 설치 시험 절차, 포털 `classmate.corthex-hq.com` 정적 설치 안내(DNS 는 사용자 확인 후).

## 8. Claude Code 운영 지침 (2026-09-02 공식 문서 기준)

- **/goal**: 조건은 4,000자 이내 · 검증 가능한 종료 상태만. 서브에이전트/백그라운드 셸이 도는 동안 평가를 건너뛰고 30분→1시간→2시간 체크인. 도구 없이 답만 하는 턴이 이어지면 루프가 멈춘다 → 매 턴 검증 명령 실행. 크레딧 소진·컨텍스트 초과 시 자동 해제되므로 WORKLOG 가 복구 지점이다.
- **/loop**: 세션 스코프(앱 닫히면 정지), 최소 1분, 시간 단위 작업은 최대 30분 지터, 7일 만료, 세션당 50개. 프롬프트 안의 내장 명령·`ultracode` 는 실행되지 않는다. 지속 스케줄은 Routines(Local).
- **워크플로우**: `ultracode` 키워드는 사람이 직접 타이핑한 프롬프트에서만 동작(-p·예약 작업에서는 무시). 세션 전체를 켜려면 `/effort ultracode`. 관리는 `/workflows`, 저장은 `.claude/workflows/<name>.js`. Phase 1 의 게이트 4개를 병렬로 돌릴 때 적합(각 게이트 = 에이전트 1개 + 검증 1개). 크기 가이드라인 medium(15개 미만).
- **/batch**: git 저장소 필수, 5~30 단위 worktree 서브에이전트가 PR 을 연다. 원격이 없으면 PR 대신 브랜치 머지로 대체하거나 쓰지 않는다. 비코드 작업에는 부적합.
- **모델·effort**: 별칭은 `sonnet`/`opus`/`haiku`/`fable` 또는 전체 ID(`claude-sonnet-5`, `claude-opus-5`, `claude-fable-5-1`)만. `sonnet5` 같은 표기는 별칭이 아니다. Fable 은 사용자가 자리에 있을 때만(동의 프롬프트). Explore 내장 서브에이전트는 Opus 로 캡됨. 동시 서브에이전트 기본 20개.
- **TodoWrite/TaskCreate**: 이 모델 계열에서 기본 비활성 → 파일 기반(§0).
- **Tiro MCP**: OAuth 기본(토큰 180일 로컬 캐시). API 키를 `.mcp.json`에 넣지 않는다. 노트 생성·녹음 시작은 MCP 로 불가(읽기 중심 20개 도구). 반복 폴링은 MCP 보다 `tiro` CLI(`npm i -g @theplato/tiro-cli`, Node 20+, `tiro auth login`)의 `--json` 출력이 스크립트화에 유리 — Gate A 하네스에서 둘 다 시도.
- **Claude Design**: `claude.ai/design` 링크는 fetch 불가 — **로컬 사본 `design/claude-design-export/` 를 읽는다**(§6). MCP 로 직접 읽고 싶을 때만 `claude mcp add --scope user --transport http claude-design https://api.anthropic.com/v1/design/mcp` → `/design-login` 후 `/mcp` 에서 `claude_design`/`claude-design` 연결을 확인하고, 안 되면 로컬 사본으로 진행(Windows 데스크톱에서 `/design-login` 미검증). `/design-sync` 는 코드→디자인 업로드 방향이며 자동화에 넣지 않는다(나중에 `packages/design-tokens`·컴포넌트를 디자인 시스템으로 되돌릴 때 사람이 실행).
- **/batch 사용 시점**: 사용자가 별도 메시지로 보낸다. 조건: git 저장소 + 원격 + `packages/contracts` 고정 + 각 단위가 독립 테스트 가능. Claude 는 Phase 2 진입 시 "batch 가능한 단위 목록"을 먼저 제안하고 사용자의 `/batch` 를 기다리되, 기다리는 동안 멈추지 말고 직렬로 진행한다.
- **Desktop 앱 제약**: `/permissions`·`/config key=value` 불가 → settings.json 직접 편집. `--print` 스크립팅·에이전트 팀 불가(워크플로우로 대체). 통합 터미널은 로컬 세션에서만.
- **Windows**: Git Bash 기준 명령. 파일 경로에 한글이 있어도 동작하도록 UTF-8 처리(`chcp 65001` 필요 시 명시). Playwright 브라우저는 `npx playwright install chromium` 1회.

## 9. 보고 형식 (매 턴)

```
결론: <동사가 든 한 문장>
- 핵심 1 / 핵심 2 / (핵심 3~4)

## 이번 턴 변경
<파일·요지>

## 검증 (실행한 명령과 출력 그대로)
$ pnpm test
...

## 블로커 / 대기 (사람이 할 일)
- 없음 | <항목: 정확한 행동>

## 다음 행동
- <하나만, 구체적으로>
```

WORKLOG 항목 형식: `## 2026-09-02 14:05 — <한 줄>` 아래에 변경·검증·위험·다음 행동 4줄. 변경이 없으면 `heartbeat` 한 줄.

## 10. 첫 턴에서 바로 할 것

1. §0 환경 점검 표 → 2. kickoff.md·research 문서 읽기 → 3. 블로커 목록(도구 미설치·Tiro 미인증·IntelliJ 미실행·Codex 한도 등) → 4. Phase 0 시작. 질문은 하나만, 답이 없어도 기본값(§5)으로 진행.

===== 본문 끝 =====
