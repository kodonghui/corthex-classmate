/* eslint-disable */
/**
 * 생성물 · 직접 고치지 말 것
 *
 * 정본은 packages/contracts/schemas/*.schema.json 입니다.
 * 타입을 바꾸려면 스키마를 고치고 `pnpm --filter @classmate/contracts generate` 를 다시 실행하세요.
 */

/**
 * 한 항목을 가리키는 문자열 식별자입니다.
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "Id".
 */
export type Id = string;
/**
 * ISO-8601 시각 문자열입니다. 보기 2026-09-02T10:32:18+09:00
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "IsoDateTime".
 */
export type IsoDateTime = string;
/**
 * 교시 세션 식별자입니다. 보기 2026-09-02-p3
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "PeriodId".
 */
export type PeriodId = string;
/**
 * 앱이 통제하는 튜터 상태기계의 상태 이름입니다.
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "TutorState".
 */
export type TutorState =
  "CAPTURE" | "ANSWER_MINIMAL" | "EXIT_RECALL" | "FEEDBACK" | "FADE_SUPPORT" | "DELAYED_CHECK";

/**
 * 여러 계약이 함께 쓰는 기본 조각(식별자·시각·교시·자료 나이·상태 이름)을 모아 둔 정의 묶음입니다.
 */
export interface Common {}
/**
 * 질문을 붙잡은 순간 각 자료가 몇 초 전 것인지 담습니다. 자료가 없으면 null 입니다.
 *
 * This interface was referenced by `Common`'s JSON-Schema
 * via the `definition` "SourceAges".
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
