/**
 * 로컬 도우미(Native Messaging Host)에 붙는 **연결 담당**입니다.
 *
 * `chrome` 전역을 직접 만지지 않습니다. 포트를 만드는 함수(`NativePortFactory`)와 타이머를
 * 밖에서 넣어 주므로, 단위 시험은 가짜 포트와 `vi.useFakeTimers()` 만으로 전부 돌릴 수 있습니다.
 * 실제 배선(`chrome.runtime.connectNative`)은 `entrypoints/background.ts` 한 줄입니다.
 *
 * ```text
 *          send(봉투)
 *              │
 *              ├─ 연결됨 ──▶ port.postMessage ──▶ 대기열(FIFO) 뒤에 붙임
 *              │                                      │  호스트는 한 줄로 일하므로
 *              │                                      │  답도 보낸 순서대로 옵니다
 *              │                                      ▼
 *              │                              onMessage ── tutor.event? ──▶ 구독자(자발 push)
 *              │                                        └─ 그 밖 ─────────▶ 대기열 맨 앞과 짝
 *              │
 *              └─ 끊김 ──┬─ 다시 보낼 것(event.append · frame.store) ──▶ 보류 대기열
 *                        └─ 그 밖(ping · tutor.*) ─────────────────────▶ 그 자리에서 포기
 *
 *   onDisconnect ──▶ 백오프 1·2·4·8·16·30·30…초 (≤30초) ──▶ 다시 connect
 *                    연결이 서면 ping 을 보내고 hello 를 받은 뒤에야 "연결됨"입니다
 * ```
 *
 * **왜 `hello` 를 받고 나서야 연결됨인가**: 도우미가 등록돼 있지 않으면 `connectNative` 는
 * 성공한 것처럼 포트를 돌려주고 곧바로 끊깁니다. 포트가 생긴 순간에 "연결됨" 이라고 알리면
 * 사이드패널의 상태 점이 초록 ↔ 회색을 1초마다 오갑니다. 왕복이 한 번 성립해야 초록입니다.
 *
 * 보안 메모 (불변 원칙 §4-2): 로그에 봉투 본문을 적지 않습니다. 봉투 이름과 개수만 남깁니다.
 */

import type {
  EventAppendEnvelope,
  FrameStoreMessage,
  HostEnvelope,
  HostReply,
  TutorEventPush,
} from './host-messages';
import { isHelloReply, isResendable, isTutorEventPush } from './host-messages';

/** 포트에서 우리가 쓰는 부분만 적었습니다. `chrome.runtime.Port` 가 이 모양을 만족합니다. */
export interface NativePortLike {
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: { addListener(callback: (message: unknown) => void): void };
  onDisconnect: { addListener(callback: () => void): void };
}

/** 포트를 새로 만드는 함수입니다. 실제로는 `chrome.runtime.connectNative(NATIVE_HOST_NAME)`. */
export type NativePortFactory = () => NativePortLike;

/** 타이머에서 우리가 쓰는 부분만 적었습니다. 시험은 가짜 타이머를 넣습니다. */
export interface TimerLike {
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(handle: number): void;
}

/** 연결 상태입니다. 계약 `connector.status` 의 `state` 축과 같은 낱말을 씁니다. */
export type HostConnectionState = 'connected' | 'off';

/** `send` 한 번의 결말입니다. **던지지 않습니다.** 부탁 하나가 실패해도 수업은 이어집니다. */
export type HostSendResult =
  | { status: 'replied'; message: HostReply }
  | { status: 'queued' }
  | { status: 'dropped'; reason: string };

export interface NativeHostClientOptions {
  /** 포트를 만드는 함수입니다. */
  connect: NativePortFactory;
  /** 없으면 전역 타이머를 씁니다. */
  timers?: TimerLike;
  /** 끊긴 동안 들고 있을 부탁 수의 상한입니다. 넘치면 오래된 것부터 버립니다. */
  maxQueued?: number;
  /** 백오프 상한입니다. 기본 30초. */
  maxBackoffMs?: number;
  /** 답이 이 시간 안에 안 오면 그 부탁은 포기합니다. 기본 45초(제공자 타임아웃과 같은 값). */
  requestTimeoutMs?: number;
  /** 연결 상태가 바뀔 때 부릅니다. */
  onStatus?: (state: HostConnectionState, reason?: string) => void;
  /** 호스트가 스스로 민 `tutor.event` 를 받습니다. */
  onPush?: (push: TutorEventPush) => void;
  /**
   * 사람이 읽을 한 줄입니다. 기본은 `console.warn`.
   *
   * `console.error` 를 쓰지 않는 이유: 도우미가 등록돼 있지 않은 PC(개발 · E2E)에서는 끊김이
   * **정상 상태**입니다. 30초마다 빨간 줄이 쌓이면 진짜 오류가 묻힙니다.
   */
  warn?: (message: string) => void;
}

/** 백오프 지연입니다. 1·2·4·8·16·30·30…초 (상한까지 두 배씩). */
export function backoffDelayMs(attempt: number, maxMs = 30_000): number {
  if (attempt <= 0) return Math.min(1000, maxMs);
  // 2 ** 30 을 넘기면 숫자가 커져 의미가 없으므로 지수를 먼저 자릅니다.
  const doubled = attempt >= 30 ? Number.POSITIVE_INFINITY : 1000 * 2 ** attempt;
  return Math.min(doubled, maxMs);
}

interface WaitingRequest {
  envelope: HostEnvelope;
  /** 답을 기다리는 사람입니다. 재전송처럼 기다리는 사람이 없으면 null 입니다. */
  settle: ((result: HostSendResult) => void) | null;
  /** 시간이 다 되어 포기한 부탁입니다. 뒤늦게 온 답이 다음 부탁과 짝지어지지 않게 자리는 지킵니다. */
  abandoned: boolean;
  timer: number | null;
}

export interface HostClientStats {
  /** 끊긴 동안 들고 있는 부탁 수입니다. */
  queued: number;
  /** 상한을 넘어 버린 부탁 수입니다(누적). */
  dropped: number;
  /** 답을 기다리는 부탁 수입니다. */
  waiting: number;
  /** 다시 붙기를 몇 번 시도했는지입니다. 연결이 서면 0 으로 돌아갑니다. */
  attempts: number;
  connected: boolean;
}

export class NativeHostClient {
  private readonly options: Required<
    Pick<NativeHostClientOptions, 'connect' | 'maxQueued' | 'maxBackoffMs' | 'requestTimeoutMs'>
  >;
  private readonly timers: TimerLike;
  private readonly warn: (message: string) => void;
  private readonly onStatus: (state: HostConnectionState, reason?: string) => void;
  private readonly onPush: (push: TutorEventPush) => void;

  private port: NativePortLike | null = null;
  /** 이 포트가 지금 우리 것인지입니다. 옛 포트의 늦은 콜백을 걸러 냅니다. */
  private generation = 0;
  private handshaken = false;
  private started = false;
  private attempts = 0;
  private reconnectTimer: number | null = null;

  private readonly waiting: WaitingRequest[] = [];
  private readonly pending: (EventAppendEnvelope | FrameStoreMessage)[] = [];
  private droppedCount = 0;

  constructor(options: NativeHostClientOptions) {
    this.options = {
      connect: options.connect,
      maxQueued: options.maxQueued ?? 200,
      maxBackoffMs: options.maxBackoffMs ?? 30_000,
      requestTimeoutMs: options.requestTimeoutMs ?? 45_000,
    };
    this.timers = options.timers ?? {
      setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs) as unknown as number,
      clearTimeout: (handle) => globalThis.clearTimeout(handle),
    };
    this.warn = options.warn ?? ((message) => console.warn(`[classmate] ${message}`));
    this.onStatus = options.onStatus ?? (() => {});
    this.onPush = options.onPush ?? (() => {});
  }

  /** 지금 왕복이 성립하는 상태인지입니다(`hello` 를 받은 뒤). */
  get connected(): boolean {
    return this.handshaken;
  }

  stats(): HostClientStats {
    return {
      queued: this.pending.length,
      dropped: this.droppedCount,
      waiting: this.waiting.length,
      attempts: this.attempts,
      connected: this.handshaken,
    };
  }

  /** 붙기 시작합니다. 두 번 불러도 한 번만 붙습니다. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.open();
  }

  /** 사람이 "다시 연결" 을 눌렀습니다. 백오프를 기다리지 않고 지금 붙습니다. */
  reconnectNow(): void {
    this.started = true;
    this.attempts = 0;
    this.cancelReconnectTimer();
    this.teardown('reconnect-requested');
    this.open();
  }

  /** 아주 멈춥니다. 다시 붙지 않습니다. */
  stop(): void {
    this.started = false;
    this.cancelReconnectTimer();
    this.teardown('stopped');
  }

  /**
   * 부탁 하나를 보냅니다. **던지지 않습니다.**
   *
   * - 연결돼 있으면 보내고 답을 기다립니다 → `{status:'replied'}`
   * - 끊겼는데 다시 보낼 수 있는 것이면 들고 있습니다 → `{status:'queued'}`
   * - 끊겼고 들고 있을 수 없는 것이면 그 자리에서 포기합니다 → `{status:'dropped'}`
   */
  send(envelope: HostEnvelope): Promise<HostSendResult> {
    if (!this.handshaken || this.port === null) {
      if (isResendable(envelope)) {
        this.enqueue(envelope);
        return Promise.resolve({ status: 'queued' });
      }
      return Promise.resolve({ status: 'dropped', reason: 'host-offline' });
    }
    return this.write(envelope);
  }

  // ── 안쪽 ─────────────────────────────────────────────────────────────────

  private enqueue(envelope: EventAppendEnvelope | FrameStoreMessage): void {
    this.pending.push(envelope);
    this.trimPending();
  }

  /** 상한을 넘으면 **오래된 것부터** 버립니다. 버릴 때마다 한 줄 남깁니다. */
  private trimPending(): void {
    let dropped = 0;
    while (this.pending.length > this.options.maxQueued) {
      this.pending.shift();
      this.droppedCount += 1;
      dropped += 1;
    }
    if (dropped > 0) {
      this.warn(
        `도우미가 꺼져 있어 오래된 부탁 ${dropped}건을 버렸어요 · 들고 있는 것 ${this.pending.length}건 · 버린 것 누적 ${this.droppedCount}건`,
      );
    }
  }

  private write(envelope: HostEnvelope, settle: ((r: HostSendResult) => void) | null = null): Promise<HostSendResult> {
    const port = this.port;
    if (port === null) {
      const offline: HostSendResult = { status: 'dropped', reason: 'host-offline' };
      settle?.(offline);
      return Promise.resolve(offline);
    }

    return new Promise<HostSendResult>((resolve) => {
      const entry: WaitingRequest = {
        envelope,
        settle: (result) => {
          settle?.(result);
          resolve(result);
        },
        abandoned: false,
        timer: null,
      };
      this.waiting.push(entry);

      entry.timer = this.timers.setTimeout(() => {
        if (entry.settle === null) return;
        entry.abandoned = true;
        entry.timer = null;
        const settled = entry.settle;
        entry.settle = null;
        this.warn(`도우미가 ${this.options.requestTimeoutMs}ms 안에 답하지 않았어요 · ${envelope.type}`);
        settled({ status: 'dropped', reason: 'timeout' });
      }, this.options.requestTimeoutMs);

      try {
        port.postMessage(envelope);
      } catch (error: unknown) {
        // postMessage 가 던지면 답은 영영 오지 않습니다. 자리를 비우고 곧장 끝냅니다.
        this.removeWaiting(entry);
        const reason = error instanceof Error ? error.message : 'post-failed';
        entry.settle?.({ status: 'dropped', reason });
        entry.settle = null;
      }
    });
  }

  private removeWaiting(entry: WaitingRequest): void {
    const index = this.waiting.indexOf(entry);
    if (index >= 0) this.waiting.splice(index, 1);
    if (entry.timer !== null) {
      this.timers.clearTimeout(entry.timer);
      entry.timer = null;
    }
  }

  private open(): void {
    if (!this.started || this.port !== null) return;

    this.generation += 1;
    const generation = this.generation;

    let port: NativePortLike;
    try {
      port = this.options.connect();
    } catch (error: unknown) {
      // 권한이 없거나 호스트 이름이 등록되지 않았으면 여기서 던집니다.
      const reason = error instanceof Error ? error.message : 'connect-failed';
      this.scheduleReconnect(reason);
      return;
    }

    this.port = port;
    this.handshaken = false;

    port.onMessage.addListener((message: unknown) => {
      if (generation !== this.generation) return;
      this.receive(message);
    });
    port.onDisconnect.addListener(() => {
      if (generation !== this.generation) return;
      this.handleDisconnect();
    });

    // 왕복이 성립하는지 확인합니다. 답(`hello`)이 와야 "연결됨" 입니다.
    void this.write({ type: 'ping' });
  }

  private receive(message: unknown): void {
    // 자발 push 는 부탁에 대한 답이 아닙니다. 대기열을 건드리지 않습니다.
    if (isTutorEventPush(message)) {
      this.onPush(message);
      return;
    }

    if (isHelloReply(message) && !this.handshaken) {
      this.handshaken = true;
      this.attempts = 0;
      this.onStatus('connected');
      this.flushPending();
    }

    // 호스트는 한 줄로 일하므로 답은 보낸 순서대로 옵니다. 맨 앞과 짝지웁니다.
    const entry = this.waiting.shift();
    if (entry === undefined) {
      this.warn('도우미가 부탁하지 않은 답을 보냈어요 · 무시합니다');
      return;
    }
    if (entry.timer !== null) {
      this.timers.clearTimeout(entry.timer);
      entry.timer = null;
    }
    if (entry.abandoned || entry.settle === null) return;

    const settle = entry.settle;
    entry.settle = null;
    settle({ status: 'replied', message: message as HostReply });
  }

  private handleDisconnect(): void {
    const wasConnected = this.handshaken;
    this.teardown('disconnected');
    if (wasConnected) {
      this.onStatus('off', 'disconnected');
    }
    this.scheduleReconnect('disconnected');
  }

  /**
   * 지금 포트를 버리고 기다리던 부탁들을 정리합니다.
   *
   * 다시 보낼 수 있는 것은 **보내려던 순서 그대로 보류 대기열 맨 앞에** 되돌립니다.
   * 그래야 기록의 순서가 뒤집히지 않습니다.
   */
  private teardown(reason: string): void {
    this.generation += 1;
    const port = this.port;
    this.port = null;
    this.handshaken = false;

    if (port !== null) {
      try {
        port.disconnect();
      } catch {
        // 이미 끊긴 포트입니다. 그만입니다.
      }
    }

    const requeue: (EventAppendEnvelope | FrameStoreMessage)[] = [];
    while (this.waiting.length > 0) {
      const entry = this.waiting.shift();
      if (entry === undefined) break;
      if (entry.timer !== null) {
        this.timers.clearTimeout(entry.timer);
        entry.timer = null;
      }
      const settle = entry.settle;
      entry.settle = null;
      if (isResendable(entry.envelope)) {
        requeue.push(entry.envelope);
        settle?.({ status: 'queued' });
      } else {
        settle?.({ status: 'dropped', reason });
      }
    }
    if (requeue.length > 0) {
      this.pending.unshift(...requeue);
      this.trimPending();
    }
  }

  private flushPending(): void {
    if (this.pending.length === 0) return;
    const batch = this.pending.splice(0, this.pending.length);
    this.warn(`도우미가 돌아와 밀린 부탁 ${batch.length}건을 다시 보냅니다`);
    for (const envelope of batch) {
      // 기다리는 사람이 없는 재전송입니다. 답은 대기열 짝을 맞추는 데만 씁니다.
      void this.write(envelope);
    }
  }

  private cancelReconnectTimer(): void {
    if (this.reconnectTimer === null) return;
    this.timers.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private scheduleReconnect(reason: string): void {
    if (!this.started || this.reconnectTimer !== null) return;
    const delay = backoffDelayMs(this.attempts, this.options.maxBackoffMs);
    this.attempts += 1;
    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
    // 처음 한 번만 남깁니다. 도우미가 없는 PC 에서 30초마다 줄이 쌓이면 진짜 오류가 묻힙니다.
    if (this.attempts === 1) {
      this.warn(`로컬 도우미와 끊겼어요(${reason}) · ${delay}ms 뒤에 다시 붙어 봅니다`);
    }
  }
}
