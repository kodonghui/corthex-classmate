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
