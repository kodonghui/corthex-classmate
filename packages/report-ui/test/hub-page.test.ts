// (d) 하루 허브: 8칸을 늘 그리고, 기록이 없는 칸은 "기록 없음" 으로 둡니다.

import { describe, expect, it } from "vitest";

import { readPeriodBundle } from "../src/bundle.ts";
import { NO_RECORD_SLOT } from "../src/labels.ts";
import { renderHubHtml } from "../src/render.ts";
import { PERIODS_PER_DAY } from "../src/templates/HubPage.ts";
import { findUnbalancedTags, GOLDEN_BUNDLE_DIR, makeSyntheticBundle, STUB_TOKEN_CSS } from "./helpers.ts";

const goldenBundle = readPeriodBundle(GOLDEN_BUNDLE_DIR);
const hubHtml = renderHubHtml([goldenBundle], { tokenCss: STUB_TOKEN_CSS });

describe("하루 허브", () => {
  it("한국어 문서 뼈대를 갖춘다", () => {
    expect(hubHtml.startsWith("<!doctype html>\n")).toBe(true);
    expect(hubHtml).toContain('<html lang="ko">');
    expect(hubHtml).toContain('<meta charset="utf-8">');
    expect(hubHtml).toContain("<title>2026-09-02 하루 허브 · Corthex Classmate</title>");
    expect(findUnbalancedTags(hubHtml)).toEqual([]);
  });

  it("스크립트도 바깥 주소도 없다", () => {
    expect(hubHtml).not.toContain("<script");
    expect(hubHtml).not.toContain("http://");
    expect(hubHtml).not.toContain("https://");
  });

  it("교시 칸을 여덟 개 그린다", () => {
    const cells = hubHtml.match(/class="hub-cell(?: hub-cell-empty)?"/g) ?? [];
    expect(cells).toHaveLength(PERIODS_PER_DAY);
    expect(PERIODS_PER_DAY).toBe(8);
  });

  it("기록이 있는 한 칸만 채우고 나머지 일곱 칸은 기록 없음이다", () => {
    const emptyCells = hubHtml.match(/class="hub-cell hub-cell-empty"/g) ?? [];
    expect(emptyCells).toHaveLength(7);
    const emptyLabels = hubHtml.match(new RegExp(NO_RECORD_SLOT, "g")) ?? [];
    expect(emptyLabels).toHaveLength(7);
  });

  it("채운 칸은 그 교시 상세로 이어진다", () => {
    expect(hubHtml).toContain('<a href="period-3.html">IoC 컨테이너와 의존성 주입</a>');
    expect(hubHtml).toContain("3교시");
    expect(hubHtml).toContain("질문 2개 · 전사 9개 · 장면 2장");
  });

  it("아직 재료가 없는 허브 칸은 비었다고 적는다", () => {
    expect(hubHtml).toContain("반복해서 막힌 개념");
    expect(hubHtml).toContain("교시 간 연결");
    expect(hubHtml).toContain("오늘 다시 할 3개");
    expect(hubHtml).toContain("능동 복습");
    expect(hubHtml).toContain("무AI 수행 기록");
  });
});

describe("하루 허브 · 모자란 자료", () => {
  it("번들이 하나도 없어도 여덟 칸을 그린다", () => {
    const html = renderHubHtml([], { tokenCss: STUB_TOKEN_CSS, dayId: "2026-09-03" });
    const emptyCells = html.match(/class="hub-cell hub-cell-empty"/g) ?? [];
    expect(emptyCells).toHaveLength(8);
    expect(html).toContain("2026-09-03 오늘의 수업");
    expect(findUnbalancedTags(html)).toEqual([]);
  });

  it("교시 번호가 겹치면 밀려난 번들에 링크를 걸지 않는다", () => {
    const first = makeSyntheticBundle({ periodId: "2026-09-02-p1", index: 1, subject: "먼저 온 1교시" });
    const second = makeSyntheticBundle({ periodId: "2026-09-02-p1-again", index: 1, subject: "나중에 온 1교시" });
    const html = renderHubHtml([first, second], { tokenCss: STUB_TOKEN_CSS });
    expect(html).toContain('<a href="period-1.html">먼저 온 1교시</a>');
    // 밀려난 번들도 period-1.html 이라 링크를 걸면 다른 교시가 열립니다. 그래서 글자로만 적습니다.
    expect(html).toContain("나중에 온 1교시");
    expect(html).not.toContain('<a href="period-1.html">나중에 온 1교시</a>');
    expect(html).toContain("교시 번호가 없거나, 그 번호 칸이 이미 차 있어요.");
    expect(html).toContain("1교시 칸이 이미 차 있어 상세 페이지를 만들지 않았어요");
  });

  it("교시 번호를 모르는 번들은 따로 모아 둔다", () => {
    const nameless = makeSyntheticBundle({
      periodId: "2026-09-02-morning",
      index: undefined,
      subject: "번호 없는 수업",
    });
    const html = renderHubHtml([nameless], { tokenCss: STUB_TOKEN_CSS });
    expect(html).toContain("칸을 정하지 못한 교시");
    expect(html).toContain('href="period-2026-09-02-morning.html"');
    const emptyCells = html.match(/class="hub-cell hub-cell-empty"/g) ?? [];
    expect(emptyCells).toHaveLength(8);
  });
});
