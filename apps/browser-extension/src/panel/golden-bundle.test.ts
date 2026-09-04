// 골든 fixture 묶음이 계약 스키마를 그대로 통과하고, 화면이 기대는 값(교시·낱말·짐작)이 맞는지 봅니다.
// Ajv 는 시험에서만 씁니다(제품 코드는 contracts 를 `import type` 으로만 봅니다).

import { createValidator, formatErrors, type SchemaName } from "@classmate/contracts";
import { describe, expect, it } from "vitest";

import {
  emptyBundle,
  GOLDEN_BUNDLE,
  GOLDEN_TERMS,
  guessesForLine,
  LIVE_EDITOR_PLACEHOLDER_ID,
  parseJsonl,
} from "./golden-bundle";

function expectValid(schema: SchemaName, value: unknown, what: string): void {
  const validate = createValidator(schema);
  const ok = validate(value);
  expect(ok, `${what}: ${formatErrors(validate.errors).join(" · ")}`).toBe(true);
}

describe("골든 fixture 묶음", () => {
  it("전사·프레임·편집기·질문·답·사건이 전부 계약 스키마를 통과한다", () => {
    GOLDEN_BUNDLE.transcript.forEach((s) => expectValid("transcript-segment", s, s.id));
    GOLDEN_BUNDLE.frames.forEach((f) => expectValid("screen-frame", f, f.id));
    expectValid("editor-context", GOLDEN_BUNDLE.editor, GOLDEN_BUNDLE.editor.id);
    Object.values(GOLDEN_BUNDLE.questions).forEach((q) => expectValid("question", q, q.id));
    Object.values(GOLDEN_BUNDLE.answers).forEach((a) => expectValid("answer", a, a.id));
    GOLDEN_BUNDLE.events.forEach((e) => expectValid("session-event", e, e.id));
  });

  it("교시·제목·개수가 fixture 와 같다", () => {
    expect(GOLDEN_BUNDLE.periodId).toBe("2026-09-02-p3");
    // 기존 fixture에는 profile 칸이 없으므로 수업으로 안전하게 이어집니다.
    expect(GOLDEN_BUNDLE.profile).toBe("class");
    expect(GOLDEN_BUNDLE.periodIndex).toBe(3);
    expect(GOLDEN_BUNDLE.subject).toBe("IoC 컨테이너와 의존성 주입");
    expect(GOLDEN_BUNDLE.events).toHaveLength(27);
    expect(GOLDEN_BUNDLE.transcript).toHaveLength(9);
    expect(Object.keys(GOLDEN_BUNDLE.questions)).toEqual(["q-p3-001", "q-p3-002"]);
    expect(Object.keys(GOLDEN_BUNDLE.answers).sort()).toEqual(["ans-p3-001", "ans-p3-002", "ans-p3-002-queued"]);
  });

  it("점선 낱말은 fixture 에 답이 있는 것만이다", () => {
    for (const term of GOLDEN_TERMS) {
      const answered = Object.values(GOLDEN_BUNDLE.answers).some((answer) => {
        const question = GOLDEN_BUNDLE.questions[answer.questionId];
        return question?.anchor?.word === term && answer.status !== "queued";
      });
      expect(answered, `${term} 의 답이 fixture 에 없어요`).toBe(true);
    }
  });

  it("짐작이 가리키는 낱말은 전부 점선 낱말 안에 있다", () => {
    for (const lineId of ["ts-p3-004", "ts-p3-005", "ts-p3-008", "ts-p3-999"]) {
      const guesses = guessesForLine(lineId);
      expect(guesses.length).toBeGreaterThanOrEqual(2);
      expect(guesses.length).toBeLessThanOrEqual(3);
      for (const guess of guesses) expect(GOLDEN_TERMS).toContain(guess.term);
    }
  });

  it("parseJsonl 은 빈 줄을 건너뛴다", () => {
    expect(parseJsonl<{ a: number }>('{"a":1}\n\n  \n{"a":2}\n')).toEqual([{ a: 1 }, { a: 2 }]);
  });
});

describe("라이브 빈 묶음", () => {
  const START = Date.parse("2026-09-02T10:00:00+09:00");

  it("자료는 비어 있고 편집기 자리표시는 계약 스키마를 통과한다", () => {
    const bundle = emptyBundle("2026-09-02-p9", START);
    expect(bundle.transcript).toHaveLength(0);
    expect(bundle.frames).toHaveLength(0);
    expect(bundle.events).toHaveLength(0);
    expect(bundle.questions).toEqual({});
    expect(bundle.answers).toEqual({});
    expect(bundle.editor.id).toBe(LIVE_EDITOR_PLACEHOLDER_ID);
    expectValid("editor-context", bundle.editor, "라이브 자리표시 편집기 문맥");
  });

  it("제목은 넘긴 값을 쓰고 없으면 '수업' 이다", () => {
    expect(emptyBundle("2026-09-02-p9", START).subject).toBe("수업");
    expect(emptyBundle("2026-09-02-p9", START, "IoC 와 DI").subject).toBe("IoC 와 DI");
    expect(emptyBundle("2026-09-02-p9", START).periodIndex).toBe(1);
  });

  it.each(["class", "exam", "meeting"] as const)("%s profile로 빈 라이브 묶음을 시작한다", (profile) => {
    expect(emptyBundle("2026-09-02-p9", START, "주제", profile).profile).toBe(profile);
  });
});
