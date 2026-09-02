// 화면 문구 결정(docs/DECISIONS.md "디자인 정본 적용 기본값")이 코드에 반영됐는지 봅니다.
//
// 기대값은 형제 시험 파일이 아니라 **정본 파일**에서 뽑고, 확인은 **제품 코드를 실제로 그린 결과**에
// 대고 합니다. 시험이 시험을 근거로 삼으면(순환) 결정이 바뀌어도 계속 통과하기 때문입니다.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { MarginNote, MomentRow, SourceFooter } from "../src/index";
import { canonRoot, pkgRoot, sidePanelDcHtml, srcRoot } from "./paths";
import { cleanupAll, render } from "./render";

afterEach(cleanupAll);

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

/** 정본 카드. 함정 7·8 에서 우리가 따르기로 한 쪽입니다. */
const CARD = read(join(canonRoot, "classmate/classmate.card.html"));
/** 사이드패널 dc.html. 같은 자리에 오타와 합니다체가 남아 있는, 따르지 않기로 한 쪽입니다. */
const DC = read(sidePanelDcHtml);

/** `title:'…'` 중 "멈" 이 든 문구만 뽑습니다. */
function pausedTitles(text: string): string[] {
  return [...text.matchAll(/title:\s*'([^']*멈[^']*)'/g)].map((m) => m[1] ?? "");
}
/** `'new 자체가 …'` 로 시작하는 결론 한 문장을 뽑습니다. */
function newConclusion(text: string): string {
  const m = /'(new 자체가[^']*)'/.exec(text);
  expect(m, "정본에서 new 결론 문장을 찾지 못했습니다").not.toBeNull();
  return m![1]!;
}

const CANON_PAUSED = pausedTitles(CARD);
const CANON_NEW = newConclusion(CARD);
const DC_PAUSED = pausedTitles(DC);
const DC_NEW = newConclusion(DC);

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

  it("멈춤 안내는 정본 카드의 멈췄어요 를 그대로 그린다 — dc.html 쪽 글자가 아니다 (함정 7)", () => {
    // (1) 기대값의 출처는 정본 카드입니다. 두 문장(전사 멈춤·튜터 멈춤)이 거기 있어야 합니다.
    expect(CANON_PAUSED).toHaveLength(2);
    for (const title of CANON_PAUSED) expect(title).toContain("멈췄어요");

    // (2) dc.html 은 같은 자리에 다른 글자를 담고 있습니다. 둘이 갈린다는 사실 자체를 못 박습니다.
    expect(DC_PAUSED).toHaveLength(2);
    for (const title of DC_PAUSED) expect(CANON_PAUSED).not.toContain(title);

    // (3) 제품 코드를 실제로 그려, 정본 문장이 손상 없이 화면에 나오는지 봅니다.
    const [tiro, ai] = CANON_PAUSED as [string, string];
    const paused = render(
      <SourceFooter count={1} warn={{ title: tiro, description: "화면과 코드는 계속 기록하고 있어요.", action: "다시 연결" }} />,
    );
    expect(paused.get(".cm-sf__w b").textContent).toBe(tiro);
    expect(paused.text()).toContain("멈췄어요");
    for (const wrong of DC_PAUSED) expect(paused.text()).not.toContain(wrong);

    const off = render(<SourceFooter warn={{ tone: "off", title: ai }} />);
    expect(off.get(".cm-sf__w b").textContent).toBe(ai);
    expect(off.text()).toContain("멈췄어요");
    for (const wrong of DC_PAUSED) expect(off.text()).not.toContain(wrong);
  });

  it("new 결론 문장은 정본 카드의 해요체다 — dc.html 의 합니다체를 쓰지 않는다 (함정 8)", () => {
    // (1) 정본 카드는 해요체, dc.html 은 합니다체입니다.
    expect(CANON_NEW).toContain("분리해요.");
    expect(CANON_NEW).not.toContain("분리합니다");
    expect(DC_NEW).toContain("분리합니다");
    expect(DC_NEW).not.toBe(CANON_NEW);

    // (2) 그 문장을 실제로 그려, 화면에 해요체 그대로 나오는지 봅니다.
    const note = render(<MarginNote term="new" time="10:32:18" state="ready" conclusion={CANON_NEW} />);
    expect(note.get("p.cm-note__c").textContent).toBe(CANON_NEW);
    expect(note.text()).toContain("분리해요.");
    expect(note.text()).not.toContain("분리합니다");
    expect(note.text()).not.toContain("틀린 것은 아니지만");

    const moment = render(<MomentRow time="10:32:18" term="new" title={CANON_NEW} />);
    expect(moment.get(".cm-mo__title").textContent).toBe(CANON_NEW);
    expect(moment.text()).not.toContain("분리합니다");
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
