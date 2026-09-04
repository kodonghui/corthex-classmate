import { createValidator, formatErrors } from "@classmate/contracts";
import { describe, expect, it } from "vitest";

import {
  AttemptTransitionError,
  beginAttempt,
  generateFiveActivities,
  openNextHint,
  recordAttemptFeedback,
  recordSelfCorrection,
  revealAttemptAnswer,
  scheduleNextAttempt,
  submitAttempt,
} from "../src/index";
import { syntheticBundle } from "./fixtures";

function recallCard() {
  return generateFiveActivities(syntheticBundle("class"))[0];
}

describe("활동 시도 기록", () => {
  it("힌트 단계와 답 공개 전 응답·확신을 순서대로 불변 기록한다", () => {
    const original = recallCard();
    const draft0 = beginAttempt(original, "2026-09-04T10:00:00+09:00");
    const draft1 = openNextHint(original, draft0);
    const submitted = submitAttempt(original, draft1, {
      response: "객체 생성 책임을 한곳에 모읍니다.",
      confidence: 3,
      submittedAt: "2026-09-04T10:01:00+09:00",
    });
    const revealed = revealAttemptAnswer(
      submitted,
      draft1.id,
      "2026-09-04T10:01:05+09:00",
    );
    const corrected = recordSelfCorrection(
      revealed,
      draft1.id,
      "팩토리가 객체 생성 책임을 한곳에서 담당합니다.",
    );
    const withFeedback = recordAttemptFeedback(
      corrected,
      draft1.id,
      "실제 전사 근거의 주어까지 고쳐 적었습니다.",
    );
    const scheduled = scheduleNextAttempt(
      withFeedback,
      draft1.id,
      "2026-09-05T10:00:00+09:00",
    );

    expect(original.attempts).toEqual([]);
    expect(draft0.hintLevel).toBe(0);
    expect(draft1.hintLevel).toBe(1);
    expect(scheduled.attempts[0]).toEqual({
      id: draft1.id,
      startedAt: "2026-09-04T10:00:00+09:00",
      submittedAt: "2026-09-04T10:01:00+09:00",
      response: "객체 생성 책임을 한곳에 모읍니다.",
      confidence: 3,
      hintLevel: 1,
      revealedAt: "2026-09-04T10:01:05+09:00",
      selfCorrection: "팩토리가 객체 생성 책임을 한곳에서 담당합니다.",
      feedback: "실제 전사 근거의 주어까지 고쳐 적었습니다.",
      nextAttemptAt: "2026-09-05T10:00:00+09:00",
    });

    const validate = createValidator("activity-card");
    expect(validate(scheduled), formatErrors(validate.errors).join("\n")).toBe(true);
  });

  it("제출되지 않은 draft에는 답 공개 함수가 적용될 수 없다", () => {
    const card = recallCard();
    const draft = beginAttempt(card, "2026-09-04T10:00:00+09:00");

    expect(() =>
      revealAttemptAnswer(card, draft.id, "2026-09-04T10:00:01+09:00"),
    ).toThrow(AttemptTransitionError);
  });

  it("빈 응답·범위 밖 확신·거꾸로 된 시각을 거부한다", () => {
    const card = recallCard();
    const draft = beginAttempt(card, "2026-09-04T10:00:00+09:00");

    expect(() =>
      submitAttempt(card, draft, {
        response: "   ",
        confidence: 3,
        submittedAt: "2026-09-04T10:01:00+09:00",
      }),
    ).toThrow("사용자 응답");
    expect(() =>
      submitAttempt(card, draft, {
        response: "내 답",
        confidence: 6,
        submittedAt: "2026-09-04T10:01:00+09:00",
      }),
    ).toThrow("1부터 5");
    expect(() =>
      submitAttempt(card, draft, {
        response: "내 답",
        confidence: 3,
        submittedAt: "2026-09-04T09:59:59+09:00",
      }),
    ).toThrow("이를 수 없습니다");
  });

  it("외부에서 조작된 draft id·startedAt·hintLevel을 열거나 저장하지 않는다", () => {
    const card = recallCard();
    const valid = beginAttempt(card, "2026-09-04T10:00:00+09:00");
    const submit = (draft: typeof valid) =>
      submitAttempt(card, draft, {
        response: "내 답",
        confidence: 3,
        submittedAt: "2026-09-04T10:01:00+09:00",
      });

    const badId = { ...valid, id: "forged-attempt" };
    const badStartedAt = { ...valid, startedAt: "어제쯤" };
    const negativeHint = { ...valid, hintLevel: -1 };
    const fractionalHint = { ...valid, hintLevel: 1.5 };
    const excessiveHint = { ...valid, hintLevel: card.hints.length + 1 };

    expect(() => openNextHint(card, badId)).toThrow("draft id");
    expect(() => submit(badStartedAt)).toThrow("ISO-8601");
    expect(() => openNextHint(card, negativeHint)).toThrow("hintLevel");
    expect(() => submit(fractionalHint)).toThrow("hintLevel");
    expect(() => submit(excessiveHint)).toThrow("hintLevel");
    expect(card.attempts).toEqual([]);
  });

  it("답 공개 전 자기 수정·피드백과 즉시가 아닌 과거 재시도를 거부한다", () => {
    const card = recallCard();
    const draft = beginAttempt(card, "2026-09-04T10:00:00+09:00");
    const submitted = submitAttempt(card, draft, {
      response: "내 답",
      confidence: 2,
      submittedAt: "2026-09-04T10:01:00+09:00",
    });

    expect(() => recordSelfCorrection(submitted, draft.id, "고친 답")).toThrow("공개한 뒤");
    expect(() => recordAttemptFeedback(submitted, draft.id, "피드백")).toThrow("공개한 뒤");
    expect(() =>
      scheduleNextAttempt(submitted, draft.id, "2026-09-05T10:00:00+09:00"),
    ).toThrow("공개한 뒤");
    expect(() =>
      scheduleNextAttempt(submitted, draft.id, "2026-09-04T09:00:00+09:00"),
    ).toThrow("공개한 뒤");
  });

  it("답 공개 뒤에도 공개 시각보다 이르거나 같은 다음 시도 시각은 거부한다", () => {
    const card = recallCard();
    const draft = beginAttempt(card, "2026-09-04T10:00:00+09:00");
    const submitted = submitAttempt(card, draft, {
      response: "내 답",
      confidence: 2,
      submittedAt: "2026-09-04T10:01:00+09:00",
    });
    const revealed = revealAttemptAnswer(
      submitted,
      draft.id,
      "2026-09-04T10:02:00+09:00",
    );

    expect(() =>
      scheduleNextAttempt(revealed, draft.id, "2026-09-04T10:01:30+09:00"),
    ).toThrow("이를 수 없습니다");
    expect(() =>
      scheduleNextAttempt(revealed, draft.id, "2026-09-04T10:02:00+09:00"),
    ).toThrow("revealedAt보다 뒤");
  });

  it("이전 시도 다음에 결정적인 새 ID를 만들고 응답 원문은 덮어쓰지 않는다", () => {
    const firstCard = recallCard();
    const firstDraft = beginAttempt(firstCard, "2026-09-04T10:00:00+09:00");
    const submitted = submitAttempt(firstCard, firstDraft, {
      response: "첫 답",
      confidence: 1,
      submittedAt: "2026-09-04T10:01:00+09:00",
    });
    const revealed = revealAttemptAnswer(
      submitted,
      firstDraft.id,
      "2026-09-04T10:02:00+09:00",
    );
    const corrected = recordSelfCorrection(revealed, firstDraft.id, "고친 답");
    const secondDraft = beginAttempt(corrected, "2026-09-05T10:00:00+09:00");

    expect(secondDraft.id).toBe(`${firstCard.id}:attempt:2`);
    expect(corrected.attempts[0]?.response).toBe("첫 답");
    expect(corrected.attempts[0]?.selfCorrection).toBe("고친 답");
  });
});
