// 듣는 중 화면 — 선생님 말이 위에서 흐르고, 아래 약 1/3 은 **늘 열려 있는 대화 칸**입니다.
// 정본: design-system/ui_kits/sidepanel/ListeningScreen.jsx. 값은 전부 lesson-view 가 만들어 줍니다.
//
// 라이브 배치(단위 A "대화창을 항상 띄웁니다"):
//
//   ┌───────────────────────────┐
//   │ 머리글 (과목 · 교시 · 시각) │  PanelHeader
//   ├───────────────────────────┤
//   │                           │
//   │ 전사 — 남는 자리를 다 씀    │  .cm-screen__body--flow   ← 혼자 구릅니다
//   │                           │
//   ├───────────────────────────┤  .cm-chat__grip  ← 끌어서 비율을 바꿉니다
//   │ 대화 — 지난 문답이 쌓임     │  .cm-chat__log            ← 혼자 구릅니다
//   │ [ 지금 궁금한 걸 적어요  ↑]│  .cm-chat__bar            ← 언제나 열려 있습니다
//   ├───────────────────────────┤
//   │ 바닥줄 (전사 · 화면 · …)   │  SourceFooter
//   └───────────────────────────┘
//
// 왜 바꿨나: 예전에는 안내 글 자리에 접힌 한 줄("궁금한 건 여기에 바로 물어보세요")을 두고
// **눌러야** 글 칸이 펼쳐졌습니다. 수업을 들으며 급히 물어야 하는데 누르는 동작이 하나 더
// 있었습니다(2026-09-03 "이거 눌러야 대화창 나오잖아 … 1/3은 대화 전용으로"). 이제 칸은 늘
// 열려 있고 지난 문답도 한 줄만 남기지 않고 대화 칸 안에 그대로 쌓입니다.
//
// 두 칸의 스크롤은 **서로 독립**입니다. 각자 자기 상자를 구르고(`overflow-y: auto`),
// 끝에 닿아도 옆 칸으로 넘겨주지 않습니다(`overscroll-behavior: contain`, style.css).
//
// 두 칸 모두 바닥에 붙어 따라 내려갑니다. 그 규칙은 이 파일에 없고 `use-stick-to-bottom.ts` 한
// 곳에 있습니다(자세히 화면도 같은 것을 씁니다). 예전에는 글을 쓰는 동안 전사 따라가기를 멈춰야
// 했는데 — 글 칸이 전사 상자 **안** 에 있었기 때문입니다 — 이제 대화 칸으로 나가서 그 사정이
// 사라졌습니다.
//
// 재생(`?replay=`)에는 물을 곳이 없어 대화 칸을 아예 만들지 않습니다(`view.canAsk`).
// 골든 9장면은 예전 그대로입니다 — 이 파일에서 재생이 지나는 길은 옛 길과 같습니다.

import { IconButton, Input, PanelHeader } from "@classmate/ui-base";
import type { FooterWarn } from "@classmate/ui-classmate";
import { GuessList, MarginNote, NowLine, SourceFooter, SourceStatus, TranscriptFlow } from "@classmate/ui-classmate";
import { useCallback, useEffect, useRef, useState } from "react";

import { MAX_ASK_QUESTION_BYTES, utf8ByteLength } from "../ask-text";
import type { DetailView, FooterWarnView, ListeningView } from "../lesson-view";
import type { ReconnectTarget } from "../ports";
import { FOLLOW_UP_WAITING_LINE } from "../replay-store";
import { useStickToBottom } from "../use-stick-to-bottom";
import { AnswerStream } from "./AnswerStream";
import { DetailScreen } from "./DetailScreen";
import { ClassroomScreen } from "./ClassroomScreen";

/** 밀려난 질문이 답을 기다리는 동안 그 줄 옆에 뜨는 글입니다(U-34). */
const CARRIED_WAITING = "기다리는 중 · 답이 오면 여기에 채워요";

/**
 * 한 줄 결론과 답 본문 첫 문단을 메모의 결론 칸 하나에 담습니다(U-33).
 *
 * MarginNote 의 `children` 은 헤더와 결론 **사이**라 여기에 본문을 넣으면 순서가 뒤집힙니다.
 * 새 prop 을 만들지 않고 결론 칸에 함께 실어, 접힘·칩·자세히 갈래를 지금 그대로 둡니다.
 */
function withBody(conclusion: React.ReactNode, body: string | null): React.ReactNode {
  if (body === null) return conclusion;
  return (
    <>
      {conclusion}
      <span className="cm-note__b">{body}</span>
    </>
  );
}

export interface ListeningScreenProps {
  readonly inlineDetails?: readonly DetailView[];
  readonly activeQuestionId?: string | null;
  readonly onAskAt?: (questionId: string, text: string) => void;
  readonly onFollowUpAt?: (questionId: string, followUpId: string) => void;
  readonly view: ListeningView;
  readonly onTerm: (lineId: string, segmentIndex: number, word: string) => void;
  readonly onSentence: (lineId: string) => void;
  readonly onGuess: (guessId: string) => void;
  readonly onChip: (chipId: string) => void;
  readonly onDetail: () => void;
  readonly onExpand: () => void;
  /** 헤더의 설정 아이콘. 이 화면의 아이콘은 이것 하나뿐입니다(정본 프롬프트 §4). */
  readonly onSettings: () => void;
  /** 바닥줄 "기록 N" 을 누르면 기록 화면으로 갑니다(정본 상태 G 의 유일한 입구). */
  readonly onHistory: () => void;
  /** 바닥줄 호박색 안내의 "다시 연결"(정본 상태 H-1). */
  readonly onReconnect: (connector: ReconnectTarget) => void;
  /** 대화 칸에 적어 물었습니다. 빈 글은 여기까지 오지 않습니다. */
  readonly onAsk: (text: string) => void;
}

/** 대화 칸 글 칸의 힌트 글입니다. */
const ASK_PLACEHOLDER = "지금 궁금한 걸 적어요";

/** 아직 아무것도 묻지 않았을 때 대화 칸에 두는 한 줄입니다. 이 칸이 무엇을 하는 자리인지 말합니다. */
const CHAT_EMPTY_LINE = "여기에 적어 물으면 답이 이 칸에 쌓여요";

/** 남은 바이트가 이보다 적을 때만 상한을 알립니다(자세히 화면과 같은 값). */
const HINT_BELOW_BYTES = 200;

/**
 * 전사 3/4, 대화 1/4을 기본으로 합니다. 조절 범위는 20~85%입니다.
 *
 * 비율로 다루는 까닭: 사이드패널 높이는 창 크기와 함께 늘 바뀝니다. px 로 못 박으면 낮은
 * 창에서는 전사가 사라지고 높은 창에서는 대화 칸이 우표만 해집니다.
 * 아래끝·위끝은 두 칸 중 하나가 사라지지 않게 하는 자리입니다. 여기에 더해
 * style.css 의 `min-height: min(180px, 45%)` 가 **픽셀 바닥**을 지킵니다 — 글 칸 한 줄(36px)과
 * 문답 두어 줄이 함께 보이는 최소 높이입니다.
 */
const DEFAULT_CHAT_RATIO = 0.25;
const MIN_CHAT_RATIO = 0.2;
const MAX_CHAT_RATIO = 0.85;

/** 경계를 키보드 화살표로 움직이는 폭입니다(한 번에 패널 높이의 5%). */
const RESIZE_STEP = 0.05;

/**
 * 위로 올려 읽는 동안 같은 문단이 길어지기만 했을 때 쓰는 말입니다. 셀 줄이 없어 개수를 못 씁니다.
 * (Tiro 는 한 문단을 자라게 보냅니다 — `use-stick-to-bottom.ts` 머리 주석을 보세요.)
 */
const CATCH_UP_GROWING_LINE = "새 말이 이어지는 중 · 눌러서 따라가기";

function Kbd({ children }: { readonly children: string }): React.JSX.Element {
  return <kbd className="cm-kbd">{children}</kbd>;
}

/** 안내에서 `reconnect` 를 떼어 내고 그 자리에 누를 손짓을 답니다. */
function warnProps(warn: FooterWarnView, onReconnect: (connector: ReconnectTarget) => void): FooterWarn {
  const { reconnect, ...rest } = warn;
  return reconnect === undefined ? rest : { ...rest, onAction: () => onReconnect(reconnect) };
}

/** 아래끝과 위끝 사이로 비율을 밀어 넣습니다. */
function clampRatio(ratio: number): number {
  return Math.min(MAX_CHAT_RATIO, Math.max(MIN_CHAT_RATIO, ratio));
}

export function ListeningScreen(props: ListeningScreenProps): React.JSX.Element {
  return props.view.canAsk ? <ClassroomScreen {...props} /> : <LegacyListeningScreen {...props} />;
}

/** Historical fixture playback keeps its original layout; live 0.1.0 uses ClassroomScreen. */
function LegacyListeningScreen({
  view,
  inlineDetails = [],
  activeQuestionId = null,
  onAskAt,
  onFollowUpAt,
  onTerm,
  onSentence,
  onGuess,
  onChip,
  onDetail,
  onExpand,
  onSettings,
  onHistory,
  onReconnect,
  onAsk,
}: ListeningScreenProps): React.JSX.Element {
  const inline = (questionId: string): React.ReactNode => {
    const detail = inlineDetails.find((item) => item.questionId === questionId);
    if (detail === undefined || detail.loading || onAskAt === undefined || onFollowUpAt === undefined) return null;
    return <DetailScreen key={questionId} inline active={questionId === activeQuestionId} view={detail} onBack={() => {}}
      onAsk={(text) => onAskAt(questionId, text)} onFollowUp={(id) => onFollowUpAt(questionId, id)} />;
  };
  const chatRef = useRef<HTMLElement>(null);
  /** 바로 앞 렌더에서 맨 아래에 있던 줄 id 입니다. 바뀌면 새 문장이 온 것입니다. */
  const lastLineRef = useRef<string | null>(null);
  const [typed, setTyped] = useState("");
  /** 위로 올려 읽는 동안 새로 온 문장 수입니다. 바닥으로 돌아오면 0 으로 돌아갑니다. */
  const [pending, setPending] = useState(0);
  /** 사람이 닫은 문답의 질문 id 입니다. 닫으면 대화 칸에서 사라집니다. */
  const [closed, setClosed] = useState<readonly string[]>([]);
  /** 대화 칸이 차지하는 패널 높이의 비율입니다. 경계를 끌면 바뀝니다. */
  const [chatRatio, setChatRatio] = useState(DEFAULT_CHAT_RATIO);
  const { note } = view;
  const { warn } = view.footer;

  const left = MAX_ASK_QUESTION_BYTES - utf8ByteLength(typed);
  const ready = typed.trim().length > 0 && left >= 0;
  const lastLineId = view.lines.at(-1)?.id ?? null;
  const shownAsks = view.asks.filter((item) => !closed.includes(item.id));
  /**
   * 새 질문은 아래로 이동하고, 긴 완성 답은 읽던 위치를 유지하도록 변화 신호를 나눕니다.
   */
  const askSignature = view.asks.map((item) => item.id).join("|");
  const completedSignature = view.asks.filter((item) => !item.loading).map((item) => item.id).join("|");

  // 두 상자 모두 아래에서 흐릅니다. 규칙은 `use-stick-to-bottom.ts` 한 곳에 있습니다 — 같은 문단이
  // 자라는 동안에도 따라가고, 일부러 올리면 붙잡지 않고, 풀린 뒤 아래에 새 글이 오면 알려 줍니다.
  //
  //   전사   그냥 붙입니다. 글 칸이 이 상자 밖(대화 칸)으로 나가서, 쓰는 동안 멈출 까닭이 없습니다.
  //   대화   새 질문은 아래로 이동합니다. 긴 답 완성 시 첫 부분을 건너뛰지 않도록 위치를 유지합니다.
  const body = useStickToBottom<HTMLDivElement>();
  const log = useStickToBottom<HTMLDivElement>({ pinOn: askSignature, preserveOn: completedSignature });

  // 전사를 위로 올려 읽는 동안 온 문장을 셉니다. 바닥으로 따라가는 일도, 지금 올려 둔 상태인지
  // 보는 일도 훅이 합니다(`body.stuck`) — 여기 남는 일은 "몇 줄을 놓쳤나" 세는 것 하나뿐입니다.
  // 바닥으로 돌아오면(다시 붙으면) 셈을 지웁니다.
  useEffect(() => {
    const grew = lastLineId !== null && lastLineId !== lastLineRef.current;
    lastLineRef.current = lastLineId;
    if (body.stuck) {
      setPending(0);
      return;
    }
    if (grew) setPending((count) => count + 1);
  }, [lastLineId, body.stuck]);

  const send = (): void => {
    if (!ready) return;
    onAsk(typed);
    // 대화 칸을 여기서 바닥으로 붙이지 않습니다. 줄이 하나 늘면 `askSignature` 가 바뀌고 그때
    // 훅이 내려갑니다. 답이 도착할 때도 같은 값이 다시 바뀌어 같은 길로 내려갑니다.
    setTyped("");
  };

  /**
   * 경계를 끌어 대화 칸 높이를 바꿉니다.
   *
   *   화면 높이 ─┬─ 머리글 · 바닥줄 (건드리지 않음)
   *              ├─ 전사   flex: 1     ← 남는 자리를 다 가집니다
   *              └─ 대화   height: N%  ← 여기 N 을 바꿉니다
   *
   * 손가락·마우스가 있는 자리(clientY)에서 대화 칸 바닥까지가 곧 새 높이입니다. 그것을 화면
   * 높이로 나눠 **비율**로 담습니다(창 크기가 바뀌어도 사람이 정한 비율이 남습니다).
   */
  const resizeTo = useCallback((clientY: number): void => {
    const chat = chatRef.current;
    const screen = chat?.parentElement ?? null;
    if (chat === null || screen === null) return;
    const screenHeight = screen.getBoundingClientRect().height;
    if (screenHeight <= 0) return;
    setChatRatio(clampRatio((chat.getBoundingClientRect().bottom - clientY) / screenHeight));
  }, []);

  const grip = (
    <div
      className="cm-chat__grip"
      // 두 칸 사이의 움직이는 경계입니다. WAI-ARIA 의 "window splitter" 가 이 모양입니다.
      role="separator"
      aria-orientation="horizontal"
      aria-label="전사와 대화 칸의 경계 · 위아래 화살표로 높이를 바꿔요"
      aria-valuenow={Math.round(chatRatio * 100)}
      aria-valuemin={Math.round(MIN_CHAT_RATIO * 100)}
      aria-valuemax={Math.round(MAX_CHAT_RATIO * 100)}
      tabIndex={0}
      onPointerDown={(event) => {
        // 끄는 동안 글자가 선택되지 않게 하고, 손이 칸 밖으로 나가도 사건을 계속 받습니다.
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        resizeTo(event.clientY);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onKeyDown={(event) => {
        const step = event.key === "ArrowUp" ? RESIZE_STEP : event.key === "ArrowDown" ? -RESIZE_STEP : 0;
        if (step === 0) return;
        event.preventDefault();
        setChatRatio((ratio) => clampRatio(ratio + step));
      }}
    />
  );

  /**
   * 앞 질문의 메모가 자리를 차지한 채로 새로 문장을 붙잡았을 때의 짐작 목록입니다.
   *
   * 앞 질문의 메모 **아래**에 둡니다. 위아래는 이 화면의 다른 자리(전사 · 대화 칸)와 같은
   * 규칙, 곧 시간 순서입니다 — 먼저 물은 것이 위, 방금 한 행동이 아래(글 칸 가까이)입니다.
   * 목록이 가려지는 일은 없습니다. 두 덩어리가 같은 줄 아래 나란히 놓입니다.
   */
  const renderChoosing = (lineId: string): React.ReactNode => {
    const choosing = view.choosing;
    if (choosing === null || choosing.lineId !== lineId) return null;
    return (
      <MarginNote term="문장" time={choosing.time} state="choosing" style={{ marginTop: 12 }}>
        <GuessList
          options={[...choosing.options]}
          {...(choosing.value === undefined ? {} : { value: choosing.value })}
          onChange={onGuess}
        />
      </MarginNote>
    );
  };

  /**
   * 답을 기다리는 중에 밀려난 붙잡기 질문입니다(U-34).
   *
   * 물어본 **그 문장 옆**에 그대로 둡니다. 아래 대화 칸은 학습자가 직접 친 질문만 담습니다.
   * 아직이면 「기다리는 중」, 답이 오면 그 자리에서 결론과 본문으로 채워집니다.
   */
  const renderCarried = (lineId: string): React.ReactNode => {
    const rows = view.carried.filter((item) => item.lineId === lineId);
    if (rows.length === 0) return null;
    return rows.map((row) => inline(row.questionId) ?? (
      row.conclusion === null ? (
        <MarginNote
          key={row.questionId}
          term={row.term}
          time={row.time}
          state="preparing"
          warn={row.failure !== null}
          style={{ marginTop: 12 }}
          waitingText={
            row.failure !== null ? (
              row.failure
            ) : row.stream === null ? (
              CARRIED_WAITING
            ) : (
              <AnswerStream stream={row.stream} idle={CARRIED_WAITING} sweep={false} />
            )
          }
        />
      ) : (
        <MarginNote
          key={row.questionId}
          term={row.term}
          time={row.time}
          state="ready"
          style={{ marginTop: 12 }}
          conclusion={withBody(row.conclusion, row.body)}
          evidence={[...row.evidence]}
        />
      )),
    );
  };

  const renderAfter = (lineId: string): React.ReactNode => {
    const guesses = renderChoosing(lineId);
    // 밀려난 질문은 시간상 앞선 것이라 지금 메모보다 **위**에 둡니다 — 이 화면의 다른 자리와
    // 같은 규칙(먼저 물은 것이 위)입니다.
    const carried = renderCarried(lineId);
    if (note.kind === "none" || note.lineId !== lineId) {
      return carried === null ? (
        guesses
      ) : (
        <>
          {carried}
          {guesses}
        </>
      );
    }
    const after = view.noteNow === null ? null : <NowLine style={{ marginTop: 12 }}>{view.noteNow}</NowLine>;
    const block = ((): React.ReactNode => {
      if ((note.kind === "ready" || note.kind === "collapsed") && activeQuestionId !== null) {
        const expanded = inline(activeQuestionId);
        if (expanded !== null) return expanded;
      }
      switch (note.kind) {
        case "choosing":
          return (
            <MarginNote term="문장" time={note.time} state="choosing">
              <GuessList
                options={[...note.options]}
                {...(note.value === undefined ? {} : { value: note.value })}
                onChange={onGuess}
              />
            </MarginNote>
          );
        case "preparing":
          return (
            <MarginNote
              term={note.term}
              time={note.time}
              state="preparing"
              warn={note.warn}
              // 답이 흐르고 있으면 대기 한 줄 자리에 **자라는 결론**을 그립니다. 결론 자리
              // (`cm-note__c`)가 아니라 대기 자리라서, 쓸어내리는 띠가 아래에서 계속 움직입니다.
              waitingText={
                note.stream === null ? (
                  note.waitingText
                ) : (
                  <AnswerStream stream={note.stream} idle={note.waitingText ?? "한 줄로 정리하고 있어요"} sweep={false} />
                )
              }
            >
              <SourceStatus compact sources={[...note.sources]} />
            </MarginNote>
          );
        case "collapsed":
          return (
            <MarginNote term={note.term} time={note.time} state="collapsed" conclusion={note.conclusion} onExpand={onExpand} />
          );
        case "ready":
          return (
            <MarginNote
              term={note.term}
              time={note.time}
              state="ready"
              conclusion={withBody(note.conclusion, note.body)}
              evidence={[...note.evidence]}
              chips={[...note.chips]}
              onChip={onChip}
              onDetail={onDetail}
              collapseText={note.collapseText}
            />
          );
      }
    })();
    return (
      <>
        {carried}
        {block}
        {after}
        {guesses}
      </>
    );
  };

  // 전사 맨 아래 안내 글입니다. 묻는 자리가 대화 칸으로 나갔으므로 라이브에서도 줄이지 않습니다.
  const tip = view.tiroPaused ? (
    <span>
      전사가 멈춘 동안에도 <Kbd>Alt</Kbd>+<Kbd>S</Kbd>로 지금 화면과 코드를 붙잡을 수 있어요
    </span>
  ) : (
    <span>
      걸리는 말을 누르세요 · 문장을 누르면 문장 전체를 붙잡아요 · <Kbd>Alt</Kbd>+<Kbd>S</Kbd> 마지막 문장
    </span>
  );

  // 위로 올려 읽는 동안 아래에 쌓인 것을 알리는 한 줄입니다. 전사와 대화 칸 사이, 곧 놓친 줄이
  // 있는 쪽 바로 아래에 둡니다. 대화 칸 안이 아니라 밖이라 대화 칸 높이를 먹지 않습니다.
  //
  // 띄울지는 훅의 `hasNew` 가 정하고 몇 개인지는 줄을 센 `pending` 이 말합니다. 둘을 나눈 까닭:
  // 같은 문단이 길어지기만 해도 아래에 볼 것은 생기는데(Tiro 는 문단을 자라게 보냅니다) 그때는
  // 셀 줄이 없습니다. 사람이 할 일은 어느 쪽이든 "내려가기" 하나라 자리도 하나만 둡니다.
  const catchUp =
    !view.canAsk || !body.hasNew ? null : (
      <button
        type="button"
        className="cm-chat__catch"
        onClick={() => {
          setPending(0);
          body.toBottom();
        }}
      >
        {pending > 0 ? `새 문장 ${pending}개 · 눌러서 따라가기` : CATCH_UP_GROWING_LINE}
      </button>
    );

  const chat = !view.canAsk ? null : (
    <section
      className="cm-chat"
      ref={chatRef}
      // 기본값은 style.css 에도 같은 값으로 적혀 있습니다. 여기 값은 경계를 끌면 따라 움직입니다.
      style={{ height: `${(chatRatio * 100).toFixed(2)}%` }}
      aria-label="대화"
    >
      {grip}
      <div className="cm-chat__log" ref={log.ref} aria-live="polite">
        {shownAsks.length === 0 ? (
          <p className="cm-chat__empty">{CHAT_EMPTY_LINE}</p>
        ) : (
          shownAsks.map((item) => (
            <div className="cm-reply" key={item.id} style={{ padding: 0 }}>
              <div className="cm-reply__q" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ flex: 1, minWidth: 0 }}>{`${item.question} · ${item.time}`}</span>
                <IconButton icon="x" label="답 닫기" size="sm" onClick={() => setClosed([...closed, item.id])} />
              </div>
              {item.loading ? (
                <div className="cm-reply__wait">
                  <AnswerStream stream={item.stream} idle={FOLLOW_UP_WAITING_LINE} />
                </div>
              ) : item.failure !== null ? (
                <div className="cm-reply__wait">{item.failure}</div>
              ) : (
                <div className="cm-reply__a">
                  <strong>{item.conclusion}</strong>
                  {item.body === null ? null : <div className="cm-reply__body">{item.body}</div>}
                  {item.id !== shownAsks.at(-1)?.id ? null : (
                    <div className="cm-chat__suggestions" aria-label="이어서 질문하기">
                      {["더 쉽게 설명해 주세요", "구체적인 예를 들어 주세요", "왜 필요한지 설명해 주세요"].map((question, index) => (
                        <button type="button" key={question} onClick={() => onAsk(question)}>
                          {["더 쉽게", "예시로", "왜 필요한가요?"][index]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="cm-chat__bar">
        {log.hasNew ? <button type="button" className="cm-chat__catch" onClick={log.toBottom}>답변 아래로 이동 ↓</button> : null}
        <Input
          size="md"
          value={typed}
          placeholder={ASK_PLACEHOLDER}
          aria-label="바로 묻기"
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            // Esc 는 적던 글만 버립니다. 칸은 접히지 않습니다 — 늘 열려 있는 것이 이 칸의 약속입니다.
            if (event.key === "Escape") {
              event.preventDefault();
              setTyped("");
              return;
            }
            // 한 줄 칸이라 Enter 는 줄바꿈이 아니라 보내기입니다. 한글 조합 중에는 보내지 않습니다.
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            send();
          }}
          {...(left < HINT_BELOW_BYTES ? { hint: `${left}바이트 남았어요` } : {})}
          invalid={left < 0}
          trailing={<IconButton icon="arrow-up" label="보내기" size="sm" disabled={!ready} onClick={send} />}
        />
      </div>
    </section>
  );

  return (
    <div className="cm-screen">
      <PanelHeader
        status={view.header.status}
        title={view.header.title}
        subtitle={view.header.subtitle}
        time={view.header.time}
        actions={<IconButton icon="settings-2" label="설정" size="sm" onClick={onSettings} />}
      />
      {view.pinnedNow === null ? null : (
        <div className="cm-screen__now">
          <NowLine variant="plain">{view.pinnedNow}</NowLine>
        </div>
      )}
      <div className="cm-screen__body cm-screen__body--flow" ref={body.ref}>
        {view.lines.length === 0 ? <p className="cm-empty">아직 들은 문장이 없어요</p> : null}
        <TranscriptFlow
          lines={[...view.lines]}
          {...(view.active === undefined ? {} : { active: view.active })}
          marked={[...view.marked]}
          onTerm={(lineId, segmentIndex, segment) => onTerm(lineId, segmentIndex, segment.text)}
          onSentence={onSentence}
          renderAfter={renderAfter}
          tip={tip}
        />
      </div>
      {catchUp}
      {chat}
      <SourceFooter
        sources={[...view.footer.sources]}
        count={view.footer.count}
        onCount={onHistory}
        {...(warn === null ? {} : { warn: warnProps(warn, onReconnect) })}
      />
    </div>
  );
}
