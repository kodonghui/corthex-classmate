# 9라운드 인계서 — Codex 가 이어서 한다 (2026-09-04)

이 문서는 **Codex 에게 그대로 주는 작업 지시서**입니다. 8라운드까지는 Claude Code 가 했고,
9라운드부터는 Codex 가 합니다. 배경·결정·금지·검증 명령을 한 파일에 다 담았으므로
이 문서 하나만 읽으면 인계 시점의 계획을 재구성할 수 있게 썼습니다. 줄 번호는 인계 기준판
HEAD `0314dc7` 기준이고, 현재 코드를 다룰 때는 **심벌 이름으로 다시 찾으십시오**(줄 번호는 밀립니다).

---

## 0. 한 문단 요약

이 저장소는 「수업 중 막힌 순간을 한 번에 붙잡고 한 문장으로 수업에 돌아가는」 Chrome
사이드패널 AI 튜터(Corthex Classmate)입니다. 인계 기준판에서는 시험 1,640건이 원격 CI에서
초록이었지만, 실제 한 교시에서 측정된 화면 프레임은 0장이었습니다. 9라운드의 구현 목표는
**「수업 화면」을 Google Meet에 묶지 않고 학습자가 고른 탭 한 장을 남길 길을 만드는 것**이었습니다.
U-35는 로컬에 구현됐지만 설치판의 `screen.frame ≥ 1`은 U-06′ 실측 대기이며, U-36을 실행하지
못했으므로 과거 0장의 직접 원인은 실측 확정하지 않았습니다.

---

## 1. 저장소와 인계 당시 상태

| 항목 | 값 |
|---|---|
| 경로 (Windows) | `C:\Users\elddl\kodonghui_myWs\corthex-classmate` |
| 인계 기준판 HEAD | `0314dc7` · 커밋 217 · `origin/main` 과 같음 · 작업 트리 비어 있음 |
| origin | `https://github.com/kodonghui/corthex-classmate.git` — **비공개(private)** |
| CI | `.github/workflows/test.yml` · `windows-latest` · 마지막 단계 `pnpm test` 하나 · 2026-09-04 처음 초록 |
| 시험 수 | vitest 1,162 · cargo 333 · `node --test` 145 · playwright e2e 18(CI 는 건너뜀) |
| 셸 | Git Bash 권장. Python 으로 한글 파일을 고칠 때 `PYTHONUTF8=1` 을 붙이고 heredoc 대신 `.py` 파일로 |
| Rust | `export PATH="$HOME/.cargo/bin:$PATH"` 뒤에만 `cargo` 가 보임 · 툴체인은 `stable-x86_64-pc-windows-gnu` |

**인계 당시** CI 초록은 「시험 통과」이지 「관문 통과」가 아니었습니다. 네 관문이 CI 밖에
있었습니다 — `pnpm typecheck` · `cargo clippy` · `cargo fmt --check` · e2e 18건.

> **2026-09-04 실행 업데이트:** 로컬 main에는 U-35 `acd21bc`, U-38 `991dc95`, 선택 경합 보강
> `6bb9c43`이 들어갔습니다. 현재 작업트리에서 `pnpm test` 1,639건, 확장 Vitest 728건,
> typecheck·fmt·clippy·확장 build·Playwright E2E 18건이 로컬 통과했고, 빌드 매니페스트는
> `activeTab` 1 · `<all_urls>` 0 · Meet 호스트 0입니다. 다만 E2E는 도구막대 아이콘 클릭,
> `activeTab` 부여, 실제 화면 캡처를 검증하지 않습니다. `991dc95`는 typecheck·fmt·clippy를
> CI 단계에 추가했습니다. 이 세 커밋은 아직 push하지 않아 원격 CI 검증 근거가 아닙니다.
> 마지막으로 확인한 원격 성공은 `1ea20b5`의 run `33836539868`입니다. U-36 오류 원문은
> 채집하지 못했고, Meet 권한 제거는 여러 영상 서비스 지원·URL 비접근·최소 권한이라는
> 제품 결정으로 진행했습니다.

**읽는 순서**: `AGENTS.md`(있으면) → `README.md` → `docs/master-prompt.md` §4 불변 원칙 →
`docs/plan/round-8-units.md` §0 → `docs/WORKLOG.md` 마지막 두 항목 → 이 문서 §2·§3.

---

## 2. 기술 조건과 과거 뿌리 원인 가설 — 「Meet 호스트 권한만으로는 화면을 못 찍는다」

### 2-1. 코드가 믿고 있는 것

`0314dc7` 인계 기준판의 `apps/browser-extension/src/capture/snapshot.ts:12-13`과
`wxt.config.ts:29-42`에는 이렇게
적혀 있습니다: *「`chrome.tabs.captureVisibleTab` 은 제스처를 요구하지 않는다. 대신 그 탭의
호스트 권한이 필요하다. 그래서 `host_permissions` 에 `https://meet.google.com/*` 만 넣었다.」*

### 2-2. Chrome 공식 문서가 말하는 것 (2026-09-04 확인)

`chrome.tabs.captureVisibleTab` 문서:
> "In order to call this method, the extension must have either the `<all_urls>` permission
> or the `activeTab` permission."

즉 **특정 호스트 권한 하나는 이 목록에 없습니다.** Chromium의 권한 검사
(`PermissionsData::CanCaptureVisiblePage`, 요구 조건 `kActiveTabOrAllUrls`)도 「그 탭에 대한
`activeTab`」 또는 「`<all_urls>`」만 봅니다. Chromium 소스에 정의된 오류 문구는
`Either the '<all_urls>' or 'activeTab' permission is required.`입니다.

### 2-3. 이 가설이 맞으면

- U-36은 실행하지 않아 이 PC의 과거 설치판 오류 원문을 채집하지 못했습니다. §5 ①은 과거
  가설의 미실행 기록으로 남기며, 옛 빌드 재설치는 현재 기본 절차가 아닙니다.
- 고치는 길은 `<all_urls>` 가 아니라 **`activeTab`** 입니다. `<all_urls>` 는 은행·메일 탭까지 찍을 수
  있게 하므로 이 프로젝트가 처음부터 거부한 권한입니다(`wxt.config.ts:35-38`).

### 2-4. `activeTab` 이 주어지는 네 자리 (문서 확인)

「action 클릭 · 컨텍스트 메뉴 · `chrome.commands` 단축키 · omnibox」 — **사이드패널 안의 클릭은
없습니다**(WORKLOG 2026-09-03 12:51 발견 1 과 같은 사실). 권한은 그 탭이 **다른 출처로
이동하거나 닫힐 때까지** 살아 있습니다. 같은 사이트 안의 이동(YouTube 다음 영상 등)은 유지됩니다.

이 사실이 곧 설계를 정합니다: **「수업 화면 탭」 = 학습자가 확장 아이콘을 누른 그 탭.**
Meet 인지 YouTube 인지 Drive 인지 묻지 않습니다. 이것이 학습자의 요구 「꼭 영상이 Google Meet
일 필요는 없게」의 구현이자, 0장 문제의 해법입니다.

이 기술 조건은 U-35의 설계를 정한 근거이지, 과거 0장의 직접 원인이나 새 설치판 성공을 실측한
결과는 아닙니다. 전자는 U-36 미확정, 후자는 U-06′ 대기입니다.

---

## 3. 「뒷 탭」의 뜻 — 결정

8라운드 U-06 이 「Meet 이 앞 탭/뒷 탭인 경우」를 재라고 했는데 「뒷 탭」의 뜻이 없었습니다. 정합니다.

| 경우 | 뜻 | Chrome API 로 가능한가 | 9라운드에서 |
|---|---|---|---|
| (가) 같은 창의 비활성 탭 | 수업 화면 탭이 있는 창에서 **다른 탭**이 앞에 있음 | **불가능.** `captureVisibleTab(windowId)` 는 그 창의 활성 탭만 찍음 | `not-active` 로 남기고 바닥줄이 「그 탭을 앞으로 꺼내 주세요」라고 말하면 끝. 재지 않음 |
| (나) 다른 창의 활성 탭 | 수업 화면 탭은 **자기 창에서 앞**이지만, 학습자는 다른 창(IntelliJ·Tiro)에 있음 | **가능.** `windowId` 로 그 창을 찍음 | 이것이 「뒷 탭」의 정의. §5 절차 ③(선택)으로 잼 |

**정의: 「뒷 탭」 = (나).** (가)는 API 한계라 결과가 정해져 있으므로 실험 항목이 아니라 **문구**
항목입니다.

---

## 4. 인계 당시 세운 단위 계획과 현재 실행 결과 — 다섯 + 사람 하나

| 단위 | 이름 | 크기 | 누가 | 의존 |
|---|---|---|---|---|
| U-36 | U-35 이전 설치판 오류 원문 채집 — 미실행/waived, 과거 0장 인과 미확정 | S | 사람(학습자) | 없음 |
| U-35 | 수업 화면 탭을 `activeTab`으로 잡는다 — 로컬 구현 완료, 설치판 실측 대기 | M | Codex | U-36과 무관한 제품·개인정보 결정 |
| U-38 | CI 에 관문 셋(typecheck · clippy · fmt)을 넣는다 | S | Codex | 없음 |
| U-39 | 문서 부채 — TASKS `[~]` 셋 · `:163` · master-prompt §3-7 · round-8 U-09 상태 | S | Codex | U-35 뒤 |
| U-37 | (선택) `chrome.commands` Alt+S 전역 단축키 — 두 번째 `activeTab` 입구 | M | Codex | U-35 뒤 · 시간 남을 때만 |
| U-06′ | 집에서 재는 실측 — §5 | 사람 | 학습자 | U-35 빌드 |

실행 결과: U-35·U-38은 로컬 구현/검증 완료했고, U-39 문서도 현재 증거에 맞춰 정렬했습니다.
U-36은 미실행이며 추정 오류를 실측값으로 승격하지 않습니다. U-06′의 실제 설치판 수치는 비어 있습니다.

> 아래 U-35·U-38 상세는 `0314dc7`에서 작성한 구현 계획 기록입니다. 현재 사실은 §1 실행
> 업데이트가 우선하며, U-36 조건부 갈래는 실행하지 않았습니다.

### 4-1. U-35 상세 — 수업 화면 탭을 `activeTab` 으로 잡는다

**목표 한 문장**: 학습자가 확장 아이콘을 누른 탭이 「수업 화면」이 되고, 붙잡기마다 그 탭이 자기
창에서 앞에 있으면 한 장이 남는다. 주소는 보지 않는다.

① **`wxt.config.ts`**
- `permissions` 에 `'activeTab'` 추가.
- `host_permissions` 의 `https://meet.google.com/*` 는 **U-36 결과로 정합니다**(⑤). 가설이
  확정되면(호스트 권한으로는 못 찍음) 지웁니다 — 남겨 두면 「Meet 만 찍는다」는 거짓 신호가
  됩니다. 주석(29-42행)도 사실대로 고칩니다.

② **`entrypoints/background.ts`** — 배선만, 판단은 `src/background/**` 에
- `setPanelBehavior({ openPanelOnActionClick: true })` 를 **`false`** 로 바꾸고
  `chrome.action.onClicked` 안에서 `chrome.sidePanel.open({ windowId: tab.windowId })` 로 패널을 엽니다
  (Chrome 116+ · 클릭 핸들러 안이라 사용자 제스처 조건을 만족). 지금 583-597행 리스너는
  「불리지 않는다」고 스스로 적혀 있는 손시험 갈래입니다 — 그 자리를 이 용도로 바꿉니다.
  `tabCapture` 시작(`startCapture`)은 여기서 **빼고**, `startCapture`/`stopCapture`/`classmateCapture`
  손잡이는 그대로 둡니다(U-14 몫 · 이번에 만지지 않음).
- 같은 핸들러에서 **수업 화면 탭을 기록**합니다: `{ tabId, windowId, at }` 을
  `chrome.storage.session` 에(브라우저를 닫으면 activeTab 도 함께 죽으므로 이 자리가 맞습니다.
  `src/background/session-area.ts` 가 이미 그 저장소를 감쌉니다).
- `screen.capture` 는 `captureMeetTab(snapshotChrome)` 대신 `captureLessonTab(snapshotChrome, lessonTab)` 을
  부릅니다. `snapshotChrome` 에 `tabs.get(tabId)` 를 더합니다(`query` 는 ⑤에 따라 남기거나 뺍니다).
- `classmate.reconnect { connector: "meet-tab" }`는 현재 `reselectLessonTab()`을 부릅니다. 가장
  최근 Chrome 창의 앞 탭을 수업 화면 후보로 다시 기록하지만, 사이드패널 안의 클릭은 `activeTab`
  권한을 새로 주지 못합니다. 권한이 없으면 다음 붙잡기에서 `no-permission`을 내고 바닥줄이
  해당 탭에서 확장 아이콘을 누르도록 안내합니다.

③ **`src/background/lesson-tab.ts` (새 파일 · 순수 · 시험 포함)**
- `rememberLessonTab(store, {tabId, windowId, at})` · `readLessonTab(store)` · `forgetLessonTab(store)`.
  `store` 는 주입식 `{get, set}` 이라 vitest 가 봅니다(`entrypoints/**` 는 vitest 대상이 아닙니다).
- 패널이 열릴 때(`chrome.runtime.onConnect` · 이름 `classmate-panel`) 기록이 없으면
  `tabs.query({ active: true, lastFocusedWindow: true })` 의 탭을 후보로 기록합니다 — 권한은 없을 수 있으나
  「무엇을 찍으려는지」는 바닥줄에 보여야 합니다.

④ **`src/capture/snapshot.ts`**
- `captureMeetTab` → `captureLessonTab(chromeLike, lessonTab | null)`:

  ```text
    lessonTab 이 없다 ───────────────────────────▶ null · onFail("no-lesson-tab")
    tabs.get(tabId) 가 던진다(닫힘) ─────────────▶ null · onFail("no-lesson-tab")
    tab.active !== true ─────────────────────────▶ null · onFail("not-active")
    captureVisibleTab(windowId) 가 던진다
        ├─ 문구에 "activeTab" 이 있다 ───────────▶ null · onFail("no-permission")
        └─ 그 밖 ───────────────────────────────▶ null · onFail("capture-failed")
    700 KiB 초과 → 품질 30 재시도 → 그래도 초과 ─▶ null · onFail("too-large")
    성공 ─▶ { bytes, width, height }
  ```
- `SnapshotFailure` 낱말: `no-meet-tab` → **`no-lesson-tab`**, **`no-permission`** 추가, 나머지 셋 유지.
  fixtures(`fixtures/**` · 고정)에는 실패 낱말이 없고 `connector: "meet-tab"` 과 `source: "meet-tab"` 만
  있으므로 낱말은 바꿀 수 있습니다. **`meet-tab` 이라는 커넥터 이름과 `ScreenFrame.source: "meet-tab"` 은
  바꾸지 않습니다** — `packages/contracts/schemas/screen-frame.schema.json:40` 의 enum 이
  `["meet-tab","fixture"]` 로 고정돼 있고, 계약·fixtures 는 이번 라운드에서 동결입니다. 이름은
  「선(wire) 위의 낱말」로 남기고 주석에 그 사연을 한 줄 적습니다.
- `pickMeetTab`·`isMeetUrl`·`MEET_URL_PATTERN`·`MEET_HOSTNAME` 은 ⑤에 따릅니다.
- **그림·주소를 로그에 남기지 않는 규칙은 그대로**(파일 머리 주석 「기록 메모」). 오류 문구 판정은
  `error.message.includes('activeTab')` 한 줄이면 됩니다 — 문구 전체를 다시 로그로 찍지 않습니다.

⑤ **U-36 결과에 따른 갈래**
- 가설 확정(호스트 권한만으로 실패): Meet URL 관련 상수·함수·질의(`tabs.query({url})`)와
  `host_permissions` 를 **지웁니다.** `snapshot.test.ts` 의 `isMeetUrl`(152행) · `pickMeetTab`(242행) ·
  `captureMeetTab`(279행 · 14건) 블록을 `captureLessonTab` 시험으로 다시 씁니다(빠진 경우·닫힌 탭·
  `not-active`·`no-permission`·`capture-failed`·`too-large` 사다리·로그에 그림 없음).
- 가설 기각(호스트 권한으로도 찍힘): Meet 찾기를 **폴백**으로 남깁니다 — 기록된 수업 화면 탭이 없을
  때만 `tabs.query({url})` 로 Meet 탭을 찾습니다. 두 겹 URL 검사는 그때만 살아 있습니다.

⑥ **`src/background/router.ts`**
- `noteScreenMissing(reason)`: `off` 는 `no-lesson-tab` 일 때만. `no-permission` 은 학습자가 고칠 수 있으니
  `paused`(호박색). `router.test.ts:985-1015` 의 낱말을 맞춥니다.
- 커넥터 이름 `'meet-tab'` 은 그대로(위 ④).

⑦ **패널 문구** (`src/panel/**`)
- `lesson-view.ts` `MEET_TROUBLE_LINE` → `SCREEN_TROUBLE_LINE`:
  `no-lesson-tab` → 「수업 화면 탭을 아직 안 골랐어요. 영상 탭에서 확장 아이콘을 눌러 주세요.」 ·
  `no-permission` → 「이 탭은 찍을 권한이 없어요. 영상 탭에서 확장 아이콘을 한 번 눌러 주세요.」 ·
  `not-active` → 「수업 화면 탭이 그 창에서 뒤에 있어요. 앞으로 꺼내 주세요.」 · 나머지 유지.
- 바닥줄 `Meet ${formatAgo(meetAge)}`(431행) → `화면 ${…}` · 자세히 화면 `caption: Meet · ${file}`(649행) →
  `화면 · ${file}` · `SettingsScreen.tsx:113` 「Meet 화면」 → 「수업 화면」(설명 「고른 탭 한 장」).
- `FooterSource.key "meet"` 은 UI 키라 그대로 둡니다(`packages/ui-classmate` 의 타입). 라벨만 바뀝니다.
- e2e `apps/browser-extension/e2e/extension.spec.ts:232` 가 「전사 기록 중 · Meet 기록 중 · IntelliJ 기록 중」을
  정확히 찾습니다 → 「화면 기록 중」으로 함께 고칩니다. **골든 PNG(`docs/screenshots/golden-*.png`)가
  바뀌므로** e2e 는 로컬에서 돌리고 바뀐 그림을 눈으로 본 뒤 커밋합니다(CI 는 e2e 를 안 돕니다).

⑧ **문서**
- `docs/privacy.md:37` 「화면은 Meet 탭일 때만 찍힙니다」 → 「학습자가 확장 아이콘을 눌러 고른 탭 한 장만
  찍힙니다. 주소는 보지 않습니다.」 · 15행 표의 「Meet 탭 캡처」 → 「수업 화면 탭(고른 탭) 캡처」.
  개인정보 세 칸 문구 `로컬 보관 / 선택한 AI 제공자로 전송될 수 있음 / Corthex 서버 기본 전송 없음` 은
  **글자 하나 바꾸지 않습니다**(§6-5).
- `apps/browser-extension/README.md` · `src/capture/README.md` · `docs/architecture.md` 의 Meet 서술을
  「수업 화면 탭」으로. `docs/first-class.md` 설치 절차에 「영상 탭에서 아이콘 클릭 = 수업 화면 지정」 한 줄.
- `docs/spikes/gate-b-meet.md` 「사람이 할 일 1」 아래에 U-36 결과를 적습니다.
- `docs/DECISIONS.md` 에 한 항목: 「수업 화면은 Meet 이 아니라 학습자가 아이콘을 누른 탭 · 권한은
  activeTab · `<all_urls>` 거부 유지 · 커넥터/소스 낱말 `meet-tab` 은 선 위에 남김」.

**완료 검증(U-35)**
```
pnpm --filter @classmate/browser-extension test -- --maxWorkers=2
pnpm --filter @classmate/browser-extension typecheck
pnpm --filter @classmate/browser-extension build
grep -c '"activeTab"' apps/browser-extension/.output/chrome-mv3/manifest.json   # 1
pnpm test:e2e            # 골든 PNG 갱신 · 눈으로 확인
TZ=UTC pnpm test:vitest && TZ=UTC pnpm test:node   # push 전 필수 (CI 러너는 UTC)
```

### 4-2. U-38 상세 — CI 에 관문 셋

`.github/workflows/test.yml` 의 「시험 세 갈래」 단계 **앞**에 세 단계를 넣습니다.
```yaml
- name: 타입 검사
  run: pnpm typecheck
- name: Rust 서식 검사
  run: cargo fmt --all --manifest-path apps/native-host/Cargo.toml -- --check
- name: Rust lint
  run: cargo clippy --workspace --all-targets --manifest-path apps/native-host/Cargo.toml -- -D warnings
```
rustup 단계가 이미 `--component rustfmt --component clippy` 를 깔아 둡니다. e2e 는 계속 밖입니다(주석의
세 가지 까닭 유지). 로컬에서 세 명령이 exit 0 인지 먼저 확인한 뒤 올립니다 — 지금 로컬은 셋 다 초록입니다.
`tests/no_real_cli.rs`(5건) · `tests/no_real_cli_root.rs`(7건) 가드는 그대로여야 하며
`scripts/run-all-tests.mjs:43-44 REQUIRED_CARGO_GUARDS` 가 사라지면 실행을 실패시킵니다.

### 4-3. U-39 상세 — 문서 부채

- `docs/TASKS.md:163-165`는 증거대로 나눕니다 — U-22와 U-33/U-34는 `[x]`, U-21은
  `native-host paused` 사건은 나가지만 패널 표시가 `off`만 처리하므로 `[~]` 유지. `:163`의
  「`.github` 폴더는 없습니다」는 낡았습니다(지금은 있음).
- `docs/master-prompt.md:245`의 「입력창 없음」과 `:252`의 「텍스트 입력창은 여기 맨 아래에만」은
  역사 원문으로 남기고, 바로 아래에 2026-09-03부터 듣는 중 화면에 항상 열린 대화 칸이 있으며
  자세히 화면의 이어 묻기 입력창도 유지된다는 정정문을 둡니다. 사용자 문구 `Meet`는 U-35부터
  `화면`·`수업 화면`으로 일반화했고, 고정 계약의 내부 `meet-tab`과 UI key `meet`만 유지한다고 함께 밝힙니다.
- `docs/plan/round-8-units.md:256-258` U-09 「진행 중 … 남은 것: 뒷 탭인 Meet 도 찍을 길」 → 이 문서 §3 을
  가리키며 「(가)는 API 한계 · (나)는 U-35에서 구현했고 실제 설치판 성립은 U-06′에서 확인」으로 닫습니다. §0 표 아래에 9라운드 단위 표를 한 줄로
  가리킵니다(`→ docs/plan/round-9-codex-handoff.md §4`).
- `docs/TASKS.md` 「Meet 화면 실측」 줄(`:161`) → 「수업 화면 실측 — §5 절차 · 숫자 칸 비어 있음」.

### 4-4. U-37 상세 — (선택) Alt+S 전역 단축키

`wxt.config.ts` manifest 에 `commands: { "classmate.catch-last": { suggested_key: { default: "Alt+S" },
description: "마지막 문장 붙잡기" } }` · `chrome.commands.onCommand` 에서 (1) 그 창의 활성 탭을 수업 화면
탭으로 기록(이 순간 `activeTab` 이 그 탭에 주어짐) (2) 패널이 열려 있으면 `classmate.command {name}` 을
패널 포트로 보내 패널이 마지막 문장을 붙잡게, 없으면 `sidePanel.open` 만. 명령 이름 상수는
`src/background/commands.ts` 에 정본. 빌드 산출물 `manifest.json` 에 `commands` 가 실리는지 확인.
round-8 의 U-03·U-13 이 이것입니다 — 하되 **U-35 가 끝나고 시험이 초록일 때만** 집습니다.

---

## 5. U-06′ — 집에서 재는 절차 (학습자가 함 · 숫자는 비워 둠)

학원이 아니라 집에서, 실제 Meet 없이 **녹화 영상 한 편**으로 잽니다. 필수 검증은 ②이고 ③은 선택입니다. ①은 과거 가설의 미실행 기록입니다.

**① 과거 가설 확인 — 미실행으로 남김**

U-35 이전 `0314dc7` 설치판의 Chrome 오류 원문은 채집하지 못했습니다. 이를 확인하려고 옛
빌드를 다시 설치하는 일은 현재 제품 성공 검증에 필요하지 않으므로 기본 절차에서 뺍니다.
문서에는 `미실행`으로 남기고, 특정 Meet 호스트 권한만으로 실패했다는 문장을 실측 사실로
쓰지 않습니다. 필요해져 옛 판을 별도 재현할 때만 정확한 커밋 빌드와 설치판을 구분해 잽니다.

**② 앞 탭 (U-35 빌드)**
1. 영상 탭(YouTube·Drive 재생·Meet 녹화 어느 것이든 `https`)을 열고 **그 탭이 앞에 있을 때** 확장 아이콘을
   누릅니다 → 패널이 그 창에 열리고 그 탭이 수업 화면이 됩니다. 바닥줄에 「화면」이 초록인지 봅니다.
2. Tiro 로 녹음·전사를 켜고 공유 페이지를 평소처럼 다른 탭/창에 둡니다(전사 입구는 바뀌지 않았습니다).
3. 영상을 재생하며 붙잡기를 **3회 이상**, 시각을 적습니다.
4. 같은 창에서 다른 탭을 앞에 두고 붙잡기 **3회** → 바닥줄이 「그 창에서 뒤에 있어요」를 말하는지,
   `not-active` 가 세어지는지 봅니다(이것이 (가) · 0장이 정상).

**③ 뒷 탭 = (나) (선택)**
1. ②-1 을 마친 상태(창 B 에 영상·패널)에서 **다른 Chrome 창 A**(Tiro 공유 탭)로 갑니다.
2. 창 A 에서는 아이콘을 누르지 말고(누르면 A 의 탭이 수업 화면으로 바뀝니다) Chrome 도구막대의
   「사이드 패널」 메뉴에서 Corthex Classmate 를 골라 엽니다.
3. 창 A 의 패널에서 붙잡기 **3회** → 창 B 의 영상 탭이 찍히면 (나)가 성립합니다. 창 B 가 최소화돼 있으면
   한 번 더 재서 「최소화된 창」 결과를 따로 적습니다.

**세기 (PowerShell · 교시가 끝난 뒤)**
```powershell
$d = "$env:LOCALAPPDATA\CorthexClassmate\sessions"
$p = "2026-09-04-p1"   # 잰 교시 id 로

sqlite3 "$d\$p.sqlite" "select count(*) from events where type='screen.frame';"
sqlite3 "$d\$p.sqlite" "select at from events where type='screen.frame' order by at;"
Get-ChildItem "$d\$p\frames" -File | Measure-Object -Property Length -Sum
sqlite3 "$d\$p.sqlite" "select json_extract(payload,'$.reason'), count(*) from events where type='connector.status' and json_extract(payload,'$.connector')='meet-tab' group by 1;"
```
`sqlite3.exe` 가 없으면 셋째 줄(파일 수)만으로도 판정의 절반은 섭니다.

**WORKLOG 에 적을 것**: ① `미실행` · ② 앞 탭 `screen.frame` 건수 / `not-active` 건수 ·
③ (나) 건수(했으면) · `frames/` 파일 수·바이트 · 붙잡기 횟수. 하나도 없으면 「0건」이라고 적습니다.

**판정표**
| 결과 | 그러면 |
|---|---|
| ① | 미실행 유지. 오류 원문을 새로 얻기 전에는 §2 가설을 실측 확정하지 않음 |
| ②-3 에서 N ≥ 1 | 한 장 찍기 길이 처음으로 실제 화면을 남김. U-14(연속 캡처)는 「한 장으로 부족」이 나올 때까지 접어 둠 |
| ②-3 에서 0장 | 새 판에도 다른 벽이 있음. `capture-failed` 또는 상태 문구를 그대로 채집해 WORKLOG |
| ③에서 N ≥ 1 | 「뒷 탭 (나)」 성립. 최소화 결과는 따로 |

---

## 6. 불변 원칙 (위반하면 멈추고 보고 · `docs/master-prompt.md` §4 요약)

1. 수업 데이터(전사·화면·질문·답·복습자료)는 로컬 정본. Corthex 서버는 기본값에서 수업 데이터를 받지 않는다.
2. Codex·Claude·Tiro 인증정보·토큰을 앱 코드·서버·GitHub·로그에 저장·전송하지 않는다. `.mcp.json` 은 OAuth 전용.
3. Tiro 공유 URL 과 비밀번호를 로그·커밋·스크린샷에 남기지 않는다. `tiro.ooo/s/…` 에 접속하지 않는다.
4. 화면 전체 영상을 저장하지 않는다. 변경된 핵심 장면(WebP/JPEG 한 장)만.
5. 개인정보 문구는 세 칸 그대로: `로컬 보관 / 선택한 AI 제공자로 전송될 수 있음 / Corthex 서버 기본 전송 없음`.
   「모든 것이 로컬」이라고 쓰지 않는다.
6. IntelliJ 연결은 수업 모드에서 읽기 전용. 라이브 튜터에 셸·패치·파일 쓰기 권한을 주지 않는다.
7. 화면·전사 안의 문장을 프로그램 명령으로 실행하지 않는다. 모델이 만든 HTML 을 직접 실행하지 않는다.
8. 친구마다 독립 프로필과 자기 AI 인증. 9. Google Drive 다운로드 제한 우회 금지.
10. 트랜스크립트에 노출된 토큰 재사용·인용 금지. 11. 학습 저장소 `Study-saltlux-ai-agent-service` 는 건드리지 않는다.

## 7. 실행 금지 목록

- 실제 `claude` · `codex` · `gemini` CLI 를 시험·검증·자동화에서 부르지 않는다(가드 `tests/no_real_cli*.rs` 12건 유지).
- `packages/contracts/schemas/**` · `frozen.sha256` · `fixtures/**` 는 고정 · `design/**` 읽기 전용 ·
  `pnpm --filter @classmate/contracts freeze` 실행 금지.
- 레지스트리 `--apply` · `reg add` · `reg delete` 실행 금지(설치기는 dry-run 만).
- `git push` · 브랜치 삭제 · `reset --hard` · `push --force` 는 **학습자에게 먼저 묻는다.** 커밋은 자유.
- 죽은 코드를 살려 배선하지 않는다: `ProviderQueue` · `RetryPolicy` · `CodexAppServerProvider` · `cancelChoosing` ·
  `pushEditor`(보내는 쪽) · `FoldTimer` · `kind:"next"`.
- `.kdh-sessions/` 는 개인 경로가 든 추적 파일이라 공개 전환 전에 치울 것 — **이번 라운드 일이 아님**, 건드리지 않는다.
- `docs/screenshots/golden-*.png` 는 U-35 ⑦ 로 바뀔 때만, 눈으로 본 뒤 커밋한다.

## 8. 검증 명령 (마지막에 전부 돌려 출력을 보고에 남긴다)

```
pnpm install
pnpm test                                   # vitest · cargo · node --test (1,640)
TZ=UTC pnpm test:vitest && TZ=UTC pnpm test:node
pnpm typecheck
export PATH="$HOME/.cargo/bin:$PATH"
cargo clippy --workspace --all-targets --manifest-path apps/native-host/Cargo.toml -- -D warnings
cargo fmt --all --manifest-path apps/native-host/Cargo.toml -- --check
pnpm --filter @classmate/browser-extension build && pnpm test:e2e
git diff --check
git diff main~N..HEAD | grep -nE 'tiro\.ooo/([a-z]{2}/)?s/|sk-ant|ghp_|INTELLIJ_MCP_TOKEN=|password'   # 0건
```

## 9. 커밋·보고 형식

- 커밋은 단위마다 작게: `type(scope): 무엇을 왜` 한 줄 + 본문. 끝에 자기 도구의 `Co-Authored-By:` 트레일러.
- `docs/WORKLOG.md` 에 라운드 항목 하나: 변경 · 검증(명령과 exit) · 위험 · 다음 행동. `docs/DECISIONS.md` 에는
  결정만(§4-1 ⑧). `docs/TASKS.md` 는 U-39.
- 마지막 보고는 단위별 표(단위 | 상태 | 커밋 | 검증 명령 → exit) + 「하지 않은 것과 까닭」 + 「학습자가 할 일」(§5).
- 모르면 지어내지 말고 「확인 안 됨」이라고 쓴다. 실측 숫자는 사람이 준 것만 적는다.
