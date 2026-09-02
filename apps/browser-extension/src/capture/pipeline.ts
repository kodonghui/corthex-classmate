/**
 * 캡처 파이프라인 — 탭에서 들어온 그림을 "바뀐 장면만" 남기는 데까지 옮깁니다.
 *
 *   SamplingLoop              (sampling-loop.ts · 1fps · 겹치지 않게 재예약)
 *        │  회차마다 한 번
 *        ▼
 *   프레임 공급자(FrameSource)
 *        │  read()  · Offscreen 문서에서는 video → canvas → getImageData
 *        ▼
 *   dHash 변화 감지           (dhash.ts · 임계값 이상이면 바뀐 것)
 *        │  바뀐 장만
 *        ▼
 *   인코더(FrameEncoder)      (브라우저: OffscreenCanvas → WebP 폭 1280 · 품질 80)
 *        │
 *        ▼
 *   FrameStore                (60분·바이트·장 수 상한, 오래된 것부터 폐기)
 *
 * **샘플링 간격은 이 파일이 보지 않습니다** (검증자 지적 3). 예전에는 여기에도 "앞 장에서
 * sampleIntervalMs 안 지났으면 버림" 이 있어서 Offscreen 문서의 타이머와 문이 두 겹이었고,
 * 타이머가 999ms 에 오면 그 회차가 통째로 버려져 실효 0.5fps 가 될 수 있었습니다. 지금은
 * `SamplingLoop` 한 곳만 간격을 정하고, 이 파이프라인은 **들어온 장은 무조건 봅니다.**
 *
 * 인코더를 인터페이스로 둔 이유는 두 가지입니다. 첫째, 안 바뀐 장에는 인코더를 아예
 * 부르지 않는다는 것을 시험으로 못 박을 수 있습니다(불변 원칙 §4-4). 둘째, Node 시험에서는
 * OffscreenCanvas 가 없으므로 모의 인코더를 끼웁니다.
 */

import { computeDHash, hammingDistance, toHex, DEFAULT_CHANGE_THRESHOLD } from './dhash';
import type { RgbaImage } from './dhash';
import { FrameStore } from './frame-store';
import type { CapturedFrame } from './frame-store';

/** 인코딩 결과. `payload` 는 실제 WebP 바이트이고, 안 쓸 때는 없어도 됩니다. */
export interface EncodedFrame {
  bytes: number;
  width: number;
  height: number;
  mime: 'image/webp';
  payload?: Uint8Array;
}

export interface FrameEncoder {
  encode(image: RgbaImage): Promise<EncodedFrame>;
}

/** 프레임을 한 장씩 내주는 쪽. 더 없으면 null 을 돌려줍니다. */
export interface FrameSource {
  read(): RgbaImage | null | Promise<RgbaImage | null>;
}

export type OfferStatus =
  /** 앞 장과 거의 같아서 인코딩하지 않았습니다. */
  | 'unchanged'
  /** 바뀐 장이라 인코딩해 통에 넣었습니다. */
  | 'stored';

export interface OfferResult {
  status: OfferStatus;
  /** 앞 장과의 해밍 거리. 첫 장이면 null 입니다. */
  distance: number | null;
  /** 통에 들어간 장. 그 밖에는 null 입니다. */
  frame: CapturedFrame | null;
}

export interface PipelineStats {
  /**
   * offer 로 들어온 총 횟수입니다. 샘플링 간격은 `SamplingLoop` 가 정하므로
   * 여기 들어온 장은 하나도 버리지 않습니다(= 회차 수와 같습니다).
   */
  offered: number;
  /** 바뀐 것으로 판정한 횟수입니다. */
  changed: number;
  /** 인코더를 실제로 부른 횟수입니다. changed 와 같아야 정상입니다. */
  encoded: number;
  stored: number;
  /** 한 장을 처리하는 데 걸린 평균 밀리초(해시 + 인코딩 + 저장). */
  averageProcessMs: number;
  /** dHash 계산만의 평균 밀리초. */
  averageHashMs: number;
  /** 인코딩만의 평균 밀리초. 인코딩한 적이 없으면 0 입니다. */
  averageEncodeMs: number;
  lastDistance: number | null;
}

export interface PipelineOptions {
  store: FrameStore;
  encoder: FrameEncoder;
  /** dHash 변화 임계값. 기본 dhash.ts 의 DEFAULT_CHANGE_THRESHOLD. */
  threshold?: number;
  /** 장이 통에 들어갈 때마다 부릅니다. Offscreen 문서에서 background 로 보내는 자리입니다. */
  onFrame?: (frame: CapturedFrame, encoded: EncodedFrame) => void;
}

/** 시각을 재는 자. performance 가 있으면 그쪽이 더 정밀합니다. */
function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export class CapturePipeline {
  readonly threshold: number;

  private readonly store: FrameStore;
  private readonly encoder: FrameEncoder;
  private readonly onFrame: ((frame: CapturedFrame, encoded: EncodedFrame) => void) | undefined;

  private previousHash: bigint | null = null;

  private offeredCount = 0;
  private changedCount = 0;
  private encodedCount = 0;
  private storedCount = 0;
  private processMsTotal = 0;
  private hashMsTotal = 0;
  private encodeMsTotal = 0;
  private lastDistanceValue: number | null = null;

  constructor(options: PipelineOptions) {
    this.store = options.store;
    this.encoder = options.encoder;
    this.threshold = options.threshold ?? DEFAULT_CHANGE_THRESHOLD;
    this.onFrame = options.onFrame;
  }

  /**
   * 프레임 한 장을 파이프라인에 넣습니다. 들어온 장은 버리지 않고 무조건 봅니다.
   * "몇 초에 한 번 넣을지" 는 부르는 쪽(`SamplingLoop`)이 정합니다.
   *
   * @param image 들어온 그림.
   * @param capturedAtMs 그 그림을 잡은 시각(에폭 밀리초). 시험에서 시계를 손으로 돌리려고
   *   인자로 받습니다. 실제 Offscreen 문서에서는 `Date.now()` 를 넣습니다.
   */
  async offer(image: RgbaImage, capturedAtMs: number): Promise<OfferResult> {
    this.offeredCount += 1;

    const startedAt = nowMs();

    const hashStartedAt = nowMs();
    const hash = computeDHash(image);
    this.hashMsTotal += nowMs() - hashStartedAt;

    const distance = this.previousHash === null ? null : hammingDistance(this.previousHash, hash);
    this.lastDistanceValue = distance;

    const changed = distance === null || distance >= this.threshold;
    if (!changed) {
      this.processMsTotal += nowMs() - startedAt;
      return { status: 'unchanged', distance, frame: null };
    }

    this.changedCount += 1;

    const encodeStartedAt = nowMs();
    const encoded = await this.encoder.encode(image);
    this.encodeMsTotal += nowMs() - encodeStartedAt;
    this.encodedCount += 1;

    const frame = this.store.add({
      capturedAt: capturedAtMs,
      hash: toHex(hash),
      bytes: encoded.bytes,
      width: encoded.width,
      height: encoded.height,
      changedFromPrev: this.previousHash !== null,
    });
    this.storedCount += 1;
    this.previousHash = hash;

    this.processMsTotal += nowMs() - startedAt;
    this.onFrame?.(frame, encoded);

    return { status: 'stored', distance, frame };
  }

  /**
   * 공급자에게서 한 장을 받아 그대로 `offer` 에 넘깁니다.
   * 공급자가 더 줄 것이 없으면 null 을 돌려줍니다.
   */
  async pump(source: FrameSource, capturedAtMs: number): Promise<OfferResult | null> {
    const image = await source.read();
    if (image === null) {
      return null;
    }
    return this.offer(image, capturedAtMs);
  }

  stats(): PipelineStats {
    return {
      offered: this.offeredCount,
      changed: this.changedCount,
      encoded: this.encodedCount,
      stored: this.storedCount,
      averageProcessMs: this.offeredCount === 0 ? 0 : this.processMsTotal / this.offeredCount,
      averageHashMs: this.offeredCount === 0 ? 0 : this.hashMsTotal / this.offeredCount,
      averageEncodeMs: this.encodedCount === 0 ? 0 : this.encodeMsTotal / this.encodedCount,
      lastDistance: this.lastDistanceValue,
    };
  }

  /** 교시가 바뀌면 앞 장 기억을 지웁니다. 다음 장이 다시 첫 장이 됩니다. */
  reset(): void {
    this.previousHash = null;
  }
}
