// 재생기가 골든 시나리오를 상태기계로 다시 그리는지 — 체크포인트 9개와 손짓(낱말 누름·칩·자세히·뒤로)을 봅니다.

import { WAITING_NOTE_LINE } from "@classmate/tutor-core";
import { describe, expect, it } from "vitest";

import { GOLDEN_BUNDLE } from "./golden-bundle";
import { detailView, listeningView, sourceAges } from "./lesson-view";
import { CHECKPOINTS, ReplayStore } from "./replay-store";

const ANSWER_1 = GOLDEN_BUNDLE.answers["ans-p3-001"];
const ANSWER_2 = GOLDEN_BUNDLE.answers["ans-p3-002"];

function fresh(): ReplayStore {
  return new ReplayStore(GOLDEN_BUNDLE);
}

function home(store: ReplayStore) {
  const state = store.getState();
  return listeningView(GOLDEN_BUNDLE, state, store.lines(state.now));
}

function detail(store: ReplayStore) {
  const state = store.getState();
  return detailView(GOLDEN_BUNDLE, state, store.lines(state.now));
}

describe("처음 상태", () => {
  it("첫 사건(period.started)의 시각에서 CAPTURE · 메모 없음으로 시작한다", () => {
    const store = fresh();
    const { machine, now } = store.getState();
    expect(machine.state).toBe("CAPTURE");
    expect(machine.note).toBe("none");
    expect(now).toBe(store.startMs);
    expect(home(store).header).toEqual({ title: "IoC 컨테이너와 의존성 주입", subtitle: "3교시", time: "10:31:35", status: "live" });
    expect(home(store).lines).toHaveLength(0);
    expect(home(store).footer.sources.map((s) => s.ago)).toEqual(["—", "—", "—"]);
  });
});

describe("체크포인트", () => {
  it("이름이 9개이고 순서가 골든 흐름과 같다", () => {
    expect(CHECKPOINTS).toEqual(["listening", "caught", "sentence", "answer", "detail", "returned", "folded", "waiting", "recovered"]);
  });

  it("listening — A 듣는 중: 다섯 줄, 메모 없음, 자료 나이", () => {
    const store = fresh();
    store.goto("listening");
    const view = home(store);
    expect(store.getState().machine.state).toBe("CAPTURE");
    expect(view.note.kind).toBe("none");
    expect(view.lines.map((line) => line.id)).toEqual(["ts-p3-001", "ts-p3-002", "ts-p3-003", "ts-p3-004", "ts-p3-005"]);
    expect(view.header.time).toBe("10:32:16");
    expect(view.footer).toEqual({
      sources: [
        { key: "tiro", state: "live", ago: "2초 전" },
        { key: "meet", state: "live", ago: "0초 전" },
        { key: "intellij", state: "live", ago: "—" },
      ],
      count: 0,
      warn: null,
    });
    expect(view.pinnedNow).toBeNull();
  });

  it("caught — B 붙잡은 직후: ANSWER_MINIMAL · preparing · 봉인된 세 자료", () => {
    const store = fresh();
    store.goto("caught");
    const { machine } = store.getState();
    expect(machine.state).toBe("ANSWER_MINIMAL");
    expect(machine.note).toBe("preparing");
    expect(machine.questionId).toBe("q-p3-001");
    const view = home(store);
    expect(view.note).toMatchObject({ kind: "preparing", lineId: "ts-p3-004", term: "new", time: "10:32:18", warn: false, waitingText: null });
    if (view.note.kind !== "preparing") return;
    expect(view.note.sources.map((s) => s.label)).toEqual(["전사 4초 전", "Meet 2초 전", "OrderService.java 1초 전"]);
    expect(view.active).toBe("ts-p3-004:1");
    expect(view.lines).toHaveLength(4);
    expect(view.footer.count).toBe(1);
  });

  it("sentence — D 문장을 붙잡음: 짐작 2~3개", () => {
    const store = fresh();
    store.goto("sentence");
    const view = home(store);
    expect(view.note).toMatchObject({ kind: "choosing", lineId: "ts-p3-005", time: "10:32:16", value: undefined });
    if (view.note.kind !== "choosing") return;
    expect(view.note.options.map((o) => o.label)).toEqual(["생성 책임이 무슨 뜻인지", "컨테이너에 맡기면 코드가 어떻게 바뀌는지"]);
  });

  it("answer — C 한 줄 답변: 결론 · 근거 확인됨 · 칩 3개 · 17초 뒤 접혀요 · 지금 줄", () => {
    const store = fresh();
    store.goto("answer");
    const { machine } = store.getState();
    expect(machine.note).toBe("minimal");
    expect(machine.answerId).toBe("ans-p3-001");
    const view = home(store);
    expect(view.note).toMatchObject({
      kind: "ready",
      term: "new",
      time: "10:32:18",
      conclusion: ANSWER_1?.conclusion,
      collapseText: "17초 뒤 접혀요 · 기록에 남아요",
    });
    if (view.note.kind !== "ready") return;
    expect(view.note.evidence.map((e) => e.type)).toEqual(["verified", "verified", "verified"]);
    expect(view.note.chips.map((c) => c.id)).toEqual(["easier", "screen", "why"]);
    expect(view.noteNow).toBe("지금 · 생성자 주입 코드로 넘어갔어요");
    expect(view.pinnedNow).toBe("지금 · 생성자 주입 코드로 넘어갔어요");
  });

  it("detail — F 자세히: 접힘 시계 멈춤 · 절 4종 · 첫 절 펼침", () => {
    const store = fresh();
    store.goto("detail");
    const state = store.getState();
    expect(state.screen).toBe("detail");
    expect(state.machine.note).toBe("detail");
    expect(state.machine.foldDeadline).toBeNull();
    const view = detail(store);
    expect(view).not.toBeNull();
    if (view === null) return;
    expect(view.loading).toBe(false);
    expect(view.term).toBe("new");
    expect(view.time).toBe("10:32:18");
    expect(view.line?.id).toBe("ts-p3-004");
    expect(view.sections.map((s) => s.id)).toEqual(["why", "cmp", "code", "said"]);
    expect(view.sections[0]?.defaultOpen).toBe(true);
    expect(view.sections.find((s) => s.id === "code")).toMatchObject({ type: "code", caption: "Meet · OrderService.java", highlightLines: [6, 7, 11] });
    expect(view.nowLine).toBe("지금 · 생성자 주입 코드로 넘어갔어요");
  });

  it("returned — 수업으로 돌아가기: 다시 minimal 이고 18초를 새로 센다", () => {
    const store = fresh();
    store.goto("returned");
    const state = store.getState();
    expect(state.screen).toBe("home");
    expect(state.machine.state).toBe("ANSWER_MINIMAL");
    expect(state.machine.note).toBe("minimal");
    const view = home(store);
    expect(view.note).toMatchObject({ kind: "ready", collapseText: "18초 뒤 접혀요 · 기록에 남아요" });
  });

  it("folded — E 접힌 메모: CAPTURE · folded · 결론 앞부분", () => {
    const store = fresh();
    store.goto("folded");
    const { machine } = store.getState();
    expect(machine.state).toBe("CAPTURE");
    expect(machine.note).toBe("folded");
    expect(home(store).note).toMatchObject({ kind: "collapsed", term: "new", conclusion: ANSWER_1?.conclusion });
    expect(home(store).lines).toHaveLength(5);
  });

  it("waiting — H 튜터 멈춤: 대기 문구 · 호박색 바닥줄 · 두 번째 질문", () => {
    const store = fresh();
    store.goto("waiting");
    const { machine } = store.getState();
    expect(machine.questionId).toBe("q-p3-002");
    expect(machine.note).toBe("waiting");
    expect(machine.provider).toBe("queued");
    const view = home(store);
    expect(view.note).toMatchObject({ kind: "preparing", term: "생성자", lineId: "ts-p3-008", warn: true, waitingText: WAITING_NOTE_LINE });
    expect(view.footer.warn).toEqual({
      tone: "off",
      title: "튜터 답변이 잠시 멈췄어요.",
      description: "수업 기록과 질문 지점은 계속 저장하고 있어요.",
    });
    expect(view.footer.count).toBe(2);
    const d = detail(store);
    expect(d?.loading).toBe(true);
    expect(d?.loadingText).toBe("튜터가 돌아오면 여기에 나타나요 · 순간은 저장됐어요");
  });

  it("recovered — 복구: 되살아난 답 · 근거 일부 확인", () => {
    const store = fresh();
    store.goto("recovered");
    const { machine } = store.getState();
    expect(machine.note).toBe("minimal");
    expect(machine.answerId).toBe("ans-p3-002");
    expect(machine.answerStatus).toBe("recovered");
    const view = home(store);
    expect(view.note).toMatchObject({ kind: "ready", term: "생성자", conclusion: ANSWER_2?.conclusion });
    if (view.note.kind !== "ready") return;
    expect(view.note.evidence[0]?.type).toBe("partial");
    expect(view.footer.warn).toBeNull();
  });
});

describe("fixture 끝까지 재생", () => {
  it("기계가 낸 state.changed 4건의 from·to 가 fixture 와 같고, 앞 3건은 시각까지 같다", () => {
    const store = fresh();
    const last = GOLDEN_BUNDLE.events.at(-1);
    expect(last).toBeDefined();
    if (last === undefined) return;
    store.advanceTo(last.at);
    const pick = (event: { at: string; payload: Record<string, unknown> }) => ({
      at: event.at,
      from: event.payload["from"],
      to: event.payload["to"],
    });
    const produced = store
      .getState()
      .emitted.filter((event) => event.type === "state.changed")
      .map(pick);
    const expected = GOLDEN_BUNDLE.events.filter((event) => event.type === "state.changed").map(pick);
    expect(produced.map((p) => [p.from, p.to])).toEqual(expected.map((e) => [e.from, e.to]));
    expect(produced.slice(0, 3).map((p) => p.at)).toEqual(expected.slice(0, 3).map((e) => e.at));
    // 4번째(두 번째 답이 접히는 때)는 fixture 가 손으로 10:33:09 라고 적었지만, 기계(정본)는 되살아난 답의
    // 18초가 끝나기 전에 period.ended(10:33:14)가 와서 그때 접습니다. tutor-core 의 재생 시험도 from·to 만 봅니다.
    expect(produced[3]?.at).toBe(last.at);
    expect(store.getState().machine.periodEnded).toBe(true);
  });

  it("goto 는 처음부터 다시 굴리므로 두 번 불러도 같은 그림이다", () => {
    const store = fresh();
    store.goto("recovered");
    const first = home(store);
    store.goto("answer");
    store.goto("recovered");
    expect(home(store)).toEqual(first);
  });
});

describe("손짓", () => {
  it("점선 낱말을 누르면 새 질문이 되고 2초 뒤 모의 제공자가 fixture 답을 돌려준다", () => {
    const store = fresh();
    store.goto("listening");
    store.catchTerm("ts-p3-004", 1, "new");
    const asked = store.getState();
    expect(asked.machine.note).toBe("preparing");
    expect(asked.machine.questionId).toBe("q-panel-001");
    expect(home(store).note).toMatchObject({ kind: "preparing", term: "new", time: "10:32:16" });
    if (home(store).note.kind === "preparing") {
      const sources = home(store).note;
      expect(sources.kind === "preparing" ? sources.sources[0]?.label : "").toBe("전사 2초 전");
    }
    store.advanceTo(store.clockMs("10:32:17"));
    expect(store.getState().machine.note).toBe("preparing");
    store.advanceTo(store.clockMs("10:32:18"));
    // 10:32:18 에는 fixture 의 question.asked 도 오지만, 그보다 먼저 모의 답이 도착해 한 줄 결론이 됐다가
    // 새 질문으로 갈아탑니다. 그래서 한 초 뒤에는 다시 preparing 입니다.
    expect(store.getState().machine.questionId).toBe("q-p3-001");
  });

  it("아무 fixture 질문도 없는 시각에 누르면 모의 답이 한 줄 결론으로 남는다", () => {
    const store = fresh();
    store.advanceTo(store.clockMs("10:32:05"));
    store.catchTerm("ts-p3-003", 1, "new");
    store.advanceTo(store.clockMs("10:32:08"));
    const state = store.getState();
    expect(state.machine.note).toBe("minimal");
    expect(state.machine.answerId).toBe("ans-p3-001");
    expect(home(store).note).toMatchObject({ kind: "ready", conclusion: ANSWER_1?.conclusion, lineId: "ts-p3-003" });
    const mock = state.received.find((event) => event.id.startsWith("ev-mock-"));
    expect(mock).toMatchObject({ type: "answer.completed", at: "2026-09-02T10:32:07+09:00" });
  });

  it("fixture 에 답이 없는 낱말은 모의 제공자가 answer.failed 로 튜터 멈춤을 재현한다", () => {
    const store = fresh();
    store.advanceTo(store.clockMs("10:32:05"));
    store.catchTerm("ts-p3-002", 0, "컨테이너");
    store.advanceTo(store.clockMs("10:32:08"));
    expect(store.getState().machine.note).toBe("waiting");
    expect(home(store).footer.warn?.title).toBe("튜터 답변이 잠시 멈췄어요.");
  });

  it("문장을 붙잡고 짐작을 고르면 그 낱말로 묻는다", () => {
    const store = fresh();
    store.goto("sentence");
    store.chooseGuess("g2");
    const state = store.getState();
    expect(state.choosing).toBeNull();
    expect(state.machine.note).toBe("preparing");
    expect(state.moments.at(-1)).toMatchObject({ lineId: "ts-p3-005", term: "생성자", segKey: null, time: "10:32:16" });
    store.advanceTo(store.clockMs("10:32:19"));
    expect(store.getState().machine.answerId).toBe("ans-p3-002");
  });

  it("모르는 짐작 id 는 아무 일도 하지 않는다", () => {
    const store = fresh();
    store.goto("sentence");
    store.chooseGuess("g9");
    expect(store.getState().choosing).not.toBeNull();
    expect(store.getState().machine.note).toBe("none");
  });

  it("칩을 누르면 그 자리에서 글이 바뀌고 접힘 시계가 18초로 되돌아간다", () => {
    const store = fresh();
    store.goto("answer");
    store.chip("why");
    const view = home(store);
    expect(view.note).toMatchObject({ kind: "ready", conclusion: ANSWER_1?.details?.why, collapseText: "18초 뒤 접혀요 · 기록에 남아요" });
    if (view.note.kind !== "ready") return;
    expect(view.note.evidence).toEqual([{ type: "verified", source: "tiro", time: "10:32" }]);
    expect(view.note.chips.find((c) => c.id === "why")?.selected).toBe(true);
    store.chip("why");
    expect(home(store).note).toMatchObject({ kind: "ready", conclusion: ANSWER_1?.conclusion });
  });

  it("fixture 에 글이 없는 칩은 결론을 그대로 두고 추론 표시를 붙인다", () => {
    const store = fresh();
    store.goto("answer");
    store.chip("easier");
    const view = home(store);
    if (view.note.kind !== "ready") throw new Error("ready 여야 해요");
    expect(view.note.conclusion).toBe(ANSWER_1?.conclusion);
    expect(view.note.evidence[0]?.type).toBe("inferred");
  });

  it("접힌 메모를 누르면 다시 펴지고 18초를 센다", () => {
    const store = fresh();
    store.goto("folded");
    store.expand();
    const { machine } = store.getState();
    expect(machine.state).toBe("ANSWER_MINIMAL");
    expect(machine.note).toBe("minimal");
    expect(home(store).note).toMatchObject({ kind: "ready", collapseText: "18초 뒤 접혀요 · 기록에 남아요" });
  });

  it("자세히에서 후속 칩은 fixture 의 details 만 쓰고, 뒤로 가면 답이 지워진다", () => {
    const store = fresh();
    store.goto("detail");
    store.followUp("why");
    expect(detail(store)?.reply).toEqual({ q: "왜 필요한데?", a: ANSWER_1?.details?.why, reason: "수업 자료에서 확인한 내용이에요" });
    store.followUp("recent");
    expect(detail(store)?.reply?.a).toBe("선생님은 지금 생성자 주입 코드로 넘어갔어요");
    store.followUp("easier");
    expect(detail(store)?.reply?.a).toBe(ANSWER_1?.conclusion);
    store.back();
    expect(store.getState().reply).toBeNull();
    expect(store.getState().screen).toBe("home");
  });

  it("메모가 없을 때는 자세히를 열지 않고, 자세히 화면에서는 낱말을 붙잡지 않는다", () => {
    const store = fresh();
    store.goto("listening");
    store.openDetail();
    expect(store.getState().screen).toBe("home");
    store.goto("detail");
    store.catchTerm("ts-p3-004", 1, "new");
    store.catchSentence("ts-p3-004");
    expect(store.getState().machine.questionId).toBe("q-p3-001");
    expect(store.getState().choosing).toBeNull();
  });

  it("구독자는 상태가 바뀔 때마다 불리고 해지하면 더 불리지 않는다", () => {
    const store = fresh();
    let calls = 0;
    const off = store.subscribe(() => {
      calls += 1;
    });
    store.tick();
    expect(calls).toBeGreaterThan(0);
    const seen = calls;
    off();
    store.tick();
    expect(calls).toBe(seen);
  });
});

describe("자료 나이", () => {
  it("붙잡은 시각 10:32:18 에 전사 4초 · 화면 2초 · 편집기 1초다", () => {
    const store = fresh();
    expect(sourceAges(GOLDEN_BUNDLE, store.clockMs("10:32:18"))).toEqual({ tiro: 4, meet: 2, intellij: 1 });
  });
});
