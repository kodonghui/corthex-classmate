/**
 * `NativeHostFrameSink` 의 시험입니다.
 *
 * 통 자체는 `src/capture/frame-sink.ts` 에 있지만 시험은 여기 둡니다. 1라운드 시험 파일
 * `src/capture/frame-sink.test.ts` 는 캡처 단위 소유라 이 단위가 고치지 않기로 했고,
 * 다시 보내기·폴백 판정은 서비스 워커 쪽 성질이기 때문입니다.
 */

import { describe, expect, it } from 'vitest';

import type { ScreenFrame } from '@classmate/contracts';
import type { FrameStoreOutcome, FrameStorePort } from '../capture/frame-sink';
import { NativeHostFrameSink } from '../capture/frame-sink';
import type { FrameStoreMessage } from '../capture/host-messages';

const PERIOD = '2026-09-02-p3';

function frame(index: number): ScreenFrame {
  const id = `sf-p3-${String(index).padStart(3, '0')}`;
  return {
    id,
    periodId: PERIOD,
    capturedAt: '2026-09-02T10:32:18+09:00',
    path: `frames/${id}.webp`,
    width: 1280,
    height: 720,
    hash: 'a1b2c3d4',
    changedFromPrev: true,
    source: 'meet-tab',
  };
}

function bytes(size = 16): Uint8Array {
  return new Uint8Array(size).fill(7);
}

/** 결말을 시험이 정해 주는 가짜 출구입니다. */
class FakePort implements FrameStorePort {
  readonly seen: FrameStoreMessage[] = [];
  private outcomes: FrameStoreOutcome[] = [];
  private fallback: FrameStoreOutcome = { kind: 'stored', bytes: 16, seq: 1 };
  private throwOnce = false;

  queue(...outcomes: FrameStoreOutcome[]): this {
    this.outcomes.push(...outcomes);
    return this;
  }

  always(outcome: FrameStoreOutcome): this {
    this.fallback = outcome;
    return this;
  }

  failOnce(): this {
    this.throwOnce = true;
    return this;
  }

  store(message: FrameStoreMessage): Promise<FrameStoreOutcome> {
    this.seen.push(message);
    if (this.throwOnce) {
      this.throwOnce = false;
      return Promise.reject(new Error('Attempting to use a disconnected port object'));
    }
    return Promise.resolve(this.outcomes.shift() ?? this.fallback);
  }

  /** 본 봉투들의 프레임 id 만입니다. */
  get ids(): string[] {
    return this.seen.map((message) => message.frame.id);
  }
}

describe('NativeHostFrameSink', () => {
  it('봉투를 만들어 도우미로 보내고 성공을 셉니다', async () => {
    const port = new FakePort();
    const stored: string[] = [];
    const sink = new NativeHostFrameSink(port, {
      warn: () => {},
      onStored: (result) => stored.push(result.id),
    });

    await sink.store(frame(1), bytes());

    expect(port.ids).toEqual(['sf-p3-001']);
    expect(port.seen[0]?.type).toBe('frame.store');
    // 경로는 확장이 준 문자열이 아니라 id 에서 다시 계산한 값입니다(Gate D 결정).
    expect(port.seen[0]?.frame.path).toBe('frames/sf-p3-001.webp');
    expect(stored).toEqual(['sf-p3-001']);
    expect(sink.stats()).toMatchObject({ stored: 1, waiting: 0, rejected: 0 });
  });

  it('1 MiB 를 넘는 봉투는 보내지 않고 건너뜁니다', async () => {
    const port = new FakePort();
    const sink = new NativeHostFrameSink(port, { warn: () => {} });

    // base64 는 3바이트를 4글자로 적으므로 1 MiB 를 넘기려면 원본이 786 KiB 남짓이면 됩니다.
    await sink.store(frame(1), new Uint8Array(800 * 1024));

    expect(port.seen).toEqual([]);
    expect(sink.stats()).toMatchObject({ skippedTooLarge: 1, stored: 0 });
  });

  it('도우미가 꺼져 있으면 메모리에 들고 있다가 돌아오면 순서대로 다시 보냅니다', async () => {
    const port = new FakePort().always({ kind: 'offline' });
    const sink = new NativeHostFrameSink(port, { warn: () => {} });

    await sink.store(frame(1), bytes());
    await sink.store(frame(2), bytes());
    expect(sink.stats()).toMatchObject({ waiting: 2, stored: 0 });

    port.always({ kind: 'stored', bytes: 16, seq: 10 });
    await sink.flushWaiting();

    expect(port.ids).toEqual(['sf-p3-001', 'sf-p3-002', 'sf-p3-001', 'sf-p3-002']);
    expect(sink.stats()).toMatchObject({ waiting: 0, stored: 2, resent: 2 });
  });

  it('다시 보내는 도중에 또 끊기면 남은 것을 순서 그대로 들고 있습니다', async () => {
    const port = new FakePort().always({ kind: 'offline' });
    const sink = new NativeHostFrameSink(port, { warn: () => {} });
    await sink.store(frame(1), bytes());
    await sink.store(frame(2), bytes());
    await sink.store(frame(3), bytes());

    port.queue({ kind: 'stored', bytes: 16, seq: 1 }, { kind: 'offline' }).always({ kind: 'offline' });
    await sink.flushWaiting();

    expect(sink.stats()).toMatchObject({ waiting: 2, stored: 1 });

    port.always({ kind: 'stored', bytes: 16, seq: 2 });
    await sink.flushWaiting();
    // 두 번째 회차에 남은 둘이 순서대로 갑니다.
    expect(port.ids.slice(-2)).toEqual(['sf-p3-002', 'sf-p3-003']);
  });

  it('폴백 상한을 넘으면 오래된 장부터 버립니다', async () => {
    const warnings: string[] = [];
    const port = new FakePort().always({ kind: 'offline' });
    const sink = new NativeHostFrameSink(port, { maxFallbackFrames: 2, warn: (m) => warnings.push(m) });

    await sink.store(frame(1), bytes());
    await sink.store(frame(2), bytes());
    await sink.store(frame(3), bytes());

    expect(sink.stats()).toMatchObject({ waiting: 2, evicted: 1 });
    expect(warnings.some((line) => line.includes('오래된 화면'))).toBe(true);

    port.always({ kind: 'stored', bytes: 16, seq: 1 });
    await sink.flushWaiting();
    expect(port.ids.slice(-2)).toEqual(['sf-p3-002', 'sf-p3-003']);
  });

  it('거절당한 장은 다시 보내지 않습니다 (같은 이유로 또 거절됩니다)', async () => {
    const rejections: string[] = [];
    const port = new FakePort().always({ kind: 'rejected', reason: 'duplicate-frame' });
    const sink = new NativeHostFrameSink(port, { warn: () => {}, onRejected: (r) => rejections.push(r) });

    await sink.store(frame(1), bytes());
    await sink.flushWaiting();

    expect(port.ids).toEqual(['sf-p3-001']);
    expect(rejections).toEqual(['duplicate-frame']);
    expect(sink.stats()).toMatchObject({ rejected: 1, waiting: 0, stored: 0 });
  });

  it('통로가 던져도 캡처를 멈추지 않고 들고 있습니다', async () => {
    const port = new FakePort().failOnce();
    const sink = new NativeHostFrameSink(port, { warn: () => {} });

    await expect(sink.store(frame(1), bytes())).resolves.toBeUndefined();
    expect(sink.stats()).toMatchObject({ waiting: 1 });
  });

  it('교시가 바뀌면 들고 있던 것을 버립니다', async () => {
    const port = new FakePort().always({ kind: 'offline' });
    const sink = new NativeHostFrameSink(port, { warn: () => {} });
    await sink.store(frame(1), bytes());

    sink.clear();

    expect(sink.stats()).toMatchObject({ waiting: 0 });
  });

  it('상한은 0 보다 커야 합니다', () => {
    expect(() => new NativeHostFrameSink(new FakePort(), { maxFallbackFrames: 0 })).toThrow(RangeError);
  });
});
