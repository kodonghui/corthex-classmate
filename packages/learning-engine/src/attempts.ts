import type { ActivityCard, ActivityAttempt } from "@classmate/contracts";

import type { AttemptSubmission, PendingActivityAttempt } from "./types";

export class AttemptTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttemptTransitionError";
  }
}

function parseInstant(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || !/T/.test(value) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new AttemptTransitionError(`${label}은 시간대가 포함된 ISO-8601 시각이어야 합니다.`);
  }
  return parsed;
}

function assertAtOrAfter(
  later: string,
  earlier: string,
  laterLabel: string,
  earlierLabel: string,
): void {
  if (parseInstant(later, laterLabel) < parseInstant(earlier, earlierLabel)) {
    throw new AttemptTransitionError(`${laterLabel}은 ${earlierLabel}보다 이를 수 없습니다.`);
  }
}

function replaceAttempt(
  card: ActivityCard,
  attemptId: string,
  update: (attempt: ActivityAttempt) => ActivityAttempt,
): ActivityCard {
  let found = false;
  const attempts = card.attempts.map((attempt) => {
    if (attempt.id !== attemptId) return attempt;
    found = true;
    return update(attempt);
  });
  if (!found) {
    throw new AttemptTransitionError(`활동 ${card.id}에 시도 ${attemptId}가 없습니다.`);
  }
  return { ...card, attempts };
}

function validatePendingAttempt(
  card: ActivityCard,
  draft: PendingActivityAttempt,
): void {
  if (draft.activityId !== card.id) {
    throw new AttemptTransitionError("다른 활동의 시도는 사용할 수 없습니다.");
  }

  const idPrefix = `${card.id}:attempt:`;
  const sequence = typeof draft.id === "string" && draft.id.startsWith(idPrefix)
    ? draft.id.slice(idPrefix.length)
    : "";
  if (!/^[1-9]\d*$/.test(sequence)) {
    throw new AttemptTransitionError("draft id는 현재 활동의 양의 정수 시도 번호여야 합니다.");
  }

  parseInstant(draft.startedAt, "draft.startedAt");
  if (
    !Number.isInteger(draft.hintLevel) ||
    draft.hintLevel < 0 ||
    draft.hintLevel > card.hints.length
  ) {
    throw new AttemptTransitionError(
      `draft.hintLevel은 0부터 ${card.hints.length}까지의 정수여야 합니다.`,
    );
  }

  const previous = card.attempts.at(-1);
  if (previous !== undefined) {
    assertAtOrAfter(
      draft.startedAt,
      previous.submittedAt,
      "draft.startedAt",
      "이전 submittedAt",
    );
  }
}

/** 답 칸이 아직 없는 제출 전 상태를 시작합니다. */
export function beginAttempt(card: ActivityCard, startedAt: string): PendingActivityAttempt {
  parseInstant(startedAt, "startedAt");

  const previous = card.attempts.at(-1);
  if (previous !== undefined) {
    assertAtOrAfter(startedAt, previous.submittedAt, "startedAt", "이전 submittedAt");
  }

  let sequence = card.attempts.length + 1;
  let id = `${card.id}:attempt:${sequence}`;
  const usedIds = new Set(card.attempts.map((attempt) => attempt.id));
  while (usedIds.has(id)) {
    sequence += 1;
    id = `${card.id}:attempt:${sequence}`;
  }

  return { id, activityId: card.id, startedAt, hintLevel: 0 };
}

/** 다음 힌트 한 단계만 엽니다. 반환값만 바뀌며 원래 draft는 건드리지 않습니다. */
export function openNextHint(
  card: ActivityCard,
  draft: PendingActivityAttempt,
): PendingActivityAttempt {
  validatePendingAttempt(card, draft);
  if (draft.hintLevel >= card.hints.length) {
    throw new AttemptTransitionError("더 열 수 있는 힌트가 없습니다.");
  }
  return { ...draft, hintLevel: draft.hintLevel + 1 };
}

/** 사용자 응답과 확신도를 먼저 저장해 계약의 ActivityAttempt로 확정합니다. */
export function submitAttempt(
  card: ActivityCard,
  draft: PendingActivityAttempt,
  submission: AttemptSubmission,
): ActivityCard {
  validatePendingAttempt(card, draft);
  if (card.attempts.some((attempt) => attempt.id === draft.id)) {
    throw new AttemptTransitionError(`시도 ${draft.id}는 이미 제출되었습니다.`);
  }

  if (submission.response.trim().length === 0) {
    throw new AttemptTransitionError("답을 공개하기 전에 사용자 응답을 먼저 적어야 합니다.");
  }
  if (
    !Number.isInteger(submission.confidence) ||
    submission.confidence < 1 ||
    submission.confidence > 5
  ) {
    throw new AttemptTransitionError("확신도는 1부터 5까지의 정수여야 합니다.");
  }
  assertAtOrAfter(submission.submittedAt, draft.startedAt, "submittedAt", "startedAt");

  const attempt: ActivityAttempt = {
    id: draft.id,
    startedAt: draft.startedAt,
    submittedAt: submission.submittedAt,
    response: submission.response,
    confidence: submission.confidence,
    hintLevel: draft.hintLevel,
  };
  return { ...card, attempts: [...card.attempts, attempt] };
}

/** 제출된 응답을 보존한 채 모범 응답을 공개한 시각만 추가합니다. */
export function revealAttemptAnswer(
  card: ActivityCard,
  attemptId: string,
  revealedAt: string,
): ActivityCard {
  return replaceAttempt(card, attemptId, (attempt) => {
    if (attempt.revealedAt !== undefined) {
      throw new AttemptTransitionError(`시도 ${attemptId}의 답은 이미 공개되었습니다.`);
    }
    assertAtOrAfter(revealedAt, attempt.submittedAt, "revealedAt", "submittedAt");
    return { ...attempt, revealedAt };
  });
}

/** 답 공개 뒤 사용자가 자기 말로 고친 내용을 기록합니다. */
export function recordSelfCorrection(
  card: ActivityCard,
  attemptId: string,
  selfCorrection: string,
): ActivityCard {
  if (selfCorrection.trim().length === 0) {
    throw new AttemptTransitionError("자기 수정 내용은 비워 둘 수 없습니다.");
  }
  return replaceAttempt(card, attemptId, (attempt) => {
    if (attempt.revealedAt === undefined) {
      throw new AttemptTransitionError("답을 공개한 뒤에 자기 수정을 기록할 수 있습니다.");
    }
    return { ...attempt, selfCorrection };
  });
}

/** 답 공개 뒤 근거 기반 피드백을 기록합니다. */
export function recordAttemptFeedback(
  card: ActivityCard,
  attemptId: string,
  feedback: string,
): ActivityCard {
  if (feedback.trim().length === 0) {
    throw new AttemptTransitionError("피드백은 비워 둘 수 없습니다.");
  }
  return replaceAttempt(card, attemptId, (attempt) => {
    if (attempt.revealedAt === undefined) {
      throw new AttemptTransitionError("답을 공개한 뒤에 피드백을 기록할 수 있습니다.");
    }
    return { ...attempt, feedback };
  });
}

/** 상위 제품이 고른 다음 회상 시각을 검증하고 기록합니다. */
export function scheduleNextAttempt(
  card: ActivityCard,
  attemptId: string,
  nextAttemptAt: string,
): ActivityCard {
  return replaceAttempt(card, attemptId, (attempt) => {
    if (attempt.revealedAt === undefined) {
      throw new AttemptTransitionError("답을 공개한 뒤에 다음 시도를 예약할 수 있습니다.");
    }
    assertAtOrAfter(nextAttemptAt, attempt.revealedAt, "nextAttemptAt", "revealedAt");
    if (Date.parse(nextAttemptAt) === Date.parse(attempt.revealedAt)) {
      throw new AttemptTransitionError("nextAttemptAt은 revealedAt보다 뒤여야 합니다.");
    }
    return { ...attempt, nextAttemptAt };
  });
}
