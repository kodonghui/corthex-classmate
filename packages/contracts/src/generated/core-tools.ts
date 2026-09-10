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
 * 데몬이 본 Tiro 연결 상태입니다. no-key 는 setup 을 아직 안 했고, unauthorized 는 401, not-found 는 404, offline 은 네트워크 실패, unknown 은 데몬이 아직 알리지 않은 상태입니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "TiroState".
 */
export type TiroState =
  "connected" | "no-key" | "unauthorized" | "not-found" | "offline" | "unknown";

/**
 * classmate-core mcp 가 내놓는 MCP 툴 7개의 와이어 이름과 입력·출력 모양입니다. 와이어 이름은 밑줄 형태(kickoff 의 점 표기 moment.latest 는 x-logical-names 에 대응)이며 입력 열쇠는 인수인계 §4.5 그대로 snake_case, 출력 레코드는 다른 계약처럼 camelCase 입니다. 이미지는 출력 JSON 이 아니라 MCP image content 로 따로 갑니다.
 */
export interface CoreTools {}
/**
 * moment_latest 의 입력입니다. 사용자가 방금 Alt+S 를 눌렀거나 "방금 화면"·"이거" 라고 가리킬 때 부릅니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "MomentLatestInput".
 */
export interface MomentLatestInput {
  /**
   * 이보다 오래된 순간은 없는 것으로 봅니다. 기본 600 초입니다.
   */
  max_age_sec?: number;
}
/**
 * moment_latest 의 출력입니다. found 가 false 면 moment 와 frame 이 없고 hint 에 사용자에게 보여 줄 안내가 있습니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "MomentLatestOutput".
 */
export interface MomentLatestOutput {
  found: boolean;
  moment?: CoreMoment;
  frame?: CoreFrame;
  /**
   * 순간이 없을 때의 안내 문구입니다. 보기 "Alt+S 를 눌러 지금 화면을 붙잡으세요".
   */
  hint?: string;
}
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
   * true 면 확정된 문단, false 면 아직 바뀔 수 있는 진행 중 문단입니다.
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
/**
 * 코어가 남긴 화면 한 장의 메타입니다. 파일은 코어 데이터 폴더 아래 frames/<묶음>/<id>.<확장자> 에 있고, 확장자는 파일 바이트의 매직 넘버가 정합니다. 전체 영상은 남기지 않습니다.
 */
export interface CoreFrame {
  /**
   * 코어가 지은 프레임 식별자입니다. fr-<epoch ms> 이고 같은 밀리초가 겹치면 -2, -3 … 이 붙습니다.
   */
  id: string;
  capturedAt: IsoDateTime;
  /**
   * 코어 데이터 폴더를 기준으로 한 상대 경로입니다. 절대 경로(사용자 이름 포함)는 담지 않습니다.
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
   * 파일 크기(바이트)입니다.
   */
  bytes: number;
  /**
   * timeline 은 변화 감지 타임라인, hotkey 는 Alt+S, tool 은 MCP 툴 moment_capture 가 찍은 것입니다.
   */
  source: "timeline" | "hotkey" | "tool";
  /**
   * true 면 어떤 순간(moment)이 이 프레임을 써서 보존 정리에서 지우지 않습니다.
   */
  referenced: boolean;
}
/**
 * moment_capture 의 입력입니다. 모델이 "지금 화면" 이 필요할 때 부릅니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "MomentCaptureInput".
 */
export interface MomentCaptureInput {
  /**
   * 이 순간을 특정 문단에 붙이고 싶을 때의 uuid 입니다. 없으면 마지막 문단을 씁니다.
   */
  paragraph_uuid?: string;
  /**
   * 순간에 남길 짧은 메모입니다.
   */
  note?: string;
}
/**
 * moment_capture 의 출력입니다. 이미지는 MCP image content 로 함께 갑니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "MomentCaptureOutput".
 */
export interface MomentCaptureOutput {
  moment_id: string;
  captured_at: IsoDateTime;
  moment: CoreMoment;
  frame?: CoreFrame;
}
/**
 * moment_get 의 입력입니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "MomentGetInput".
 */
export interface MomentGetInput {
  moment_id: string;
}
/**
 * moment_get 의 출력입니다. found 가 false 면 그 id 의 순간이 없습니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "MomentGetOutput".
 */
export interface MomentGetOutput {
  found: boolean;
  moment?: CoreMoment;
  frame?: CoreFrame;
}
/**
 * transcript_recent 의 입력입니다. 사용자가 "방금 뭐라고 했어"·"지금 설명하는 거" 처럼 말할 때 부릅니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "TranscriptRecentInput".
 */
export interface TranscriptRecentInput {
  /**
   * until 에서 거꾸로 몇 초 안의 문단을 볼지입니다. 기본 60 초입니다.
   */
  window_sec?: number;
  until?: IsoDateTime;
}
/**
 * transcript_recent 의 출력입니다. paragraphs 는 시간순이며 창에 걸친 문단이 없으면 비어 있습니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "TranscriptRecentOutput".
 */
export interface TranscriptRecentOutput {
  paragraphs: CoreParagraph[];
  windowSec: number;
  until: IsoDateTime;
  /**
   * 지금 따라가는 Tiro 노트 제목입니다. 노트가 없으면 생략합니다.
   */
  noteTitle?: string;
  /**
   * 따라가는 노트가 녹음 중인지입니다. 노트가 없으면 생략합니다.
   */
  noteRecording?: boolean;
  lastParagraphAt?: IsoDateTime;
  tiroState: TiroState;
}
/**
 * session_log 의 입력입니다. 답을 마친 뒤마다 부릅니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "SessionLogInput".
 */
export interface SessionLogInput {
  question: string;
  answer: string;
  paragraph_uuid?: string;
  moment_id?: string;
  kind: "explain" | "related" | "followup" | "diagram";
}
/**
 * session_log 의 출력입니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "SessionLogOutput".
 */
export interface SessionLogOutput {
  ok: true;
  id: number;
  askedAt: IsoDateTime;
}
/**
 * session_summary 의 입력입니다. 새 채팅을 시작할 때 부릅니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "SessionSummaryInput".
 */
export interface SessionSummaryInput {
  /**
   * 최근 문답을 몇 개 이월할지입니다. 기본 10 개입니다.
   */
  recent?: number;
}
/**
 * session_summary 의 출력입니다. 최근 문답과 마지막 문단, 표 건수를 담습니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "SessionSummaryOutput".
 */
export interface SessionSummaryOutput {
  bundleName: string;
  recentQa: CoreQaEntry[];
  lastParagraph?: CoreParagraph;
  latestMomentId?: string;
  counts: Counts;
}
/**
 * 표 건수입니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "Counts".
 */
export interface Counts {
  paragraphs: number;
  frames: number;
  moments: number;
  qa: number;
}
/**
 * core_status 의 입력입니다. 받는 값이 없습니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "CoreStatusInput".
 */
export interface CoreStatusInput {}
/**
 * core_status 의 출력입니다. 비밀값·절대 경로를 담지 않습니다.
 *
 * This interface was referenced by `CoreTools`'s JSON-Schema
 * via the `definition` "CoreStatusOutput".
 */
export interface CoreStatusOutput {
  version: string;
  /**
   * alive 는 heartbeat 가 최근, stale 은 heartbeat 가 오래됨, absent 는 한 번도 없음입니다.
   */
  daemon: "alive" | "stale" | "absent";
  tiroState: TiroState;
  noteTitle?: string;
  noteRecording?: boolean;
  lastPollAt?: IsoDateTime;
  lastParagraphAt?: IsoDateTime;
  /**
   * 찍고 있는 창의 제목입니다. 창을 못 찾았으면 생략합니다.
   */
  captureWindowTitle?: string;
  lastCaptureAt?: IsoDateTime;
  hotkey: "registered" | "failed" | "unknown";
  counts: Counts;
}
