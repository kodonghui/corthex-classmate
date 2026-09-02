# docs/screenshots/compare — 정본 디자인 vs 구현 나란히 보기

왼쪽은 정본 디자인(`design/claude-design-export/project-classmate-side-panel/Classmate Side Panel.dc.html`)을
브라우저에서 실제로 렌더한 그림, 오른쪽은 빌드된 확장의 사이드패널(`sidepanel.html?replay=manual`)입니다.
둘 다 폭 380 · 높이 900, `animations: 'disabled'` 로 찍었습니다.

만드는 사람은 `apps/browser-extension/scripts/compare-design.mjs` 입니다. 이 폴더의 PNG 와
`summary.json` 은 그 스크립트가 씁니다. 손으로 고치지 말고 스크립트를 다시 돌리세요.
(골든 9장면 `docs/screenshots/golden-*.png` 와 그 README 는 다른 자리에서 관리합니다.)

## 다시 만들기 (저장소 루트 · Git Bash)

```bash
pnpm --filter @classmate/browser-extension build
node --test apps/browser-extension/scripts/compare-design.test.mjs
node apps/browser-extension/scripts/compare-design.mjs
# 또는
pnpm --filter @classmate/browser-extension compare:design
```

빌드 산출물(`apps/browser-extension/.output/chrome-mv3`)이 없으면 스크립트가 안내만 하고 1 로 끝납니다.
정본 dc.html 은 unpkg 에서 React·Babel 을 받아 오므로 **인터넷이 필요합니다.** 못 받으면 정본 쪽이
전부 "정본 렌더 실패" 자리표시가 되고 구현 쪽만 남습니다. 종료 코드는 정본·구현이 **둘 다** 비어 있는
상태가 하나라도 있을 때만 1 입니다.

## 상태별 결과

| 상태 | 정본 조작 | 구현 | 파일 | 판정 |
|---|---|---|---|---|
| A 듣는 중 | 1초 tick 31번(전사 5줄) | `goto('listening')` | `A-listening.png` | 차이 있음(의도) |
| B 붙잡은 직후 | tick 31 → l3 의 `new` 클릭(준비 1.6초 전) | `goto('caught')` | `B-caught.png` | 일치 |
| C 한 줄 답변 | tick 31 → `new` 클릭 → tick 2 | `goto('answer')` | `C-answer.png` | 차이 있음(의도) |
| D 문장을 붙잡음 | tick 8 → 마지막 문장 클릭 | `goto('sentence')` | `D-sentence.png` | 차이 있음(의도) |
| E 접힌 메모 | tick 31 → `new` 클릭 → tick 2 → tick 18 | `goto('folded')` | `E-folded.png` | 일치 |
| F 자세히 | tick 31 → `new` 클릭 → tick 2 → `자세히 보기 ▸` | `goto('detail')` | `F-detail.png` | 차이 있음(의도) |
| G 기록 | tick 31 → 바닥줄 `기록 N` 클릭 | 없음 | `G-history.png` | 구현 없음 |
| H 튜터 멈춤 | props `aiDown=true` → tick 31 → `new` 클릭 | `goto('waiting')` | `H-tutor-paused.png` | 일치 |
| H-1 전사 멈춤 | tick 31 → props `tiroDown=true` → tick 1 | `advanceTo('2026-09-02T10:31:35+09:00')` | `H1-tiro-paused.png` | 대체 |

- **일치** — 화면 구조·문구·상태 표시가 같은 것으로 읽힙니다(아래 공통 차이는 뺍니다).
- **차이 있음(의도)** — 아래 목록에 적은 이유로 다릅니다. 고칠 것이 아닙니다.
- **대체** — 구현에 그 상태가 없어 가장 가까운 장면으로 대신했습니다.
- **구현 없음** — 오른쪽이 회색 자리표시입니다.

정본 캡처는 패널 요소 그대로라 382×902(1px 테두리 포함), 합성본은 834×1086 안팎입니다.
상태별 성공 여부·크기·구현 화면 이름(`data-screen-label`)·메모 상태(`data-note`)는 `summary.json` 에 있습니다.

## 차이 있음(의도) — 고치지 않는 것

1. **전사 대본이 다릅니다.** 정본은 dc.html 안에 든 9줄 대본(`10:31:24`~`10:34:20`),
   구현은 `fixtures/synthetic-class/golden-ioc/transcript.json` 입니다. 문장 수와 문구가 다르니
   줄 단위로 맞추려 하지 마세요. 맞춰 보는 것은 **화면 구조와 상태 표시**입니다.
2. **한 줄 결론 문체가 다릅니다.** 정본(dc)은 합니다체 "new 자체가 틀린 것은 아니지만 …",
   구현은 해요체 "new 자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요" 입니다.
   `docs/design-map.md` 함정 8 이 해요체를 채택했고, 구현 문구는 fixture 의 답을 그대로 씁니다.
3. **바닥줄 오타는 구현이 맞습니다.** 정본은 `멈췼어요`(`dc.html:399-400`), 구현은 `멈췄어요` 입니다
   (`docs/design-map.md` 함정 7). H 비교 이미지에서 그대로 보입니다.
4. **듣는 중 화면의 "지금 ·" 줄이 구현에서는 두 번 보입니다.** 헤더 바로 아래 붙박이 NowLine 과
   메모 아래 NowLine 이 같은 문장을 가리킵니다. 붙박이 줄은 디자인 readme 가 정한 자리라 그대로 둡니다
   (`docs/design-map.md` §4-3 "헤더 아래 NowLine 고정"). 정본은 붙잡은 시각 뒤에 새 `now` 줄이 와야
   메모 아래 줄이 생겨서 같은 장면에서 한 번만 보일 수 있습니다.
5. **근거 칩의 짜임이 다릅니다.** 정본은 답마다 손으로 고른 근거(`확인됨 · 전사` / `일부 확인 · Meet 화면` /
   `추론 · 테스트 이야기`)를, 구현은 세 자료에 같은 근거 단계를 붙이고 붙잡은 시각(`10:32`)을 함께 적습니다.
   계약 `EvidenceLevel` ↔ 디자인 `Evidence` 대응표(`src/panel/evidence.ts`)를 거치기 때문입니다.
6. **세 번째 칩이 다릅니다.** 정본은 답에 `compare` 가 있으면 `내 코드와 비교`, 없으면 `지금 화면 코드` 를
   고릅니다. 구현은 `지금 화면 코드` 를 씁니다.
7. **헤더 오른쪽 설정 아이콘(`settings-2`)이 구현에 없습니다.** 설정 화면이 아직 없어서입니다.
8. **자세히 화면에 `더 알고 싶다면` 라벨과 맨 아래 `직접 물어보기` 입력창이 구현에 없습니다.**
   대신 구현은 `왜 그런가요` 절을 처음부터 펼칩니다(정본은 `answerLength='바로 자세히'` 일 때만 펼칩니다).
9. **자료 나이 문구가 다릅니다.** 정본은 `전사 4초 전 · Meet 2초 전 · IntelliJ 1초 전` 고정,
   구현은 fixture 시각에서 계산합니다(`IntelliJ —`, `26초 전` 처럼 장면마다 바뀝니다).
10. **접힘 카운트다운 숫자가 다릅니다.** 정본은 준비가 끝난 순간이라 `18초`, 구현 `answer` 체크포인트는
    `answer.completed` 에서 1초 지난 자리라 `17초` 입니다. 같은 18초 규칙입니다.
11. **설정 화면은 이 표에 없습니다.** 상태 A~H 에 설정이 없고 구현에도 아직 없습니다. 2라운드에서
    만들 때 **제공자 선택과 개인정보 문구는 정본에 근거가 없습니다**(`docs/design-map.md` §6 마지막 항목).
    정본 인용으로 삼지 말고 새로 쓴 문구임을 밝혀야 합니다.

## 아직 못 맞춘 것

- **G 기록** — 구현에 기록 화면이 없습니다. 화면이 생기면 `compare-design.mjs` 의 `STATES` 에서 `G` 의
  `impl` 을 `{ kind: 'none', … }` 에서 `{ kind: 'checkpoint', checkpoint: '<이름>' }` 으로 바꾸면 됩니다.
- **H-1 전사 멈춤** — fixture `session-events.jsonl` 의 `connector.status` 는 `connected` 세 줄뿐이고,
  `window.classmateReplay` 손잡이에 커넥터 사건을 넣는 방법이 없습니다. 그래서 fixture 첫 사건 시각
  (`2026-09-02T10:31:35+09:00`)으로 시계를 세워 대신했습니다. 그 시각에는 전사가 아직 하나도 오지 않아
  **"아직 들은 문장이 없어요" 가 보이고 바닥줄은 정상**입니다(호박색 "다시 연결" 이 아닙니다).
  손잡이에 커넥터 사건 주입이나 전용 체크포인트가 생기면 `STATES` 의 `H1.impl` 을 그쪽으로 바꿉니다.
  스크립트는 실제로 호박색 바닥줄(`.cm-sf--paused`)이 떴는지 확인해 `summary.json` 과 이미지 캡션에 적습니다.
