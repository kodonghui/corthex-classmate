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
 */
export type VerificationStatusV2 =
  | "lecture-confirmed"
  | "official-confirmed"
  | "conflict"
  | "ai-simulation"
  | "official-check-required";

/**
 * 도메인별 고정 답 칸 대신 동적 절을 담고 질문과 근거를 연결하는 튜터 응답입니다.
 */
export interface TutorResponseV2 {
  id: Id;
  questionId: Id;
  createdAt: IsoDateTime;
  /**
   * 먼저 보여 줄 한 문장 결론입니다.
   */
  conclusion: string;
  /**
   * 이 응답 전체를 뒷받침하는 자료·순간·자산 식별자입니다.
   *
   * @minItems 1
   */
  evidenceRefIds: Id[];
  /**
   * 프로필에 맞춰 동적으로 구성한 상세 절입니다.
   */
  sections: TutorResponseSectionV2[];
  /**
   * 응답을 만든 제공자 어댑터 식별자입니다.
   */
  providerId: string;
  /**
   * 제공자가 실제로 보고한 모델 이름입니다.
   */
  model?: string;
  /**
   * 응답 생성의 최종 또는 대기 상태입니다.
   */
  status: "completed" | "queued" | "error" | "cancelled";
  /**
   * 응답을 표시할 때 함께 알려야 하는 제한이나 경고입니다.
   */
  warnings?: string[];
  verification?: VerificationMetadataV2;
  diagram?: AnswerDiagram;
}
/**
 * 튜터 응답의 동적 상세 절 한 개입니다.
 *
 * This interface was referenced by `TutorResponseV2`'s JSON-Schema
 * via the `definition` "TutorResponseSectionV2".
 */
export interface TutorResponseSectionV2 {
  id: Id;
  /**
   * 절의 화면 제목입니다.
   */
  title: string;
  /**
   * 실행하지 않고 텍스트로 렌더링할 절 본문입니다.
   */
  content: string;
  /**
   * 이 절만 뒷받침하는 선택적 근거 식별자입니다.
   */
  evidenceRefIds?: Id[];
}
/**
 * 법·세무·회계처럼 최신성이 필요한 자료의 선택적 확인 메타데이터입니다.
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
/**
 * 0.1.0 선택적 설명 그림. 실행 코드가 아닌 노드/관계 데이터이며 원래 답과 함께 저장합니다.
 */
export interface AnswerDiagram {
  version: 1;
  kind:
    | "flowchart"
    | "sequence"
    | "swimlane"
    | "state"
    | "concept"
    | "hierarchy"
    | "timeline"
    | "comparison";
  title: string;
  summary: string;
  /**
   * @minItems 2
   * @maxItems 12
   */
  nodes: {
    id: string;
    label: string;
    detail?: string;
    group?: string;
  }[];
  /**
   * @maxItems 24
   */
  edges: {
    from: string;
    to: string;
    label?: string;
  }[];
}
