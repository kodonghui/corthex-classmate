// 2라운드에 internal/base 를 @classmate/ui-base 로 기계적으로 바꿀 수 있는 상태인지 시험으로 못 박습니다.
// 그리고 1라운드 공유 규칙·불변 원칙(런타임 주입 0, 외부 URL 0)을 지키는지 봅니다.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { pkgRoot, srcRoot } from "./paths";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const srcFiles = walk(srcRoot);
const codeFiles = srcFiles.filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
const componentFiles = walk(join(srcRoot, "components"));
const read = (f: string): string => readFileSync(f, "utf8");
const rel = (f: string): string => relative(pkgRoot, f).split("\\").join("/");

/**
 * 주석을 뺀 실제 코드만 봅니다. 이 패키지의 주석에는 "2라운드에 @classmate/ui-base 로 바꾼다" 같은
 * 안내가 일부러 들어 있어서, 주석까지 세면 규칙을 지켰는데도 걸립니다.
 */
const code = (f: string): string =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const BASE_FILES = ["Button.tsx", "Chip.tsx", "CodeBlock.tsx", "Disclosure.tsx", "Evidence.tsx", "Icon.tsx", "StatusDot.tsx", "Tag.tsx"];
const PROPS_NAMES = [
  "IconProps",
  "EvidenceProps",
  "TagProps",
  "DisclosureProps",
  "CodeBlockProps",
  "ChipProps",
  "ChipGroupProps",
  "ButtonProps",
  "StatusDotProps",
];

describe("구조 규칙", () => {
  it("(1) internal/base 는 정본 .d.ts 와 같은 파일명·export 이름·props 이름을 쓴다", () => {
    const baseDir = join(srcRoot, "internal/base");
    const names = readdirSync(baseDir).sort();
    expect(names).toEqual([...BASE_FILES, "base.css", "index.ts"].sort());
    const barrel = read(join(baseDir, "index.ts"));
    for (const name of ["Icon", "Evidence", "Tag", "Disclosure", "CodeBlock", "tokenizeJava", "Chip", "ChipGroup", "Button", "StatusDot"]) {
      expect(barrel, `배럴이 ${name} 를 내보내야 합니다`).toContain(name);
    }
    for (const props of PROPS_NAMES) {
      expect(barrel, `배럴이 ${props} 를 내보내야 합니다`).toContain(props);
      const declared = BASE_FILES.some((f) => read(join(baseDir, f)).includes(`export interface ${props}`));
      expect(declared, `${props} 가 interface 로 선언돼야 합니다`).toBe(true);
    }
    // JSX.Element → React.JSX.Element 말고는 손대지 않았습니다.
    for (const f of BASE_FILES) {
      expect(read(join(baseDir, f)), `${f}: 반환 타입은 React.JSX.Element`).toContain("React.JSX.Element");
    }
  });

  it("(3) src/components 는 internal/base 안쪽 파일을 직접 import 하지 않는다 (배럴만)", () => {
    for (const f of componentFiles) {
      expect(read(f), `${rel(f)}`).not.toMatch(/internal\/base\//);
    }
    // 실제로 배럴을 쓰는 파일은 "../internal/base" 로만 씁니다.
    for (const f of componentFiles) {
      const text = read(f);
      for (const m of text.matchAll(/from\s+"([^"]*internal[^"]*)"/g)) {
        expect(m[1], rel(f)).toBe("../internal/base");
      }
    }
  });

  it("(4) @classmate/ui-base 와 @classmate/design-tokens 를 import 하지 않는다", () => {
    // 글자가 아니라 실제 import 대상만 봅니다(시험 제목·주석에는 두 이름이 일부러 나옵니다).
    for (const f of [...codeFiles, ...walk(join(pkgRoot, "test"))]) {
      for (const m of code(f).matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
        expect(m[1], rel(f)).not.toBe("@classmate/ui-base");
        expect(m[1], rel(f)).not.toBe("@classmate/design-tokens");
      }
    }
    const pkgJson = read(join(pkgRoot, "package.json"));
    expect(pkgJson).not.toContain("@classmate/ui-base");
    expect(pkgJson).not.toContain("@classmate/design-tokens");
  });

  it("@classmate/contracts 는 값이 아니라 타입으로만 쓴다", () => {
    for (const f of codeFiles) {
      const text = read(f);
      for (const m of text.matchAll(/^\s*import\s+([^;]*?)\s+from\s+"@classmate\/contracts"/gm)) {
        expect(m[1] ?? "", `${rel(f)}: 값 import 는 Ajv 가 MV3 CSP 에 막힙니다`).toMatch(/^type\b/);
      }
    }
  });
});

describe("불변 원칙", () => {
  it("CSS 를 런타임에 주입하지 않는다 — <style> 만들기·document.head·unpkg 0건", () => {
    for (const f of codeFiles) {
      const text = code(f);
      expect(text, rel(f)).not.toContain("document.head");
      expect(text, rel(f)).not.toMatch(/createElement\(\s*["']style["']/);
      expect(text, rel(f)).not.toContain("unpkg");
    }
  });

  it("모델 HTML 을 직접 꽂지 않는다 — dangerouslySetInnerHTML 0건", () => {
    for (const f of codeFiles) {
      expect(code(f), rel(f)).not.toContain("dangerouslySetInnerHTML");
    }
  });

  it("배포되는 CSS·TS 에 외부 http URL 이 없다", () => {
    for (const f of srcFiles) {
      expect(read(f), rel(f)).not.toMatch(/https?:\/\//);
    }
  });

  it("styles.css 는 package.json exports 로 나가고, TS 는 CSS 를 import 하지 않는다", () => {
    const pkgJson = JSON.parse(read(join(pkgRoot, "package.json"))) as { exports: Record<string, string> };
    expect(pkgJson.exports["./styles.css"]).toBe("./src/styles.css");
    for (const f of codeFiles) {
      expect(code(f), rel(f)).not.toMatch(/from\s+["'][^"']*\.css["']/);
      expect(code(f), rel(f)).not.toMatch(/^\s*import\s+["'][^"']*\.css["']/m);
    }
  });
});
