// 소스 위생 시험입니다.
//
// 1) 런타임 CSS 주입이 남지 않았는지 — 정본의 css() 는 빌드타임 CSS 로 바뀌었습니다.
// 2) CDN·외부 주소가 남지 않았는지 — 정본 Icon.jsx 의 unpkg 는 lucide-react 로 바뀌었습니다.
// 3) 1라운드 공유 규칙 — 다른 @classmate/* 패키지를 import 하지 않습니다.
// 4) dangerouslySetInnerHTML 로 모델 HTML 을 꽂지 않습니다.
// 5) 색은 토큰 var(--…) 으로만 — hex 뿐 아니라 rgb()·hsl()·색 이름도 막습니다.
// 6) 한 줄 주석은 한국어로 — 정본에서 옮겨 온 영어 문장 주석이 남지 않게 합니다.

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

/**
 * 색 검사 전에 색이 아닌 자리를 지웁니다.
 *  - CSS 블록 주석
 *  - var(--토큰) 안의 이름 (`var(--white)` · `var(--red-100)` 은 색 리터럴이 아닙니다)
 * 남은 글에서만 rgb()·hsl()·색 이름을 찾습니다.
 */
function colorText(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/var\(\s*--[^)]*\)/g, " ");
}

/** 색 함수입니다. 토큰 대신 값을 직접 적은 자리를 잡습니다. */
const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color)\(/i;

/**
 * 대표 CSS 색 이름 24개입니다. 앞뒤에 글자·하이픈이 붙으면 세지 않습니다
 * (`white-space` 같은 속성 이름과 `--red-100` 같은 토큰 이름을 피합니다).
 * transparent · inherit · currentColor 는 색 리터럴이 아니라 허용합니다(목록에 넣지 않습니다).
 */
const COLOR_NAME =
  /(?<![\w-])(?:white|black|red|green|blue|yellow|orange|purple|pink|brown|gray|grey|silver|gold|navy|teal|olive|maroon|lime|aqua|cyan|magenta|violet|indigo)(?![\w-])/i;

/**
 * 한 줄 주석에서 코드처럼 생긴 조각을 지웁니다.
 * 백틱·따옴표 인용, 주소, kebab·snake·경로·점 표기 식별자는 낱말로 세지 않습니다.
 */
function commentProse(comment: string): string {
  return comment
    .replace(/`[^`]*`/g, " ")
    .replace(/"[^"]*"|'[^']*'/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[A-Za-z@][A-Za-z0-9]*(?:[-_./][A-Za-z0-9]+)+/g, " ");
}

/** 빈칸으로만 이어진 영어 낱말 4개 이상이면 영어 문장으로 봅니다. */
const ENGLISH_SENTENCE = /[A-Za-z]{2,}(?:[ \t]+[A-Za-z]{2,}){3,}/;

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
    // hex 만 보면 rgb()·hsl()·white 같은 값이 그냥 통과하므로 셋 다 봅니다.
    const cssFiles = files.filter((f) => f.endsWith(".css") && !f.endsWith("styles.css"));
    const rel = (f: string): string => f.slice(packageDir.length + 1).replace(/\\/g, "/");

    const withHex = cssFiles.filter((f) => /#[0-9a-fA-F]{3,8}\b/.test(read(f))).map(rel);
    expect(withHex).toEqual([]);

    const withFunc = cssFiles.filter((f) => COLOR_FUNCTION.test(colorText(read(f)))).map(rel);
    expect(withFunc, "색은 rgb()·hsl() 대신 var(--토큰) 으로 적습니다").toEqual([]);

    const withName = cssFiles.filter((f) => COLOR_NAME.test(colorText(read(f)))).map(rel);
    expect(withName, "색 이름(white·black·red …) 대신 var(--토큰) 으로 적습니다").toEqual([]);
  });

  it("색 검사가 실제로 rgb()·hsl()·색 이름을 잡는다", () => {
    // 검사 자체가 헛도는지 봅니다. 아래 나쁜 예는 전부 걸려야 하고, 허용 목록은 통과해야 합니다.
    for (const bad of [".a{color:rgba(255,255,255,.14)}", ".a{color:rgb(0 0 0)}", ".a{background:hsl(0 0% 0%)}"]) {
      expect(COLOR_FUNCTION.test(colorText(bad)), bad).toBe(true);
    }
    expect(COLOR_NAME.test(colorText(".a{color:white}"))).toBe(true);
    expect(COLOR_NAME.test(colorText(".a{border:1px solid black}"))).toBe(true);
    // 허용 목록과 헷갈리기 쉬운 자리들입니다. 여기서 걸리면 안 됩니다.
    for (const ok of [
      ".a{white-space:nowrap}", // 속성 이름 안의 white
      ".a{background:var(--white)}", // 토큰 이름 안의 white
      ".a{box-shadow:0 0 0 3px var(--red-100)}", // 토큰 이름 안의 red
      ".a{border-color:transparent;color:inherit;fill:currentColor}", // 색이 아닌 키워드
      ".a{-webkit-tap-highlight-color:transparent}",
    ]) {
      expect(COLOR_FUNCTION.test(colorText(ok)), ok).toBe(false);
      expect(COLOR_NAME.test(colorText(ok)), ok).toBe(false);
    }
  });

  it("src 의 한 줄 주석을 한국어로 적는다", () => {
    // 정본 jsx 에서 그대로 옮겨 온 영어 문장 주석이 남지 않게 합니다.
    // props 의 /** … */ 는 정본 .d.ts 계약 원문이라 이 검사에서 뺍니다(한 줄 // 주석만 봅니다).
    const offenders: string[] = [];
    for (const file of files.filter((f) => /\.tsx?$/.test(f))) {
      read(file)
        .split(/\r?\n/)
        .forEach((line, index) => {
          const comment = line.match(/(?:^|[^:\\])\/\/(.*)$/);
          if (comment === null) return;
          if (!ENGLISH_SENTENCE.test(commentProse(comment[1] ?? ""))) return;
          offenders.push(`${file.slice(packageDir.length + 1).replace(/\\/g, "/")}:${index + 1}`);
        });
    }
    expect(offenders, "영어 문장 주석은 한국어 존댓말로 바꿉니다").toEqual([]);
  });

  it("주석 검사가 실제로 영어 문장을 잡는다", () => {
    const english = "Labels every claim with how the tutor knows it: 확인됨 · 일부 확인";
    expect(ENGLISH_SENTENCE.test(commentProse(english))).toBe(true);
    expect(ENGLISH_SENTENCE.test(commentProse(" Tiny Java tokenizer — enough to color keywords, types."))).toBe(true);
    // 아래는 한국어 주석이라 걸리면 안 됩니다(식별자·경로·백틱 인용은 낱말로 세지 않습니다).
    for (const ok of [
      " 정본: design-system/components/core/Button.jsx (스타일은 같은 폴더 Button.css)",
      " eslint-disable-next-line no-console -- 개발 중에만 나오는 안내입니다.",
      " core·forms·feedback·surfaces·navigation·overlay 22개 파일을 TS React 로 옮긴 것입니다.",
      " `import { icons } from \"lucide-react\"` 같은 전체 조회는 쓰지 않습니다.",
      " core",
    ]) {
      expect(ENGLISH_SENTENCE.test(commentProse(ok)), ok).toBe(false);
    }
  });
});
