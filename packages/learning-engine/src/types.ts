import type {
  ActivityCard,
  ActivityAttempt,
  ActivitySetV2,
  SessionBundleV2,
} from "@classmate/contracts";

/** 다섯 슬롯의 순서를 타입과 런타임에서 함께 고정합니다. */
export const ACTIVITY_SLOTS = [
  "RECALL",
  "EXPLAIN",
  "INSPECT",
  "APPLY",
  "TRANSFER",
] as const satisfies readonly ActivityCard["slot"][];

export type ActivitySlotName = (typeof ACTIVITY_SLOTS)[number];
export type SessionProfileName = SessionBundleV2["profile"];

/** 생성기는 완성 번들도, 아직 activities가 빈 번들도 같은 방식으로 읽습니다. */
export type ActivitySourceBundle = Pick<
  SessionBundleV2,
  "sessionId" | "profile" | "sources" | "moments" | "artifacts"
>;

/** 정본 계약의 정확히 다섯 카드 튜플을 읽기 쉬운 이름으로 다시 내보냅니다. */
export type FiveActivityCards = ActivitySetV2;

/** 제출 전의 작업 상태입니다. 아직 계약의 ActivityAttempt가 아니므로 응답을 비워 둘 수 있습니다. */
export interface PendingActivityAttempt {
  readonly id: string;
  readonly activityId: string;
  readonly startedAt: string;
  readonly hintLevel: number;
}

export interface AttemptSubmission {
  readonly response: string;
  readonly confidence: number;
  readonly submittedAt: string;
}

export type { ActivityCard, ActivityAttempt, ActivitySetV2, SessionBundleV2 };
