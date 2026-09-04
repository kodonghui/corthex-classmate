import type { ActivitySetV2 } from '../session-history/types';
import { isActivitySetV2 } from '../session-history/types';

function instant(value: string): number {
  return Date.parse(value);
}

/**
 * JSON Schema 모양만 맞춘 변조 기록을 복습 화면에 올리지 않습니다.
 * 시도 전이 함수가 만드는 관계(고유 ID·시간 순서·힌트 상한·공개 뒤 후속 기록)까지 확인합니다.
 */
export function isReviewableActivitySetV2(value: unknown): value is ActivitySetV2 {
  if (!isActivitySetV2(value)) return false;

  const activityIds = new Set<string>();
  const attemptIds = new Set<string>();
  for (const card of value) {
    if (activityIds.has(card.id)) return false;
    activityIds.add(card.id);

    let previousSubmittedAt = Number.NEGATIVE_INFINITY;
    for (const attempt of card.attempts) {
      if (attemptIds.has(attempt.id)) return false;
      attemptIds.add(attempt.id);

      const startedAt = instant(attempt.startedAt);
      const submittedAt = instant(attempt.submittedAt);
      if (startedAt < previousSubmittedAt || submittedAt < startedAt) return false;
      if (attempt.hintLevel > card.hints.length) return false;

      if (attempt.revealedAt === undefined) {
        if (
          attempt.selfCorrection !== undefined ||
          attempt.feedback !== undefined ||
          attempt.nextAttemptAt !== undefined
        ) {
          return false;
        }
      } else {
        const revealedAt = instant(attempt.revealedAt);
        if (revealedAt < submittedAt) return false;
        if (
          attempt.nextAttemptAt !== undefined &&
          instant(attempt.nextAttemptAt) <= revealedAt
        ) {
          return false;
        }
      }
      previousSubmittedAt = submittedAt;
    }
  }
  return true;
}
