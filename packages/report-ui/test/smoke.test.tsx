// 스켈레톤 시험: 템플릿이 렌더되고, 모델 문자열이 HTML 로 해석되지 않고 텍스트로 이스케이프되는지 봅니다.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PeriodPagePlaceholder, REPORT_OUTPUT_DIR } from "../src/index";

describe("report-ui 스켈레톤", () => {
  it("교시 템플릿이 렌더된다", () => {
    const html = renderToStaticMarkup(<PeriodPagePlaceholder periodId="2026-09-02-p3" title="3교시" />);
    expect(html).toContain('data-period-id="2026-09-02-p3"');
    expect(html).toContain("<h1>3교시</h1>");
  });

  it("모델이 준 문자열은 텍스트로만 들어간다 (§4-7)", () => {
    const html = renderToStaticMarkup(<PeriodPagePlaceholder periodId="p" title="<script>alert(1)</script>" />);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("생성물은 out/ 에 둔다", () => {
    expect(REPORT_OUTPUT_DIR).toBe("out");
  });
});
