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
import { buildFrameStore } from './host-messages';
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
