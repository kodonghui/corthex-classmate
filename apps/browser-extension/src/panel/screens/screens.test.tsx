// 네 화면이 체크포인트의 값으로 정본 클래스·문구를 실제로 그리는지 봅니다.
// DOM 없이 renderToStaticMarkup 으로 HTML 문자열을 만들어 확인합니다(새 의존성 없음).

import type { TranscriptSegment } from "@classmate/contracts";
import { formatIso, parseIso } from "@classmate/tutor-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GOLDEN_BUNDLE } from "../golden-bundle";
import { historyView } from "../history-view";
import { detailView, detailViewFor, listeningView } from "../lesson-view";
import { type Checkpoint, ReplayStore } from "../replay-store";
import { DEFAULT_SETTINGS } from "../settings-store";
import { DetailScreen } from "./DetailScreen";
import { HistoryScreen } from "./HistoryScreen";
import { ListeningScreen } from "./ListeningScreen";
import { SettingsScreen } from "./SettingsScreen";

const noop = (): void => {};

function homeHtml(checkpoint: Checkpoint): string {
  const store = new ReplayStore(GOLDEN_BUNDLE);
  store.goto(checkpoint);
  return renderHome(store);
}

/** 스토어가 지금 어느 자리에 있든 그대로 듣는 중 화면을 그립니다. */
function renderHome(store: ReplayStore): string {
  const state = store.getState();
  const view = listeningView(GOLDEN_BUNDLE, state, store.lines(state.now));
  return renderToStaticMarkup(
    <ListeningScreen
      view={view}
      onTerm={noop}
      onSentence={noop}
      onGuess={noop}
      onChip={noop}
      onDetail={noop}
      onExpand={noop}
      onSettings={noop}
      onHistory={noop}
      onReconnect={noop}
      onAsk={noop}
    />,
  );
}

/**
 * 라이브 듣는 중 화면의 HTML 입니다. 재생과 달리 아래 약 1/3 이 **대화 칸**입니다.
 * fixture 를 쓰지 않으므로 전사 한 줄을 직접 넣어 세웁니다.
 */
function liveHomeHtml(): string {
  const periodId = "2026-09-02-p3";
  const startMs = parseIso("2026-09-02T10:00:00+09:00");
  const store = ReplayStore.live({ periodId, startMs, idToken: "asktoken", now: () => startMs });
  const segment: TranscriptSegment = {
    id: "ts-live-001",
    periodId,
    seq: 1,
    text: "객체를 직접 만들면 바꾸기 어려워요",
    state: "final",
    arrivedAt: formatIso(startMs + 1_000),
    source: "tiro-share",
  };
  store.pushSegment(segment);
  const state = store.getState();
  const view = listeningView(store.bundle, state, store.lines(state.now));
  return renderToStaticMarkup(
    <ListeningScreen
      view={view}
      onTerm={noop}
      onSentence={noop}
      onGuess={noop}
      onChip={noop}
      onDetail={noop}
      onExpand={noop}
      onSettings={noop}
      onHistory={noop}
      onReconnect={noop}
      onAsk={noop}
    />,
  );
}

/**
 * 라이브 화면을 세우고 손짓을 준 뒤 HTML 을 냅니다.
 *
 * `liveHomeHtml` 과 달리 스토어를 밖으로 함께 내주어, 조각을 밀거나 문단을 붙잡는 시험이
 * 같은 스토어를 그대로 쓸 수 있게 합니다.
 */
function liveScreen(drive: (store: ReplayStore) => void): string {
  const periodId = "2026-09-02-p3";
  const startMs = parseIso("2026-09-02T10:00:00+09:00");
  const store = ReplayStore.live({ periodId, startMs, idToken: "asktoken", now: () => startMs });
  const lines: TranscriptSegment[] = [
    {
      id: "ts-live-001",
      periodId,
      seq: 1,
      text: "객체를 직접 new로 만들면 바꾸기 어려워요",
      state: "final",
      arrivedAt: formatIso(startMs + 1_000),
      source: "tiro-share",
    },
    {
      id: "ts-live-002",
      periodId,
      seq: 2,
      text: "context.getBean 으로 꺼내 씁니다",
      state: "final",
      arrivedAt: formatIso(startMs + 2_000),
      source: "tiro-share",
    },
  ];
  for (const line of lines) store.pushSegment(line);
  drive(store);
  const state = store.getState();
  const view = listeningView(store.bundle, state, store.lines(state.now), true);
  const details = state.moments.flatMap((m) => { const d = detailViewFor(store.bundle, state, store.lines(state.now), m.questionId); return d ? [d] : []; });
  return renderToStaticMarkup(
    <ListeningScreen
      inlineDetails={details}
      activeQuestionId={state.machine.questionId}
      onAskAt={noop}
      onFollowUpAt={noop}
      view={view}
      onTerm={noop}
      onSentence={noop}
      onGuess={noop}
      onChip={noop}
      onDetail={noop}
      onExpand={noop}
      onSettings={noop}
      onHistory={noop}
      onReconnect={noop}
      onAsk={noop}
    />,
  );
}

function detailHtml(checkpoint: Checkpoint, followUp?: string): string {
  const store = new ReplayStore(GOLDEN_BUNDLE);
  store.goto(checkpoint);
  if (followUp !== undefined) store.followUp(store.getState().machine.questionId ?? "", followUp);
  const state = store.getState();
  const view = detailView(GOLDEN_BUNDLE, state, store.lines(state.now));
  if (view === null) throw new Error("붙잡은 순간이 없어요");
  return renderToStaticMarkup(<DetailScreen view={view} onBack={noop} onFollowUp={noop} onAsk={noop} />);
}

function historyHtml(checkpoint: Checkpoint): string {
  const store = new ReplayStore(GOLDEN_BUNDLE);
  store.goto(checkpoint);
  const view = historyView(GOLDEN_BUNDLE, store.getState());
  return renderToStaticMarkup(<HistoryScreen view={view} onBack={noop} onOpen={noop} />);
}

function settingsHtml(releaseIdentity?: string | null): string {
  return renderToStaticMarkup(
    <SettingsScreen
      values={DEFAULT_SETTINGS}
      count={2}
      releaseIdentity={releaseIdentity}
      onBack={noop}
      onChange={noop}
      onClearToday={noop}
    />,
  );
}

describe("듣는 중 화면", () => {
  it("A 듣는 중: 헤더 · 다섯 줄 · 점선 new · 팁 · 바닥줄, 메모와 행동 버튼은 없다", () => {
    const html = homeHtml("listening");
    expect(html).toContain("IoC 컨테이너와 의존성 주입");
    expect(html).toContain("3교시");
    expect(html).toContain("10:32:16");
    expect(html).toContain("cm-tf__term");
    expect(html).toContain("걸리는 말을 누르세요");
    expect(html).toContain("2초 전");
    expect(html).not.toContain("cm-note");
    // 정본이 말하는 "이 화면에 버튼은 없습니다" 는 **채도 있는 행동 블록(.cm-btn)** 이 없다는 뜻입니다.
    // 헤더의 설정 아이콘 하나(prompt §4 "듣는 중 화면엔 설정 아이콘 하나", dc.html:392 settingsAction)와
    // 바닥줄의 "기록 N"(dc.html:398 onCount) 은 정본에도 있는 <button> 입니다.
    expect(html).not.toContain("cm-btn");
    expect(html).toContain('aria-label="설정"');
    expect(html).toContain("cm-sf__r");
  });

  it("라이브: 전사 아래에 대화 칸이 늘 서 있고 글 칸은 처음부터 열려 있다", () => {
    const html = liveHomeHtml();
    // 전사와 답변은 하나의 읽기 영역이며 입력기는 아래에 남습니다.
    expect(html).toContain("cm-lecture__scroll");
    expect(html).not.toContain("cm-chat__log");
    expect(html).toContain("cm-study__composer");
    // 누르는 동작 없이 글 칸이 이미 있습니다 — 접힌 줄은 이제 없습니다.
    expect(html).toContain("<textarea");
    expect(html).toContain("지금 궁금한 걸 적어 주세요");
    expect(html).toContain('aria-label="바로 묻기"');
    expect(html).toContain("보내기");
    expect(html).not.toContain("궁금한 건 여기에 바로 물어보세요");
    // 아직 물은 것이 없으면 이 칸이 무엇을 하는 자리인지 한 줄로 말합니다.
    expect(html).toContain("수업 · 질문과 함께 읽기");
    expect(html).not.toContain('role="separator"');
    // 자세히 화면 같은 고정 바닥바를 만들지는 않습니다.
    expect(html).not.toContain("cm-screen__bar");
    // 안내 글과 Alt+S 는 전사 칸 맨 아래에 그대로 남습니다.
    expect(html).toContain("문장이나 단어를 눌러 질문");
    expect(html).toContain("그림 요청");
    // 듣는 중 화면의 "행동 버튼은 없다" 규칙은 라이브에서도 같습니다.
    expect(html).not.toContain("cm-btn");
  });

  it("답을 기다리는 동안 자라는 결론이 대기 자리에 보인다", () => {
    const html = liveScreen((store) => {
      store.catchTerm("ts-live-001", 1, "new");
      const questionId = store.getState().machine.questionId ?? "";
      store.pushDelta({ questionId, seq: 1, chars: 21, text: "생성 책임을 컨테이너에" });
    });

    // 대기 자리(cm-note__wait)에 그립니다. 다 쓴 답 자리(cm-note__c)가 아닙니다.
    expect(html).toContain("cm-ans__load");
    expect(html).toContain("생성 책임을 컨테이너에");
    expect(html).not.toContain("cm-note__c");
    // 아직 완성이 아니라는 표시 — 깜빡이는 커서와 쓸어내리는 띠.
    expect(html).toContain("cm-ans__load-t");
    expect(html).toContain("cm-ans__sweep");
    // 완성된 답의 자리(근거·칩·자세히 보기)는 아직 열리지 않습니다.
    expect(html).not.toContain("자세히 보기");
  });

  it("결론 글자가 아직 없으면 받은 글자 수가 자라는 것으로 오는 중을 말한다", () => {
    const html = liveScreen((store) => {
      store.catchTerm("ts-live-001", 1, "new");
      const questionId = store.getState().machine.questionId ?? "";
      store.pushDelta({ questionId, seq: 0, chars: 128 });
    });

    expect(html).toContain("128자");
    // 메모 안에서는 MarginNote 가 이미 띠를 그리므로 그 띠 하나만 돕니다(둘이 겹치지 않습니다).
    expect(html).toContain("cm-ans__sweep");
    expect(html).not.toContain("cm-stream__sweep");
  });

  it("대화 칸에 적어 물은 줄에도 자라는 결론이 붙는다", () => {
    const html = liveScreen((store) => {
      store.askTyped("2026-09-02-p3", "지금 이거 왜 필요해요?");
      const asked = store.getState().threads["2026-09-02-p3"]?.[0]?.id ?? "";
      store.pushDelta({ questionId: asked, seq: 0, chars: 40, text: "갈아 끼우기 쉬워져요" });
    });

    expect(html).toContain("cm-stream");
    expect(html).toContain("갈아 끼우기 쉬워져요");
    // 다 쓴 답의 자리(cm-reply__a)로 올라가지 않습니다.
    expect(html).not.toContain("cm-reply__a");
  });

  it("대화 답변은 40자 결론 뒤에 상세 설명의 마지막 문단까지 펼쳐 보인다", () => {
    const html = liveScreen((store) => {
      store.askTyped("2026-09-02-p3", "스프링이 왜 필요한가요?");
      const questionId = store.getState().threads["2026-09-02-p3"]?.[0]?.id ?? "";
      const template = Object.values(GOLDEN_BUNDLE.answers)[0]!;
      store.pushEvent({
        id: "ev-chat-body", periodId: "2026-09-02-p3", at: "2026-09-02T10:00:04+09:00",
        type: "answer.completed",
        payload: { questionId, answerId: "a-chat-body", answer: {
          ...template, id: "a-chat-body", questionId,
          conclusion: "객체를 연결해 줘요",
          details: { why: "첫 문단: 객체는 일을 하는 부품이에요.\n\n마지막 문단: 부품을 교체하기 쉬워져요. <script>danger</script>" },
        } },
      });
    });
    expect(html).toContain("cm-reply__body");
    expect(html).toContain("마지막 문단: 부품을 교체하기 쉬워져요.");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>danger</script>");
  });

  it("답을 기다리는 중에 문단을 누르면 짐작 목록이 앞 질문의 메모와 함께 보인다", () => {
    const html = liveScreen((store) => {
      store.catchTerm("ts-live-001", 1, "new");
      store.catchSentence("ts-live-002");
    });

    // 앞 질문의 대기 메모가 남아 있고,
    expect(html).toContain("cm-ans__load");
    // 방금 누른 문단의 짐작 목록도 함께 보입니다(예전에는 이것이 아예 안 나왔습니다).
    expect(html).toContain("cm-gl");
    expect(html).toContain("혹시 이게 막혔나요?");
    expect(html).toContain("context.getBean 가 뭔지");
  });

  it("재생에는 대화 칸을 아예 만들지 않는다 — 골든 9장면이 걸려 있습니다", () => {
    const html = homeHtml("listening");
    expect(html).not.toContain("cm-chat");
    expect(html).not.toContain('role="separator"');
    expect(html).not.toContain("cm-input");
  });

  it("H-1 전사 멈춤: 바닥줄이 호박색이고 다시 연결이 붙는다", () => {
    // 골든 fixture 의 connector.status 세 줄은 전부 connected 라, 멈춘 형편은 사건 하나를 더 넣어 만듭니다.
    // 넣는 값은 계약 connector.status 의 connector·state 두 칸뿐입니다.
    const store = new ReplayStore(GOLDEN_BUNDLE);
    store.goto("listening");
    store.pushEvent({
      id: "ev-test-tiro-paused",
      periodId: GOLDEN_BUNDLE.periodId,
      at: "2026-09-02T10:32:16+09:00",
      type: "connector.status",
      payload: { connector: "tiro-share", state: "paused" },
    });
    const state = store.getState();
    const view = listeningView(GOLDEN_BUNDLE, state, store.lines(state.now));
    expect(view.tiroPaused).toBe(true);
    expect(view.header.status).toBe("paused");
    expect(view.footer.warn?.reconnect).toBe("tiro-share");
    const html = renderToStaticMarkup(
      <ListeningScreen
        view={view}
        onTerm={noop}
        onSentence={noop}
        onGuess={noop}
        onChip={noop}
        onDetail={noop}
        onExpand={noop}
        onSettings={noop}
        onHistory={noop}
        onReconnect={noop}
        onAsk={noop}
      />,
    );
    expect(html).toContain("cm-sf--paused");
    expect(html).toContain("전사가 잠시 멈췄어요.");
    expect(html).toContain("화면과 코드는 계속 기록하고 있어요.");
    expect(html).toContain("다시 연결");
    expect(html).toContain("전사가 멈춘 동안에도");
  });

  it("B 붙잡은 직후: 메모가 준비 중이고 세 자료가 compact 로 붙는다", () => {
    const html = homeHtml("caught");
    expect(html).toContain("cm-note");
    expect(html).toContain("한 줄로 정리하고 있어요");
    expect(html).toContain("cm-src--compact");
    expect(html).toContain("전사 4초 전");
    expect(html).toContain("cm-tf__term--on");
  });

  it("D 문장을 붙잡음: 혹시 이게 막혔나요? 와 짐작", () => {
    const html = homeHtml("sentence");
    expect(html).toContain("혹시 이게 막혔나요?");
    expect(html).toContain("생성 책임이 무슨 뜻인지");
  });

  it("C 한 줄 답변: 결론 · 확인됨 · 칩 · 자세히 보기 · N초 뒤 접혀요 · 지금 줄", () => {
    const html = homeHtml("answer");
    expect(html).toContain("new 자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요");
    expect(html).toContain("확인됨");
    expect(html).toContain("더 쉽게");
    expect(html).toContain("자세히 보기");
    expect(html).toContain("17초 뒤 접혀요 · 기록에 남아요");
    expect(html).toContain("지금 · 생성자 주입 코드로 넘어갔어요");
  });

  it("C 한 줄 답변: 결론 바로 아래에 답 본문 첫 문단이 그 자리에 있다 (U-33)", () => {
    const html = homeHtml("answer");
    expect(html).toContain("cm-note__b");
    // 「자세히 보기」를 눌러야 나오던 details.why 입니다. 한 줄 결론만으로는 도움이 안 됩니다.
    expect(html).toContain("new 로 직접 만들면 어떤 구현을 쓸지가 클래스 안에 박혀요.");
    // 길은 남습니다 — 나머지 절(내 코드와 비교 · 선생님이 말한 부분)로 가는 문입니다.
    expect(html).toContain("자세히 보기");
  });

  it("여러 질문은 각각 원 전사 문단 아래에 남는다", () => {
    const html = liveScreen((store) => {
      store.catchTerm("ts-live-001", 1, "new");
      store.catchTerm("ts-live-002", 0, "context.getBean");
    });
    // 밀려난 앞 질문은 그 줄 옆에서 답을 기다립니다.
    expect(html.match(/data-question-id=/g)).toHaveLength(2);
    expect(html.match(/data-source-line-id=/g)).toHaveLength(2);
    expect(html).toContain("한 줄로 정리하고 있어요");
    // 대화 칸에는 그 질문 줄이 생기지 않습니다(옛 자리에서는 이 글이 떴습니다).
    expect(html).not.toContain("new 이 무슨 뜻이에요?");
  });

  it("답이 떠 있는 채로 문장을 다시 붙잡아도 짐작 목록이 그려진다 (U-10)", () => {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    store.goto("answer");
    const last = store.lines().at(-1);
    if (last === undefined) throw new Error("전사 줄이 하나는 있어야 해요");
    store.catchSentence(last.id);
    const html = renderHome(store);
    expect(html).toContain("혹시 이게 막혔나요?");
  });

  it("E 접힌 메모: cm-note--collapsed 한 줄", () => {
    const html = homeHtml("folded");
    expect(html).toContain("cm-note--collapsed");
    expect(html).toContain("new");
  });

  it("H 튜터 멈춤: 메모는 warn 이고 바닥줄이 호박색 안내를 보인다", () => {
    const html = homeHtml("waiting");
    expect(html).toContain("cm-note--warn");
    expect(html).toContain("튜터가 돌아오면 여기에 한 줄이 나타나요 · 순간은 저장됐어요");
    expect(html).toContain("튜터 답변이 잠시 멈췄어요.");
    expect(html).toContain("수업 기록과 질문 지점은 계속 저장하고 있어요.");
  });

  it("복구: 되살아난 결론과 일부 확인", () => {
    const html = homeHtml("recovered");
    expect(html).toContain("생성자로 받으면 바깥에서 구현을 갈아 끼울 수 있어요");
    expect(html).toContain("일부 확인");
  });
});

describe("자세히 화면", () => {
  it("F 자세히: 낱말 제목 · 붙잡음 시각 · 절 4종 · 후속 칩 · 돌아가기", () => {
    const html = detailHtml("detail");
    expect(html).toContain("10:32:18 붙잡음");
    expect(html).toContain("cm-ans__con");
    expect(html).toContain("설명");
    expect(html).toContain("내 코드와 비교");
    expect(html).toContain("선생님 화면 코드");
    expect(html).toContain("선생님이 말한 부분");
    expect(html).toContain("수업으로 돌아가기");
    expect(html).toContain("선생님은 지금 생성자 주입 코드로 넘어갔어요");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });

  it("후속 칩의 답은 cm-reply 로 붙고 추론 표시가 달린다", () => {
    const html = detailHtml("detail", "why");
    expect(html).toContain("cm-reply__q");
    expect(html).toContain("왜 필요한데?");
    expect(html).toContain("수업 자료에서 확인한 내용이에요");
  });

  it("튜터가 멈춘 동안의 자세히는 loading 카드다", () => {
    const html = detailHtml("waiting");
    expect(html).toContain("튜터 답변이 잠시 멈췄어요");
    expect(html).toContain("다시 질문");
  });

  it("기록에서 연 지난 순간도 같은 자세히 화면으로 그려진다", () => {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    store.goto("recovered");
    const state = store.getState();
    const first = state.moments[0];
    if (first === undefined) throw new Error("붙잡은 순간이 없어요");
    const view = detailViewFor(GOLDEN_BUNDLE, state, store.lines(state.now), first.questionId);
    if (view === null) throw new Error("그 순간의 자세히를 만들지 못했어요");
    // 지금 보고 있는 질문은 두 번째(q-p3-002)라 첫 순간은 "지난 순간" 입니다.
    expect(view.term).toBe("new");
    expect(view.conclusion).toBe("new 자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요");
    expect(view.loading).toBe(false);
    // 후속 칩은 상태기계가 든 답으로 대답하므로 지난 순간에는 붙이지 않습니다.
    expect(view.followUps).toHaveLength(0);
    const html = renderToStaticMarkup(<DetailScreen view={view} onBack={noop} onFollowUp={noop} onAsk={noop} />);
    expect(html).toContain("10:32:18 붙잡음");
    expect(html).toContain("수업으로 돌아가기");
  });
});

describe("기록 화면", () => {
  it("G 기록: 오늘 N개 · 교시 묶음 · MomentRow · 바닥 안내 · 기록 중", () => {
    const html = historyHtml("answer");
    expect(html).toContain("기록");
    expect(html).toContain("오늘 1개");
    expect(html).toContain("cm-group__label");
    expect(html).toContain("3교시");
    expect(html).toContain("cm-rows");
    expect(html).toContain("cm-mo");
    expect(html).toContain("10:32:18");
    expect(html).toContain("new 자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요");
    expect(html).toContain("cm-foot-note");
    expect(html).toContain("붙잡은 순간은 수업이 끝나도 남아요. 지우기는 설정에서.");
    expect(html).toContain("전사 기록 중 · 화면 기록 중 · IntelliJ 기록 중");
    // 정본 G: 카드도 화살표도 없습니다.
    expect(html).not.toContain("cm-card");
  });

  it("아직 붙잡은 것이 없으면 교시 묶음 안에 한 줄만 남는다", () => {
    const html = historyHtml("listening");
    expect(html).toContain("오늘 0개");
    expect(html).toContain("아직 붙잡은 순간이 없어요");
    expect(html).not.toContain("cm-mo ");
  });

  it("답이 아직 오지 않은 순간은 정리 중으로 남는다", () => {
    const html = historyHtml("caught");
    expect(html).toContain("cm-mo--preparing");
    expect(html).toContain("정리 중");
  });
});

describe("설정 화면", () => {
  it("사용 목적 · 개인정보 세 칸 · 제공자 고르기 · 오늘 기록 지우기", () => {
    const html = settingsHtml();
    expect(html).toContain("설정");
    // (a) 답변
    expect(html).toContain("한 줄만 먼저");
    expect(html).toContain("자세한 내용은 눌러서 봐요");
    expect(html).toContain("바로 자세히");
    expect(html).toContain("18초 뒤 자동으로 접기");
    expect(html).toContain("끄면 접히지 않고 그대로 남아요");
    // 정본에 없는 자리(2라운드 고정 계약): 제공자 · codex 는 잠겨 있습니다.
    expect(html).toContain("답변을 만드는 곳");
    expect(html).toContain("Claude");
    expect(html).toContain("Codex");
    expect(html).toContain("한도 복구 뒤에 고를 수 있어요");
    expect(html).toContain("cm-radio--disabled");
    // (b) 붙잡을 때 함께 저장 + 개인정보 세 칸(불변 원칙 §5 정본 문구)
    expect(html).toContain("붙잡을 때 함께 저장");
    expect(html).toContain("막힌 시점의 최근 30초");
    expect(html).toContain("선택한 화면 탭에서 붙잡은 한 장");
    expect(html).toContain("지금 보고 있는 파일");
    expect(html).toContain("cm-set__privacy");
    expect(html).toContain("로컬 보관");
    expect(html).toContain("선택한 AI 제공자로 전송될 수 있음");
    expect(html).toContain("Corthex 서버 기본 전송 없음");
    // (c) 세션 — 프로필 셋과 중립적인 기록 슬롯 문구
    expect(html).toContain("사용 목적");
    expect(html).toContain("수업");
    expect(html).toContain("시험 공부");
    expect(html).toContain("회의");
    expect(html).toContain("기록 슬롯");
    expect(html).toContain("8번");
    expect(html).toContain("주제");
    expect(html).toContain("단축키 Alt+S");
    expect(html).toContain("마지막 문장을 붙잡아요");
    expect(html).toContain("사용 목적·기록 슬롯·주제는 다음에 패널을 열어 새 세션을 시작할 때 적용돼요");
    expect(html).toContain("진행 중 기록은 바뀌지 않아요");
    // (d) 위험
    expect(html).toContain("오늘 기록 지우기");
    expect(html).toContain("cm-btn--danger");
    // 확인 창은 누르기 전까지 그리지 않습니다.
    expect(html).not.toContain("오늘 기록을 지울까요");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });

  it("현재 설치 빌드를 앱 정보에 텍스트로만 표시합니다", () => {
    const html = settingsHtml('0.0.3+gabcdef12.dirty');
    expect(html).toContain('앱 정보');
    expect(html).toContain('설치 빌드');
    expect(html).toContain('0.0.3+gabcdef12.dirty');

    const escaped = settingsHtml('<img src=x onerror="PRIVATE_CANARY">');
    expect(escaped).toContain('&lt;img src=x onerror=&quot;PRIVATE_CANARY&quot;&gt;');
    expect(escaped).not.toContain('<img src=x');
    expect(settingsHtml()).toContain('확인할 수 없음');
  });
});
