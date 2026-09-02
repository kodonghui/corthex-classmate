import { parseIso } from "@classmate/tutor-core";
import { describe, expect, it } from "vitest";

import { atClock, clockOfIso, clockOfMs } from "./clock";
import { GOLDEN_BUNDLE, GOLDEN_TERMS } from "./golden-bundle";
import { segmentKeyOfWord, splitTerms, toTranscriptLines } from "./transcript-lines";

describe("splitTerms", () => {
  it("낱말이 없으면 글 전체가 한 조각이다", () => {
    expect(splitTerms("자 그러면 다시 볼게요.", ["new"])).toEqual([{ text: "자 그러면 다시 볼게요." }]);
  });

  it("낱말 자리에만 점선(term)을 긋는다", () => {
    expect(splitTerms("객체를 직접 new로 만들면", ["new"])).toEqual([
      { text: "객체를 직접 " },
      { text: "new", term: true },
      { text: "로 만들면" },
    ]);
  });

  it("같은 자리에서는 긴 낱말을 고른다", () => {
    expect(splitTerms("생성자 주입 방식", ["생성자", "생성자 주입"])).toEqual([
      { text: "생성자 주입", term: true },
      { text: " 방식" },
    ]);
  });

  it("맞붙은 낱말은 각각 한 조각이고 빈 조각은 만들지 않는다", () => {
    expect(splitTerms("newnew", ["new"])).toEqual([
      { text: "new", term: true },
      { text: "new", term: true },
    ]);
    expect(splitTerms("", ["new"])).toEqual([]);
  });
});

describe("toTranscriptLines", () => {
  const until = parseIso("2026-09-02T10:32:16+09:00");
  const lines = toTranscriptLines(GOLDEN_BUNDLE.transcript, GOLDEN_TERMS, until);

  it("그 시각까지 도착한 조각만 시간순으로 줄이 된다", () => {
    expect(lines.map((line) => line.id)).toEqual(["ts-p3-001", "ts-p3-002", "ts-p3-003", "ts-p3-004", "ts-p3-005"]);
  });

  it("시각은 말한 시각(spokenAt)이고 fixture 시간대 그대로다", () => {
    expect(lines.find((line) => line.id === "ts-p3-004")?.time).toBe("10:32:10");
  });

  it("new 가 든 줄의 점선 열쇠는 <줄 id>:<조각 번호> 다", () => {
    const line = lines.find((item) => item.id === "ts-p3-004");
    expect(line).toBeDefined();
    if (line === undefined) return;
    expect(segmentKeyOfWord(line, "new")).toBe("ts-p3-004:1");
    expect(segmentKeyOfWord(line, "생성자")).toBeNull();
  });
});

describe("시계 문구", () => {
  it("ISO 문자열의 시:분:초를 그대로 꺼낸다", () => {
    expect(clockOfIso("2026-09-02T10:32:18+09:00")).toBe("10:32:18");
    expect(() => clockOfIso("10:32")).toThrow(RangeError);
  });

  it("ms 시각도 KST 기준 시:분:초가 된다", () => {
    expect(clockOfMs(parseIso("2026-09-02T10:32:18+09:00"))).toBe("10:32:18");
  });

  it("같은 날 다른 시각을 만든다", () => {
    expect(atClock("2026-09-02T10:31:35+09:00", "10:32:16")).toBe("2026-09-02T10:32:16+09:00");
    expect(() => atClock("2026-09-02T10:31:35+09:00", "1032")).toThrow(RangeError);
  });
});
