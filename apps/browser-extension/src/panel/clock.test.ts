// 수업 시계 문구 — 수업 시간대(KST)로 옮겨 `HH:MM:SS` 를 냅니다.
//
// 오프셋을 인자로 넣어, 이 시험은 어느 컴퓨터에서 돌려도 답이 같습니다.

import { describe, expect, it, vi } from "vitest";

import { atClock, clockOfIso, clockOfMs } from "./clock";

/** 이 시험이 쓰는 시간대 둘입니다. KST 는 +09:00, 뉴욕 여름은 -04:00 입니다. */
const KST = 540;
const NEW_YORK = -240;

describe("clockOfIso", () => {
  it("적힌 시간대와 보는 사람이 같으면 글자를 그대로 씁니다", () => {
    expect(clockOfIso("2026-09-02T10:32:18+09:00", KST)).toBe("10:32:18");
  });

  it("UTC(Z) 로 적힌 시각을 보는 사람의 시각으로 옮깁니다", () => {
    // 실측(2026-09-03 2교시)에서 11:20:46 에 도착한 문단이 02:20:46 으로 보였던 그 값입니다.
    expect(clockOfIso("2026-09-03T02:20:46.959Z", KST)).toBe("11:20:46");
  });

  it("다른 오프셋으로 적힌 시각도 옮깁니다", () => {
    expect(clockOfIso("2026-09-03T11:20:46+09:00", NEW_YORK)).toBe("22:20:46");
    expect(clockOfIso("2026-09-03T11:20:46+09:00", 0)).toBe("02:20:46");
  });

  it("날짜를 넘겨도 시각만 맞게 냅니다", () => {
    // KST 로 2026-09-03 08:00 은 UTC 로 전날 23:00 입니다.
    expect(clockOfIso("2026-09-03T08:00:00+09:00", 0)).toBe("23:00:00");
  });

  it("`+0900` 처럼 콜론 없는 표기도 읽습니다", () => {
    expect(clockOfIso("2026-09-03T11:20:46+0900", KST)).toBe("11:20:46");
    expect(clockOfIso("2026-09-03T11:20:46+0900", 0)).toBe("02:20:46");
  });

  it("시간대가 안 적혀 있으면 이미 화면이 쓰는 벽시계로 봅니다", () => {
    expect(clockOfIso("2026-09-03T11:20:46", KST)).toBe("11:20:46");
    expect(clockOfIso("2026-09-03T11:20:46", NEW_YORK)).toBe("11:20:46");
  });

  it("기본값은 이 컴퓨터가 아니라 수업 시간대(KST)입니다", () => {
    // 이 컴퓨터의 시간대를 따르면 KST 밖에서 헤더와 전사 줄이 어긋납니다(아래 시험).
    expect(clockOfIso("2026-09-03T02:20:46.959Z")).toBe(clockOfIso("2026-09-03T02:20:46.959Z", KST));
  });

  it("ISO 모양이 아니면 막습니다", () => {
    expect(() => clockOfIso("10:32", KST)).toThrow(RangeError);
    expect(() => clockOfIso("어제 오후", KST)).toThrow(RangeError);
  });
});

describe("clockOfMs", () => {
  it("밀리초 시각은 KST 로 읽습니다 (재생 화면이 컴퓨터마다 흔들리지 않게)", () => {
    expect(clockOfMs(Date.parse("2026-09-02T10:32:18+09:00"))).toBe("10:32:18");
  });
});

describe("한 화면의 시간대는 하나입니다", () => {
  it("KST 밖 컴퓨터에서도 헤더(clockOfMs)와 전사 줄(clockOfIso)이 같은 시각을 냅니다", () => {
    // 예전에는 `clockOfIso` 만 이 컴퓨터의 시간대를 따랐습니다. 뉴욕(-04:00) 화면에서
    // 헤더는 KST, 전사 줄은 뉴욕 시각이 되어 같은 순간이 한 화면에서 13시간 어긋났습니다.
    // 이 시험은 컴퓨터의 시간대를 뉴욕으로 흉내 내고 두 함수의 답이 같은지 봅니다.
    const spy = vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(-NEW_YORK);
    try {
      const iso = "2026-09-03T02:20:46.959Z";
      const header = clockOfMs(Date.parse(iso));
      const line = clockOfIso(iso);
      expect(line).toBe(header);
      expect(header).toBe("11:20:46");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("atClock", () => {
  it("같은 날짜의 다른 시각을 만듭니다", () => {
    expect(atClock("2026-09-02T10:31:35+09:00", "10:32:16")).toBe("2026-09-02T10:32:16+09:00");
  });

  it("시계 문구나 기준 시각이 모양에 안 맞으면 막습니다", () => {
    expect(() => atClock("2026-09-02T10:31:35+09:00", "1032")).toThrow(RangeError);
    expect(() => atClock("어제", "10:32:16")).toThrow(RangeError);
  });
});
