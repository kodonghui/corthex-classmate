# @classmate/learning-engine

`SessionBundleV2`의 실제 근거를 다음 다섯 활동으로 바꾸는 순수 TypeScript 패키지입니다.

```text
RECALL → EXPLAIN → INSPECT → APPLY → TRANSFER
```

- 네트워크·브라우저·AI를 호출하지 않습니다.
- 같은 입력은 같은 카드 ID·순서·문구를 만듭니다.
- 모든 카드에는 실제 번들 근거 ID가 한 개 이상 들어갑니다.
- 근거가 한 건뿐이면 그 근거를 다섯 인지 활동으로 안전하게 바꿉니다.
- 근거가 전혀 없으면 내용을 지어내지 않고 `InsufficientEvidenceError`를 던집니다.
- 사용자가 답을 제출하기 전에는 모범 응답 공개 시각을 기록할 수 없습니다.
- `withGeneratedActivities`는 기존 활동이나 시도를 덮어쓰지 않고 `ActivitiesAlreadyGeneratedError`로 중단합니다.

## 공개 함수

```ts
const cards = generateFiveActivities(bundle);

let draft = beginAttempt(cards[0], "2026-09-04T10:00:00+09:00");
draft = openNextHint(cards[0], draft);

let card = submitAttempt(cards[0], draft, {
  response: "내가 먼저 떠올린 답",
  confidence: 3,
  submittedAt: "2026-09-04T10:01:00+09:00",
});

card = revealAttemptAnswer(card, draft.id, "2026-09-04T10:01:05+09:00");
card = recordSelfCorrection(card, draft.id, "근거를 보고 고친 답");
card = scheduleNextAttempt(card, draft.id, "2026-09-05T10:00:00+09:00");
```

다음 시도 시각은 이 패키지가 보편적인 `1·3·7일` 규칙으로 정하지 않습니다. 상위 제품이 학습 결과와 사용자의 일정에 따라 고른 시각을 이 패키지가 검증하고 기록합니다.
