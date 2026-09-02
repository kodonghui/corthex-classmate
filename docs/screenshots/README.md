# docs/screenshots — 골든 시나리오 9장면

`apps/browser-extension/e2e/extension.spec.ts` 가 빌드된 확장을 Chromium 에 얹고, fixtures
(`fixtures/synthetic-class/golden-ioc/`)만으로 "왜 new로 직접 만들면 안 돼요?" 시나리오를 다시 굴려 찍은 사진입니다.
폭 380 × 높이 720, `animations: 'disabled'`(진입 애니메이션을 끝 상태로 보낸 뒤 촬영). 합성 fixture 라 실제 수업·사람은 없습니다.

다시 만들기(저장소 루트 · Git Bash):

```bash
pnpm --filter @classmate/browser-extension build
pnpm --filter @classmate/browser-extension e2e
```

| # | 파일 | 디자인 상태 | 체크포인트 | 재생 시각(근거) | tutor-core `state` · `note` |
|---|---|---|---|---|---|
| 1 | `golden-01-listening.png` | A 듣는 중 | `listening` | 10:32:16 (첫 질문 −2초) | CAPTURE · none |
| 2 | `golden-02-caught.png` | B 붙잡은 직후 | `caught` | 10:32:18 (첫 질문 `question.asked`) | ANSWER_MINIMAL · preparing |
| 3 | `golden-03-sentence.png` | D 문장을 붙잡음 | `sentence` | 10:32:16 + 마지막 문장 붙잡기 | CAPTURE · none(화면은 choosing) |
| 4 | `golden-04-answer.png` | C 한 줄 답변 | `answer` | 10:32:25 (`answer.completed` +1초) | ANSWER_MINIMAL · minimal |
| 5 | `golden-05-detail.png` | F 자세히 | `detail` | 10:32:26 (+2초, 자세히 보기) | ANSWER_MINIMAL · detail |
| 6 | `golden-06-returned.png` | 수업 복귀 | `returned` | 10:32:30 (+6초, 수업으로 돌아가기) | ANSWER_MINIMAL · minimal(18초 새로 셈) |
| 7 | `golden-07-folded.png` | E 접힌 메모 | `folded` | 10:32:43 (첫 접힘 +1초) | CAPTURE · folded |
| 8 | `golden-08-waiting.png` | H 튜터 멈춤 | `waiting` | 10:32:59 (`answer.queued`) | ANSWER_MINIMAL · waiting |
| 9 | `golden-09-recovered.png` | 복구 | `recovered` | 10:33:08 (`answer.recovered` +1초) | ANSWER_MINIMAL · minimal(일부 확인) |

체크포인트는 `window.classmateReplay.goto(<이름>)` 으로 고릅니다(`?replay=manual` 일 때). 시각은 fixture 사건에서
유도하므로 fixture 가 바뀌면 함께 바뀝니다. 각 장면이 확인하는 문구·셀렉터는 E2E 파일의 `STEPS` 에 있습니다.

`design-combined-preview-2026-09-02.png` 는 디자인 정본(`Classmate Side Panel.dc.html`)의 렌더 미리보기입니다.
구현 스크린샷과 나란히 놓은 비교 이미지는 2라운드에서 만듭니다.
