// src/css/ 의 토큰 CSS 를 읽어 src/tokens.ts 를 만듭니다.
//
// 손으로 고치지 마세요. CSS 를 고친 뒤 `pnpm --filter @classmate/design-tokens generate` 를 다시 돌립니다.
// `--stdout` 를 주면 파일을 쓰지 않고 만들 내용을 표준출력으로만 냅니다(생성물 최신성 시험이 씁니다).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(scriptDir, "..");
const cssDir = join(packageDir, "src", "css");
const outFile = join(packageDir, "src", "tokens.ts");

/** 변수를 담고 있는 CSS 파일. fonts.css·styles.css 는 @import 뿐이라 뺍니다. */
const VARIABLE_FILES = [
  "base.css",
  "colors.css",
  "elevation.css",
  "motion.css",
  "spacing.css",
  "typography.css",
];

/** 줄임 없이 다시 선언되는 자리를 가르는 미디어 쿼리. */
const REDUCED_MOTION_QUERY = "prefers-reduced-motion";

/** `/* ... *\/` 주석을 지웁니다. 값 안에 주석 기호가 없는 CSS 라서 단순 치환으로 충분합니다. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * 중괄호와 괄호 깊이를 따라가며 사용자 지정 속성(`--이름: 값;`) 선언만 모읍니다.
 * 각 선언에는 그때의 선택자 스택(예: `["@media (...)", ":root"]`)을 함께 답니다.
 */
function parseDeclarations(css) {
  const declarations = [];
  const selectorStack = [];
  let buffer = "";
  let parenDepth = 0;

  const flush = () => {
    const text = buffer.trim();
    buffer = "";
    if (!text.startsWith("--")) return;
    const colon = text.indexOf(":");
    if (colon < 0) return;
    declarations.push({
      name: text.slice(2, colon).trim(),
      value: text.slice(colon + 1).trim(),
      scope: [...selectorStack],
    });
  };

  for (const ch of stripComments(css)) {
    if (ch === "(") parenDepth += 1;
    else if (ch === ")") parenDepth -= 1;

    if (parenDepth === 0 && ch === "{") {
      selectorStack.push(buffer.trim());
      buffer = "";
      continue;
    }
    if (parenDepth === 0 && ch === "}") {
      flush();
      selectorStack.pop();
      continue;
    }
    if (parenDepth === 0 && ch === ";") {
      flush();
      continue;
    }
    buffer += ch;
  }
  return declarations;
}

/** src/css/ 를 읽어 { tokens, overrides, names } 로 정리합니다. */
export function collectTokens(dir = cssDir) {
  /** @type {Array<{ file: string, name: string, value: string }>} */
  const rootDeclarations = [];
  /** @type {Map<string, string>} */
  const overrides = new Map();
  const seen = new Set();

  for (const file of VARIABLE_FILES) {
    const css = readFileSync(join(dir, file), "utf8");
    for (const { name, value, scope } of parseDeclarations(css)) {
      const selector = scope[scope.length - 1];
      if (selector !== ":root") continue;
      const inReducedMotion = scope.some((s) => s.includes(REDUCED_MOTION_QUERY));
      if (inReducedMotion) {
        if (!overrides.has(name)) overrides.set(name, value);
        continue;
      }
      if (seen.has(name)) continue; // 첫 선언만 씁니다.
      seen.add(name);
      rootDeclarations.push({ file, name, value });
    }
  }

  return {
    declarations: rootDeclarations,
    overrides: [...overrides.entries()].map(([name, value]) => ({ name, value })),
    names: [...seen].sort(),
  };
}

/** src/tokens.ts 의 내용을 문자열로 만듭니다. 줄 끝은 항상 LF 입니다. */
export function renderTokensModule(collected = collectTokens()) {
  const lines = [];
  lines.push("// 이 파일은 scripts/generate-tokens.mjs 가 src/css/*.css 에서 만듭니다. 손으로 고치지 마세요.");
  lines.push("// 다시 만들기: pnpm --filter @classmate/design-tokens generate");
  lines.push("");
  lines.push("/** CSS 사용자 지정 속성의 값. 키는 앞의 `--` 를 뗀 이름입니다. */");
  lines.push("export const tokens = {");

  let currentFile = "";
  for (const { file, name, value } of collected.declarations) {
    if (file !== currentFile) {
      if (currentFile !== "") lines.push("");
      lines.push(`  // ${file}`);
      currentFile = file;
    }
    lines.push(`  ${JSON.stringify(name)}: ${JSON.stringify(value)},`);
  }
  lines.push("} as const;");
  lines.push("");
  lines.push("/** 정렬한 고유 변수 이름 목록. test/token-names.snapshot.txt 와 같아야 합니다. */");
  lines.push("export const TOKEN_NAMES = [");
  for (const name of collected.names) lines.push(`  ${JSON.stringify(name)},`);
  lines.push("] as const;");
  lines.push("");
  lines.push("/** 토큰 이름 하나. */");
  lines.push("export type TokenName = (typeof TOKEN_NAMES)[number];");
  lines.push("");
  lines.push("/**");
  lines.push(" * `@media (prefers-reduced-motion: reduce)` 안에서 다시 선언되는 값입니다.");
  lines.push(" * 평소 값이 아니므로 `tokens` 에 섞지 않고 따로 둡니다.");
  lines.push(" */");
  lines.push("export const REDUCED_MOTION_OVERRIDES = {");
  for (const { name, value } of collected.overrides) {
    lines.push(`  ${JSON.stringify(name)}: ${JSON.stringify(value)},`);
  }
  lines.push("} as const;");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const content = renderTokensModule();
  if (process.argv.includes("--stdout")) {
    process.stdout.write(content);
    return;
  }
  writeFileSync(outFile, content, "utf8");
  process.stdout.write(`${outFile} 를 다시 만들었습니다.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
