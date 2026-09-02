import { describe, expect, it } from 'vitest';
import type { RgbaImage } from './dhash';
import { makeCodeFrame } from './synthetic-frame';
import {
  OffscreenWebpEncoder,
  TARGET_WIDTH,
  WEBP_MIME,
  WEBP_QUALITY,
} from './webp-encoder';
import type { EncoderSurface } from './webp-encoder';

/**
 * 가짜 그림판.
 *
 * Node 에는 `OffscreenCanvas` 도 `ImageData` 도 없습니다. 전역을 덮어쓰지 않고 생성자
 * 인자로 넣습니다(전역을 건드리면 시험 순서에 따라 결과가 흔들립니다). 이 그림판은
 * 실제로 그리지 않고 **무엇을 시켰는지만 적어 둡니다.**
 */
class FakeSurface implements EncoderSurface {
  readonly puts: RgbaImage[] = [];
  readonly drawnFrom: EncoderSurface[] = [];
  readonly blobCalls: { type: string; quality: number }[] = [];

  /** `toBlob` 이 돌려줄 바이트입니다. 시험마다 바꿔 끼웁니다. */
  payload: Uint8Array<ArrayBuffer> = new Uint8Array([82, 73, 70, 70]); // 'RIFF'
  /** `toBlob` 이 돌려줄 형식입니다. WebP 를 못 만드는 브라우저를 흉내 낼 때 바꿉니다. */
  blobType: string = WEBP_MIME;

  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  putImage(image: RgbaImage): void {
    this.puts.push(image);
  }

  drawScaledFrom(source: EncoderSurface): void {
    this.drawnFrom.push(source);
  }

  async toBlob(type: string, quality: number): Promise<Blob> {
    this.blobCalls.push({ type, quality });
    return new Blob([this.payload], { type: this.blobType });
  }
}

/** 만들어진 그림판을 전부 모아 두는 공장입니다. */
function makeFactory() {
  const made: FakeSurface[] = [];
  const createSurface = (width: number, height: number): EncoderSurface => {
    const surface = new FakeSurface(width, height);
    made.push(surface);
    return surface;
  };
  return { made, createSurface };
}

describe('OffscreenWebpEncoder 크기', () => {
  it('폭 1280 을 넘으면 비율을 지키며 줄입니다', async () => {
    const { made, createSurface } = makeFactory();
    const encoder = new OffscreenWebpEncoder({ createSurface });

    const encoded = await encoder.encode(makeCodeFrame(1920, 1080));

    expect(encoded.width).toBe(TARGET_WIDTH);
    expect(encoded.height).toBe(720); // 1080 * (1280/1920) = 720
    expect(encoded.mime).toBe(WEBP_MIME);

    // 원본 그림판 한 장 + 줄인 그림판 한 장.
    expect(made.map((surface) => [surface.width, surface.height])).toEqual([
      [1920, 1080],
      [1280, 720],
    ]);
    expect(made[0]?.puts).toHaveLength(1);
    expect(made[1]?.drawnFrom).toEqual([made[0]]);
    // 구울 때는 줄인 쪽만 굽습니다.
    expect(made[0]?.blobCalls).toHaveLength(0);
    expect(made[1]?.blobCalls).toHaveLength(1);
  });

  it('폭이 이미 1280 이하면 늘리지 않고 그대로 굽습니다', async () => {
    const { made, createSurface } = makeFactory();
    const encoder = new OffscreenWebpEncoder({ createSurface });

    const encoded = await encoder.encode(makeCodeFrame(800, 600));

    expect([encoded.width, encoded.height]).toEqual([800, 600]);
    expect(made).toHaveLength(1); // 줄일 그림판을 만들지 않았습니다.
    expect(made[0]?.blobCalls).toHaveLength(1);
  });

  it('목표 폭을 바꾸면 그 폭으로 줄입니다', async () => {
    const { made, createSurface } = makeFactory();
    const encoder = new OffscreenWebpEncoder({ createSurface, targetWidth: 640 });

    const encoded = await encoder.encode(makeCodeFrame(1280, 720));

    expect([encoded.width, encoded.height]).toEqual([640, 360]);
    expect(made[1]?.width).toBe(640);
  });

  it('같은 크기 프레임을 이어서 인코딩하면 그림판을 다시 만들지 않습니다', async () => {
    const { made, createSurface } = makeFactory();
    const encoder = new OffscreenWebpEncoder({ createSurface });

    await encoder.encode(makeCodeFrame(1920, 1080));
    await encoder.encode(makeCodeFrame(1920, 1080, 1));

    expect(made).toHaveLength(2); // 원본 한 장 · 줄인 한 장, 재사용됨
    expect(made[0]?.puts).toHaveLength(2);
    expect(made[1]?.blobCalls).toHaveLength(2);
  });
});

describe('OffscreenWebpEncoder 형식과 품질', () => {
  it('image/webp · 품질 0.8 로 굽습니다', async () => {
    const { made, createSurface } = makeFactory();
    const encoder = new OffscreenWebpEncoder({ createSurface });

    await encoder.encode(makeCodeFrame(1280, 720));

    expect(made[0]?.blobCalls).toEqual([{ type: 'image/webp', quality: WEBP_QUALITY }]);
    expect(WEBP_QUALITY).toBe(0.8);
  });

  it('품질을 바꾸면 그 값으로 굽습니다', async () => {
    const { made, createSurface } = makeFactory();
    const encoder = new OffscreenWebpEncoder({ createSurface, quality: 0.5 });

    await encoder.encode(makeCodeFrame(640, 360));

    expect(made[0]?.blobCalls[0]?.quality).toBe(0.5);
  });

  it('WebP 가 아닌 형식이 나오면 조용히 넘어가지 않고 던집니다', async () => {
    const { made, createSurface } = makeFactory();
    const encoder = new OffscreenWebpEncoder({ createSurface });

    // 첫 인코딩으로 그림판을 만들어 둔 뒤 형식만 바꿉니다.
    await encoder.encode(makeCodeFrame(640, 360));
    const surface = made[0];
    if (!surface) throw new Error('그림판이 만들어져야 합니다');
    surface.blobType = 'image/png';

    await expect(encoder.encode(makeCodeFrame(640, 360))).rejects.toThrow(/WebP/);
  });

  it('바이트 수는 언제나 세고, includePayload 일 때만 바이트를 돌려줍니다', async () => {
    const bytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 87, 69, 66, 80]);

    const counting = makeFactory();
    const countingEncoder = new OffscreenWebpEncoder({ createSurface: counting.createSurface });
    const madeCounting = counting.made;
    const first = await countingEncoder.encode(makeCodeFrame(640, 360));
    expect(first.bytes).toBe(madeCounting[0]?.payload.byteLength);
    expect(first.payload).toBeUndefined();

    const carrying = makeFactory();
    const carryingEncoder = new OffscreenWebpEncoder({
      createSurface: carrying.createSurface,
      includePayload: true,
    });
    // 첫 인코딩으로 그림판을 만든 뒤 바이트를 갈아 끼우고 다시 굽습니다.
    await carryingEncoder.encode(makeCodeFrame(640, 360));
    const surface = carrying.made[0];
    if (!surface) throw new Error('그림판이 만들어져야 합니다');
    surface.payload = bytes;

    const second = await carryingEncoder.encode(makeCodeFrame(640, 360));
    expect(second.bytes).toBe(bytes.byteLength);
    expect(Array.from(second.payload ?? new Uint8Array(0))).toEqual(Array.from(bytes));
  });
});

describe('OffscreenWebpEncoder 설정 확인', () => {
  it('말이 안 되는 폭·품질은 RangeError 로 막습니다', () => {
    const { createSurface } = makeFactory();
    expect(() => new OffscreenWebpEncoder({ createSurface, targetWidth: 0 })).toThrow(RangeError);
    expect(() => new OffscreenWebpEncoder({ createSurface, targetWidth: 1280.5 })).toThrow(
      RangeError,
    );
    expect(() => new OffscreenWebpEncoder({ createSurface, quality: 0 })).toThrow(RangeError);
    expect(() => new OffscreenWebpEncoder({ createSurface, quality: 1.5 })).toThrow(RangeError);
  });

  it('아무 설정도 주지 않으면 폭 1280 · 품질 0.8 입니다', () => {
    const encoder = new OffscreenWebpEncoder();
    expect(encoder.targetWidth).toBe(1280);
    expect(encoder.quality).toBe(0.8);
    expect(encoder.includePayload).toBe(false);
  });
});
