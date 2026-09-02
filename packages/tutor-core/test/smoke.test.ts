// 스켈레톤 시험: 상태 순서가 계약 정본과 같고, 상수가 디자인 지도 값과 같은지 봅니다.

import { TUTOR_STATES } from "@classmate/contracts";
import { describe, expect, it } from "vitest";

import { FOLD_MS, PREP_MS, TUTOR_STATE_ORDER } from "../src/index";

describe("tutor-core 스켈레톤", () => {
  it("상태 순서가 contracts 의 TUTOR_STATES 와 같다", () => {
    expect([...TUTOR_STATE_ORDER]).toEqual([...TUTOR_STATES]);
    expect(TUTOR_STATE_ORDER[0]).toBe("CAPTURE");
  });

  it("접힘 18초 · 준비 1.6초 (docs/design-map.md §4)", () => {
    expect(FOLD_MS).toBe(18_000);
    expect(PREP_MS).toBe(1_600);
  });
});
