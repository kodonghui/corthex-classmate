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
 * 답에 붙는 근거 단계 네 가지입니다. 색뿐 아니라 문구로도 구분합니다.
 */
export type EvidenceLevel = "confirmed" | "partial" | "inferred" | "stale";

/**
 * 붙잡은 질문에 대한 한 문장 결론과 그 뒤에 접혀 있는 설명입니다.
 */
export interface Answer {
  id: Id;
  questionId: Id;
  createdAt: IsoDateTime;
  /**
   * 40자 이내 한 문장 결론입니다. 해요체로 적습니다.
   */
  conclusion: string;
  evidence: EvidenceLevel;
  /**
   * 수업이 지금 어디까지 갔는지 알리는 한 줄입니다. 보기 지금 · 생성자 주입 코드로 넘어갔어요
   */
  nowLine?: string;
  /**
   * 이어서 누를 수 있는 짧은 후속 요청 2~3개입니다.
   *
   * @minItems 2
   * @maxItems 3
   */
  chips: string[];
  details?: AnswerDetails;
  diagram?: AnswerDiagram;
  /**
   * 이 답을 만든 AI 제공자입니다.
   */
  provider: "claude" | "codex" | "mock";
  /**
   * 답의 진행 상태입니다. 멈춘 답은 queued 로 남았다가 recovered 로 돌아옵니다.
   */
  status: "answered" | "queued" | "error" | "recovered";
}
/**
 * 자세히 화면에서 접혀 있는 네 자리입니다. 채운 자리만 펼쳐집니다.
 */
export interface AnswerDetails {
  /**
   * 왜 그런가요 자리입니다.
   */
  why?: string;
  /**
   * 내 코드와 비교 자리입니다.
   */
  compareMyCode?: string;
  /**
   * 선생님 화면 코드 자리입니다.
   */
  screenCode?: string;
  /**
   * 선생님이 말한 부분 자리입니다.
   */
  teacherSaid?: string;
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
