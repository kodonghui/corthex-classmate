// 아이콘 맵 덮개 시험입니다.
//
// 정본 components/**/*.jsx 가 쓰는 이름과 readme.md ICONOGRAPHY 절의 어휘가
// src/icons.ts 맵에 전부 있어야 합니다. 금지 아이콘은 반대로 없어야 합니다.
// 전체 조회(import { icons } from "lucide-react")를 쓰지 않는지도 함께 봅니다.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ICON_MAP, lookupIcon } from "../src/icons";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(testDir, "..");
const designDir = join(packageDir, "..", "..", "design/claude-design-export/design-system");
const canonDir = join(designDir, "components");

/** 정본 jsx 여섯 폴더 + classmate 폴더. classmate 는 단위 (3) 이 쓰지만 아이콘 맵은 같은 어휘를 씁니다. */
const CANON_DIRS = ["core", "forms", "feedback", "surfaces", "navigation", "overlay", "classmate"];

/** 정본 jsx 에서 아이콘 이름 문자열을 뽑습니다. name=" " · icon=" " · icon: ' ' · name={…'x'…} · ICON(S) 맵. */
function iconNamesInCanon(): string[] {
  const found = new Set<string>();
  for (const dir of CANON_DIRS) {
    for (const file of readdirSync(join(canonDir, dir)).filter((n) => n.endsWith(".jsx"))) {
      const source = readFileSync(join(canonDir, dir, file), "utf8");
      const push = (v: string | undefined): void => {
        if (v !== undefined) found.add(v);
      };
      for (const m of source.matchAll(/\b(?:name|icon)=(?:"([a-z][a-z0-9-]*)"|'([a-z][a-z0-9-]*)')/g))
        push(m[1] ?? m[2]);
      for (const m of source.matchAll(/\bicon:\s*'([a-z][a-z0-9-]*)'/g)) push(m[1]);
      for (const m of source.matchAll(/\b(?:name|icon)=\{([^}]*)\}/g))
        for (const q of (m[1] ?? "").matchAll(/'([a-z][a-z0-9-]*)'/g)) push(q[1]);
      for (const m of source.matchAll(/^const\s+(?:ICON|ICONS)\s*=\s*\{([^}]*)\}/gm))
        for (const q of (m[1] ?? "").matchAll(/'([a-z][a-z0-9-]*)'/g)) push(q[1]);
      for (const m of source.matchAll(/\bicon:\s*[^,}]*?\|\|\s*'([a-z][a-z0-9-]*)'/g)) push(m[1]);
    }
  }
  return [...found].sort();
}

/** readme.md ICONOGRAPHY 절의 "Vocabulary:" 목록. `chevron-down/right` 는 두 이름으로 폅니다. */
function readmeVocabulary(): { vocabulary: string[]; banned: string[] } {
  const readme = readFileSync(join(designDir, "readme.md"), "utf8");
  const vocab = readme.match(/Vocabulary:([\s\S]*?)Banned:([\s\S]*?)\./);
  if (vocab === null) throw new Error("readme.md 에서 Vocabulary / Banned 줄을 못 찾았습니다");
  const names = new Set<string>();
  for (const m of (vocab[1] ?? "").matchAll(/`([a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)?)`/g)) {
    const token = m[1] ?? "";
    const slash = token.indexOf("/");
    if (slash === -1) {
      names.add(token);
    } else {
      // `chevron-down/right` → chevron-down · chevron-right
      const head = token.slice(0, slash);
      names.add(head);
      names.add(`${head.split("-")[0] ?? head}-${token.slice(slash + 1)}`);
    }
  }
  const banned = [...(vocab[2] ?? "").matchAll(/`([a-z][a-z0-9-]*)`/g)].map((m) => m[1] ?? "");
  return { vocabulary: [...names].sort(), banned };
}

describe("아이콘 맵", () => {
  it("정본 jsx 가 쓰는 이름이 전부 맵에 있다", () => {
    const used = iconNamesInCanon();
    expect(used.length).toBeGreaterThanOrEqual(20);
    const missing = used.filter((n) => lookupIcon(n) === undefined);
    expect(missing).toEqual([]);
  });

  it("readme.md 의 아이콘 어휘가 전부 맵에 있다", () => {
    const { vocabulary } = readmeVocabulary();
    expect(vocabulary).toContain("git-compare");
    expect(vocabulary).toContain("chevron-right");
    const missing = vocabulary.filter((n) => lookupIcon(n) === undefined);
    expect(missing).toEqual([]);
  });

  it("금지 아이콘(sparkles·bot·brain)은 맵에 없다", () => {
    const { banned } = readmeVocabulary();
    expect(banned).toEqual(expect.arrayContaining(["sparkles", "bot", "brain"]));
    for (const name of [...banned, "sparkles", "bot", "brain"]) {
      expect(lookupIcon(name), `${name} 은 맵에 있으면 안 됩니다`).toBeUndefined();
    }
  });

  it("맵은 손으로 적은 선별 목록이다(lucide-react 전체 조회를 쓰지 않는다)", () => {
    // 주석에는 "쓰지 않는 방법"을 적어 두었으므로 주석을 뺀 코드만 봅니다.
    const source = readFileSync(join(packageDir, "src/icons.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
    expect(source).not.toMatch(/import\s*\{[^}]*\bicons\b[^}]*\}\s*from\s*["']lucide-react["']/);
    expect(source).not.toMatch(/from\s+["']lucide-react\/dynamic["']/);
    expect(Object.keys(ICON_MAP).length).toBeLessThanOrEqual(32);
  });

  it("맵의 이름은 전부 kebab-case 이고 값은 컴포넌트다", () => {
    for (const [name, component] of Object.entries(ICON_MAP)) {
      expect(name).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
      expect(component).toBeTypeOf("object");
    }
  });
});
