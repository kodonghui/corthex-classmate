// 정본 10쌍이 그대로 있고, 이 패키지가 같은 이름 10개를 내보내는지 봅니다.

import { existsSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import * as pkg from "../src/index";
import { CLASSMATE_COMPONENTS } from "../src/index";
import { cleanupAll } from "./render";
import { canonRoot } from "./paths";

const sourceDir = join(canonRoot, "classmate");

afterEach(cleanupAll);

describe("ui-classmate 뼈대", () => {
  it("정본 컴포넌트 10개의 .jsx 와 .d.ts 가 있다", () => {
    expect(CLASSMATE_COMPONENTS).toHaveLength(10);
    for (const name of CLASSMATE_COMPONENTS) {
      expect(existsSync(join(sourceDir, `${name}.jsx`)), `${name}.jsx`).toBe(true);
      expect(existsSync(join(sourceDir, `${name}.d.ts`)), `${name}.d.ts`).toBe(true);
    }
  });

  it("10개 이름을 전부 함수로 내보낸다", () => {
    for (const name of CLASSMATE_COMPONENTS) {
      expect(typeof (pkg as Record<string, unknown>)[name], name).toBe("function");
    }
  });

  it("기본 요소(internal/base)는 밖으로 내보내지 않는다", () => {
    for (const hidden of ["Icon", "Evidence", "Tag", "Disclosure", "CodeBlock", "Chip", "ChipGroup", "Button", "StatusDot", "tokenizeJava"]) {
      expect(Object.keys(pkg), hidden).not.toContain(hidden);
    }
  });
});
