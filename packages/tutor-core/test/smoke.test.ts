// 스켈레톤 시험: 상태 순서·사건 이름이 계약 정본과 같고, 상수가 디자인 지도 값과 같은지 봅니다.

import { SESSION_EVENT_TYPES, TUTOR_STATES } from "@classmate/contracts";
import { describe, expect, it } from "vitest";

import {
  FOLD_MS,
  initialState,
  PREP_MS,
  SESSION_EVENT_TYPE_NAMES,
  TUTOR_STATE_ORDER,
} from "../src/index";

describe("tutor-core 스켈레톤", () => {
  it("상태 순서가 contracts 의 TUTOR_STATES 와 같다", () => {
    expect([...TUTOR_STATE_ORDER]).toEqual([...TUTOR_STATES]);
    expect(TUTOR_STATE_ORDER[0]).toBe("CAPTURE");
  });

  it("사건 이름 14가지가 contracts 의 SESSION_EVENT_TYPES 와 같다", () => {
    expect([...SESSION_EVENT_TYPE_NAMES]).toEqual([...SESSION_EVENT_TYPES]);
    expect(SESSION_EVENT_TYPE_NAMES).toHaveLength(14);
  });

  it("접힘 18초 · 준비 1.6초 (docs/design-map.md §4)", () => {
    expect(FOLD_MS).toBe(18_000);
    expect(PREP_MS).toBe(1_600);
  });

  it("처음 상태는 CAPTURE 이고 붙잡은 것이 없다", () => {
    const state = initialState(0);
    expect(state.state).toBe("CAPTURE");
    expect(state.note).toBe("none");
    expect(state.questionId).toBeNull();
    expect(state.foldDeadline).toBeNull();
  });
});
