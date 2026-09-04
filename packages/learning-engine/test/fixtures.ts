import type { SessionBundleV2 } from "@classmate/contracts";

type Profile = SessionBundleV2["profile"];

const TEXT_BY_PROFILE: Record<Profile, string> = {
  class: "합성 수업: 팩토리는 객체 생성을 한곳에서 담당합니다.",
  exam: "합성 시험 규칙: 요건 A와 요건 B를 모두 확인합니다.",
  meeting: "합성 회의: 데모 초안은 금요일까지 검토하기로 결정했습니다.",
};

export function syntheticBundle(profile: Profile): SessionBundleV2 {
  const sessionId = `synthetic-${profile}-session`;
  const materialId = `material-${profile}-transcript`;
  const momentId = `moment-${profile}-001`;

  return {
    schemaVersion: "2",
    sessionId,
    profile,
    title: `합성 ${profile} 세션`,
    startedAt: "2026-09-04T09:00:00+09:00",
    endedAt: "2026-09-04T10:00:00+09:00",
    sources: [
      {
        id: materialId,
        kind: "transcript",
        adapterId: "synthetic-test",
        label: "비식별 합성 전사",
      },
    ],
    moments: [
      {
        id: momentId,
        type: "transcript",
        at: "2026-09-04T09:10:00+09:00",
        materialRefIds: [materialId],
        assetRefIds: [],
        text: TEXT_BY_PROFILE[profile],
        transcript: {
          segmentId: `segment-${profile}-001`,
          revision: 0,
          isFinal: true,
        },
      },
    ],
    activities: [],
    artifacts: [],
  };
}
