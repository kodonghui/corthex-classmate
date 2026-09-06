import { describe, expect, it } from "vitest";
import { compactEvidence } from "./answer-presentation";

describe("읽기 화면의 근거 표시", () => {
  it("표시가 동일한 추론은 한 번만 보여 준다", () => {
    expect(compactEvidence([
      { type: "inferred", source: "tiro" },
      { type: "inferred", source: "meet" },
      { type: "inferred", source: "intellij" },
    ])).toHaveLength(1);
  });
  it("서로 다른 추론 이유와 확인 출처·지연 상태는 모두 보존한다", () => {
    const items = [
      { type: "inferred" as const, reason: "전사만 참고" },
      { type: "inferred" as const, reason: "화면 글자가 흐림" },
      { type: "verified" as const, source: "tiro" },
      { type: "verified" as const, source: "meet" },
      { type: "delayed" as const, source: "meet" },
    ];
    expect(compactEvidence(items)).toEqual(items);
  });
  it("별도 표시 문구나 도움말이 있으면 합치지 않는다", () => {
    const items = [{ type: "inferred" as const, title: "근거 A" },
      { type: "inferred" as const, children: "근거 B" }];
    expect(compactEvidence(items)).toEqual(items);
  });
});
