/* eslint-disable */
/**
 * 생성물 · 직접 고치지 말 것
 *
 * 정본은 packages/contracts/schemas/*.schema.json 입니다.
 * 타입을 바꾸려면 스키마를 고치고 `pnpm --filter @classmate/contracts generate` 를 다시 실행하세요.
 */

/**
 * 한 항목을 가리키는 문자열 식별자입니다.
 */
export type Id = string;
/**
 * 교시 세션 식별자입니다. 보기 2026-09-02-p3
 */
export type PeriodId = string;
/**
 * 같은 세션 코어에 적용할 도메인 프로필입니다.
 */
export type SessionProfileV2 = "class" | "exam" | "meeting";
/**
 * ISO-8601 시각 문자열입니다. 보기 2026-09-02T10:32:18+09:00
 */
export type IsoDateTime = string;

/**
 * 과거 세션 목록과 상세 진입에 필요한 도메인 중립 요약입니다.
 */
export interface SessionSummaryV2 {
  sessionId: Id;
  legacyPeriodId?: PeriodId;
  profile: SessionProfileV2;
  /**
   * 사람에게 보여 줄 선택적 세션 이름입니다.
   */
  title?: string;
  startedAt?: IsoDateTime;
  endedAt?: IsoDateTime;
  lastAt?: IsoDateTime;
  eventCount: number;
  transcriptCount: number;
  questionCount: number;
  answerCount: number;
  frameCount: number;
}
