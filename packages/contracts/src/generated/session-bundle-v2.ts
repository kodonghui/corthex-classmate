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
 * 전사·화면·질문·응답·결정·행동 중 하나를 시간순으로 보존하는 항목입니다.
 *
 * This interface was referenced by `SessionBundleV2`'s JSON-Schema
 * via the `definition` "SessionMomentV2".
 */
export type SessionMomentRecordV2 = SessionMomentV2;
/**
 * 도메인과 무관하게 보존하는 세션 순간의 역할입니다.
 *
 * This interface was referenced by `SessionBundleV2`'s JSON-Schema
 * via the `definition` "SessionMomentTypeV2".
 */
export type SessionMomentTypeV2 =
  "transcript" | "visual" | "question" | "response" | "decision" | "action";
/**
 * 예측 가능한 다섯 활동의 고정 순서 자리입니다.
 *
 * This interface was referenced by `ActivityCard`'s JSON-Schema
 * via the `definition` "ActivitySlot".
 */
export type ActivitySlot = "RECALL" | "EXPLAIN" | "INSPECT" | "APPLY" | "TRANSFER";
/**
 * 활동이 요구하는 수행 형식입니다.
 *
 * This interface was referenced by `ActivityCard`'s JSON-Schema
 * via the `definition` "ActivityKind".
 */
export type ActivityKind = "question" | "worked-example" | "simulation";

/**
 * 한 세션의 자료·시간순 순간·활동·실제 파일 참조를 함께 보존하는 도메인 중립 번들입니다.
 */
export interface SessionBundleV2 {
  /**
   * 이 번들의 계약 판별자입니다.
   */
  schemaVersion: "2";
  sessionId: Id;
  legacyPeriodId?: PeriodId;
  profile: SessionProfileV2;
  /**
   * 사람에게 보여 줄 선택적 세션 이름입니다.
   */
  title?: string;
  startedAt: IsoDateTime;
  endedAt?: IsoDateTime;
  summary?: SessionSummaryV2;
  /**
   * 세션에 사용한 자료 참조입니다.
   */
  sources: MaterialRef[];
  /**
   * 세션에서 보존할 사건을 시간순으로 담습니다.
   */
  moments: SessionMomentRecordV2[];
  /**
   * 아직 생성되지 않았으면 비어 있고, 생성 중이거나 완료되면 최대 다섯 활동을 담습니다. 완성 묶음의 수와 순서는 ActivitySetV2가 검증합니다.
   *
   * @maxItems 5
   */
  activities: ActivityCard[];
  /**
   * 번들 디렉터리 안 실제 파일들의 참조입니다.
   */
  artifacts: AssetRef[];
  /**
   * 번들을 열 때 함께 표시할 누락·변환·검증 경고입니다.
   */
  warnings?: string[];
}
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
export interface SessionMomentV2 {
  id: Id;
  type: SessionMomentTypeV2;
  at: IsoDateTime;
  /**
   * 이 순간과 직접 연결된 자료 식별자입니다.
   */
  materialRefIds: Id[];
  /**
   * 이 순간과 직접 연결된 실제 파일 식별자입니다.
   */
  assetRefIds: Id[];
  /**
   * 전사·질문·결정·행동처럼 사람이 읽을 본문입니다.
   */
  text?: string;
  transcript?: TranscriptRevisionV2;
  response?: TutorResponseV2;
}
/**
 * 수정될 수 있는 전사 세그먼트의 판본과 선택적 제공자 정보를 담습니다.
 *
 * This interface was referenced by `SessionBundleV2`'s JSON-Schema
 * via the `definition` "TranscriptRevisionV2".
 */
export interface TranscriptRevisionV2 {
  segmentId: Id;
  revision: number;
  isFinal: boolean;
  speaker?: string;
  confidence?: number;
  words?: TranscriptWordV2[];
}
/**
 * 제공자가 지원할 때만 남기는 단어별 상대 시각입니다.
 *
 * This interface was referenced by `SessionBundleV2`'s JSON-Schema
 * via the `definition` "TranscriptWordV2".
 */
export interface TranscriptWordV2 {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}
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
/**
 * 다섯 학습 슬롯 중 한 자리를 채우는 근거 기반 활동입니다.
 */
export interface ActivityCard {
  id: Id;
  slot: ActivitySlot;
  kind: ActivityKind;
  /**
   * 답을 보기 전에 사용자가 수행할 질문이나 상황입니다.
   */
  prompt: string;
  /**
   * 활동을 만든 근거 식별자이며 한 개 이상이어야 합니다.
   *
   * @minItems 1
   */
  evidenceRefIds: Id[];
  /**
   * 사용자가 단계별로 열 수 있는 힌트입니다.
   */
  hints: string[];
  /**
   * 시도 뒤에만 공개할 모범 응답이나 해설입니다.
   */
  answer: string;
  /**
   * 조건을 바꿔 다시 적용하게 하는 선택적 변형 질문입니다.
   */
  variation?: string;
  /**
   * 답 공개 전 시도와 그 뒤 자기 수정을 시간 순서로 담습니다.
   */
  attempts: ActivityAttempt[];
}
/**
 * 답을 공개하기 전 사용자가 직접 낸 한 번의 시도와 후속 기록입니다.
 *
 * This interface was referenced by `ActivityCard`'s JSON-Schema
 * via the `definition` "ActivityAttempt".
 */
export interface ActivityAttempt {
  id: Id;
  startedAt: IsoDateTime;
  submittedAt: IsoDateTime;
  /**
   * 사용자가 답 공개 전에 직접 낸 응답입니다.
   */
  response: string;
  /**
   * 시도 당시 사용자가 표시한 확신 정도이며 1이 가장 낮고 5가 가장 높습니다.
   */
  confidence: number;
  /**
   * 이 시도 전에 연 힌트의 가장 높은 단계이며 힌트를 안 봤으면 0입니다.
   */
  hintLevel: number;
  /**
   * 모범 응답을 공개한 시각입니다. 제출 전에는 두지 않습니다.
   */
  revealedAt?: string;
  /**
   * 피드백이나 답 공개 뒤 사용자가 고친 내용입니다.
   */
  selfCorrection?: string;
  /**
   * 이 시도에 대한 근거 기반 피드백입니다.
   */
  feedback?: string;
  /**
   * 다음 회상 또는 변형 시도를 예약한 시각입니다.
   */
  nextAttemptAt?: string;
}
/**
 * 번들에 포함된 실제 파일을 가리키며 과거 논리 경로와 물리 경로를 구분합니다.
 */
export interface AssetRef {
  id: Id;
  /**
   * 파일의 중립적인 역할입니다.
   */
  kind: "image" | "audio" | "document" | "data" | "html" | "other";
  /**
   * 실제 파일 바이트의 미디어 타입입니다.
   */
  mediaType: string;
  /**
   * 번들 디렉터리를 기준으로 실제 존재하는 파일의 슬래시 상대경로입니다. 드라이브 문자, 선행 슬래시, 역슬래시, .. 조각은 금지합니다.
   */
  path: string;
  /**
   * V1 저장소에 남은 과거 논리 경로입니다. 파일을 열 때 사용하지 않습니다.
   */
  logicalPath?: string;
  /**
   * 실제 파일 크기입니다.
   */
  byteLength?: number;
  /**
   * 실제 파일 바이트의 SHA-256 소문자 16진 해시입니다.
   */
  sha256?: string;
}
