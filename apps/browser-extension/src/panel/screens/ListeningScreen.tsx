// 듣는 중 화면 — 선생님 말이 아래에서 흐르고, 점선 낱말이나 문장을 누르는 것이 곧 질문입니다.
// 정본: design-system/ui_kits/sidepanel/ListeningScreen.jsx. 값은 전부 lesson-view 가 만들어 줍니다.

import { IconButton, PanelHeader } from "@classmate/ui-base";
import type { FooterWarn } from "@classmate/ui-classmate";
import { GuessList, MarginNote, NowLine, SourceFooter, SourceStatus, TranscriptFlow } from "@classmate/ui-classmate";

import type { FooterWarnView, ListeningView } from "../lesson-view";
import type { ReconnectTarget } from "../ports";
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
}

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
}: ListeningScreenProps): React.JSX.Element {
  // 전사는 아래에서 흐릅니다(정본 규칙). 문단이 자라는 동안에도 따라가고, 학습자가 일부러 올리면
  // 그 자리에 둡니다. 규칙은 `use-stick-to-bottom.ts` 한 곳에 있습니다.
  const body = useStickToBottom<HTMLDivElement>();
  const { note } = view;
  const { warn } = view.footer;

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
        {body.hasNew ? <ToBottom onClick={body.toBottom} /> : null}
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
