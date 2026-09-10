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
 * 붙잡은 순간 하나입니다. 그때의 프레임과 마지막 문단, 직전 전사 창과 최근 문답을 만든 시점의 스냅샷으로 함께 담습니다. Alt+S 와 MCP 툴 moment_capture 가 만들고 moment_latest · moment_get 이 돌려줍니다.
 */
export interface CoreMoment {
  /**
   * 코어가 지은 순간 식별자입니다. m-<epoch ms> 이고 같은 밀리초가 겹치면 -2, -3 … 이 붙습니다.
   */
  id: string;
  createdAt: IsoDateTime;
  /**
   * 이 순간의 화면 프레임 id 입니다. 캡처가 실패했으면 생략합니다.
   */
  frameId?: string;
  /**
   * 순간을 만들 때 마지막으로 끝난 문단의 uuid 입니다. 문단이 없었으면 생략합니다.
   */
  paragraphUuid?: string;
  /**
   * 순간 직전 전사 창(기본 60초)의 문단들입니다. 시간순이며 비어 있을 수 있습니다.
   */
  transcriptWindow: CoreParagraph[];
  /**
   * 순간을 만들 때의 최근 문답 최대 3개입니다. 시간순입니다.
   *
   * @maxItems 3
   */
  recentQa: CoreQaEntry[];
  /**
   * moment_capture 가 함께 받은 짧은 메모입니다. 없으면 생략합니다.
   */
  note?: string;
  /**
   * hotkey 는 Alt+S, tool 은 MCP 툴 moment_capture 가 만든 순간입니다.
   */
  source: "hotkey" | "tool";
  /**
   * 단축키가 눌린 뒤 픽셀을 손에 넣기까지 걸린 밀리초입니다. 실측 기록용이며 없으면 생략합니다.
   */
  captureMs?: number;
}
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
/**
 * 앱(Claude Code · Claude Desktop · Codex)이 MCP 툴 session_log 로 코어에 남긴 문답 한 줄입니다. 새 채팅은 session_summary 로 최근 것을 이월합니다.
 */
export interface CoreQaEntry {
  /**
   * qa_log 표의 일련번호입니다.
   */
  id: number;
  askedAt: IsoDateTime;
  /**
   * 사용자가 물은 말 그대로입니다.
   */
  question: string;
  /**
   * 앱이 답한 본문입니다. 복습·블로그가 다시 읽으므로 줄이지 않습니다.
   */
  answer: string;
  /**
   * 이 문답이 기댄 Tiro 문단의 uuid 입니다. 없으면 생략합니다.
   */
  paragraphUuid?: string;
  /**
   * 이 문답이 기댄 순간의 id 입니다. 없으면 생략합니다.
   */
  momentId?: string;
  /**
   * explain 은 설명, related 는 연관 개념, followup 은 이어 묻기, diagram 은 그림 요청입니다.
   */
  kind: "explain" | "related" | "followup" | "diagram";
}
