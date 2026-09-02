/**
 * 캡처가 돌고 있는 동안의 **상태 갈아타기** 규칙입니다.
 *
 * 왜 따로 뺐는가:
 *   Offscreen 문서는 vitest 가 보지 않는 자리라 시험을 붙일 수 없는데, 예전 규칙에는
 *   이런 구멍이 있었습니다. 회차 하나가 던지면 상태가 `error` 가 되는데, `capturing` 으로
 *   되돌리는 자리는 캡처를 처음 시작할 때 한 곳뿐이었습니다. 샘플링 루프는 설계대로
 *   멈추지 않고 다음 회차를 계속 잡으므로(`sampling-loop.ts`), 한 번 실패하면
 *
 *     회차 ✗ → error → 회차 ✓ → **여전히 error** → 회차 ✓ → **여전히 error** …
 *
 *   처럼 상태가 영원히 굳었습니다. 사이드패널은 회복을 볼 길이 없었습니다.
 *   반대로 계속 실패하면 `capture.error` 를 간격마다 끝없이 보내면서도 캡처는 멈추지
 *   않았습니다.
 *
 * 지금 규칙은 두 줄입니다.
 *
 *   ┌──────────────┬───────────────────────────────────────────────────────────┐
 *   │ 회차가 성공   │ 연속 실패 수를 0 으로 되돌리고 상태를 `capturing` 으로     │
 *   │ 회차가 실패   │ 연속 실패 수 +1 · 상태 `error` · `capture.error` 한 번    │
 *   │              │ 그 수가 예산(기본 5)에 닿으면 그 회차를 마지막으로 세션 종료 │
 *   └──────────────┴───────────────────────────────────────────────────────────┘
 *
 * 순수 함수입니다. 타이머도 전역 변수도 만지지 않으므로 시험에서 회차 열을 그대로 흘려
 * "실패 뒤 성공하면 돌아오는가 · 5연속 실패면 멈추는가" 를 확인할 수 있습니다.
 */

import type { CaptureState } from './messages';

/** 연속 실패를 몇 번까지 참을지입니다. 이 수에 닿는 회차에서 세션을 접습니다. */
export const DEFAULT_ERROR_BUDGET = 5;

/** 캡처가 도는 동안 들고 다니는 값입니다. */
export interface CaptureRunState {
  state: CaptureState;
  /** 마지막 성공 이후 연달아 실패한 횟수입니다. 성공하면 0 으로 돌아갑니다. */
  consecutiveErrors: number;
}

/** 회차 하나의 결과입니다. */
export type CaptureRunEvent = 'sample-ok' | 'sample-error';

/** 규칙이 내놓는 답. 다음 상태와 "이번에 해야 할 일" 입니다. */
export interface CaptureRunDecision {
  next: CaptureRunState;
  /** `capture.error` 를 한 번 보낼지입니다. */
  reportError: boolean;
  /** 세션을 접을지입니다. 예산을 다 쓴 마지막 실패에서만 참입니다. */
  stopSession: boolean;
}

/** 캡처를 막 시작했을 때의 값입니다. */
export function startingRunState(): CaptureRunState {
  return { state: 'starting', consecutiveErrors: 0 };
}

/** 첫 회차가 돌기 전, 캡처가 자리를 잡았을 때의 값입니다. */
export function capturingRunState(): CaptureRunState {
  return { state: 'capturing', consecutiveErrors: 0 };
}

/**
 * 회차 하나의 결과를 받아 다음 상태를 정합니다.
 *
 * 이미 끝난 세션(`stopped` · `idle`)에는 아무 일도 하지 않습니다. 세션을 접은 뒤 늦게 도착한
 * 회차가 상태를 `capturing` 으로 되살리면 화면이 거짓말을 하게 되기 때문입니다.
 */
export function reduceCaptureRun(
  current: CaptureRunState,
  event: CaptureRunEvent,
  errorBudget: number = DEFAULT_ERROR_BUDGET,
): CaptureRunDecision {
  if (!Number.isFinite(errorBudget) || errorBudget < 1) {
    throw new RangeError('연속 실패 예산은 1 이상이어야 해요');
  }

  const finished = current.state === 'stopped' || current.state === 'idle';
  if (finished) {
    return { next: current, reportError: false, stopSession: false };
  }

  if (event === 'sample-ok') {
    return {
      next: { state: 'capturing', consecutiveErrors: 0 },
      reportError: false,
      stopSession: false,
    };
  }

  const consecutiveErrors = current.consecutiveErrors + 1;
  const stopSession = consecutiveErrors >= errorBudget;
  return {
    next: { state: 'error', consecutiveErrors },
    // 실패는 언제나 한 번 알립니다. 예산을 다 쓴 마지막 실패도 알리고 나서 접습니다.
    reportError: true,
    stopSession,
  };
}
