// 조건이 붙은 칸과 시간이 걸린 갈래를 봅니다. 표 전수 시험은 machine-table.test.ts 가 합니다.

import { describe, expect, it } from "vitest";

import type { Effect, MachineState } from "../src/index";
import {
  createEnv,
  FOLD_MS,
  formatIso,
  initialState,
  inputTimeOf,
  MachineError,
  PREP_MS,
  runAll,
  transition,
} from "../src/index";
import { event, eventInput, PERIOD_ID, stateAt, T_ASKED, TINY_SNAPSHOT } from "./helpers";

const ENV = createEnv(PERIOD_ID);
const AT = formatIso(T_ASKED, ENV.tzOffsetMinutes);

function schedules(effects: readonly Effect[]): number[] {
  return effects.flatMap((effect) =>
    effect.kind === "schedule" && effect.timer === "fold" ? [effect.at] : [],
  );
}

function askedState(): MachineState {
  const start = stateAt(T_ASKED - 1_000);
  const asked = transition(
    start,
    eventInput(event("question.asked", AT, { questionId: "q-1", kind: "confused" }), TINY_SNAPSHOT),
    ENV,
  );
  return asked.next;
}

describe("붙잡기", () => {
  it("question.asked 는 준비 자리로 가고 제공자에게 물을 효과를 낸다", () => {
    const { next, effects } = transition(
      stateAt(T_ASKED - 1_000),
      eventInput(
        event("question.asked", AT, { questionId: "q-1", kind: "confused", word: "new" }),
        TINY_SNAPSHOT,
      ),
      ENV,
    );

    expect(next.state).toBe("ANSWER_MINIMAL");
    expect(next.note).toBe("preparing");
    expect(next.provider).toBe("asking");
    expect(next.questionId).toBe("q-1");
    expect(next.prepUntil).toBe(T_ASKED + PREP_MS);
    expect(effects).toEqual([
      {
        kind: "emit",
        event: {
          periodId: PERIOD_ID,
          at: AT,
          type: "state.changed",
          payload: { from: "CAPTURE", to: "ANSWER_MINIMAL" },
        },
      },
      { kind: "ask", provider: "mock", questionId: "q-1", snapshot: TINY_SNAPSHOT },
    ]);
  });

  it("붙잡기 버튼(stuck)은 question.asked 초안까지 함께 남긴다", () => {
    const { next, effects } = transition(
      stateAt(T_ASKED),
      {
        kind: "stuck",
        now: T_ASKED,
        questionId: "q-9",
        questionKind: "missed",
        snapshot: TINY_SNAPSHOT,
        word: "컨테이너",
      },
      ENV,
    );

    expect(next.note).toBe("preparing");
    const emitted = effects.flatMap((effect) => (effect.kind === "emit" ? [effect.event] : []));
    expect(emitted[1]).toEqual({
      periodId: PERIOD_ID,
      at: AT,
      type: "question.asked",
      payload: { questionId: "q-9", kind: "missed", word: "컨테이너" },
    });
  });
});

describe("준비 시간(PREP 1.6초)", () => {
  it("답이 준비 시간보다 빨리 오면 붙들어 두었다가 시간이 지나면 보여 준다", () => {
    const asked = askedState();
    const early = transition(
      asked,
      eventInput(
        event("answer.completed", formatIso(T_ASKED + 500, ENV.tzOffsetMinutes), {
          questionId: "q-1",
          answerId: "a-1",
        }),
      ),
      ENV,
    );

    // 아직 준비 문구를 보여 주는 중이라 접힘 시계도 걸지 않습니다.
    expect(early.next.note).toBe("preparing");
    expect(early.next.pendingAnswer).toEqual({ answerId: "a-1", status: "answered" });
    expect(schedules(early.effects)).toEqual([]);

    const stillEarly = transition(early.next, { kind: "tick", now: T_ASKED + 1_000 }, ENV);
    expect(stillEarly.next.note).toBe("preparing");

    const ready = transition(early.next, { kind: "tick", now: T_ASKED + PREP_MS }, ENV);
    expect(ready.next.note).toBe("minimal");
    expect(ready.next.answerStatus).toBe("answered");
    expect(ready.next.pendingAnswer).toBeNull();
    expect(schedules(ready.effects)).toEqual([T_ASKED + PREP_MS + FOLD_MS]);
  });

  it("답이 준비 시간 뒤에 오면 그 자리에서 바로 한 줄 결론이 된다", () => {
    const asked = askedState();
    const late = T_ASKED + 6_000;
    const { next, effects } = transition(
      asked,
      eventInput(
        event("answer.completed", formatIso(late, ENV.tzOffsetMinutes), {
          questionId: "q-1",
          answerId: "a-1",
        }),
      ),
      ENV,
    );

    expect(next.note).toBe("minimal");
    expect(next.foldDeadline).toBe(late + FOLD_MS);
    expect(schedules(effects)).toEqual([late + FOLD_MS]);
  });
});

describe("18초 접힘", () => {
  const ready = stateAt(T_ASKED, {
    state: "ANSWER_MINIMAL",
    note: "minimal",
    questionId: "q-1",
    answerId: "a-1",
    answerStatus: "answered",
    prepUntil: T_ASKED - 5_000,
    foldDeadline: T_ASKED + FOLD_MS,
  });

  it("18초가 지나면 접히고 CAPTURE 로 돌아간다", () => {
    const before = transition(ready, { kind: "tick", now: T_ASKED + FOLD_MS - 1 }, ENV);
    expect(before.next.state).toBe("ANSWER_MINIMAL");

    const folded = transition(ready, { kind: "tick", now: T_ASKED + FOLD_MS }, ENV);
    expect(folded.next.state).toBe("CAPTURE");
    expect(folded.next.note).toBe("folded");
    expect(folded.next.foldDeadline).toBeNull();
    expect(folded.effects[0]).toEqual({
      kind: "emit",
      event: {
        periodId: PERIOD_ID,
        at: formatIso(T_ASKED + FOLD_MS, ENV.tzOffsetMinutes),
        type: "state.changed",
        payload: { from: "ANSWER_MINIMAL", to: "CAPTURE" },
      },
    });
  });

  it("칩을 누르면 18초를 처음부터 다시 센다", () => {
    const at = T_ASKED + 12_000;
    const { next, effects } = transition(ready, { kind: "chip", now: at, chipId: "더 쉽게" }, ENV);
    expect(next.foldDeadline).toBe(at + FOLD_MS);
    expect(schedules(effects)).toEqual([at + FOLD_MS]);
  });

  it("자세히를 열면 시계를 멈추고, 돌아오면 다시 18초를 센다", () => {
    const opened = transition(ready, { kind: "detail", now: T_ASKED + 3_000 }, ENV);
    expect(opened.next.note).toBe("detail");
    expect(opened.next.foldDeadline).toBeNull();
    expect(opened.effects).toEqual([{ kind: "cancel", timer: "fold" }]);

    const back = transition(opened.next, { kind: "back", now: T_ASKED + 30_000 }, ENV);
    expect(back.next.state).toBe("ANSWER_MINIMAL");
    expect(back.next.note).toBe("minimal");
    expect(back.next.foldDeadline).toBe(T_ASKED + 30_000 + FOLD_MS);
  });

  it("접힌 메모를 다시 누르면 펴지고 18초를 다시 센다", () => {
    const folded = stateAt(T_ASKED, { note: "folded", questionId: "q-1" });
    const { next, effects } = transition(folded, { kind: "detail", now: T_ASKED }, ENV);
    expect(next.state).toBe("ANSWER_MINIMAL");
    expect(next.note).toBe("minimal");
    expect(schedules(effects)).toEqual([T_ASKED + FOLD_MS]);
  });

  it("붙잡은 것이 없으면 자세히는 무시된다", () => {
    const { effects } = transition(stateAt(T_ASKED), { kind: "detail", now: T_ASKED }, ENV);
    expect(effects).toEqual([{ kind: "ignored", state: "CAPTURE", input: "detail" }]);
  });

  it("자동 접기를 끄면 시계를 아예 걸지 않는다", () => {
    const off = createEnv(PERIOD_ID, { autoFold: false });
    const asked = transition(
      stateAt(T_ASKED - 5_000),
      eventInput(event("question.asked", formatIso(T_ASKED - 5_000, off.tzOffsetMinutes), {
        questionId: "q-1",
        kind: "confused",
      })),
      off,
    );
    const { next, effects } = transition(
      asked.next,
      eventInput(event("answer.completed", AT, { questionId: "q-1", answerId: "a-1" })),
      off,
    );
    expect(next.note).toBe("minimal");
    expect(next.foldDeadline).toBeNull();
    expect(schedules(effects)).toEqual([]);
  });
});

describe("교시 끝과 그 뒤 단계", () => {
  it("교시가 끝나면 메모를 접고 CAPTURE 로 돌아가며 교시 종료를 기억한다", () => {
    const ready = stateAt(T_ASKED, {
      state: "ANSWER_MINIMAL",
      note: "minimal",
      questionId: "q-1",
      foldDeadline: T_ASKED + FOLD_MS,
    });
    const { next, effects } = transition(
      ready,
      eventInput(event("period.ended", AT, { periodId: PERIOD_ID })),
      ENV,
    );
    expect(next.state).toBe("CAPTURE");
    expect(next.note).toBe("folded");
    expect(next.periodEnded).toBe(true);
    expect(effects.some((effect) => effect.kind === "cancel")).toBe(true);
  });

  it("교시가 끝난 뒤에만 회상 → 피드백 → 지지 줄이기 → 나중 확인 으로 넘어간다", () => {
    const ended = transition(
      stateAt(T_ASKED),
      eventInput(event("period.ended", AT, { periodId: PERIOD_ID })),
      ENV,
    ).next;

    const walk = runAll(
      ended,
      [
        { kind: "next", now: T_ASKED + 1_000 },
        { kind: "next", now: T_ASKED + 2_000 },
        { kind: "next", now: T_ASKED + 3_000 },
        { kind: "next", now: T_ASKED + 4_000 },
      ],
      ENV,
    );

    const path = walk.effects.flatMap((effect) =>
      effect.kind === "emit" && effect.event.type === "state.changed" ? [effect.event.payload] : [],
    );
    expect(path).toEqual([
      { from: "CAPTURE", to: "EXIT_RECALL" },
      { from: "EXIT_RECALL", to: "FEEDBACK" },
      { from: "FEEDBACK", to: "FADE_SUPPORT" },
      { from: "FADE_SUPPORT", to: "DELAYED_CHECK" },
    ]);
    expect(walk.next.state).toBe("DELAYED_CHECK");
  });

  it("새 교시가 시작되면 어느 상태에서든 CAPTURE 로 돌아가고 기억을 비운다", () => {
    const late = stateAt(T_ASKED, {
      state: "DELAYED_CHECK",
      periodEnded: true,
      questionId: "q-1",
      lastSegmentId: "ts-9",
    });
    const { next } = transition(
      late,
      eventInput(event("period.started", AT, { periodId: PERIOD_ID })),
      ENV,
    );
    expect(next.state).toBe("CAPTURE");
    expect(next.questionId).toBeNull();
    expect(next.lastSegmentId).toBeNull();
    expect(next.periodEnded).toBe(false);
  });
});

describe("칩", () => {
  // 칩은 한 줄 결론 자리에만 뜹니다. 다른 자리에서 누른 것은 기록에 흔적을 남기고 무시합니다.
  const elsewhere = ["preparing", "waiting", "detail"] as const;

  for (const note of elsewhere) {
    it(`${note} 자리에서 누른 칩은 ignored 로 남는다`, () => {
      const state = stateAt(T_ASKED, {
        state: "ANSWER_MINIMAL",
        note,
        questionId: "q-1",
        prepUntil: T_ASKED + PREP_MS,
      });
      const { next, effects } = transition(
        state,
        { kind: "chip", now: T_ASKED + 100, chipId: "더 쉽게" },
        ENV,
      );
      expect(effects).toEqual([{ kind: "ignored", state: "ANSWER_MINIMAL", input: "chip" }]);
      // 시각만 옮기고 나머지는 그대로입니다.
      expect({ ...next, now: state.now }).toEqual(state);
    });
  }
});

describe("입력 시각 규칙", () => {
  it("사건의 at 이 ISO-8601 이 아니면 MachineError 를 던지고 조용히 넘기지 않는다", () => {
    const before = stateAt(T_ASKED, {
      state: "ANSWER_MINIMAL",
      note: "minimal",
      questionId: "q-1",
      foldDeadline: T_ASKED + FOLD_MS,
    });
    const broken = eventInput(event("answer.completed", "어제 오후", { answerId: "a-1" }));

    expect(() => transition(before, broken, ENV)).toThrow(MachineError);
    expect(() => transition(before, broken, ENV)).toThrow(/at 을 읽을 수 없습니다/);
    // 던진 뒤에도 넣어 준 상태는 그대로입니다(부수 효과 없음).
    expect(before.now).toBe(T_ASKED);
    expect(before.foldDeadline).toBe(T_ASKED + FOLD_MS);
  });

  it("깨진 at 이 섞이면 runAll 도 그 자리에서 멈춘다", () => {
    expect(() =>
      runAll(
        stateAt(T_ASKED),
        [
          eventInput(event("transcript.segment", AT, { segmentId: "ts-1" })),
          eventInput(event("transcript.segment", "2026-13-45T99:99:99", { segmentId: "ts-2" })),
        ],
        ENV,
      ),
    ).toThrow(MachineError);
  });

  it("inputTimeOf 는 읽을 수 있는 시각만 돌려주고 나머지는 던진다", () => {
    expect(inputTimeOf(eventInput(event("panel.opened", AT)))).toBe(T_ASKED);
    expect(inputTimeOf({ kind: "tick", now: T_ASKED })).toBe(T_ASKED);
    expect(() => inputTimeOf(eventInput(event("panel.opened", "not-a-time")))).toThrow(MachineError);
    expect(() => inputTimeOf({ kind: "tick", now: Number.NaN })).toThrow(MachineError);
  });

  it("MachineError 는 어느 입력에서 났는지 들고 있다", () => {
    try {
      inputTimeOf(eventInput(event("answer.failed", "언제인지 모름")));
      throw new Error("여기까지 오면 안 됩니다");
    } catch (error) {
      expect(error).toBeInstanceOf(MachineError);
      expect((error as InstanceType<typeof MachineError>).input).toBe("answer.failed");
      expect((error as Error).name).toBe("MachineError");
    }
  });

  it("뒤로 가는 tick 은 통째로 무시하고 까닭을 남긴다", () => {
    // 접힘 시각이 이미 지난 상태입니다. 뒤로 가는 tick 이 그대로 통하면 여기서 접혔을 것입니다.
    const ready = stateAt(T_ASKED, {
      state: "ANSWER_MINIMAL",
      note: "minimal",
      questionId: "q-1",
      prepUntil: T_ASKED - 5_000,
      foldDeadline: T_ASKED - 1,
    });
    const { next, effects } = transition(ready, { kind: "tick", now: T_ASKED - 5_000 }, ENV);

    expect(effects).toEqual([
      { kind: "ignored", state: "ANSWER_MINIMAL", input: "tick", reason: "time-went-backward" },
    ]);
    expect(next).toEqual(ready);
    expect(next.now).toBe(T_ASKED);
  });

  it("늦게 도착한 사건은 처리하되 시계를 되돌리지는 않는다", () => {
    const { next, effects } = transition(
      stateAt(T_ASKED),
      eventInput(
        event("transcript.segment", formatIso(T_ASKED - 9_000, ENV.tzOffsetMinutes), {
          segmentId: "ts-late",
        }),
      ),
      ENV,
    );
    expect(next.lastSegmentId).toBe("ts-late");
    expect(next.now).toBe(T_ASKED);
    expect(effects).toEqual([]);
  });
});

describe("조용한 기록", () => {
  it("전사·화면·편집기 사건은 상태를 바꾸지 않고 마지막 id 만 남긴다", () => {
    const { next, effects } = runAll(
      initialState(T_ASKED),
      [
        eventInput(event("transcript.segment", AT, { segmentId: "ts-p3-004" })),
        eventInput(event("screen.frame", AT, { screenFrameId: "sf-p3-001" })),
        eventInput(event("editor.context", AT, { editorContextId: "ec-p3-001" })),
        eventInput(event("connector.status", AT, { connector: "tiro-share", state: "degraded" })),
      ],
      ENV,
    );
    expect(next.state).toBe("CAPTURE");
    expect(next.lastSegmentId).toBe("ts-p3-004");
    expect(next.lastFrameId).toBe("sf-p3-001");
    expect(next.lastEditorId).toBe("ec-p3-001");
    expect(next.connectors["tiro-share"]).toBe("degraded");
    expect(effects).toEqual([]);
  });
});
