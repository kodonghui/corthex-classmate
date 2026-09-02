// 시험들이 함께 쓰는 도구입니다. 이 파일 자체는 시험이 아닙니다(*.test.ts 만 돕니다).

import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PeriodBundle } from "../src/types.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** 저장소 뿌리입니다. packages/report-ui/test 에서 세 칸 올라갑니다. */
export const REPO_ROOT = path.resolve(HERE, "../../..");

/** 골든 교시 세션 번들 폴더입니다. 읽기만 합니다. */
export const GOLDEN_BUNDLE_DIR = path.join(REPO_ROOT, "fixtures/synthetic-class/golden-ioc");

/** 제품 코드 폴더입니다. 소스 검사에 씁니다. */
export const SRC_DIR = path.join(HERE, "../src");
export const SCRIPTS_DIR = path.join(HERE, "../scripts");

/** 닫을 필요가 없는 HTML 태그입니다. */
const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * <body> 안의 태그가 짝이 맞는지 훑습니다. 문제가 없으면 빈 배열입니다.
 * 완전한 HTML 파서가 아니라, 템플릿이 태그를 흘리지 않았는지 보는 가벼운 검사입니다.
 */
export function findUnbalancedTags(html: string): string[] {
  const problems: string[] = [];
  const stack: string[] = [];
  const openMark = "<body>";
  const start = html.indexOf(openMark);
  const end = html.lastIndexOf("</body>");
  const region = start === -1 || end === -1 ? html : html.slice(start + openMark.length, end);
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  let matched: RegExpExecArray | null = tagPattern.exec(region);
  while (matched !== null) {
    const closing = matched[1] === "/";
    const name = (matched[2] ?? "").toLowerCase();
    const selfClosing = matched[3] === "/";
    if (closing) {
      const top = stack.pop();
      if (top !== name) {
        problems.push(`닫는 태그가 어긋났어요: </${name}> · 열려 있던 것은 ${top ?? "없음"}`);
      }
    } else if (!VOID_TAGS.has(name) && !selfClosing) {
      stack.push(name);
    }
    matched = tagPattern.exec(region);
  }
  if (stack.length > 0) {
    problems.push(`닫히지 않은 태그: ${stack.join(", ")}`);
  }
  return problems;
}

/** 토큰 CSS 를 읽지 않고도 렌더를 돌리기 위한 아주 작은 대역 CSS 입니다. */
export const STUB_TOKEN_CSS = ":root{ --space-1: 2px; }";

/** 시험에서 마음대로 흔들어 볼 수 있는 합성 번들입니다. */
export function makeSyntheticBundle(overrides: Partial<PeriodBundle> = {}): PeriodBundle {
  const base: PeriodBundle = {
    dir: path.join(REPO_ROOT, "does-not-exist"),
    periodId: "2026-09-02-p1",
    index: 1,
    dayId: "2026-09-02",
    subject: "합성 교시",
    startedAt: "2026-09-02T09:00:00+09:00",
    endedAt: "2026-09-02T09:50:00+09:00",
    events: [],
    transcript: [],
    frames: [],
    editorContexts: [],
    questions: [],
    answers: [],
    warnings: [],
  };
  return { ...base, ...overrides };
}
