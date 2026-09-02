# Gate A — Tiro 실시간 전사

> 형식: 판정 → 측정값 → 재현 명령 → 결정에 미치는 영향 → 사람이 할 일 → 남은 위험.
> 근거는 `docs/master-prompt.md` §2-2 · §2-3 의 실측을 옮겨 적고, 이 저장소에서 새로 측정한 것을 아래에 추가합니다.

## 판정

판정: PASS (부분 — 2순위 커넥터는 fixtures 로 검증 완료, 실측 3항목 (a)(b)(c) 는 BLOCKED · §사람이 할 일 참조)

| 경로 · 항목 | 판정 | 상태 |
|---|---|---|
| 1순위 — 공식 API/MCP `get_note_transcript` 가 녹음 중 갱신 | **BLOCKED** | Tiro MCP 미승인·미인증. 커넥터는 스텁만 둠(`createApiConnector`) |
| 2순위 — 공유 페이지 DOM 스트리밍 구조 | **PASS** | 2026-09-02 Chrome 4분 관찰 합격(아래 실측) |
| 2순위 커넥터 구현 + 단위 시험 | **PASS** | 파서·관찰기·content script 구현, 36개 시험 통과(exit 0) |
| 관찰 하네스(`spikes/tiro-share-observe.mjs`) | **PASS** | 합성 페이지 대상 스모크 통과. 실제 공유 링크 대상 실행은 대기 |
| (a) MCP 경로 실시간 여부 | **BLOCKED** | 사람이 OAuth 인증 + 녹음 필요 |
| (b) 60분 연속 유지 | **BLOCKED** | 하네스는 준비됨. 사람이 녹음 중 공유 링크를 채팅으로 줘야 실행 |
| (c) 발화 → 화면 지연 | **BLOCKED** | 사람이 눈으로 1회 확인 |
| 3순위 — 임시 실시간 STT + 수업 후 Tiro 최종본 교체 | **보류** | 2순위가 합격했으므로 구현하지 않음 |

**기본 커넥터 = 2순위(공유 페이지)**. 1순위가 합격하면 기본값을 바꾸고 `docs/DECISIONS.md` 에 기록한다.

### 이번에 만든 것

| 경로 | 무엇 |
|---|---|
| `apps/browser-extension/src/tiro/types.ts` | `TiroConnector` 인터페이스 · `ParsedParagraph` · `TiroPartial` · `SelectorBrokenSignal` |
| `apps/browser-extension/src/tiro/share-parser.ts` | 순수 함수. DOM → 문단 목록. 클래스 힌트 + 구조 폴백 + 선택자 깨짐 감지 |
| `apps/browser-extension/src/tiro/share-observer.ts` | MutationObserver 관찰기. 확정 문단 → `TranscriptSegment`, 진행 문단 → partial |
| `apps/browser-extension/src/tiro/index.ts` | `createShareConnector`(구현) · `createApiConnector`(스텁) · `isSharePageUrl` · `makePeriodId` |
| `apps/browser-extension/entrypoints/tiro-share.content.ts` | WXT content script. `chrome.runtime.sendMessage` 로 `tiro.segment` / `tiro.partial` / `tiro.selector_broken` |
| `fixtures/tiro/share-page-*.html` | 합성 DOM 스냅샷 4종(녹음 중 · 선택자 깨짐 · 클래스 힌트 없음 · 진행 표시만 이름 바뀜) |
| `spikes/tiro-share-observe.mjs` | Playwright 관찰 하네스. (b)(c) 실측용 |

**background 수신부는 만들지 않았습니다.** `chrome.runtime.sendMessage` 를 받아 세션에
쌓고 Native Messaging 으로 넘기는 일은 Phase 2 몫이고 이 게이트의 소유가 아닙니다.
그래서 지금 content script 의 `sendMessage` 는 "Receiving end does not exist" 로 떨어지고,
`entrypoints/tiro-share.content.ts` 의 `send()` 가 그것을 조용히 삼킵니다. Phase 1 의 정상 상태입니다.

## 측정값

### 이번 턴에 새로 측정한 것 (2026-09-02)

| 항목 | 값 | 측정 방법 | 시각 |
|---|---|---|---|
| Tiro 단위 시험 (`src/tiro/**`) | 36개 통과 · 실패 0 · exit 0 | `pnpm --filter @classmate/browser-extension exec vitest run src/tiro --reporter=verbose` | 2026-09-02 18:00 +0900 |
| 확장 전체 단위 시험 | 7파일 87개 통과 · 실패 0 · exit 0 | `pnpm --filter @classmate/browser-extension test` | 2026-09-02 18:04 +0900 |
| 확장 타입 검사 | 오류 0 · exit 0 | `pnpm --filter @classmate/browser-extension typecheck` | 2026-09-02 18:04 +0900 |
| 관찰 하네스 공백 계산 (합성 입력 5종) | 조용히 시작(첫 사건 120초 뒤) 공백 0회 · 도중 60초 끊김 1회 · 꼬리 끊김 1회 · 사건 0건 1회 · 사건 1건 0회 — 모두 기대와 일치 | `summarize()` 를 임시 스크립트에서 직접 불러 확인(저장소 밖) | 2026-09-02 18:00 +0900 |
| 세그먼트의 계약 적합성 | 5개 모두 `transcript-segment.schema.json` 통과 (Ajv 오류 0) | `share-observer.test.ts` 안에서 `createValidator('transcript-segment')` | 2026-09-02 17:14 +0900 |
| 관찰 하네스 문법 검사 | 통과 · exit 0 | `node --check spikes/tiro-share-observe.mjs` | 2026-09-02 17:17 +0900 |
| 관찰 하네스 사용법 출력 | 사용법 출력 후 exit 2 | `node spikes/tiro-share-observe.mjs` (환경변수 없이) | 2026-09-02 17:17 +0900 |
| 관찰 하네스 스모크 (합성 페이지 · 6초) | 사건 17건 · 문단 7개 · 확정 6개 · 지연 p50 1,196ms · p95 1,213ms · 30초 공백 0회 · exit 0 | 로컬 임시 HTML(300ms 마다 문단이 자라는 가짜 페이지)을 `file://` 로 열어 실행 | 2026-09-02 17:18 +0900 |
| 스모크 기록 파일에 본문 유출 | 0건 (`{"t","index","state","chars"}` 만) | `grep -c "OrderService|컨테이너|주문" spikes/out/*.jsonl` | 2026-09-02 17:18 +0900 |
| (a) MCP 경로 문단 수·지연 | **미측정** (BLOCKED) | — | — |
| (b) 60분 연속 유지 · 이벤트 공백 | **미측정** (BLOCKED) | — | — |
| (c) 발화 → 화면 지연 | **미측정** (BLOCKED) | — | — |

> 스모크의 지연 p50 1,196ms 는 **가짜 페이지가 4틱(300ms×4)마다 문단을 확정하도록 만든 값**입니다.
> Tiro 의 실제 지연이 아닙니다. 하네스가 전이를 놓치지 않는지만 확인한 숫자입니다.

### 옮겨 적음 — iPhone Tiro Real-time 녹음 (2026-09-01 교실)

- 25분 9초 녹음 → 25문단(12:01:18 ~ 12:21:03), 원문 6,620자.
- 문단별 시각 있음(종료 후 노트). 화자 구분 없음.
- 노트북 내장 마이크 대안은 -46.4 LUFS 로 탈락.

### 옮겨 적음 — 공유 페이지 스트리밍 (2026-09-02 · Chrome 4분 관찰)

| 항목 | 값 |
|---|---|
| 갱신 방식 | 새로고침 없이 단어 단위 스트리밍(약 0.1초 간격), 중간 인식 결과가 나중에 교정됨 |
| 증가량 | 85초에 552 → 982자 · 새로고침 뒤 90초에 1,151 → 1,508자 |
| 백그라운드 탭 | hidden 상태에서도 215건 DOM 변경 계속 수신 |
| 최초 로드 | `POST api.tiro.ooo/v1/notes/share/<id>` 1회, 이후 갱신은 별도 실시간 채널(REST 폴링 아님) |
| DOM 구조 | `main` 안에 문단 `div.whitespace-pre-wrap` 이 순서대로 쌓임 |
| 확정/진행 구분 | 작성 중인 마지막 문단만 `font-semibold`, 확정 문단은 `font-medium text-tds-fg-subtle` |
| 문단 시각 | 녹음 중 공유 페이지에는 **없음**(종료 후 노트에만) → 확장이 도착 시각을 직접 기록 |

### 옮겨 적음 — Tiro 전사 오류 유형 (보정 사전 초기값)

애노테이션 → 언어테이션 · MVN → 엔브이엔 · Gradle → 그레이드 · 클래스명 음차.
교시 종료 후 Tiro 최종본 + IntelliJ 식별자로 교정.

### 옮겨 적음 — Tiro API 이벤트

`note.created`, `note.recording.completed`(일시정지 시), `note.ended`. **문장 단위 실시간 이벤트 없음.**

## 재현 명령

### 커넥터 단위 시험 — Gate A 것만 (저장소 루트 · Windows · Git Bash)

```bash
pnpm --filter @classmate/browser-extension exec vitest run src/tiro --reporter=verbose
```

```
 RUN  v4.1.11 C:/Users/elddl/kodonghui_myWs/corthex-classmate/apps/browser-extension

 ✓ src/tiro/share-parser.test.ts > parseSharePage — 확정과 진행 중 구분 > font-semibold 가 붙은 마지막 문단만 진행 중으로 봅니다 1ms
 ✓ src/tiro/share-parser.test.ts > parseSharePage — 클래스 힌트가 한 쪽만 남았을 때 > 확정 힌트만 남으면 class-partial 이고 마지막 문단은 확정으로 내보내지 않습니다 1ms
 ✓ src/tiro/share-parser.test.ts > parseSharePage — 클래스 힌트가 한 쪽만 남았을 때 > 진행 힌트만 남아도 class-partial 이고 앞 문단은 구조 폴백으로 확정이 됩니다 0ms
 ✓ src/tiro/share-parser.test.ts > parseSharePage — 마지막 문단은 확정 표시가 있을 때만 확정 > 앞 문단에 진행 힌트가 남아 있어도 표시 없는 마지막 문단을 확정으로 만들지 않습니다 0ms
 ✓ src/tiro/share-parser.test.ts > parseSharePage — 폴백 > 클래스 힌트가 사라지면 마지막 문단만 진행 중으로 보는 구조 폴백이 걸립니다 0ms
 ✓ src/tiro/share-observer.test.ts > startShareObserver — 진행 → 확정 전이 > stop() 뒤에 scanNow() 를 손으로 불러도 세그먼트도 partial 도 나가지 않습니다 1ms
 ✓ src/tiro/share-observer.test.ts > startShareObserver — 클래스 이름이 바뀐 페이지 > 확정 표시가 없는 마지막 문단은 세그먼트로 내보내지 않고 partial 로만 냅니다 1ms
 ✓ src/tiro/share-observer.test.ts > 만들어진 세그먼트가 contracts 스키마를 통과합니다 > transcript-segment.schema.json 검증을 모두 통과합니다 24ms

 Test Files  2 passed (2)
      Tests  36 passed (36)
EXIT=0
```

### 확장 전체 단위 시험 (저장소 루트)

```bash
pnpm --filter @classmate/browser-extension test
```

```
 Test Files  7 passed (7)
      Tests  87 passed (87)
TEST_EXIT=0
```

> 전체 개수(87)에는 다른 게이트의 시험이 함께 들어 있어 그쪽이 시험을 더하면 바뀝니다.
> Gate A 판정의 근거는 위의 `src/tiro` 실행(36개)입니다.

### 타입 검사 (저장소 루트)

```bash
pnpm --filter @classmate/browser-extension typecheck
```

```
$ tsc --noEmit
TYPECHECK_EXIT=0
```

### 관찰 하네스 — 인자 없이 (저장소 루트)

```bash
node --check spikes/tiro-share-observe.mjs   # 문법 검사 · exit 0
node spikes/tiro-share-observe.mjs           # 사용법 · exit 2
```

```
TIRO_SHARE_URL 환경변수가 없어요. 공유 링크는 인자가 아니라 환경변수로 넘깁니다.

Gate A 관찰기 — 녹음 중인 Tiro 공유 페이지를 지켜보고 지연만 잰다.

  TIRO_SHARE_URL="<녹음 중인 공유 링크>" node spikes/tiro-share-observe.mjs [옵션]
...
EXIT=2
```

### 관찰 하네스 — (b)(c) 실측 (사람이 링크를 준 뒤 · 저장소 루트)

```bash
TIRO_SHARE_URL="<녹음 중인 공유 링크 · 채팅에만>" node spikes/tiro-share-observe.mjs --minutes 60
# 비밀번호가 걸린 링크면
TIRO_SHARE_URL="…" TIRO_SHARE_PASSWORD="…" node spikes/tiro-share-observe.mjs --minutes 60
```

- 공유 URL 과 비밀번호는 **명령 인자가 아니라 환경변수로만** 넘긴다(셸 기록·로그 노출 방지).
- 기록은 `spikes/out/tiro-observe-<시각>.jsonl` 이고 `{ t, index, state, chars }` 만 담는다.
  본문은 파일에도 화면에도 남지 않는다. `out/` 은 `.gitignore` 대상이다.
- 끝나면 문단 수 · 진행→확정 지연 p50/p95/최대 · 첫 사건까지 대기 시간 · 30초 넘는 이벤트 공백
  횟수만 stdout 에 나온다. 첫 사건까지의 대기는 공백 횟수에 넣지 않는다(조용히 시작한 관찰이
  통째로 실패로 잡히지 않게 하려는 것이다).
- 중간에 `Ctrl+C` 를 누르면 거기까지의 통계를 낸다.

합성 페이지로 하네스만 먼저 확인하고 싶으면 `TIRO_SHARE_URL` 에 로컬 `file://` HTML 을 넣고
`--minutes 0.1` 로 돌린다(위 측정값 표의 스모크가 그 방법이다). 실제 공유 링크는 쓰지 않는다.

## 결정에 미치는 영향

- 기본 커넥터는 `createShareConnector`(2순위)다. `createApiConnector`(1순위)는 스텁이고
  (a) 측정이 끝나야 채운다. 판정이 뒤집히면 `docs/DECISIONS.md` 에 "Tiro 기본 커넥터 = ?" 를 적는다.
- **폴링 금지.** 백그라운드 탭에서 `setInterval` 은 스로틀되므로 관찰기는 `MutationObserver` 만 쓴다.
  선택자 깨짐 유예(기본 30초)도 타이머가 아니라 **다음 DOM 변경이 왔을 때** 잰다.
- 확정/진행 판별은 **문단마다 따로** 두 겹으로 한다. ① 그 문단에 붙은 클래스 힌트
  (`font-semibold` → 진행 중, `font-medium` · `text-tds-fg-subtle` → 확정)
  ② 힌트가 없으면 구조 폴백(마지막 문단 = 진행 중, 앞 문단 = 확정).
  다른 문단의 클래스를 근거로 쓰지 않는다. **마지막 문단은 확정 표시가 명시적으로 있을 때만 확정**이다.
  예전에는 "진행 중 문단이 하나라도 있으면 나머지는 전부 확정"이라 앞 문단에 `font-semibold` 가 남고
  마지막 문단의 표시만 바뀐 배포에서 아직 자라는 문단이 곧바로 확정으로 새어 나갔다.
  확정 세그먼트는 한 번 나가면 취소가 안 되므로 애매하면 진행 중 쪽에 둔다.
- 파서는 클래스를 얼마나 믿을 수 있었는지를 `stateSource: 'class' | 'class-partial' | 'structure' | 'none'`
  으로 알려 준다. 두 힌트가 다 보이면 `'class'`, **한 쪽만** 보이면 `'class-partial'`(녹음이 멈춘 것인지
  한 쪽 클래스 이름이 바뀐 것인지 페이지만 보고는 못 가른다 · 약한 경보), 하나도 없으면 `'structure'`(강한 경보),
  문단을 못 잡았으면 `'none'`. Phase 2 사이드패널이 어느 등급부터 사람에게 알릴지는 아직 안 정했다.
- 관찰기 손잡이의 `scanNow()` 는 `stop()` 뒤에 부르면 **아무것도 내보내지 않고** 마지막으로 훑은
  결과를 그대로 돌려준다. 손잡이가 밖으로 나가 있어 멈춘 뒤에도 부를 수 있고, 그때 세그먼트가
  계속 나가면 이미 정리된 교시에 문장이 덧붙는다.
- 관찰 하네스의 "이벤트 공백"은 **사건과 사건 사이**만 센다. 관찰 시작 ~ 첫 사건은 전사가 끊긴 것이
  아니라 사람이 말을 시작하기까지의 대기라 공백으로 세지 않고 `firstEventAfterMs` 로 따로 낸다.
  마지막 사건 ~ 관찰 끝은 공백으로 센다(도중에 끊긴 것과 뜻이 같다).
- 선택자가 완전히 깨지면(문단 0개가 30초 지속) `tiro.selector_broken` 을 한 번 보낸다.
  Phase 2 사이드패널은 이것을 호박색 `SourceFooter` 로 받는다
  ("전사 수신이 멈췄어요 · 공유 페이지를 새로고침해 주세요").
- 진행 중 문단은 `TranscriptSegment` 로 만들지 않는다. 순번과 id 는 확정될 때 비로소 정해진다.
  가짜 순번을 붙이면 세션 기록에 그대로 새어 나간다. 대신 `TiroPartial`(순번·id 없음)로 보낸다.
- 교시 식별자는 지금 `makePeriodId(new Date(), 1)` 로 임시 고정이다.
  Phase 2 의 세션 관리(다른 소유)가 실제 교시 번호를 넘겨 주면 갈아 끼운다.

## 사람이 할 일

### 1. Tiro MCP 인증 — (a) 측정의 전제 · **대기**

Claude Code 가 대신 할 수 없다(브라우저 구글 로그인이 필요하다).

1. 대화형 Claude Code 세션에서 `claude` 를 실행하고 프로젝트 MCP 승인 프롬프트에서 `.mcp.json` 의 `tiro` 를 승인한다.
2. `/mcp` → `tiro` → **Authenticate** → 열리는 브라우저에서 구글 로그인.
3. 돌아와 `/mcp` 에서 `tiro` 가 `connected` 인지 확인한다.
4. 확인되면 Claude 에게 "tiro MCP 인증했어요" 라고 알린다. 그 뒤 `auth_status` → `get_note_transcript` 순서로 (a) 를 잰다.

### 2. Tiro Max 결제 — **대기 · 사람 결정**

무료 300분 · 노트당 50분 열람 제한으로는 60분 교시를 못 담는다. 결제 여부는 사람이 정한다.
Claude 는 결제 화면을 열지도 진행하지도 않는다.

### 3. 녹음 중 공유 링크 전달 — (b)(c) 측정의 전제 · **대기**

1. 다음 수업 시작 전, 휴대폰 Tiro 에서 새 노트를 **Real-time** 으로 만든다.
2. 노트의 공유 링크를 만든다. 비밀번호를 걸었으면 비밀번호도 함께 준비한다.
3. 링크와 비밀번호를 **채팅으로만** 준다. 파일·커밋·스크린샷에 넣지 않는다.
4. Claude 는 받은 값을 그 자리에서 환경변수로만 쓰고 어디에도 적지 않는다:
   ```bash
   TIRO_SHARE_URL="<링크>" TIRO_SHARE_PASSWORD="<비밀번호>" \
     node spikes/tiro-share-observe.mjs --minutes 60
   ```
5. 60분 뒤 stdout 의 통계를 이 문서 `## 측정값` 표의 (b) 줄에 옮겨 적는다.
   합격 기준: **30초 넘는 이벤트 공백 0회 · 새로고침 없이 60분 · 진행→확정 지연 95%가 30초 이내.**
6. 끝나면 Tiro 에서 공유 링크를 회수한다.

### 4. (c) 발화 → 화면 지연 눈으로 1회 — **대기**

1. 녹음 중 공유 페이지를 화면에 띄운다.
2. 시계를 보며 짧은 문장 하나를 말하고, 그 문장이 화면에 처음 나타난 시각을 잰다. 3회 반복한다.
3. 세 값을 `## 측정값` 표의 (c) 줄에 적는다. 합격 기준은 30초 이내다.

### 5. 새로고침 후 복구 확인 — **대기 (3번과 함께)**

1. 위 3번 관찰이 도는 동안 20분쯤 지난 시점에 Chrome 창(`--headed` 로 띄운 것)에서 F5 를 한 번 누른다.
2. 새로고침 뒤에도 사건이 계속 기록되는지, `jsonl` 의 `t` 가 이어지는지 본다
   (하네스가 `addInitScript` 로 관찰기를 다시 심고 시간축 원점을 Node 가 잡고 있다).
3. 결과를 `## 측정값` 표에 한 줄 더 적는다.

### 6. 실제 확장에서 커넥터가 도는지 확인 — **대기 (Phase 2 수신부 이후)**

지금은 background 수신부가 없어 메시지가 갈 곳이 없다. Phase 2 에서 수신부가 붙은 뒤
`pnpm --filter @classmate/browser-extension dev` → Chrome 에 `.output/chrome-mv3-dev` 로드 →
공유 페이지 탭에서 `tiro.segment` 가 들어오는지 본다. 그전에 하면 콘솔에 연결 오류만 보인다.

## 남은 위험

| 위험 | 무엇이 깨지나 | 지금 대비한 것 | 남은 것 |
|---|---|---|---|
| Tailwind 클래스가 배포마다 바뀜 | `font-semibold` / `font-medium` 판별이 무너져 확정/진행이 뒤섞임 | 문단별 구조 폴백(표시 없는 마지막 문단 = 진행 중) + `stateSource` 로 힌트가 얼마나 남았는지 알림. 한 쪽만 남으면 `'class-partial'`, 하나도 없으면 `'structure'` | 클래스가 바뀐 것을 **사람에게 알리는 경로**가 없다. `'class-partial'` · `'structure'` 중 어느 등급부터 배너로 올릴지 Phase 2 에서 정한다 |
| 진행 표시만 이름이 바뀌어 마지막 문단이 계속 진행 중으로 남음 | 녹음이 끝나도 마지막 문단이 세그먼트가 되지 않아 교시 마지막 한 문단이 빠짐 | 확정으로 잘못 내보내는 것보다 낫다고 보고 진행 중 쪽에 둔다(확정은 취소가 안 됨). `stateSource === 'class-partial'` 로 드러남 | 교시 종료 시점에 남은 진행 중 문단을 확정으로 넘기는 마무리 처리가 필요하다. 세션 종료를 아는 쪽(Phase 2 세션 스토어) 몫이다 |
| `whitespace-pre-wrap` 자체가 사라짐 | 문단을 하나도 못 잡음 | 선택자 4단계 + 30초 유예 뒤 `tiro.selector_broken` | 사이드패널 호박색 배너는 Phase 2 몫 |
| 60분을 못 버팀 (메모리·연결) | 수업 중간에 전사가 끊김 | 하네스는 준비됨 | **아직 안 재봤다.** (b) 가 BLOCKED |
| 확정 문단이 나중에 교정됨 | 이미 낸 세그먼트의 글자가 페이지에서 바뀌어도 확장은 모름 | 문단 번호별로 딱 한 번만 냄(중복 방지) | 교정 반영은 교시 종료 후 Tiro 최종본으로 덮는 Phase 3 몫 |
| 새로고침하면 문단 번호가 처음부터 다시 셈 | 확장 쪽 관찰기(`share-observer`)는 새 문서에서 seq 를 1부터 다시 매김 | 하네스 쪽은 시간축 원점을 Node 가 잡아 이어 붙임 | 확장 쪽 seq 이어 붙이기는 세션 스토어(Phase 2)가 맡아야 한다. 지금 커넥터만으로는 새로고침이 곧 중복이다 |
| 교시 번호가 임시값 1 로 고정 | 8교시가 모두 `…-p1` 로 섞임 | `PLACEHOLDER_PERIOD_NUMBER` 상수로 드러내 둠 | Phase 2 세션 관리가 실제 번호를 넘겨야 한다 |
| MCP 경로가 실시간이 아닐 수 있음 | 1순위가 영영 못 오름 | 2순위가 이미 합격이라 제품은 돌아감 | (a) 측정 전까지는 모름 |
| Tiro 무료 한도(노트당 50분 열람) | 60분 교시 뒷부분을 못 봄 | 없음 | 결제는 사람 결정 |
