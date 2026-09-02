/**
 * 탭이 사라지기 전에 마지막 문단을 건지는 배선.
 *
 * 왜 content script 가 아니라 여기 있나: `entrypoints/**` 는 WXT 가 번들할 때만 뜻이 있어
 * 단위 시험이 부르지 못합니다(`vitest.config.ts` 의 `include` 는 `src/**` 뿐입니다).
 * "언제 flush 를 부르는가" 는 틀리면 마지막 문단이 통째로 사라지는 규칙이라 시험이 필요합니다.
 * 그래서 규칙만 여기 두고 content script 는 이 함수를 부르기만 합니다.
 *
 * 어떤 순간에 무엇을 하나:
 *
 *   pagehide            → flush() 하고 stop()   (탭이 닫히거나 뒤로 감 · 돌아올 수도 있지만 관찰은 끝)
 *   visibilitychange
 *     └ hidden 이면      → flush() 만            (탭을 다른 데로 옮긴 것뿐이라 관찰은 이어 갑니다)
 *   tiro.stop 요청       → flush() 하고 stop()   (교시를 사람이 끝냈습니다)
 *
 * `beforeunload` 를 쓰지 않는 이유: 최신 Chrome 의 bfcache 에서는 불리지 않는 경우가 있고,
 * `pagehide` 가 그 자리를 대신하도록 표준이 정해져 있습니다.
 */
import type { TiroConnector, Unsubscribe } from './types';

/** 이 배선이 쓰는 만큼만 적은 이벤트 대상입니다. `window` 와 `document` 가 이 모양을 만족합니다. */
export interface LifecycleTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/** 이 배선이 커넥터에서 쓰는 것은 두 개뿐입니다. 시험이 가짜 커넥터를 만들기 쉽게 좁혀 둡니다. */
export type FlushableConnector = Pick<TiroConnector, 'flush' | 'stop'>;

export interface LifecycleFlushOptions {
  connector: FlushableConnector;
  /** `pagehide` 를 듣는 곳입니다. 보통 `window` 입니다. */
  pageTarget: LifecycleTarget;
  /** `visibilitychange` 를 듣는 곳입니다. 보통 `document` 입니다. */
  visibilityTarget: LifecycleTarget;
  /** 지금 탭이 숨겨졌는지입니다. 보통 `() => document.visibilityState === 'hidden'`. */
  isHidden: () => boolean;
}

/**
 * 탭 생명주기에 flush 를 붙입니다.
 *
 * @returns 붙인 것을 다시 떼는 함수입니다. 두 번 불러도 안전합니다.
 */
export function attachLifecycleFlush(options: LifecycleFlushOptions): Unsubscribe {
  const { connector, pageTarget, visibilityTarget, isHidden } = options;

  let detached = false;

  const onPageHide = () => {
    if (detached) return;
    // 순서가 중요합니다. stop() 뒤의 flush() 는 아무것도 내지 않습니다.
    connector.flush();
    connector.stop();
  };

  const onVisibilityChange = () => {
    if (detached) return;
    if (!isHidden()) return;
    // 숨겨졌을 뿐이라 멈추지 않습니다. 실측에서 hidden 탭도 DOM 변경은 계속 옵니다
    // (docs/spikes/gate-a-tiro.md · 4분에 215건). 다시 보일 때 이어서 받습니다.
    connector.flush();
  };

  pageTarget.addEventListener('pagehide', onPageHide);
  visibilityTarget.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    if (detached) return;
    detached = true;
    pageTarget.removeEventListener('pagehide', onPageHide);
    visibilityTarget.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

/**
 * 사람이 교시를 끝냈을 때의 마무리입니다. `tiro.stop` 요청을 받은 자리에서 부릅니다.
 *
 * 배선과 따로 두는 이유: 이쪽은 이벤트가 아니라 **요청**이라 언제든 한 번만 옵니다.
 * 같은 두 줄이지만 부르는 자리가 달라 이름을 나눠 둡니다.
 */
export function stopWithFlush(connector: FlushableConnector): void {
  connector.flush();
  connector.stop();
}
