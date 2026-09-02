// 기록 화면의 값 — 붙잡은 순간과 **도착한** 답만으로 만들어지는지 봅니다.

import { describe, expect, it } from "vitest";

import { GOLDEN_BUNDLE } from "./golden-bundle";
import { historyView } from "./history-view";
import { ReplayStore } from "./replay-store";

function viewAt(checkpoint: Parameters<ReplayStore["goto"]>[0]) {
  const store = new ReplayStore(GOLDEN_BUNDLE);
  store.goto(checkpoint);
  return historyView(GOLDEN_BUNDLE, store.getState());
}

describe("기록 화면 값", () => {
  it("아직 아무것도 붙잡지 않았으면 오늘 0개이고 교시 묶음만 남는다", () => {
    const view = viewAt("listening");
    expect(view.subtitle).toBe("오늘 0개");
    expect(view.count).toBe(0);
    expect(view.groups).toHaveLength(1);
    expect(view.groups[0]?.period).toBe("3교시");
    expect(view.groups[0]?.rows).toHaveLength(0);
    expect(view.emptyText).toBe("아직 붙잡은 순간이 없어요");
  });

  it("붙잡은 직후에는 답이 없어 정리 중으로 남는다", () => {
    const view = viewAt("caught");
    const row = view.groups[0]?.rows[0];
    expect(view.subtitle).toBe("오늘 1개");
    expect(row?.term).toBe("new");
    expect(row?.time).toBe("10:32:18");
    expect(row?.title).toBeNull();
    expect(row?.state).toBe("preparing");
  });

  it("답이 오면 한 줄 결론이 줄 제목이 된다", () => {
    const view = viewAt("answer");
    const row = view.groups[0]?.rows[0];
    expect(row?.state).toBe("ready");
    expect(row?.title).toBe("new 자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요");
    expect(row?.questionId).toBe("q-p3-001");
  });

  it("새로 붙잡은 순간이 맨 위에 온다", () => {
    const view = viewAt("recovered");
    const rows = view.groups[0]?.rows ?? [];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.term).toBe("생성자");
    expect(rows[1]?.term).toBe("new");
    // answer.recovered 로 되살아난 답이 붙습니다(queued 판이 아닙니다).
    expect(rows[0]?.title).toBe("생성자로 받으면 바깥에서 구현을 갈아 끼울 수 있어요");
  });

  it("대기(queued) 중인 답은 아직 답으로 세지 않는다", () => {
    const view = viewAt("waiting");
    const rows = view.groups[0]?.rows ?? [];
    expect(rows[0]?.term).toBe("생성자");
    expect(rows[0]?.state).toBe("preparing");
    expect(rows[0]?.title).toBeNull();
  });

  it("바닥줄은 나이 대신 기록 중만 보여 준다", () => {
    const view = viewAt("answer");
    expect(view.sources.map((source) => source.ago)).toEqual(["기록 중", "기록 중", "기록 중"]);
    expect(view.footNote).toBe("붙잡은 순간은 수업이 끝나도 남아요. 지우기는 설정에서.");
  });
});
