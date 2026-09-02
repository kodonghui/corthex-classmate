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
 */

import type { RgbaImage } from './dhash';
import type { EncodedFrame, FrameEncoder } from './pipeline';

/** 저장할 프레임의 최대 가로 픽셀 수입니다. */
export const TARGET_WIDTH = 1280;

/** WebP 품질. 0~1 범위이고 80% 를 씁니다. */
export const WEBP_QUALITY = 0.8;

export const WEBP_MIME = 'image/webp';

export interface WebpEncoderOptions {
  targetWidth?: number;
  quality?: number;
  /** true 면 실제 WebP 바이트도 함께 돌려줍니다. 기본은 바이트 수만 셉니다. */
  includePayload?: boolean;
}

export class OffscreenWebpEncoder implements FrameEncoder {
  readonly targetWidth: number;
  readonly quality: number;
  readonly includePayload: boolean;

  private sourceCanvas: OffscreenCanvas | null = null;
  private targetCanvas: OffscreenCanvas | null = null;
  private scratch: ImageData | null = null;

  constructor(options: WebpEncoderOptions = {}) {
    this.targetWidth = options.targetWidth ?? TARGET_WIDTH;
    this.quality = options.quality ?? WEBP_QUALITY;
    this.includePayload = options.includePayload ?? false;
  }

  async encode(image: RgbaImage): Promise<EncodedFrame> {
    const scale = image.width > this.targetWidth ? this.targetWidth / image.width : 1;
    const outWidth = Math.max(1, Math.round(image.width * scale));
    const outHeight = Math.max(1, Math.round(image.height * scale));

    const source = this.ensureSourceCanvas(image.width, image.height);
    const sourceContext = source.getContext('2d');
    if (!sourceContext) {
      throw new Error('OffscreenCanvas 2d 문맥을 열지 못했어요');
    }
    sourceContext.putImageData(this.toImageData(image), 0, 0);

    let output: OffscreenCanvas = source;
    if (scale !== 1) {
      const target = this.ensureTargetCanvas(outWidth, outHeight);
      const targetContext = target.getContext('2d');
      if (!targetContext) {
        throw new Error('OffscreenCanvas 2d 문맥을 열지 못했어요');
      }
      targetContext.drawImage(source, 0, 0, outWidth, outHeight);
      output = target;
    }

    const blob = await output.convertToBlob({ type: WEBP_MIME, quality: this.quality });
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

  /**
   * RgbaImage 를 캔버스에 얹을 수 있는 ImageData 로 옮깁니다.
   *
   * 들어온 배열을 그대로 감싸지 않고 한 번 복사합니다. `ImageData` 생성자는 배열이
   * 반드시 보통의 ArrayBuffer 위에 있어야 하는데, 파이프라인에 들어오는 배열이 어디서
   * 왔는지는 이 클래스가 알 수 없기 때문입니다. 크기가 같으면 같은 ImageData 를 다시
   * 써서 프레임마다 새로 만들지 않습니다.
   */
  private toImageData(image: RgbaImage): ImageData {
    if (!this.scratch || this.scratch.width !== image.width || this.scratch.height !== image.height) {
      this.scratch = new ImageData(image.width, image.height);
    }
    this.scratch.data.set(image.data.subarray(0, this.scratch.data.length));
    return this.scratch;
  }

  private ensureSourceCanvas(width: number, height: number): OffscreenCanvas {
    if (!this.sourceCanvas || this.sourceCanvas.width !== width || this.sourceCanvas.height !== height) {
      this.sourceCanvas = new OffscreenCanvas(width, height);
    }
    return this.sourceCanvas;
  }

  private ensureTargetCanvas(width: number, height: number): OffscreenCanvas {
    if (!this.targetCanvas || this.targetCanvas.width !== width || this.targetCanvas.height !== height) {
      this.targetCanvas = new OffscreenCanvas(width, height);
    }
    return this.targetCanvas;
  }
}
