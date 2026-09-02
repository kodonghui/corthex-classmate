// 18초 접힘 시계 — 상태기계가 낸 예약·취소 효과를 실제 시간에 붙여 주는 자리입니다.
//
// 이 패키지는 브라우저 API 를 직접 부르지 않습니다. "지금 몇 시인가"(Clock)와
// "얼마 뒤에 이 일을 해 달라"(Scheduler)를 **밖에서 넣어 받습니다.** 확장에서는 브라우저의
// 예약 기능을 감싼 것을 넣고, 시험에서는 손으로 미는 가짜 시계를 넣습니다.
//
// 접힘 규칙(docs/design-map.md §4-3):
//   · 한 줄 결론이 뜨면 18초를 센다
//   · 칩을 누르면 18초로 되돌린다(reset)
//   · 자세히로 들어가면 멈춘다(cancel)
//   · 자세히에서 돌아오면 다시 18초를 센다

import type { Effect } from "./machine";
import { FOLD_MS } from "./machine";

/** 예약을 물리는 손잡이입니다. 부르면 그 예약은 일어나지 않습니다. */
export type Cancel = () => void;

/** 지금 몇 시인지 알려 주는 것입니다. 단위는 epoch 밀리초입니다. */
export interface Clock {
  now(): number;
}

/** 얼마 뒤에 한 번 불러 달라고 부탁하는 것입니다. */
export interface Scheduler {
  schedule(delayMs: number, run: () => void): Cancel;
}

export interface FoldTimerDeps {
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  /** 접힐 시각이 되면 부릅니다. 인자는 접히기로 한 시각(ms)입니다. */
  readonly onFold: (at: number) => void;
  /** 기본 18000ms 입니다. */
  readonly foldMs?: number;
}

/**
 * 접힘 시계 하나입니다. 예약은 언제나 하나만 살아 있습니다.
 *
 *     const timer = new FoldTimer({ clock, scheduler, onFold: () => send({ kind: "tick", now: clock.now() }) });
 *     timer.apply(effects);   // 상태기계가 낸 schedule · cancel 효과를 그대로 반영
 */
export class FoldTimer {
  readonly #clock: Clock;
  readonly #scheduler: Scheduler;
  readonly #onFold: (at: number) => void;
  readonly #foldMs: number;
  #cancel: Cancel | null = null;
  #deadline: number | null = null;

  constructor(deps: FoldTimerDeps) {
    this.#clock = deps.clock;
    this.#scheduler = deps.scheduler;
    this.#onFold = deps.onFold;
    this.#foldMs = deps.foldMs ?? FOLD_MS;
  }

  /** 접히기로 한 시각(ms)입니다. 시계가 돌지 않으면 null 입니다. */
  get deadline(): number | null {
    return this.#deadline;
  }

  get running(): boolean {
    return this.#deadline !== null;
  }

  /** 접힐 시각을 못 박아 겁니다. 이미 걸린 예약은 지우고 다시 겁니다. */
  scheduleAt(at: number): void {
    this.cancel();
    const delay = Math.max(0, at - this.#clock.now());
    this.#deadline = at;
    this.#cancel = this.#scheduler.schedule(delay, () => {
      this.#cancel = null;
      this.#deadline = null;
      this.#onFold(at);
    });
  }

  /** 지금부터 18초 뒤로 겁니다. */
  start(): void {
    this.scheduleAt(this.#clock.now() + this.#foldMs);
  }

  /** 칩을 눌렀을 때처럼 18초를 처음부터 다시 셉니다. */
  reset(): void {
    this.start();
  }

  /** 자세히로 들어갔을 때처럼 시계를 멈춥니다. 두 번 불러도 탈나지 않습니다. */
  cancel(): void {
    if (this.#cancel !== null) {
      this.#cancel();
    }
    this.#cancel = null;
    this.#deadline = null;
  }

  /** 상태기계가 낸 효과 목록에서 접힘 관련만 골라 반영합니다. */
  apply(effects: readonly Effect[]): void {
    for (const effect of effects) {
      if (effect.kind === "schedule" && effect.timer === "fold") {
        this.scheduleAt(effect.at);
      } else if (effect.kind === "cancel" && effect.timer === "fold") {
        this.cancel();
      }
    }
  }
}
