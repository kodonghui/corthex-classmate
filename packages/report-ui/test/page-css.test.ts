// (e) 페이지 CSS 는 색 코드를 직접 적지 않고 토큰 변수만 씁니다.
//     여기에 더해 제품 코드가 지켜야 하는 경계(§4-7 · 1라운드 공유 규칙)를 소스에서 직접 확인합니다.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EVIDENCE_LABELS_KO as CONTRACT_EVIDENCE_LABELS_KO, SESSION_EVENT_TYPES } from "@classmate/contracts";

import { EVIDENCE_LABELS_KO, SESSION_EVENT_LABELS_KO } from "../src/labels.ts";
import { PAGE_CSS } from "../src/page-css.ts";
import { EXCLUDED_TOKEN_FILES, PANEL_HEADER_HEIGHT, readDesignTokenCss, TOKEN_FILE_ORDER } from "../src/tokens.ts";
import { SCRIPTS_DIR, SRC_DIR } from "./helpers.ts";

function collectFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...collectFiles(full));
    } else if (/\.(ts|tsx|mjs)$/.test(name)) {
      found.push(full);
    }
  }
  return found;
}

const productFiles = [...collectFiles(SRC_DIR), ...collectFiles(SCRIPTS_DIR)];

describe("페이지 CSS", () => {
  it("색 코드를 직접 적지 않는다", () => {
    expect(PAGE_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("디자인 토큰 변수를 쓴다", () => {
    expect(PAGE_CSS).toContain("var(--");
    expect(PAGE_CSS).toContain("var(--panel-header-h)");
    expect(PAGE_CSS).toContain("var(--surface-card)");
    expect(PAGE_CSS).toContain("var(--type-body)");
  });

  it("바깥 주소를 부르지 않는다", () => {
    expect(PAGE_CSS).not.toContain("url(");
    expect(PAGE_CSS).not.toContain("@import");
  });
});

describe("디자인 토큰 인라인", () => {
  const tokenCss = readDesignTokenCss();

  it("정본 여섯 장을 정해진 순서로 잇는다", () => {
    const positions = TOKEN_FILE_ORDER.map((name) => tokenCss.indexOf(`/* tokens: ${name} */`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("CDN 을 부르는 fonts.css 는 넣지 않는다", () => {
    expect(EXCLUDED_TOKEN_FILES).toContain("fonts.css");
    expect(TOKEN_FILE_ORDER).not.toContain("fonts.css");
    expect(tokenCss).not.toContain("@import");
    expect(tokenCss).not.toContain("http://");
    expect(tokenCss).not.toContain("https://");
  });

  it("패널 머리 높이를 결정 기록대로 바꿔 넣는다", () => {
    expect(tokenCss).toContain(`--panel-header-h: ${PANEL_HEADER_HEIGHT};`);
    expect(tokenCss).not.toContain("--panel-header-h: 48px;");
  });
});

describe("화면 문구", () => {
  it("근거 단계 문구가 계약과 같다", () => {
    expect(EVIDENCE_LABELS_KO).toEqual({ ...CONTRACT_EVIDENCE_LABELS_KO });
  });

  it("사건 이름 문구가 계약의 사건 목록을 모두 덮는다", () => {
    expect(Object.keys(SESSION_EVENT_LABELS_KO).sort()).toEqual([...SESSION_EVENT_TYPES].sort());
  });
});

describe("제품 코드의 경계", () => {
  it("검사할 소스 파일을 찾았다", () => {
    expect(productFiles.length).toBeGreaterThan(5);
  });

  it("HTML 을 직접 꽂아 넣는 자리가 없다 (§4-7)", () => {
    const marker = ["dangerously", "SetInnerHTML"].join("");
    for (const file of productFiles) {
      expect(`${file}: ${readFileSync(file, "utf8").includes(marker)}`).toBe(`${file}: false`);
    }
  });

  it("잎 패키지끼리 import 하지 않는다 (1라운드 공유 규칙)", () => {
    // 이름을 글로 적는 것(주석)은 괜찮고, 실제로 불러오는 것만 막습니다.
    const importPattern = /(?:from|import)\s*\(?\s*"@classmate\/design-tokens"/;
    for (const file of productFiles) {
      expect(`${file}: ${importPattern.test(readFileSync(file, "utf8"))}`).toBe(`${file}: false`);
    }
  });

  it("계약은 import type 으로만 가져온다", () => {
    const importPattern = /import\s+([^;]*?)from\s*"@classmate\/contracts"/g;
    let seen = 0;
    for (const file of productFiles) {
      const source = readFileSync(file, "utf8");
      let matched: RegExpExecArray | null = importPattern.exec(source);
      while (matched !== null) {
        seen += 1;
        expect(`${file}: ${(matched[1] ?? "").trimStart().startsWith("type")}`).toBe(`${file}: true`);
        matched = importPattern.exec(source);
      }
      importPattern.lastIndex = 0;
    }
    expect(seen).toBeGreaterThan(0);
  });
});
