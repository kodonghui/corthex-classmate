// (f) 생성 e2e: 임시 폴더에 하루치 결과를 만들고 파일과 그림이 제자리에 있는지 봅니다.

import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { generateDay } from "../src/generate.ts";
import { GOLDEN_BUNDLE_DIR } from "./helpers.ts";

const outDir = mkdtempSync(path.join(os.tmpdir(), "classmate-report-out-"));

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

const result = generateDay({ bundles: [GOLDEN_BUNDLE_DIR], outDir });

describe("generateDay", () => {
  it("날짜와 만든 파일을 알려 준다", () => {
    expect(result.dayId).toBe("2026-09-02");
    expect(result.warnings).toEqual([]);
    expect(result.pages.map((page) => path.basename(page))).toEqual(["period-3.html", "hub.html"]);
  });

  it("교시 상세와 허브 파일을 만든다", () => {
    expect(existsSync(path.join(outDir, "period-3.html"))).toBe(true);
    expect(existsSync(path.join(outDir, "hub.html"))).toBe(true);
  });

  it("프레임 이미지를 frames/ 로 옮긴다", () => {
    const framesDir = path.join(outDir, "frames");
    expect(statSync(framesDir).isDirectory()).toBe(true);
    expect(existsSync(path.join(framesDir, "p3", "frame-001.webp"))).toBe(true);
    expect(existsSync(path.join(framesDir, "p3", "frame-002.webp"))).toBe(true);
    expect(result.assets).toHaveLength(2);
  });

  it("옮긴 이미지가 원본과 바이트까지 같다", () => {
    const from = readFileSync(path.join(GOLDEN_BUNDLE_DIR, "frames", "frame-001.webp"));
    const to = readFileSync(path.join(outDir, "frames", "p3", "frame-001.webp"));
    expect(to.equals(from)).toBe(true);
  });

  it("허브가 만든 교시 파일을 정확히 가리킨다", () => {
    const hub = readFileSync(path.join(outDir, "hub.html"), "utf8");
    expect(hub).toContain('href="period-3.html"');
    const periodHtml = readFileSync(path.join(outDir, "period-3.html"), "utf8");
    expect(periodHtml).toContain('src="frames/p3/frame-001.webp"');
    expect(periodHtml).toContain('href="hub.html"');
  });

  it("번들이 하나도 없어도 허브만 만들고 멈추지 않는다", () => {
    const emptyOut = mkdtempSync(path.join(os.tmpdir(), "classmate-report-empty-"));
    try {
      const empty = generateDay({ bundles: [], outDir: emptyOut, dayId: "2026-09-04" });
      expect(empty.dayId).toBe("2026-09-04");
      expect(existsSync(path.join(emptyOut, "hub.html"))).toBe(true);
      expect(empty.assets).toEqual([]);
    } finally {
      rmSync(emptyOut, { recursive: true, force: true });
    }
  });
});
