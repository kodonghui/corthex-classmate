// 듣는 중 화면 — 선생님 말이 아래에서 흐르고, 점선 낱말이나 문장을 누르는 것이 곧 질문입니다.
// 정본: design-system/ui_kits/sidepanel/ListeningScreen.jsx. 값은 전부 lesson-view 가 만들어 줍니다.
//
// 맨 아래 한 줄(TranscriptFlow 의 `tip` 슬롯)은 원래 안내 글만 있던 자리입니다. 라이브에서는 그
// 자리에 **바로 묻는 칸**을 함께 둡니다(단위 C "조용한 한 단"). 새 세로 자리를 얻지 않으려고
// 안내 글을 한 줄로 줄이고 그 아래 접힌 칸 한 줄을 놓습니다.
//
//   평소(접힘)   걸리는 말을 누르세요 · Alt+S 마지막 문장
//                궁금한 건 여기에 바로 물어보세요            ← 눌러도 포커스가 와도 펼쳐집니다
//   펼침         [ 지금 궁금한 걸 적어요               ↑ ]
//
// 재생(`?replay=`)에는 물을 곳이 없어 칸을 아예 만들지 않습니다(`view.canAsk`). 골든 9장면의
// 안내 글은 예전 문구 그대로입니다.
//
// 바닥에 붙어 따라 내려가는 규칙은 이 파일에 없습니다. `use-stick-to-bottom.ts` 한 곳에 있고
// 자세히 화면도 같은 것을 씁니다. 이 화면만의 사정은 하나뿐입니다 — 묻는 칸이 스크롤 상자 **안**
// 에 있어서, 글을 쓰는 동안에는 따라가기를 멈춰야 합니다(`paused: composing`).

import { IconButton, Input, PanelHeader } from "@classmate/ui-base";
import type { FooterWarn } from "@classmate/ui-classmate";
import { GuessList, MarginNote, NowLine, SourceFooter, SourceStatus, TranscriptFlow } from "@classmate/ui-classmate";
import { useCallback, useEffect, useRef, useState } from "react";

import { MAX_ASK_QUESTION_BYTES, utf8ByteLength } from "../ask-text";
import type { FooterWarnView, ListeningView } from "../lesson-view";
import type { ReconnectTarget } from "../ports";
import { FOLLOW_UP_WAITING_LINE } from "../replay-store";
import { useStickToBottom } from "../use-stick-to-bottom";

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
  /** 맨 아래 한 줄에 적어 바로 물었습니다. 빈 글은 여기까지 오지 않습니다. */
  readonly onAsk: (text: string) => void;
}

/** 접힌 칸에 보이는 말입니다. 이 자리가 무엇을 하는 자리인지 한 줄로 말합니다. */
const ASK_COLLAPSED_LABEL = "궁금한 건 여기에 바로 물어보세요";

/** 펼친 칸의 힌트 글입니다. */
const ASK_PLACEHOLDER = "지금 궁금한 걸 적어요";

/** 남은 바이트가 이보다 적을 때만 상한을 알립니다(자세히 화면과 같은 값). */
const HINT_BELOW_BYTES = 200;

/**
 * 접힌 칸의 모양입니다. 테두리도 배경도 없이 안내 글과 똑같이 보이게 해서
 * 평소에 세로 자리를 새로 먹지 않게 합니다(글꼴·색은 `.cm-tf__tip` 에서 물려받습니다).
 */
const COLLAPSED_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  margin: 0,
  padding: 0,
  border: 0,
  background: "transparent",
  font: "inherit",
  color: "inherit",
  textAlign: "left",
  cursor: "text",
};

/** 타이핑 중에만 뜨는 "새 문장 N개" 표시입니다. 채도 있는 블록을 늘리지 않고 밑줄만 답니다. */
const CATCH_UP_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  margin: "0 0 8px",
  padding: 0,
  border: 0,
  background: "transparent",
  font: "inherit",
  color: "var(--text-secondary)",
  textAlign: "left",
  textDecoration: "underline",
  textUnderlineOffset: 2,
  cursor: "pointer",
};

function Kbd({ children }: { readonly children: string }): React.JSX.Element {
  return <kbd className="cm-kbd">{children}</kbd>;
}

/**
 * 스크롤을 올려 둔 동안 새 말이 들어왔을 때 바닥 근처에 뜨는 자리 하나입니다.
 * 상자 안 마지막 아이라 `sticky` 로 스크롤 바닥에 남습니다. 다시 붙으면 사라집니다.
 */
function ToBottom({ onClick }: { readonly onClick: () => void }): React.JSX.Element {
  return (
    <div style={{ position: "sticky", bottom: 0, alignSelf: "center", zIndex: 1 }}>
      <IconButton icon="chevron-down" label="새 문장으로 내려가기" size="sm" variant="secondary" onClick={onClick} />
    </div>
  );
}

/** 안내에서 `reconnect` 를 떼어 내고 그 자리에 누를 손짓을 답니다. */
function warnProps(warn: FooterWarnView, onReconnect: (connector: ReconnectTarget) => void): FooterWarn {
  const { reconnect, ...rest } = warn;
  return reconnect === undefined ? rest : { ...rest, onAction: () => onReconnect(reconnect) };
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
  const barRef = useRef<HTMLDivElement>(null);
  /** 바로 앞 렌더에서 맨 아래에 있던 줄 id 입니다. 바뀌면 새 문장이 온 것입니다. */
  const lastLineRef = useRef<string | null>(null);
  const [typed, setTyped] = useState("");
  const [focused, setFocused] = useState(false);
  /** 타이핑을 시작한 뒤 새로 온 문장 수입니다. 타이핑을 멈추면 0 으로 돌아갑니다. */
  const [pending, setPending] = useState(0);
  /** 사람이 닫은 답 줄의 질문 id 입니다. 닫으면 다시 조용한 한 줄로 돌아갑니다. */
  const [closed, setClosed] = useState<readonly string[]>([]);
  const { note } = view;
  const { warn } = view.footer;

  const left = MAX_ASK_QUESTION_BYTES - utf8ByteLength(typed);
  const ready = typed.trim().length > 0 && left >= 0;
  // 펼침은 "포커스가 있거나 글이 남아 있음", 바닥 붙기를 멈추는 것은 "글을 쓰는 동안" 입니다.
  // 둘을 나눠야 보내고 나서(글이 비어 포커스만 남음) 바로 바닥으로 붙어 답 줄이 보입니다.
  const expanded = view.canAsk && (focused || typed.length > 0);
  const composing = view.canAsk && typed.length > 0;
  // 전사는 아래에서 흐릅니다(정본 규칙). 문단이 자라는 동안에도 따라가고, 학습자가 일부러 올리면
  // 그 자리에 둡니다. 규칙은 `use-stick-to-bottom.ts` 한 곳에 있습니다. 글을 쓰는 동안에만 따라가기를
  // 멈춥니다 — 한 글자 칠 때마다 화면이 튀면 못 씁니다. 글을 비우거나 보내면 멈춤이 풀리고 훅이
  // 그 자리에서 바닥으로 내려갑니다.
  const body = useStickToBottom<HTMLDivElement>({ paused: composing });
  const lastLineId = view.lines.at(-1)?.id ?? null;
  const latestAsk = view.asks.filter((item) => !closed.includes(item.id)).at(-1) ?? null;

  /** 묻는 칸의 진짜 `<input>` 입니다. ui-base 의 `Input` 은 ref 를 넘겨받지 않아 여기서 찾습니다. */
  const askInput = useCallback((): HTMLInputElement | null => barRef.current?.querySelector("input") ?? null, []);

  // 바닥으로 따라가는 일 자체는 훅이 합니다. 여기서는 글을 쓰는 동안에만 할 두 가지를 합니다.
  //   ① 그 사이에 온 문장을 세어 "새 문장 N개" 한 줄로만 조용히 알립니다.
  //   ② 전사가 자라 묻는 칸이 화면 밖으로 밀렸으면 그만큼만 따라 내려갑니다(칸이 안 보이면 못 씁니다).
  // ② 는 훅이 못 하는 일입니다 — 훅은 상자를 바닥에 맞추지, 상자 안 어떤 아이를 보이게 하지 않습니다.
  useEffect(() => {
    const grew = lastLineId !== null && lastLineId !== lastLineRef.current;
    lastLineRef.current = lastLineId;
    if (!composing) {
      setPending(0);
      return;
    }
    if (grew) setPending((count) => count + 1);
    const el = body.ref.current;
    const field = askInput();
    if (el === null || field === null) return;
    const gap = field.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom;
    if (gap > 0) el.scrollTop += gap;
  }, [lastLineId, view.lines.length, view.asks.length, note.kind, composing, askInput, body.ref]);

  // 접힌 줄을 눌러 펼쳤으면 그 자리에서 바로 칠 수 있게 칸으로 포커스를 옮깁니다.
  useEffect(() => {
    if (expanded) askInput()?.focus();
  }, [expanded, askInput]);

  const send = (): void => {
    if (!ready) return;
    onAsk(typed);
    // 여기서 바닥으로 붙이지 않습니다. 글이 비면 `composing` 이 꺼지고, 그때 훅이 멈춤을 풀면서 바로
    // 바닥으로 내려갑니다 — 답 줄이 그 자리에서 보입니다. 밀린 셈도 위 효과가 함께 지웁니다.
    setTyped("");
  };

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

  // 안내 글. 묻는 칸이 아래에 한 줄 더 붙는 라이브에서는 두 줄이 되지 않게 줄여 씁니다.
  const tipLine = view.tiroPaused ? (
    <span>
      전사가 멈춘 동안에도 <Kbd>Alt</Kbd>+<Kbd>S</Kbd>로 지금 화면과 코드를 붙잡을 수 있어요
    </span>
  ) : view.canAsk ? (
    <span>
      걸리는 말을 누르세요 · <Kbd>Alt</Kbd>+<Kbd>S</Kbd> 마지막 문장
    </span>
  ) : (
    <span>
      걸리는 말을 누르세요 · 문장을 누르면 문장 전체를 붙잡아요 · <Kbd>Alt</Kbd>+<Kbd>S</Kbd> 마지막 문장
    </span>
  );

  // 바로 물은 것 중 가장 나중 한 줄입니다. 여러 줄을 쌓으면 전사가 밀려 "조용한 한 단" 이 깨집니다.
  const askedRow =
    latestAsk === null ? null : (
      <div className="cm-reply" style={{ padding: 0, marginBottom: 10 }}>
        <div className="cm-reply__q" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ flex: 1, minWidth: 0 }}>{`${latestAsk.question} · ${latestAsk.time}`}</span>
          <IconButton icon="x" label="답 닫기" size="sm" onClick={() => setClosed([...closed, latestAsk.id])} />
        </div>
        {latestAsk.loading ? (
          <div className="cm-reply__wait">{FOLLOW_UP_WAITING_LINE}</div>
        ) : latestAsk.failure !== null ? (
          <div className="cm-reply__wait">{latestAsk.failure}</div>
        ) : (
          <div className="cm-reply__a">{latestAsk.conclusion}</div>
        )}
      </div>
    );

  const askBar = !view.canAsk ? null : (
    <div ref={barRef}>
      {/* 답은 소리로도 알려야 합니다. 줄이 나중에 생기므로 알림 자리는 늘 있는 채로 둡니다. */}
      <div aria-live="polite">{askedRow}</div>
      {pending > 0 ? (
        <button
          type="button"
          style={CATCH_UP_STYLE}
          onClick={() => {
            setPending(0);
            body.toBottom();
          }}
        >
          {`새 문장 ${pending}개 · 눌러서 따라가기`}
        </button>
      ) : null}
      {expanded ? (
        <Input
          size="md"
          value={typed}
          placeholder={ASK_PLACEHOLDER}
          aria-label="바로 묻기"
          onChange={(event) => setTyped(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            // Esc 는 적던 글을 버리고 칸을 빠져나옵니다(키보드만으로 도로 접는 길).
            if (event.key === "Escape") {
              event.preventDefault();
              setTyped("");
              event.currentTarget.blur();
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
      ) : (
        <button type="button" style={COLLAPSED_STYLE} onClick={() => setFocused(true)}>
          {ASK_COLLAPSED_LABEL}
        </button>
      )}
    </div>
  );

  const tip = view.canAsk ? (
    <>
      <div style={{ marginBottom: 8 }}>{tipLine}</div>
      {askBar}
    </>
  ) : (
    tipLine
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
        {/*
          아래로 내려가라는 표시는 하나만 둡니다. `pending`("새 문장 N개")은 글을 쓰는 중이라 멈춰
          있다는 뜻이고 `body.hasNew` 는 스크롤을 올려 두어 풀렸다는 뜻이라, 말은 달라도 사람이 할
          일은 "내려가기" 하나입니다. 글을 쓰는 동안에는 `pending` 쪽이 이깁니다 — 그 줄은 지금 눈이
          가 있는 묻는 칸 바로 위에 있고, 몇 개가 밀렸는지까지 말해 주기 때문입니다.
        */}
        {body.hasNew && !composing ? <ToBottom onClick={body.toBottom} /> : null}
      </div>
      <SourceFooter
        sources={[...view.footer.sources]}
        count={view.footer.count}
        onCount={onHistory}
        {...(warn === null ? {} : { warn: warnProps(warn, onReconnect) })}
      />
    </div>
  );
}
