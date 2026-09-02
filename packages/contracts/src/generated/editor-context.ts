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
 * 수업 모드에서 읽기만 한 편집기 화면 문맥입니다. 파일을 고치거나 실행하지 않습니다.
 */
export interface EditorContext {
  id: Id;
  periodId: PeriodId;
  capturedAt: IsoDateTime;
  /**
   * 프로젝트 뿌리를 기준으로 한 파일 경로입니다.
   */
  filePath: string;
  /**
   * 파일의 언어 이름입니다. 보기 java
   */
  language: string;
  visibleRange: VisibleRange;
  /**
   * 보이던 범위의 코드 발췌입니다.
   */
  excerpt: string;
  /**
   * 커서가 있던 줄 번호입니다. 알 수 없으면 넣지 않습니다.
   */
  caretLine?: number;
  /**
   * 이 문맥이 어디에서 왔는지입니다.
   */
  source: "intellij-mcp" | "fixture";
}
/**
 * 화면에 보이던 줄 범위입니다. 줄 번호는 1 부터 셉니다.
 */
export interface VisibleRange {
  /**
   * 보이던 첫 줄 번호입니다.
   */
  startLine: number;
  /**
   * 보이던 마지막 줄 번호입니다.
   */
  endLine: number;
}
