// 제품 코드가 지켜야 할 두 가지를 기계로 확인합니다.
//   1. `src/**` 에 브라우저 API 가 하나도 없다(순수 TS · 시계와 예약은 주입).
//   2. `src/**` 에서 계약은 `import type` 으로만 들여온다(값 import 는 MV3 CSP 에 막힙니다).

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL("../src/", import.meta.url));

function listSources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...listSources(full));
    } else if (entry.name.endsWith(".ts")) {
      found.push(full);
    }
  }
  return found.sort();
}

const SOURCES = listSources(SRC_DIR);

/** 여기 걸리면 브라우저 API 를 직접 부른 것입니다. 시계·예약은 인터페이스로 받아야 합니다. */
const BANNED: readonly { name: string; pattern: RegExp }[] = [
  { name: "전역 창 객체", pattern: /\bwindow\b/ },
  { name: "전역 문서 객체", pattern: /\bdocument\b/ },
  { name: "확장 API", pattern: /\bchrome\s*\./ },
  { name: "브라우저 예약 함수", pattern: /\bset(Timeout|Interval)\b/ },
  { name: "프레임 예약 함수", pattern: /\brequestAnimationFrame\b/ },
  { name: "현재 시각 직접 읽기", pattern: /\bDate\s*\.\s*now\b/ },
  { name: "브라우저 저장소", pattern: /\b(localStorage|sessionStorage|indexedDB)\b/ },
  { name: "네트워크 호출", pattern: /\bfetch\s*\(/ },
];

describe("제품 코드 규칙", () => {
  it("src 에 TypeScript 파일이 있다", () => {
    expect(SOURCES.length).toBeGreaterThan(0);
  });

  it("src/** 에 브라우저 API 가 0건이다", () => {
    const hits: string[] = [];
    for (const file of SOURCES) {
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      for (const { name, pattern } of BANNED) {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            hits.push(`${file}:${index + 1} ${name} — ${line.trim()}`);
          }
        });
      }
    }
    expect(hits).toEqual([]);
  });

  it("src/** 은 계약을 import type 으로만 들여온다", () => {
    const marker = '"@classmate/contracts"';
    const hits: string[] = [];
    for (const file of SOURCES) {
      const text = readFileSync(file, "utf8");
      for (let at = text.indexOf(marker); at !== -1; at = text.indexOf(marker, at + 1)) {
        const head = text.lastIndexOf("import", at);
        if (head === -1 || !text.slice(head, at).startsWith("import type")) {
          hits.push(`${file}: 값 import 로 계약을 들여왔습니다`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
