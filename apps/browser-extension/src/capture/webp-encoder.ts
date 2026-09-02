/**
 * 브라우저용 WebP 인코더. Offscreen 문서 안에서만 씁니다.
 *
 * 규칙 (불변 원칙 §4-4 · master-prompt §3-6 "프레임 크기 상한"):
 *   - 폭 1280px 로 줄인다(원본이 더 좁으면 그대로 둔다. 늘리지 않는다).
 *   - `image/webp` · 품질 0.8 로 인코딩한다.
 *   - 영상 컨테이너를 만들지 않는다. 장면 한 장이 파일 한 개다.
 *
 * `OffscreenCanvas.convertToBlob` 은 워커·Offscreen 문서에서 쓸 수 있고, WebP 를 못 만드는
 * 브라우저에서는 조용히 PNG 를 돌려줍니다. 그래서 결과 blob 의 `type` 을 확인해
 * 다르면 던집니다. "될 겁니다" 대신 실패를 눈에 보이게 하려는 것입니다.
 *
 * **그림판을 인터페이스로 뽑아 둔 이유**: Node(Vitest)에는 `OffscreenCanvas` 도 `ImageData` 도
 * 없습니다. 전역을 가짜로 덮어쓰면 시험이 전역 상태에 기대게 되고 순서에 따라 흔들립니다.
 * 그래서 인코더가 그림판에게 시키는 일 네 가지(`putImage` · `drawScaledFrom` · `toBlob` ·
 * 크기 읽기)만 `EncoderSurface` 로 뽑고, 브라우저 구현을 기본값으로 두었습니다. 시험은
 * 생성자 인자로 가짜 그림판을 넣습니다. 브라우저에서 도는 코드 경로는 그대로입니다.
 */

import type { RgbaImage } from './dhash';
import type { EncodedFrame, FrameEncoder } from './pipeline';

/** 저장할 프레임의 최대 가로 픽셀 수입니다. */
export const TARGET_WIDTH = 1280;

/** WebP 품질. 0~1 범위이고 80% 를 씁니다. */
export const WEBP_QUALITY = 0.8;

export const WEBP_MIME = 'image/webp';

/** 인코더가 그림판에게 시키는 일 전부입니다. 이것 말고는 아무것도 부르지 않습니다. */
export interface EncoderSurface {
  readonly width: number;
  readonly height: number;
  /** 원본 픽셀을 이 그림판 왼쪽 위에 그대로 얹습니다. */
  putImage(image: RgbaImage): void;
  /** 다른 그림판의 그림을 이 그림판 크기에 맞춰 줄여 그립니다. */
  drawScaledFrom(source: EncoderSurface): void;
  /** 지금 그려진 그림을 blob 으로 굽습니다. */
  toBlob(type: string, quality: number): Promise<Blob>;
}

/** 크기를 주면 그림판 하나를 만들어 주는 함수입니다. */
export type EncoderSurfaceFactory = (width: number, height: number) => EncoderSurface;

/** 브라우저 구현. `OffscreenCanvas` 한 장과 재활용하는 `ImageData` 한 개를 들고 있습니다. */
class OffscreenCanvasSurface implements EncoderSurface {
  readonly canvas: OffscreenCanvas;

  private readonly context: OffscreenCanvasRenderingContext2D;
  private scratch: ImageData | null = null;

  constructor(width: number, height: number) {
    this.canvas = new OffscreenCanvas(width, height);
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('OffscreenCanvas 2d 문맥을 열지 못했어요');
    }
    this.context = context;
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  /**
   * 들어온 배열을 그대로 감싸지 않고 한 번 복사합니다. `ImageData` 생성자는 배열이 반드시
   * 보통의 ArrayBuffer 위에 있어야 하는데, 파이프라인에 들어오는 배열이 어디서 왔는지는
   * 이 클래스가 알 수 없기 때문입니다. 크기가 같으면 같은 `ImageData` 를 다시 써서
   * 프레임마다 새로 만들지 않습니다.
   */
  putImage(image: RgbaImage): void {
    if (!this.scratch || this.scratch.width !== image.width || this.scratch.height !== image.height) {
      this.scratch = new ImageData(image.width, image.height);
    }
    this.scratch.data.set(image.data.subarray(0, this.scratch.data.length));
    this.context.putImageData(this.scratch, 0, 0);
  }

  drawScaledFrom(source: EncoderSurface): void {
    if (!(source instanceof OffscreenCanvasSurface)) {
      throw new TypeError('브라우저 그림판은 같은 종류의 그림판에서만 옮겨 그릴 수 있어요');
    }
    this.context.drawImage(source.canvas, 0, 0, this.width, this.height);
  }

  toBlob(type: string, quality: number): Promise<Blob> {
    return this.canvas.convertToBlob({ type, quality });
  }
}

/** 기본 그림판 공장입니다. Offscreen 문서·워커에서만 실제로 부를 수 있습니다. */
export const createOffscreenSurface: EncoderSurfaceFactory = (width, height) =>
  new OffscreenCanvasSurface(width, height);

export interface WebpEncoderOptions {
  targetWidth?: number;
  quality?: number;
  /** true 면 실제 WebP 바이트도 함께 돌려줍니다. 기본은 바이트 수만 셉니다. */
  includePayload?: boolean;
  /** 그림판 공장. 시험에서 가짜 그림판을 넣는 자리입니다. 기본은 `OffscreenCanvas`. */
  createSurface?: EncoderSurfaceFactory;
}

export class OffscreenWebpEncoder implements FrameEncoder {
  readonly targetWidth: number;
  readonly quality: number;
  readonly includePayload: boolean;

  private readonly createSurface: EncoderSurfaceFactory;
  private sourceSurface: EncoderSurface | null = null;
  private targetSurface: EncoderSurface | null = null;

  constructor(options: WebpEncoderOptions = {}) {
    this.targetWidth = options.targetWidth ?? TARGET_WIDTH;
    this.quality = options.quality ?? WEBP_QUALITY;
    this.includePayload = options.includePayload ?? false;
    this.createSurface = options.createSurface ?? createOffscreenSurface;

    if (!Number.isInteger(this.targetWidth) || this.targetWidth <= 0) {
      throw new RangeError('목표 가로 크기는 1 이상의 정수여야 해요');
    }
    if (!Number.isFinite(this.quality) || this.quality <= 0 || this.quality > 1) {
      throw new RangeError('품질은 0 보다 크고 1 이하인 숫자여야 해요');
    }
  }

  async encode(image: RgbaImage): Promise<EncodedFrame> {
    const scale = image.width > this.targetWidth ? this.targetWidth / image.width : 1;
    const outWidth = Math.max(1, Math.round(image.width * scale));
    const outHeight = Math.max(1, Math.round(image.height * scale));

    const source = this.ensureSource(image.width, image.height);
    source.putImage(image);

    let output = source;
    if (scale !== 1) {
      const target = this.ensureTarget(outWidth, outHeight);
      target.drawScaledFrom(source);
      output = target;
    }

    const blob = await output.toBlob(WEBP_MIME, this.quality);
    if (blob.type !== WEBP_MIME) {
      throw new Error(`이 브라우저가 WebP 를 만들지 못했어요 (받은 형식 ${blob.type})`);
    }

    const encoded: EncodedFrame = {
      bytes: blob.size,
      width: outWidth,
      height: outHeight,
      mime: WEBP_MIME,
    };
    if (this.includePayload) {
      encoded.payload = new Uint8Array(await blob.arrayBuffer());
    }
    return encoded;
  }

  private ensureSource(width: number, height: number): EncoderSurface {
    if (!this.sourceSurface || this.sourceSurface.width !== width || this.sourceSurface.height !== height) {
      this.sourceSurface = this.createSurface(width, height);
    }
    return this.sourceSurface;
  }

  private ensureTarget(width: number, height: number): EncoderSurface {
    if (!this.targetSurface || this.targetSurface.width !== width || this.targetSurface.height !== height) {
      this.targetSurface = this.createSurface(width, height);
    }
    return this.targetSurface;
  }
}
