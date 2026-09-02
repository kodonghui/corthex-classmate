// 라이브 모드 — 빈 번들로 시작해 밖에서 들어온 자료를 채워 넣는 길을 봅니다.
//
//   pushSegment ─▶ 줄이 보임 ─▶ catchTerm ─▶ AskPort.ask(1회) ─▶ answer.completed(본문 포함)
//                                                              ─▶ 메모에 결론
//   answer.failed ─▶ 대기(H) ─▶ answer.recovered ─▶ 다시 한 줄 결론
//   답이 60초 안 오면 스토어가 스스로 answer.failed 를 넣습니다(워치독).
//
// fixture 재생 모드는 `replay-store.test.ts` 가 따로 봅니다. 여기서는 fixture 를 쓰지 않습니다.

import type {
  Answer,
  EditorContext,
  ScreenFrame,
  SessionEvent,
  TranscriptSegment,
} from "@classmate/contracts";
import { formatIso, parseIso, WAITING_NOTE_LINE } from "@classmate/tutor-core";
import { describe, expect, it } from "vitest";

import { ID_TOKEN_LENGTH, makeIdToken, panelEventId, panelQuestionId } from "./event-ids";
import { LIVE_EDITOR_PLACEHOLDER_ID } from "./golden-bundle";
import { listeningView } from "./lesson-view";
import type { AskRequest } from "./ports";
import { ASK_TIMEOUT_MESSAGE, questionTextOf, ReplayStore } from "./replay-store";

const PERIOD = "2026-09-02-p9";
const TOKEN = "testtok0";
const START = parseIso("2026-09-02T10:00:00+09:00");

/** 시작 시각에서 몇 초 뒤인지로 ISO 시각을 만듭니다. `at(5)` → `2026-09-02T10:00:05+09:00`. */
function at(seconds: number): string {
  return formatIso(START + seconds * 1_000);
}

function segment(seq: number, text: string, seconds: number): TranscriptSegment {
  return {
    id: `ts-live-${String(seq).padStart(3, "0")}`,
    periodId: PERIOD,
    seq,
    text,
    state: "final",
    arrivedAt: at(seconds),
    source: "tiro-share",
  };
}

function frame(seconds: number): ScreenFrame {
  return {
    id: `sf-live-${seconds}`,
    periodId: PERIOD,
    capturedAt: at(seconds),
    path: "frames/live.webp",
    width: 1280,
    height: 720,
    hash: "abc123",
    changedFromPrev: true,
    source: "meet-tab",
  };
}

function editor(seconds: number): EditorContext {
  return {
    id: `ec-live-${seconds}`,
    periodId: PERIOD,
    capturedAt: at(seconds),
    filePath: "src/main/java/com/ohgiraffers/order/OrderService.java",
    language: "java",
    visibleRange: { startLine: 1, endLine: 12 },
    excerpt: "public class OrderService {}",
    source: "intellij-mcp",
  };
}

function answerBody(id: string, questionId: string, conclusion: string, seconds: number): Answer {
  return {
    id,
    questionId,
    createdAt: at(seconds),
    conclusion,
    evidence: "confirmed",
    chips: ["더 쉽게", "지금 화면 코드"],
    provider: "mock",
    status: "answered",
  };
}

function event(
  id: string,
  seconds: number,
  type: SessionEvent["type"],
  payload: Record<string, unknown>,
): SessionEvent {
  return { id, periodId: PERIOD, at: at(seconds), type, payload };
}

interface Rig {
  readonly store: ReplayStore;
  readonly asks: AskRequest[];
  /** 가짜 시계를 이 초로 옮기고 `tick()` 을 부릅니다. */
  tickAt(seconds: number): void;
}

function rig(): Rig {
  const asks: AskRequest[] = [];
  let clock = START;
  const store = ReplayStore.live({
    periodId: PERIOD,
    startMs: START,
    idToken: TOKEN,
    askPort: {
      ask: (request) => {
        asks.push(request);
      },
    },
    now: () => clock,
  });
  return {
    store,
    asks,
    tickAt: (seconds) => {
      clock = START + seconds * 1_000;
      store.tick();
    },
  };
}

function home(store: ReplayStore) {
  const state = store.getState();
  return listeningView(store.bundle, state, store.lines(state.now));
}

// ─────────────────────────────────────────────────────────────────────────────

describe("id 규칙", () => {
  it("패널이 만든 사건·질문 id 는 교시와 토큰을 담는다", () => {
    expect(panelEventId(PERIOD, TOKEN, 3)).toBe("ev-2026-09-02-p9-xtesttok0-0003");
    expect(panelQuestionId(PERIOD, TOKEN, 1)).toBe("q-2026-09-02-p9-xtesttok0-001");
  });

  it("토큰은 8글자이고 crypto 가 없어도 만들어진다", () => {
    expect(makeIdToken()).toHaveLength(ID_TOKEN_LENGTH);
    expect(makeIdToken(() => 0.123_456_789)).toHaveLength(ID_TOKEN_LENGTH);
  });

  it("낱말 질문 문장은 낱말이 있으면 그 낱말로, 없으면 일반 문장으로 만든다", () => {
    expect(questionTextOf("new")).toBe("new 이 무슨 뜻이에요?");
    expect(questionTextOf(undefined)).toBe("이 부분이 무슨 뜻이에요?");
  });
});

describe("빈 번들로 시작", () => {
  it("전사·프레임·질문·답이 비어 있고 편집기는 자리표시다", () => {
    const { store } = rig();
    expect(store.isLive).toBe(true);
    expect(store.startMs).toBe(START);
    expect(store.bundle.transcript).toHaveLength(0);
    expect(store.bundle.frames).toHaveLength(0);
    expect(store.bundle.events).toHaveLength(0);
    expect(store.bundle.questions).toEqual({});
    expect(store.bundle.answers).toEqual({});
    expect(store.bundle.editor.id).toBe(LIVE_EDITOR_PLACEHOLDER_ID);
    expect(store.getState().machine.state).toBe("CAPTURE");
    expect(home(store).header).toMatchObject({ title: "수업", subtitle: "1교시", time: "10:00:00" });
  });

  it("라이브 스토어에는 체크포인트가 없다", () => {
    const { store } = rig();
    expect(() => store.goto("answer")).toThrow(/라이브 모드/);
  });

  it("period.started 가 오면 제목과 교시 번호를 채운다", () => {
    const { store } = rig();
    store.pushEvent(
      event("ev-x-001", 0, "period.started", { periodId: PERIOD, subject: "IoC 와 DI", index: 3 }),
    );
    expect(store.bundle.subject).toBe("IoC 와 DI");
    expect(store.bundle.periodIndex).toBe(3);
    expect(home(store).header).toMatchObject({ title: "IoC 와 DI", subtitle: "3교시" });
  });
});

describe("들어오는 자료", () => {
  it("전사를 넣으면 곧바로 화면 줄이 된다", () => {
    const { store } = rig();
    store.pushSegment(segment(1, "오늘은 IoC 컨테이너를 봅니다", 4));
    store.pushSegment(segment(2, "객체를 직접 new로 만들면 강하게 묶여요", 6));
    const view = home(store);
    expect(view.lines.map((line) => line.id)).toEqual(["ts-live-001", "ts-live-002"]);
    expect(view.header.time).toBe("10:00:06");
    expect(view.lines[1]?.segments.some((s) => s.term === true && s.text === "new")).toBe(true);
  });

  it("같은 전사 조각을 두 번 넣어도 한 줄이고, 순서는 seq 를 따른다", () => {
    const { store } = rig();
    store.pushSegment(segment(2, "둘째 문장", 6));
    store.pushSegment(segment(1, "첫째 문장", 4));
    store.pushSegment(segment(1, "첫째 문장", 4));
    expect(store.bundle.transcript.map((s) => s.seq)).toEqual([1, 2]);
  });

  it("같은 프레임 id 는 무시하고, 편집기 문맥은 최신 것으로 갈아 끼운다", () => {
    const { store } = rig();
    store.pushFrame(frame(5));
    store.pushFrame(frame(5));
    expect(store.bundle.frames).toHaveLength(1);
    store.pushEditor(editor(7));
    expect(store.bundle.editor.id).toBe("ec-live-7");
    expect(store.bundle.editor.filePath).toContain("OrderService.java");
  });

  it("같은 사건 id 를 두 번 넣으면 한 번만 받는다", () => {
    const { store } = rig();
    const same = event("ev-x-009", 3, "connector.status", { connector: "tiro-share", state: "paused" });
    store.pushEvent(same);
    store.pushEvent(same);
    expect(store.getState().received.filter((item) => item.id === "ev-x-009")).toHaveLength(1);
    expect(store.getState().machine.connectors["tiro-share"]).toBe("paused");
    expect(home(store).footer.warn?.tone).toBe("paused");
  });
});

describe("붙잡기 → AskPort", () => {
  it("낱말을 붙잡으면 밖으로 딱 한 번 묻고 요청에 봉인이 실린다", () => {
    const { store, asks } = rig();
    store.pushSegment(segment(1, "객체를 직접 new로 만들면 강하게 묶여요", 5));
    store.pushFrame(frame(5));
    store.pushEditor(editor(5));
    store.catchTerm("ts-live-001", 1, "new");

    expect(asks).toHaveLength(1);
    const ask = asks[0];
    expect(ask).toMatchObject({
      questionId: "q-2026-09-02-p9-xtesttok0-001",
      provider: "mock",
      kind: "confused",
      word: "new",
      question: "new 이 무슨 뜻이에요?",
    });
    expect(ask?.snapshot?.transcriptSegmentIds).toEqual(["ts-live-001"]);
    expect(ask?.snapshot?.screenFrameId).toBe("sf-live-5");
    expect(ask?.snapshot?.editorContextId).toBe("ec-live-5");
    expect(store.getState().machine.note).toBe("preparing");

    // 같은 질문으로 tick 이 여러 번 돌아도 다시 묻지 않습니다.
    store.tick();
    store.tick();
    expect(asks).toHaveLength(1);
  });

  it("편집기 문맥이 아직 없으면 자리표시를 봉인에 넣지 않는다", () => {
    const { store, asks } = rig();
    store.pushSegment(segment(1, "객체를 직접 new로 만들면", 5));
    store.catchTerm("ts-live-001", 1, "new");
    expect(asks[0]?.snapshot?.editorContextId).toBeUndefined();
    expect(asks[0]?.snapshot?.ages.editorSec).toBeNull();
  });

  it("문장을 붙잡아 짐작을 고르면 짐작 라벨을 그대로 묻는다", () => {
    const { store, asks } = rig();
    store.pushSegment(segment(1, "객체를 직접 new로 만들면 강하게 묶여요", 5));
    store.catchSentence("ts-live-001");
    store.chooseGuess("g1");
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ word: "new", question: "왜 new로 직접 만들면 안 되는지" });
  });

  it("밖에서 온 question.asked 도 본문을 번들에 담고 한 번 묻는다", () => {
    const { store, asks } = rig();
    store.pushSegment(segment(1, "객체를 직접 new로 만들면", 5));
    store.pushEvent(
      event("ev-x-020", 6, "question.asked", {
        questionId: "q-host-001",
        kind: "code-flow",
        word: "생성자",
        question: {
          id: "q-host-001",
          periodId: PERIOD,
          askedAt: at(6),
          kind: "code-flow",
          text: "생성자 주입이 뭐예요?",
          anchor: { segmentId: "ts-live-001", word: "생성자" },
          snapshot: { transcriptSegmentIds: ["ts-live-001"], ages: { transcriptSec: 1, screenSec: null, editorSec: null } },
        },
      }),
    );
    expect(store.bundle.questions["q-host-001"]?.text).toBe("생성자 주입이 뭐예요?");
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({
      questionId: "q-host-001",
      kind: "code-flow",
      word: "생성자",
      question: "생성자 주입이 뭐예요?",
    });
  });
});

describe("답이 돌아오는 길", () => {
  function asked(): Rig {
    const bench = rig();
    bench.store.pushSegment(segment(1, "객체를 직접 new로 만들면 강하게 묶여요", 5));
    bench.store.catchTerm("ts-live-001", 1, "new");
    return bench;
  }

  it("answer.completed 의 본문이 그대로 메모의 결론이 된다", () => {
    const { store } = asked();
    store.pushEvent(
      event("ev-x-030", 8, "answer.completed", {
        questionId: "q-2026-09-02-p9-xtesttok0-001",
        answerId: "ans-live-001",
        evidence: "confirmed",
        provider: "mock",
        answer: answerBody("ans-live-001", "q-2026-09-02-p9-xtesttok0-001", "new 는 만들 책임까지 떠안는 말이에요", 8),
      }),
    );
    const { machine } = store.getState();
    expect(machine.note).toBe("minimal");
    expect(machine.answerId).toBe("ans-live-001");
    const view = home(store);
    expect(view.note).toMatchObject({
      kind: "ready",
      term: "new",
      conclusion: "new 는 만들 책임까지 떠안는 말이에요",
      collapseText: "18초 뒤 접혀요 · 기록에 남아요",
    });
  });

  it("answer.failed 하나로 대기 화면(H)이 되고 answer.queued 가 뒤따라도 그대로다", () => {
    const { store } = asked();
    store.pushEvent(
      event("ev-x-040", 9, "answer.failed", {
        questionId: "q-2026-09-02-p9-xtesttok0-001",
        provider: "mock",
        message: ASK_TIMEOUT_MESSAGE,
      }),
    );
    const afterFailed = home(store);
    expect(store.getState().machine.note).toBe("waiting");
    expect(afterFailed.note).toMatchObject({ kind: "preparing", warn: true, waitingText: WAITING_NOTE_LINE });
    expect(afterFailed.footer.warn).toEqual({
      tone: "off",
      title: "튜터 답변이 잠시 멈췄어요.",
      description: "수업 기록과 질문 지점은 계속 저장하고 있어요.",
    });

    store.pushEvent(
      event("ev-x-041", 10, "answer.queued", {
        questionId: "q-2026-09-02-p9-xtesttok0-001",
        answerId: "ans-live-001-queued",
        evidence: "stale",
        answer: {
          ...answerBody("ans-live-001-queued", "q-2026-09-02-p9-xtesttok0-001", "한 줄로 정리하고 있어요", 10),
          evidence: "stale",
          status: "queued",
        },
      }),
    );
    expect(store.getState().machine.note).toBe("waiting");
    expect(store.getState().machine.provider).toBe("queued");
    expect(home(store).note).toMatchObject({ kind: "preparing", warn: true });
  });

  it("answer.recovered 가 오면 되살아난 답이 한 줄 결론으로 뜬다", () => {
    const { store } = asked();
    store.pushEvent(
      event("ev-x-050", 9, "answer.failed", {
        questionId: "q-2026-09-02-p9-xtesttok0-001",
        provider: "mock",
        message: ASK_TIMEOUT_MESSAGE,
      }),
    );
    store.pushEvent(
      event("ev-x-051", 20, "answer.recovered", {
        questionId: "q-2026-09-02-p9-xtesttok0-001",
        answerId: "ans-live-002",
        evidence: "partial",
        provider: "mock",
        answer: {
          ...answerBody("ans-live-002", "q-2026-09-02-p9-xtesttok0-001", "컨테이너가 대신 만들어 줘요", 20),
          evidence: "partial",
          status: "recovered",
        },
      }),
    );
    const { machine } = store.getState();
    expect(machine.note).toBe("minimal");
    expect(machine.answerStatus).toBe("recovered");
    const view = home(store);
    expect(view.note).toMatchObject({ kind: "ready", conclusion: "컨테이너가 대신 만들어 줘요" });
    expect(view.footer.warn).toBeNull();
  });
});

describe("워치독", () => {
  it("60초가 지나도록 답이 없으면 스토어가 스스로 answer.failed 를 넣는다", () => {
    const bench = rig();
    const { store, asks } = bench;
    store.pushSegment(segment(1, "객체를 직접 new로 만들면", 5));
    store.catchTerm("ts-live-001", 1, "new");
    expect(asks).toHaveLength(1);

    bench.tickAt(60);
    expect(store.getState().machine.note).toBe("preparing");

    bench.tickAt(65);
    const failed = store.getState().received.find((item) => item.type === "answer.failed");
    expect(failed?.payload["message"]).toBe(ASK_TIMEOUT_MESSAGE);
    expect(failed?.payload["questionId"]).toBe("q-2026-09-02-p9-xtesttok0-001");
    expect(failed?.id).toMatch(/^ev-2026-09-02-p9-xtesttok0-\d{4}$/);
    expect(store.getState().machine.note).toBe("waiting");
    expect(home(store).footer.warn?.tone).toBe("off");
  });

  it("답이 제때 오면 워치독은 뒤늦게 실패를 넣지 않는다", () => {
    const bench = rig();
    const { store } = bench;
    store.pushSegment(segment(1, "객체를 직접 new로 만들면", 5));
    store.catchTerm("ts-live-001", 1, "new");
    store.pushEvent(
      event("ev-x-060", 8, "answer.completed", {
        questionId: "q-2026-09-02-p9-xtesttok0-001",
        answerId: "ans-live-001",
        evidence: "confirmed",
        provider: "mock",
        answer: answerBody("ans-live-001", "q-2026-09-02-p9-xtesttok0-001", "짧게 한 줄", 8),
      }),
    );
    bench.tickAt(120);
    expect(store.getState().received.some((item) => item.type === "answer.failed")).toBe(false);
  });
});

describe("밖으로 흘리는 사건", () => {
  it("subscribeEmitted 가 question.asked 를 흘리고 해지하면 더 오지 않는다", () => {
    const { store } = rig();
    store.pushSegment(segment(1, "객체를 직접 new로 만들면", 5));
    const seen: SessionEvent[] = [];
    const off = store.subscribeEmitted((item) => seen.push(item));

    store.catchTerm("ts-live-001", 1, "new");
    expect(seen.map((item) => item.type)).toEqual(["state.changed", "question.asked"]);
    const asked = seen.find((item) => item.type === "question.asked");
    expect(asked?.id).toBe("ev-2026-09-02-p9-xtesttok0-0002");
    expect(asked?.payload["questionId"]).toBe("q-2026-09-02-p9-xtesttok0-001");
    expect(asked?.payload["word"]).toBe("new");
    expect(store.getState().emitted).toHaveLength(2);

    off();
    const before = seen.length;
    store.catchTerm("ts-live-001", 1, "new");
    expect(seen).toHaveLength(before);
    expect(store.getState().emitted.length).toBeGreaterThan(2);
  });
});
