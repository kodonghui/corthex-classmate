// 전이표 전수 시험 — 6가지 상태 × 20가지 입력 = 120칸을 모두 훑습니다.
//
// 표는 두 가지를 봅니다.
//   (1) 표에 칸이 있는지(있어야 할 칸 93개 · 없어야 할 칸 27개)
//   (2) 그 칸을 실제로 밀었을 때 어느 상태로 가는지, 아니면 `ignored` 로 남는지

import { TUTOR_STATES } from "@classmate/contracts";
import type { TutorState } from "@classmate/contracts";
import { describe, expect, it } from "vitest";

import type { InputKind, MachineInput, MachineState } from "../src/index";
import {
  createEnv,
  formatIso,
  hasRule,
  INPUT_KINDS,
  initialState,
  transition,
  TRANSITION_TABLE,
} from "../src/index";
import { PERIOD_ID, T_ASKED, TINY_SNAPSHOT } from "./helpers";

const ENV = createEnv(PERIOD_ID);
const NOW = T_ASKED;
const AT = formatIso(NOW, ENV.tzOffsetMinutes);

/** 각 상태에서 시험이 미는 대표 상태입니다. 조건이 붙은 칸은 따로 machine.test.ts 가 봅니다. */
function canonical(state: TutorState): MachineState {
  const base = { ...initialState(NOW), state };
  if (state === "CAPTURE") {
    // 한 번 붙잡았다가 접힌 뒤(상태 E)입니다. 교시는 아직 끝나지 않았습니다.
    return { ...base, note: "folded", questionId: "q-1", answerId: "a-1", answerStatus: "answered" };
  }
  if (state === "ANSWER_MINIMAL") {
    // 한 줄 결론이 떠 있고 접힘 시계가 도는 중입니다.
    return {
      ...base,
      note: "minimal",
      questionId: "q-1",
      answerId: "a-1",
      answerStatus: "answered",
      prepUntil: NOW - 5_000,
      foldDeadline: NOW + 18_000,
    };
  }
  // 교시 뒤 네 화면입니다.
  return { ...base, note: "none", periodEnded: true };
}

const PAYLOADS: Readonly<Record<string, Record<string, unknown>>> = {
  "period.started": { periodId: PERIOD_ID, subject: "IoC 컨테이너와 의존성 주입", index: 3 },
  "period.ended": { periodId: PERIOD_ID, questionCount: 1, frameCount: 1 },
  "transcript.segment": { segmentId: "ts-9", seq: 9, state: "final" },
  "screen.frame": { screenFrameId: "sf-9", changedFromPrev: true },
  "editor.context": { editorContextId: "ec-9" },
  "question.asked": { questionId: "q-2", kind: "confused", word: "new" },
  "answer.completed": { questionId: "q-2", answerId: "a-2", provider: "mock" },
  "answer.queued": { questionId: "q-2", answerId: "a-2-queued" },
  "answer.failed": { questionId: "q-2", provider: "mock" },
  "answer.recovered": { questionId: "q-2", answerId: "a-2", provider: "mock" },
  "state.changed": { from: "CAPTURE", to: "ANSWER_MINIMAL" },
  "panel.opened": {},
  "panel.closed": {},
  "connector.status": { connector: "tiro-share", state: "connected", latencySec: 6 },
};

function makeInput(kind: InputKind): MachineInput {
  switch (kind) {
    case "stuck":
      return {
        kind: "stuck",
        now: NOW,
        questionId: "q-2",
        questionKind: "confused",
        snapshot: TINY_SNAPSHOT,
        word: "new",
      };
    case "chip":
      return { kind: "chip", now: NOW, chipId: "더 쉽게" };
    case "detail":
      return { kind: "detail", now: NOW };
    case "back":
      return { kind: "back", now: NOW };
    case "next":
      return { kind: "next", now: NOW };
    case "tick":
      return { kind: "tick", now: NOW };
    default:
      return {
        kind: "event",
        event: { id: `ev-${kind}`, periodId: PERIOD_ID, at: AT, type: kind, payload: PAYLOADS[kind] ?? {} },
        ...(kind === "question.asked" ? { snapshot: TINY_SNAPSHOT } : {}),
      };
  }
}

/** (1) 표에 있어야 할 칸 목록입니다. 여기 없는 칸은 무시되어야 합니다. */
const RULE_CELLS: Readonly<Record<TutorState, readonly InputKind[]>> = {
  CAPTURE: [
    "period.started",
    "period.ended",
    "transcript.segment",
    "screen.frame",
    "editor.context",
    "question.asked",
    "answer.completed",
    "answer.queued",
    "answer.failed",
    "answer.recovered",
    "panel.opened",
    "panel.closed",
    "connector.status",
    "stuck",
    "detail",
    "next",
    "tick",
  ],
  ANSWER_MINIMAL: [
    "period.started",
    "period.ended",
    "transcript.segment",
    "screen.frame",
    "editor.context",
    "question.asked",
    "answer.completed",
    "answer.queued",
    "answer.failed",
    "answer.recovered",
    "panel.opened",
    "panel.closed",
    "connector.status",
    "stuck",
    "chip",
    "detail",
    "back",
    "tick",
  ],
  EXIT_RECALL: [
    "period.started",
    "transcript.segment",
    "screen.frame",
    "editor.context",
    "question.asked",
    "answer.completed",
    "answer.queued",
    "answer.failed",
    "answer.recovered",
    "panel.opened",
    "panel.closed",
    "connector.status",
    "stuck",
    "back",
    "next",
    "tick",
  ],
  FEEDBACK: [
    "period.started",
    "transcript.segment",
    "screen.frame",
    "editor.context",
    "answer.completed",
    "answer.queued",
    "answer.failed",
    "answer.recovered",
    "panel.opened",
    "panel.closed",
    "connector.status",
    "back",
    "next",
    "tick",
  ],
  FADE_SUPPORT: [
    "period.started",
    "transcript.segment",
    "screen.frame",
    "editor.context",
    "answer.completed",
    "answer.queued",
    "answer.failed",
    "answer.recovered",
    "panel.opened",
    "panel.closed",
    "connector.status",
    "back",
    "next",
    "tick",
  ],
  DELAYED_CHECK: [
    "period.started",
    "transcript.segment",
    "screen.frame",
    "editor.context",
    "answer.completed",
    "answer.queued",
    "answer.failed",
    "answer.recovered",
    "panel.opened",
    "panel.closed",
    "connector.status",
    "back",
    "next",
    "tick",
  ],
};

/** (2) 대표 상태에서 그 입력을 밀었을 때의 결과입니다. "ignored" 는 아무것도 하지 않는다는 뜻입니다. */
type Outcome = TutorState | "ignored";

const OUTCOMES: Readonly<Record<TutorState, Readonly<Record<InputKind, Outcome>>>> = {
  CAPTURE: {
    "period.started": "CAPTURE",
    "period.ended": "CAPTURE",
    "transcript.segment": "CAPTURE",
    "screen.frame": "CAPTURE",
    "editor.context": "CAPTURE",
    "question.asked": "ANSWER_MINIMAL",
    "answer.completed": "CAPTURE",
    "answer.queued": "CAPTURE",
    "answer.failed": "CAPTURE",
    "answer.recovered": "CAPTURE",
    "state.changed": "ignored",
    "panel.opened": "CAPTURE",
    "panel.closed": "CAPTURE",
    "connector.status": "CAPTURE",
    stuck: "ANSWER_MINIMAL",
    chip: "ignored",
    detail: "ANSWER_MINIMAL",
    back: "ignored",
    // 교시가 아직 안 끝나서 회상으로 넘어갈 수 없습니다.
    next: "ignored",
    tick: "CAPTURE",
  },
  ANSWER_MINIMAL: {
    "period.started": "CAPTURE",
    "period.ended": "CAPTURE",
    "transcript.segment": "ANSWER_MINIMAL",
    "screen.frame": "ANSWER_MINIMAL",
    "editor.context": "ANSWER_MINIMAL",
    "question.asked": "ANSWER_MINIMAL",
    "answer.completed": "ANSWER_MINIMAL",
    "answer.queued": "ANSWER_MINIMAL",
    "answer.failed": "ANSWER_MINIMAL",
    "answer.recovered": "ANSWER_MINIMAL",
    "state.changed": "ignored",
    "panel.opened": "ANSWER_MINIMAL",
    "panel.closed": "ANSWER_MINIMAL",
    "connector.status": "ANSWER_MINIMAL",
    stuck: "ANSWER_MINIMAL",
    chip: "ANSWER_MINIMAL",
    detail: "ANSWER_MINIMAL",
    back: "CAPTURE",
    next: "ignored",
    // 아직 18초가 남아 접히지 않습니다.
    tick: "ANSWER_MINIMAL",
  },
  EXIT_RECALL: {
    "period.started": "CAPTURE",
    "period.ended": "ignored",
    "transcript.segment": "EXIT_RECALL",
    "screen.frame": "EXIT_RECALL",
    "editor.context": "EXIT_RECALL",
    "question.asked": "EXIT_RECALL",
    "answer.completed": "EXIT_RECALL",
    "answer.queued": "EXIT_RECALL",
    "answer.failed": "EXIT_RECALL",
    "answer.recovered": "EXIT_RECALL",
    "state.changed": "ignored",
    "panel.opened": "EXIT_RECALL",
    "panel.closed": "EXIT_RECALL",
    "connector.status": "EXIT_RECALL",
    stuck: "EXIT_RECALL",
    chip: "ignored",
    detail: "ignored",
    back: "CAPTURE",
    next: "FEEDBACK",
    tick: "EXIT_RECALL",
  },
  FEEDBACK: {
    "period.started": "CAPTURE",
    "period.ended": "ignored",
    "transcript.segment": "FEEDBACK",
    "screen.frame": "FEEDBACK",
    "editor.context": "FEEDBACK",
    "question.asked": "ignored",
    "answer.completed": "FEEDBACK",
    "answer.queued": "FEEDBACK",
    "answer.failed": "FEEDBACK",
    "answer.recovered": "FEEDBACK",
    "state.changed": "ignored",
    "panel.opened": "FEEDBACK",
    "panel.closed": "FEEDBACK",
    "connector.status": "FEEDBACK",
    stuck: "ignored",
    chip: "ignored",
    detail: "ignored",
    back: "CAPTURE",
    next: "FADE_SUPPORT",
    tick: "FEEDBACK",
  },
  FADE_SUPPORT: {
    "period.started": "CAPTURE",
    "period.ended": "ignored",
    "transcript.segment": "FADE_SUPPORT",
    "screen.frame": "FADE_SUPPORT",
    "editor.context": "FADE_SUPPORT",
    "question.asked": "ignored",
    "answer.completed": "FADE_SUPPORT",
    "answer.queued": "FADE_SUPPORT",
    "answer.failed": "FADE_SUPPORT",
    "answer.recovered": "FADE_SUPPORT",
    "state.changed": "ignored",
    "panel.opened": "FADE_SUPPORT",
    "panel.closed": "FADE_SUPPORT",
    "connector.status": "FADE_SUPPORT",
    stuck: "ignored",
    chip: "ignored",
    detail: "ignored",
    back: "CAPTURE",
    next: "DELAYED_CHECK",
    tick: "FADE_SUPPORT",
  },
  DELAYED_CHECK: {
    "period.started": "CAPTURE",
    "period.ended": "ignored",
    "transcript.segment": "DELAYED_CHECK",
    "screen.frame": "DELAYED_CHECK",
    "editor.context": "DELAYED_CHECK",
    "question.asked": "ignored",
    "answer.completed": "DELAYED_CHECK",
    "answer.queued": "DELAYED_CHECK",
    "answer.failed": "DELAYED_CHECK",
    "answer.recovered": "DELAYED_CHECK",
    "state.changed": "ignored",
    "panel.opened": "DELAYED_CHECK",
    "panel.closed": "DELAYED_CHECK",
    "connector.status": "DELAYED_CHECK",
    stuck: "ignored",
    chip: "ignored",
    detail: "ignored",
    back: "CAPTURE",
    next: "CAPTURE",
    tick: "DELAYED_CHECK",
  },
};

describe("전이표", () => {
  it("입력은 사건 14가지 + 조작 6가지 = 20가지다", () => {
    expect(INPUT_KINDS).toHaveLength(20);
    expect(new Set(INPUT_KINDS).size).toBe(20);
  });

  it("표에 있는 칸과 없는 칸이 적어 둔 목록과 같다 (6 × 20 = 120칸)", () => {
    let cells = 0;
    let rules = 0;
    for (const state of TUTOR_STATES) {
      const expected = new Set(RULE_CELLS[state]);
      for (const input of INPUT_KINDS) {
        cells += 1;
        expect(hasRule(state, input), `${state} × ${input}`).toBe(expected.has(input));
        if (expected.has(input)) rules += 1;
      }
    }
    expect(cells).toBe(120);
    expect(rules).toBe(93);
  });

  it("모든 칸에 무엇을 하는지 적은 한 줄이 있다", () => {
    for (const state of TUTOR_STATES) {
      for (const [input, rule] of Object.entries(TRANSITION_TABLE[state])) {
        if (rule === undefined) continue;
        expect(rule.note.length, `${state} × ${input}`).toBeGreaterThan(0);
      }
    }
  });

  it("120칸을 모두 밀어 보면 적어 둔 결과와 같다", () => {
    let checked = 0;
    for (const state of TUTOR_STATES) {
      for (const input of INPUT_KINDS) {
        const before = canonical(state);
        const { next, effects } = transition(before, makeInput(input), ENV);
        const ignored = effects.some((effect) => effect.kind === "ignored");
        const expected = OUTCOMES[state][input];
        const label = `${state} × ${input}`;

        if (expected === "ignored") {
          expect(ignored, label).toBe(true);
          expect(next.state, label).toBe(state);
          // 무시한 칸은 시각만 옮기고 나머지는 그대로 둡니다.
          expect({ ...next, now: before.now }, label).toEqual(before);
        } else {
          expect(ignored, label).toBe(false);
          expect(next.state, label).toBe(expected);
        }
        checked += 1;
      }
    }
    expect(checked).toBe(120);
  });

  it("상태 이름이 바뀐 칸에서만 state.changed 초안이 나온다", () => {
    for (const state of TUTOR_STATES) {
      for (const input of INPUT_KINDS) {
        const before = canonical(state);
        const { next, effects } = transition(before, makeInput(input), ENV);
        const changes = effects.filter(
          (effect) => effect.kind === "emit" && effect.event.type === "state.changed",
        );
        const label = `${state} × ${input}`;
        if (next.state === state) {
          expect(changes, label).toHaveLength(0);
          continue;
        }
        expect(changes, label).toHaveLength(1);
        const first = changes[0];
        if (first === undefined || first.kind !== "emit") throw new Error(label);
        expect(first.event.payload, label).toEqual({ from: state, to: next.state });
        expect(first.event.periodId, label).toBe(PERIOD_ID);
        expect(first.event.at, label).toBe(AT);
        // 상태 변경 초안은 언제나 효과 맨 앞에 옵니다.
        expect(effects[0], label).toBe(first);
      }
    }
  });

  it("무시한 칸의 ignored 효과에는 어느 상태에서 어떤 입력이었는지가 남는다", () => {
    const { effects } = transition(canonical("FEEDBACK"), makeInput("chip"), ENV);
    expect(effects).toEqual([{ kind: "ignored", state: "FEEDBACK", input: "chip" }]);
  });
});
