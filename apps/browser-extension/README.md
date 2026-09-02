# @classmate/browser-extension

Corthex Classmate 의 Chrome 확장입니다. WXT · React 19 · TypeScript · Manifest V3 · Side Panel API 를 씁니다.
지금 단계(Phase 2 수직 슬라이스)에는 **듣는 중 · 자세히 두 화면**이 있고, 데이터는 fixtures 재생기가 채웁니다.
실제 커넥터(Tiro 공유 페이지 · Meet 캡처 · 로컬 도우미)는 `src/tiro/` · `src/capture/` 에 있지만 아직 패널에
배선되지 않았습니다(2라운드).

경로·명령은 모두 **Windows 로컬 · Git Bash · 저장소 루트 기준**입니다.

---

## 지금 들어 있는 것

```
apps/browser-extension/
├─ wxt.config.ts                  매니페스트(name·permissions·side_panel·content_scripts) · React 모듈
├─ entrypoints/
│  ├─ background.ts               MV3 서비스 워커 · 아이콘 클릭으로 사이드패널 열기 · 캡처 메시지
│  ├─ offscreen/                  Meet 탭 캡처용 Offscreen Document
│  ├─ tiro-share.content.ts       Tiro 공유 페이지 관찰 content script
│  └─ sidepanel/
│     ├─ index.html               사이드패널 진입 문서
│     ├─ main.tsx                 CSS 적재 순서 고정 → React 루트 붙이기
│     ├─ App.tsx                  `?replay=` 읽고 ReplayStore + PanelApp 조립
│     └─ style.css                패널 레이아웃(키트 클래스를 전체 창에 맞춤) · reduced-motion
├─ src/panel/                     사이드패널 화면과 재생기 (아래 절)
├─ src/tiro/                      Tiro 공유 페이지 커넥터 (README 있음)
├─ src/capture/                   Meet 캡처 파이프라인 (README 있음)
├─ src/lib/format-time.ts         10:32:18 형식 · "4초 전" 문구
├─ src/types/assets.d.ts          `*.jsonl?raw` 모듈 선언
├─ e2e/extension.spec.ts          확장 로드 E2E — 골든 시나리오 9장면 + 스크린샷
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
        ▼
screens/ListeningScreen.tsx · screens/DetailScreen.tsx     ui-classmate + ui-base 컴포넌트만
        ▲
PanelApp.tsx         useSyncExternalStore · 1초 tick · Alt+S(e.code === "KeyS") · window.classmateReplay
```

| 파일 | 역할 |
|---|---|
| `golden-bundle.ts` | fixture 묶음 로더 · 점선 낱말 `GOLDEN_TERMS`(`new`·`생성자`, fixture 에 답이 있는 것만) · 문장별 짐작 |
| `evidence.ts` | 계약 EvidenceLevel(confirmed/partial/inferred/stale) ↔ 디자인 Evidence(verified/partial/inferred/delayed) 대응표 |
| `clock.ts` · `transcript-lines.ts` | ISO ↔ `HH:MM:SS` · 전사 줄 나누기(점선 낱말 분리 · 도착 순 정렬) |
| `replay-store.ts` | 위 그림의 재생기 · `CHECKPOINTS` 9종과 라벨 |
| `lesson-view.ts` | 화면이 그릴 값 계산 · 화면 분기는 TutorState 가 아니라 `note` 축 |
| `replay-handle.ts` | `window.classmateReplay`(goto · 손짓) 설치/해제 |

### 재생 모드

| 주소 | 시계 | 쓰임 |
|---|---|---|
| `sidepanel.html` | 1초마다 `tick` — fixture 를 실시간처럼 흘림 | 손으로 얹어 볼 때 |
| `sidepanel.html?replay=manual` | 멈춤 — `window.classmateReplay.goto('answer')` 처럼 장면을 고름 | E2E · 스크린샷 |

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

# 확장 로드 E2E — 빌드본을 Chromium 에 얹고 골든 시나리오 9장면을 확인한 뒤 docs/screenshots/ 에 저장
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

## 2라운드에서 바뀔 것

| 지금 | 2라운드 |
|---|---|
| `ReplayStore` 가 fixture 사건을 흘림 | Tiro·Meet·로컬 도우미 이벤트를 같은 `pushEvent` 자리에 배선 |
| 듣는 중 · 자세히 두 화면 | 기록 · 설정 화면(상태 G) · 개인정보 문구 |
| 모의 제공자(fixture 답만 돌려줌) | 로컬 도우미의 provider-claude 경유 |
| `background.ts` 의 캡처 손시험 갈래 | 패널의 캡처 시작/중지 버튼 |
| ui-classmate 의 `internal/base` 복제 | `@classmate/ui-base` barrel 로 교체 |
