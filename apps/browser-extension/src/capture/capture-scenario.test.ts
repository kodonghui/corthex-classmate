/**
 * 시나리오 시험 — 합성 프레임 열 하나를 파이프라인 끝까지 흘려 봅니다.
 *
 * 실제 수업 탭은 열 수 없습니다(`tabCapture` 는 사용자 제스처가 필요하고 확장을 사람이
 * 로드해야 합니다). 그래서 지어낸 프레임을 재생하는 것이 이 단위의 e2e 입니다.
 * 한 시험 안에서 다음 다섯 가지를 **순서대로** 확인합니다.
 *
 *   1. 같은 화면 → 인코더도 통도 부르지 않는다 (불변 원칙 §4-4)
 *   2. 바뀐 화면 → WebP 를 굽고 통에 한 번 넣는다
 *   3. 봉투가 1 MiB 를 넘는 장 → 건너뛰고 통계에 센다
 *   4. 60분이 지난 장 → 메모리에서 사라진다
 *   5. 그 사이 계약 아홉 칸(ScreenFrame)은 계속 맞다
 */

import { describe, expect, it } from 'vitest';
import { createValidator, formatErrors } from '@classmate/contracts';
import type { ScreenFrame } from '@classmate/contracts';
import type { RgbaImage } from './dhash';
import { FrameStore, toScreenFrame } from './frame-store';
import { MemoryFrameSink } from './frame-sink';
import type { FrameSink } from './frame-sink';
import { MAX_MESSAGE_BYTES } from './host-messages';
import { CapturePipeline } from './pipeline';
import { codeFrameOptions, makeCodeFrame, makeFrame, makeSlideFrame, withNoise } from './synthetic-frame';
import { OffscreenWebpEncoder, WEBP_MIME } from './webp-encoder';
import type { EncoderSurface } from './webp-encoder';

const PERIOD = '2026-09-02-p3';
const WIDTH = 640;
const HEIGHT = 360;
const BASE_MS = Date.parse('2026-09-02T10:00:00.000Z');
/** 통을 만든 시각을 고정해 두면 id 가 `sf-p3-100000-001` 로 확정됩니다. */
const ID_PREFIX = 'sf-p3-100000-';

/** 실제로 그리지 않고 정해진 바이트만 돌려주는 그림판입니다. Node 에는 캔버스가 없습니다. */
class StubSurface implements EncoderSurface {
  readonly width: number;
  readonly height: number;
  bakes = 0;
  payload: Uint8Array<ArrayBuffer> = new Uint8Array(40_000);

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  putImage(_image: RgbaImage): void {
    // 그림을 실제로 옮기지 않습니다. 이 시험이 보는 것은 "언제 굽는가" 입니다.
  }

  drawScaledFrom(_source: EncoderSurface): void {
    // 같음.
  }

  async toBlob(type: string, quality: number): Promise<Blob> {
    this.bakes += 1;
    expect(type).toBe(WEBP_MIME);
    expect(quality).toBe(0.8);
    return new Blob([this.payload], { type: WEBP_MIME });
  }
}

/** 통을 감싸 부른 횟수를 세는 껍데기입니다. */
class CountingSink implements FrameSink {
  calls = 0;
  readonly seen: string[] = [];

  constructor(private readonly inner: MemoryFrameSink) {}

  async store(frame: ScreenFrame, bytes: Uint8Array): Promise<void> {
    this.calls += 1;
    this.seen.push(frame.id);
    await this.inner.store(frame, bytes);
  }
}

function fakeClock(startMs: number) {
  let nowMs = startMs;
  return {
    now: () => nowMs,
    advance: (deltaMs: number) => {
      nowMs += deltaMs;
    },
  };
}

function buildRig() {
  const surfaces: StubSurface[] = [];
  const clock = fakeClock(BASE_MS);
  const memory = new MemoryFrameSink({ now: clock.now });
  const sink = new CountingSink(memory);

  const store = new FrameStore({ periodId: PERIOD, source: 'meet-tab', startedAt: BASE_MS });
  const encoder = new OffscreenWebpEncoder({
    includePayload: true,
    createSurface: (width, height) => {
      const surface = new StubSurface(width, height);
      surfaces.push(surface);
      return surface;
    },
  });

  // Offscreen 문서가 하는 것과 같은 배선입니다: 통에 들어간 장만 sink 로 보냅니다.
  const pipeline = new CapturePipeline({
    store,
    encoder,
    onFrame: (frame, encoded) => {
      void sink.store(toScreenFrame(frame), encoded.payload ?? new Uint8Array(0));
    },
  });

  return { surfaces, clock, memory, sink, store, pipeline };
}

describe('합성 프레임 시나리오', () => {
  it('동일 → 변화 → 동일 열에서 바뀐 장만 굽고 담습니다', async () => {
    const { surfaces, sink, memory, pipeline } = buildRig();
    const code = codeFrameOptions(WIDTH, HEIGHT);

    // (1) 첫 장. 견줄 앞 장이 없으므로 무조건 담습니다.
    const first = await pipeline.offer(makeFrame(code), BASE_MS);
    expect(first.status).toBe('stored');
    expect(sink.calls).toBe(1);

    // (2) 완전히 같은 장 · 잡음만 얹은 장 → 굽지도 담지도 않습니다.
    const same = await pipeline.offer(makeFrame(code), BASE_MS + 1000);
    const noisy = await pipeline.offer(withNoise(code, 12, 20260902), BASE_MS + 2000);
    expect([same.status, noisy.status]).toEqual(['unchanged', 'unchanged']);
    expect(sink.calls).toBe(1);
    expect(surfaces[0]?.bakes).toBe(1);

    // (3) 슬라이드로 바뀜 → 한 번 더 굽고 담습니다.
    const changed = await pipeline.offer(makeSlideFrame(WIDTH, HEIGHT), BASE_MS + 3000);
    expect(changed.status).toBe('stored');
    expect(sink.calls).toBe(2);
    expect(surfaces[0]?.bakes).toBe(2);

    // (4) 다시 같은 슬라이드 → 그대로 넘어갑니다.
    const still = await pipeline.offer(makeSlideFrame(WIDTH, HEIGHT), BASE_MS + 4000);
    expect(still.status).toBe('unchanged');
    expect(sink.calls).toBe(2);

    // (5) 다른 코드 배치 → 세 번째 장.
    const back = await pipeline.offer(makeCodeFrame(WIDTH, HEIGHT, 1), BASE_MS + 5000);
    expect(back.status).toBe('stored');
    expect(sink.calls).toBe(3);
    expect(sink.seen).toEqual([`${ID_PREFIX}001`, `${ID_PREFIX}002`, `${ID_PREFIX}003`]);

    expect(pipeline.stats()).toMatchObject({ offered: 6, changed: 3, encoded: 3, stored: 3 });
    expect(memory.stats()).toMatchObject({
      stored: 3,
      skippedTooLarge: 0,
      frames: 3,
      bytes: 40_000 * 3,
    });

    // 담긴 장은 계약 아홉 칸을 그대로 지킵니다.
    const validate = createValidator<ScreenFrame>('screen-frame');
    for (const record of memory.list()) {
      expect(validate(record), formatErrors(validate.errors).join(' · ')).toBe(true);
      expect(record.path).toBe(`frames/${record.id}.webp`);
    }
  });

  it('1 MiB 를 넘는 장은 건너뛰고, 60분이 지난 장은 사라집니다', async () => {
    const { surfaces, clock, memory, sink, pipeline } = buildRig();

    // 먼저 보통 크기 한 장을 담아 그림판을 만들어 둡니다.
    await pipeline.offer(makeCodeFrame(WIDTH, HEIGHT, 0), BASE_MS);
    expect(memory.stats()).toMatchObject({ stored: 1, frames: 1 });

    // (3) 이번에 구울 바이트만 1 MiB 로 키웁니다. base64 는 3바이트를 4글자로 늘리므로
    //     봉투는 확실히 상한을 넘고, 그 장은 담기지 않습니다. 캡처는 멈추지 않습니다.
    const surface = surfaces[0];
    if (!surface) throw new Error('그림판이 만들어져야 합니다');
    surface.payload = new Uint8Array(MAX_MESSAGE_BYTES);

    const huge = await pipeline.offer(makeSlideFrame(WIDTH, HEIGHT), BASE_MS + 1000);
    expect(huge.status).toBe('stored'); // 파이프라인은 담았지만
    expect(sink.calls).toBe(2);
    expect(memory.stats()).toMatchObject({ stored: 1, skippedTooLarge: 1, frames: 1 });

    // (4) 60분 1초가 지난 뒤 새 장이 들어오면 옛 장은 메모리에서 사라집니다.
    surface.payload = new Uint8Array(1024);
    clock.advance(60 * 60 * 1000 + 1000);
    await pipeline.offer(makeCodeFrame(WIDTH, HEIGHT, 1), BASE_MS + 60 * 60 * 1000 + 1000);

    expect(memory.list().map((record) => record.id)).toEqual([`${ID_PREFIX}003`]);
    expect(memory.stats()).toMatchObject({
      stored: 2,
      skippedTooLarge: 1,
      frames: 1,
      evicted: 1,
      bytes: 1024,
    });
  });
});
