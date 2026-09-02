// 정본 jsx 가 주입하던 css('<id>', `…`) 블록이 styles.css / base.css 에 글자 그대로 들어갔는지 봅니다.
// 클래스 이름은 스크린샷 앵커이므로 정본 집합이 포팅본 집합에 그대로 있는지도 확인합니다.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonRoot, srcRoot } from "./paths";

const read = (f: string): string => readFileSync(f, "utf8");
/** 공백 차이를 지우고 견줍니다. */
const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

/** 정본 jsx 에서 css('<id>', `…`) 블록을 뽑습니다. */
function cssBlock(canonRel: string): { id: string; body: string } {
  const m = /css\('([a-z0-9-]+)',\s*`([\s\S]*?)`\);/.exec(read(join(canonRoot, canonRel)));
  expect(m, `${canonRel} 에 css() 블록이 있어야 합니다`).not.toBeNull();
  return { id: m![1]!, body: m![2]! };
}

/** 정본 jsx 의 JSX 부분(css 블록을 뺀 나머지)에 나오는 cm-* 클래스 이름입니다. */
function classNames(canonRel: string): string[] {
  const text = read(join(canonRoot, canonRel)).replace(/css\('[a-z0-9-]+',\s*`[\s\S]*?`\);/, "");
  const found = new Set<string>();
  // 앞에 글자가 붙은 것(data-cm-lucide 등)은 클래스 이름이 아닙니다.
  for (const m of text.matchAll(/(?<![a-z-])cm-[a-z0-9]+(?:__[a-z0-9]+)?(?:--[a-z0-9]+)?/g)) found.add(m[0]);
  return [...found].sort();
}

const BASE: Array<[string, string]> = [
  ["Evidence", "feedback/Evidence.jsx"],
  ["Tag", "feedback/Tag.jsx"],
  ["Disclosure", "surfaces/Disclosure.jsx"],
  ["CodeBlock", "surfaces/CodeBlock.jsx"],
  ["Chip", "forms/Chip.jsx"],
  ["Button", "core/Button.jsx"],
  ["StatusDot", "feedback/StatusDot.jsx"],
];

const CLASSMATE: Array<[string, string]> = [
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
].map((n) => [n, `classmate/${n}.jsx`]);

const baseCss = norm(read(join(srcRoot, "internal/base/base.css")));
const stylesCss = norm(read(join(srcRoot, "styles.css")));

describe("CSS 동일성", () => {
  it("styles.css 가 base.css 를 먼저 @import 한다", () => {
    const raw = read(join(srcRoot, "styles.css"));
    expect(raw.trimStart().startsWith('@import "./internal/base/base.css";')).toBe(true);
  });

  it.each(BASE)("기본 요소 %s 의 css 블록이 base.css 에 그대로 있다", (_name, canonRel) => {
    const { body } = cssBlock(canonRel);
    expect(baseCss).toContain(norm(body));
  });

  it.each(CLASSMATE)("Classmate %s 의 css 블록이 styles.css 에 그대로 있다", (_name, canonRel) => {
    const { body } = cssBlock(canonRel);
    expect(stylesCss).toContain(norm(body));
  });

  it("Icon 은 정본에도 css 블록이 없다", () => {
    expect(read(join(canonRoot, "core/Icon.jsx"))).not.toMatch(/css\('/);
  });
});

describe("클래스 이름 원문 유지", () => {
  const cases: Array<[string, string, string]> = [
    ...BASE.map(([name, canonRel]): [string, string, string] => [name, canonRel, `internal/base/${name}.tsx`]),
    ["Icon", "core/Icon.jsx", "internal/base/Icon.tsx"],
    ...CLASSMATE.map(([name, canonRel]): [string, string, string] => [name, canonRel, `components/${name}.tsx`]),
  ];

  it.each(cases)("%s 의 정본 cm-* 클래스가 포팅본에도 전부 있다", (_name, canonRel, portedRel) => {
    const ported = read(join(srcRoot, portedRel));
    const names = classNames(canonRel);
    expect(names.length).toBeGreaterThan(0);
    const missing = names.filter((c) => !ported.includes(c));
    expect(missing, `${portedRel} 에 없는 클래스: ${missing.join(", ")}`).toEqual([]);
  });
});
