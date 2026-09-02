// 스켈레톤 시험: React + JSX + happy-dom 배관이 붙었는지, 정본 JSX 가 제자리에 있는지 봅니다.

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Placeholder, UI_BASE_SOURCE_DIRS } from "../src/index";

// happy-dom 환경은 전역 URL 을 자기 것으로 바꿔 두므로 fileURLToPath(new URL(...)) 가 실패합니다.
// 문자열 import.meta.url 을 바로 넘기고 path 로 올라갑니다.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const componentsDir = join(repoRoot, "design/claude-design-export/design-system/components");

describe("ui-base 스켈레톤", () => {
  it("happy-dom 환경에서 document 가 있다", () => {
    expect(typeof document).toBe("object");
  });

  it("Placeholder 가 렌더된다", () => {
    const html = renderToStaticMarkup(<Placeholder label="ui-base" />);
    expect(html).toContain('data-classmate="ui-base"');
    expect(html).toContain("ui-base");
  });

  it("정본 JSX 가 여섯 폴더에 20개 이상 있다", () => {
    const count = UI_BASE_SOURCE_DIRS.flatMap((dir) => readdirSync(join(componentsDir, dir))).filter((name) =>
      name.endsWith(".jsx"),
    ).length;
    expect(count).toBeGreaterThanOrEqual(20);
  });
});
