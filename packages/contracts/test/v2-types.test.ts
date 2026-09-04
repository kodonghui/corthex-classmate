import { describe, expect, it } from "vitest";

import type {
  ActivityAttempt,
  ActivityCard,
  ActivitySetV2,
  AssetRef,
  MaterialRef,
  SessionBundleV2,
  SessionMomentV2,
  SessionProfileV2,
  SessionSummaryV2,
  TutorResponseV2,
} from "../src/index";

const profile: SessionProfileV2 = "class";

const material: MaterialRef = {
  id: "material-001",
  kind: "transcript",
  adapterId: "fixture-transcript",
};

const asset: AssetRef = {
  id: "asset-001",
  kind: "image",
  mediaType: "image/jpeg",
  path: "frames/frame-001.jpg",
};

const response: TutorResponseV2 = {
  id: "response-001",
  questionId: "question-001",
  createdAt: "2026-09-04T20:31:10+09:00",
  conclusion: "근거를 함께 확인합니다.",
  evidenceRefIds: ["moment-001"],
  sections: [],
  providerId: "fake-provider",
  status: "completed",
};

const attempt: ActivityAttempt = {
  id: "attempt-001",
  startedAt: "2026-09-04T20:35:00+09:00",
  submittedAt: "2026-09-04T20:35:30+09:00",
  response: "직접 낸 답입니다.",
  confidence: 3,
  hintLevel: 0,
};

const activity = <T extends ActivityCard["slot"]>(slot: T): ActivityCard & { slot: T } => ({
  id: `activity-${slot.toLowerCase()}`,
  slot,
  kind: "question",
  prompt: "직접 답해 보세요.",
  evidenceRefIds: ["moment-001"],
  hints: [],
  answer: "근거를 확인합니다.",
  attempts: [attempt],
});

const activitySet: ActivitySetV2 = [
  activity("RECALL"),
  activity("EXPLAIN"),
  activity("INSPECT"),
  activity("APPLY"),
  activity("TRANSFER"),
];

const summary: SessionSummaryV2 = {
  sessionId: "session-001",
  profile,
  eventCount: 0,
  transcriptCount: 0,
  questionCount: 0,
  answerCount: 0,
  frameCount: 0,
};

const moment: SessionMomentV2 = {
  id: "moment-response-001",
  type: "response",
  at: response.createdAt,
  materialRefIds: [material.id],
  assetRefIds: [asset.id],
  response,
};

const bundle: SessionBundleV2 = {
  schemaVersion: "2",
  sessionId: summary.sessionId,
  profile,
  startedAt: "2026-09-04T20:30:00+09:00",
  summary,
  sources: [material],
  moments: [moment],
  activities: [],
  artifacts: [asset],
};

describe("V2 생성 타입 공개 API", () => {
  it("요약·번들·응답·활동 타입을 함께 조립할 수 있다", () => {
    expect(bundle.schemaVersion).toBe("2");
    expect(bundle.moments[0]?.response?.questionId).toBe("question-001");
    expect(activitySet.map((card) => card.slot)).toEqual([
      "RECALL",
      "EXPLAIN",
      "INSPECT",
      "APPLY",
      "TRANSFER",
    ]);
  });
});
