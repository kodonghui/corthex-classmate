// 2라운드에 internal/base 사본을 @classmate/ui-base 로 갈아 끼웠습니다. 그 교체가 실제로 끝났는지,
// 그리고 불변 원칙(런타임 주입 0, 외부 URL 0)을 여전히 지키는지 봅니다.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import * as uiBase from "@classmate/ui-base";

import * as barrel from "../src/internal/base";
import { canonRoot, pkgRoot, srcRoot } from "./paths";

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
 * 주석을 뺀 실제 코드만 봅니다. 이 패키지의 주석에는 "1라운드에는 사본이 있었다" 같은 안내가
 * 일부러 들어 있어서, 주석까지 세면 규칙을 지켰는데도 걸립니다.
 */
const code = (f: string): string =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");

/** 배럴이 내주는 값 10개입니다. 이름은 정본 .d.ts 와 글자 그대로입니다. */
const BASE_VALUES = ["Icon", "Evidence", "Tag", "Disclosure", "CodeBlock", "tokenizeJava", "Chip", "ChipGroup", "Button", "StatusDot"] as const;
/** 배럴이 내주는 props 타입 9개입니다(tokenizeJava 는 함수라 타입이 없습니다). */
const BASE_PROPS = [
  "IconProps",
  "EvidenceProps",
  "TagProps",
  "DisclosureProps",
  "CodeBlockProps",
  "ChipProps",
  "ChipGroupProps",
  "ButtonProps",
  "StatusDotProps",
] as const;

/** 정본 jsx ↔ 포팅한 tsx 짝. Classmate 10개입니다(기본 요소 8개는 ui-base 가 자기 시험으로 봅니다). */
const CANON_PAIRS: Array<[string, string]> = [
  "TranscriptFlow",
  "MarginNote",
  "GuessList",
  "NowLine",
  "SourceFooter",
  "CodeCompare",
  "MomentRow",
  "AnswerCard",
  "SourceStatus",
  "StuckButton",
].map((n): [string, string] => [`classmate/${n}.jsx`, `components/${n}.tsx`]);

/** 파일 안에 나오는 cm-* 클래스 이름 집합입니다. 정본 쪽은 css() 블록을 먼저 뺍니다. */
function classNames(text: string, dropCssBlock: boolean): string[] {
  const body = dropCssBlock ? text.replace(/css\('[a-z0-9-]+',\s*`[\s\S]*?`\);/, "") : text;
  // 앞에 글자가 붙은 것(data-cm-lucide 등)은 클래스 이름이 아닙니다.
  return [...new Set(body.match(/(?<![a-z-])cm-[a-z0-9]+(?:__[a-z0-9]+)?(?:--[a-z0-9]+)?/g) ?? [])].sort();
}

describe("구조 규칙", () => {
  it("(1) internal/base 는 @classmate/ui-base 를 재수출하는 배럴 한 장이다", () => {
    const baseDir = join(srcRoot, "internal/base");
    // 1라운드의 사본 8개와 base.css 는 지웠습니다. 남는 것은 배럴 하나뿐입니다.
    expect(readdirSync(baseDir)).toEqual(["index.ts"]);

    const source = code(join(baseDir, "index.ts"));
    const targets = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(targets.length, "배럴은 재수출만 합니다").toBeGreaterThan(0);
    for (const target of targets) expect(target).toBe("@classmate/ui-base");

    for (const name of [...BASE_VALUES, ...BASE_PROPS]) {
      expect(source, `배럴이 ${name} 를 내보내야 합니다`).toContain(name);
    }
  });

  it("(1-1) 배럴이 내주는 것이 실제로 ui-base 의 그것과 같은 물건이다", () => {
    // 이름만 같고 알맹이가 다른 사본이 어딘가 남아 있으면 화면이 조용히 갈라집니다.
    const got = barrel as unknown as Record<string, unknown>;
    const want = uiBase as unknown as Record<string, unknown>;
    for (const name of BASE_VALUES) {
      expect(typeof got[name], `${name} 는 함수여야 합니다`).toBe("function");
      expect(got[name], `${name} 가 ui-base 의 것과 다릅니다`).toBe(want[name]);
    }
  });

  it("(2) 정본 jsx 의 cm-* 클래스 집합이 포팅한 tsx 에 그대로 있다 — 빠뜨리지도, 새로 만들지도 않는다", () => {
    expect(CANON_PAIRS).toHaveLength(10);
    for (const [canonRel, portedRel] of CANON_PAIRS) {
      const canon = classNames(read(join(canonRoot, canonRel)), true);
      const ported = classNames(read(join(srcRoot, portedRel)), false);
      expect(canon.length, `${canonRel} 에서 클래스를 못 뽑았습니다`).toBeGreaterThan(0);
      const missing = canon.filter((c) => !ported.includes(c));
      expect(missing, `${portedRel} 에 없는 정본 클래스: ${missing.join(", ")}`).toEqual([]);
      const invented = ported.filter((c) => !canon.includes(c));
      expect(invented, `${portedRel} 가 정본에 없는 클래스를 새로 만들었습니다: ${invented.join(", ")}`).toEqual([]);
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

  it("(4) @classmate/ui-base 는 배럴 한 곳에서만 import 하고, design-tokens 는 어디서도 안 한다", () => {
    // 글자가 아니라 실제 import 대상만 봅니다(주석·시험 제목에는 두 이름이 일부러 나옵니다).
    const barrelPath = join(srcRoot, "internal/base/index.ts");
    for (const f of codeFiles) {
      for (const m of code(f).matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
        if (m[1] === "@classmate/ui-base") expect(f, `${rel(f)}: ui-base 는 배럴에서만 부릅니다`).toBe(barrelPath);
        expect(m[1], rel(f)).not.toBe("@classmate/design-tokens");
      }
    }
    const pkgJson = read(join(pkgRoot, "package.json"));
    expect(pkgJson, "ui-base 는 workspace 의존입니다").toContain('"@classmate/ui-base": "workspace:*"');
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
