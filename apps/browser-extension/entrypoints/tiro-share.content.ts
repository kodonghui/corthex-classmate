import { defineContentScript } from '#imports';

import {
  attachLifecycleFlush,
  createShareConnector,
  isSharePageUrl,
  readPeriodNumber,
  stopWithFlush,
  TIRO_SHARE_MATCHES,
} from '../src/tiro';
import type {
  HintDegradedSignal,
  SelectorBrokenSignal,
  TiroPartial,
  TranscriptSegment,
} from '../src/tiro';

/**
 * Tiro 공유 페이지 content script (Gate A · 2순위 경로).
 *
 * 하는 일은 하나입니다: 공유 페이지 DOM 을 MutationObserver 로 읽어
 * `chrome.runtime.sendMessage` 로 백그라운드에 넘깁니다.
 *
 * **받는 쪽은 아직 없습니다.** background 의 수신 처리·세션 저장·Native Messaging 전달은
 * Phase 2 몫이고 이 게이트의 소유가 아닙니다. 그래서 지금 `sendMessage` 는 거의 항상
 * "Receiving end does not exist" 로 떨어지고, 아래에서 그것을 조용히 삼킵니다.
 * 이건 버그가 아니라 Phase 1 의 정상 상태입니다.
 *
 * 지키는 것 (불변 원칙 §3 · §7):
 *  - 공유 URL·비밀번호를 로그에 남기지 않습니다. 콘솔에는 개수와 상태 이름만 씁니다.
 *  - 전사 문장을 명령으로 해석하지 않습니다. 문자열을 그대로 메시지 payload 에 담기만 합니다.
 */

/** 백그라운드로 보내는 메시지 이름입니다. Phase 2 수신부가 이 이름을 그대로 씁니다. */
export const TIRO_MESSAGE_TYPES = {
  segment: 'tiro.segment',
  partial: 'tiro.partial',
  hintDegraded: 'tiro.hint_degraded',
  selectorBroken: 'tiro.selector_broken',
} as const;

export type TiroMessage =
  | { type: 'tiro.segment'; segment: TranscriptSegment }
  | { type: 'tiro.partial'; partial: TiroPartial }
  | { type: 'tiro.hint_degraded'; signal: HintDegradedSignal }
  | { type: 'tiro.selector_broken'; signal: SelectorBrokenSignal };

/**
 * 백그라운드에서 **받는** 요청 이름입니다.
 *
 * 교시를 사람이 끝냈을 때 옵니다. 받으면 진행 중 문단을 flush 하고 관찰을 멈춥니다.
 * 보내는 쪽(background)은 다른 단위 소유라 이 파일에서 만들지 않습니다.
 */
export const TIRO_STOP_REQUEST = 'tiro.stop';

/** 이 content script 가 알아듣는 요청입니다. 모르는 모양은 그냥 무시합니다. */
function isStopRequest(message: unknown): boolean {
  if (typeof message !== 'object' || message === null) return false;
  return (message as { type?: unknown }).type === TIRO_STOP_REQUEST;
}

/** 받는 쪽이 없을 때 나는 오류를 삼킵니다. Phase 1 에서는 이게 정상입니다. */
function send(message: TiroMessage): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
  try {
    void Promise.resolve(chrome.runtime.sendMessage(message)).catch(() => {
      // Phase 2 수신부가 붙기 전까지는 받는 쪽이 없습니다.
    });
  } catch {
    // 확장 문맥이 이미 내려간 경우(새로고침 직후)입니다.
  }
}

export default defineContentScript({
  matches: [...TIRO_SHARE_MATCHES],
  runAt: 'document_idle',

  async main() {
    // 로그인·설정 같은 다른 tiro.ooo 페이지에서는 아무것도 하지 않습니다.
    if (!isSharePageUrl(location.href)) return;

    // 교시 번호는 chrome.storage.local 의 `classmate.periodNumber` 에서 읽습니다.
    // 값이 없거나 1~8 밖이면 1 이 됩니다. 저장소에 값을 넣는 쪽(설정 화면·세션 관리)은
    // 다른 단위 소유라 여기서 쓰지 않고 읽기만 합니다.
    const periodNumber = await readPeriodNumber();
    const connector = createShareConnector({
      root: document.body,
      periodNumber,
    });

    connector.onSegment((segment) => {
      send({ type: TIRO_MESSAGE_TYPES.segment, segment });
    });
    connector.onPartial((partial) => {
      send({ type: TIRO_MESSAGE_TYPES.partial, partial });
    });
    connector.onHintDegraded((signal) => {
      // 본문이 아니라 "판별 근거가 어느 등급으로 바뀌었는지"만 남깁니다.
      console.warn(
        `[classmate] 전사 확정/진행 판별 근거가 바뀌었어요 · ${signal.previousStateSource ?? '처음'} → ${signal.stateSource}`,
      );
      send({ type: TIRO_MESSAGE_TYPES.hintDegraded, signal });
    });
    connector.onSelectorBroken((signal) => {
      // 본문이 아니라 "얼마나 비어 있었는지"만 남깁니다.
      console.warn(
        `[classmate] 전사 문단을 찾지 못했어요 · ${signal.emptyForMs}ms 동안 0개`,
      );
      send({ type: TIRO_MESSAGE_TYPES.selectorBroken, signal });
    });

    connector.start();

    // 탭이 사라지거나 숨겨질 때 아직 확정 안 된 마지막 문단을 partial 세그먼트로 건집니다.
    // 이것이 없으면 교시 마지막 한 문단이 통째로 버려집니다.
    attachLifecycleFlush({
      connector,
      pageTarget: window,
      visibilityTarget: document,
      isHidden: () => document.visibilityState === 'hidden',
    });

    // 사람이 교시를 끝내면 background 가 `tiro.stop` 을 보냅니다. 받는 쪽이 아직 없어도
    // 듣는 것은 공짜라 미리 붙여 둡니다(보내는 쪽은 다음 라운드의 다른 단위 소유입니다).
    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (!isStopRequest(message)) return;
      stopWithFlush(connector);
    });
  },
});
