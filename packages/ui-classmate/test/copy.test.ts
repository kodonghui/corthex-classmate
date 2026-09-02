// 화면 문구 결정(docs/DECISIONS.md "디자인 정본 적용 기본값")이 코드에 반영됐는지 봅니다.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { pkgRoot, srcRoot } from "./paths";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = [...walk(srcRoot), ...walk(join(pkgRoot, "test"))];
const read = (f: string): string => readFileSync(f, "utf8");
const rel = (f: string): string => relative(pkgRoot, f).split("\\").join("/");

describe("문구 결정", () => {
  it("dc.html 의 오타(design-map §7 함정 7)는 이 패키지 어디에도 없다", () => {
    for (const f of files) {
      // 시험이 "이 오타가 없어야 한다"고 적어 둔 줄만 빼고 봅니다.
      const lines = read(f)
        .split("\n")
        .filter((l) => !l.includes("not.toContain"));
      expect(lines.join("\n"), rel(f)).not.toContain("멈췼어요");
    }
  });

  it("멈춤 안내는 멈췄어요 로 적는다", () => {
    const test = read(join(pkgRoot, "test/components.test.tsx"));
    expect(test).toContain("전사가 잠시 멈췄어요.");
    expect(test).toContain("튜터 답변이 잠시 멈췄어요.");
  });

  it("new 결론 문장은 해요체다 — dc.html 의 합니다체를 쓰지 않는다 (함정 8)", () => {
    const test = read(join(pkgRoot, "test/components.test.tsx"));
    const line = test.split("\n").find((l) => l.includes("new 자체가 틀린"));
    expect(line, "new 결론 문장이 시험에 있어야 합니다").toBeDefined();
    expect(line!).toContain("분리해요.");
    expect(line!).not.toContain("분리합니다");
    expect(line!).not.toContain("틀린 것은 아니지만");
  });

  it("컴포넌트 기본 문구가 정본 그대로다", () => {
    const marginNote = read(join(srcRoot, "components/MarginNote.tsx"));
    expect(marginNote).toContain("한 줄로 정리하고 있어요");
    expect(marginNote).toContain("붙잡았어요");
    expect(marginNote).toContain('detailLabel = "자세히 보기"');

    const stuck = read(join(srcRoot, "components/StuckButton.tsx"));
    expect(stuck).toContain("지금 막혔어요");
    expect(stuck).toContain("최근 30초 전사 · Meet 화면 · IntelliJ 코드를 함께 저장해요");

    const guess = read(join(srcRoot, "components/GuessList.tsx"));
    expect(guess).toContain("혹시 이게 막혔나요?");

    const answer = read(join(srcRoot, "components/AnswerCard.tsx"));
    expect(answer).toContain("더 알고 싶다면");
    expect(answer).toContain("설명을 준비하고 있어요");

    const status = read(join(srcRoot, "components/SourceStatus.tsx"));
    expect(status).toContain("기록 중");
    expect(status).toContain("연결 안 됨");
  });

  it("이모지와 금지 기호를 쓰지 않는다 — 허용은 · ▸ ▾ 뿐", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const f of walk(srcRoot)) {
      expect(emoji.test(read(f)), rel(f)).toBe(false);
    }
  });
});
