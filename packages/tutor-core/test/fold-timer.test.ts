// 접힘 시계 시험 — 가짜 시계와 가짜 예약기로 18초를 손으로 밉니다.

import { describe, expect, it } from "vitest";

import { createEnv, FOLD_MS, FoldTimer, formatIso, transition } from "../src/index";
import { ManualClock, ManualScheduler, PERIOD_ID, stateAt, T_ASKED } from "./helpers";

const ENV = createEnv(PERIOD_ID);

function setup(start = T_ASKED) {
  const clock = new ManualClock(start);
  const scheduler = new ManualScheduler(clock);
  const folded: number[] = [];
  const timer = new FoldTimer({ clock, scheduler, onFold: (at) => folded.push(at) });
  return { clock, scheduler, timer, folded };
}

describe("FoldTimer", () => {
  it("18초가 지나야 접힌다", () => {
    const { clock, scheduler, timer, folded } = setup();
    timer.start();
    expect(timer.deadline).toBe(T_ASKED + FOLD_MS);

    clock.advance(FOLD_MS - 1);
    scheduler.runDue();
    expect(folded).toEqual([]);

    clock.advance(1);
    scheduler.runDue();
    expect(folded).toEqual([T_ASKED + FOLD_MS]);
    expect(timer.running).toBe(false);
  });

  it("칩을 누른 것처럼 리셋하면 그때부터 다시 18초를 센다", () => {
    const { clock, scheduler, timer, folded } = setup();
    timer.start();

    clock.advance(12_000);
    timer.reset();
    expect(timer.deadline).toBe(T_ASKED + 12_000 + FOLD_MS);

    clock.advance(FOLD_MS - 1);
    scheduler.runDue();
    expect(folded).toEqual([]);

    clock.advance(1);
    scheduler.runDue();
    expect(folded).toEqual([T_ASKED + 12_000 + FOLD_MS]);
    // 리셋 전에 걸어 둔 예약이 되살아나지 않습니다.
    expect(scheduler.pending).toBe(0);
  });

  it("자세히로 들어간 것처럼 멈추면 아무 일도 일어나지 않는다", () => {
    const { clock, scheduler, timer, folded } = setup();
    timer.start();
    timer.cancel();
    timer.cancel();

    clock.advance(FOLD_MS * 2);
    scheduler.runDue();
    expect(folded).toEqual([]);
    expect(timer.running).toBe(false);
  });

  it("상태기계가 낸 schedule · cancel 효과를 그대로 따라간다", () => {
    const { clock, scheduler, timer, folded } = setup();

    const ready = stateAt(T_ASKED, {
      state: "ANSWER_MINIMAL",
      note: "minimal",
      questionId: "q-1",
      prepUntil: T_ASKED - 5_000,
      foldDeadline: T_ASKED + FOLD_MS,
    });
    timer.scheduleAt(T_ASKED + FOLD_MS);

    // 칩 클릭 → 18초 리셋
    clock.advance(5_000);
    const chip = transition(ready, { kind: "chip", now: clock.now(), chipId: "더 쉽게" }, ENV);
    timer.apply(chip.effects);
    expect(timer.deadline).toBe(clock.now() + FOLD_MS);

    // 자세히 열기 → 멈춤
    const detail = transition(chip.next, { kind: "detail", now: clock.now() }, ENV);
    timer.apply(detail.effects);
    expect(timer.running).toBe(false);

    clock.advance(FOLD_MS * 2);
    scheduler.runDue();
    expect(folded).toEqual([]);

    // 수업으로 돌아가기 → 다시 18초
    const back = transition(detail.next, { kind: "back", now: clock.now() }, ENV);
    timer.apply(back.effects);
    expect(timer.deadline).toBe(clock.now() + FOLD_MS);

    clock.advance(FOLD_MS);
    scheduler.runDue();
    expect(folded).toHaveLength(1);

    // 접힘 시각이 오면 상태기계도 tick 으로 같은 판단을 합니다.
    const folding = transition(back.next, { kind: "tick", now: clock.now() }, ENV);
    expect(folding.next.state).toBe("CAPTURE");
    expect(folding.next.note).toBe("folded");
    expect(folding.effects[0]).toEqual({
      kind: "emit",
      event: {
        periodId: PERIOD_ID,
        at: formatIso(clock.now(), ENV.tzOffsetMinutes),
        type: "state.changed",
        payload: { from: "ANSWER_MINIMAL", to: "CAPTURE" },
      },
    });
  });
});
