import { defineContentScript } from '#imports';

import {
  attachLifecycleFlush,
  createShareConnector,
  decideNavigationAction,
  isSharePageUrl,
  readPeriodNumber,
  stopWithFlush,
  TIRO_SHARE_MATCHES,
} from '../src/tiro';
import type { FlushableConnector, Unsubscribe } from '../src/tiro';
import type { TiroMessage } from '../src/background/tiro-messages';
import {
  TIRO_MESSAGE_TYPES,
  TIRO_START_REQUEST,
  TIRO_STOP_REQUEST,
  isTiroRequest,
} from '../src/background/tiro-messages';

/**
 * Tiro 공유 페이지 content script (Gate A · 2순위 경로).
 *
 * 하는 일은 하나입니다: 공유 페이지 DOM 을 MutationObserver 로 읽어
 * `chrome.runtime.sendMessage` 로 백그라운드에 넘깁니다.
 *
 * **받는 쪽은 2라운드에 붙었습니다.** `src/background/router.ts` 가 이 메시지들을 받아
 * 로컬 도우미의 `event.append` 와 사이드패널로 나눠 보냅니다. 말의 이름과 좁힘 함수는
 * 양쪽이 같은 파일(`src/background/tiro-messages.ts`)을 보고, 이 파일은 그것을 다시 냅니다.
 * 사이드패널이 닫혀 있고 서비스 워커가 잠들어 있으면 `sendMessage` 가 잠깐 떨어질 수
 * 있는데, 그것은 오류가 아니라 정상이라 아래에서 조용히 삼킵니다.
 *
 * 지키는 것 (불변 원칙 §3 · §7):
 *  - 공유 URL·비밀번호를 로그에 남기지 않습니다. 콘솔에는 개수와 상태 이름만 씁니다.
 *  - 전사 문장을 명령으로 해석하지 않습니다. 문자열을 그대로 메시지 payload 에 담기만 합니다.
 */

// 말의 이름은 `src/background/tiro-messages.ts` 가 정본입니다. 1라운드에는 이 파일 안에
// 있었지만, 받는 쪽(라우터)이 생기면서 양쪽이 같은 파일을 보도록 옮겼습니다.
// 밖에서 쓰던 이름이 끊기지 않게 여기서 그대로 다시 냅니다.
export { TIRO_MESSAGE_TYPES, TIRO_START_REQUEST, TIRO_STOP_REQUEST };
export type { TiroMessage };

/** 받는 쪽이 없을 때 나는 오류를 삼킵니다. 패널이 닫혀 있으면 흔한 일입니다. */
function send(message: TiroMessage): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
  try {
    void Promise.resolve(chrome.runtime.sendMessage(message)).catch(() => {
      // 서비스 워커가 잠들어 있으면 잠깐 이렇게 떨어집니다. 다음 문단이 다시 깨웁니다.
    });
  } catch {
    // 확장 문맥이 이미 내려간 경우(새로고침 직후)입니다.
  }
}

export default defineContentScript({
  matches: [...TIRO_SHARE_MATCHES],
  runAt: 'document_idle',

  async main(ctx) {
    // 교시 번호는 chrome.storage.local 의 `classmate.periodNumber` 에서 읽습니다.
    // 값이 없거나 1~8 밖이면 1 이 됩니다. 저장소에 값을 넣는 쪽(설정 화면·세션 관리)은
    // 다른 단위 소유라 여기서 쓰지 않고 읽기만 합니다.
    const period = await readPeriodNumber();
    if (period.source === 'error') {
      // 3교시 수업이 저장소 오류로 조용히 1교시에 섞이면 아무도 모릅니다. 숫자만 남깁니다.
      console.warn(`[classmate] 교시 번호를 읽지 못해 ${period.value}교시로 답니다`);
    }

    // 커넥터는 **한 번만** 만듭니다. 교시 식별자는 만들 때 정해지므로, SPA 안에서 페이지를
    // 오갈 때마다 다시 만들면 같은 교시가 도중에 다른 식별자로 갈립니다.
    // 만들기만 하고 `start()` 를 부를 때까지 아무것도 하지 않습니다.
    const connector = createShareConnector({
      root: document.body,
      periodNumber: period.value,
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

    /** 지금 관찰 중인지입니다. 시작·정지를 두 번 불러도 한 번만 듣게 합니다. */
    let observing = false;
    /** 생명주기 배선을 뗄 함수입니다. 버리면 멈춘 커넥터의 flush 를 부르는 리스너가 남습니다. */
    let detachLifecycle: Unsubscribe | null = null;

    /**
     * 생명주기 배선에게 보여 주는 얼굴입니다.
     *
     * `stop` 을 커넥터가 아니라 `stopObserving` 으로 돌려, 정리(리스너 떼기 포함)가
     * 어느 길로 들어오든 한 곳에서 끝나게 합니다.
     */
    const lifecycleFace: FlushableConnector = {
      flush: () => connector.flush(),
      stop: () => {
        stopObserving();
      },
    };

    function startObserving(): void {
      if (observing) return;
      observing = true;
      connector.start();

      // 탭이 사라지거나 숨겨질 때 아직 확정 안 된 마지막 문단을 partial 세그먼트로 건집니다.
      // 이것이 없으면 교시 마지막 한 문단이 통째로 버려집니다.
      detachLifecycle = attachLifecycleFlush({
        connector: lifecycleFace,
        pageTarget: window,
        visibilityTarget: document,
        isHidden: () => document.visibilityState === 'hidden',
      });
    }

    function stopObserving(): void {
      if (!observing) return;
      observing = false;
      // 먼저 떼고 나서 멈춥니다. 순서가 반대여도 결과는 같지만, "멈춘 뒤에는 아무 리스너도
      // 남지 않는다"를 한 줄로 읽히게 둡니다.
      detachLifecycle?.();
      detachLifecycle = null;
      stopWithFlush(connector);
    }

    // 로그인·설정 같은 다른 tiro.ooo 페이지에서는 아직 시작하지 않습니다.
    let lastUrl = location.href;
    if (isSharePageUrl(lastUrl)) startObserving();

    // SPA 안에서 주소만 바뀌는 이동(전체 새로고침 없음)을 따라갑니다. 판정은
    // `src/tiro/lifecycle.ts` 의 `decideNavigationAction` 이 하고 여기서는 그 결과만 따릅니다.
    // tiro.ooo 가 클라이언트 라우팅을 쓰지 않으면 이 이벤트가 오지 않아 아무 일도 없습니다.
    ctx.addEventListener(window, 'wxt:locationchange', (event) => {
      const action = decideNavigationAction(lastUrl, event.newUrl.href);
      lastUrl = event.newUrl.href;
      if (action === 'start') startObserving();
      if (action === 'stop') stopObserving();
    });

    // 서비스 워커가 보내는 두 가지 요청을 듣습니다.
    //
    //   tiro.stop  — 사람이 교시를 끝냈거나 "다시 연결" 을 눌렀습니다. 진행 중 문단을
    //                partial 세그먼트로 한 번 건진 뒤 관찰을 멈춥니다.
    //   tiro.start — 위 `tiro.stop` 바로 뒤에 옵니다. 관찰을 다시 세웁니다.
    //
    // 공유 페이지가 아닌 tiro.ooo 페이지(로그인·설정)에서는 `tiro.start` 를 받아도 시작하지
    // 않습니다. 시작 판정은 언제나 주소가 합니다.
    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (!isTiroRequest(message)) return;
      if (message.type === TIRO_STOP_REQUEST) {
        stopObserving();
        return;
      }
      if (isSharePageUrl(location.href)) startObserving();
    });
  },
});
