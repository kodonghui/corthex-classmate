import { describe, expect, it } from 'vitest';
import type { RgbaImage } from './dhash';
import { FrameStore } from './frame-store';
import { CapturePipeline } from './pipeline';
import type { EncodedFrame, FrameEncoder, FrameSource } from './pipeline';
import { codeFrameOptions, makeCodeFrame, makeFrame, makeSlideFrame, withNoise } from './synthetic-frame';

const WIDTH = 640;
const HEIGHT = 360;
const BASE_MS = Date.parse('2026-09-02T10:00:00.000Z');
/** 통을 만든 시각을 고정해 두면 id 가 `sf-p3-100000-001` 로 확정됩니다. */
const ID_PREFIX = 'sf-p3-100000-';

/** 부른 횟수를 세는 모의 인코더. Node 에는 OffscreenCanvas 가 없어서 이렇게 씁니다. */
class CountingEncoder implements FrameEncoder {
  calls = 0;
  readonly seen: RgbaImage[] = [];

  async encode(image: RgbaImage): Promise<EncodedFrame> {
    this.calls += 1;
    this.seen.push(image);
    return {
      bytes: 40_000,
      width: Math.min(1280, image.width),
      height: image.height,
      mime: 'image/webp',
    };
  }
}

/** 미리 정해 둔 프레임을 순서대로 내주는 공급자입니다. */
class ArraySource implements FrameSource {
  private index = 0;
  constructor(private readonly frames: RgbaImage[]) {}

  read(): RgbaImage | null {
    const frame = this.frames[this.index];
    this.index += 1;
    return frame ?? null;
  }
}

function newPipeline() {
  const store = new FrameStore({ periodId: '2026-09-02-p3', startedAt: BASE_MS });
  const encoder = new CountingEncoder();
  const pipeline = new CapturePipeline({ store, encoder });
  return { store, encoder, pipeline };
}

describe('CapturePipeline 샘플링 문은 여기 없습니다', () => {
  // 간격을 정하는 곳은 SamplingLoop 한 곳뿐입니다(sampling-loop.ts). 파이프라인이 간격을
  // 또 보면 타이머 지터로 회차가 통째로 버려져 실효 0.5fps 가 될 수 있어서 없앴습니다.
  it('200ms 만에 또 들어와도 버리지 않고 그대로 봅니다', async () => {
    const { encoder, pipeline } = newPipeline();

    const first = await pipeline.offer(makeCodeFrame(WIDTH, HEIGHT), BASE_MS);
    const soon = await pipeline.offer(makeSlideFrame(WIDTH, HEIGHT), BASE_MS + 200);

    expect(first.status).toBe('stored');
    expect(soon.status).toBe('stored');
    expect(encoder.calls).toBe(2);
    expect(pipeline.stats().offered).toBe(2);
  });

  it('시각이 아무리 촘촘해도 판정 기준은 화면 변화뿐입니다', async () => {
    const { encoder, pipeline } = newPipeline();
    const options = codeFrameOptions(WIDTH, HEIGHT);

    await pipeline.offer(makeFrame(options), BASE_MS);
    const same = await pipeline.offer(makeFrame(options), BASE_MS + 1);

    expect(same.status).toBe('unchanged');
    expect(encoder.calls).toBe(1);
  });
});

describe('CapturePipeline 변화 감지', () => {
  it('바뀌지 않은 장에는 인코더를 부르지 않습니다', async () => {
    const { store, encoder, pipeline } = newPipeline();
    const options = codeFrameOptions(WIDTH, HEIGHT);

    await pipeline.offer(makeFrame(options), BASE_MS);
    const same = await pipeline.offer(makeFrame(options), BASE_MS + 1000);
    const noisy = await pipeline.offer(withNoise(options, 12, 7), BASE_MS + 2000);

    expect(same.status).toBe('unchanged');
    expect(same.distance).toBe(0);
    expect(noisy.status).toBe('unchanged');

    // 첫 장 한 번만 인코딩했습니다. 불변 원칙 §4-4 의 "변경된 핵심 장면만" 입니다.
    expect(encoder.calls).toBe(1);
    expect(store.size).toBe(1);
    expect(pipeline.stats().changed).toBe(1);
  });

  it('화면이 바뀐 장만 인코딩해 통에 넣습니다', async () => {
    const { store, encoder, pipeline } = newPipeline();
    const options = codeFrameOptions(WIDTH, HEIGHT);

    const results = [
      await pipeline.offer(makeFrame(options), BASE_MS),
      await pipeline.offer(withNoise(options, 10, 1), BASE_MS + 1000),
      await pipeline.offer(makeSlideFrame(WIDTH, HEIGHT), BASE_MS + 2000),
      await pipeline.offer(makeSlideFrame(WIDTH, HEIGHT), BASE_MS + 3000),
      await pipeline.offer(makeCodeFrame(WIDTH, HEIGHT, 1), BASE_MS + 4000),
    ];

    expect(results.map((result) => result.status)).toEqual([
      'stored',
      'unchanged',
      'stored',
      'unchanged',
      'stored',
    ]);
    expect(encoder.calls).toBe(3);
    expect(store.size).toBe(3);
    expect(store.list().map((frame) => frame.id)).toEqual([
      `${ID_PREFIX}001`,
      `${ID_PREFIX}002`,
      `${ID_PREFIX}003`,
    ]);

    // 첫 장만 changedFromPrev 가 false 입니다. 견줄 앞 장이 없었기 때문입니다.
    expect(store.list().map((frame) => frame.changedFromPrev)).toEqual([false, true, true]);
  });

  it('통계에 처리 장 수·변화 수·평균 처리 시간이 담깁니다', async () => {
    const { pipeline } = newPipeline();
    const options = codeFrameOptions(WIDTH, HEIGHT);

    await pipeline.offer(makeFrame(options), BASE_MS);
    await pipeline.offer(makeFrame(options), BASE_MS + 1000); // 같은 화면이라 인코딩 안 함
    await pipeline.offer(makeSlideFrame(WIDTH, HEIGHT), BASE_MS + 2000);

    const stats = pipeline.stats();
    expect(stats.offered).toBe(3);
    expect(stats.changed).toBe(2);
    expect(stats.encoded).toBe(2);
    expect(stats.stored).toBe(2);
    expect(stats.averageProcessMs).toBeGreaterThan(0);
    expect(stats.averageHashMs).toBeGreaterThan(0);
    expect(stats.lastDistance).toBeGreaterThan(0);

    console.log(
      `[gate-b] 파이프라인 평균 처리 ${stats.averageProcessMs.toFixed(3)} ms · ` +
        `해시 ${stats.averageHashMs.toFixed(3)} ms (${WIDTH}x${HEIGHT})`,
    );
  });

  it('onFrame 은 통에 들어간 장만 알려 줍니다', async () => {
    const store = new FrameStore({ periodId: '2026-09-02-p3', startedAt: BASE_MS });
    const seen: string[] = [];
    const pipeline = new CapturePipeline({
      store,
      encoder: new CountingEncoder(),
      onFrame: (frame) => seen.push(frame.id),
    });
    const options = codeFrameOptions(WIDTH, HEIGHT);

    await pipeline.offer(makeFrame(options), BASE_MS);
    await pipeline.offer(makeFrame(options), BASE_MS + 1000);
    await pipeline.offer(makeSlideFrame(WIDTH, HEIGHT), BASE_MS + 2000);

    expect(seen).toEqual([`${ID_PREFIX}001`, `${ID_PREFIX}002`]);
  });

  it('reset 뒤 첫 장은 다시 기준이 됩니다', async () => {
    const { encoder, pipeline } = newPipeline();
    const options = codeFrameOptions(WIDTH, HEIGHT);

    await pipeline.offer(makeFrame(options), BASE_MS);
    pipeline.reset();
    const afterReset = await pipeline.offer(makeFrame(options), BASE_MS + 10);

    expect(afterReset.status).toBe('stored');
    expect(afterReset.distance).toBeNull();
    expect(encoder.calls).toBe(2);
  });
});

describe('CapturePipeline.pump', () => {
  it('공급자가 다 떨어지면 null 을 돌려줍니다', async () => {
    const { pipeline } = newPipeline();
    const source = new ArraySource([makeCodeFrame(WIDTH, HEIGHT), makeSlideFrame(WIDTH, HEIGHT)]);

    expect((await pipeline.pump(source, BASE_MS))?.status).toBe('stored');
    expect((await pipeline.pump(source, BASE_MS + 1000))?.status).toBe('stored');
    expect(await pipeline.pump(source, BASE_MS + 2000)).toBeNull();
  });
});
