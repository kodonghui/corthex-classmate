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
//   │ 바닥줄 (전사 · Meet · …)   │  SourceFooter
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
// 재생(`?replay=`)에는 물을 곳이 없어 대화 칸을 아예 만들지 않습니다(`view.canAsk`).
// 골든 9장면은 예전 그대로입니다 — 이 파일에서 재생이 지나는 길은 옛 길과 같습니다.

import { IconButton, Input, PanelHeader } from "@classmate/ui-base";
import type { FooterWarn } from "@classmate/ui-classmate";
import { GuessList, MarginNote, NowLine, SourceFooter, SourceStatus, TranscriptFlow } from "@classmate/ui-classmate";
import { useCallback, useEffect, useRef, useState } from "react";

import { MAX_ASK_QUESTION_BYTES, utf8ByteLength } from "../ask-text";
import type { FooterWarnView, ListeningView } from "../lesson-view";
import type { ReconnectTarget } from "../ports";
import { FOLLOW_UP_WAITING_LINE } from "../replay-store";

export interface ListeningScreenProps {
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
 * 대화 칸의 기본 높이입니다. 패널 높이의 1/3 — 사용자가 그렇게 말했습니다("1/3은 대화 전용").
 *
 * 비율로 다루는 까닭: 사이드패널 높이는 창 크기와 함께 늘 바뀝니다. px 로 못 박으면 낮은
 * 창에서는 전사가 사라지고 높은 창에서는 대화 칸이 우표만 해집니다.
 * 아래끝·위끝(20%·60%)은 두 칸 중 하나가 사라지지 않게 하는 자리입니다. 여기에 더해
 * style.css 의 `min-height: min(180px, 45%)` 가 **픽셀 바닥**을 지킵니다 — 글 칸 한 줄(36px)과
 * 문답 두어 줄이 함께 보이는 최소 높이입니다.
 */
const DEFAULT_CHAT_RATIO = 1 / 3;
const MIN_CHAT_RATIO = 0.2;
const MAX_CHAT_RATIO = 0.6;

/** 경계를 키보드 화살표로 움직이는 폭입니다(한 번에 패널 높이의 5%). */
const RESIZE_STEP = 0.05;

/**
 * 전사 칸이 바닥에서 이만큼 안쪽이면 "아직 바닥" 으로 봅니다.
 *
 * 스크롤 값은 소수점으로 떨어질 때가 있어(확대·글씨 크기 단계) 0 으로 딱 맞는 일이 드뭅니다.
 * 이 틈이 없으면 바닥에 있는데도 "위로 올려 읽는 중" 으로 잘못 보고 새 문장을 안 따라갑니다.
 */
const NEAR_BOTTOM_PX = 24;

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

export function ListeningScreen({
  view,
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLElement>(null);
  /** 바로 앞 렌더에서 맨 아래에 있던 줄 id 입니다. 바뀌면 새 문장이 온 것입니다. */
  const lastLineRef = useRef<string | null>(null);
  /**
   * 사람이 전사를 위로 올려 지난 이야기를 읽는 중인가입니다.
   * 스크롤할 때마다 바뀌는 값이라 state 가 아니라 ref 입니다 — 한 번 구를 때마다 화면을
   * 다시 그리면 전사가 덜덜 떱니다. 읽는 곳은 아래 효과 하나뿐입니다.
   */
  const awayRef = useRef(false);
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
   * 대화 칸을 바닥으로 붙일 까닭이 생겼는지입니다. 줄이 늘 때뿐 아니라 **기다리던 줄에 답이
   * 도착할 때**도 붙여야 해서, 길이가 아니라 "각 줄이 아직 기다리는가" 까지 적어 둡니다.
   */
  const askSignature = view.asks.map((item) => `${item.id}:${item.loading ? "wait" : "done"}`).join("|");

  const stick = useCallback((): void => {
    const el = bodyRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, []);

  const stickChat = useCallback((): void => {
    const el = logRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, []);

  // 새 줄이나 메모가 생기면 전사를 바닥으로 붙입니다(정본 규칙: 전사는 아래에서 흐릅니다).
  //
  //   재생        늘 붙입니다 — 골든 9장면의 픽셀이 걸려 있어 옛 길 그대로입니다.
  //   라이브      **위로 올려 읽는 중이면 붙이지 않습니다.** 읽던 자리가 튀면 못 읽습니다.
  //               그 사이에 온 문장은 세어 두었다가 "새 문장 N개" 한 줄로만 조용히 알립니다.
  //
  // 글을 쓰는 중인지는 이제 보지 않습니다. 글 칸이 전사 밖(대화 칸)으로 나가서, 전사가 자라도
  // 쓰던 자리가 밀리지 않기 때문입니다.
  useEffect(() => {
    const grew = lastLineId !== null && lastLineId !== lastLineRef.current;
    lastLineRef.current = lastLineId;
    if (!view.canAsk) {
      stick();
      return;
    }
    if (awayRef.current) {
      if (grew) setPending((count) => count + 1);
      return;
    }
    setPending(0);
    stick();
  }, [lastLineId, view.lines.length, view.canAsk, note.kind, stick]);

  // 대화 칸은 전사와 상관없이 자기 바닥으로 붙습니다. 새 질문을 보냈을 때와 답이 왔을 때입니다.
  useEffect(() => {
    stickChat();
  }, [askSignature, stickChat]);

  /** 전사를 구를 때마다 "바닥에 있는가" 를 다시 봅니다. 바닥으로 돌아오면 밀린 셈도 지웁니다. */
  const onBodyScroll = useCallback((): void => {
    const el = bodyRef.current;
    if (el === null) return;
    const away = el.scrollHeight - el.scrollTop - el.clientHeight > NEAR_BOTTOM_PX;
    awayRef.current = away;
    if (!away) setPending(0);
  }, []);

  const send = (): void => {
    if (!ready) return;
    onAsk(typed);
    setTyped("");
    stickChat();
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

  const renderAfter = (lineId: string): React.ReactNode => {
    if (note.kind === "none" || note.lineId !== lineId) return null;
    const after = view.noteNow === null ? null : <NowLine style={{ marginTop: 12 }}>{view.noteNow}</NowLine>;
    switch (note.kind) {
      case "choosing":
        return (
          <>
            <MarginNote term="문장" time={note.time} state="choosing">
              <GuessList
                options={[...note.options]}
                {...(note.value === undefined ? {} : { value: note.value })}
                onChange={onGuess}
              />
            </MarginNote>
            {after}
          </>
        );
      case "preparing":
        return (
          <>
            <MarginNote
              term={note.term}
              time={note.time}
              state="preparing"
              warn={note.warn}
              {...(note.waitingText === null ? {} : { waitingText: note.waitingText })}
            >
              <SourceStatus compact sources={[...note.sources]} />
            </MarginNote>
            {after}
          </>
        );
      case "collapsed":
        return (
          <>
            <MarginNote term={note.term} time={note.time} state="collapsed" conclusion={note.conclusion} onExpand={onExpand} />
            {after}
          </>
        );
      case "ready":
        return (
          <>
            <MarginNote
              term={note.term}
              time={note.time}
              state="ready"
              conclusion={note.conclusion}
              evidence={[...note.evidence]}
              chips={[...note.chips]}
              onChip={onChip}
              onDetail={onDetail}
              collapseText={note.collapseText}
            />
            {after}
          </>
        );
    }
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

  // 위로 올려 읽는 동안 온 문장을 알리는 한 줄입니다. 전사와 대화 칸 사이, 곧 놓친 줄이 있는
  // 쪽 바로 아래에 둡니다. 대화 칸 안이 아니라 밖이라 대화 칸 높이를 먹지 않습니다.
  const catchUp =
    !view.canAsk || pending === 0 ? null : (
      <button
        type="button"
        className="cm-chat__catch"
        onClick={() => {
          setPending(0);
          awayRef.current = false;
          stick();
        }}
      >
        {`새 문장 ${pending}개 · 눌러서 따라가기`}
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
      <div className="cm-chat__log" ref={logRef} aria-live="polite">
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
                <div className="cm-reply__wait">{FOLLOW_UP_WAITING_LINE}</div>
              ) : item.failure !== null ? (
                <div className="cm-reply__wait">{item.failure}</div>
              ) : (
                <div className="cm-reply__a">{item.conclusion}</div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="cm-chat__bar">
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
      <div className="cm-screen__body cm-screen__body--flow" ref={bodyRef} onScroll={onBodyScroll}>
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
