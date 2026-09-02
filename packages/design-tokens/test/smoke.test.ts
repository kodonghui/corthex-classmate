// 스켈레톤 시험: 정본 토큰 파일이 제자리에 있고 CSS 변수가 충분히 들어 있는지 봅니다.
// 단위 (1) 은 이 시험을 "옮긴 CSS 와 정본이 같다" · "변수 이름 목록 스냅샷" 으로 바꿉니다.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DESIGN_SOURCE_DIR, TOKEN_FILES } from "../src/index";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const tokensDir = join(repoRoot, DESIGN_SOURCE_DIR, "tokens");

describe("design-tokens 스켈레톤", () => {
  it("정본 토큰 파일 7개와 styles.css 가 있다", () => {
    for (const file of TOKEN_FILES) expect(existsSync(join(tokensDir, file)), file).toBe(true);
    expect(existsSync(join(repoRoot, DESIGN_SOURCE_DIR, "styles.css"))).toBe(true);
  });

  it("정본에 CSS 변수 선언이 150개 이상 있다 (design-map.md 는 196개)", () => {
    const css = TOKEN_FILES.map((file) => readFileSync(join(tokensDir, file), "utf8")).join("");
    const declarations = css.match(/--[a-z0-9-]+ *:/g) ?? [];
    expect(declarations.length).toBeGreaterThanOrEqual(150);
  });
});
