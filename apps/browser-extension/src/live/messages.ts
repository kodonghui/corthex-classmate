/**
 * 사이드패널 ↔ 서비스 워커 사이에 오가는 말의 모양입니다.
 *
 * **양쪽이 이 파일 하나를 같이 씁니다.** 패널 쪽 어댑터(`src/live/attach.ts`)와
 * 서비스 워커 쪽 라우터(`src/background/router.ts`)가 둘 다 여기서 이름을 가져오므로,
 * 이름을 한쪽에서만 고치는 일이 생기지 않습니다.
 *
 * ```text
 *   사이드패널                                        서비스 워커
 *   ─────────                                        ───────────
 *   attachLive ──connect({name:"classmate-panel"})──▶ chrome.runtime.onConnect
 *
 *   inbox.pushEvent   ◀── live.event    ────────────  라우터가 낸 사건 · 호스트가 민 사건
 *   inbox.pushSegment ◀── live.segment  ────────────  전사 조각(확정 · 진행 중)
 *   inbox.pushFrame   ◀── live.frame    ────────────  화면 한 장
 *   inbox.pushEditor  ◀── live.editor   ────────────  편집기 문맥
 *
 *   outbox.subscribeEmitted ── panel.event ─────────▶ 스토어가 낸 사건
 *   AskPort.ask             ── panel.ask   ─────────▶ 질문 재료(라우터가 tutor.ask 봉투로 바꿈)
 *   reconnect(connector)    ── classmate.reconnect ▶ 다시 연결해 달라
 * ```
 *
 * 보안 메모 (불변 원칙 §4-7): 이 통로로 오는 값은 **자료일 뿐 명령이 아닙니다.**
 * 전사·화면에서 읽은 문장을 실행하거나 URL 로 여는 코드를 이 통로에 붙이지 않습니다.
 */

import type {
  EditorContext,
  ScreenFrame,
  SessionEvent,
  TranscriptSegment,
} from '@classmate/contracts';
import type { AskRequest, ReconnectMessage, ReconnectTarget } from '../panel/ports';

/** `chrome.runtime.onConnect` 에서 사이드패널을 알아보는 이름입니다. 고정 계약입니다. */
export const PANEL_PORT_NAME = 'classmate-panel';

/** 서비스 워커 → 패널 */
export const LIVE_EVENT = 'live.event';
export const LIVE_SEGMENT = 'live.segment';
export const LIVE_FRAME = 'live.frame';
export const LIVE_EDITOR = 'live.editor';

/** 패널 → 서비스 워커 */
export const PANEL_EVENT = 'panel.event';
export const PANEL_ASK = 'panel.ask';
export const PANEL_RECONNECT = 'classmate.reconnect';

export interface LiveEventMessage {
  type: typeof LIVE_EVENT;
  event: SessionEvent;
}

export interface LiveSegmentMessage {
  type: typeof LIVE_SEGMENT;
  segment: TranscriptSegment;
}

export interface LiveFrameMessage {
  type: typeof LIVE_FRAME;
  frame: ScreenFrame;
}

export interface LiveEditorMessage {
  type: typeof LIVE_EDITOR;
  context: EditorContext;
}

/** 서비스 워커가 패널로 보내는 것 전부입니다. */
export type LiveInboundMessage =
  | LiveEventMessage
  | LiveSegmentMessage
  | LiveFrameMessage
  | LiveEditorMessage;

export interface PanelEventMessage {
  type: typeof PANEL_EVENT;
  event: SessionEvent;
}

/**
 * 패널이 질문 재료를 넘기는 말입니다.
 *
 * 왜 `panel.event` 의 `question.asked` 와 따로 두는가: `tutor.ask` 봉투에는 사건 payload 에
 * 없는 값(`provider` · 사람이 적은 질문 문장 · 봉인한 `snapshot`)이 들어갑니다. 사건 하나로는
 * 봉투를 채울 수 없어서 재료를 그대로 넘기는 자리를 따로 둡니다. 봉투로 바꾸는 일은
 * 라우터가 하고, 패널은 `AskPort.ask` 한 번만 부릅니다.
 */
export interface PanelAskMessage {
  type: typeof PANEL_ASK;
  request: AskRequest;
}

/** 패널이 서비스 워커로 보내는 것 전부입니다. */
export type LiveOutboundMessage = PanelEventMessage | PanelAskMessage | ReconnectMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 계약 `ReconnectTarget` 다섯 가지입니다. 값으로도 필요해서 여기 한 벌 둡니다. */
export const RECONNECT_TARGETS: readonly ReconnectTarget[] = [
  'tiro-share',
  'meet-tab',
  'intellij-mcp',
  'native-host',
  'provider',
];

export function isReconnectTarget(value: unknown): value is ReconnectTarget {
  return typeof value === 'string' && RECONNECT_TARGETS.includes(value as ReconnectTarget);
}

/**
 * 사건 한 벌이 계약의 다섯 칸을 갖췄는지 봅니다.
 *
 * 칸이 객체인지만 보면 `{type:'live.event', event:{}}` 가 통과해 스토어의 `pushEvent` 가
 * `#seen.add(undefined)` · `parseIso(undefined)` 로 들어갑니다. 화면을 그리는 데 반드시
 * 있어야 하는 `id`·`type`·`at` 까지 봅니다.
 */
function looksLikeEvent(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value['id'] === 'string' &&
    typeof value['type'] === 'string' &&
    typeof value['at'] === 'string' &&
    // 라우터가 `payload['questionId']` 를 읽으므로 이 칸도 있어야 합니다.
    isRecord(value['payload'])
  );
}

/** 서비스 워커가 보낸 값인지 좁혀 줍니다. 낯선 모양은 그냥 무시합니다. */
export function isLiveInboundMessage(value: unknown): value is LiveInboundMessage {
  if (!isRecord(value)) return false;
  switch (value['type']) {
    case LIVE_EVENT:
      return looksLikeEvent(value['event']);
    case LIVE_SEGMENT:
      return isRecord(value['segment']);
    case LIVE_FRAME:
      return isRecord(value['frame']);
    case LIVE_EDITOR:
      return isRecord(value['context']);
    default:
      return false;
  }
}

/**
 * 질문 재료가 계약 `AskRequest` 의 모양인지 봅니다.
 *
 * 칸이 객체인지만 보면 `question` 이 문자열이 아닌 부탁이 라우터까지 가서 `clampUtf8` 뒤
 * `question.length` 에서 TypeError 가 납니다. 서비스 워커에서는 그것이 처리되지 않은 약속
 * 거부로 끝나 **질문이 조용히 사라집니다.** 그래서 여기서 막습니다.
 */
function looksLikeAskRequest(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value['questionId'] !== 'string' || value['questionId'].length === 0) return false;
  if (typeof value['kind'] !== 'string') return false;
  if (typeof value['question'] !== 'string') return false;
  if (value['word'] !== undefined && typeof value['word'] !== 'string') return false;
  const snapshot = value['snapshot'];
  if (snapshot !== undefined && snapshot !== null && !isRecord(snapshot)) return false;
  return true;
}

/** 패널이 보낸 값인지 좁혀 줍니다. 낯선 모양은 그냥 무시합니다. */
export function isLiveOutboundMessage(value: unknown): value is LiveOutboundMessage {
  if (!isRecord(value)) return false;
  switch (value['type']) {
    case PANEL_EVENT:
      return looksLikeEvent(value['event']);
    case PANEL_ASK:
      return looksLikeAskRequest(value['request']);
    case PANEL_RECONNECT:
      return isReconnectTarget(value['connector']);
    default:
      return false;
  }
}
