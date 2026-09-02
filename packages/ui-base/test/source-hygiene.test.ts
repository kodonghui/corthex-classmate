// 소스 위생 시험입니다.
//
// 1) 런타임 CSS 주입이 남지 않았는지 — 정본의 css() 는 빌드타임 CSS 로 바뀌었습니다.
// 2) CDN·외부 주소가 남지 않았는지 — 정본 Icon.jsx 의 unpkg 는 lucide-react 로 바뀌었습니다.
// 3) 1라운드 공유 규칙 — 다른 @classmate/* 패키지를 import 하지 않습니다.
// 4) dangerouslySetInnerHTML 로 모델 HTML 을 꽂지 않습니다.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(testDir, "..");
const srcDir = join(packageDir, "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(srcDir);
const read = (file: string): string => readFileSync(file, "utf8");

/** 주석은 "무엇이 바뀌었는지"를 적어 둔 자리라 검사에서 뺍니다. 실제 코드만 봅니다. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

const hits = (pattern: RegExp): string[] =>
  files
    .filter((f) => pattern.test(stripComments(read(f))))
    .map((f) => f.slice(packageDir.length + 1).replace(/\\/g, "/"));

describe("소스 위생", () => {
  it("src/ 에 컴포넌트 22개와 CSS 21개가 있다", () => {
    expect(files.filter((f) => f.endsWith(".tsx")).length).toBe(22);
    expect(files.filter((f) => f.endsWith(".css") && !f.endsWith("styles.css")).length).toBe(21);
  });

  it("런타임 <style> 주입이 남아 있지 않다", () => {
    expect(hits(/document\.head/)).toEqual([]);
    expect(hits(/createElement\(\s*['"]style['"]/)).toEqual([]);
    expect(hits(/\bcss\(\s*['"]cm-/)).toEqual([]);
  });

  it("외부 주소를 싣지 않는다", () => {
    expect(hits(/unpkg/)).toEqual([]);
    expect(hits(/https?:\/\//)).toEqual([]);
    expect(hits(/tiro\.ooo/i)).toEqual([]);
  });

  it("다른 @classmate 패키지를 import 하지 않는다", () => {
    // 주석에 이름이 나오는 것은 괜찮습니다. 실제 import 문만 봅니다.
    const importing = files
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => /(?:from|import)\s+["']@classmate\//.test(stripComments(read(f))))
      .map((f) => f.slice(packageDir.length + 1).replace(/\\/g, "/"));
    expect(importing).toEqual([]);
  });

  it("dangerouslySetInnerHTML 를 쓰지 않는다", () => {
    expect(hits(/dangerouslySetInnerHTML/)).toEqual([]);
  });

  it("색 값을 직접 적지 않고 토큰 변수만 쓴다", () => {
    // CSS 안의 색은 전부 var(--…) 입니다. 정본과 같은 규칙입니다.
    const cssFiles = files.filter((f) => f.endsWith(".css") && !f.endsWith("styles.css"));
    const withHex = cssFiles.filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(read(f)));
    expect(withHex).toEqual([]);
  });
});
