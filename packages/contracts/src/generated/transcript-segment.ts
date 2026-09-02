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
 * ISO-8601 시각 문자열입니다. 보기 2026-09-02T10:32:18+09:00
 */
export type IsoDateTime = string;

/**
 * 교시 전사에서 흘러온 문장 한 조각입니다. 확장이 받은 도착 시각을 항상 남깁니다.
 */
export interface TranscriptSegment {
  id: Id;
  periodId: PeriodId;
  /**
   * 한 교시 안에서 이 조각의 순서입니다. 1 부터 늘어납니다.
   */
  seq: number;
  /**
   * 전사 문장 본문입니다.
   */
  text: string;
  /**
   * final 은 확정된 문장, partial 은 아직 바뀔 수 있는 문장입니다.
   */
  state: "final" | "partial";
  arrivedAt: IsoDateTime;
  spokenAt?: IsoDateTime;
  /**
   * 이 조각이 어디에서 왔는지입니다.
   */
  source: "tiro-share" | "tiro-api" | "fixture";
}
