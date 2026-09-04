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
 * ISO-8601 시각 문자열입니다. 보기 2026-09-02T10:32:18+09:00
 */
export type IsoDateTime = string;
/**
 * 강의 근거와 공식 자료의 확인 상태를 구분합니다.
 *
 * This interface was referenced by `MaterialRef`'s JSON-Schema
 * via the `definition` "VerificationStatusV2".
 */
export type VerificationStatusV2 =
  | "lecture-confirmed"
  | "official-confirmed"
  | "conflict"
  | "ai-simulation"
  | "official-check-required";

/**
 * 세션이 사용한 자료를 특정 제품이나 어댑터 enum에 묶지 않고 가리키는 참조입니다.
 */
export interface MaterialRef {
  id: Id;
  /**
   * 자료의 중립적인 역할입니다.
   */
  kind: "transcript" | "visual" | "document" | "editor" | "user-input" | "other";
  /**
   * 자료를 가져온 어댑터 식별자입니다. Tiro나 로컬 STT 같은 제품명은 고정 enum으로 두지 않습니다.
   */
  adapterId: string;
  /**
   * 사람에게 보여 줄 선택적 자료 이름입니다.
   */
  label?: string;
  assetId?: Id;
  verification?: VerificationMetadataV2;
}
/**
 * 법·세무·회계처럼 최신성이 필요한 자료의 선택적 확인 메타데이터입니다.
 *
 * This interface was referenced by `MaterialRef`'s JSON-Schema
 * via the `definition` "VerificationMetadataV2".
 */
export interface VerificationMetadataV2 {
  /**
   * 적용 관할이나 국가입니다.
   */
  jurisdiction?: string;
  /**
   * 규칙이나 자료가 효력을 갖는 날짜입니다.
   */
  effectiveDate?: string;
  /**
   * 세무 자료에 적용되는 연도입니다.
   */
  taxYear?: number | string;
  /**
   * 법령·회계기준·표준의 판본입니다.
   */
  standardVersion?: string;
  verifiedAt?: IsoDateTime;
  /**
   * 공개 공식 근거 URL입니다. 비밀값이 있는 URL이나 Tiro 공유 URL은 어댑터가 절대 넣지 않습니다.
   */
  sourceUrl?: string;
  verificationStatus?: VerificationStatusV2;
}
