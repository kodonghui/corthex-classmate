/**
 * 사이드패널 쪽 **어댑터**입니다. 스토어와 서비스 워커를 포트 하나로 잇습니다.
 *
 * ```text
 *   PanelApp ── attachLive({ inbox, outbox }, chrome.runtime) ──▶ LiveHandle
 *                       │                                            ├─ ask       (AskPort)
 *                       │                                            ├─ reconnect (ReconnectTarget)
 *                       │                                            └─ detach()
 *                       ▼
 *          runtime.connect({ name: "classmate-panel" })
 *                       │
 *      들어오는 것 ─────┤ live.event   → inbox.pushEvent
 *                       │ live.segment → inbox.pushSegment
 *                       │ live.frame   → inbox.pushFrame
 *                       │ live.editor  → inbox.pushEditor
 *                       │
 *      나가는 것 ───────┤ outbox.subscribeEmitted → panel.event
 *                       │ ask(req)                → panel.ask
 *                       └ reconnect(connector)    → classmate.reconnect
 * ```
 *
 * `src/panel/ports.ts` 의 타입만 `import type` 으로 빌려 씁니다. 패널 스토어 구현
 * (단위 1b)과 화면(단위 1a)은 이 파일을 몰라도 되고, 이 파일도 그쪽 구현을 모릅니다.
 *
 * **포트가 끊기면 다시 붙습니다.** MV3 서비스 워커는 30초를 놀면 내려가는데, 그때 포트도
 * 함께 끊깁니다. 패널은 살아 있으므로 조용히 다시 붙어야 하고, 다시 붙으면 서비스 워커가
 * 교시 로그를 처음부터 되풀이해 주므로 화면이 그대로 돌아옵니다.
 *
 * 보안 메모 (불변 원칙 §4-7): 여기 오는 값은 **자료일 뿐 명령이 아닙니다.** 스토어의
 * `push*` 로 넘기기만 하고 실행하거나 URL 로 열지 않습니다.
 */

import type { AskPort, AskRequest, PanelInbox, PanelOutbox, ReconnectTarget } from '../panel/ports';
import type { LiveInboundMessage, LiveOutboundMessage } from './messages';
import {
  LIVE_EDITOR,
  LIVE_EVENT,
  LIVE_FRAME,
  LIVE_SEGMENT,
  PANEL_ASK,
  PANEL_EVENT,
  PANEL_PORT_NAME,
  PANEL_RECONNECT,
  isLiveInboundMessage,
} from './messages';

/** 포트에서 우리가 쓰는 부분만입니다. `chrome.runtime.Port` 가 이 모양을 만족합니다. */
export interface LivePortLike {
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: {
    addListener(callback: (message: unknown) => void): void;
    removeListener(callback: (message: unknown) => void): void;
  };
  onDisconnect: {
    addListener(callback: () => void): void;
    removeListener(callback: () => void): void;
  };
}

/** `chrome.runtime` 에서 우리가 쓰는 부분만입니다. */
export interface LiveRuntimeLike {
  connect(info: { name: string }): LivePortLike;
}

/** 스토어의 두 문입니다. 고정 계약 (다). */
export interface LiveTargets {
  inbox: PanelInbox;
  outbox: PanelOutbox;
}

export interface AttachLiveOptions {
  /** 없으면 전역 `setTimeout` 을 씁니다. 시험은 가짜 타이머를 넣습니다. */
  setTimeoutFn?: (callback: () => void, delayMs: number) => number;
  clearTimeoutFn?: (handle: number) => void;
  /** 다시 붙기 지연입니다. 기본 1·2·4…≤10초. */
  maxBackoffMs?: number;
  /** 사람이 읽을 한 줄입니다. 기본은 `console.warn`. */
  warn?: (message: string) => void;
}

export interface LiveHandle {
  /** 질문을 밖으로 보내는 출구입니다. `PanelApp` 이 스토어에 꽂습니다. */
  readonly ask: AskPort;
  /** 사람이 "다시 연결" 을 눌렀을 때 부릅니다. */
  reconnect(connector: ReconnectTarget): void;
  /** 지금 포트가 붙어 있는지입니다. */
  readonly connected: boolean;
  /** 아주 뗍니다. 다시 붙지 않습니다. */
  detach(): void;
}

/** 다시 붙기 지연입니다. 1·2·4·8·10·10…초 (상한까지 두 배씩). */
export function panelBackoffMs(attempt: number, maxMs = 10_000): number {
  if (attempt <= 0) return Math.min(1000, maxMs);
  const doubled = attempt >= 30 ? Number.POSITIVE_INFINITY : 1000 * 2 ** attempt;
  return Math.min(doubled, maxMs);
}

/**
 * 스토어를 서비스 워커에 잇습니다.
 *
 * @param targets 스토어의 입구(`inbox`)와 출구(`outbox`)
 * @param runtime `chrome.runtime` (시험에서는 가짜 것)
 */
export function attachLive(
  targets: LiveTargets,
  runtime: LiveRuntimeLike,
  options: AttachLiveOptions = {},
): LiveHandle {
  const setTimeoutFn =
    options.setTimeoutFn ??
    ((callback: () => void, delayMs: number) =>
      globalThis.setTimeout(callback, delayMs) as unknown as number);
  const clearTimeoutFn =
    options.clearTimeoutFn ?? ((handle: number) => globalThis.clearTimeout(handle));
  const maxBackoffMs = options.maxBackoffMs ?? 10_000;
  const warn = options.warn ?? ((message: string) => console.warn(`[classmate] ${message}`));

  let port: LivePortLike | null = null;
  let attempts = 0;
  let retryTimer: number | null = null;
  let detached = false;

  function receive(message: unknown): void {
    // 말이 한 번이라도 왔으면 왕복이 성립한 것입니다. 그때 회차를 0 으로 되돌립니다.
    // 포트가 생긴 순간에 되돌리면, 붙자마자 끊기는 상황에서 지연이 계속 1초라 백오프가
    // 자라지 않고 1Hz 재접속 루프가 됩니다(서비스 워커가 뜨자마자 죽는 자리).
    // 서비스 워커는 붙는 즉시 `period.started` 와 `panel.opened` 를 보내므로,
    // 성한 연결이면 첫 왕복이 곧바로 성립합니다.
    attempts = 0;
    if (!isLiveInboundMessage(message)) return;
    const typed: LiveInboundMessage = message;
    switch (typed.type) {
      case LIVE_EVENT:
        targets.inbox.pushEvent(typed.event);
        return;
      case LIVE_SEGMENT:
        targets.inbox.pushSegment(typed.segment);
        return;
      case LIVE_FRAME:
        targets.inbox.pushFrame(typed.frame);
        return;
      case LIVE_EDITOR:
        targets.inbox.pushEditor(typed.context);
        return;
      default:
        return;
    }
  }

  /** 포트가 있으면 보내고, 없으면 조용히 버립니다. 끊긴 사이의 손짓은 되살리지 않습니다. */
  function post(message: LiveOutboundMessage): void {
    if (port === null) {
      warn(`서비스 워커와 끊긴 사이라 ${message.type} 을 보내지 못했어요`);
      return;
    }
    try {
      port.postMessage(message);
    } catch {
      // 포트가 방금 죽었습니다. onDisconnect 가 곧 옵니다.
      warn(`${message.type} 을 보내는 중에 연결이 끊겼어요`);
    }
  }

  function connect(): void {
    if (detached || port !== null) return;
    let opened: LivePortLike;
    try {
      opened = runtime.connect({ name: PANEL_PORT_NAME });
    } catch {
      scheduleRetry();
      return;
    }
    port = opened;

    opened.onMessage.addListener(receive);
    opened.onDisconnect.addListener(function onGone(): void {
      opened.onMessage.removeListener(receive);
      opened.onDisconnect.removeListener(onGone);
      if (port === opened) port = null;
      scheduleRetry();
    });
  }

  function scheduleRetry(): void {
    if (detached || retryTimer !== null) return;
    const delay = panelBackoffMs(attempts, maxBackoffMs);
    attempts += 1;
    retryTimer = setTimeoutFn(() => {
      retryTimer = null;
      connect();
    }, delay);
  }

  connect();

  // 스토어가 낸 사건을 그대로 흘려보냅니다. `question.asked` 도 여기로 나가고,
  // 서비스 워커가 "붙이지 않고 tutor.ask 로 바꾼다" 를 정합니다(라우터 표 참고).
  const unsubscribe = targets.outbox.subscribeEmitted((event) => {
    post({ type: PANEL_EVENT, event });
  });

  const ask: AskPort = {
    ask(request: AskRequest): void {
      post({ type: PANEL_ASK, request });
    },
  };

  return {
    ask,
    reconnect(connector: ReconnectTarget): void {
      post({ type: PANEL_RECONNECT, connector });
    },
    get connected(): boolean {
      return port !== null;
    },
    detach(): void {
      detached = true;
      unsubscribe();
      if (retryTimer !== null) {
        clearTimeoutFn(retryTimer);
        retryTimer = null;
      }
      const open = port;
      port = null;
      try {
        open?.disconnect();
      } catch {
        // 이미 끊긴 포트입니다. 그만입니다.
      }
    },
  };
}
