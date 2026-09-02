import { defineContentScript } from '#imports';

import {
  createShareConnector,
  isSharePageUrl,
  makePeriodId,
  TIRO_SHARE_MATCHES,
} from '../src/tiro';
import type { SelectorBrokenSignal, TiroPartial, TranscriptSegment } from '../src/tiro';

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
  selectorBroken: 'tiro.selector_broken',
} as const;

export type TiroMessage =
  | { type: 'tiro.segment'; segment: TranscriptSegment }
  | { type: 'tiro.partial'; partial: TiroPartial }
  | { type: 'tiro.selector_broken'; signal: SelectorBrokenSignal };

/**
 * 교시 번호 임시값입니다.
 *
 * Phase 2 의 세션 관리(다른 소유)가 실제 교시 번호를 넘겨 주기 전까지 1 로 둡니다.
 * 숫자를 지어내지 않기 위해 상수로 드러내 둡니다.
 */
const PLACEHOLDER_PERIOD_NUMBER = 1;

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

  main() {
    // 로그인·설정 같은 다른 tiro.ooo 페이지에서는 아무것도 하지 않습니다.
    if (!isSharePageUrl(location.href)) return;

    const periodId = makePeriodId(new Date(), PLACEHOLDER_PERIOD_NUMBER);
    const connector = createShareConnector({
      root: document.body,
      periodId,
    });

    connector.onSegment((segment) => {
      send({ type: TIRO_MESSAGE_TYPES.segment, segment });
    });
    connector.onPartial((partial) => {
      send({ type: TIRO_MESSAGE_TYPES.partial, partial });
    });
    connector.onSelectorBroken((signal) => {
      // 본문이 아니라 "얼마나 비어 있었는지"만 남깁니다.
      console.warn(
        `[classmate] 전사 문단을 찾지 못했어요 · ${signal.emptyForMs}ms 동안 0개`,
      );
      send({ type: TIRO_MESSAGE_TYPES.selectorBroken, signal });
    });

    connector.start();

    // 탭이 닫히거나 뒤로 갈 때 옵저버를 뗍니다.
    window.addEventListener('pagehide', () => connector.stop(), { once: true });
  },
});
