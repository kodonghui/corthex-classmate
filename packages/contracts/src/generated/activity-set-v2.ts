/* eslint-disable */
/**
 * 생성물 · 직접 고치지 말 것
 *
 * 정본은 packages/contracts/schemas/*.schema.json 입니다.
 * 타입을 바꾸려면 스키마를 고치고 `pnpm --filter @classmate/contracts generate` 를 다시 실행하세요.
 */

/**
 * 완성된 다섯 활동을 고정 슬롯 순서로 담는 묶음입니다.
 *
 * @minItems 5
 * @maxItems 5
 */
export type ActivitySetV2 = [
  ActivityCard & {
    slot?: "RECALL";
  },
  ActivityCard & {
    slot?: "EXPLAIN";
  },
  ActivityCard & {
    slot?: "INSPECT";
  },
  ActivityCard & {
    slot?: "APPLY";
  },
  ActivityCard & {
    slot?: "TRANSFER";
  }
];
/**
 * 한 항목을 가리키는 문자열 식별자입니다.
 */
export type Id = string;
/**
 * 예측 가능한 다섯 활동의 고정 순서 자리입니다.
 *
 * This interface was referenced by `ActivityCard`'s JSON-Schema
 * via the `definition` "ActivitySlot".
 */
export type ActivitySlot = "RECALL" | "EXPLAIN" | "INSPECT" | "APPLY" | "TRANSFER";
/**
 * 활동이 요구하는 수행 형식입니다.
 *
 * This interface was referenced by `ActivityCard`'s JSON-Schema
 * via the `definition` "ActivityKind".
 */
export type ActivityKind = "question" | "worked-example" | "simulation";
/**
 * ISO-8601 시각 문자열입니다. 보기 2026-09-02T10:32:18+09:00
 */
export type IsoDateTime = string;

/**
 * 다섯 학습 슬롯 중 한 자리를 채우는 근거 기반 활동입니다.
 */
export interface ActivityCard {
  id: Id;
  slot: ActivitySlot;
  kind: ActivityKind;
  /**
   * 답을 보기 전에 사용자가 수행할 질문이나 상황입니다.
   */
  prompt: string;
  /**
   * 활동을 만든 근거 식별자이며 한 개 이상이어야 합니다.
   *
   * @minItems 1
   */
  evidenceRefIds: Id[];
  /**
   * 사용자가 단계별로 열 수 있는 힌트입니다.
   */
  hints: string[];
  /**
   * 시도 뒤에만 공개할 모범 응답이나 해설입니다.
   */
  answer: string;
  /**
   * 조건을 바꿔 다시 적용하게 하는 선택적 변형 질문입니다.
   */
  variation?: string;
  /**
   * 답 공개 전 시도와 그 뒤 자기 수정을 시간 순서로 담습니다.
   */
  attempts: ActivityAttempt[];
}
/**
 * 답을 공개하기 전 사용자가 직접 낸 한 번의 시도와 후속 기록입니다.
 *
 * This interface was referenced by `ActivityCard`'s JSON-Schema
 * via the `definition` "ActivityAttempt".
 */
export interface ActivityAttempt {
  id: Id;
  startedAt: IsoDateTime;
  submittedAt: IsoDateTime;
  /**
   * 사용자가 답 공개 전에 직접 낸 응답입니다.
   */
  response: string;
  /**
   * 시도 당시 사용자가 표시한 확신 정도이며 1이 가장 낮고 5가 가장 높습니다.
   */
  confidence: number;
  /**
   * 이 시도 전에 연 힌트의 가장 높은 단계이며 힌트를 안 봤으면 0입니다.
   */
  hintLevel: number;
  /**
   * 모범 응답을 공개한 시각입니다. 제출 전에는 두지 않습니다.
   */
  revealedAt?: string;
  /**
   * 피드백이나 답 공개 뒤 사용자가 고친 내용입니다.
   */
  selfCorrection?: string;
  /**
   * 이 시도에 대한 근거 기반 피드백입니다.
   */
  feedback?: string;
  /**
   * 다음 회상 또는 변형 시도를 예약한 시각입니다.
   */
  nextAttemptAt?: string;
}
