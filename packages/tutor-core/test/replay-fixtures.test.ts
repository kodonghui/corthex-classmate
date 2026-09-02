// e2e — 골든 시나리오 27줄을 시간순으로 흘려 상태기계가 fixture 를 그대로 다시 그리는지 봅니다.
//
// 재생 방법: 첫 사건부터 마지막 사건까지 1초씩 걸어가며, 그 초에 있는 사건을 순서대로 넣고
// 마지막에 tick 을 한 번 넣습니다(디자인 정본의 "매초 tick").
// fixture 안의 `state.changed` 4줄은 **상태기계가 내야 할 답**이므로 입력으로는 무시됩니다.

import { createValidator, formatErrors } from "@classmate/contracts";
import type { Question, SessionEvent } from "@classmate/contracts";
import { describe, expect, it } from "vitest";

import type { Effect, MachineInput } from "../src/index";
import { createEnv, initialState, parseIso, runAll, sealSnapshot } from "../src/index";
import {
  loadEditor,
  loadEvents,
  loadFrames,
  loadQuestion,
  loadTranscript,
  must,
  PERIOD_ID,
} from "./helpers";

const ENV = createEnv(PERIOD_ID);
const events = loadEvents();
const transcript = loadTranscript();
const frames = loadFrames();
const editor = loadEditor();

/** 그 사건이 질문이면 그 시각으로 봉인해 함께 넣어 줍니다. 실제 앱에서는 문맥 수집기가 하는 일입니다. */
function toInput(event: SessionEvent): MachineInput {
  if (event.type !== "question.asked") {
    return { kind: "event", event };
  }
  return {
    kind: "event",
    event,
    snapshot: sealSnapshot({
      askedAt: event.at,
      transcript,
      frames,
      editor: [editor],
      recentParagraphs: 3,
    }),
  };
}

/** 1초씩 걸으며 사건과 tick 을 차례로 넣습니다. */
function buildInputs(): MachineInput[] {
  const first = parseIso(must(events[0], "첫 사건").at);
  const last = parseIso(must(events.at(-1), "마지막 사건").at);
  const inputs: MachineInput[] = [];
  for (let t = first; t <= last; t += 1_000) {
    for (const event of events) {
      if (parseIso(event.at) === t) inputs.push(toInput(event));
    }
    inputs.push({ kind: "tick", now: t });
  }
  return inputs;
}

function stateChangeEffects(effects: readonly Effect[]): { at: string; payload: unknown }[] {
  return effects.flatMap((effect) =>
    effect.kind === "emit" && effect.event.type === "state.changed"
      ? [{ at: effect.event.at, payload: effect.event.payload }]
      : [],
  );
}

describe("골든 시나리오 재생", () => {
  const inputs = buildInputs();
  const result = runAll(initialState(parseIso(must(events[0], "첫 사건").at)), inputs, ENV);
  const fixtureChanges = events.filter((event) => event.type === "state.changed");

  it("fixture 는 27줄이고 그 중 state.changed 가 4줄이다", () => {
    expect(events).toHaveLength(27);
    expect(fixtureChanges).toHaveLength(4);
  });

  it("상태 변화 4건의 from · to 가 fixture 와 같다", () => {
    const produced = stateChangeEffects(result.effects);
    expect(produced.map((change) => change.payload)).toEqual(
      fixtureChanges.map((event) => event.payload),
    );
    expect(produced).toHaveLength(4);
  });

  it("앞의 세 건은 시각까지 fixture 와 같다", () => {
    const produced = stateChangeEffects(result.effects);
    for (const index of [0, 1, 2]) {
      expect(must(produced[index], `상태 변화 ${index}`).at).toBe(
        must(fixtureChanges[index], `fixture 상태 변화 ${index}`).at,
      );
    }
    // 네 번째는 fixture 가 10:33:09(사람이 "수업으로 돌아가기" 를 누른 시각)이고,
    // 사람 조작은 JSONL 에 없으므로 재생에서는 period.ended(10:33:14)가 그 자리를 대신합니다.
    // from · to 는 같고 시각만 5초 늦습니다.
    expect(must(produced[3], "상태 변화 3").at).toBe("2026-09-02T10:33:14+09:00");
    expect(must(fixtureChanges[3], "fixture 상태 변화 3").at).toBe("2026-09-02T10:33:09+09:00");
  });

  it("두 번째 상태 변화는 답이 뜬 뒤 18초(10:32:42)에 저절로 접힌 것이다", () => {
    const produced = stateChangeEffects(result.effects);
    expect(must(produced[1], "두 번째 상태 변화").at).toBe("2026-09-02T10:32:42+09:00");
  });

  it("fixture 의 state.changed 줄은 입력으로 들어와도 무시된다", () => {
    const ignored = result.effects.filter((effect) => effect.kind === "ignored");
    expect(ignored).toHaveLength(4);
    expect(ignored.every((effect) => effect.kind === "ignored" && effect.input === "state.changed")).toBe(
      true,
    );
  });

  it("질문 두 번에 대해 제공자에게 묻고, 봉인은 question.json 과 똑같다", () => {
    const asks = result.effects.flatMap((effect) => (effect.kind === "ask" ? [effect] : []));
    expect(asks.map((ask) => ask.questionId)).toEqual(["q-p3-001", "q-p3-002"]);
    expect(asks.every((ask) => ask.provider === "mock")).toBe(true);

    const first = loadQuestion("question.json");
    const second = loadQuestion("question-2.json");
    expect(must(asks[0], "첫 질문 ask").snapshot).toEqual(first.snapshot);
    expect(must(asks[1], "두 번째 질문 ask").snapshot).toEqual(second.snapshot);

    // 봉인을 넣은 Question 이 계약 검증기를 통과합니다.
    const validate = createValidator<Question>("question");
    const rebuilt: Question = {
      id: first.id,
      periodId: first.periodId,
      askedAt: first.askedAt,
      kind: first.kind,
      snapshot: must(must(asks[0], "첫 질문 ask").snapshot, "첫 질문 봉인"),
    };
    expect(validate(rebuilt), formatErrors(validate.errors).join(" / ")).toBe(true);
  });

  it("재생이 끝나면 조용한 기록으로 돌아가 있고 마지막 답은 되살아난 것이다", () => {
    expect(result.next.state).toBe("CAPTURE");
    expect(result.next.note).toBe("folded");
    expect(result.next.questionId).toBe("q-p3-002");
    expect(result.next.answerId).toBe("ans-p3-002");
    expect(result.next.answerStatus).toBe("recovered");
    expect(result.next.periodEnded).toBe(true);
    expect(result.next.lastSegmentId).toBe("ts-p3-009");
    expect(result.next.lastFrameId).toBe("sf-p3-002");
    expect(result.next.lastEditorId).toBe("ec-p3-001");
    expect(result.next.connectors).toEqual({
      "tiro-share": "connected",
      "meet-tab": "connected",
      "intellij-mcp": "connected",
    });
  });

  it("걸어간 초마다 tick 이 한 번씩 들어갔다", () => {
    const ticks = inputs.filter((input) => input.kind === "tick");
    expect(ticks).toHaveLength(100); // 10:31:35 ~ 10:33:14
    expect(inputs.filter((input) => input.kind === "event")).toHaveLength(27);
  });
});
