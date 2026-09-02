# @classmate/browser-extension

Corthex Classmate 의 Chrome 확장입니다. WXT · React · TypeScript · Manifest V3 · Side Panel API 를 씁니다.
지금 단계(Phase 0)에는 **듣는 중 빈 화면 하나**만 있습니다. 버튼도 채도 있는 블록도 없습니다.

경로·명령은 모두 **Windows 로컬 · Git Bash · 저장소 루트 기준**입니다.

---

## 지금 들어 있는 것

```
apps/browser-extension/
├─ wxt.config.ts                  매니페스트(name·permissions·action) · React 모듈
├─ entrypoints/
│  ├─ background.ts               MV3 서비스 워커 · 아이콘 클릭으로 사이드패널 열기
│  └─ sidepanel/
│     ├─ index.html               사이드패널 진입 문서
│     ├─ main.tsx                 React 루트 붙이기
│     ├─ App.tsx                  듣는 중 빈 화면 (헤더 44px · 빈 상태 · SourceFooter)
│     └─ style.css                최소 스타일 (Phase 2 에 design-tokens 로 교체)
├─ src/lib/format-time.ts         10:32:18 형식 · "4초 전" 문구
├─ e2e/extension.spec.ts          확장 로드 E2E 골격 (Phase 2 까지 skip)
└─ tsconfig.json · vitest.config.ts · playwright.config.ts
```

화면 구조는 이렇습니다.

```
┌──────────────────────────────────────┐
│ ● Corthex Classmate                  │ ← 헤더 44px · 상태 점 1개
├──────────────────────────────────────┤
│                                      │
│        아직 붙잡은 순간이 없어요        │ ← 본문 빈 상태
│                                      │
├──────────────────────────────────────┤
│ 전사 — · Meet — · IntelliJ — · 기록 0 │ ← SourceFooter 한 줄
└──────────────────────────────────────┘
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
   | 푸터 한 줄 | `전사 — · Meet — · IntelliJ — · 기록 0` 이 잘리지 않고 한 줄로 남음 |
   | 헤더 | 44px 높이가 그대로이고 제목이 잘리지 않음 |
   | 가로 스크롤 | 생기지 않음 (`document.body.scrollWidth <= clientWidth`) |

4. 여백(`--panel-inset`)은 폭에 따라 14 / 16 / 20px 로 바뀝니다. Console 에서 확인할 수 있습니다.

   ```js
   getComputedStyle(document.documentElement).getPropertyValue('--panel-inset')
   ```

---

## 검사와 테스트

```bash
# 단위 테스트 (Vitest)
pnpm --filter @classmate/browser-extension test

# 타입 검사 (pnpm install 이 끝난 뒤에만 됩니다)
pnpm --filter @classmate/browser-extension typecheck

# 확장 로드 E2E — Phase 2 까지는 전부 skip 입니다
npx playwright install chromium          # 처음 한 번
pnpm --filter @classmate/browser-extension e2e
```

---

## Phase 2 에서 바뀔 것

| 지금 | Phase 2 |
|---|---|
| `style.css` 안의 색 다섯 개 | `packages/design-tokens` 의 전체 토큰 · Pretendard Variable |
| 빈 화면 하나 | TranscriptFlow · MarginNote · GuessList · NowLine · SourceFooter |
| `background.ts` 의 Native Messaging TODO | 로컬 도우미(`classmate-host`) 연결 |
| `e2e/extension.spec.ts` 의 `test.skip` | 골든 시나리오 E2E |
