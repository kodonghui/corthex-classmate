# docs/screenshots — 골든 시나리오 14장면

`apps/browser-extension/e2e/extension.spec.ts` 가 빌드된 확장을 Chromium 에 얹고, fixtures
(`fixtures/synthetic-class/golden-ioc/`)만으로 "왜 new로 직접 만들면 안 돼요?" 시나리오를 다시 굴려 찍은 사진입니다.
기본은 폭 380 × 높이 720, `animations: 'disabled'`(진입 애니메이션을 끝 상태로 보낸 뒤 촬영). 합성 fixture 라 실제 수업·사람은 없습니다.

다시 만들기(저장소 루트 · Git Bash):

```bash
pnpm --filter @classmate/browser-extension build
pnpm --filter @classmate/browser-extension e2e
```

## 수업 흐름 9장면 — 체크포인트로 세웁니다

| # | 파일 | 디자인 상태 | 체크포인트 | 재생 시각(근거) | tutor-core `state` · `note` |
|---|---|---|---|---|---|
| 1 | `golden-01-listening.png` | A 듣는 중 | `listening` | 10:32:16 (첫 질문 −2초) | CAPTURE · none |
| 2 | `golden-02-caught.png` | B 붙잡은 직후 | `caught` | 10:32:18 (첫 질문 `question.asked`) | ANSWER_MINIMAL · preparing |
| 3 | `golden-03-sentence.png` | D 문장을 붙잡음 | `sentence` | 10:32:16 + 마지막 문장 붙잡기 | CAPTURE · none(화면은 choosing) |
| 4 | `golden-04-answer.png` | C 한 줄 답변 | `answer` | 10:32:25 (`answer.completed` +1초) | ANSWER_MINIMAL · minimal |
| 5 | `golden-05-detail.png` | F 자세히 | `detail` | 10:32:26 (+2초, 자세히 보기) | ANSWER_MINIMAL · detail |
| 6 | `golden-06-returned.png` | 수업 복귀 | `returned` | 10:32:30 (+6초, 수업으로 돌아가기) | ANSWER_MINIMAL · minimal(18초 새로 셈) |
| 7 | `golden-07-folded.png` | E 접힌 메모 | `folded` | 10:32:43 (첫 접힘 +1초) | CAPTURE · folded |
| 8 | `golden-08-waiting.png` | H-2 튜터 멈춤 | `waiting` | 10:32:59 (`answer.queued`) | ANSWER_MINIMAL · waiting |
| 9 | `golden-09-recovered.png` | 복구 | `recovered` | 10:33:08 (`answer.recovered` +1초) | ANSWER_MINIMAL · minimal(일부 확인) |

## 얹는 화면과 폭 5장면 — 화면을 눌러서 갑니다

| # | 파일 | 디자인 상태 | 체크포인트 | 재생 시각(근거) | 메모 |
|---|---|---|---|---|---|
| 10 | `golden-10-history.png` | G 기록 | `answer` → 바닥줄 "기록 1" 클릭 | 10:32:25 | 정본대로 기록의 입구는 `SourceFooter` 의 카운트 하나뿐입니다. 교시 묶음 1개(3교시) · MomentRow 1줄 · 바닥 안내 · "기록 중" 바닥줄 |
| 11 | `golden-11-settings.png` | 설정 | `answer` → 헤더 설정 아이콘 클릭 | 10:32:25 | 답변(길이·자동 접기·제공자) · 붙잡을 때 함께 저장 + **개인정보 세 칸** · 수업 · 오늘 기록 지우기. 화면 높이 720 이라 아래 두 절은 스크롤 아래에 있습니다 |
| 12 | `golden-12-tiro-paused.png` | H-1 전사 멈춤 | `listening` → `window.classmateConnector('tiro-share','paused')` | 10:32:16 | 호박색 바닥줄 + "다시 연결" · 헤더 점 paused · 전사 멈춤용 팁. 아래 "왜 손잡이가 필요한가" 를 보세요 |
| 13 | `golden-w360-listening.png` | A 듣는 중 (폭 360) | `listening` | 10:32:16 | `--panel-inset` 14px · 가로 스크롤 0 |
| 14 | `golden-w520-answer.png` | C 한 줄 답변 (폭 520) | `answer` | 10:32:25 | `--panel-inset` 20px · 가로 스크롤 0 · 전사 최대 폭 안에서 줄이 길어지지 않음 |

폭 380 의 여백(16px)은 사진 없이 E2E 15번이 확인합니다.

## 장면을 세우는 두 가지 손잡이 (`?replay=manual` 일 때만)

| 손잡이 | 하는 일 | 왜 |
|---|---|---|
| `window.classmateReplay.goto(<체크포인트>)` | fixture 사건을 그 장면까지 다시 굴립니다 | 시각을 fixture 에서 유도하므로 fixture 가 바뀌면 장면도 함께 움직입니다 |
| `window.classmateConnector(<커넥터>, <형편>)` | 계약 `connector.status` 한 줄을 스토어에 넣습니다 | 골든 fixture 의 `connector.status` 세 줄은 **전부 `connected`** 라 연결 문제(H-1)를 사건만으로는 세울 수 없습니다. 정본 디자인도 이 상태를 시연 Tweaks(`tiroDown`)로 켜고 끕니다(`Classmate Side Panel.dc.html:131`). 넣는 값은 `connector` 와 `state` 두 칸뿐이고 글은 지어내지 않습니다. 실제 커넥터가 붙으면 service worker 가 같은 사건을 보내므로 이 손잡이는 사라집니다 |

각 장면이 확인하는 문구·셀렉터는 E2E 파일의 `STEPS` 와 10~15번 시험 본문에 있습니다.

`design-combined-preview-2026-09-02.png` 는 디자인 정본(`Classmate Side Panel.dc.html`)의 렌더 미리보기입니다.
정본 렌더와 구현을 상태별(A~H · H-1)로 나란히 놓은 비교 이미지는 `compare/` 에 있고, 표와 "차이 있음(의도)"
목록은 `compare/README.md` 에 있습니다. 다시 만드는 명령은 저장소 루트에서
`pnpm --filter @classmate/browser-extension build && node apps/browser-extension/scripts/compare-design.mjs` 입니다.
