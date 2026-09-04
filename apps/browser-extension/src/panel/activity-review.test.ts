import activitySetExample from '@classmate/contracts/schemas/examples/activity-set-v2.1.json';
import { describe, expect, it } from 'vitest';

import type { ActivitySetV2 } from '../session-history/types';
import { isReviewableActivitySetV2 } from './activity-review';

function withAttempt(overrides: Record<string, unknown> = {}): ActivitySetV2 {
  const set = structuredClone(activitySetExample) as unknown as ActivitySetV2;
  set[0].attempts.push({
    id: 'attempt-1',
    startedAt: '2026-09-04T10:00:00+09:00',
    submittedAt: '2026-09-04T10:01:00+09:00',
    response: '내 답',
    confidence: 3,
    hintLevel: 0,
    revealedAt: '2026-09-04T10:01:01+09:00',
    ...overrides,
  });
  return set;
}

describe('isReviewableActivitySetV2', () => {
  it('정확한 빈 다섯 카드와 전이 규칙을 지킨 저장 시도를 받습니다', () => {
    expect(isReviewableActivitySetV2(activitySetExample)).toBe(true);
    expect(isReviewableActivitySetV2(withAttempt())).toBe(true);
  });

  it('중복 ID·뒤집힌 시각·힌트 상한 위반·공개 전 후속 기록을 거절합니다', () => {
    const duplicateCard = structuredClone(activitySetExample) as unknown as ActivitySetV2;
    duplicateCard[1].id = duplicateCard[0].id;
    expect(isReviewableActivitySetV2(duplicateCard)).toBe(false);
    expect(
      isReviewableActivitySetV2(withAttempt({ submittedAt: '2026-09-04T09:59:00+09:00' })),
    ).toBe(false);
    expect(isReviewableActivitySetV2(withAttempt({ hintLevel: 1 }))).toBe(false);
    expect(
      isReviewableActivitySetV2(withAttempt({ revealedAt: undefined, feedback: '가짜 피드백' })),
    ).toBe(false);
    expect(
      isReviewableActivitySetV2(withAttempt({ revealedAt: '2026-09-04T10:00:59+09:00' })),
    ).toBe(false);
  });
});
