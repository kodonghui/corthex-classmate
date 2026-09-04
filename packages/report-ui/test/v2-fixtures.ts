// V2 보고서 시험 안에서만 쓰는 비식별 합성 fixture입니다.

import type { SessionBundleV2, SessionProfileV2 } from "../src/types.ts";

export function makeSessionBundleV2(
  profile: SessionProfileV2 = "class",
  overrides: Partial<SessionBundleV2> = {},
): SessionBundleV2 {
  const sessionId = `fixture-${profile}`;
  const base: SessionBundleV2 = {
    schemaVersion: "2",
    sessionId,
    profile,
    title: `${profile} 합성 세션`,
    startedAt: "2026-09-04T09:00:00+09:00",
    endedAt: "2026-09-04T10:00:00+09:00",
    sources: [
      {
        id: "material-transcript",
        kind: "transcript",
        adapterId: "fixture-transcript",
        label: "합성 전사",
      },
    ],
    moments: [],
    activities: [],
    artifacts: [],
  };
  return { ...base, ...overrides };
}
