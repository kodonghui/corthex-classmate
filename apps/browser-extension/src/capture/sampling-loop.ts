/**
 * 샘플링 루프 — "몇 초에 한 번 볼지" 를 정하는 **단 한 곳** 입니다.
 *
 * 왜 이 파일이 따로 있는가 (검증자 지적 2·3):
 *
 *   예전에는 문이 두 겹이었습니다. Offscreen 문서가 `setInterval(…, 1000)` 으로 한 번,
 *   `CapturePipeline.offer` 가 "앞 장에서 1000ms 안 지났으면 버림" 으로 또 한 번 걸렀습니다.
 *   타이머는 정확히 1000ms 마다 오지 않습니다(브라우저 지터·탭 스로틀링). 1000ms 보다
 *   1ms 라도 일찍 오면 파이프라인이 그 회차를 통째로 버리고, 다음 회차는 그 다음 타이머라
 *   실효 0.5fps 에 잠길 수 있었습니다.
 *
 *     예전 (문 두 겹)                      지금 (문 한 겹)
 *     타이머 ─999ms─▶ 파이프라인 ✗버림      루프 ─▶ 회차 실행 ─끝나면─▶ 다음 회차 예약
 *     타이머 ─1998ms─▶ 파이프라인 ✓통과     (파이프라인은 간격을 보지 않습니다)
 *
 *   또 `setInterval` 은 앞 회차가 끝났는지 보지 않습니다. 한 회차(그리기 + 해시 + WebP
 *   인코딩)가 1초를 넘기면 회차가 겹치고, 두 회차가 **같은 `OffscreenWebpEncoder` 인스턴스의
 *   scratch 캔버스** 를 동시에 만져 프레임이 섞입니다. 실측 인코딩이 최악 131ms 라 보통은
 *   안 겹치지만, CPU 가 밀리는 노트북에서는 넘길 수 있습니다.
 *
 * 그래서 이 루프는 두 가지를 지킵니다.
 *   1. **겹치지 않는다.** 앞 회차가 끝나야 다음 회차를 예약합니다(`setTimeout` 재예약).
 *      혹시 밖에서 `tick()` 을 직접 불러도 in-flight 깃발이 막고 `skippedWhileBusy` 로 셉니다.
 *   2. **간격은 회차 시작 시각 기준.** 회차가 300ms 걸렸으면 다음 예약은 700ms 뒤입니다.
 *      회차가 간격보다 오래 걸렸으면 기다리지 않고 바로 다음 회차를 잡습니다(간격이 상한이
 *      아니라 목표라는 뜻입니다).
 *
 * 브라우저 API 를 쓰지 않습니다. 시계와 타이머를 밖에서 넣을 수 있어서 Node(Vitest)에서
 * 진짜로 기다리지 않고 겹침·간격을 시험할 수 있습니다(`sampling-loop.test.ts`).
 */

/** 루프가 쓰는 시계와 타이머. 시험에서는 가짜 시계를 넣습니다. */
export interface LoopTimers {
  setTimeout(handler: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
  /** 지금 시각(밀리초). 회차가 얼마나 걸렸는지 재는 데만 씁니다. */
  now(): number;
}

/** 기본 간격 1000ms = 1fps 입니다. */
export const DEFAULT_SAMPLE_INTERVAL_MS = 1000;

/** 진짜 타이머. Offscreen 문서에서 씁니다. */
export const systemTimers: LoopTimers = {
  setTimeout: (handler, delayMs) => globalThis.setTimeout(handler, delayMs),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
  now: () => Date.now(),
};

export interface SamplingLoopOptions {
  /** 한 회차를 실제로 하는 일. 비동기여도 됩니다. */
  task: () => Promise<void> | void;
  /** 목표 간격. 기본 1000ms. */
  intervalMs?: number;
  /** 회차가 던졌을 때 부릅니다. 루프는 멈추지 않고 다음 회차를 계속 잡습니다. */
  onError?: (error: unknown) => void;
  timers?: LoopTimers;
}

export interface SamplingLoopStats {
  /** `tick` 이 불린 총 횟수입니다(건너뛴 것 포함). */
  ticks: number;
  /** 실제로 회차를 돈 횟수입니다. */
  runs: number;
  /** 앞 회차가 안 끝나서 통째로 건너뛴 횟수입니다. 0 이 정상입니다. */
  skippedWhileBusy: number;
  /** 회차가 던진 횟수입니다. */
  errors: number;
  /** 마지막 회차가 걸린 밀리초입니다. */
  lastRunMs: number;
  /** 회차 한 번의 평균 밀리초입니다. 한 번도 안 돌았으면 0 입니다. */
  averageRunMs: number;
}

/** `tick` 한 번의 결과. 겹침을 시험에서 눈으로 확인하려고 돌려줍니다. */
export type TickOutcome = 'ran' | 'skipped-busy';

export class SamplingLoop {
  readonly intervalMs: number;

  private readonly task: () => Promise<void> | void;
  private readonly onError: ((error: unknown) => void) | undefined;
  private readonly timers: LoopTimers;

  private handle: unknown = null;
  private started = false;
  private busy = false;

  private tickCount = 0;
  private runCount = 0;
  private skippedWhileBusyCount = 0;
  private errorCount = 0;
  private runMsTotal = 0;
  private lastRunMsValue = 0;

  constructor(options: SamplingLoopOptions) {
    this.task = options.task;
    this.intervalMs = options.intervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;
    this.onError = options.onError;
    this.timers = options.timers ?? systemTimers;

    // 0 도 막습니다. 간격 0 은 회차가 끝나자마자 다음 회차를 잡아 CPU 를 통째로 먹는데,
    // `resolveCaptureSettings`(messages.ts)가 이미 `0 보다 큰 수` 만 통과시키므로 두 곳의
    // 규칙을 같게 둡니다. 규칙이 어긋나면 한쪽으로 들어온 0 이 조용히 살아납니다.
    if (!Number.isFinite(this.intervalMs) || this.intervalMs <= 0) {
      throw new RangeError('샘플링 간격은 0 보다 커야 해요');
    }
  }

  /** 루프가 돌고 있는지입니다. */
  get running(): boolean {
    return this.started;
  }

  /** 지금 회차가 진행 중인지입니다. */
  get inFlight(): boolean {
    return this.busy;
  }

  /**
   * 루프를 켭니다. 첫 회차는 간격이 한 번 지난 뒤입니다(`setInterval` 과 같은 시점).
   * 이미 켜져 있으면 아무것도 하지 않습니다.
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.schedule(this.intervalMs);
  }

  /** 루프를 끕니다. 이미 돌고 있는 회차는 끝까지 가고, 다음 회차를 잡지 않습니다. */
  stop(): void {
    this.started = false;
    if (this.handle !== null) {
      this.timers.clearTimeout(this.handle);
      this.handle = null;
    }
  }

  /**
   * 한 회차를 지금 돌립니다.
   *
   * 앞 회차가 아직 안 끝났으면 **이번 회차는 통째로 건너뜁니다.** 큐에 쌓아 두지 않습니다.
   * 화면 캡처는 밀린 옛 장면을 뒤늦게 처리할 이유가 없고, 쌓아 두면 인코더 인스턴스를
   * 두 회차가 동시에 만지게 되기 때문입니다.
   */
  async tick(): Promise<TickOutcome> {
    this.tickCount += 1;

    if (this.busy) {
      this.skippedWhileBusyCount += 1;
      return 'skipped-busy';
    }

    this.busy = true;
    const startedAt = this.timers.now();
    try {
      await this.task();
    } catch (error: unknown) {
      this.errorCount += 1;
      this.onError?.(error);
    } finally {
      this.busy = false;
      this.runCount += 1;
      this.lastRunMsValue = this.timers.now() - startedAt;
      this.runMsTotal += this.lastRunMsValue;
      // 다음 회차는 **이번 회차가 시작한 시각** 기준으로 간격을 맞춥니다.
      // 회차가 간격보다 오래 걸렸으면 음수가 되고, schedule 이 0 으로 올려 바로 잡습니다.
      this.schedule(this.intervalMs - this.lastRunMsValue);
    }

    return 'ran';
  }

  stats(): SamplingLoopStats {
    return {
      ticks: this.tickCount,
      runs: this.runCount,
      skippedWhileBusy: this.skippedWhileBusyCount,
      errors: this.errorCount,
      lastRunMs: this.lastRunMsValue,
      averageRunMs: this.runCount === 0 ? 0 : this.runMsTotal / this.runCount,
    };
  }

  private schedule(delayMs: number): void {
    if (!this.started) return;
    if (this.handle !== null) {
      // 밖에서 tick() 을 직접 불러 예약이 하나 더 생기는 것을 막습니다.
      this.timers.clearTimeout(this.handle);
      this.handle = null;
    }
    this.handle = this.timers.setTimeout(() => {
      this.handle = null;
      void this.tick();
    }, Math.max(0, delayMs));
  }
}
