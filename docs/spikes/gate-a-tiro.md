# Gate A — Tiro 실시간 전사

> 형식: 판정 → 측정값 → 재현 명령 → 결정에 미치는 영향 → 사람이 할 일.
> 근거는 `docs/master-prompt.md` §2-2 · §2-3 의 실측을 옮겨 적고, 이 저장소에서 새로 측정한 것을 아래에 추가합니다.

## 판정

| 경로 | 판정 | 상태 |
|---|---|---|
| 1순위 — 공식 API/MCP `get_note_transcript` 가 녹음 중 갱신 | **BLOCKED** | Tiro MCP 미승인·미인증. 사람이 인증하고 다음 녹음 때 실측 |
| 2순위 — 공유 페이지 DOM 스트리밍을 content script 가 읽음 | **PASS (부분)** | 2026-09-02 4분 관찰 합격. 60분 유지·발화→화면 지연은 잔여 |
| 3순위 — 임시 실시간 STT + 수업 후 Tiro 최종본 교체 | **보류** | 2순위가 합격했으므로 구현하지 않음 |

**기본 커넥터 = 2순위(공유 페이지)**. 1순위가 합격하면 기본값을 바꾸고 `docs/DECISIONS.md` 에 기록한다.

## 측정값 (옮겨 적음 · 2026-09-01 ~ 2026-09-02)

### iPhone Tiro Real-time 녹음 (2026-09-01 교실)
- 25분 9초 녹음 → 25문단(12:01:18 ~ 12:21:03), 원문 6,620자.
- 문단별 시각 있음(종료 후 노트). 화자 구분 없음.
- 노트북 내장 마이크 대안은 -46.4 LUFS 로 탈락.

### 공유 페이지 스트리밍 (2026-09-02 · Chrome 4분 관찰)
| 항목 | 값 |
|---|---|
| 갱신 방식 | 새로고침 없이 단어 단위 스트리밍(약 0.1초 간격), 중간 인식 결과가 나중에 교정됨 |
| 증가량 | 85초에 552 → 982자 · 새로고침 뒤 90초에 1,151 → 1,508자 |
| 백그라운드 탭 | hidden 상태에서도 215건 DOM 변경 계속 수신 |
| 최초 로드 | `POST api.tiro.ooo/v1/notes/share/<id>` 1회, 이후 갱신은 별도 실시간 채널(REST 폴링 아님) |
| DOM 구조 | `main` 안에 문단 `div.whitespace-pre-wrap` 이 순서대로 쌓임 |
| 확정/진행 구분 | 작성 중인 마지막 문단만 `font-semibold`, 확정 문단은 `font-medium text-tds-fg-subtle` |
| 문단 시각 | 녹음 중 공유 페이지에는 **없음**(종료 후 노트에만) → 확장이 도착 시각을 직접 기록 |

### Tiro 전사 오류 유형 (보정 사전 초기값)
애노테이션 → 언어테이션 · MVN → 엔브이엔 · Gradle → 그레이드 · 클래스명 음차. 교시 종료 후 Tiro 최종본 + IntelliJ 식별자로 교정.

### Tiro API 이벤트
`note.created`, `note.recording.completed`(일시정지 시), `note.ended`. **문장 단위 실시간 이벤트 없음.**

## 잔여 측정 (아직 하지 않음)

| 항목 | 방법 | 합격 기준 | 상태 |
|---|---|---|---|
| (a) MCP 경로 실시간 여부 | 녹음 중 `get_note_transcript` 를 10초마다 호출, 문단 수·지연을 CSV 로 | 녹음 종료 전 문단 반환 + 지연 30초 이내 95% | BLOCKED — Tiro MCP 승인·OAuth 후 사람이 녹음 |
| (b) 60분 연속 유지 | Playwright(Chromium)로 공유 URL 을 열고 MutationObserver 이벤트 시각을 1시간 기록. URL 은 환경변수 `TIRO_SHARE_URL` 로만 받고 로그·파일에 남기지 않음. 타이머 대신 이벤트 기반 | 새로고침 없이 60분, 이벤트 공백 30초 초과 0회 | 하네스 작성 예정(Phase 1) — 실측은 사람이 녹음할 때 |
| (c) 발화 → 화면 지연 | 사람이 눈으로 1회 확인 | 1~3초 추정, 30초 이내 | BLOCKED — 사람 |

## 재현 명령 (Windows · Git Bash · 저장소 루트)

```bash
# (b) 60분 유지 하네스 — Phase 1 에서 apps/browser-extension/spikes/tiro-share-observe.mjs 로 작성 예정
TIRO_SHARE_URL="<녹음 중인 공유 링크 · 채팅에만>" node apps/browser-extension/spikes/tiro-share-observe.mjs --minutes 60 --out out/gate-a/observe.csv
```

- 공유 URL 은 명령 인자가 아니라 환경변수로만 넘긴다(셸 히스토리·로그 노출 방지). `out/` 은 `.gitignore` 대상.

## 결정에 미치는 영향

- `apps/browser-extension/tiro-connectors/share-page.ts` 를 **기본 커넥터**로 구현한다: `main` 하위 문단을 MutationObserver 로 읽고, 구조 기반 선택자(마지막 문단 = 진행 중) + 클래스 힌트(`font-semibold`) 폴백으로 확정/진행 중을 구분, 도착 시각(`arrivedAt`)을 확장이 찍어 `TranscriptSegment` 로 Native Messaging 에 보낸다.
- 선택자가 깨지면(문단 0개가 30초 지속) 사용자에게 호박색 SourceFooter 로 알린다("전사 수신이 멈췄어요 · 공유 페이지를 새로고침해 주세요").
- 백그라운드 탭에서 `setInterval` 은 스로틀되므로 폴링 금지, MutationObserver 만 사용.
- 1순위가 합격하면 `tiro-connectors/api.ts` 를 기본값으로 올리고 공유 페이지는 폴백으로 내린다.

## 사람이 할 일

1. Claude Code 대화형 세션에서 프로젝트 MCP 승인(`claude` 실행 시 `.mcp.json` 의 tiro 승인) → `/mcp` → tiro → **Authenticate**(브라우저 구글 로그인).
2. 다음 수업 녹음 때 휴대폰 Tiro 새 노트를 **Real-time** 으로 만들고 공유 링크를 채팅으로만 전달(파일에 쓰지 않음).
3. 녹음 중 (a)(b)(c) 를 함께 실측하고 끝나면 링크를 회수한다.
4. Tiro Max 결제(무료 300분·노트당 50분 열람 제한으로는 60분 교시 불가).
