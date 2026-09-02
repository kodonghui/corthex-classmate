// TS 상수(src/tokens.ts)가 CSS 와 어긋나지 않는지 봅니다.
//
// (c) 고유 변수 이름 196개가 체크인한 test/token-names.snapshot.txt 와 같아야 합니다.
// (d) src/tokens.ts 가 생성 스크립트를 다시 돌린 결과와 같아야 합니다(오래된 생성물 잡기).
// (f) 정본 값을 바꾼 --panel-header-h 가 44px 로 들어와야 합니다.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { REDUCED_MOTION_OVERRIDES, TOKEN_NAMES, tokens, VERBATIM_TOKEN_FILES } from "../src/index";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const cssDir = join(packageDir, "src", "css");
const snapshotPath = join(packageDir, "test", "token-names.snapshot.txt");
const generatorPath = join(packageDir, "scripts", "generate-tokens.mjs");
const tokensModulePath = join(packageDir, "src", "tokens.ts");

/**
 * CSS 에서 고유 변수 이름을 뽑습니다.
 * 줄머리만 보면 typography.css 처럼 한 줄에 여러 개를 선언한 자리를 놓치므로
 * 앞이 `;`·`{`·공백인 `--이름:` 을 모두 셉니다.
 */
function cssTokenNames(): string[] {
  const names = new Set<string>();
  for (const file of VERBATIM_TOKEN_FILES) {
    const css = readFileSync(join(cssDir, file), "utf8");
    for (const match of css.matchAll(/(?:^|[;{\s])--([A-Za-z0-9-]+)\s*:/g)) {
      const name = match[1];
      if (name !== undefined) names.add(name);
    }
  }
  return [...names].sort();
}

function snapshotNames(): string[] {
  return readFileSync(snapshotPath, "utf8").split("\n").filter((line) => line.length > 0);
}

describe("토큰 이름 스냅샷", () => {
  it("CSS 의 고유 변수 이름이 스냅샷과 같다", () => {
    expect(cssTokenNames()).toEqual(snapshotNames());
  });

  it("스냅샷은 196줄이다", () => {
    expect(snapshotNames()).toHaveLength(196);
  });

  it("TOKEN_NAMES 와 tokens 의 키가 스냅샷과 같다", () => {
    const expected = snapshotNames();
    expect([...TOKEN_NAMES]).toEqual(expected);
    expect(Object.keys(tokens).sort()).toEqual(expected);
    expect(Object.keys(tokens)).toHaveLength(196);
  });
});

describe("생성물 최신성", () => {
  it("src/tokens.ts 가 생성 스크립트를 다시 돌린 결과와 같다", () => {
    const regenerated = execFileSync(process.execPath, [generatorPath, "--stdout"], {
      encoding: "utf8",
    });
    const onDisk = readFileSync(tokensModulePath, "utf8");
    expect(onDisk).toBe(regenerated);
  });
});

describe("토큰 값", () => {
  it("정본 예외 --panel-header-h 는 44px 이다", () => {
    expect(tokens["panel-header-h"]).toBe("44px");
  });

  it("색·간격·타입 대표 값이 정본 그대로다", () => {
    expect(tokens["paper-1"]).toBe("#FBF9F4");
    expect(tokens["ink-600"]).toBe("#155D53");
    expect(tokens["panel-width"]).toBe("380px");
    expect(tokens["panel-min-width"]).toBe("320px");
    expect(tokens["text-body-size"]).toBe("14px");
    expect(tokens["shadow-none"]).toBe("none");
  });

  it("미디어쿼리 재선언은 tokens 에 섞이지 않고 따로 있다", () => {
    expect(tokens["duration-fast"]).toBe("120ms");
    expect(tokens["enter-offset"]).toBe("4px");
    expect(REDUCED_MOTION_OVERRIDES).toEqual({
      "duration-fast": "0ms",
      "duration-base": "0ms",
      "duration-slow": "0ms",
      "enter-offset": "0px",
    });
  });
});
