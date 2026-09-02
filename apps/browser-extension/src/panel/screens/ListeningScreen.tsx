// 듣는 중 화면 — 선생님 말이 아래에서 흐르고, 점선 낱말이나 문장을 누르는 것이 곧 질문입니다.
// 정본: design-system/ui_kits/sidepanel/ListeningScreen.jsx. 값은 전부 lesson-view 가 만들어 줍니다.

import { PanelHeader } from "@classmate/ui-base";
import { GuessList, MarginNote, NowLine, SourceFooter, SourceStatus, TranscriptFlow } from "@classmate/ui-classmate";
import { useEffect, useRef } from "react";

import type { ListeningView } from "../lesson-view";

export interface ListeningScreenProps {
  readonly view: ListeningView;
  readonly onTerm: (lineId: string, segmentIndex: number, word: string) => void;
  readonly onSentence: (lineId: string) => void;
  readonly onGuess: (guessId: string) => void;
  readonly onChip: (chipId: string) => void;
  readonly onDetail: () => void;
  readonly onExpand: () => void;
}

function Kbd({ children }: { readonly children: string }): React.JSX.Element {
  return <kbd className="cm-kbd">{children}</kbd>;
}

export function ListeningScreen({
  view,
  onTerm,
  onSentence,
  onGuess,
  onChip,
  onDetail,
  onExpand,
}: ListeningScreenProps): React.JSX.Element {
  const bodyRef = useRef<HTMLDivElement>(null);
  const { note } = view;

  // 새 줄이나 메모가 생기면 바닥으로 붙입니다(정본 규칙: 전사는 아래에서 흐릅니다).
  useEffect(() => {
    const el = bodyRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [view.lines.length, note.kind]);

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

  const tip = view.tiroPaused ? (
    <span>
      전사가 멈춘 동안에도 <Kbd>Alt</Kbd>+<Kbd>S</Kbd>로 지금 화면과 코드를 붙잡을 수 있어요
    </span>
  ) : (
    <span>
      걸리는 말을 누르세요 · 문장을 누르면 문장 전체를 붙잡아요 · <Kbd>Alt</Kbd>+<Kbd>S</Kbd> 마지막 문장
    </span>
  );

  return (
    <div className="cm-screen">
      <PanelHeader status={view.header.status} title={view.header.title} subtitle={view.header.subtitle} time={view.header.time} />
      {view.pinnedNow === null ? null : (
        <div className="cm-screen__now">
          <NowLine variant="plain">{view.pinnedNow}</NowLine>
        </div>
      )}
      <div className="cm-screen__body cm-screen__body--flow" ref={bodyRef}>
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
      <SourceFooter
        sources={[...view.footer.sources]}
        count={view.footer.count}
        {...(view.footer.warn === null ? {} : { warn: view.footer.warn })}
      />
    </div>
  );
}
