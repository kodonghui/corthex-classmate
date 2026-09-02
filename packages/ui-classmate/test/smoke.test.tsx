// 스켈레톤 시험: 정본 JSX·d.ts 10쌍이 있고, React 배관이 되는지 봅니다.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CLASSMATE_COMPONENTS, Placeholder } from "../src/index";

// happy-dom 환경은 전역 URL 을 자기 것으로 바꿔 두므로 fileURLToPath(new URL(...)) 가 실패합니다.
// 문자열 import.meta.url 을 바로 넘기고 path 로 올라갑니다.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const sourceDir = join(repoRoot, "design/claude-design-export/design-system/components/classmate");

describe("ui-classmate 스켈레톤", () => {
  it("정본 컴포넌트 10개의 .jsx 와 .d.ts 가 있다", () => {
    expect(CLASSMATE_COMPONENTS).toHaveLength(10);
    for (const name of CLASSMATE_COMPONENTS) {
      expect(existsSync(join(sourceDir, `${name}.jsx`)), `${name}.jsx`).toBe(true);
      expect(existsSync(join(sourceDir, `${name}.d.ts`)), `${name}.d.ts`).toBe(true);
    }
  });

  it("Placeholder 가 렌더된다", () => {
    expect(renderToStaticMarkup(<Placeholder name="NowLine" />)).toContain('data-classmate="NowLine"');
  });
});
