// 옮긴 CSS 가 정본과 같은지 봅니다.
//
// (a) 6개 파일은 정본과 바이트가 같아야 합니다. 값을 바꾼 자리는 아래 화이트리스트 한 줄뿐입니다.
// (b) styles.css 의 @import 순서가 정본과 같아야 합니다.
// (e) 옮긴 CSS 어디에도 바깥 주소(http/https)가 있으면 안 됩니다. 폰트는 npm 패키지로 받습니다.

import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DESIGN_SOURCE_DIR, STYLES_ENTRY, VERBATIM_TOKEN_FILES } from "../src/index";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const copiedDir = join(packageDir, "src", "css");
const canonicalDir = join(repoRoot, DESIGN_SOURCE_DIR);

/**
 * 정본 값을 바꾸는 유일한 예외입니다(docs/DECISIONS.md "디자인 정본 적용 기본값").
 * 여기 없는 차이는 시험이 막습니다.
 */
const VALUE_EXCEPTIONS: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> = {
  "spacing.css": [["  --panel-header-h: 48px;\n", "  --panel-header-h: 44px;\n"]],
};

/**
 * `@import` 이 가리키는 파일 이름을 나온 순서대로 뽑습니다.
 * url() 형태와 따옴표 형태를 모두 보되, 주석 안의 예시 문장은 세지 않도록 주석부터 지웁니다.
 */
function importOrder(css: string): string[] {
  const found: string[] = [];
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of withoutComments.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/g)) {
    const target = match[1];
    if (target !== undefined) found.push(basename(target));
  }
  return found;
}

describe("옮긴 토큰 CSS", () => {
  it.each(VERBATIM_TOKEN_FILES)("%s 는 예외 한 줄을 빼면 정본과 바이트가 같다", (file) => {
    const canonical = readFileSync(join(canonicalDir, "tokens", file), "utf8");
    const copied = readFileSync(join(copiedDir, file), "utf8");

    let expected = canonical;
    for (const [from, to] of VALUE_EXCEPTIONS[file] ?? []) {
      expect(canonical.split(from), `정본에 예외 대상 줄이 정확히 한 번 있어야 합니다: ${from.trim()}`)
        .toHaveLength(2);
      expected = expected.replace(from, to);
    }
    expect(copied).toBe(expected);
  });

  it("값을 바꾼 줄은 전부 합쳐 1줄뿐이다", () => {
    let changed = 0;
    for (const file of VERBATIM_TOKEN_FILES) {
      const canonical = readFileSync(join(canonicalDir, "tokens", file), "utf8").split("\n");
      const copied = readFileSync(join(copiedDir, file), "utf8").split("\n");
      expect(copied).toHaveLength(canonical.length);
      for (let i = 0; i < canonical.length; i += 1) if (canonical[i] !== copied[i]) changed += 1;
    }
    expect(changed).toBe(1);
  });

  it("styles.css 의 @import 순서가 정본과 같다", () => {
    const canonical = importOrder(readFileSync(join(canonicalDir, STYLES_ENTRY), "utf8"));
    const copied = importOrder(readFileSync(join(copiedDir, STYLES_ENTRY), "utf8"));
    expect(canonical).toEqual([
      "fonts.css",
      "colors.css",
      "typography.css",
      "spacing.css",
      "elevation.css",
      "motion.css",
      "base.css",
    ]);
    expect(copied).toEqual(canonical);
  });

  it("fonts.css 는 CDN 이 아니라 npm 폰트 패키지를 가리킨다", () => {
    const fonts = readFileSync(join(copiedDir, "fonts.css"), "utf8");
    expect(fonts).toContain('@import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";');
    expect(fonts).toContain('@import "@fontsource/ibm-plex-mono/400.css";');
    expect(fonts).toContain('@import "@fontsource/ibm-plex-mono/500.css";');
  });

  it("src/css/ 어디에도 바깥 주소가 없다", () => {
    const files = readdirSync(copiedDir).filter((name) => name.endsWith(".css"));
    expect(files.length).toBe(VERBATIM_TOKEN_FILES.length + 2); // 6개 + fonts.css + styles.css
    for (const file of files) {
      const css = readFileSync(join(copiedDir, file), "utf8");
      expect(css, `${file} 에 http 주소가 있습니다`).not.toMatch(/https?:\/\//);
      expect(css, `${file} 에 url(http 가 있습니다`).not.toMatch(/url\(\s*["']?https?:/);
    }
  });
});
