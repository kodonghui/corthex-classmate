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
 * 화면이 바뀐 순간만 남긴 WebP 프레임 한 장입니다. 전체 영상은 남기지 않습니다.
 */
export interface ScreenFrame {
  id: Id;
  periodId: PeriodId;
  capturedAt: IsoDateTime;
  /**
   * 교시 세션 폴더를 기준으로 한 WebP 상대 경로입니다.
   */
  path: string;
  /**
   * 프레임 가로 픽셀 수입니다.
   */
  width: number;
  /**
   * 프레임 세로 픽셀 수입니다.
   */
  height: number;
  /**
   * 변화 감지에 쓰는 dHash 값을 소문자 16진 문자열로 적습니다.
   */
  hash: string;
  /**
   * 바로 앞 프레임과 견주어 화면이 바뀌었는지입니다.
   */
  changedFromPrev: boolean;
  /**
   * 이 프레임이 어디에서 왔는지입니다.
   */
  source: "meet-tab" | "fixture";
}
