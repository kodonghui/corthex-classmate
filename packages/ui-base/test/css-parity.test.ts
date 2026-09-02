// CSS 동일성 시험입니다.
//
// 정본 jsx 는 파일 맨 위에서 css('cm-<id>', `…`) 로 <style> 을 document.head 에 꽂았습니다.
// 우리는 그 템플릿 문자열을 그대로 <Name>.css 로 옮겼습니다. 두 텍스트가 공백만 빼고 같은지 봅니다.
// 정본이 바뀌면 이 시험이 먼저 깨져서 알려 줍니다.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
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

/** 정본 jsx 한 파일의 css() 블록을 전부 모읍니다. 두 번 부르면 길이가 2 가 되어 시험이 깨집니다. */
function canonCssBlocks(dir: string, name: string): string[] {
  const source = readFileSync(join(canonDir, dir, `${name}.jsx`), "utf8");
  return [...source.matchAll(/css\('([^']+)',\s*`([\s\S]*?)`\);/g)].map((m) => m[2] ?? "");
}

/** 정본 jsx 한 파일이 css() 를 몇 번 부르는지 셉니다. */
function cssCallCount(file: string): number {
  return (readFileSync(file, "utf8").match(/css\('/g) ?? []).length;
}

describe("CSS 동일성", () => {
  it("정본 jsx 22개 중 21개가 css() 를 한 번 부른다", () => {
    const jsxFiles = ["core", "forms", "feedback", "surfaces", "navigation", "overlay"].flatMap((dir) =>
      readdirSync(join(canonDir, dir))
        .filter((n) => n.endsWith(".jsx"))
        .map((n) => join(canonDir, dir, n)),
    );
    expect(jsxFiles.length).toBe(22);
    // "한 번"을 이름으로만 두지 않고 실제 호출 횟수를 셉니다.
    // 한 파일이 css() 를 두 번 부르면 아래 canonCssBlocks 가 블록을 두 개 보게 되고,
    // 예전처럼 첫 블록만 옮긴 채 시험이 통과하는 일이 없어집니다.
    const counted = jsxFiles.map((f) => ({ file: basename(f), calls: cssCallCount(f) }));
    expect(counted.filter((c) => c.calls > 1)).toEqual([]);
    expect(counted.filter((c) => c.calls === 1).length).toBe(21);
    expect(counted.filter((c) => c.calls === 0)).toEqual([{ file: "Icon.jsx", calls: 0 }]);
    expect(PAIRS.length).toBe(21);
  });

  it.each(PAIRS)("%s/%s.css 는 정본 css() 블록과 같다", (dir, name) => {
    const blocks = canonCssBlocks(dir, name);
    expect(blocks.length, `정본 ${dir}/${name}.jsx 의 css() 블록은 한 개여야 합니다`).toBe(1);
    const ported = readFileSync(join(srcComponentsDir, dir, `${name}.css`), "utf8");
    expect(normalize(ported)).toBe(normalize(blocks[0] ?? ""));
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
