/**
 * 감지된 프레임이 **가는 곳** 입니다.
 *
 * 왜 인터페이스인가:
 *   1라운드에서 프레임은 아직 디스크로 가지 못합니다. 실제 저장은 로컬 도우미가 하고,
 *   확장은 `chrome.runtime.connectNative` 로 그쪽에 넘겨야 하는데 그 연결은 2라운드
 *   일입니다. 그래서 "가는 곳" 을 인터페이스 하나로 뽑아 두고, 1라운드에는 메모리 구현
 *   `MemoryFrameSink` 를 끼웁니다. 2라운드에서 같은 자리에 `NativeHostFrameSink` 를
 *   끼우면 위쪽 코드(파이프라인·offscreen·background)는 한 줄도 안 바뀝니다.
 *
 *   CapturePipeline ──onFrame(frame, encoded)──▶ FrameSink.store(ScreenFrame, bytes)
 *                                                     │
 *                                          1라운드 ── MemoryFrameSink (60분 상한)
 *                                          2라운드 ── NativeHostFrameSink (connectNative)
 *
 * 크기 가드:
 *   `store` 는 언제나 `buildFrameStore` 를 먼저 부릅니다. 봉투가 1 MiB 를 넘으면 그 장은
 *   **버리고 `skippedTooLarge` 로 셉니다.** 2라운드에서 실제로 보낼 때도 같은 판정이 나야
 *   하므로, 판정을 통로 쪽이 아니라 여기서 미리 해 둡니다.
 */

import type { ScreenFrame } from '@classmate/contracts';
import type { BuildFrameStoreResult, FrameStoreMessage } from './host-messages';
import { base64ByteLength, buildFrameStore } from './host-messages';
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_DURATION_MS } from './frame-store';

export interface FrameSinkStats {
  /** 실제로 받아 둔 장 수입니다(누적). */
  stored: number;
  /** 봉투가 1 MiB 를 넘어 건너뛴 장 수입니다(누적). */
  skippedTooLarge: number;
  /** 지금 들고 있는 바이트 합계입니다. */
  bytes: number;
  /** 지금 들고 있는 장 수입니다. */
  frames: number;
  /** 상한 때문에 버린 장 수입니다(누적). */
  evicted: number;
}

export interface FrameSink {
  /**
   * 프레임 한 장을 넘깁니다.
   *
   * 크기 상한에 걸린 장은 **던지지 않고 조용히 건너뜁니다.** 한 장을 못 보냈다고 캡처
   * 전체가 멈추면 안 되기 때문입니다. 건너뛴 사실은 통계로 드러납니다.
   */
  store(frame: ScreenFrame, bytes: Uint8Array): Promise<void>;
}

export interface MemoryFrameSinkOptions {
  /** 들고 있을 수 있는 가장 오래된 장의 나이. 기본 60분(한 교시). */
  maxAgeMs?: number;
  /** 바이트 합계 상한. 기본 48MiB. */
  maxBytes?: number;
  /** 지금 시각을 주는 함수. 시험에서 가짜 시계를 넣습니다. 기본 `Date.now`. */
  now?: () => number;
}

interface MemoryEntry {
  frame: ScreenFrame;
  bytes: Uint8Array;
  atMs: number;
}

/**
 * 1라운드용 기본 구현. WebP 바이트를 메모리에 들고 있다가 60분·바이트 상한에 걸리면
 * 오래된 것부터 버립니다. 디스크에 쓰지 않고 밖으로 보내지도 않습니다
 * (불변 원칙 §4-1 "수업 데이터는 로컬 정본, 서버 기본 전송 없음").
 */
export class MemoryFrameSink implements FrameSink {
  readonly maxAgeMs: number;
  readonly maxBytes: number;

  private readonly now: () => number;
  private entries: MemoryEntry[] = [];

  private storedCount = 0;
  private skippedTooLargeCount = 0;
  private evictedCount = 0;
  private byteTotal = 0;

  constructor(options: MemoryFrameSinkOptions = {}) {
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_DURATION_MS;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.now = options.now ?? (() => Date.now());

    if (this.maxAgeMs <= 0 || this.maxBytes <= 0) {
      throw new RangeError('상한은 0 보다 커야 해요');
    }
  }

  async store(frame: ScreenFrame, bytes: Uint8Array): Promise<void> {
    const built = buildFrameStore(frame, bytes);
    if (built.skipped) {
      this.skippedTooLargeCount += 1;
      return;
    }

    this.entries.push({ frame: built.message.frame, bytes, atMs: this.now() });
    this.storedCount += 1;
    this.byteTotal += bytes.byteLength;
    this.evict();
  }

  /** 아직 들고 있는 장의 바이트입니다. 버려졌으면 null 입니다. */
  peek(id: string): Uint8Array | null {
    return this.entries.find((entry) => entry.frame.id === id)?.bytes ?? null;
  }

  /** 오래된 순서로 지금 들고 있는 장 전부입니다. */
  list(): ScreenFrame[] {
    return this.entries.map((entry) => entry.frame);
  }

  stats(): FrameSinkStats {
    return {
      stored: this.storedCount,
      skippedTooLarge: this.skippedTooLargeCount,
      bytes: this.byteTotal,
      frames: this.entries.length,
      evicted: this.evictedCount,
    };
  }

  /** 교시가 끝나면 비웁니다. 누적 통계는 그대로 둡니다. */
  clear(): void {
    this.entries = [];
    this.byteTotal = 0;
  }

  /**
   * 나이와 바이트 두 상한을 지키게 오래된 것부터 버립니다.
   *
   * 나이는 "마지막 한 장은 남긴다" 예외를 두지 않습니다. 60분이 지난 장은 교시가 바뀐
   * 것이므로 남길 이유가 없습니다. 바이트 쪽은 한 장이 상한보다 커도 그 장은 남깁니다.
   */
  private evict(): void {
    const cutoff = this.now() - this.maxAgeMs;
    while (this.entries.length > 0 && (this.entries[0]?.atMs ?? 0) < cutoff) {
      this.drop();
    }
    while (this.entries.length > 1 && this.byteTotal > this.maxBytes) {
      this.drop();
    }
  }

  private drop(): void {
    const removed = this.entries.shift();
    if (!removed) return;
    this.byteTotal -= removed.bytes.byteLength;
    this.evictedCount += 1;
  }
}

/**
 * `frame.store` 봉투 하나를 도우미에 넣어 본 결말입니다.
 *
 * 왜 여기서 정의하는가: 봉투를 실제로 보내는 일은 서비스 워커의 `NativeHostClient` 가 하는데,
 * 그 타입을 `src/capture/` 가 들여오면 캡처가 배경 배선을 알게 됩니다. 결말 세 가지만
 * 여기서 정하고, `src/background/` 가 자기 결과를 이 모양으로 옮겨 줍니다.
 */
export type FrameStoreOutcome =
  /** 도우미가 파일로 남겼습니다. `seq` 는 **기록 순번**이지 장 수가 아닙니다. */
  | { kind: 'stored'; bytes: number; seq: number }
  /** 도우미가 거절했습니다(`duplicate-frame` · `invalid-frame-id` 처럼 고정 낱말). */
  | { kind: 'rejected'; reason: string }
  /** 도우미가 꺼져 있거나 답이 없습니다. 들고 있다가 다시 보냅니다. */
  | { kind: 'offline' };

/** 봉투를 도우미로 보내는 출구입니다. 시험은 이 모양만 흉내 내면 됩니다. */
export interface FrameStorePort {
  store(message: FrameStoreMessage): Promise<FrameStoreOutcome>;
}

export interface NativeHostFrameSinkOptions {
  /** 도우미가 꺼져 있을 때 들고 있을 장 수의 상한입니다. 기본 60장(1초에 한 장이면 1분). */
  maxFallbackFrames?: number;
  /** 들고 있을 base64 글자 수의 상한입니다. 기본 24 MiB. */
  maxFallbackBytes?: number;
  /** 사람이 읽을 한 줄입니다. 기본은 `console.warn`. */
  warn?: (message: string) => void;
  /** 한 장이 실제로 들어갔을 때 부릅니다. 교시 통계(`frameCount`)를 세는 자리입니다. */
  onStored?: (result: { id: string; bytes: number; seq: number }) => void;
  /** 도우미가 거절했을 때 부릅니다. 사이드패널의 화면 커넥터를 호박색으로 두는 자리입니다. */
  onRejected?: (reason: string) => void;
}

export interface NativeHostFrameSinkStats extends FrameSinkStats {
  /** 이름표가 계약과 달라 보내지 못한 장 수입니다(누적). */
  skippedInvalid: number;
  /** 도우미가 거절한 장 수입니다(누적). */
  rejected: number;
  /** 지금 들고 있다가 다시 보낼 장 수입니다. */
  waiting: number;
  /** 다시 보내 성공한 장 수입니다(누적). */
  resent: number;
}

/**
 * 프레임을 **로컬 도우미로** 보내는 통입니다.
 *
 * ```text
 *   store(frame, bytes)
 *      │
 *      ├─ buildFrameStore 로 봉투 (1 MiB 넘으면 여기서 건너뜀 · skippedTooLarge)
 *      │
 *      └─▶ port.store(봉투)
 *              ├─ stored   ─▶ 셈만 하고 끝
 *              ├─ rejected ─▶ 셈 + 사람에게 한 줄 (다시 보내지 않습니다 · 같은 이유로 또 거절됩니다)
 *              └─ offline  ─▶ 메모리 폴백에 담아 둠 (상한을 넘으면 오래된 것부터 버림)
 *
 *   도우미가 돌아오면 flushWaiting() ──▶ 담아 둔 것을 담은 순서대로 다시 보냄
 * ```
 *
 * **왜 거절된 장은 다시 보내지 않는가**: 거절 이유는 `duplicate-frame`·`invalid-frame-id`
 * 처럼 봉투 자체의 문제라 몇 번을 보내도 같은 답이 옵니다. 반대로 `offline` 은 통로 문제라
 * 통로가 살아나면 그대로 성공합니다. 둘을 섞으면 못 들어갈 장이 대기열을 영원히 막습니다.
 *
 * 불변 원칙 §4-1: 이 통은 프레임을 **로컬 도우미** 한 곳으로만 보냅니다. 네트워크로 나가는
 * 코드가 없습니다.
 */
export class NativeHostFrameSink implements FrameSink {
  readonly maxFallbackFrames: number;
  readonly maxFallbackBytes: number;

  private readonly port: FrameStorePort;
  private readonly warn: (message: string) => void;
  private readonly onStored: (result: { id: string; bytes: number; seq: number }) => void;
  private readonly onRejected: (reason: string) => void;

  /** 도우미가 꺼져 있는 동안 들고 있는 봉투들입니다. 담은 순서 그대로입니다. */
  private waiting: FrameStoreMessage[] = [];
  /** 들고 있는 base64 글자 수입니다. 폴백 상한을 재는 자리입니다. */
  private waitingBytes = 0;
  /** 들고 있는 **원본** 바이트입니다. `stats().bytes` 가 이것을 냅니다(`MemoryFrameSink` 와 같은 단위). */
  private waitingRawBytes = 0;

  private storedCount = 0;
  private skippedTooLargeCount = 0;
  private skippedInvalidCount = 0;
  private rejectedCount = 0;
  private evictedCount = 0;
  private resentCount = 0;
  private flushing = false;

  constructor(port: FrameStorePort, options: NativeHostFrameSinkOptions = {}) {
    this.port = port;
    this.maxFallbackFrames = options.maxFallbackFrames ?? 60;
    this.maxFallbackBytes = options.maxFallbackBytes ?? 24 * 1024 * 1024;
    this.warn = options.warn ?? ((message) => console.warn(`[classmate] ${message}`));
    this.onStored = options.onStored ?? (() => {});
    this.onRejected = options.onRejected ?? (() => {});

    if (this.maxFallbackFrames <= 0 || this.maxFallbackBytes <= 0) {
      throw new RangeError('상한은 0 보다 커야 해요');
    }
  }

  async store(frame: ScreenFrame, bytes: Uint8Array): Promise<void> {
    let built: BuildFrameStoreResult;
    try {
      built = buildFrameStore(frame, bytes);
    } catch (error: unknown) {
      // 프레임·교시 이름표가 계약과 다릅니다(`assertScreenFrameId` · `assertPeriodId`).
      // 던지면 `store()` 의 약속이 거부되어 부르는 쪽이 오류를 떠안습니다. 한 장을 못 보낸
      // 것뿐이므로 크기 상한과 똑같이 **조용히 건너뛰고** 셉니다.
      this.skippedInvalidCount += 1;
      this.warn(
        `화면 한 장의 이름표가 계약과 달라 건너뜁니다 · ${error instanceof Error ? error.message : '알 수 없는 까닭'} · 건너뜀 누적 ${this.skippedInvalidCount}장`,
      );
      return;
    }
    if (built.skipped) {
      this.skippedTooLargeCount += 1;
      this.warn(
        `화면 한 장이 봉투 상한을 넘어 건너뜁니다 · ${built.envelopeBytes}바이트 · 건너뜀 누적 ${this.skippedTooLargeCount}장`,
      );
      return;
    }
    await this.deliver(built.message, false);
  }

  /**
   * 도우미가 돌아왔을 때 들고 있던 것을 다시 보냅니다.
   *
   * 다시 보내는 도중에 또 끊기면 남은 것을 **맨 앞에** 되돌립니다. 그 사이에 새로 들어온
   * 장은 그 뒤에 서야 화면 순서가 뒤집히지 않습니다. 그렇게 새로 들어온 장이 있으면 한
   * 바퀴 더 돌아 그것들도 보냅니다. 두 번 겹쳐 부르면 뒤엣것은 곧바로 돌아옵니다.
   */
  async flushWaiting(): Promise<void> {
    if (this.flushing || this.waiting.length === 0) return;
    this.flushing = true;
    try {
      while (this.waiting.length > 0) {
        const batch = this.waiting;
        this.waiting = [];
        this.waitingBytes = 0;
        this.waitingRawBytes = 0;
        this.warn(`도우미가 돌아와 들고 있던 화면 ${batch.length}장을 다시 보냅니다`);
        for (let i = 0; i < batch.length; i += 1) {
          const message = batch[i];
          if (message === undefined) continue;
          const delivered = await this.deliver(message, true);
          if (!delivered) {
            // 또 끊겼습니다. 이 장부터 남은 것을 순서 그대로 맨 앞에 되돌립니다.
            this.holdFront(batch.slice(i).filter((item) => item !== undefined));
            return;
          }
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  stats(): NativeHostFrameSinkStats {
    return {
      stored: this.storedCount,
      skippedTooLarge: this.skippedTooLargeCount,
      skippedInvalid: this.skippedInvalidCount,
      bytes: this.waitingRawBytes,
      frames: this.waiting.length,
      evicted: this.evictedCount,
      rejected: this.rejectedCount,
      waiting: this.waiting.length,
      resent: this.resentCount,
    };
  }

  /** 교시가 끝나면 들고 있던 것을 버립니다. 누적 통계는 그대로 둡니다. */
  clear(): void {
    this.waiting = [];
    this.waitingBytes = 0;
    this.waitingRawBytes = 0;
  }

  /**
   * @returns 도우미에 닿았으면 true, 꺼져 있어 들고 있게 됐으면 false 입니다.
   *
   * 다시 보내는 길(`isResend`)에서는 **여기서 담지 않습니다.** 실패한 장과 그 뒤의 것을
   * 한 덩어리로 맨 앞에 되돌리는 일은 `flushWaiting` 이 맡습니다.
   */
  private async deliver(message: FrameStoreMessage, isResend: boolean): Promise<boolean> {
    let outcome: FrameStoreOutcome;
    try {
      outcome = await this.port.store(message);
    } catch (error: unknown) {
      // 통로가 던지는 것은 통로 문제입니다. 들고 있다가 다시 보냅니다.
      this.warn(
        `화면 한 장을 보내지 못했어요 · ${error instanceof Error ? error.message : '알 수 없는 까닭'}`,
      );
      if (!isResend) this.hold(message);
      return false;
    }

    switch (outcome.kind) {
      case 'stored':
        this.storedCount += 1;
        if (isResend) this.resentCount += 1;
        this.onStored({ id: message.frame.id, bytes: outcome.bytes, seq: outcome.seq });
        return true;
      case 'rejected':
        this.rejectedCount += 1;
        this.warn(`도우미가 화면 한 장을 거절했어요 · ${outcome.reason}`);
        this.onRejected(outcome.reason);
        return true;
      case 'offline':
        if (!isResend) this.hold(message);
        return false;
    }
  }

  /** 봉투 하나를 뒤에 들고 있습니다. 상한을 넘으면 **오래된 것부터** 버립니다. */
  private hold(message: FrameStoreMessage): void {
    this.waiting.push(message);
    this.addBytes(message);
    this.trim();
  }

  /** 다시 보내다 실패한 것들을 **앞에** 되돌립니다. 순서를 지키는 자리입니다. */
  private holdFront(messages: FrameStoreMessage[]): void {
    this.waiting.unshift(...messages);
    for (const message of messages) this.addBytes(message);
    this.trim();
  }

  private addBytes(message: FrameStoreMessage): void {
    this.waitingBytes += message.bytesBase64.length;
    this.waitingRawBytes += base64ByteLength(message.bytesBase64);
  }

  private trim(): void {
    let dropped = 0;
    while (
      this.waiting.length > this.maxFallbackFrames ||
      (this.waiting.length > 1 && this.waitingBytes > this.maxFallbackBytes)
    ) {
      const removed = this.waiting.shift();
      if (removed === undefined) break;
      this.waitingBytes -= removed.bytesBase64.length;
      this.waitingRawBytes -= base64ByteLength(removed.bytesBase64);
      this.evictedCount += 1;
      dropped += 1;
    }
    if (dropped > 0) {
      this.warn(
        `도우미가 꺼져 있어 오래된 화면 ${dropped}장을 버렸어요 · 들고 있는 것 ${this.waiting.length}장 · 버린 것 누적 ${this.evictedCount}장`,
      );
    }
  }
}
