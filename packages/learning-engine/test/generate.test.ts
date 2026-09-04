import { createValidator, formatErrors, type ActivitySetV2 } from "@classmate/contracts";
import { describe, expect, it } from "vitest";

import {
  ACTIVITY_SLOTS,
  ActivitiesAlreadyGeneratedError,
  generateFiveActivities,
  InsufficientEvidenceError,
  withGeneratedActivities,
} from "../src/index";
import { syntheticBundle } from "./fixtures";

describe("generateFiveActivities", () => {
  it.each(["class", "exam", "meeting"] as const)(
    "%s 프로필에 정확히 다섯 슬롯과 실제 근거를 만든다",
    (profile) => {
      const bundle = syntheticBundle(profile);
      const cards = generateFiveActivities(bundle);

      expect(cards).toHaveLength(5);
      expect(cards.map((card) => card.slot)).toEqual(ACTIVITY_SLOTS);
      expect(cards.every((card) => card.evidenceRefIds.length >= 1)).toBe(true);
      expect(cards.every((card) => card.attempts.length === 0)).toBe(true);

      const knownIds = new Set([
        ...bundle.sources.map((source) => source.id),
        ...bundle.moments.map((moment) => moment.id),
        ...bundle.artifacts.map((artifact) => artifact.id),
      ]);
      for (const card of cards) {
        expect(card.evidenceRefIds.every((id) => knownIds.has(id))).toBe(true);
      }

      const validate = createValidator<ActivitySetV2>("activity-set-v2");
      expect(validate(cards), formatErrors(validate.errors).join("\n")).toBe(true);
    },
  );

  it("같은 번들에는 바이트 수준으로 같은 결과를 만들고 입력을 바꾸지 않는다", () => {
    const bundle = syntheticBundle("class");
    const before = structuredClone(bundle);

    const first = generateFiveActivities(bundle);
    const second = generateFiveActivities(bundle);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(bundle).toEqual(before);
  });

  it("원본을 바꾸지 않고 다섯 활동이 채워진 새 SessionBundleV2를 만든다", () => {
    const bundle = syntheticBundle("meeting");
    const populated = withGeneratedActivities(bundle);

    expect(bundle.activities).toEqual([]);
    expect(populated).not.toBe(bundle);
    expect(populated.activities.map((card) => card.slot)).toEqual(ACTIVITY_SLOTS);

    const validate = createValidator("session-bundle-v2");
    expect(validate(populated), formatErrors(validate.errors).join("\n")).toBe(true);
  });

  it("기존 활동이나 시도를 조용히 덮어쓰지 않는다", () => {
    const bundle = syntheticBundle("class");
    const existing = generateFiveActivities(bundle)[0];
    existing.attempts = [
      {
        id: `${existing.id}:attempt:1`,
        startedAt: "2026-09-04T10:00:00+09:00",
        submittedAt: "2026-09-04T10:01:00+09:00",
        response: "보존해야 하는 기존 응답",
        confidence: 3,
        hintLevel: 0,
      },
    ];
    bundle.activities = [existing];

    expect(() => withGeneratedActivities(bundle)).toThrow(ActivitiesAlreadyGeneratedError);
    expect(bundle.activities[0]?.attempts[0]?.response).toBe("보존해야 하는 기존 응답");
  });

  it("근거가 한 건뿐이면 내용을 늘리지 않고 같은 근거를 다섯 인지 활동으로 바꾼다", () => {
    const cards = generateFiveActivities(syntheticBundle("exam"));
    const primaryRefs = cards.map((card) => card.evidenceRefIds[0]);

    expect(new Set(primaryRefs)).toEqual(new Set(["moment-exam-001"]));
    expect(new Set(cards.map((card) => card.prompt)).size).toBe(5);
    expect(cards.every((card) => card.answer.includes("합성 시험 규칙"))).toBe(true);
  });

  it("세 프로필의 문구와 활동 형식을 서로 다르게 만든다", () => {
    const classCards = generateFiveActivities(syntheticBundle("class"));
    const examCards = generateFiveActivities(syntheticBundle("exam"));
    const meetingCards = generateFiveActivities(syntheticBundle("meeting"));

    expect(classCards.map((card) => card.kind)).not.toEqual(examCards.map((card) => card.kind));
    expect(examCards.map((card) => card.kind)).not.toEqual(meetingCards.map((card) => card.kind));
    expect(classCards[0].prompt).toContain("수업 근거");
    expect(examCards[0].prompt).toContain("시험 근거");
    expect(meetingCards[0].prompt).toContain("회의 근거");
  });

  it("텍스트가 없는 화면 근거를 내용으로 꾸며내지 않는다", () => {
    const bundle = syntheticBundle("class");
    bundle.sources = [];
    bundle.moments = [
      {
        id: "moment-visual-only",
        type: "visual",
        at: "2026-09-04T09:20:00+09:00",
        materialRefIds: [],
        assetRefIds: ["asset-frame-001"],
      },
    ];
    bundle.artifacts = [
      {
        id: "asset-frame-001",
        kind: "image",
        mediaType: "image/jpeg",
        path: "frames/synthetic.jpg",
      },
    ];

    const cards = generateFiveActivities(bundle);
    expect(cards.every((card) => card.answer.includes("원본을 직접 열어 확인"))).toBe(true);
    expect(cards.every((card) => !card.answer.includes("synthetic.jpg"))).toBe(true);
  });

  it("MaterialRef.label을 실제 본문 발췌로 승격하지 않는다", () => {
    const bundle = syntheticBundle("class");
    bundle.moments = [];
    bundle.artifacts = [];
    bundle.sources = [
      {
        id: "material-label-only",
        kind: "document",
        adapterId: "synthetic-test",
        label: "자료 이름일 뿐 실제 본문이 아닌 문구",
      },
    ];

    const cards = generateFiveActivities(bundle);
    expect(cards.every((card) => card.answer.includes("원본을 직접 열어 확인"))).toBe(true);
    expect(cards.every((card) => !card.answer.includes("자료 이름일 뿐"))).toBe(true);
    expect(cards.every((card) => !card.hints.join(" ").includes("자료 이름일 뿐"))).toBe(true);
  });

  it("moment·material ID가 충돌하는 유효 입력에서도 근거 ID를 중복하지 않는다", () => {
    const bundle = syntheticBundle("class");
    const collisionId = "shared-evidence-id";
    const source = bundle.sources[0];
    const moment = bundle.moments[0];
    if (source === undefined || moment === undefined) throw new Error("합성 fixture가 비었습니다.");
    source.id = collisionId;
    moment.id = collisionId;
    moment.materialRefIds = [collisionId];

    const bundleValidator = createValidator("session-bundle-v2");
    expect(bundleValidator(bundle), formatErrors(bundleValidator.errors).join("\n")).toBe(true);

    const cards = generateFiveActivities(bundle);
    expect(cards.every((card) => new Set(card.evidenceRefIds).size === card.evidenceRefIds.length)).toBe(
      true,
    );
    expect(cards.every((card) => card.evidenceRefIds[0] === collisionId)).toBe(true);
  });

  it("근거가 전혀 없으면 그럴듯한 문제를 만들지 않는다", () => {
    const bundle = syntheticBundle("meeting");
    bundle.sources = [];
    bundle.moments = [];
    bundle.artifacts = [];

    expect(() => generateFiveActivities(bundle)).toThrow(InsufficientEvidenceError);
  });
});
