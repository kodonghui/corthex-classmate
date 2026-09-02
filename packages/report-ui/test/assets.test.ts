// (h) 출력 폴더 안 경로 계산: 서로 다른 프레임이 같은 자리로 겹치지 않는지 봅니다.

import { describe, expect, it } from "vitest";

import { FRAMES_DIR, frameHref, isSafeBundlePath, periodFileName, periodKey } from "../src/assets.ts";
import type { PeriodRef } from "../src/types.ts";

const p3: PeriodRef = { periodId: "2026-09-02-p3", index: 3 };
const nameless: PeriodRef = { periodId: "2026-09-02-morning", index: undefined };

describe("frameHref · 자리 계산", () => {
  it("장면 아이디로 이름을 짓고 확장자는 원본에서 가져온다", () => {
    expect(frameHref(p3, { id: "sf-p3-001", path: "frames/sf-p3-001.webp" })).toBe(
      `${FRAMES_DIR}/p3/sf-p3-001.webp`,
    );
    expect(frameHref(p3, { id: "sf-p3-002", path: "frames/a/b/shot.PNG" })).toBe(
      `${FRAMES_DIR}/p3/sf-p3-002.png`,
    );
    expect(frameHref(nameless, { id: "sf-x", path: "frames/x.webp" })).toBe(
      `${FRAMES_DIR}/2026-09-02-morning/sf-x.webp`,
    );
  });

  it("하위 폴더가 다른 두 그림이 같은 자리로 겹치지 않는다", () => {
    const a = frameHref(p3, { id: "sf-p3-001", path: "frames/a/shot.webp" });
    const b = frameHref(p3, { id: "sf-p3-002", path: "frames/b/shot.webp" });
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a).not.toBe(b);
  });

  it("이름만 다르게 쓴 두 그림도 같은 자리로 겹치지 않는다", () => {
    const spaced = frameHref(p3, { id: "sf-p3-001", path: "frames/shot 1.webp" });
    const dashed = frameHref(p3, { id: "sf-p3-002", path: "frames/shot-1.webp" });
    expect(spaced).toBe(`${FRAMES_DIR}/p3/sf-p3-001.webp`);
    expect(dashed).toBe(`${FRAMES_DIR}/p3/sf-p3-002.webp`);
    expect(spaced).not.toBe(dashed);
  });

  it("아이디가 같은 두 프레임만 같은 자리가 된다 (겹침은 generateDay 가 막습니다)", () => {
    const first = frameHref(p3, { id: "sf-p3-001", path: "frames/a/shot.webp" });
    const second = frameHref(p3, { id: "sf-p3-001", path: "frames/b/shot.webp" });
    expect(first).toBe(second);
  });

  it("파일 이름에 쓸 수 없는 글자는 다듬고, 확장자가 없으면 붙이지 않는다", () => {
    expect(frameHref(p3, { id: "장면 1", path: "frames/x.webp" })).toBe(`${FRAMES_DIR}/p3/1.webp`);
    expect(frameHref(p3, { id: "sf-p3-001", path: "frames/noext" })).toBe(`${FRAMES_DIR}/p3/sf-p3-001`);
  });

  it("폴더 밖을 가리키는 경로는 자리를 주지 않는다", () => {
    expect(frameHref(p3, { id: "sf-p3-001", path: "../secret.webp" })).toBeUndefined();
    expect(frameHref(p3, { id: "sf-p3-001", path: "/etc/passwd" })).toBeUndefined();
    expect(frameHref(p3, { id: "sf-p3-001", path: "" })).toBeUndefined();
  });
});

describe("경로 도우미", () => {
  it("교시 열쇠와 페이지 이름은 교시 번호가 있으면 번호를 쓴다", () => {
    expect(periodKey(p3)).toBe("p3");
    expect(periodFileName(p3)).toBe("period-3.html");
    expect(periodKey(nameless)).toBe("2026-09-02-morning");
    expect(periodFileName(nameless)).toBe("period-2026-09-02-morning.html");
  });

  it("안전한 번들 경로만 통과시킨다", () => {
    expect(isSafeBundlePath("frames/a/b.webp")).toBe(true);
    expect(isSafeBundlePath("frames/../../b.webp")).toBe(false);
    expect(isSafeBundlePath("C:/temp/b.webp")).toBe(false);
  });
});
