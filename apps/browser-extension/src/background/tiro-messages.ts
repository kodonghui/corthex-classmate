/**
 * Tiro 공유 페이지 content script ↔ 서비스 워커 사이에 오가는 말의 이름입니다.
 *
 * 1라운드에는 이름이 `entrypoints/tiro-share.content.ts` 안에만 있었고 받는 쪽이 없었습니다.
 * 2라운드에 받는 쪽(라우터)이 생기면서 **양쪽이 같은 파일을 보도록** 이 자리로 옮겼습니다.
 * `entrypoints/` 는 vitest 대상이 아니라서, 판정에 쓰이는 좁힘 함수는 `src/` 에 있어야
 * 시험할 수 있다는 이유도 있습니다. content script 는 여기서 가져다 그대로 다시 냅니다.
 *
 * ```text
 *   공유 페이지 content script                     서비스 워커(라우터)
 *   ──────────────────────────                     ──────────────────
 *   tiro.segment        {segment}   ──────────────▶ event.append(transcript.segment) + 패널
 *   tiro.partial        {partial}   ──────────────▶ 패널만 (아직 확정 전이라 기록하지 않음)
 *   tiro.hint_degraded  {signal}    ──────────────▶ connector.status(tiro-share)
 *   tiro.selector_broken{signal}    ──────────────▶ connector.status(tiro-share)
 *
 *   관찰 멈춰라  ◀────────────────── tiro.stop
 *   관찰 시작해라 ◀───────────────── tiro.start
 * ```
 *
 * 보안 메모 (불변 원칙 §4-3): 이 통로에 공유 URL 과 비밀번호를 싣지 않습니다. 신호에는
 * 개수와 등급 이름만 담깁니다(본문은 `segment`·`partial` 의 전사 문장뿐입니다).
 */

import type {
  HintDegradedSignal,
  SelectorBrokenSignal,
  TiroPartial,
  TranscriptSegment,
} from '../tiro/types';

/** content script → 서비스 워커 */
export const TIRO_MESSAGE_TYPES = {
  segment: 'tiro.segment',
  partial: 'tiro.partial',
  hintDegraded: 'tiro.hint_degraded',
  selectorBroken: 'tiro.selector_broken',
} as const;

/** 서비스 워커 → content script. 사람이 교시를 끝냈거나 다시 붙자고 했을 때입니다. */
export const TIRO_STOP_REQUEST = 'tiro.stop';
export const TIRO_START_REQUEST = 'tiro.start';

export type TiroMessage =
  | { type: typeof TIRO_MESSAGE_TYPES.segment; segment: TranscriptSegment }
  | { type: typeof TIRO_MESSAGE_TYPES.partial; partial: TiroPartial }
  | { type: typeof TIRO_MESSAGE_TYPES.hintDegraded; signal: HintDegradedSignal }
  | { type: typeof TIRO_MESSAGE_TYPES.selectorBroken; signal: SelectorBrokenSignal };

export type TiroRequest =
  | { type: typeof TIRO_STOP_REQUEST }
  | { type: typeof TIRO_START_REQUEST };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** content script 가 보낸 값인지 좁혀 줍니다. 낯선 모양은 그냥 무시합니다. */
export function isTiroMessage(value: unknown): value is TiroMessage {
  if (!isRecord(value)) return false;
  switch (value['type']) {
    case TIRO_MESSAGE_TYPES.segment:
      return isRecord(value['segment']);
    case TIRO_MESSAGE_TYPES.partial:
      return isRecord(value['partial']);
    case TIRO_MESSAGE_TYPES.hintDegraded:
    case TIRO_MESSAGE_TYPES.selectorBroken:
      return isRecord(value['signal']);
    default:
      return false;
  }
}

/** content script 가 알아듣는 요청인지입니다. */
export function isTiroRequest(value: unknown): value is TiroRequest {
  if (!isRecord(value)) return false;
  return value['type'] === TIRO_STOP_REQUEST || value['type'] === TIRO_START_REQUEST;
}
