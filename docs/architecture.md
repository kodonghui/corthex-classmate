# Corthex Classmate — 구조 (9라운드 수업 탭 경로, 2026-09-04)

Phase 2 2라운드(사이드패널 4화면 · 서비스 워커 · 튜터 파이프라인 · 설치 묶음) 위에
3~9라운드(질문 경로 · 라이브 품질 · 대화 칸 · 조각 스트리밍 · 고른 수업 화면 한 장)를 얹은 시점의 구조입니다.
"지금 있는 것" 과 "남은 것(사람 확인 · 다음 라운드)" 을 구분해 적습니다.
정본 결정은 `docs/DECISIONS.md`, 계약은 `packages/contracts`(고정) 입니다.

**여기에는 시험 건수·장 수·파일 크기 같은 숫자를 적지 않습니다.** 손으로 적은 수는 실측이
바뀔 때마다 뒤처집니다(`docs/retrospective.md` §5-4). 그 숫자는 `docs/WORKLOG.md` 의 검증 출력에만 둡니다.

## 1. 한눈에

```
 Chrome (학습자 PC)                                      로컬 도우미 classmate-host (Rust, 같은 PC)
┌──────────────────────────────────────────────┐        ┌──────────────────────────────────────────┐
│ 사이드패널 (React)                            │        │ transport   4바이트 길이 + JSON 프레이밍   │
│   src/panel  ─ tutor-core 상태기계 ─ ui-classmate │ Native │             봉투 검증(손 검증기, 스키마 8종) │
│   라이브: ReplayStore.live + attachLive · fixture: ?replay= │Messaging│ session-store  교시별 SQLite(WAL)         │
├──────────────────────────────────────────────┤ ◄────► │             SessionEvent · frames 표       │
│ service worker  background.ts                 │  ≤1MiB │             <data_dir>/<periodId>.sqlite · …/frames/*.webp │
│   라우터 · 도우미 연결(FIFO·재연결) · 교시 로그 · 알람 │        │ tutor       TutorPipeline(봉인→자료→CLI→검사→사건) │
│   패널 포트 classmate-panel · 프레임 싱크        │        │ providers   TutorProvider trait · FIFO 큐  │
├──────────────────────────────────────────────┤        │                                          │
│ tiro-share.content.ts  Tiro 공유 페이지 관찰    │        │             provider-claude(claude -p)     │
│ action+activeTab       고른 수업 탭 질문 시 한 장  │        │             provider-codex(스텁)           │
│ offscreen/             연속 캡처 실험 · dHash · WebP│        └──────────────────────────────────────────┘
└──────────────────────────────────────────────┘                          │ 세션 번들(JSON)
                                                                          ▼
                                                     report-ui  정적 HTML(교시 상세 + 하루 허브) → out/
```

- 수업 데이터의 정본은 로컬 도우미가 쓰는 교시별 파일 `<data_dir>/<periodId>.sqlite` 와 `<data_dir>/<periodId>/frames/` 입니다. Corthex 서버로 기본 전송은 없습니다.
- 모델에 나가는 것은 질문 시점에 봉인한 최근 자료(`ContextSnapshot`)뿐이고, 모델 출력은 JSON → 템플릿으로만 그립니다.

## 2. 패키지 지도

| 자리 | 역할 |
|---|---|
| `packages/contracts` | JSON Schema 8종(전사 세그먼트 · 화면 프레임 · 편집기 문맥 · 질문 · 답 · 세션 사건 등) + 생성 타입. `frozen.sha256` 로 고정. 제품 코드는 `import type` 만 |
| `packages/design-tokens` | 디자인 정본 토큰 CSS · 글꼴은 npm 번들 · `tokens.ts` 생성물 |
| `packages/ui-base` | 기본 부품(Button · Chip · Disclosure · CodeBlock · Evidence · Icon 선별 맵 …) |
| `packages/ui-classmate` | 수업 부품(TranscriptFlow · MarginNote · GuessList · NowLine · SourceFooter · AnswerCard …). 기본 요소는 `@classmate/ui-base` barrel(2라운드에 `internal/base` 복제 삭제) |
| `packages/tutor-core` | 순수 TS 상태기계 · 봉인 · 접힘 타이머 · 오류→대기→복구 |
| `packages/report-ui` | 세션 번들 → `period-<n>.html` + `hub.html` 정적 생성(React 템플릿, `dangerouslySetInnerHTML` 0) |
| `apps/browser-extension` | 사이드패널 4화면(`src/panel`) · 서비스 워커 판단(`src/background`) · 패널 어댑터(`src/live`) · Tiro 커넥터(`src/tiro`) · 고른 수업 탭 캡처(`src/capture`) · E2E · 정본 비교 스크립트 |
| `apps/native-host` | 루트 `classmate-host`(Router · `src/store` · `src/tutor` 파이프라인) + `crates/transport` + `crates/providers` |
| `installer/windows` | `cargo build --release` → `dist/classmate-host.exe` · 확장 zip(dev/store) · 고정 확장 id(공개키만) · 레지스트리 등록 계획(dry-run) · 스모크 · `docs/first-class.md` |

## 3. 골든 시나리오의 흐름 — "왜 new로 직접 만들면 안 돼요?"

```
전사(Tiro)        사이드패널(tutor-core)                 제공자(모의/실제)        기록
   │ transcript.segment                                                          │
   ├──────────────► CAPTURE ── 낱말 new 누름 ──► question.asked(snapshot 봉인) ──► SessionEvent
   │                  │                            │ ask 효과                       │
   │                  ▼                            ├──────────────► answer.completed │
   │            ANSWER_MINIMAL · preparing ◄───────┘                                │
   │                  │ 1.6초                                                       │
   │                  ▼                                                             │
   │            ANSWER_MINIMAL · minimal(한 줄 결론 · 칩 · 18초 접힘)               │
   │                  │ 자세히 ──► detail ──► 수업으로 돌아가기 ──► minimal(18초 새로) │
   │                  │ 18초 지남 또는 period.ended                                  │
   │                  ▼                                                             │
   │            CAPTURE · folded(접힌 메모 한 줄)                                    │
   │                                                                               │
   │  두 번째 질문 생성자 → answer.failed → queued(대기) → answer.recovered → minimal(일부 확인)
```

상태기계 6상태 중 CAPTURE · ANSWER_MINIMAL · EXIT_RECALL 의 전이가 구현되어 있고 FEEDBACK · FADE_SUPPORT ·
DELAYED_CHECK 는 골격입니다(`docs/TASKS.md` 보류 항목). 전이표는 `packages/tutor-core/src/machine.ts` 와 시험이 정본입니다.

## 4. 사이드패널의 데이터 소스

| | 라이브 (`sidepanel.html`) | fixture (`?replay=auto` · `?replay=manual`) |
|---|---|---|
| 사건 공급 | 서비스 워커 포트 `classmate-panel` → `attachLive` → `ReplayStore.live` 의 `pushEvent/pushSegment/pushFrame/pushEditor`. 연결 때 `period.started` + 교시 로그(최근 500건) 재생 | `ReplayStore.advanceTo` 가 fixture `session-events.jsonl` 27줄을 시각순으로 넣음 |
| 제공자 | 스토어 `ask` 효과 → `AskPort` → `panel.ask` → 서비스 워커가 `tutor.ask` 봉투 → 도우미 `TutorPipeline` → `tutor.event` 로 돌아옴. 60초 안에 답이 없으면 스토어가 `answer.failed` | 모의 — fixture 의 답만 돌려주거나 `answer.failed` |
| 시계 | 1초 tick(`Date.now()`) | `manual` 이면 멈춤(`window.classmateReplay.goto`), `auto` 면 1초 tick |
| 교시 id | 설정 `classmate.periodNumber` + 오늘 날짜 → `makePeriodId`(서비스 워커와 같은 함수) | fixture 의 `2026-09-02-p3` |
| 화면 | 듣는 중 · 자세히 · 기록(바닥줄 카운트) · 설정(헤더 아이콘) | 같음 + `?replay=manual` 에서만 손잡이 `window.classmateConnector` |

```
   설정(chrome.storage.local) ─▶ App.tsx openLive ─▶ ReplayStore.live ◀─ attachLive ◀─▶ 서비스 워커 ◀─▶ 도우미
                                                         │
                                                         ▼
                                              PanelApp(듣는 중 · 자세히 · 기록 · 설정)
```

디자인 어휘와 계약 어휘의 대응(Evidence verified/delayed ↔ confirmed/stale)은 `src/panel/evidence.ts` 한 곳에만 둡니다.
정본 렌더와 구현의 상태별 비교 이미지는 `docs/screenshots/compare/` 에 있습니다.

## 5. 확장 ↔ 호스트 메시지

| 요청 | 응답 | 메모 |
|---|---|---|
| `ping` | `hello {protocol, version}` | 연결 확인 |
| `event.append {periodId, event}` | `event.ack {id, seq, duplicate?}` | SessionEvent 저장 · `duplicate:true` 는 성공으로 봄 |
| `session.status` | 교시 요약 | |
| `session.export` | JSONL | 보고서 입력 |
| `frame.store {periodId, frame, bytesBase64}` | `frame.stored {id, path, bytes, seq}` | 호스트가 id 로 경로를 다시 계산 · 봉투 ≤ 1 MiB |
| `tutor.ask {periodId, questionId, kind, word?, question?, provider, snapshot}` | `tutor.accepted {periodId, questionId}` | 교시마다 `TutorPipeline` 하나 · CLI 는 `CLASSMATE_CLAUDE_CLI` 로만 |
| `tutor.retry {periodId, questionId}` | `tutor.accepted` | 받은 적 없는 질문이면 `unknown-question` |
| (자발 push) | `tutor.event {periodId, event}` | `question.asked`(호스트 기록본) · `answer.completed/failed/queued/recovered` · `connector.status(provider)` — `tutor.ask` 전에는 0건 |
| (자발 push) | `tutor.delta {periodId, questionId, seq, chars, text?}` | 답이 만들어지는 **동안** 흐르는 조각. 사건이 아니라서 SQLite 에 담지 않고, 라우터가 `live.delta` 로 패널에 흘립니다. 정본은 `apps/native-host/src/tutor/delta.rs` 와 `crates/transport` 의 `PUSH_TUTOR_DELTA` |
| (실패) | `error {type, message, reason, received}` | 네 칸 항상 문자열 · 봉투 위반 `envelope-invalid` · `question-too-long` · `malformed-snapshot` · `provider-unavailable` · 프로세스는 계속 삶 |

패널 ↔ 서비스 워커(포트 `classmate-panel`): 워커 → 패널 `live.event | live.segment | live.frame | live.editor | live.delta`(마지막 것만 교시 로그에 담지 않습니다), 패널 → 워커 `panel.event`(스토어가 낸 사건) · `panel.ask {request}` · `classmate.reconnect {connector}`. 정본은 `apps/browser-extension/src/live/messages.ts` 입니다.

## 6. 남은 것

- 사람 확인이 끝난 것: 레지스트리 등록 `install.mjs --apply` · Chrome 안 실제 확장 ↔ 도우미 왕복 · 실제 `claude` 첫 호출 · 원격 저장소와 첫 push(`git ls-remote origin refs/heads/main` 이 로컬 `main` 과 같음).
- 아직 사람이 해야 하는 것('대기'): 깨끗한 Windows VM 설치 1회 · 65분 리허설 · Tiro 공유 링크로 Gate A 실측 · 고른 수업 화면 실측(몇 장 담기는가) · IntelliJ MCP 실측 · Chrome Web Store.
- 코드에 남은 것(`docs/TASKS.md`와 `docs/plan/round-9-codex-handoff.md`): 설정 값 배선(answerLength · periodNumber 즉시 반영 · capture 3칸) · 연속 캡처 시작/중지 버튼 · 전역 단축키(`chrome.commands`) · "오늘 기록 지우기" 호스트 봉투 · 교시 종료 시 파이프라인 정리 · IntelliJ MCP 배선 · 교시 뒤 4상태로 들어가는 문(`kind:"next"` 를 내는 코드가 0곳) · Tiro 최종본 교정 · report-ui 회상 기록.
