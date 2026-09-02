# Corthex Classmate — 구조 (초안, 2026-09-03)

Phase 2 수직 슬라이스 시점의 구조입니다. "지금 있는 것" 과 "2라운드 몫" 을 구분해 적습니다.
정본 결정은 `docs/DECISIONS.md`, 계약은 `packages/contracts`(고정) 입니다.

## 1. 한눈에

```
 Chrome (학습자 PC)                                      로컬 도우미 classmate-host (Rust, 같은 PC)
┌──────────────────────────────────────────────┐        ┌──────────────────────────────────────────┐
│ 사이드패널 (React)                            │        │ transport   4바이트 길이 + JSON 프레이밍   │
│   src/panel  ─ tutor-core 상태기계 ─ ui-classmate │ Native │             봉투 검증(손 검증기, 스키마 8종) │
│   지금: ReplayStore(fixture)  2라운드: 실제 이벤트 │Messaging│ session-store  교시별 SQLite(WAL)         │
├──────────────────────────────────────────────┤ ◄────► │             SessionEvent · frames 표       │
│ service worker  background.ts                 │  ≤1MiB │             <data_dir>/<periodId>.sqlite · …/frames/*.webp │
│   사이드패널 열기 · 캡처 메시지 · (2라운드) 라우팅 │        │ providers   TutorProvider trait · FIFO 큐  │
├──────────────────────────────────────────────┤        │             provider-claude(claude -p)     │
│ tiro-share.content.ts  Tiro 공유 페이지 관찰    │        │             provider-codex(스텁)           │
│ offscreen/             Meet 탭 캡처 · dHash · WebP│        └──────────────────────────────────────────┘
└──────────────────────────────────────────────┘                          │ 세션 번들(JSON)
                                                                          ▼
                                                     report-ui  정적 HTML(교시 상세 + 하루 허브) → out/
```

- 수업 데이터의 정본은 로컬 도우미가 쓰는 교시별 파일 `<data_dir>/<periodId>.sqlite` 와 `<data_dir>/<periodId>/frames/` 입니다. Corthex 서버로 기본 전송은 없습니다.
- 모델에 나가는 것은 질문 시점에 봉인한 최근 자료(`ContextSnapshot`)뿐이고, 모델 출력은 JSON → 템플릿으로만 그립니다.

## 2. 패키지 지도

| 자리 | 역할 | 시험 |
|---|---|---|
| `packages/contracts` | JSON Schema 8종(전사 세그먼트 · 화면 프레임 · 편집기 문맥 · 질문 · 답 · 세션 사건 등) + 생성 타입. `frozen.sha256` 로 고정. 제품 코드는 `import type` 만 | 57 |
| `packages/design-tokens` | 디자인 정본 토큰 CSS(변수 196개) · 글꼴은 npm 번들 · `tokens.ts` 생성물 | 17 |
| `packages/ui-base` | 기본 부품(Button · Chip · Disclosure · CodeBlock · Evidence · Icon 선별 맵 …) | 73 |
| `packages/ui-classmate` | 수업 부품 10개(TranscriptFlow · MarginNote · GuessList · NowLine · SourceFooter · AnswerCard …). 지금은 `internal/base` 복제를 씀(2라운드에 ui-base barrel 로 교체) | 96 |
| `packages/tutor-core` | 순수 TS 상태기계 · 봉인 · 접힘 타이머 · 오류→대기→복구 | 71 |
| `packages/report-ui` | 세션 번들 → `period-<n>.html` + `hub.html` 정적 생성(React 템플릿, `dangerouslySetInnerHTML` 0) | 74 |
| `apps/browser-extension` | 사이드패널(`src/panel`) · Tiro 커넥터(`src/tiro`) · Meet 캡처(`src/capture`) · E2E | 264 + E2E 10 |
| `apps/native-host` | 루트 `classmate-host`(Router · `src/store`) + `crates/transport` + `crates/providers` | 175 |

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

| | 지금(Phase 2) | 2라운드 |
|---|---|---|
| 사건 공급 | `ReplayStore.advanceTo` 가 fixture `session-events.jsonl` 27줄을 시각순으로 넣음 | Tiro · Meet · 호스트 이벤트를 같은 `pushEvent` 자리에 배선 |
| 제공자 | 모의 — fixture 의 답만 돌려주거나 `answer.failed` | 호스트 `providers` 경유 |
| 시계 | `?replay=manual` 이면 멈춤, 아니면 1초 tick | 실시간 |
| 화면 | 듣는 중 · 자세히 | + 기록 · 설정 |

디자인 어휘와 계약 어휘의 대응(Evidence verified/delayed ↔ confirmed/stale)은 `src/panel/evidence.ts` 한 곳에만 둡니다.

## 5. 확장 ↔ 호스트 메시지

| 요청 | 응답 | 메모 |
|---|---|---|
| `ping` | `hello {protocol, version}` | 연결 확인 |
| `event.append {periodId, event}` | `event.ack {id, seq, duplicate?}` | SessionEvent 저장 |
| `session.status` | 교시 요약 | |
| `session.export` | JSONL | 보고서 입력 |
| `frame.store {periodId, frame, bytesBase64}` | `frame.stored {id, path, bytes, seq}` | 호스트가 id 로 경로를 다시 계산 · 봉투 ≤ 1 MiB |
| (실패) | `error {type, message, reason, received}` | 네 칸 항상 문자열 · 프로세스는 계속 삶 |

## 6. 아직 없는 것 (2라운드)

- `apps/native-host/context-builder` — 봉인 → 제공자 호출 → SessionEvent 기록 파이프라인, queued → recovered 통합 시험
- `apps/browser-extension/service-worker` — 패널·커넥터·Native Messaging 라우팅과 재연결
- `installer/windows` — 호스트 실행파일 · 레지스트리 등록/제거 · 확장 zip · `docs/first-class.md`
- 사이드패널 기록·설정 화면 · 개인정보 문구 · 캡처 시작/중지 버튼
