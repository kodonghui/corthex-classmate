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
  /** 봉투를 하나 받을 때마다 부릅니다. 재전송 도중에 새 장을 끼워 넣는 자리입니다. */
  onSeen: ((message: FrameStoreMessage) => void) | null = null;

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
    // 결말을 **먼저** 집고 나서 알립니다. 순서가 반대이면 끼워 넣은 장이 이 봉투의 결말을
    // 가로챕니다.
    const outcome = this.outcomes.shift() ?? this.fallback;
    this.onSeen?.(message);
    return Promise.resolve(outcome);
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

  // ── storeAndReport ─────────────────────────────────────────────────────
  //
  // 질문에 붙일 화면은 "담아 두었다" 로는 부족합니다. 도우미가 파일로 남긴 장만
  // `snapshot.screenFrameId` 가 가리킬 수 있습니다(가리키면 그 파일이 있어야 합니다).

  it('storeAndReport 는 도우미가 파일로 남겼을 때만 true 입니다', async () => {
    const port = new FakePort().always({ kind: 'stored', bytes: 16, seq: 3 });
    const sink = new NativeHostFrameSink(port, { warn: () => {} });

    expect(await sink.storeAndReport(frame(1), bytes())).toBe(true);
  });

  it('storeAndReport 는 도우미가 꺼져 있으면 false 입니다 (장은 들고 있습니다)', async () => {
    const port = new FakePort().always({ kind: 'offline' });
    const sink = new NativeHostFrameSink(port, { warn: () => {} });

    expect(await sink.storeAndReport(frame(1), bytes())).toBe(false);
    // 버리지는 않습니다. 도우미가 돌아오면 그때 들어갑니다.
    expect(sink.stats()).toMatchObject({ waiting: 1, stored: 0 });
  });

  it('storeAndReport 는 도우미가 거절하면 false 입니다', async () => {
    const port = new FakePort().always({ kind: 'rejected', reason: 'duplicate-frame' });
    const sink = new NativeHostFrameSink(port, { warn: () => {} });

    expect(await sink.storeAndReport(frame(1), bytes())).toBe(false);
    expect(sink.stats()).toMatchObject({ rejected: 1, waiting: 0 });
  });

  it('storeAndReport 는 봉투가 상한을 넘으면 false 입니다', async () => {
    const port = new FakePort();
    const sink = new NativeHostFrameSink(port, { warn: () => {} });

    expect(await sink.storeAndReport(frame(1), new Uint8Array(800 * 1024))).toBe(false);
    expect(port.seen).toEqual([]);
  });

  it('storeAndReport 는 이름표가 계약과 달라도 던지지 않고 false 입니다', async () => {
    const port = new FakePort();
    const sink = new NativeHostFrameSink(port, { warn: () => {} });
    const broken = { ...frame(1), periodId: '3교시' };

    expect(await sink.storeAndReport(broken, bytes())).toBe(false);
    expect(port.seen).toEqual([]);
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

  it('다시 보내는 도중에 들어온 새 장이 남은 것보다 앞서지 않습니다', async () => {
    const port = new FakePort().always({ kind: 'offline' });
    const sink = new NativeHostFrameSink(port, { warn: () => {} });
    await sink.store(frame(1), bytes());
    await sink.store(frame(2), bytes());

    // 첫 장은 들어가고 둘째에서 또 끊깁니다. 그 사이에 새 장(3)이 들어옵니다.
    port.queue({ kind: 'stored', bytes: 16, seq: 1 }, { kind: 'offline' }).always({ kind: 'offline' });
    port.onSeen = (message) => {
      if (message.frame.id !== 'sf-p3-001') return;
      port.onSeen = null;
      void sink.store(frame(3), bytes());
    };
    await sink.flushWaiting();

    // 남은 둘째가 새로 들어온 셋째보다 먼저 서야 화면 순서가 뒤집히지 않습니다.
    port.always({ kind: 'stored', bytes: 16, seq: 2 });
    await sink.flushWaiting();
    expect(port.ids.slice(-2)).toEqual(['sf-p3-002', 'sf-p3-003']);
  });

  it('다시 보내는 도중에 새로 들어온 장도 같은 회차에 이어 보냅니다', async () => {
    const port = new FakePort().always({ kind: 'offline' });
    const sink = new NativeHostFrameSink(port, { warn: () => {} });
    await sink.store(frame(1), bytes());

    // 첫 장은 들어가고, 그 사이에 들어온 새 장은 마침 그때 또 끊겨 통에 담깁니다.
    port.queue({ kind: 'stored', bytes: 16, seq: 1 }, { kind: 'offline' }).always({
      kind: 'stored',
      bytes: 16,
      seq: 2,
    });
    port.onSeen = (message) => {
      if (message.frame.id !== 'sf-p3-001') return;
      port.onSeen = null;
      // 이 장은 통이 비어 있는 사이에 들어옵니다. 한 바퀴 더 돌지 않으면 다음 재연결까지
      // 갇힙니다.
      void sink.store(frame(2), bytes());
    };
    await sink.flushWaiting();

    expect(sink.stats()).toMatchObject({ waiting: 0 });
  });

  it('stats().bytes 는 원본 바이트입니다 (MemoryFrameSink 와 같은 단위)', async () => {
    const port = new FakePort().always({ kind: 'offline' });
    const sink = new NativeHostFrameSink(port, { warn: () => {} });

    await sink.store(frame(1), bytes(30));

    // base64 글자 수(40)가 아니라 원본 30바이트여야 두 통의 수를 견줄 수 있습니다.
    expect(sink.stats().bytes).toBe(30);
  });

  it('이름표가 계약과 다른 장은 던지지 않고 건너뜁니다', async () => {
    const warnings: string[] = [];
    const port = new FakePort();
    const sink = new NativeHostFrameSink(port, { warn: (line) => warnings.push(line) });

    // 교시 식별자가 계약 모양(2026-09-02-p3)이 아닙니다. 그대로 두면 호스트가 한 교시치
    // 프레임을 통째로 거절합니다.
    await expect(
      sink.store({ ...frame(1), periodId: '오늘-3교시' }, bytes()),
    ).resolves.toBeUndefined();
    // 프레임 식별자 쪽도 같습니다.
    await expect(sink.store({ ...frame(2), id: 'frame-2' }, bytes())).resolves.toBeUndefined();

    expect(port.seen).toEqual([]);
    expect(sink.stats()).toMatchObject({ skippedInvalid: 2, stored: 0, waiting: 0 });
    expect(warnings.filter((line) => line.includes('이름표'))).toHaveLength(2);
  });
});
