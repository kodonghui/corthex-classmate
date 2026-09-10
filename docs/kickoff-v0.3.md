# Corthex Classmate v0.3 킥오프 — Classmate Core + 순정 Claude/Codex 앱

- 날짜: 2026-09-10
- 작성자: Claude (Cowork, 논의 1~4차 합의 정리)
- 참여자: 사용자, Claude
- 상태: 승인됨 · 구현 착수 (검증 1 통과, 2 렌더 통과·sendMessage 대기, 3 Claude Code로 진행)
- 이전 정본: `docs/kickoff-v0.2.md` — 제품 경계·불변 원칙·다섯 활동·V2 계약은 그대로 유효. 이 문서는 **실행 형태(Chrome 확장 + CLI 하위 프로세스 → 로컬 코어 + 공식 앱)** 만 바꾼다.
- 원문 합의: Notion [재설계 논의 문서](https://app.notion.com/p/3d7bf16cc3ec81a0a585fa4216dca4b6) · [기능별 사용자 흐름 시퀀스](https://app.notion.com/p/3d7bf16cc3ec81eebd4af8f1c177633e) (2026-09-10 읽음, 사용자 "나머지는 모두 승인")

## 한 문장 목표

Chrome에서 재생되는 어떤 영상(Meet · Drive · YouTube)이든, Tiro 실시간 전사와 질문 순간의 화면을 로컬 코어가 붙잡고, 학생은 자기 Claude/Codex 데스크톱 앱에서 그대로 묻고 답을 쌓는다. 세션·메모리·Notion·모델 전환은 앱이 담당하고 Classmate는 "순간 맥락 제공자"로만 남는다.

## 왜 바꾸나 (사용자 발언 기준)

- Chrome 확장은 한계가 많고 세션 저장·Codex 연결 같은 기능을 하나하나 직접 만들어야 한다.
- 에이전트 관리가 편해야 한다. 매번 지시하는 것도 귀찮다.
- Tiro 구독자라면 누구나 쓰는 범용이어야 한다.

## 구조

```
Chrome(영상) ─┐                        ┌─ Claude 앱(Chat) ── 전사 패널(MCP App) ── Notion 커넥터
iPhone Tiro ─ Tiro 공식 API ─▶ Classmate Core (exe) ─ MCP stdio ─┤
              (문단 + UTC 시각)   단축키 즉시 캡처 · 변화 감지 타임라인      └─ Codex 앱 (MCP 클라이언트)
                                  SQLite · MCP 서버 · UI 리소스
```

| 구성 요소 | 역할 | 이 저장소의 자리 |
| --- | --- | --- |
| Classmate Core | 전역 단축키(Alt+S) 즉시 창 캡처 · Windows 창/영역 캡처 · 변화 감지 프레임 타임라인 · Tiro 공식 API 폴링(2~5초) · SQLite 저장 · MCP 서버(툴 + `ui://classmate/panel`) · 트레이 설정 창 | `apps/core/` (crate `classmate-core`) — `apps/native-host`의 `src/store`, `crates/transport` 봉투 검증기, `packages/contracts` 스키마를 재사용 |
| Claude Code 플러그인 `classmate` | 스킬("답하기 전 `moment.latest`/`transcript.recent` 읽기", 그림 규칙, 교시 이월) · `.mcp.json`(코어 stdio) · 훅(문답 기록) | `plugins/classmate/` → 기존 corthex 마켓플레이스에 게시 |
| 전사 패널 (MCP App) | Claude 채팅 안 iframe: 라이브 전사, 문단 클릭 → `callServerTool(moment.capture)` → `sendMessage`, 후속 칩, mermaid 렌더 | `packages/ui-classmate` 부품 재사용, 빌드 결과를 코어가 리소스로 제공 |
| 배포 | GitHub Releases exe + Install.cmd(현행) · `npx @corthex/classmate`(플랫폼 바이너리 래퍼) · Claude Code 플러그인 · `.mcpb`(Claude Desktop Chat) | `installer/` 확장 |
| 유지 | `apps/browser-extension` + `classmate-host` 0.1.6 은 코어가 실제 수업에서 흐름 1·2를 통과할 때까지 그대로 사용. 그 뒤 `legacy/`로 이동(삭제 아님) | — |

## 세션은 하나로 쭉 간다 (사용자 결정 2026-09-10)

- 사용자는 실시간 수업보다 **집에서 녹화 영상(Drive·YouTube)** 을 보며 공부하는 경우가 대부분이다. 따라서 "교시"라는 단위와 교시 전환 UX는 만들지 않는다. 학습 묶음은 기본 하나(`현재 공부`, 이름 변경 가능)이고 날짜·영상·Tiro 노트가 바뀌어도 자동으로 이어진다. 영상별 파일·노트 지정을 요구하지 않는다.
- 긴 대화는 앱 쪽 문제이므로 코어가 문맥을 들고 있는다: 모든 문답을 `session.log`에 쌓고, 스킬은 새 채팅을 열 때 `session.summary(recent)`로 최근 문답·용어를 자동 이월한다. 사용자는 채팅을 언제 새로 열어도 되고, 안 열어도 된다. 강제 전환·안내 없음.
- 복습·블로그용 구간 나누기는 사용자에게 묻지 않고 Tiro 노트 경계와 30분 이상 공백으로 코어가 뒤에서 만든다(표시 이름은 날짜+첫 문단 요약).

## 질문 입력 3층 (사용자 흐름은 Notion 시퀀스 문서 §3~§8)

1. **타이핑**: Claude/Codex 채팅에 적으면 스킬이 `moment.latest()` 또는 `transcript.recent(60s)`를 먼저 읽는다. "방금/지금/이거/화면" 지시어가 없으면 캡처를 생략한다.
2. **Alt+S**: 코어가 수십 ms 안에 캡처 + 마지막 문단 + 최근 문답을 `moment`로 저장. 선생님 판서 시점 보장.
3. **문단 클릭** (Claude만): 패널에서 문단·칩 클릭 → 즉시 캡처 → 질문을 채팅으로 전송 → 답과 그림이 같은 채팅에 쌓임.

## 코어 MCP 툴 계약 (초안 · 구현 시 `packages/contracts`에 JSON Schema로 고정)

| 툴 | 입력 | 출력 |
| --- | --- | --- |
| `moment.capture` | `paragraph_uuid?`, `note?` | `moment_id` |
| `moment.latest` | `max_age_sec` | moment(이미지 content + 전사 60초 + 최근 문답 요약) |
| `moment.get` | `moment_id` | moment |
| `transcript.recent` | `window_sec`, `until?` | `[{uuid, text, timeFrom, timeTo}]` |
| `timeline.frames` | `around`(UTC), `span_sec` | 변화 감지 프레임 이미지들 |
| `session.log` | `question, answer, paragraph_uuid?, moment_id?, kind` | ok |
| `session.summary` | `recent` 또는 `range` | 최근 문답 요약·핵심 용어(새 채팅 이월용) |
| `diagram.show` | `kind, mermaid, caption` | 패널 렌더 / Codex는 SVG 파일 경로 |
| `review.materials` / `review.save` | `period, bundle` / `attempts` | 자료 묶음 / ok |
| 리소스 `ui://classmate/panel` | — | 전사 패널 HTML |

## Tiro 공식 API (2026-09-10 실측으로 확정)

- 인증 `Authorization: Bearer <keyId.secret>` (계정 API Key, platform.tiro.ooo/me/api-keys). Key ID만 넣으면 401. 키는 Windows 자격 증명 관리자에 저장하고 `.mcp.json`·로그·커밋에 넣지 않는다(불변 원칙 §2-2).
- `GET /v1/external/workspaces/me` → `{guid}`; `GET /v1/external/workspaces/{guid}/notes?size=8` → `{content:[{guid,title,sourceType,recordingStartAt,recordingEndAt(진행 중 null),webUrl}],nextCursor}`.
- `GET /v1/external/notes/{guid}/paragraphs?size=1000` → `{content:[{uuid,transcript{type,content},summary{markdown},translated,diarizedSegments,timeFrom,timeTo,locked}],nextCursor}`. **진행 중 노트의 마지막 문단 timeTo가 실행 시각과 0~1초 차이** — 라이브 공유 페이지 DOM 폴백은 만들지 않는다. 문단 길이 8~34초, 폴링 2~5초, 키당 600req/60s.
- 노트 선택(사용자 결정 2026-09-10 "영상별로 파일 지정하기 귀찮다"): 코어가 **녹음 중인 노트(`recordingEndAt == null`)를 자동으로 따라간다.** 사용자는 아무것도 고르지 않는다. 녹음 중인 노트가 여럿이면 가장 최근 시작한 것, 없으면 마지막 노트를 읽기 전용으로 붙인다. 트레이에서 수동 지정은 예외 경로.

## 화면 저장 용량 정책 (사용자 질문 2026-09-10 반영)

- 2~5초는 **Tiro 폴링** 주기다. 화면은 약 1초마다 살펴보되 **해시가 바뀐 장면만** WebP 한 장으로 저장한다(불변 원칙 §2-4, 현재 확장의 offscreen 변화 감지와 같은 방식). 슬라이드 수업은 시간당 100~300장, 판서가 많으면 600장까지 추정(장당 50~150KB → 시간당 10~60MB, 8교시 최악 0.5GB). 수치는 추정이며 첫 실수업에서 실측해 여기 갱신한다.
- 저장 위치: `%LOCALAPPDATA%\CorthexClassmate\core\frames\<학습 묶음>\` (호스트 0.1.6의 `sessions\`와 분리 — DECISIONS 2026-09-10 (2)·(3), 시험용 환경 변수 `CLASSMATE_CORE_DIR`). Corthex 서버 전송 없음.
- 보존 규칙: 질문(`moment`)에 연결된 프레임은 영구 보관. 연결되지 않은 타임라인 프레임은 기본 7일 뒤 삭제하고, 일일 상한(기본 300MB) 초과 시 오래된 미참조 프레임부터 지운다. 트레이 설정에서 상한·보존 기간 변경, "연속 캡처 끄기"(그러면 Alt+S·클릭 순간만 저장), 캡처 영역 지정으로 장당 크기 축소를 제공한다.

## 검증 관문 (승인된 순서)

1. [x] Tiro 공식 API 접근·지연 실측 (`tiro-check.ps1`, 2026-09-10 13:05 KST).
2. [x] Claude Desktop **로컬** MCP App 렌더 — 2026-09-10 14:20 KST 사용자 실측: `mermaid-mcp-app` `.mcpb`를 설정→확장에서 설치, Chat에서 "REST 요청 흐름을 시퀀스 다이어그램으로 그려줘" → 채팅 안에 `Mermaid Diagram Renderer · mermaid-mcp-app` 패널 렌더 확인(인라인 높이 제한 있음 → 우리 패널은 내부 스크롤 + 전체화면 모드 제공). 같은 로컬 서버가 Cowork 세션에도 `mcp__remote-devices__Mermaid_Diagram_Renderer__*`로 노출되어 호출됨 → "코어 서버 하나가 Claude Chat·Cowork에 모두 보인다" 확인.
   [ ] 패널→채팅 `sendMessage`(Send to AI 버튼) 실동작 — 확인 대기. 실패 시 3층(문단 클릭)만 코어의 작은 창으로 대체하고 나머지는 동일.
3. [ ] 코어 MVP: 흐름 2(타이핑+Alt+S) → 흐름 1(패널) → 흐름 6(그림) 순서. 각 흐름의 완료 기준은 Notion 시퀀스 문서의 "완료 기준" 줄. **실행은 Claude Code(PC)** — 인수인계·1단계 상세 `docs/plan/core-mvp-handoff.md` (사용자 결정 2026-09-10 오후).
4. [ ] 실제 수업 1교시에서 흐름 1·2 통과 후 확장 0.1.6을 `legacy/`로 이동.
5. [ ] Codex 앱 `codex mcp add classmate` 경로(흐름 2·3·5) 확인 · MCP 이미지 처리 실측.

## 이번 범위에서 하지 않는 것

- Claude Code 채널(연구 프리뷰, 사용자 정의 채널은 개발 플래그 필요) — 개인용 옵션으로만 추후 검토.
- 코어 자체 채팅 UI · Tauri/Electron 창 — 하네스가 UI를 제공하므로 트레이+설정 창만.
- 로컬 STT · IntelliJ 연결 · 자동 웹 검색 · 클라우드 저장 (v0.2와 동일하게 제외).
- 확장 0.1.6 삭제 — 코어가 실수업을 통과하기 전에는 사용자의 실제 도구다.

## 미결·사람 결정

- 검증 2단계 결과(패널 위치).
- `.mcpb` 배포 시 Tiro 키 입력 UI(mcpb user_config vs 트레이 설정 창) — 트레이 설정 창 하나로 통일 제안.
- 친구 배포 시점과 Tiro OAuth 앱 등록 여부(키 없이 1회 동의).
