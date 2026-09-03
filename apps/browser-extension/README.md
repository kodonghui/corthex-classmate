# @classmate/browser-extension

Corthex Classmate 의 Chrome 확장입니다. WXT · React 19 · TypeScript · Manifest V3 · Side Panel API 를 씁니다.
지금 단계(Phase 2 · 2라운드)에는 **듣는 중 · 자세히 · 기록 · 설정 네 화면**이 있고, 데이터는 두 갈래 중 하나가
채웁니다 — 주소에 `?replay=` 가 없으면 **라이브**(서비스 워커 → Tiro 공유 페이지 · Meet 캡처 · 로컬 도우미),
있으면 **fixtures 재생기**(E2E · 스크린샷 · 손으로 얹어 보기). 조립은 `entrypoints/sidepanel/App.tsx` 한 곳입니다.

경로·명령은 모두 **Windows 로컬 · Git Bash · 저장소 루트 기준**입니다.

---

## 지금 들어 있는 것

```
apps/browser-extension/
├─ wxt.config.ts                  매니페스트(name·permissions·side_panel·content_scripts) · React 모듈
├─ entrypoints/
│  ├─ background.ts               MV3 서비스 워커 — **배선만** (판단은 `src/background/**`)
│  ├─ offscreen/                  Meet 탭 캡처용 Offscreen Document
│  ├─ tiro-share.content.ts       Tiro 공유 페이지 관찰 content script
│  └─ sidepanel/
│     ├─ index.html               사이드패널 진입 문서
│     ├─ main.tsx                 CSS 적재 순서 고정 → React 루트 붙이기
│     ├─ App.tsx                  `?replay=` 로 라이브(ReplayStore.live + attachLive) / fixture 스토어를 고름
│     └─ style.css                패널 레이아웃(키트 클래스를 전체 창에 맞춤) · reduced-motion
├─ src/panel/                     사이드패널 화면과 재생기 (아래 절)
├─ src/background/                서비스 워커의 판단 — 라우터 · 도우미 연결 · 교시 로그 (아래 절)
├─ src/live/                      패널 ↔ 서비스 워커 메시지 타입과 패널 쪽 어댑터 (아래 절)
├─ src/tiro/                      Tiro 공유 페이지 커넥터 (README 있음)
├─ src/capture/                   Meet 캡처 파이프라인 (README 있음)
├─ src/lib/format-time.ts         10:32:18 형식 · "4초 전" 문구
├─ src/types/assets.d.ts          `*.jsonl?raw` 모듈 선언
├─ e2e/extension.spec.ts          확장 로드 E2E — 골든 시나리오 14장면(수업 흐름 9 + 얹는 화면·폭 5) + 스크린샷
└─ tsconfig.json · vitest.config.ts · playwright.config.ts
```

### `src/panel/` — 화면은 tutor-core 가 낸 상태만 그립니다

```
fixtures/synthetic-class/golden-ioc/*        전사·프레임·편집기·질문·답·사건 27줄
        │ golden-bundle.ts  (import 만 · 스키마 검증은 시험에서)
        ▼
ReplayStore (replay-store.ts)
  ├─ advanceTo(시각)   fixture 사건을 시각순으로 tutor-core `transition` 에 넣음
  ├─ 손짓             catchTerm · catchSentence · chooseGuess · chip · openDetail · back · expand · followUp
  ├─ 모의 제공자       `ask` 효과 → 2초 뒤 fixture 의 답(answer.completed) 또는 answer.failed
  └─ goto(체크포인트)  장면 9종을 결정적으로 재현 (E2E 가 씀)
        │ getState() → { machine, now, screen, moments, choosing, chip, reply, emitted }
        ▼
lesson-view.ts       ListeningView · DetailView — 4/5 줄 규칙 · 자료 나이 · 접힘 문구 · 절 4종
history-view.ts      HistoryView   — 교시 묶음 · MomentRow 줄 · 바닥 안내 · "기록 중" 바닥줄
settings-store.ts    설정 값 아홉 개 — chrome.storage.local 에서 읽고 씀
        ▼
screens/  ListeningScreen.tsx      A·B·D·E — 듣는 중 · 붙잡음 · 문장 · 접힌 메모
          DetailScreen.tsx         F      — 자세히
          HistoryScreen.tsx        G      — 기록 (바닥줄 카운트로 들어감)
          SettingsScreen.tsx       설정   — 헤더 설정 아이콘(settings-2)으로 들어감
                                   넷 다 ui-classmate + ui-base 컴포넌트만 씁니다
        ▲
PanelApp.tsx         useSyncExternalStore · 1초 tick · Alt+S(e.code === "KeyS") · window.classmateReplay
                     얹는 화면(기록·설정)은 스토어 체크포인트가 아니라 PanelApp 이 얹습니다
```

| 파일 | 역할 |
|---|---|
| `golden-bundle.ts` | fixture 묶음 로더 · 점선 낱말 `GOLDEN_TERMS`(`new`·`생성자`, fixture 에 답이 있는 것만) · 문장별 짐작 |
| `evidence.ts` | 계약 EvidenceLevel(confirmed/partial/inferred/stale) ↔ 디자인 Evidence(verified/partial/inferred/delayed) 대응표 |
| `clock.ts` · `transcript-lines.ts` | ISO ↔ `HH:MM:SS` · 전사 줄 나누기(점선 낱말 분리 · 도착 순 정렬) |
| `replay-store.ts` | 위 그림의 재생기 · `CHECKPOINTS` 9종과 라벨 · 라이브 모드 `ReplayStore.live({periodId, startMs, askPort})` |
| `lesson-view.ts` | 듣는 중·자세히 화면이 그릴 값 계산 · 화면 분기는 TutorState 가 아니라 `note` 축 |
| `history-view.ts` | 기록 화면(G)이 그릴 값 · `state.moments` 와 **도착한** 답에서만 만듭니다(지어낸 줄을 섞지 않으려고) |
| `settings-store.ts` | 설정 값 아홉 개 · `chrome.storage.local` 보관소는 주입받습니다(모듈 최상위에서 `chrome` 을 만지지 않음) · 키 이름은 서비스 워커와 나눠 쓰는 고정 계약 |
| `ports.ts` | 스토어와 바깥(라이브 어댑터 · 서비스 워커)이 만나는 자리의 **타입만** 둡니다(2라운드 고정 계약 (다)) |
| `event-ids.ts` | 라이브 모드에서 패널이 스스로 만드는 사건·질문 id (`ev-<periodId>-x…` · `q-<periodId>-x…`) · 가운데 `x` 로 호스트가 만든 id 와 갈립니다 |
| `replay-handle.ts` | `window.classmateReplay`(goto · 손짓) 설치/해제 |

### 재생 모드

| 주소 | 데이터 | 시계 | 쓰임 |
|---|---|---|---|
| `sidepanel.html` | **라이브** — 서비스 워커 포트(`classmate-panel`)로 전사·화면·편집기·튜터 사건이 들어옴 | 1초마다 `tick`(`Date.now()`) | 실제 수업 |
| `sidepanel.html?replay=auto` | fixture | 1초마다 `tick` — fixture 를 실시간처럼 흘림 | 손으로 얹어 볼 때 |
| `sidepanel.html?replay=manual` | fixture | 멈춤 — `window.classmateReplay.goto('answer')` 처럼 장면을 고름 | E2E · 스크린샷 · 정본 비교 |

---

## 서비스 워커 구조

`entrypoints/background.ts` 는 **배선만** 합니다. 판단은 전부 `src/background/**` 에 있습니다.
`entrypoints/**` 는 vitest 대상이 아니기 때문에(`vitest.config.ts` 의 `include` 가
`src/**/*.test.ts`), 여기에 판단을 두면 시험할 방법이 없습니다.

```text
                  ┌──────────────── entrypoints/background.ts (배선) ────────────────┐
                  │                                                                  │
 content script ──┼─ chrome.runtime.onMessage ──▶ Router.handleRuntimeMessage         │
 Offscreen 문서 ──┤                              └▶ 캡처 시작·정지·프레임(이 파일 몫) │
                  │                                                                  │
 사이드패널 ──────┼─ chrome.runtime.onConnect ──▶ Router.openPanel / handlePanelMessage
                  │   (이름 "classmate-panel")     / closePanel                       │
                  │                                                                  │
 로컬 도우미 ─────┼─ chrome.runtime.connectNative("com.corthex.classmate")            │
                  │        └▶ NativeHostClient ──▶ Router.handleHostPush / handleHostStatus
                  │                                                                  │
 알람 ────────────┼─ chrome.alarms ──▶ keepalive(1분) · 교시 30분 종료                │
                  └──────────────────────────────────────────────────────────────────┘
```

| 파일 | 역할 |
|---|---|
| `src/background/router.ts` | **순수 라우터.** `chrome` 을 직접 만지지 않고 주입된 얼굴로만 움직입니다. 아래 메시지 표가 전부 여기 있습니다 |
| `src/background/host-client.ts` | 도우미 연결 — FIFO 짝짓기 · `hello` 왕복 뒤에야 "연결됨" · 백오프 1·2·4…≤30초 · 끊긴 동안 `event.append`/`frame.store` 보관(상한 200) |
| `src/background/host-messages.ts` | 확장 ↔ 도우미 봉투(`ping` · `event.append` · `tutor.ask` · `tutor.retry`)와 좁힘 함수 |
| `src/background/period-log.ts` | 이번 교시에 패널로 보낸 말 **최근 500건**(세그먼트 본문 포함). 패널을 닫았다 열면 이것을 되풀이합니다 |
| `src/background/ids.ts` | 사건 이름표 `ev-<periodId>-s<8자리>-<순번>` · `at` 을 `+09:00` 으로 적기 |
| `src/background/settings.ts` | `classmate.periodNumber` · `classmate.subject` · `classmate.provider` 읽기(쓰기는 설정 화면 몫) |
| `src/background/tiro-messages.ts` | `tiro.*` 이름과 좁힘 함수 — content script 와 라우터가 같이 봅니다 |
| `src/live/messages.ts` | 패널 ↔ 서비스 워커 메시지 타입 — 패널과 워커가 같이 봅니다 |
| `src/live/attach.ts` | 패널 쪽 어댑터 `attachLive({inbox, outbox}, chrome.runtime)` |

### 메시지 표 — 들어온 말 → 나가는 것

| 들어온 말 | 도우미로 | 사이드패널로 |
|---|---|---|
| `tiro.segment {segment}` | `event.append` `transcript.segment {segmentId, seq, state, segment}` | 같은 사건 + `live.segment` |
| `tiro.partial {partial}` | — | `live.segment`(`state:"partial"`, 식별자는 문단 자리로 고정) |
| `tiro.hint_degraded {signal}` | `connector.status {tiro-share, paused, "hint-<등급>"}` · 회복하면 `connected` | 같은 사건 |
| `tiro.selector_broken {signal}` | `connector.status {tiro-share, paused, "selector-broken"}` | 같은 사건 |
| `capture.stats {state,…}` | `connector.status {meet-tab, …}` — **바뀔 때만** | 같은 사건 |
| `capture.error {reason}` | `connector.status {meet-tab, off, reason}` | 같은 사건 |
| `capture.frame {frame, bytes}` | `frame.store` 봉투(1 MiB 넘으면 건너뜀 · 꺼져 있으면 60장까지 보관) | `live.frame` |
| `panel.event` `question.asked` | **붙이지 않음** — 도우미가 `tutor.ask` 를 받아 자기 기록본을 만들고 `tutor.event` 로 되밉니다 | — |
| `panel.event` 그 밖(`state.changed` · `panel.*`) | `event.append` 그대로(패널이 지은 `id` 를 씁니다) | — (보낸 패널이 이미 압니다) |
| `panel.ask {request}` | `tutor.ask {periodId, questionId, kind, word?, question?, provider, snapshot}` | 답이 `error` 면 `connector.status {provider, …}` |
| `classmate.reconnect {native-host}` | 백오프를 기다리지 않고 지금 다시 붙습니다 | — |
| `classmate.reconnect {tiro-share}` | 전사를 보내 온 탭에 `chrome.tabs.sendMessage` 로 `tiro.stop` → `tiro.start` | — |
| `classmate.reconnect {meet-tab}` | 캡처 정지 → 마지막 탭으로 다시 시작 | — |
| `classmate.reconnect {provider}` | 마지막 미완 질문으로 `tutor.retry` | 답이 `error` 면 `connector.status {provider, …}` |
| 도우미 push `tutor.event {event}` | — (이미 도우미 안에 있습니다) | `live.event` |

`connector.status` 는 **같은 상태가 이어지면 다시 내지 않습니다.** `capture.stats` 가 1초마다
오기 때문에, 그대로 사건으로 만들면 60분 교시에 3,600줄이 쌓입니다.

`chrome.runtime.sendMessage` 는 **content script 에 닿지 않습니다.** 확장 안의 다른 문서
(Offscreen · 사이드패널)에만 배달되므로, `tiro.stop`·`tiro.start` 는 `chrome.tabs.sendMessage`
로 탭을 찍어 보냅니다. 탭은 `chrome.tabs.query({url})`(= `tabs` 권한이 더 필요) 로 찾지 않고
**우리에게 전사를 보내 온 탭**(`sender.tab.id`)을 적어 두었다가 그 탭에만 되말합니다.

### 사건 이름표와 시각

| 누가 만든 사건 | `id` 모양 |
|---|---|
| 패널 스토어 | `ev-<periodId>-x<8자리>-<순번>` |
| **서비스 워커** | `ev-<periodId>-s<8자리>-<순번>` |
| 로컬 도우미 | `ev-<periodId>-<8자리>` |

8자리 토큰은 서비스 워커가 시작할 때 `crypto.randomUUID().slice(0,8)` 로 한 번 정합니다.
MV3 워커는 30초를 놀면 내려갔다 다시 뜨는데, 그때마다 토큰이 새로 뽑히므로 순번이 1로
돌아가도 앞 세대와 이름이 겹치지 않습니다. `at` 은 언제나 `+09:00` 표기입니다
(`toISOString()` 은 `Z` 로 적어 계약 예시와 어긋납니다).

교시 식별자는 **오늘 날짜 + 저장소의 교시 번호**로 정합니다 — `2026-09-02-p3`. 계약
`PeriodId` 의 정규식이 이 모양이고, 도우미가 이 이름으로 세션 파일과 프레임 폴더를 만듭니다.

### 끊겼다 다시 붙기

| 무엇이 끊기나 | 어떻게 살아나나 |
|---|---|
| 사이드패널 닫기 → 열기 | 서비스 워커와 도우미는 계속 기록합니다. 다시 열면 교시 로그 500건을 처음부터 되풀이해 화면이 복원되고, 그 **뒤에** `panel.opened` 가 붙습니다 |
| 공유 페이지 새로고침 | content script 가 다시 주입되어 `seq` 1부터 다시 셉니다. 기록이 겹치지 않는 것은 도우미가 사건 `id` 로 중복을 걸러(`duplicate: true` = 성공) 주기 때문입니다 |
| 도우미 강제 종료 | `onDisconnect` → 백오프 1·2·4…≤30초. 끊긴 동안의 `event.append`·`frame.store` 는 들고 있다가 `hello` 왕복이 서면 순서대로 다시 보냅니다 |
| 서비스 워커가 30초 유휴로 내려감 | 교시 로그를 `chrome.storage.session` 에 옮겨 적어 두었다가 다시 뜰 때 되살립니다. 패널 포트도 스스로 다시 붙습니다(`attachLive`) |
| 패널이 30분째 닫혀 있음 | `chrome.alarms` 가 깨워 `period.ended {periodId, questionCount, frameCount}` 를 붙입니다 |

`nativeMessaging` 권한이 있어도 도우미가 HKCU 에 등록돼 있지 않으면 `connectNative` 는 포트를
주고 곧바로 끊습니다. **개발·E2E 에서는 그것이 정상 상태**라 백오프가 조용히 돌고
`console.error` 를 쓰지 않습니다(첫 끊김에만 `console.warn` 한 줄).

### 손 시험 갈래를 언제 지우나

`background.ts` 의 `chrome.action.onClicked` 리스너와 `globalThis.classmateCapture` 손잡이는
**사이드패널에 캡처 시작/중지 버튼이 생기면 함께 지웁니다.** 지금 남겨 둔 이유는 하나뿐입니다 —
`chrome.tabCapture.getMediaStreamId` 가 요구하는 "사용자 제스처" 를 만들 수 있는 자리가 지금은
아이콘 클릭뿐입니다. 버튼 클릭 자체가 그 제스처가 되므로 그때는 두 갈래가 필요 없습니다.
(`chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true})` 때문에 아이콘 클릭은 실제로
사이드패널만 열고 이 리스너는 불리지 않습니다. 손 시험 때 그 한 덩어리를 잠시 주석 처리하고
다시 빌드하면 살아납니다 — `docs/spikes/gate-b-meet.md` §사람이 할 일 1.)

### 확장 id 고정 (`CLASSMATE_EXTENSION_KEY`)

도우미의 `allowed_origins` 에 `chrome-extension://<id>/` 를 미리 적으려면 확장 id 가 고정돼야
합니다. `wxt.config.ts` 는 환경 변수 `CLASSMATE_EXTENSION_KEY` 가 **있을 때만** 그 값을
`manifest.key` 에 **그대로** 넣습니다(값을 검사하지 않습니다. 빈 key 가 들어가면 Chrome 이
확장을 아예 못 읽습니다). key 에서 id 를 뽑는 계산은 설치기(installer) 단위 몫입니다.

```bash
CLASSMATE_EXTENSION_KEY="<공개키 base64>" pnpm --filter @classmate/browser-extension build
```

---

## 개발 서버 실행

```bash
# 저장소 루트에서 (처음 한 번)
pnpm install

# 개발 서버 (파일을 고치면 다시 빌드됩니다)
pnpm --filter @classmate/browser-extension dev
```

`pnpm install` 은 `postinstall` 로 `wxt prepare` 를 돌려 `.wxt/tsconfig.json` 과 `#imports` 를 만듭니다.
**설치 전에는 `pnpm typecheck` 가 실패하는 것이 정상입니다.**

`dev` 는 `.output/chrome-mv3-dev/` 를 만듭니다.

---

## Chrome 에 얹기

WXT 의 `dev` 가 브라우저를 자동으로 띄우지 않았다면 손으로 얹습니다.

1. Chrome 주소창에 `chrome://extensions` 를 칩니다.
2. 오른쪽 위 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다** 를 누릅니다.
4. 아래 폴더를 고릅니다.

   | 무엇 | 폴더 |
   |---|---|
   | 개발 중 | `apps\browser-extension\.output\chrome-mv3-dev` |
   | 빌드본 | `apps\browser-extension\.output\chrome-mv3` |

   Git Bash 경로로는 각각 `apps/browser-extension/.output/chrome-mv3-dev`, `.../chrome-mv3` 입니다.

5. 목록에 **Corthex Classmate** 가 뜨면 됐습니다.

빌드본을 만들려면 이렇게 합니다.

```bash
pnpm --filter @classmate/browser-extension build
```

---

## 사이드패널 열기

1. Chrome 도구모음의 퍼즐 아이콘을 눌러 **Corthex Classmate** 를 **고정**합니다.
2. 고정한 아이콘을 한 번 누릅니다. 오른쪽에 사이드패널이 열립니다.
   (`background.ts` 의 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` 가 이 동작을 켭니다.)
3. 아이콘을 눌러도 안 열리면 `chrome://extensions` → Corthex Classmate → **서비스 워커** 를 눌러
   콘솔에 `[classmate] 확장이 설치됐어요` 가 찍혔는지 봅니다.
4. 열리면 fixture 가 실시간처럼 흐릅니다. 점선 낱말(`new`·`생성자`)을 누르거나 문장을 누르거나 **Alt+S** 를 칩니다.

---

## 폭 380px 확인법

사이드패널 기본 폭은 **380px** 기준이고 **320~520px** 에서 깨지지 않아야 합니다.

1. 사이드패널 안에서 오른쪽 클릭 → **검사** 를 누릅니다. 사이드패널 전용 DevTools 가 열립니다.
2. Console 탭에서 지금 폭을 확인합니다.

   ```js
   document.documentElement.clientWidth
   ```

3. 사이드패널과 브라우저 창의 경계선을 좌우로 끌어 폭을 바꿉니다.
   320 · 380 · 520 세 지점에서 이 세 가지를 봅니다.

   | 보는 것 | 합격 |
   |---|---|
   | 바닥줄 | `전사 4초 전 · Meet 2초 전 · IntelliJ 1초 전 · 기록 1` 이 잘리지 않고 한 줄로 남음 |
   | 헤더 | 44px 높이가 그대로이고 제목·시계가 잘리지 않음 |
   | 가로 스크롤 | 생기지 않음 (`document.body.scrollWidth <= clientWidth`) |

4. 여백(`--panel-inset`)은 폭에 따라 14 / 16 / 20px 로 바뀝니다. Console 에서 확인할 수 있습니다.

   ```js
   getComputedStyle(document.documentElement).getPropertyValue('--panel-inset')
   ```

---

## 검사와 테스트

```bash
# 단위 테스트 (Vitest · happy-dom 은 파일 머리 주석 `// @vitest-environment happy-dom` 으로만 켬)
pnpm --filter @classmate/browser-extension test

# 타입 검사 (pnpm install 이 끝난 뒤에만 됩니다)
pnpm --filter @classmate/browser-extension typecheck

# 확장 로드 E2E — 빌드본을 Chromium 에 얹고 골든 시나리오 14장면을 확인한 뒤 docs/screenshots/ 에 저장
#   수업 흐름 9장면(체크포인트) + 얹는 화면·폭 5장면(기록 · 설정 · 전사 멈춤 · 폭 360 · 폭 520)
npx playwright install chromium          # 처음 한 번
pnpm --filter @classmate/browser-extension build
pnpm --filter @classmate/browser-extension e2e
```

E2E 는 `chromium.launchPersistentContext` 에 `--load-extension` 으로 빌드본을 얹고, 서비스 워커 URL 에서 확장 id 를
읽어 `chrome-extension://<id>/sidepanel.html?replay=manual` 을 엽니다(사이드패널 자체는 브라우저 UI 라 Playwright 가
못 엽니다). 스크린샷은 `animations: 'disabled'` 로 찍습니다 — `.cm-tf__ln` · `.cm-ans` 의 `cm-fade-in` 도중에 찍으면
빈 화면이 남습니다. 장면표는 `docs/screenshots/README.md` 에 있습니다.

---

## CSS 적재 순서

`main.tsx` 가 이 순서로만 읽습니다. 순서가 바뀌면 나중 파일의 같은 이름 규칙이 앞 것을 덮습니다.

1. `@classmate/design-tokens/styles.css` — 변수 196개 · Pretendard · IBM Plex Mono (npm 에서 번들, CDN 없음)
2. `@classmate/ui-base/styles.css` — `.cm-btn` · `.cm-chip` · `.cm-disc` 같은 기본 부품
3. `@classmate/ui-classmate/styles.css` — `.cm-tf` · `.cm-note` · `.cm-ans` 같은 수업 부품
4. `./style.css` — 패널 레이아웃(`.cm-panel` · `.cm-screen` 을 전체 창에 맞춤) · reduced-motion

---

## 라이브 모드 배선 (`entrypoints/sidepanel/App.tsx`)

주소에 `?replay=` 가 없으면 `App.tsx` 의 `openLive(settings, chrome.runtime)` 가 이 순서로 조립합니다.

```text
readSettings(chrome.storage.local)    교시 번호 · 주제 · 제공자 · 자동 접기 (src/panel/settings-store.ts)
        │
        ▼
ReplayStore.live({ periodId: makePeriodId(오늘, 교시), startMs, subject, env: { provider, autoFold }, askPort })
        │                    ▲
        │                    └─ 스토어와 손잡이가 서로를 먼저 요구하므로 askPort 는 "나중에 생길 손잡이로
        │                       넘겨주는" 얇은 어댑터입니다(사람이 붙잡기 전에는 불리지 않습니다)
        ▼
attachLive({ inbox: store, outbox: store }, chrome.runtime) ──▶ { ask, reconnect, connected, detach }
        │
        ▼
<PanelApp store autoClock onReconnect={live.reconnect} />      패널이 닫히면 detach()
```

교시 id 는 서비스 워커와 **같은 함수**(`src/tiro/period.ts` 의 `makePeriodId`)와 같은 저장 키로
만듭니다. 패널이 만드는 사건·질문 id 가 서비스 워커의 교시 로그와 같은 교시를 가리켜야 하기 때문입니다.
`inbox` 와 `outbox` 로 같은 스토어 객체를 넘겨도 됩니다 — 두 인터페이스는 서로 겹치지 않습니다.
`attachLive` 의 세 번째 인자로 타이머와 `warn` 을 넣을 수 있습니다(시험에서 씁니다).

설정 화면에서 **잠가 둔 칸**: 답변 길이(한 줄만 먼저 / 바로 자세히) · 붙잡을 때 함께 저장 세 칸 ·
오늘 기록 지우기는 이번 라운드에 읽는 곳이 없어 `disabled` 로 두고 그 까닭을 칸 아래 한 줄로
적었습니다("… 다음 라운드에 켜져요"). 배선이 생기면 `disabled` 와 그 설명만 걷어 내면 됩니다
(오늘 기록 지우기의 확인 창과 `onClearToday` 배선은 남겨 두었습니다). 검토에서 "저장만 되고
읽는 곳이 없는 스위치" 로 잡혀 정직하게 잠근 것입니다(`docs/reviews/batch-2-review.md`).

수업 중 바로 적용되는 설정과 아닌 설정:

| 설정 | 언제 적용되나 | 길 |
|---|---|---|
| 제공자 · 자동 접기 | 바꾸는 즉시 | `PanelApp` → `ReplayStore.updateEnv({ provider, autoFold })`. 자동 접기를 끄면 이미 걸린 18초 접힘 시계도 그 자리에서 풀립니다 |
| 교시 번호 · 주제 | 패널을 다시 열 때부터 | 스토어를 만들 때 `periodId`·`subject` 가 박힙니다. 교시 중간에 바꾸면 사건 id(`ev-<periodId>-x…`)가 갈라지므로 계약 논의가 먼저입니다(`docs/TASKS.md`) |

바닥줄의 IntelliJ 나이는 진짜 편집기 문맥(`editor.context`)이 한 번이라도 와야 셉니다. 오기 전
(라이브 자리표시 편집기)에는 `—` 로 둡니다 — 패널을 연 시각을 "0초 전" 으로 세던 것을 고쳤습니다.

---

## 2라운드에서 바뀐 것 · 아직 남은 것

| 지금 | 상태 |
|---|---|
| `ReplayStore` 가 fixture 사건을 흘림 | **완료** — `?replay=` 없는 주소는 `ReplayStore.live` + `attachLive` 로 서비스 워커에 붙습니다(위 「라이브 모드 배선」) |
| `background.ts` 의 `MemoryFrameSink` | **교체 완료** — `NativeHostFrameSink`(도우미로 봉투 · 꺼져 있으면 60장 폴백) |
| 로컬 도우미 연결 없음 | **완료** — `connectNative("com.corthex.classmate")` · 백오프 1·2·4…≤30초 |
| 듣는 중 · 자세히 두 화면 | **완료** — 기록(G) · 설정 화면 · 개인정보 세 칸 · H-1 전사 멈춤 바닥줄(`docs/screenshots/README.md`) |
| 모의 제공자(fixture 답만 돌려줌) | **완료(도우미까지)** — 라이브에서는 `panel.ask` → `tutor.ask` → 도우미의 `TutorPipeline` → `tutor.event` 로 답이 옵니다. 도우미에 `CLASSMATE_CLAUDE_CLI` 가 없으면 `provider-unavailable` 로 답하고 패널은 `connector.status {provider, off}` 를 봅니다 |
| `background.ts` 의 캡처 손시험 갈래 | 남음 — 패널의 캡처 시작/중지 버튼이 생기면 지웁니다(위 「손 시험 갈래를 언제 지우나」) |
| IntelliJ MCP 연결 | 남음 — `router.pushEditor(context)` 와 `live.editor` 자리만 열어 두었습니다 |
| ui-classmate 의 `internal/base` 복제 | **완료** — 사본 8개는 지웠고 `src/internal/base/index.ts` 배럴 한 장만 남아 `@classmate/ui-base` 를 그대로 다시 내줍니다(`packages/ui-classmate/test/structure.test.ts` 가 "그 폴더에 `index.ts` 만 있다" 를 강제합니다) |
