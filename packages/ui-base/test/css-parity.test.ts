// CSS 동일성 시험입니다.
//
// 정본 jsx 는 파일 맨 위에서 css('cm-<id>', `…`) 로 <style> 을 document.head 에 꽂았습니다.
// 우리는 그 템플릿 문자열을 그대로 <Name>.css 로 옮겼습니다. 두 텍스트가 공백만 빼고 같은지 봅니다.
// 정본이 바뀌면 이 시험이 먼저 깨져서 알려 줍니다.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// happy-dom 환경은 전역 URL 을 자기 것으로 바꿔 두므로 fileURLToPath(new URL(...)) 이 실패합니다.
const testDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(testDir, "..");
const repoRoot = join(packageDir, "..", "..");
const canonDir = join(repoRoot, "design/claude-design-export/design-system/components");
const srcComponentsDir = join(packageDir, "src/components");

/** 정본 22개 중 Icon 만 css() 를 부르지 않습니다. 그래서 CSS 파일은 21개입니다. */
const PAIRS: Array<[dir: string, name: string]> = [
  ["core", "Button"],
  ["core", "IconButton"],
  ["forms", "Checkbox"],
  ["forms", "Chip"],
  ["forms", "Input"],
  ["forms", "Radio"],
  ["forms", "Select"],
  ["forms", "Switch"],
  ["feedback", "Badge"],
  ["feedback", "Banner"],
  ["feedback", "Evidence"],
  ["feedback", "StatusDot"],
  ["feedback", "Tag"],
  ["feedback", "Toast"],
  ["feedback", "Tooltip"],
  ["surfaces", "Card"],
  ["surfaces", "CodeBlock"],
  ["surfaces", "Disclosure"],
  ["navigation", "PanelHeader"],
  ["navigation", "Tabs"],
  ["overlay", "Dialog"],
];

/** 공백은 견주지 않습니다. 그 밖의 글자는 한 글자도 달라지면 안 됩니다. */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function canonCss(dir: string, name: string): string | null {
  const source = readFileSync(join(canonDir, dir, `${name}.jsx`), "utf8");
  const match = source.match(/css\('([^']+)',\s*`([\s\S]*?)`\);/);
  return match === null ? null : (match[2] ?? null);
}

describe("CSS 동일성", () => {
  it("정본 jsx 22개 중 21개가 css() 를 한 번 부른다", () => {
    const jsxFiles = ["core", "forms", "feedback", "surfaces", "navigation", "overlay"].flatMap((dir) =>
      readdirSync(join(canonDir, dir))
        .filter((n) => n.endsWith(".jsx"))
        .map((n) => join(canonDir, dir, n)),
    );
    expect(jsxFiles.length).toBe(22);
    const withCss = jsxFiles.filter((f) => /css\('/.test(readFileSync(f, "utf8")));
    expect(withCss.length).toBe(21);
    expect(PAIRS.length).toBe(21);
  });

  it.each(PAIRS)("%s/%s.css 는 정본 css() 블록과 같다", (dir, name) => {
    const canon = canonCss(dir, name);
    expect(canon, `정본 ${dir}/${name}.jsx 에서 css() 블록을 못 찾았습니다`).not.toBeNull();
    const ported = readFileSync(join(srcComponentsDir, dir, `${name}.css`), "utf8");
    expect(normalize(ported)).toBe(normalize(canon ?? ""));
  });

  it("styles.css 가 src/components 아래 .css 를 하나도 빠짐없이 모은다", () => {
    const aggregate = readFileSync(join(packageDir, "src/styles.css"), "utf8");
    const imported = [...aggregate.matchAll(/@import\s+"\.\/components\/([^"]+)";/g)].map((m) => m[1]);
    const onDisk = readdirSync(srcComponentsDir)
      .filter((d) => statSync(join(srcComponentsDir, d)).isDirectory())
      .flatMap((d) =>
        readdirSync(join(srcComponentsDir, d))
          .filter((n) => n.endsWith(".css"))
          .map((n) => `${d}/${n}`),
      );
    expect(onDisk.length).toBe(21);
    expect([...imported].sort()).toEqual([...onDisk].sort());
  });

  it("Input.css 가 Select.css 보다 먼저 실린다(.cm-field 를 정의하는 쪽)", () => {
    const aggregate = readFileSync(join(packageDir, "src/styles.css"), "utf8");
    expect(readFileSync(join(srcComponentsDir, "forms/Input.css"), "utf8")).toContain(".cm-field{");
    expect(aggregate.indexOf("forms/Input.css")).toBeLessThan(aggregate.indexOf("forms/Select.css"));
    expect(aggregate.indexOf("feedback/Badge.css")).toBeLessThan(aggregate.indexOf("navigation/Tabs.css"));
    expect(aggregate.indexOf("core/Button.css")).toBeLessThan(aggregate.indexOf("overlay/Dialog.css"));
  });
});
