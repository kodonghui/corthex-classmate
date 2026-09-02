// 아이콘 맵(src/icons.ts)이 정본이 실제로 쓰는 이름을 빠짐없이 담고 있는지 봅니다.
// unpkg 런타임 로드를 lucide-react 로 바꿨으므로, 맵에 빠진 이름은 그대로 빈 자리가 됩니다.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BANNED_ICON_NAMES, ICONS } from "../src/icons";
import { canonRoot, srcRoot } from "./paths";

const GROUPS = ["classmate", "core", "feedback", "forms", "navigation", "overlay", "surfaces"];

/** 정본 jsx 안에서 아이콘 이름으로 쓰인 문자열을 모읍니다. */
function iconNamesInCanonicalJsx(): Set<string> {
  const found = new Set<string>();
  const push = (text: string, re: RegExp): void => {
    for (const m of text.matchAll(re)) {
      const name = m[1];
      if (name !== undefined && name.length > 0) found.add(name);
    }
  };
  for (const group of GROUPS) {
    const dir = join(canonRoot, group);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsx"))) {
      const text = readFileSync(join(dir, file), "utf8");
      // name="hand" / icon='mic' / iconRight="chevron-down"
      push(text, /(?:name|icon|iconRight)=["']([a-z][a-z0-9-]*)["']/g);
      // { icon: 'mic' } 형태의 맵
      push(text, /\bicon:\s*'([a-z][a-z0-9-]*)'/g);
      // const ICON = { idle: 'hand', … } / const ICONS = { paused: 'pause-circle', … }
      for (const line of text.split("\n")) {
        if (!/^const ICONS? = \{/.test(line)) continue;
        push(line, /'([a-z][a-z0-9-]*)'/g);
      }
      // name={on ? 'check' : 'chevron-right'} 같은 삼항
      for (const m of text.matchAll(/name=\{([^}]*)\}/g)) {
        push(m[1] ?? "", /'([a-z][a-z0-9-]*)'/g);
      }
    }
  }
  return found;
}

/** design-system/readme.md 의 ICONOGRAPHY 문단이 정한 어휘입니다. */
function iconNamesInReadme(): Set<string> {
  const text = readFileSync(join(canonRoot, "..", "readme.md"), "utf8");
  const start = text.indexOf("## ICONOGRAPHY");
  expect(start, "readme.md 에 ICONOGRAPHY 문단이 있어야 합니다").toBeGreaterThan(-1);
  const section = text.slice(start, text.indexOf("---", start));
  const found = new Set<string>();
  // 백틱으로 감싼 이름만 어휘로 봅니다. `chevron-down/right` 처럼 붙여 쓴 것도 풀어 담습니다.
  for (const m of section.matchAll(/`([a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*)`/g)) {
    const raw = m[1] ?? "";
    const parts = raw.split("/");
    const head = parts[0] ?? "";
    found.add(head);
    const prefix = head.includes("-") ? `${head.slice(0, head.lastIndexOf("-"))}-` : "";
    for (const tail of parts.slice(1)) found.add(`${prefix}${tail}`);
  }
  for (const banned of BANNED_ICON_NAMES) found.delete(banned);
  return found;
}

describe("아이콘 맵", () => {
  it("정본 jsx 가 쓰는 이름을 전부 담는다", () => {
    const used = [...iconNamesInCanonicalJsx()].sort();
    expect(used.length).toBeGreaterThan(10);
    const missing = used.filter((n) => !(n in ICONS));
    expect(missing, `src/icons.ts 에 없는 이름: ${missing.join(", ")}`).toEqual([]);
  });

  it("readme.md ICONOGRAPHY 어휘를 전부 담는다", () => {
    const vocab = [...iconNamesInReadme()].sort();
    expect(vocab).toContain("bookmark");
    expect(vocab).toContain("git-compare");
    expect(vocab).toContain("chevron-right");
    const missing = vocab.filter((n) => !(n in ICONS));
    expect(missing, `src/icons.ts 에 없는 어휘: ${missing.join(", ")}`).toEqual([]);
  });

  it("금지된 이름(sparkles·bot·brain)은 담지 않는다", () => {
    for (const banned of BANNED_ICON_NAMES) expect(Object.keys(ICONS)).not.toContain(banned);
  });

  it("맵의 모든 값이 실제 lucide-react 컴포넌트다", () => {
    for (const [name, Glyph] of Object.entries(ICONS)) {
      expect(Glyph, name).toBeTruthy();
    }
  });

  it("lucide-react 전체 조회(icons)는 쓰지 않는다 — MV3 번들 크기", () => {
    const text = readFileSync(join(srcRoot, "icons.ts"), "utf8");
    expect(text).not.toMatch(/^\s*import\s*\{[^}]*\bicons\b[^}]*\}\s*from/m);
    expect(text).not.toMatch(/from\s*["']lucide-react\/.*["']/);
  });
});
