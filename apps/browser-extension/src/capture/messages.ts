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
}

export interface CaptureStopMessage {
  type: typeof CAPTURE_STOP;
}

export interface CaptureStreamMessage {
  type: typeof CAPTURE_STREAM;
  /** chrome.tabCapture.getMediaStreamId 가 준 값. 몇 초 안에 쓰지 않으면 만료됩니다. */
  streamId: string;
  periodId: string;
  sampleIntervalMs?: number;
  threshold?: number;
}

export interface CaptureFrameMessage {
  type: typeof CAPTURE_FRAME;
  frame: CapturedFrame;
  /**
   * WebP 바이트 자체는 아직 싣지 않습니다. Gate D(로컬 도우미 · Native Messaging)가
   * 판정된 뒤에 그쪽으로 흘려보냅니다. 그때까지는 메시지에 큰 바이트를 담지 않아
   * 서비스 워커 메모리를 지킵니다.
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
