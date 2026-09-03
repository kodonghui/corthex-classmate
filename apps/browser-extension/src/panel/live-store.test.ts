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
  Question,
  ScreenFrame,
  SessionEvent,
  TranscriptSegment,
} from "@classmate/contracts";
import { formatIso, parseIso, WAITING_NOTE_LINE } from "@classmate/tutor-core";
import { describe, expect, it } from "vitest";

import { ID_TOKEN_LENGTH, makeIdToken, panelEventId, panelQuestionId } from "./event-ids";
import { emptyBundle, LIVE_EDITOR_PLACEHOLDER_ID } from "./golden-bundle";
import { WHOLE_SENTENCE_LABEL } from "./guesses";
import { historyView } from "./history-view";
import { detailViewFor, listeningView, sourceAges } from "./lesson-view";
import type { AskRequest } from "./ports";
import { ASK_TIMEOUT_MESSAGE, MODEL_CHIP_PREFIX, questionTextOf, ReplayStore } from "./replay-store";

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
    store.pushSegment(segment(2, "여기서 enableWebSecurity 를 켜 주면 필터가 붙어요", 6));
    const view = home(store);
    expect(view.lines.map((line) => line.id)).toEqual(["ts-live-001", "ts-live-002"]);
    expect(view.header.time).toBe("10:00:06");
    // 점선은 **지금 전사에서 뽑은** 낱말에만 갑니다(fixture 의 `new` · `생성자` 는 쓰지 않습니다).
    expect(view.lines[1]?.segments.some((s) => s.term === true && s.text === "enableWebSecurity")).toBe(true);
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

  it("문장을 붙잡으면 짐작을 fixture 가 아니라 그 문장에서 만든다", () => {
    const { store } = rig();
    store.pushSegment(segment(1, "여기서 @EnableWebSecurity 를 붙여 줍니다", 4));
    store.pushSegment(segment(2, "뭔가를 또 타이핑을 해 줘야 되는데 쉬는 시간 다녀오세요", 5));
    store.catchSentence("ts-live-002");
    const options = store.getState().choosing?.options ?? [];
    // fixture 의 짐작("왜 new로 직접 만들면 안 되는지")은 라이브에 나오지 않습니다.
    expect(options.map((item) => item.label)).toEqual([
      "@EnableWebSecurity 가 뭔지",
      WHOLE_SENTENCE_LABEL,
    ]);
  });

  it("짐작을 고르면 라벨이 아니라 문장이 담긴 진짜 질문을 묻는다", () => {
    const { store, asks } = rig();
    store.pushSegment(segment(1, "context.getBean 으로 꺼내 씁니다", 5));
    store.catchSentence("ts-live-001");
    store.chooseGuess("g1");
    expect(asks).toHaveLength(1);
    expect(asks[0]?.word).toBe("context.getBean");
    expect(asks[0]?.question).toBe(
      '선생님이 방금 "context.getBean 으로 꺼내 씁니다" 이라고 했는데, context.getBean 가 무엇인지 지금 수업 맥락에서 설명해 주세요',
    );
    // 메모 제목은 고른 낱말입니다.
    expect(store.getState().moments[0]?.term).toBe("context.getBean");
  });

  it("고른 짐작 낱말은 전사에 점선으로 그어져 표시 자리가 생긴다", () => {
    const { store } = rig();
    store.pushSegment(segment(1, "context.getBean 으로 꺼내 씁니다", 5));
    store.catchSentence("ts-live-001");
    store.chooseGuess("g1");
    const state = store.getState();
    // 점선은 fixture 낱말(new · 생성자)이 아니라 이 문장에서 뽑은 낱말에 갑니다.
    expect(store.lines(state.now)[0]?.segments[0]).toEqual({ text: "context.getBean", term: true });
    const view = detailViewFor(store.bundle, state, store.lines(state.now), state.machine.questionId ?? "");
    expect(view?.marked).toEqual(["ts-live-001:0"]);
  });

  it("문장 전체 짐작은 낱말 없이 문장을 묻는다", () => {
    const { store, asks } = rig();
    store.pushSegment(segment(1, "이제 생성 책임을 컨테이너에 맡겨 볼게요", 5));
    store.catchSentence("ts-live-001");
    expect(store.getState().choosing?.options.map((item) => item.id)).toEqual(["gs"]);
    store.chooseGuess("gs");
    expect(asks[0]?.word).toBeUndefined();
    expect(asks[0]?.question).toContain("이 문장이 무슨 뜻인지");
    expect(store.getState().moments[0]?.term).toBe("문장");
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

// ─────────────────────────────────────────────────────────────────────────────

/** 호스트가 `tutor.ask` 를 받고 되미는 자기 `question.asked` 기록본입니다. 사건 id 가 패널 것과 다릅니다. */
function hostEcho(eventId: string, questionId: string, seconds: number, word: string): SessionEvent {
  const question = {
    id: questionId,
    periodId: PERIOD,
    askedAt: at(seconds),
    kind: "confused",
    text: questionTextOf(word),
    // 호스트 기록본에는 anchor 가 없습니다. 그래서 순간을 또 만들면 밑줄이 엉뚱한 줄로 갑니다.
    snapshot: { askedAt: at(seconds), transcriptSegmentIds: [], ages: { transcriptSec: null, screenSec: null, editorSec: null } },
  } as unknown as Question;
  return event(eventId, seconds, "question.asked", { questionId, kind: "confused", question });
}

describe("같은 질문을 두 번 듣기(호스트 되밀기)", () => {
  it("한 번 붙잡았으면 호스트가 되밀어도 순간은 하나다", () => {
    const { store } = rig();
    store.pushSegment(segment(1, "객체를 직접 new로 만들면 강하게 묶여요", 5));
    store.pushSegment(segment(2, "그래서 스프링이 대신 만들어 줍니다", 6));
    store.catchTerm("ts-live-001", 1, "new");
    const questionId = store.getState().machine.questionId;
    expect(questionId).toBe("q-2026-09-02-p9-xtesttok0-001");

    store.pushEvent(hostEcho("ev-host-0001", questionId ?? "", 7, "new"));

    const state = store.getState();
    expect(state.moments).toHaveLength(1);
    expect(state.moments[0]).toMatchObject({ questionId, lineId: "ts-live-001", term: "new" });
    // 바닥줄 "기록 N" 과 기록 화면 줄도 하나뿐입니다(같은 key 가 둘이면 React 가 경고합니다).
    expect(home(store).footer.count).toBe(1);
    expect(historyView(store.bundle, state).groups[0]?.rows).toHaveLength(1);
    // 되밀린 사건은 기록에 남습니다 — 무시가 아니라 순간을 더 만들지 않는 것입니다.
    expect(state.received.some((item) => item.id === "ev-host-0001")).toBe(true);
    // 준비 시계도 다시 걸지 않습니다(호스트 시각으로 밀리면 답이 늦게 뜹니다).
    expect(state.machine.note).toBe("preparing");
  });
});

describe("옛 질문의 답", () => {
  it("지금 보고 있는 질문의 답이 아니면 메모에 얹지 않고 기록에만 남긴다", () => {
    const { store } = rig();
    store.pushSegment(segment(1, "객체를 직접 new로 만들면 강하게 묶여요", 5));
    store.catchTerm("ts-live-001", 1, "new");
    const q1 = store.getState().machine.questionId ?? "";
    store.pushSegment(segment(2, "그래서 생성자 주입을 씁니다", 6));
    store.catchTerm("ts-live-002", 1, "생성자");
    const q2 = store.getState().machine.questionId ?? "";
    expect(q1).not.toBe(q2);

    store.pushEvent(
      event("ev-host-0002", 8, "answer.completed", {
        questionId: q1,
        answerId: "ans-live-old",
        evidence: "confirmed",
        provider: "mock",
        answer: answerBody("ans-live-old", q1, "new 자체는 괜찮지만 바꾸기 어려워요", 8),
      }),
    );

    const state = store.getState();
    // 얹혔다면 메모가 "생성자" 낱말에 "new …" 결론을 붙입니다.
    expect(state.machine.questionId).toBe(q2);
    expect(state.machine.answerId).toBeNull();
    expect(state.machine.note).toBe("preparing");
    // 기록 화면은 received 로 만드니 q1 줄에는 그 답이 그대로 붙습니다.
    const rows = historyView(store.bundle, state).groups[0]?.rows ?? [];
    expect(rows.find((row) => row.questionId === q1)?.title).toBe("new 자체는 괜찮지만 바꾸기 어려워요");
    expect(rows.find((row) => row.questionId === q2)?.state).toBe("preparing");
  });

  it("지금 질문의 답은 그대로 얹힌다", () => {
    const { store } = rig();
    store.pushSegment(segment(1, "객체를 직접 new로 만들면", 5));
    store.catchTerm("ts-live-001", 1, "new");
    const q1 = store.getState().machine.questionId ?? "";
    store.pushEvent(
      event("ev-host-0003", 8, "answer.completed", {
        questionId: q1,
        answerId: "ans-live-001",
        evidence: "confirmed",
        provider: "mock",
        answer: answerBody("ans-live-001", q1, "짧게 한 줄", 8),
      }),
    );
    expect(store.getState().machine.answerId).toBe("ans-live-001");
  });
});

describe("바닥줄 자료 나이", () => {
  it("IntelliJ 문맥이 아직 없으면 나이를 세지 않는다", () => {
    const { store } = rig();
    expect(sourceAges(store.bundle, START + 5_000).intellij).toBeNull();
    expect(sourceAges(emptyBundle(PERIOD, START), START + 30_000).intellij).toBeNull();
    // 화면 바닥줄도 "0초 전" 이 아니라 "—" 입니다.
    expect(home(store).footer.sources.find((item) => item.key === "intellij")?.ago).toBe("—");
  });

  it("진짜 편집기 문맥이 한 번 오면 그때부터 나이를 센다", () => {
    const bench = rig();
    bench.store.pushEditor(editor(5));
    bench.tickAt(9);
    expect(sourceAges(bench.store.bundle, START + 9_000).intellij).toBe(4);
    expect(home(bench.store).footer.sources.find((item) => item.key === "intellij")?.ago).toBe("4초 전");
  });
});

describe("수업 중 설정 바꾸기(updateEnv)", () => {
  it("제공자를 바꾸면 다음 질문부터 그 제공자로 묻는다", () => {
    const { store, asks } = rig();
    store.pushSegment(segment(1, "객체를 직접 new로 만들면", 5));
    store.catchTerm("ts-live-001", 1, "new");
    expect(asks[0]?.provider).toBe("mock");

    store.updateEnv({ provider: "claude" });
    store.pushSegment(segment(2, "그래서 생성자 주입을 씁니다", 6));
    store.catchTerm("ts-live-002", 1, "생성자");
    expect(asks[1]?.provider).toBe("claude");
  });

  it("자동 접기를 끄면 이미 떠 있는 메모도 18초 뒤에 접히지 않는다", () => {
    const bench = rig();
    const { store } = bench;
    store.pushSegment(segment(1, "객체를 직접 new로 만들면", 5));
    store.catchTerm("ts-live-001", 1, "new");
    const questionId = store.getState().machine.questionId ?? "";
    store.pushEvent(
      event("ev-x-070", 8, "answer.completed", {
        questionId,
        answerId: "ans-live-001",
        evidence: "confirmed",
        provider: "mock",
        answer: answerBody("ans-live-001", questionId, "짧게 한 줄", 8),
      }),
    );
    bench.tickAt(9);
    expect(store.getState().machine.note).toBe("minimal");
    expect(store.getState().machine.foldDeadline).not.toBeNull();

    store.updateEnv({ autoFold: false });
    expect(store.getState().machine.foldDeadline).toBeNull();
    bench.tickAt(40);
    expect(store.getState().machine.note).toBe("minimal");
  });

  it("자동 접기가 켜져 있으면 18초 뒤에 접힌다", () => {
    const bench = rig();
    const { store } = bench;
    store.pushSegment(segment(1, "객체를 직접 new로 만들면", 5));
    store.catchTerm("ts-live-001", 1, "new");
    const questionId = store.getState().machine.questionId ?? "";
    store.pushEvent(
      event("ev-x-071", 8, "answer.completed", {
        questionId,
        answerId: "ans-live-001",
        evidence: "confirmed",
        provider: "mock",
        answer: answerBody("ans-live-001", questionId, "짧게 한 줄", 8),
      }),
    );
    bench.tickAt(9);
    bench.tickAt(40);
    expect(store.getState().machine.note).toBe("folded");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("같은 문단이 다시 올 때", () => {
  it("같은 id 의 전사는 갈아 끼우고 final 이 partial 로 되돌아가지 않는다", () => {
    const { store } = rig();
    store.pushSegment({ ...segment(1, "여기서 뭔가를", 5), state: "partial" });
    store.pushSegment({ ...segment(1, "여기서 뭔가를 또 타이핑을 해 줘야 되는데", 6), state: "partial" });
    expect(store.bundle.transcript).toHaveLength(1);
    expect(store.bundle.transcript[0]?.text).toBe("여기서 뭔가를 또 타이핑을 해 줘야 되는데");

    store.pushSegment(segment(1, "여기서 뭔가를 또 타이핑을 해 줘야 되는데 쉬는 시간 다녀오세요", 7));
    expect(store.bundle.transcript[0]?.state).toBe("final");
    // 확정된 뒤에 늦게 온 partial 은 무시합니다.
    store.pushSegment({ ...segment(1, "여기서", 8), state: "partial" });
    expect(store.bundle.transcript[0]?.text).toBe("여기서 뭔가를 또 타이핑을 해 줘야 되는데 쉬는 시간 다녀오세요");
    expect(home(store).lines).toHaveLength(1);
  });

  it("진행 중 partial 줄과 같은 문단의 세그먼트가 함께 있어도 한 줄만 그린다", () => {
    const { store } = rig();
    // 확정 전 문단은 관찰기의 세그먼트(ts-live-001)와 tiro.partial 줄(다른 id) 두 길로 옵니다.
    store.pushSegment({ ...segment(1, "컨테이너가 대신 만들어 주면", 5), state: "partial" });
    store.pushSegment({
      ...segment(1, "컨테이너가 대신 만들어 주면 우리는", 6),
      id: `ts-${PERIOD}-partial-0`,
      state: "partial",
    });
    const lines = home(store).lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]?.segments.map((item) => item.text).join("")).toBe("컨테이너가 대신 만들어 주면 우리는");
  });

  it("붙잡은 진행 중 줄이 확정본에 접혀도 인용 줄과 표시가 따라간다", () => {
    const { store } = rig();
    // 사람이 실제로 붙잡는 줄은 tiro.partial 이 만든 줄입니다(id 도 seq 도 확정본과 다릅니다).
    store.pushSegment({
      ...segment(41, "여기서 enableWebSecurity 를 켜 주면", 5),
      id: `ts-${PERIOD}-partial-40`,
      state: "partial",
    });
    store.catchSentence(`ts-${PERIOD}-partial-40`);
    store.chooseGuess("g1");
    const questionId = store.getState().machine.questionId ?? "";
    expect(store.getState().moments[0]?.segKey).toBe(`ts-${PERIOD}-partial-40:1`);

    store.pushSegment(segment(1, "여기서 enableWebSecurity 를 켜 주면 필터가 붙습니다", 7));
    const state = store.getState();
    expect(state.moments[0]?.lineId).toBe("ts-live-001");
    const view = detailViewFor(store.bundle, state, store.lines(state.now), questionId);
    expect(view?.line?.id).toBe("ts-live-001");
    expect(view?.marked).toEqual(["ts-live-001:1"]);
  });

  it("같은 id 의 글이 앞머리부터 다시 오면 표시가 그 낱말을 따라간다", () => {
    const { store } = rig();
    store.pushSegment({ ...segment(1, "enableWebSecurity 를 켜 주면", 5), state: "partial" });
    store.catchTerm("ts-live-001", 0, "enableWebSecurity");
    const questionId = store.getState().machine.questionId ?? "";
    expect(store.getState().moments[0]?.segKey).toBe("ts-live-001:0");

    // 앞머리가 다시 읽히며 같은 id 의 글이 통째로 갈아 끼워집니다. 조각 번호가 하나 밀립니다.
    store.pushSegment(segment(1, "그러니까 enableWebSecurity 를 켜 주면 곤란해요", 6));
    const state = store.getState();
    expect(state.moments[0]?.segKey).toBe("ts-live-001:1");
    const view = detailViewFor(store.bundle, state, store.lines(state.now), questionId);
    expect(view?.marked).toEqual(["ts-live-001:1"]);
  });
});

describe("자세히 화면에서 이어 묻기", () => {
  /** 낱말 하나를 붙잡고 답까지 받아 자세히 화면을 연 자리입니다. */
  function opened(): { bench: Rig; parentId: string } {
    const bench = rig();
    bench.store.pushSegment(segment(1, "객체를 직접 new로 만들면 강하게 묶여요", 5));
    bench.store.catchTerm("ts-live-001", 1, "new");
    const parentId = bench.store.getState().machine.questionId ?? "";
    bench.store.pushEvent(
      event("ev-x-100", 8, "answer.completed", {
        questionId: parentId,
        answerId: "ans-live-001",
        evidence: "confirmed",
        provider: "mock",
        answer: answerBody("ans-live-001", parentId, "new 는 만들 책임까지 떠안는 말이에요", 8),
      }),
    );
    bench.store.openDetail();
    return { bench, parentId };
  }

  function threadsOf(store: ReplayStore, questionId: string) {
    const state = store.getState();
    return detailViewFor(store.bundle, state, store.lines(state.now), questionId)?.threads ?? [];
  }

  it("적어 보내면 kind free 로 나가고 앞선 답의 결론이 한 줄 맥락으로 붙는다", () => {
    const { bench, parentId } = opened();
    const { store, asks } = bench;
    store.askTyped(parentId, "  그럼 언제 써요?  ");

    expect(asks).toHaveLength(2);
    expect(asks[1]).toMatchObject({ kind: "free", questionId: "q-2026-09-02-p9-xtesttok0-002" });
    expect(asks[1]?.word).toBeUndefined();
    expect(asks[1]?.question).toBe(
      '앞선 답은 "new 는 만들 책임까지 떠안는 말이에요" 이었어요. 이어서 물어요 — 그럼 언제 써요?',
    );
    // 봉인은 앞 질문이 보던 자리를 그대로 잇습니다(`live-snapshot.test.ts` 가 그 규칙을 봅니다).
    expect(asks[1]?.snapshot?.transcriptSegmentIds).toEqual(["ts-live-001"]);

    const threads = threadsOf(store, parentId);
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({ question: "그럼 언제 써요?", loading: true, failure: null });
    // 본 답과 화면은 그대로입니다(상태기계를 건드리지 않습니다).
    expect(store.getState().machine.answerId).toBe("ans-live-001");
    expect(store.getState().machine.note).toBe("detail");
  });

  it("빈 글과 공백뿐인 글은 보내지 않는다", () => {
    const { bench, parentId } = opened();
    bench.store.askTyped(parentId, "   ");
    bench.store.askTyped(parentId, "");
    expect(bench.asks).toHaveLength(1);
    expect(threadsOf(bench.store, parentId)).toHaveLength(0);
  });

  it("후속 답이 오면 그 줄만 답이 되고 본 답은 그대로다", () => {
    const { bench, parentId } = opened();
    const { store } = bench;
    store.askTyped(parentId, "그럼 언제 써요?");
    const followId = "q-2026-09-02-p9-xtesttok0-002";
    store.pushEvent(
      event("ev-x-101", 12, "answer.completed", {
        questionId: followId,
        answerId: "ans-live-002",
        evidence: "confirmed",
        provider: "mock",
        answer: answerBody("ans-live-002", followId, "테스트에서 직접 만들 때는 그대로 써요", 12),
      }),
    );
    const threads = threadsOf(store, parentId);
    expect(threads[0]).toMatchObject({ loading: false, conclusion: "테스트에서 직접 만들 때는 그대로 써요" });
    expect(threads[0]?.evidence.length).toBeGreaterThan(0);
    expect(store.getState().machine.answerId).toBe("ans-live-001");
  });

  it("후속 답이 60초 안 오면 그 줄만 멈춤 안내가 된다", () => {
    const { bench, parentId } = opened();
    bench.store.askTyped(parentId, "그럼 언제 써요?");
    bench.tickAt(75);
    const threads = threadsOf(bench.store, parentId);
    expect(threads[0]?.failure).toBe(ASK_TIMEOUT_MESSAGE);
    expect(threads[0]?.loading).toBe(false);
    // 본 답은 멈추지 않았습니다.
    expect(bench.store.getState().machine.note).toBe("detail");
  });

  it("멈춘 뒤 answer.queued 가 뒤따라도 멈춤 안내가 그대로 남는다", () => {
    const { bench, parentId } = opened();
    const { store } = bench;
    store.askTyped(parentId, "그럼 언제 써요?");
    const followId = "q-2026-09-02-p9-xtesttok0-002";
    // 계약의 멈춤 흐름입니다 — answer.failed 1초 뒤에 answer.queued 가 옵니다.
    store.pushEvent(
      event("ev-x-102", 20, "answer.failed", {
        questionId: followId,
        provider: "mock",
        message: ASK_TIMEOUT_MESSAGE,
      }),
    );
    store.pushEvent(
      event("ev-x-103", 21, "answer.queued", { questionId: followId, answerId: "ans-live-002-queued" }),
    );
    expect(threadsOf(store, parentId)[0]).toMatchObject({ loading: false, failure: ASK_TIMEOUT_MESSAGE });
    // 시계를 한참 밀어도 "답을 만들고 있어요" 로 되돌아가지 않습니다.
    bench.tickAt(200);
    expect(threadsOf(store, parentId)[0]).toMatchObject({ loading: false, failure: ASK_TIMEOUT_MESSAGE });
  });

  it("멈춘 적 없이 answer.queued 만 오면 그때부터 60초를 다시 센다", () => {
    const { bench, parentId } = opened();
    const { store } = bench;
    store.askTyped(parentId, "그럼 언제 써요?");
    const followId = "q-2026-09-02-p9-xtesttok0-002";
    store.pushEvent(
      event("ev-x-104", 30, "answer.queued", { questionId: followId, answerId: "ans-live-002-queued" }),
    );
    // 물어본 지 60초는 지났지만 줄 세운 뒤로는 50초입니다.
    bench.tickAt(80);
    expect(threadsOf(store, parentId)[0]).toMatchObject({ loading: true, failure: null });
    // 줄 세운 뒤 65초 — 이제는 멈춘 것으로 봅니다.
    bench.tickAt(95);
    expect(threadsOf(store, parentId)[0]).toMatchObject({ loading: false, failure: ASK_TIMEOUT_MESSAGE });
  });

  it("여러 번 이어 물을 수 있고 순서대로 쌓인다", () => {
    const { bench, parentId } = opened();
    bench.store.askTyped(parentId, "첫 번째 질문이에요");
    bench.store.askTyped(parentId, "두 번째 질문이에요");
    expect(threadsOf(bench.store, parentId).map((item) => item.question)).toEqual([
      "첫 번째 질문이에요",
      "두 번째 질문이에요",
    ]);
  });

  it("이어 물은 question.asked 를 밖으로 흘린다", () => {
    const { bench, parentId } = opened();
    const seen: SessionEvent[] = [];
    bench.store.subscribeEmitted((item) => seen.push(item));
    bench.store.askTyped(parentId, "그럼 언제 써요?");
    const asked = seen.find((item) => item.type === "question.asked");
    expect(asked?.payload["kind"]).toBe("free");
    expect((asked?.payload["question"] as { text?: string } | undefined)?.text).toBe("그럼 언제 써요?");
  });
});

describe("후속 칩", () => {
  function withChips(): { bench: Rig; parentId: string } {
    const bench = rig();
    bench.store.pushSegment(segment(1, "객체를 직접 new로 만들면 강하게 묶여요", 5));
    bench.store.catchTerm("ts-live-001", 1, "new");
    const parentId = bench.store.getState().machine.questionId ?? "";
    bench.store.pushEvent(
      event("ev-x-110", 8, "answer.completed", {
        questionId: parentId,
        answerId: "ans-live-001",
        evidence: "confirmed",
        provider: "mock",
        answer: {
          ...answerBody("ans-live-001", parentId, "짧은 결론이에요", 8),
          chips: ["enableAspectJAutoProxy가 정확히 뭘 켜는 거예요?", "AOP 프록시가 왜 필요해요?"],
        },
      }),
    );
    bench.store.openDetail();
    return { bench, parentId };
  }

  function detailOf(store: ReplayStore, questionId: string) {
    const state = store.getState();
    return detailViewFor(store.bundle, state, store.lines(state.now), questionId);
  }

  it("모델이 준 칩이 자세히 화면의 후속 칩으로 함께 보인다", () => {
    const { bench, parentId } = withChips();
    const labels = detailOf(bench.store, parentId)?.followUps.map((item) => item.label) ?? [];
    expect(labels).toEqual([
      "더 쉽게",
      "왜 필요한데?",
      "방금 내용",
      "enableAspectJAutoProxy가 정확히 뭘 켜는 거예요?",
      "AOP 프록시가 왜 필요해요?",
    ]);
  });

  it("더 쉽게와 왜 필요한데? 는 진짜 질문을 보내고 기다리는 줄을 남긴다", () => {
    const { bench, parentId } = withChips();
    bench.store.followUp(parentId, "easier");
    expect(bench.asks[1]?.question).toBe(
      '앞선 답은 "짧은 결론이에요" 이었어요. 이어서 물어요 — 방금 답을 더 쉽게 다시 설명해 주세요',
    );
    bench.store.followUp(parentId, "why");
    expect(bench.asks[2]?.question).toContain("이게 왜 필요한지 지금 수업 맥락에서");
    const view = detailOf(bench.store, parentId);
    expect(view?.threads.map((item) => item.question)).toEqual(["더 쉽게", "왜 필요한데?"]);
    expect(view?.threads.every((item) => item.loading)).toBe(true);
    // 예전처럼 결론을 다시 붙이는 고정 문구는 남기지 않습니다.
    expect(view?.reply).toBeNull();
  });

  it("모델 칩을 누르면 그 문장을 그대로 묻는다", () => {
    const { bench, parentId } = withChips();
    bench.store.followUp(parentId, `${MODEL_CHIP_PREFIX}0`);
    expect(bench.asks[1]?.question).toContain("enableAspectJAutoProxy가 정확히 뭘 켜는 거예요?");
    expect(detailOf(bench.store, parentId)?.threads[0]?.question).toBe(
      "enableAspectJAutoProxy가 정확히 뭘 켜는 거예요?",
    );
  });

  it("방금 내용은 밖에 묻지 않고 전사 마지막 문장으로 답한다", () => {
    const { bench, parentId } = withChips();
    bench.store.pushSegment(segment(2, "이제 생성자 주입으로 넘어갑니다", 9));
    bench.store.followUp(parentId, "recent");
    expect(bench.asks).toHaveLength(1);
    expect(bench.store.getState().reply?.a).toBe("선생님은 지금 이제 생성자 주입으로 넘어갑니다");
  });
});

describe("이어 물은 질문의 되밀기", () => {
  it("호스트가 후속 question.asked 를 되밀어도 붙잡은 순간이 늘지 않고 자세히가 그대로다", () => {
    const bench = rig();
    const { store } = bench;
    store.pushSegment(segment(1, "객체를 직접 new로 만들면 강하게 묶여요", 5));
    store.catchTerm("ts-live-001", 1, "new");
    const parentId = store.getState().machine.questionId ?? "";
    store.pushEvent(
      event("ev-x-120", 8, "answer.completed", {
        questionId: parentId,
        answerId: "ans-live-001",
        evidence: "confirmed",
        provider: "mock",
        answer: answerBody("ans-live-001", parentId, "짧은 결론이에요", 8),
      }),
    );
    store.openDetail();
    store.askTyped(parentId, "그럼 언제 써요?");
    const followId = "q-2026-09-02-p9-xtesttok0-002";

    // 도우미가 tutor.ask 를 받고 자기 기록본을 되밉니다(사건 id 가 다릅니다).
    store.pushEvent(
      event("ev-host-0100", 9, "question.asked", {
        questionId: followId,
        kind: "free",
        question: {
          id: followId,
          periodId: PERIOD,
          askedAt: at(9),
          kind: "free",
          text: "그럼 언제 써요?",
          snapshot: {
            transcriptSegmentIds: ["ts-live-001"],
            ages: { transcriptSec: 4, screenSec: null, editorSec: null },
          },
        },
      }),
    );

    const state = store.getState();
    // 후속은 붙잡은 순간이 아닙니다 — 바닥줄 "기록 N" 과 기록 화면이 늘지 않습니다.
    expect(state.moments).toHaveLength(1);
    expect(home(store).footer.count).toBe(1);
    // 자세히 화면도 그대로입니다(기계가 준비 중으로 되돌아가지 않습니다).
    expect(state.machine.questionId).toBe(parentId);
    expect(state.machine.note).toBe("detail");
    expect(state.received.some((item) => item.id === "ev-host-0100")).toBe(true);
  });
});
