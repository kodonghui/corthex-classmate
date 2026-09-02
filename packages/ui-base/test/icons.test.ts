// 아이콘 맵 덮개 시험입니다.
//
// 정본 jsx 전부(`components/**/*.jsx` 32개 + `ui_kits/sidepanel/*.jsx`)가 쓰는 이름과
// readme.md ICONOGRAPHY 절의 어휘가 src/icons.ts 맵에 전부 있어야 합니다.
// 금지 아이콘은 반대로 없어야 합니다.
// 전체 조회(import { icons } from "lucide-react")를 쓰지 않는지도 함께 봅니다.
//
// 훑을 파일 목록은 손으로 적지 않고 폴더를 재귀로 읽습니다. 정본에 폴더나 화면이 늘어도
// 시험이 저절로 따라가고, 새 아이콘이 생기면 맵에 없다고 먼저 깨집니다.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ICON_MAP, lookupIcon } from "../src/icons";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(testDir, "..");
const designDir = join(packageDir, "..", "..", "design/claude-design-export/design-system");

/** 정본 jsx 가 있는 두 뿌리입니다. docs/DECISIONS.md 가 이 둘을 소스 정본으로 적었습니다. */
const CANON_ROOTS = [join(designDir, "components"), join(designDir, "ui_kits", "sidepanel")];

/** 두 뿌리 아래 .jsx 를 재귀로 모읍니다. 경로 구분자는 / 로 맞춥니다. */
function canonJsxFiles(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
  return CANON_ROOTS.flatMap(walk)
    .filter((f) => f.endsWith(".jsx"))
    .map((f) => f.replace(/\\/g, "/"))
    .sort();
}

/**
 * 정본 jsx 한 파일에서 아이콘 이름을 뽑습니다. name="…" · icon="…" · icon: '…' · icon={…'x'…} · ICON(S) 맵.
 *
 * name= 은 <Icon> 태그 안에 있는 것만 셉니다. 정본에는 <RadioGroup name="len">·<Radio name={name}> 처럼
 * 아이콘과 상관없는 name 속성도 있어서, 전부 훑으면 폼 필드 이름("len")이 아이콘으로 잡힙니다.
 */
function iconNamesIn(source: string): string[] {
  const found = new Set<string>();
  const push = (v: string | undefined): void => {
    if (v !== undefined) found.add(v);
  };
  for (const tag of source.matchAll(/<Icon\b[^>]*>/g)) {
    const attrs = tag[0];
    for (const m of attrs.matchAll(/\bname=(?:"([a-z][a-z0-9-]*)"|'([a-z][a-z0-9-]*)')/g)) push(m[1] ?? m[2]);
    for (const m of attrs.matchAll(/\bname=\{([^}]*)\}/g))
      for (const q of (m[1] ?? "").matchAll(/'([a-z][a-z0-9-]*)'/g)) push(q[1]);
  }
  for (const m of source.matchAll(/\bicon=(?:"([a-z][a-z0-9-]*)"|'([a-z][a-z0-9-]*)')/g)) push(m[1] ?? m[2]);
  for (const m of source.matchAll(/\bicon=\{([^}]*)\}/g))
    for (const q of (m[1] ?? "").matchAll(/'([a-z][a-z0-9-]*)'/g)) push(q[1]);
  // `icon: 'circle'` 과 `icon: s.icon || 'circle'` 을 함께 봅니다. 쉼표·중괄호를 넘지 않습니다.
  for (const m of source.matchAll(/\bicon:\s*[^,}]*?'([a-z][a-z0-9-]*)'/g)) push(m[1]);
  for (const m of source.matchAll(/^const\s+(?:ICON|ICONS)\s*=\s*\{([^}]*)\}/gm))
    for (const q of (m[1] ?? "").matchAll(/'([a-z][a-z0-9-]*)'/g)) push(q[1]);
  return [...found].sort();
}

/** 정본 jsx 전부에서 쓰인 아이콘 이름입니다. */
function iconNamesInCanon(): string[] {
  const found = new Set<string>();
  for (const file of canonJsxFiles()) for (const name of iconNamesIn(readFileSync(file, "utf8"))) found.add(name);
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
  it("훑는 범위가 정본 jsx 전부다(classmate 10개 · ui_kits/sidepanel 포함)", () => {
    const files = canonJsxFiles();
    // components 32개(여섯 폴더 22 + classmate 10) + ui_kits/sidepanel 5개.
    expect(files.length).toBeGreaterThanOrEqual(37);
    expect(files.filter((f) => f.includes("/components/classmate/")).length).toBe(10);
    expect(files.some((f) => f.endsWith("/ui_kits/sidepanel/SettingsScreen.jsx"))).toBe(true);
    expect(files.some((f) => f.endsWith("/ui_kits/sidepanel/DetailScreen.jsx"))).toBe(true);
  });

  it("정본 jsx 가 쓰는 이름이 전부 맵에 있다", () => {
    const used = iconNamesInCanon();
    expect(used.length).toBeGreaterThanOrEqual(23);
    const missing = used.filter((n) => lookupIcon(n) === undefined);
    expect(missing).toEqual([]);
  });

  it("ui_kits/sidepanel 이 쓰는 이름도 맵에 있다(trash-2 · settings-2 · git-compare)", () => {
    // SettingsScreen 의 "오늘 기록 지우기" 버튼이 icon="trash-2" 를 씁니다. 빠지면 빈 span 이 그려집니다.
    const used = iconNamesInCanon();
    for (const name of ["trash-2", "settings-2", "git-compare", "arrow-left", "monitor"]) {
      expect(used, `${name} 은 정본 ui_kits 가 씁니다`).toContain(name);
      expect(lookupIcon(name), `${name} 은 맵에 있어야 합니다`).toBeDefined();
    }
  });

  it("사이드패널·ui-classmate 가 쓰는 이름 8개도 맵에 있다", () => {
    // 2라운드에 @classmate/ui-classmate 의 internal/base 사본을 이 패키지로 갈아 끼우면서
    // 그쪽 맵이 담고 있던 여덟 이름을 여기로 옮겼습니다. 정본에서는 `.jsx` 가 아니라 각 폴더의
    // `*.card.html`·`*.prompt.md` 예시에 나오는 이름이라 위의 재귀 훑기로는 잡히지 않습니다.
    // 그래서 이름을 손으로 적어 요구합니다. 하나라도 빠지면 그 자리에 빈 span 이 그려집니다.
    for (const name of [
      "arrow-up",
      "files",
      "history",
      "list",
      "message-circle",
      "message-square-text",
      "minimize-2",
      "refresh-cw",
    ]) {
      expect(lookupIcon(name), `${name} 은 맵에 있어야 합니다`).toBeDefined();
    }
  });

  it("아이콘이 아닌 name 속성은 아이콘으로 세지 않는다", () => {
    // 정본 SettingsScreen 의 <RadioGroup name="len"> 은 폼 필드 이름입니다.
    expect(iconNamesInCanon()).not.toContain("len");
    expect(iconNamesIn(`<RadioGroup name="len" value={len} />`)).toEqual([]);
    expect(iconNamesIn(`<Icon name="trash-2" size={16} />`)).toEqual(["trash-2"]);
    expect(iconNamesIn(`<Button icon="trash-2">지우기</Button>`)).toEqual(["trash-2"]);
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
