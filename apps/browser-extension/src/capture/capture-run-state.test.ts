import { describe, expect, it } from 'vitest';
import {
  capturingRunState,
  DEFAULT_ERROR_BUDGET,
  reduceCaptureRun,
  startingRunState,
} from './capture-run-state';
import type { CaptureRunEvent, CaptureRunState } from './capture-run-state';

/** 회차 열을 그대로 흘려 보고, 마지막 상태와 도중에 일어난 일을 함께 돌려줍니다. */
function play(
  events: CaptureRunEvent[],
  start: CaptureRunState = capturingRunState(),
  errorBudget: number = DEFAULT_ERROR_BUDGET,
): { end: CaptureRunState; reported: number; stops: number } {
  let current = start;
  let reported = 0;
  let stops = 0;

  for (const event of events) {
    const decision = reduceCaptureRun(current, event, errorBudget);
    if (decision.reportError) reported += 1;
    if (decision.stopSession) stops += 1;
    current = decision.next;
  }

  return { end: current, reported, stops };
}

describe('reduceCaptureRun 회복', () => {
  it('회차가 성공하면 굳어 있던 error 가 capturing 으로 돌아옵니다', () => {
    // 예전 구멍: 한 번 실패하면 상태를 capturing 으로 되돌리는 자리가 없어 사이드패널이
    // 회복을 영영 보지 못했습니다.
    const afterFailure = reduceCaptureRun(capturingRunState(), 'sample-error');
    expect(afterFailure.next).toEqual({ state: 'error', consecutiveErrors: 1 });

    const afterSuccess = reduceCaptureRun(afterFailure.next, 'sample-ok');
    expect(afterSuccess.next).toEqual({ state: 'capturing', consecutiveErrors: 0 });
    expect(afterSuccess.reportError).toBe(false);
    expect(afterSuccess.stopSession).toBe(false);
  });

  it('시작 상태에서 첫 회차가 성공해도 capturing 이 됩니다', () => {
    expect(reduceCaptureRun(startingRunState(), 'sample-ok').next).toEqual({
      state: 'capturing',
      consecutiveErrors: 0,
    });
  });

  it('실패 · 성공이 번갈아 오면 예산을 쓰지 않아 캡처가 계속 삽니다', () => {
    const events: CaptureRunEvent[] = [
      'sample-error',
      'sample-ok',
      'sample-error',
      'sample-ok',
      'sample-error',
      'sample-ok',
      'sample-error',
      'sample-ok',
      'sample-error',
      'sample-ok',
    ];
    const { end, reported, stops } = play(events);

    expect(stops).toBe(0);
    expect(reported).toBe(5); // 실패는 그때마다 한 번씩 알립니다.
    expect(end).toEqual({ state: 'capturing', consecutiveErrors: 0 });
  });
});

describe('reduceCaptureRun 연속 실패 예산', () => {
  it('5회 연속 실패하면 마지막 회차에서 오류를 알리고 세션을 접습니다', () => {
    const events: CaptureRunEvent[] = Array.from({ length: 5 }, () => 'sample-error');
    const { end, reported, stops } = play(events);

    expect(reported).toBe(5);
    expect(stops).toBe(1); // 다섯 번째 회차 딱 한 번입니다.
    expect(end).toEqual({ state: 'error', consecutiveErrors: 5 });
  });

  it('4회까지는 접지 않습니다 · 경계를 눈으로 확인합니다', () => {
    const events: CaptureRunEvent[] = Array.from({ length: 4 }, () => 'sample-error');
    const { end, stops } = play(events);

    expect(stops).toBe(0);
    expect(end).toEqual({ state: 'error', consecutiveErrors: 4 });
  });

  it('중간에 한 번이라도 성공하면 셈이 0 으로 돌아가 접지 않습니다', () => {
    const events: CaptureRunEvent[] = [
      'sample-error',
      'sample-error',
      'sample-error',
      'sample-error',
      'sample-ok', // 여기서 셈이 0 으로
      'sample-error',
      'sample-error',
      'sample-error',
      'sample-error',
    ];
    const { end, stops } = play(events);

    expect(stops).toBe(0);
    expect(end).toEqual({ state: 'error', consecutiveErrors: 4 });
  });

  it('예산을 좁게 두면 그만큼 빨리 접습니다', () => {
    const { stops, end } = play(['sample-error', 'sample-error'], capturingRunState(), 2);
    expect(stops).toBe(1);
    expect(end.consecutiveErrors).toBe(2);
  });

  it('예산이 1 보다 작으면 RangeError 로 막습니다', () => {
    expect(() => reduceCaptureRun(capturingRunState(), 'sample-ok', 0)).toThrow(RangeError);
    expect(() => reduceCaptureRun(capturingRunState(), 'sample-ok', Number.NaN)).toThrow(RangeError);
  });
});

describe('reduceCaptureRun 끝난 세션', () => {
  it('접은 뒤 늦게 도착한 회차는 상태를 되살리지 않습니다', () => {
    const stopped: CaptureRunState = { state: 'stopped', consecutiveErrors: 0 };
    const late = reduceCaptureRun(stopped, 'sample-ok');

    expect(late.next).toEqual(stopped);
    expect(late.reportError).toBe(false);
    expect(late.stopSession).toBe(false);
  });

  it('아직 시작도 안 한 상태에서 온 실패는 알리지 않습니다', () => {
    const idle: CaptureRunState = { state: 'idle', consecutiveErrors: 0 };
    const decision = reduceCaptureRun(idle, 'sample-error');

    expect(decision.next).toEqual(idle);
    expect(decision.reportError).toBe(false);
  });
});
