// (g) e2e: 만든 HTML 을 Chromium 이 file:// 로 열어 콘솔 오류 없이 그리는지 봅니다.
//
// 브라우저는 이미 깔린 것만 씁니다. 여기서 새로 내려받지 않습니다.

import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateDay } from "../src/generate.ts";
import { GOLDEN_BUNDLE_DIR } from "./helpers.ts";

const outDir = mkdtempSync(path.join(os.tmpdir(), "classmate-report-browser-"));
let browser: Browser | undefined;

beforeAll(async () => {
  generateDay({ bundles: [GOLDEN_BUNDLE_DIR], outDir });
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  rmSync(outDir, { recursive: true, force: true });
});

interface PageReport {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
  readonly heading: string | null;
  readonly title: string;
  readonly cellCount: number;
}

async function openPage(fileName: string): Promise<PageReport> {
  if (browser === undefined) {
    throw new Error("브라우저가 아직 열리지 않았어요");
  }
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const page = await browser.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.url()} · ${request.failure()?.errorText ?? "이유 모름"}`);
  });
  try {
    await page.goto(pathToFileURL(path.join(outDir, fileName)).href, { waitUntil: "load" });
    const heading = await page.locator("h1").first().textContent();
    const title = await page.title();
    const cellCount = await page.locator(".hub-cell").count();
    return { consoleErrors, pageErrors, failedRequests, heading, title, cellCount };
  } finally {
    await page.close();
  }
}

describe("Chromium 으로 열어 보기", () => {
  it("교시 상세를 오류 없이 그린다", async () => {
    const report = await openPage("period-3.html");
    expect(report.consoleErrors).toEqual([]);
    expect(report.pageErrors).toEqual([]);
    expect(report.failedRequests).toEqual([]);
    expect(report.heading).toBe("3교시 · IoC 컨테이너와 의존성 주입");
    expect(report.title).toContain("교시 복습자료");
  }, 60_000);

  it("하루 허브를 오류 없이 그리고 여덟 칸을 보여 준다", async () => {
    const report = await openPage("hub.html");
    expect(report.consoleErrors).toEqual([]);
    expect(report.pageErrors).toEqual([]);
    expect(report.failedRequests).toEqual([]);
    expect(report.heading).toBe("2026-09-02 오늘의 수업");
    expect(report.cellCount).toBe(8);
  }, 60_000);
});
