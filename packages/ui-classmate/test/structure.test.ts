// 2라운드에 internal/base 를 @classmate/ui-base 로 기계적으로 바꿀 수 있는 상태인지 시험으로 못 박습니다.
// 그리고 1라운드 공유 규칙·불변 원칙(런타임 주입 0, 외부 URL 0)을 지키는지 봅니다.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

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
 * 주석을 뺀 실제 코드만 봅니다. 이 패키지의 주석에는 "2라운드에 @classmate/ui-base 로 바꾼다" 같은
 * 안내가 일부러 들어 있어서, 주석까지 세면 규칙을 지켰는데도 걸립니다.
 */
const code = (f: string): string =>
  read(f)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const BASE_FILES = ["Button.tsx", "Chip.tsx", "CodeBlock.tsx", "Disclosure.tsx", "Evidence.tsx", "Icon.tsx", "StatusDot.tsx", "Tag.tsx"];
/** props 인터페이스 이름 → [정본 .d.ts, 포팅한 internal/base 파일] */
const PROPS_SOURCES: Array<[string, string, string]> = [
  ["IconProps", "core/Icon.d.ts", "Icon.tsx"],
  ["EvidenceProps", "feedback/Evidence.d.ts", "Evidence.tsx"],
  ["TagProps", "feedback/Tag.d.ts", "Tag.tsx"],
  ["DisclosureProps", "surfaces/Disclosure.d.ts", "Disclosure.tsx"],
  ["CodeBlockProps", "surfaces/CodeBlock.d.ts", "CodeBlock.tsx"],
  ["ChipProps", "forms/Chip.d.ts", "Chip.tsx"],
  ["ChipGroupProps", "forms/Chip.d.ts", "Chip.tsx"],
  ["ButtonProps", "core/Button.d.ts", "Button.tsx"],
  ["StatusDotProps", "feedback/StatusDot.d.ts", "StatusDot.tsx"],
];
const PROPS_NAMES = PROPS_SOURCES.map(([name]) => name);

/** 정본 jsx ↔ 포팅한 tsx 짝. 기본 요소 8개 + Classmate 10개입니다. */
const CANON_PAIRS: Array<[string, string]> = [
  ["core/Icon.jsx", "internal/base/Icon.tsx"],
  ["core/Button.jsx", "internal/base/Button.tsx"],
  ["feedback/Evidence.jsx", "internal/base/Evidence.tsx"],
  ["feedback/Tag.jsx", "internal/base/Tag.tsx"],
  ["feedback/StatusDot.jsx", "internal/base/StatusDot.tsx"],
  ["forms/Chip.jsx", "internal/base/Chip.tsx"],
  ["surfaces/Disclosure.jsx", "internal/base/Disclosure.tsx"],
  ["surfaces/CodeBlock.jsx", "internal/base/CodeBlock.tsx"],
  ...["TranscriptFlow", "MarginNote", "GuessList", "NowLine", "SourceFooter", "CodeCompare", "MomentRow", "AnswerCard", "SourceStatus", "StuckButton"].map(
    (n): [string, string] => [`classmate/${n}.jsx`, `components/${n}.tsx`],
  ),
];

/** `interface <이름> … { … }` 의 중괄호 안쪽을 짝을 세어 잘라 냅니다. */
function interfaceBody(text: string, name: string): string {
  const at = text.indexOf(`interface ${name}`);
  expect(at, `${name} 선언을 찾지 못했습니다`).toBeGreaterThan(-1);
  const open = text.indexOf("{", at);
  let depth = 0;
  let i = open;
  for (; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) break;
  }
  return text.slice(open + 1, i);
}

/** 인터페이스 본문에서 맨 바깥 깊이의 prop 이름만 모읍니다(주석·중첩 타입은 뺍니다). */
function propNames(text: string, name: string): string[] {
  const body = interfaceBody(text, name)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const members: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of body) {
    if ("{([<".includes(ch)) depth++;
    else if ("})]>".includes(ch)) depth--;
    if ((ch === ";" || ch === ",") && depth === 0) {
      members.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  members.push(cur);
  const found = new Set<string>();
  for (const m of members) {
    const hit = /^\s*([A-Za-z_$][\w$]*)\s*\??\s*:/.exec(m);
    if (hit?.[1] !== undefined) found.add(hit[1]);
  }
  return [...found].sort();
}

/** `extends` 절(없으면 빈 문자열)입니다. 공백만 다듬어 견줍니다. */
function extendsClause(text: string, name: string): string {
  const hit = new RegExp(`interface ${name}\\s+extends\\s+([^{]+){`).exec(text);
  return (hit?.[1] ?? "").replace(/\s+/g, " ").trim();
}

/** 파일 안에 나오는 cm-* 클래스 이름 집합입니다. 정본 쪽은 css() 블록을 먼저 뺍니다. */
function classNames(text: string, dropCssBlock: boolean): string[] {
  const body = dropCssBlock ? text.replace(/css\('[a-z0-9-]+',\s*`[\s\S]*?`\);/, "") : text;
  // 앞에 글자가 붙은 것(data-cm-lucide 등)은 클래스 이름이 아닙니다.
  return [...new Set(body.match(/(?<![a-z-])cm-[a-z0-9]+(?:__[a-z0-9]+)?(?:--[a-z0-9]+)?/g) ?? [])].sort();
}

describe("구조 규칙", () => {
  it("(1) internal/base 는 정본 .d.ts 와 같은 파일명·export 이름·props 인터페이스 이름을 쓴다", () => {
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
    // 이름만 같은지가 아니라, prop 이름 집합과 extends 절까지 정본 .d.ts 와 같은지 봅니다.
    // (이 줄이 없으면 "JSX.Element → React.JSX.Element 말고는 손대지 않았다"는 주장을 아무도 지키지 않습니다.)
    for (const [props, canonRel, portedRel] of PROPS_SOURCES) {
      const canon = read(join(canonRoot, canonRel));
      const ported = read(join(srcRoot, "internal/base", portedRel));
      expect(propNames(ported, props), `${portedRel}: ${props} 의 prop 이름이 정본 ${canonRel} 와 달라졌습니다`).toEqual(
        propNames(canon, props),
      );
      expect(extendsClause(ported, props), `${portedRel}: ${props} 의 extends 절이 정본과 달라졌습니다`).toBe(
        extendsClause(canon, props),
      );
    }
    // 반환 타입만 JSX.Element → React.JSX.Element 로 바꿨습니다.
    for (const f of BASE_FILES) {
      expect(read(join(baseDir, f)), `${f}: 반환 타입은 React.JSX.Element`).toContain("React.JSX.Element");
    }
  });

  it("(2) 정본 jsx 의 cm-* 클래스 집합이 포팅한 tsx 에 그대로 있다 — 빠뜨리지도, 새로 만들지도 않는다", () => {
    expect(CANON_PAIRS).toHaveLength(18);
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
