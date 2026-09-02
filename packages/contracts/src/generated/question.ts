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
 * 단어나 문장을 붙잡은 순간과 그때 봉인한 자료 묶음입니다.
 */
export interface Question {
  id: Id;
  periodId: PeriodId;
  askedAt: IsoDateTime;
  /**
   * 어떤 방식으로 붙잡았는지입니다.
   */
  kind: "missed" | "confused" | "code-flow" | "teacher-evidence" | "free";
  /**
   * 직접 적은 질문 문장입니다. 단어만 붙잡았으면 넣지 않습니다.
   */
  text?: string;
  anchor?: QuestionAnchor;
  snapshot: QuestionSnapshot;
}
/**
 * 전사에서 붙잡은 자리입니다.
 */
export interface QuestionAnchor {
  segmentId: Id;
  /**
   * 붙잡은 낱말입니다.
   */
  word?: string;
}
/**
 * 붙잡은 순간에 봉인한 자료들입니다. 뒤에 자료가 바뀌어도 이 묶음은 그대로 남습니다.
 */
export interface QuestionSnapshot {
  /**
   * 봉인한 전사 조각들의 식별자입니다. 최근 것이 뒤에 옵니다.
   */
  transcriptSegmentIds: Id[];
  screenFrameId?: Id;
  editorContextId?: Id;
  ages: SourceAges;
}
/**
 * 질문을 붙잡은 순간 각 자료가 몇 초 전 것인지 담습니다. 자료가 없으면 null 입니다.
 */
export interface SourceAges {
  /**
   * 전사가 몇 초 전 것인지입니다.
   */
  transcriptSec: number | null;
  /**
   * 화면 프레임이 몇 초 전 것인지입니다.
   */
  screenSec: number | null;
  /**
   * 편집기 문맥이 몇 초 전 것인지입니다.
   */
  editorSec: number | null;
}
