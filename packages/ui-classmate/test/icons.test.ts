// 아이콘에 대해 이 패키지가 지키는 몫입니다.
//
// 2라운드에 kebab 이름 → lucide-react 컴포넌트 맵은 @classmate/ui-base 의 ICON_MAP 하나로 합쳤습니다.
// 그래서 "맵을 손으로 적은 선별 목록으로 유지한다" 같은 규칙은 ui-base 의 test/icons.test.ts 가 봅니다.
// 여기서는 두 가지만 봅니다.
//  (1) 정본 classmate 10개가 쓰는 이름이 그 맵에서 전부 찾아진다 — 빠지면 화면에 빈 자리가 생깁니다.
//  (2) 금지 이름(sparkles·bot·brain)은 그 맵에 없다.
// 그리고 이 패키지에 사본 맵이 되살아나지 않았는지도 함께 봅니다.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lookupIcon } from "@classmate/ui-base";

import { BANNED_ICON_NAMES } from "../src/icons";
import { canonRoot, srcRoot } from "./paths";

/** 정본 classmate 10개 jsx 안에서 아이콘 이름으로 쓰인 문자열을 모읍니다. */
function iconNamesInClassmateJsx(): Set<string> {
  const found = new Set<string>();
  const push = (text: string, re: RegExp): void => {
    for (const m of text.matchAll(re)) {
      const name = m[1];
      if (name !== undefined && name.length > 0) found.add(name);
    }
  };
  const dir = join(canonRoot, "classmate");
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
  return found;
}

describe("아이콘 이름", () => {
  it("정본 classmate 10개가 쓰는 이름을 ui-base 맵에서 전부 찾는다", () => {
    const used = [...iconNamesInClassmateJsx()].sort();
    expect(used.length).toBeGreaterThan(5);
    const missing = used.filter((n) => lookupIcon(n) === undefined);
    expect(missing, `@classmate/ui-base 의 ICON_MAP 에 없는 이름: ${missing.join(", ")}`).toEqual([]);
  });

  it("금지된 이름(sparkles·bot·brain)은 ui-base 맵에도 없다", () => {
    for (const banned of BANNED_ICON_NAMES) {
      expect(lookupIcon(banned), `${banned} 은 맵에 있으면 안 됩니다`).toBeUndefined();
    }
  });

  it("이 패키지에 아이콘 맵 사본이 되살아나지 않았다", () => {
    // 맵이 두 벌이면 조용히 갈라집니다. src 어디에서도 lucide-react 를 직접 부르지 않습니다.
    for (const file of readdirSync(srcRoot, { recursive: true, withFileTypes: true })) {
      if (!file.isFile() || !/\.tsx?$/.test(file.name)) continue;
      const text = readFileSync(join(file.parentPath, file.name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
      expect(text, `${file.name}: 아이콘은 @classmate/ui-base 를 거칩니다`).not.toMatch(/from\s*["']lucide-react/);
    }
  });
});
