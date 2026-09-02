// 제품 코드가 지켜야 할 두 가지를 기계로 확인합니다.
//   1. `src/**` 에 브라우저 API 가 하나도 없다(순수 TS · 시계와 예약은 주입).
//   2. `src/**` 에서 계약은 `import type` 으로만 들여온다(값 import 는 MV3 CSP 에 막힙니다).
//
// 2번은 "계약 이름이 나온 자리가 어느 문장에 속하는지" 를 보고 판정합니다. 예전처럼 파일 전체를
// 거꾸로 훑으면 앞줄의 `import type` 이나 주석 속 "import type" 글자가 뒤에 오는 값 재수출을
// 덮어 주어 위반을 놓쳤습니다. 그래서 (가) 주석을 먼저 지우고 (나) 그 자리 앞의 가장 가까운
// `import`/`export` 를 문장 머리로 삼습니다.

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

// ─────────────────────────────────────────────────────────────────────────────
// 계약을 값으로 들여왔는지 보는 검사기
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 주석만 같은 길이의 공백으로 지웁니다. 자리(offset)는 그대로 남습니다.
 *
 * 문자열 안의 `//` 는 주석이 아니므로 문자열은 건너뜁니다. 정규식 리터럴까지 가리지는
 * 않지만 `src/**` 에는 정규식 리터럴이 없습니다(있으면 이 시험이 먼저 이상해집니다).
 */
function blankComments(text: string): string {
  // split("") 은 UTF-16 코드 단위로 자릅니다. text[i] 와 자리가 정확히 맞아야 합니다.
  const out = text.split("");
  type Mode = "code" | "line" | "block" | '"' | "'" | "`";
  let mode: Mode = "code";
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    const d = text[i + 1];

    if (mode === "code") {
      if (c === "/" && d === "*") {
        out[i] = " ";
        out[i + 1] = " ";
        mode = "block";
        i += 2;
        continue;
      }
      if (c === "/" && d === "/") {
        out[i] = " ";
        out[i + 1] = " ";
        mode = "line";
        i += 2;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") mode = c;
      i += 1;
      continue;
    }

    if (mode === "block") {
      if (c === "*" && d === "/") {
        out[i] = " ";
        out[i + 1] = " ";
        mode = "code";
        i += 2;
        continue;
      }
      if (c !== "\n") out[i] = " ";
      i += 1;
      continue;
    }

    if (mode === "line") {
      if (c === "\n") {
        mode = "code";
        i += 1;
        continue;
      }
      out[i] = " ";
      i += 1;
      continue;
    }

    // 문자열 안입니다. 닫는 따옴표를 만날 때까지 그대로 둡니다.
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === mode) mode = "code";
    i += 1;
  }

  return out.join("");
}

/** 계약 묶음 이름이 적힌 자리입니다(따옴표 두 가지 모두). */
const CONTRACT_MODULE = /["']@classmate\/contracts["']/g;
/** 문장 머리 후보입니다. */
const STATEMENT_HEAD = /\b(?:import|export)\b/g;
/** 타입만 들여오는 머리입니다. 값 재수출(`export { X } from`)은 여기 걸리지 않습니다. */
const TYPE_ONLY_HEAD = /^(?:import|export)\s+type\b/;

/**
 * 그 소스가 계약을 **값으로** 들여온 자리를 모읍니다. 비어 있으면 규칙을 지킨 것입니다.
 *
 *     contractValueImports('import type { Id } from "@classmate/contracts";', "a.ts")  // → []
 *     contractValueImports('export { TUTOR_STATES } from "@classmate/contracts";', "a.ts")
 *     // → ['a.ts: 값 import 로 계약을 들여왔습니다 — export { TUTOR_STATES } from']
 */
export function contractValueImports(text: string, label: string): string[] {
  const code = blankComments(text);
  const heads = [...code.matchAll(STATEMENT_HEAD)].map((match) => match.index);
  const hits: string[] = [];

  for (const found of code.matchAll(CONTRACT_MODULE)) {
    const at = found.index;
    // 이 자리 앞의 가장 가까운 import/export 가 이 문장의 머리입니다.
    let head = -1;
    for (const candidate of heads) {
      if (candidate >= at) break;
      head = candidate;
    }
    const statement = head === -1 ? "" : code.slice(head, at).trim();
    if (!TYPE_ONLY_HEAD.test(statement)) {
      hits.push(`${label}: 값 import 로 계약을 들여왔습니다 — ${statement || "(문장 머리 없음)"}`);
    }
  }
  return hits;
}

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
    const hits: string[] = [];
    for (const file of SOURCES) {
      hits.push(...contractValueImports(readFileSync(file, "utf8"), file));
    }
    expect(hits).toEqual([]);
  });
});

// 검사기 자체가 제 몫을 하는지 가짜 소스로 확인합니다. 여기가 통과해야 위의 전수 검사가 의미 있습니다.
describe("계약 값 import 검사기", () => {
  it("타입만 들여오면 통과한다", () => {
    const source = [
      'import type { Id, TutorState } from "@classmate/contracts";',
      'import { formatIso } from "./time";',
      "",
      "export const X: TutorState = \"CAPTURE\";",
    ].join("\n");
    expect(contractValueImports(source, "ok.ts")).toEqual([]);
  });

  it("값 재수출(export { X } from)은 위반으로 잡는다", () => {
    // 앞줄에 `import type` 이 있어도 뒤의 값 재수출을 덮어 주면 안 됩니다(예전 버그).
    const source = [
      'import type { TutorState } from "@classmate/contracts";',
      "",
      'export { TUTOR_STATES } from "@classmate/contracts";',
    ].join("\n");
    const hits = contractValueImports(source, "bad.ts");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("export { TUTOR_STATES } from");
  });

  it("타입만 재수출(export type { … } from)은 통과한다", () => {
    const source = [
      'import type { Id } from "@classmate/contracts";',
      'export type { TutorState } from "@classmate/contracts";',
    ].join("\n");
    expect(contractValueImports(source, "ok-reexport.ts")).toEqual([]);
  });

  it('블록 주석 속 "import type" 뒤의 값 재수출도 위반으로 잡는다', () => {
    // 실제 src/machine.ts 의 모양입니다. 예전 검사기는 주석 안의 마지막 "import" 를 문장
    // 머리로 착각해 slice 가 "import type" 으로 시작한다며 이 파일을 통과시켰습니다.
    const source = [
      "/**",
      " * 제품 코드에서는 계약을 `import type` 으로만 들여올 수 있습니다.",
      " */",
      'export const NAMES = ["period.started"];',
      "",
      'export { TUTOR_STATES } from "@classmate/contracts";',
    ].join("\n");
    const hits = contractValueImports(source, "comment.ts");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("export { TUTOR_STATES } from");
  });

  it('줄 주석 속 "import type" 도 문장 머리로 세지 않는다', () => {
    const source = [
      "// import type 만 쓰기로 했습니다.",
      'export { SESSION_EVENT_TYPES } from "@classmate/contracts";',
    ].join("\n");
    expect(contractValueImports(source, "line-comment.ts")).toHaveLength(1);
  });

  it("문장 안에 낀 주석에도 속지 않는다", () => {
    const source = [
      "export {",
      "  // import type 만 씁니다",
      "  TUTOR_STATES,",
      '} from "@classmate/contracts";',
    ].join("\n");
    expect(contractValueImports(source, "inline-comment.ts")).toHaveLength(1);
  });

  it("주석 안에만 적힌 계약 이름은 세지 않는다", () => {
    // 주석은 통째로 지우므로 그 안의 계약 이름은 검사 대상이 아닙니다(설명용 예시 코드 등).
    const source = [
      '// 값 import 예: import { X } from "@classmate/contracts";',
      "export const A = 1;",
    ].join("\n");
    expect(contractValueImports(source, "only-comment.ts")).toEqual([]);
  });

  it("한 파일에 여러 자리가 있으면 위반만 골라 센다", () => {
    const source = [
      'import type { Id } from "@classmate/contracts";',
      'export type { Answer } from "@classmate/contracts";',
      'import { createValidator } from "@classmate/contracts";',
      'export { TUTOR_STATES } from "@classmate/contracts";',
    ].join("\n");
    expect(contractValueImports(source, "mixed.ts")).toHaveLength(2);
  });
});
