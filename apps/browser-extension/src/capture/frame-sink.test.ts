import { describe, expect, it } from 'vitest';
import type { ScreenFrame } from '@classmate/contracts';
import { MemoryFrameSink } from './frame-sink';
import { DEFAULT_MAX_DURATION_MS } from './frame-store';
import { MAX_MESSAGE_BYTES } from './host-messages';

const PERIOD = '2026-09-02-p3';
const HOUR_MS = 60 * 60 * 1000;

function frame(id: string, overrides: Partial<ScreenFrame> = {}): ScreenFrame {
  return {
    id,
    periodId: PERIOD,
    capturedAt: '2026-09-02T10:00:00.000Z',
    path: `frames/${id}.webp`,
    width: 1280,
    height: 720,
    hash: 'abcdef0123456789',
    changedFromPrev: true,
    source: 'meet-tab',
    ...overrides,
  };
}

/** 시험용 가짜 시계. 손으로 시간을 앞으로 돌립니다. */
function fakeClock(startMs: number) {
  let nowMs = startMs;
  return {
    now: () => nowMs,
    advance: (deltaMs: number) => {
      nowMs += deltaMs;
    },
  };
}

describe('MemoryFrameSink 기본 동작', () => {
  it('넘긴 장을 들고 있고 통계로 알려 줍니다', async () => {
    const sink = new MemoryFrameSink();

    await sink.store(frame('sf-001'), new Uint8Array(100));
    await sink.store(frame('sf-002'), new Uint8Array(250));

    expect(sink.stats()).toMatchObject({
      stored: 2,
      skippedTooLarge: 0,
      bytes: 350,
      frames: 2,
      evicted: 0,
    });
    expect(sink.list().map((entry) => entry.id)).toEqual(['sf-001', 'sf-002']);
  });

  it('path 는 확장이 준 문자열이 아니라 id 에서 다시 계산한 값입니다', async () => {
    const sink = new MemoryFrameSink();
    await sink.store(frame('sf-001', { path: '../../secret' }), new Uint8Array(10));

    expect(sink.list()[0]?.path).toBe('frames/sf-001.webp');
  });

  it('식별자 형식이 틀리면 통이 받지 않습니다', async () => {
    const sink = new MemoryFrameSink();
    await expect(sink.store(frame('bad-id'), new Uint8Array(10))).rejects.toThrow(RangeError);
    expect(sink.stats().stored).toBe(0);
  });

  it('바이트는 그대로 되찾을 수 있습니다', async () => {
    const sink = new MemoryFrameSink();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await sink.store(frame('sf-001'), bytes);

    expect(Array.from(sink.peek('sf-001') ?? new Uint8Array(0))).toEqual([1, 2, 3, 4]);
    expect(sink.peek('sf-999')).toBeNull();
  });

  it('clear 는 들고 있던 것만 비우고 누적 통계는 남깁니다', async () => {
    const sink = new MemoryFrameSink();
    await sink.store(frame('sf-001'), new Uint8Array(100));
    sink.clear();

    expect(sink.stats()).toMatchObject({ stored: 1, frames: 0, bytes: 0 });
  });
});

describe('MemoryFrameSink 1 MiB 가드', () => {
  it('봉투가 1 MiB 를 넘는 장은 담지 않고 세기만 합니다', async () => {
    const sink = new MemoryFrameSink();

    await sink.store(frame('sf-001'), new Uint8Array(1000));
    // base64 는 3바이트를 4글자로 늘리므로 1 MiB 바이트면 봉투는 확실히 넘습니다.
    await sink.store(frame('sf-002'), new Uint8Array(MAX_MESSAGE_BYTES));

    expect(sink.stats()).toMatchObject({
      stored: 1,
      skippedTooLarge: 1,
      frames: 1,
      bytes: 1000,
    });
    expect(sink.list().map((entry) => entry.id)).toEqual(['sf-001']);
  });
});

describe('MemoryFrameSink 60분 상한', () => {
  it('기본 나이 상한은 한 교시 60분입니다', () => {
    expect(new MemoryFrameSink().maxAgeMs).toBe(DEFAULT_MAX_DURATION_MS);
    expect(DEFAULT_MAX_DURATION_MS).toBe(HOUR_MS);
  });

  it('60분이 지난 장은 가짜 시계를 돌리면 사라집니다', async () => {
    const clock = fakeClock(Date.parse('2026-09-02T10:00:00.000Z'));
    const sink = new MemoryFrameSink({ now: clock.now });

    await sink.store(frame('sf-001'), new Uint8Array(10));
    clock.advance(30 * 60 * 1000);
    await sink.store(frame('sf-002'), new Uint8Array(10));
    expect(sink.stats().frames).toBe(2);

    // 첫 장에서 60분 1초가 지난 시점에 새 장이 들어오면 첫 장이 밀려납니다.
    clock.advance(30 * 60 * 1000 + 1000);
    await sink.store(frame('sf-003'), new Uint8Array(10));

    expect(sink.list().map((entry) => entry.id)).toEqual(['sf-002', 'sf-003']);
    expect(sink.stats()).toMatchObject({ stored: 3, frames: 2, evicted: 1, bytes: 20 });
  });

  it('나이 상한은 마지막 한 장도 남기지 않습니다 · 교시가 바뀐 것이니까요', async () => {
    const clock = fakeClock(0);
    const sink = new MemoryFrameSink({ now: clock.now, maxAgeMs: 1000 });

    await sink.store(frame('sf-001'), new Uint8Array(10));
    clock.advance(5000);
    await sink.store(frame('sf-002'), new Uint8Array(10));

    expect(sink.list().map((entry) => entry.id)).toEqual(['sf-002']);
    expect(sink.stats().evicted).toBe(1);
  });

  it('바이트 상한을 넘으면 오래된 것부터 버리되 마지막 한 장은 남깁니다', async () => {
    const sink = new MemoryFrameSink({ maxBytes: 300 });

    for (let i = 1; i <= 5; i += 1) {
      await sink.store(frame(`sf-00${i}`), new Uint8Array(100));
    }
    expect(sink.list().map((entry) => entry.id)).toEqual(['sf-003', 'sf-004', 'sf-005']);
    expect(sink.stats()).toMatchObject({ frames: 3, bytes: 300, evicted: 2 });

    const tight = new MemoryFrameSink({ maxBytes: 1 });
    await tight.store(frame('sf-001'), new Uint8Array(5000));
    expect(tight.stats().frames).toBe(1);
  });

  it('말이 안 되는 상한은 RangeError 로 막습니다', () => {
    expect(() => new MemoryFrameSink({ maxAgeMs: 0 })).toThrow(RangeError);
    expect(() => new MemoryFrameSink({ maxBytes: 0 })).toThrow(RangeError);
  });
});
