/**
 * background(서비스 워커) ↔ Offscreen 문서 사이에 오가는 말의 모양입니다.
 *
 * MV3 에서 서비스 워커는 `getUserMedia` 를 부를 수 없습니다(DOM 이 없습니다). 그래서
 * 역할을 이렇게 나눕니다.
 *
 *   사이드패널/아이콘 클릭 ──capture.start(tabId)──▶ background
 *   background ──chrome.tabCapture.getMediaStreamId──▶ streamId
 *   background ──chrome.offscreen.createDocument──▶ Offscreen 문서(offscreen.html)
 *   background ──capture.stream(streamId)──▶ Offscreen
 *   Offscreen ──capture.frame / capture.stats / capture.error──▶ background
 *   background ──capture.stop──▶ Offscreen ──▶ 트랙 정지 · 문서 닫기
 *
 * 보안 메모 (불변 원칙 §4-7): 이 통로로 오는 값은 **자료일 뿐 명령이 아닙니다.**
 * 화면·전사에서 읽은 문장을 여기에 실어 실행하는 코드를 만들지 않습니다.
 */

import { DEFAULT_CHANGE_THRESHOLD, HASH_BITS } from './dhash';
import { DEFAULT_SAMPLE_INTERVAL_MS } from './sampling-loop';
import type { CapturedFrame } from './frame-store';
import type { PipelineStats } from './pipeline';
import type { SamplingLoopStats } from './sampling-loop';

export const CAPTURE_START = 'capture.start';
export const CAPTURE_STOP = 'capture.stop';
export const CAPTURE_STREAM = 'capture.stream';
export const CAPTURE_FRAME = 'capture.frame';
export const CAPTURE_STATS = 'capture.stats';
export const CAPTURE_ERROR = 'capture.error';

/** Offscreen 문서가 어느 시각에 있는지. 사이드패널 SourceFooter 문구의 근거가 됩니다. */
export type CaptureState = 'idle' | 'starting' | 'capturing' | 'stopped' | 'error';

export interface CaptureStartMessage {
  type: typeof CAPTURE_START;
  /** 캡처할 탭. 보통 지금 보고 있는 Meet 탭입니다. */
  tabId: number;
  periodId: string;
  /**
   * dHash 해밍 거리 임계값(0~64). 이만큼 이상 다르면 "화면이 바뀌었다" 로 봅니다.
   * 없으면 `DEFAULT_CHANGE_THRESHOLD`(10) 를 씁니다. 실제 수업 화면에서 헛 프레임이
   * 많으면 이 값을 올려 부르는 쪽에서 조절합니다.
   */
  threshold?: number;
  /** 샘플링 간격(밀리초). 없으면 `DEFAULT_SAMPLE_INTERVAL_MS`(1000 = 1fps). */
  sampleIntervalMs?: number;
}

/** 임계값과 간격을 둘 다 채운 모양입니다. Offscreen 문서가 실제로 쓰는 값입니다. */
export interface CaptureSettings {
  threshold: number;
  sampleIntervalMs: number;
}

/** 아무것도 정해 주지 않았을 때 쓰는 값입니다. */
export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  threshold: DEFAULT_CHANGE_THRESHOLD,
  sampleIntervalMs: DEFAULT_SAMPLE_INTERVAL_MS,
};

/**
 * 메시지에 실려 온 설정을 확인해 빈자리를 기본값으로 채웁니다.
 *
 * 범위 밖 값은 조용히 고치지 않고 `RangeError` 로 막습니다. 임계값을 -1 로 두면 모든 장이
 * "바뀌었다" 가 되어 초당 한 장씩 인코딩하게 되고, 간격을 0 으로 두면 루프가 쉬지 않고
 * 돌기 때문입니다. 잘못된 값이 조용히 지나가면 나중에 원인을 찾기 어렵습니다.
 *
 * - `threshold` 는 0 이상 `HASH_BITS`(64) 이하의 유한한 수여야 합니다.
 * - `sampleIntervalMs` 는 0 보다 큰 유한한 수여야 합니다.
 */
export function resolveCaptureSettings(
  source: { threshold?: number; sampleIntervalMs?: number } = {},
): CaptureSettings {
  const threshold = source.threshold ?? DEFAULT_CAPTURE_SETTINGS.threshold;
  const sampleIntervalMs = source.sampleIntervalMs ?? DEFAULT_CAPTURE_SETTINGS.sampleIntervalMs;

  if (!Number.isFinite(threshold) || threshold < 0 || threshold > HASH_BITS) {
    throw new RangeError(`임계값은 0 이상 ${HASH_BITS} 이하의 숫자여야 해요`);
  }
  if (!Number.isFinite(sampleIntervalMs) || sampleIntervalMs <= 0) {
    throw new RangeError('샘플링 간격은 0 보다 큰 숫자여야 해요');
  }

  return { threshold, sampleIntervalMs };
}

export interface CaptureStopMessage {
  type: typeof CAPTURE_STOP;
}

export interface CaptureStreamMessage {
  type: typeof CAPTURE_STREAM;
  /** chrome.tabCapture.getMediaStreamId 가 준 값. 몇 초 안에 쓰지 않으면 만료됩니다. */
  streamId: string;
  periodId: string;
  /** `capture.start` 가 실어 온 값을 그대로 넘깁니다. 없으면 Offscreen 이 기본값을 씁니다. */
  sampleIntervalMs?: number;
  /** 같음. `resolveCaptureSettings` 가 Offscreen 쪽에서 빈자리를 채웁니다. */
  threshold?: number;
}

export interface CaptureFrameMessage {
  type: typeof CAPTURE_FRAME;
  frame: CapturedFrame;
  /**
   * WebP 바이트를 base64 로 적은 것입니다.
   *
   * 왜 싣는가: 실제 저장은 로컬 도우미가 하고, 도우미에 붙는 `connectNative` 는 **서비스
   * 워커에만** 있습니다. Offscreen 문서에서는 부를 수 없으므로 바이트가 background 까지는
   * 와야 합니다. 그래서 1라운드부터 여기에 싣고, background 의 `FrameSink` 가 받습니다.
   * 크기 판정(1 MiB)은 `FrameSink` 안에서 `buildFrameStore` 가 합니다.
   *
   * 없을 수도 있습니다. 인코더를 `includePayload: false` 로 두면 바이트 수만 세고 바이트는
   * 만들지 않습니다(스파이크 측정 경로).
   */
  payloadBase64?: string;
}

export interface CaptureStatsMessage {
  type: typeof CAPTURE_STATS;
  state: CaptureState;
  stats: PipelineStats;
  /**
   * 샘플링 루프 쪽 숫자입니다. `skippedWhileBusy` 가 0 보다 크면 한 회차가 간격보다
   * 오래 걸려 다음 회차를 건너뛰었다는 뜻이라, 샘플링 간격을 늘릴 근거가 됩니다.
   */
  loop: SamplingLoopStats;
  frames: number;
  totalBytes: number;
  droppedFrames: number;
}

export interface CaptureErrorMessage {
  type: typeof CAPTURE_ERROR;
  /** 사람이 읽을 한 줄. 토큰·URL·비밀값을 담지 않습니다(불변 원칙 §4-2·§4-3). */
  reason: string;
}

export type CaptureMessage =
  | CaptureStartMessage
  | CaptureStopMessage
  | CaptureStreamMessage
  | CaptureFrameMessage
  | CaptureStatsMessage
  | CaptureErrorMessage;

/** 알 수 없는 값이 캡처 메시지인지 좁혀 줍니다. 낯선 메시지는 그냥 무시합니다. */
export function isCaptureMessage(value: unknown): value is CaptureMessage {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === CAPTURE_START ||
    type === CAPTURE_STOP ||
    type === CAPTURE_STREAM ||
    type === CAPTURE_FRAME ||
    type === CAPTURE_STATS ||
    type === CAPTURE_ERROR
  );
}
