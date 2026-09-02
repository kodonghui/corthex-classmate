// 답 한 장이 지나는 길 — 특히 오류 → 대기(queued) → 되살아남(recovered) 갈래를 봅니다.

import { readFileSync } from "node:fs";

import { createValidator, formatErrors } from "@classmate/contracts";
import type { Answer } from "@classmate/contracts";
import { describe, expect, it } from "vitest";

import {
  ANSWER_STATUS_BY_EVENT,
  answerView,
  createEnv,
  FOLD_MS,
  foldNotice,
  formatIso,
  PREPARING_LINE,
  runAll,
  transition,
  WAITING_NOTE_LINE,
} from "../src/index";
import { event, eventInput, PERIOD_ID, readJson, SCHEMA_DIR, stateAt, T_ASKED, TINY_SNAPSHOT } from "./helpers";

const ENV = createEnv(PERIOD_ID);
const at = (offsetMs: number): string => formatIso(T_ASKED + offsetMs, ENV.tzOffsetMinutes);

describe("답 상태 이름", () => {
  it("계약 answer.schema.json 의 status enum 안에 있는 값만 쓴다", () => {
    const schema = JSON.parse(readFileSync(new URL("answer.schema.json", SCHEMA_DIR), "utf8")) as {
      properties: { status: { enum: string[] } };
    };
    for (const status of Object.values(ANSWER_STATUS_BY_EVENT)) {
      expect(schema.properties.status.enum).toContain(status);
    }
    expect(Object.values(ANSWER_STATUS_BY_EVENT)).toEqual([
      "answered",
      "queued",
      "error",
      "recovered",
    ]);
  });

  it("fixture 의 세 갈래 답이 모두 계약 검증기를 통과한다", () => {
    const validate = createValidator<Answer>("answer");
    for (const name of ["answer.json", "answer-queued.json", "answer-2.json"]) {
      const answer = readJson<Answer>(name);
      expect(validate(answer), `${name}: ${formatErrors(validate.errors).join(" / ")}`).toBe(true);
    }
    expect(readJson<Answer>("answer.json").status).toBe(ANSWER_STATUS_BY_EVENT["answer.completed"]);
    expect(readJson<Answer>("answer-queued.json").status).toBe(ANSWER_STATUS_BY_EVENT["answer.queued"]);
    expect(readJson<Answer>("answer-2.json").status).toBe(ANSWER_STATUS_BY_EVENT["answer.recovered"]);
  });
});

describe("오류 → 대기 → 되살아남", () => {
  const asked = transition(
    stateAt(T_ASKED - 1_000),
    eventInput(
      event("question.asked", at(0), { questionId: "q-2", kind: "code-flow" }),
      TINY_SNAPSHOT,
    ),
    ENV,
  ).next;

  it("튜터가 멈추면 대기 문구로 바뀌고 접힘 시계가 서지 않는다", () => {
    const failed = transition(
      asked,
      eventInput(event("answer.failed", at(6_000), { questionId: "q-2", provider: "mock" })),
      ENV,
    );
    expect(failed.next.state).toBe("ANSWER_MINIMAL");
    expect(failed.next.note).toBe("waiting");
    expect(failed.next.provider).toBe("failed");
    expect(failed.next.answerStatus).toBe("error");
    expect(failed.next.foldDeadline).toBeNull();
    expect(failed.effects.some((effect) => effect.kind === "schedule")).toBe(false);

    const view = answerView(failed.next, T_ASKED + 6_000);
    expect(view.waiting).toBe(true);
    expect(view.line).toBe(WAITING_NOTE_LINE);
    expect(view.foldsInSec).toBeNull();
  });

  it("대기에 남았다가 되살아나면 그때부터 18초를 센다", () => {
    const walk = runAll(
      asked,
      [
        eventInput(event("answer.failed", at(6_000), { questionId: "q-2" })),
        eventInput(
          event("answer.queued", at(7_000), { questionId: "q-2", answerId: "a-2-queued" }),
        ),
        eventInput(event("answer.recovered", at(15_000), { questionId: "q-2", answerId: "a-2" })),
      ],
      ENV,
    );

    expect(walk.next.note).toBe("minimal");
    expect(walk.next.answerId).toBe("a-2");
    expect(walk.next.answerStatus).toBe("recovered");
    expect(walk.next.provider).toBe("idle");
    expect(walk.next.foldDeadline).toBe(T_ASKED + 15_000 + FOLD_MS);
    // 상태 이름은 처음부터 끝까지 ANSWER_MINIMAL 이라 state.changed 는 나오지 않습니다.
    expect(
      walk.effects.filter(
        (effect) => effect.kind === "emit" && effect.event.type === "state.changed",
      ),
    ).toHaveLength(0);
  });

  it("대기 중에 붙잡은 질문은 그대로 남는다", () => {
    const queued = runAll(
      asked,
      [
        eventInput(event("answer.failed", at(6_000), { questionId: "q-2" })),
        eventInput(event("answer.queued", at(7_000), { questionId: "q-2", answerId: "a-2-queued" })),
      ],
      ENV,
    );
    expect(queued.next.questionId).toBe("q-2");
    expect(queued.next.answerId).toBe("a-2-queued");
    expect(answerView(queued.next, T_ASKED + 7_000).status).toBe("queued");
  });
});

describe("answerView", () => {
  it("붙잡은 직후에는 준비 문구를 보여 준다", () => {
    const view = answerView(
      stateAt(T_ASKED, { state: "ANSWER_MINIMAL", note: "preparing", questionId: "q-1" }),
      T_ASKED,
    );
    expect(view.phase).toBe("preparing");
    expect(view.line).toBe(PREPARING_LINE);
  });

  it("접힘까지 남은 초를 올림해서 센다", () => {
    const state = stateAt(T_ASKED, {
      state: "ANSWER_MINIMAL",
      note: "minimal",
      foldDeadline: T_ASKED + FOLD_MS,
    });
    expect(answerView(state, T_ASKED).foldsInSec).toBe(18);
    expect(answerView(state, T_ASKED + 500).foldsInSec).toBe(18);
    expect(answerView(state, T_ASKED + 1_000).foldsInSec).toBe(17);
    expect(answerView(state, T_ASKED + FOLD_MS + 5_000).foldsInSec).toBe(0);
  });

  it("남은 초 문구는 자동 접기 설정에 따라 달라진다", () => {
    expect(foldNotice(18)).toBe("18초 뒤 접혀요 · 기록에 남아요");
    expect(foldNotice(null)).toBe("기록에 남아요");
  });
});
