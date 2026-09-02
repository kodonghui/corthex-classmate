import { describe, expect, it } from 'vitest';
import { DEFAULT_CHANGE_THRESHOLD, HASH_BITS } from './dhash';
import { DEFAULT_SAMPLE_INTERVAL_MS } from './sampling-loop';
import {
  CAPTURE_ERROR,
  CAPTURE_FRAME,
  CAPTURE_START,
  CAPTURE_STATS,
  CAPTURE_STOP,
  CAPTURE_STREAM,
  DEFAULT_CAPTURE_SETTINGS,
  isCaptureMessage,
  resolveCaptureSettings,
} from './messages';
import type {
  CaptureMessage,
  CaptureStartMessage,
  CaptureStreamMessage,
} from './messages';

const PERIOD = '2026-09-02-p3';

describe('capture.start 왕복', () => {
  it('임계값과 간격을 실어 직렬화했다가 그대로 되돌립니다', () => {
    const message: CaptureStartMessage = {
      type: CAPTURE_START,
      tabId: 42,
      periodId: PERIOD,
      threshold: 14,
      sampleIntervalMs: 2000,
    };

    const parsed: unknown = JSON.parse(JSON.stringify(message));
    expect(isCaptureMessage(parsed)).toBe(true);
    expect(parsed).toEqual(message);

    // 왕복한 값에서 설정을 뽑아도 같은 값이 나옵니다.
    expect(resolveCaptureSettings(parsed as CaptureStartMessage)).toEqual({
      threshold: 14,
      sampleIntervalMs: 2000,
    });
  });

  it('두 칸이 없어도 그 자체로 온전한 메시지입니다', () => {
    const message: CaptureStartMessage = { type: CAPTURE_START, tabId: 7, periodId: PERIOD };
    const parsed: unknown = JSON.parse(JSON.stringify(message));

    expect(isCaptureMessage(parsed)).toBe(true);
    expect(Object.keys(message).sort()).toEqual(['periodId', 'tabId', 'type']);
  });

  it('background 가 넘기는 capture.stream 도 같은 두 칸을 나릅니다', () => {
    const handoff: CaptureStreamMessage = {
      type: CAPTURE_STREAM,
      streamId: 'stream-id-없는-값',
      periodId: PERIOD,
      threshold: 20,
      sampleIntervalMs: 3000,
    };

    const parsed: unknown = JSON.parse(JSON.stringify(handoff));
    expect(resolveCaptureSettings(parsed as CaptureStreamMessage)).toEqual({
      threshold: 20,
      sampleIntervalMs: 3000,
    });
  });
});

describe('resolveCaptureSettings', () => {
  it('빈자리는 기본값으로 채웁니다', () => {
    expect(resolveCaptureSettings()).toEqual(DEFAULT_CAPTURE_SETTINGS);
    expect(resolveCaptureSettings({})).toEqual({
      threshold: DEFAULT_CHANGE_THRESHOLD,
      sampleIntervalMs: DEFAULT_SAMPLE_INTERVAL_MS,
    });
  });

  it('한쪽만 주면 나머지만 기본값으로 채웁니다', () => {
    expect(resolveCaptureSettings({ threshold: 0 })).toEqual({
      threshold: 0,
      sampleIntervalMs: DEFAULT_SAMPLE_INTERVAL_MS,
    });
    expect(resolveCaptureSettings({ sampleIntervalMs: 5000 })).toEqual({
      threshold: DEFAULT_CHANGE_THRESHOLD,
      sampleIntervalMs: 5000,
    });
  });

  it('경계값은 그대로 받습니다', () => {
    expect(resolveCaptureSettings({ threshold: HASH_BITS }).threshold).toBe(64);
    expect(resolveCaptureSettings({ sampleIntervalMs: 1 }).sampleIntervalMs).toBe(1);
  });

  it('범위 밖 임계값은 RangeError 로 막습니다', () => {
    expect(() => resolveCaptureSettings({ threshold: -1 })).toThrow(RangeError);
    expect(() => resolveCaptureSettings({ threshold: Number.NaN })).toThrow(RangeError);
    expect(() => resolveCaptureSettings({ threshold: Number.POSITIVE_INFINITY })).toThrow(
      RangeError,
    );
    expect(() => resolveCaptureSettings({ threshold: HASH_BITS + 1 })).toThrow(RangeError);
  });

  it('범위 밖 샘플링 간격은 RangeError 로 막습니다', () => {
    expect(() => resolveCaptureSettings({ sampleIntervalMs: 0 })).toThrow(RangeError);
    expect(() => resolveCaptureSettings({ sampleIntervalMs: -1000 })).toThrow(RangeError);
    expect(() => resolveCaptureSettings({ sampleIntervalMs: Number.NaN })).toThrow(RangeError);
    expect(() => resolveCaptureSettings({ sampleIntervalMs: Number.POSITIVE_INFINITY })).toThrow(
      RangeError,
    );
  });
});

describe('isCaptureMessage', () => {
  it('여섯 가지 캡처 메시지를 모두 알아봅니다', () => {
    const messages: CaptureMessage[] = [
      { type: CAPTURE_START, tabId: 1, periodId: PERIOD },
      { type: CAPTURE_STOP },
      { type: CAPTURE_STREAM, streamId: 's', periodId: PERIOD },
      {
        type: CAPTURE_FRAME,
        frame: {
          id: 'sf-001',
          periodId: PERIOD,
          capturedAt: '2026-09-02T10:00:00.000Z',
          path: 'frames/sf-001.webp',
          width: 1280,
          height: 720,
          hash: 'abcdef0123456789',
          changedFromPrev: true,
          source: 'meet-tab',
          bytes: 1024,
          mime: 'image/webp',
        },
      },
      {
        type: CAPTURE_STATS,
        state: 'capturing',
        stats: {
          offered: 1,
          changed: 1,
          encoded: 1,
          stored: 1,
          averageProcessMs: 1,
          averageHashMs: 1,
          averageEncodeMs: 1,
          lastDistance: null,
        },
        loop: {
          ticks: 1,
          runs: 1,
          skippedWhileBusy: 0,
          errors: 0,
          lastRunMs: 1,
          averageRunMs: 1,
        },
        frames: 1,
        totalBytes: 1024,
        droppedFrames: 0,
      },
      { type: CAPTURE_ERROR, reason: '탭 화면을 열지 못했어요' },
    ];

    expect(messages.map((message) => isCaptureMessage(message))).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ]);

    // 여섯 이름이 서로 겹치지 않는지도 함께 봅니다.
    expect(new Set(messages.map((message) => message.type)).size).toBe(6);
  });

  it('캡처 메시지가 아닌 값은 모두 거절합니다', () => {
    const strangers: unknown[] = [
      null,
      undefined,
      0,
      '',
      'capture.start',
      [],
      {},
      { type: 'capture' },
      { type: 'frame.store' },
      { type: null },
      { notType: 'capture.start' },
    ];

    for (const stranger of strangers) {
      expect(isCaptureMessage(stranger)).toBe(false);
    }
  });
});
