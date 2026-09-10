/* eslint-disable */
/**
 * 생성물 · 직접 고치지 말 것
 *
 * 정본은 packages/contracts/schemas/*.schema.json 입니다.
 * 타입을 바꾸려면 스키마를 고치고 `pnpm --filter @classmate/contracts generate` 를 다시 실행하세요.
 */

/**
 * ISO-8601 시각 문자열입니다. 보기 2026-09-02T10:32:18+09:00
 */
export type IsoDateTime = string;

/**
 * 코어가 Tiro 공식 API 에서 받아 core.sqlite 의 paragraphs 표에 둔 문단 한 줄입니다. uuid 기준으로 갱신되며 노트가 바뀌어도 같은 학습 묶음에 이어집니다.
 */
export interface CoreParagraph {
  /**
   * Tiro 가 준 문단 식별자입니다. 진행 중 문단이 갱신돼도 같은 값입니다.
   */
  uuid: string;
  /**
   * 이 문단이 속한 Tiro 노트의 guid 입니다.
   */
  noteGuid: string;
  /**
   * 문단 원문입니다.
   */
  text: string;
  /**
   * Tiro 가 함께 준 마크다운 요약입니다. 없으면 생략합니다.
   */
  summaryMd?: string;
  timeFrom: IsoDateTime;
  timeTo: IsoDateTime;
  /**
   * Tiro 요금제에 따른 텍스트 가림 여부입니다. true는 가림, false는 공개된 텍스트이며 문단 완성 여부가 아닙니다.
   */
  locked: boolean;
}
