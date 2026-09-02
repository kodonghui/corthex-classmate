import { describe, expect, it } from 'vitest';
import type { LoopTimers } from './sampling-loop';
import { SamplingLoop } from './sampling-loop';

/**
 * 가짜 시계. 진짜로 1초를 기다리지 않고 시각을 손으로 밀어 회차를 재현합니다.
 *
 * `advance` 는 예약된 일을 **시각 순서대로** 하나씩 실행하고, 그 사이사이에 마이크로태스크를
 * 비웁니다(회차가 async 라서 `await` 뒤 코드가 이어지도록). 그래야 "회차가 끝나야 다음 회차가
 * 예약된다" 는 성질을 눈으로 확인할 수 있습니다.
 */
class FakeClock implements LoopTimers {
  private currentMs = 0;
  private nextHandle = 1;
  private readonly jobs = new Map<number, { atMs: number; handler: () => void }>();

  now(): number {
    return this.currentMs;
  }

  setTimeout(handler: () => void, delayMs: number): unknown {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.jobs.set(handle, { atMs: this.currentMs + Math.max(0, delayMs), handler });
    return handle;
  }

  clearTimeout(handle: unknown): void {
    this.jobs.delete(handle as number);
  }

  /** 예약된 일 중 가장 이른 것의 시각입니다. 없으면 null. */
  nextDueAtMs(): number | null {
    let earliest: number | null = null;
    for (const job of this.jobs.values()) {
      if (earliest === null || job.atMs < earliest) earliest = job.atMs;
    }
    return earliest;
  }

  /** 지금 시각을 그대로 두고 시각을 밀어 둡니다. 회차가 오래 걸린 상황을 흉내 냅니다. */
  spend(ms: number): void {
    this.currentMs += ms;
  }

  /** `ms` 만큼 시각을 밀며 그 사이에 예약된 일을 순서대로 실행합니다. */
  async advance(ms: number): Promise<void> {
    const until = this.currentMs + ms;
    for (;;) {
      let due: { handle: number; atMs: number; handler: () => void } | null = null;
      for (const [handle, job] of this.jobs) {
        if (job.atMs <= until && (due === null || job.atMs < due.atMs)) {
          due = { handle, atMs: job.atMs, handler: job.handler };
        }
      }
      if (!due) break;
      this.jobs.delete(due.handle);
      this.currentMs = Math.max(this.currentMs, due.atMs);
      due.handler();
      await flushMicrotasks();
    }
    this.currentMs = Math.max(this.currentMs, until);
    await flushMicrotasks();
  }
}

/** 대기 중인 마이크로태스크를 넉넉히 비웁니다. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

/** 밖에서 마음대로 끝낼 수 있는 약속. "아직 안 끝난 회차" 를 만드는 데 씁니다. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('SamplingLoop 겹침 방지', () => {
  it('앞 회차가 안 끝났으면 이번 회차를 통째로 건너뜁니다', async () => {
    const gate = deferred();
    let started = 0;
    const loop = new SamplingLoop({
      timers: new FakeClock(),
      task: () => {
        started += 1;
        return gate.promise;
      },
    });

    // 첫 회차를 시작만 시켜 두고(await 하지 않음) 두 번째 회차를 부릅니다.
    const first = loop.tick();
    await flushMicrotasks();
    expect(loop.inFlight).toBe(true);

    const second = await loop.tick();
    const third = await loop.tick();

    expect(second).toBe('skipped-busy');
    expect(third).toBe('skipped-busy');
    expect(started).toBe(1); // task 는 딱 한 번만 들어갔습니다.
    expect(loop.stats().skippedWhileBusy).toBe(2);
    expect(loop.stats().runs).toBe(0);

    gate.resolve();
    expect(await first).toBe('ran');
    expect(loop.inFlight).toBe(false);
    expect(loop.stats()).toMatchObject({ ticks: 3, runs: 1, skippedWhileBusy: 2, errors: 0 });
  });

  it('겹치지 않으니 같은 인코더 인스턴스를 두 회차가 함께 만지지 않습니다', async () => {
    // 인코더의 scratch 캔버스를 흉내 냅니다. 두 회차가 겹치면 이 값이 섞입니다.
    const shared = { owner: '' };
    const overlaps: string[] = [];
    const gate = deferred();

    const loop = new SamplingLoop({
      timers: new FakeClock(),
      task: async () => {
        if (shared.owner !== '') overlaps.push(shared.owner);
        shared.owner = 'A';
        await gate.promise;
        shared.owner = '';
      },
    });

    const first = loop.tick();
    await flushMicrotasks();
    await loop.tick(); // 겹치려는 시도
    gate.resolve();
    await first;

    expect(overlaps).toEqual([]);
    expect(shared.owner).toBe('');
  });
});

describe('SamplingLoop 간격', () => {
  it('start 뒤 간격마다 한 회차씩 돕니다', async () => {
    const clock = new FakeClock();
    let runs = 0;
    const loop = new SamplingLoop({
      timers: clock,
      intervalMs: 1000,
      task: () => {
        runs += 1;
      },
    });

    loop.start();
    expect(runs).toBe(0); // 첫 회차는 간격이 한 번 지난 뒤입니다.

    await clock.advance(1000);
    expect(runs).toBe(1);

    await clock.advance(1000);
    expect(runs).toBe(2);

    await clock.advance(3000);
    expect(runs).toBe(5);
    expect(loop.stats().skippedWhileBusy).toBe(0);
  });

  it('회차가 걸린 만큼 다음 예약을 당겨서 1fps 를 지킵니다', async () => {
    const clock = new FakeClock();
    const loop = new SamplingLoop({
      timers: clock,
      intervalMs: 1000,
      task: () => {
        clock.spend(300); // 그리기 + 해시 + 인코딩에 300ms 썼다고 칩니다.
      },
    });

    loop.start();
    await clock.advance(1000); // 1000ms 에 회차 시작 → 1300ms 에 끝남

    // 다음 회차는 1300 + 700 = 2000ms, 즉 회차 시작 시각 기준 1초 뒤입니다.
    expect(clock.nextDueAtMs()).toBe(2000);
  });

  it('회차가 간격보다 오래 걸리면 기다리지 않고 바로 다음 회차를 잡습니다', async () => {
    const clock = new FakeClock();
    const loop = new SamplingLoop({
      timers: clock,
      intervalMs: 1000,
      task: () => {
        clock.spend(2500); // 1초 예산을 넘긴 무거운 회차
      },
    });

    loop.start();
    await clock.advance(1000); // 1000ms 시작 → 3500ms 종료

    // 음수(1000 - 2500)는 0 으로 올라가므로 종료 즉시 다음 회차입니다. 큐에 쌓지 않습니다.
    expect(clock.nextDueAtMs()).toBe(3500);
    expect(loop.stats().lastRunMs).toBe(2500);
    expect(loop.stats().skippedWhileBusy).toBe(0);
  });

  it('stop 뒤에는 더 돌지 않습니다', async () => {
    const clock = new FakeClock();
    let runs = 0;
    const loop = new SamplingLoop({
      timers: clock,
      intervalMs: 1000,
      task: () => {
        runs += 1;
      },
    });

    loop.start();
    await clock.advance(1000);
    expect(runs).toBe(1);

    loop.stop();
    await clock.advance(5000);
    expect(runs).toBe(1);
    expect(loop.running).toBe(false);
    expect(clock.nextDueAtMs()).toBeNull();
  });
});

describe('SamplingLoop 오류', () => {
  it('회차가 던져도 루프는 계속 돌고 onError 로 알립니다', async () => {
    const clock = new FakeClock();
    const seen: string[] = [];
    let runs = 0;
    const loop = new SamplingLoop({
      timers: clock,
      intervalMs: 1000,
      onError: (error: unknown) => {
        seen.push(error instanceof Error ? error.message : String(error));
      },
      task: () => {
        runs += 1;
        if (runs === 1) throw new Error('첫 회차 실패');
      },
    });

    loop.start();
    await clock.advance(2000);

    expect(seen).toEqual(['첫 회차 실패']);
    expect(runs).toBe(2); // 던진 뒤에도 다음 회차가 잡혔습니다.
    expect(loop.stats()).toMatchObject({ runs: 2, errors: 1 });
    expect(loop.inFlight).toBe(false); // 던져도 깃발이 풀립니다.
  });

  it('간격이 음수면 만들지 못합니다', () => {
    expect(() => new SamplingLoop({ task: () => {}, intervalMs: -1 })).toThrow(RangeError);
  });
});
