import type * as React from "react";

import { cx } from "../cx";
import { Chip, ChipGroup, Evidence, Icon, type EvidenceProps } from "../internal/base";

export interface NoteChip {
  id: string;
  label: React.ReactNode;
  selected?: boolean;
}
/**
 * The answer as a margin note under the sentence it belongs to: term · time, one-sentence conclusion, evidence, 2–3 chips, "자세히 보기".
 * States: preparing (sweep) → ready → collapsed (one dashed line the learner can reopen).
 */
export interface MarginNoteProps {
  /** The caught word or "문장" */
  term: React.ReactNode;
  time?: string;
  state?: "preparing" | "choosing" | "ready" | "collapsed";
  conclusion?: React.ReactNode;
  evidence?: EvidenceProps[];
  chips?: NoteChip[];
  onChip?: (id: string) => void;
  /** Shows "자세히 보기 ▸" in the footer */
  onDetail?: () => void;
  detailLabel?: string;
  /** Right footer text, e.g. "18초 뒤 접혀요 · 기록에 남아요" */
  collapseText?: React.ReactNode;
  /** Text while preparing (default "한 줄로 정리하고 있어요") */
  waitingText?: React.ReactNode;
  /** Amber tint when the tutor is waiting on a connection */
  warn?: boolean;
  /** Collapsed → expand */
  onExpand?: () => void;
  /**
   * Extra content between header and conclusion. 상태와 상관없이 헤더 바로 아래에 그립니다:
   * choosing 이면 GuessList, preparing 이면 `<SourceStatus compact />`(붙잡는 순간 봉인한 세 자료),
   * ready 이면 CodeCompare 같은 덧붙임이 들어옵니다.
   */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// The inline answer that appears under the sentence it belongs to. state: preparing | choosing | ready | collapsed
export function MarginNote({
  term,
  time,
  state = "ready",
  conclusion,
  evidence = [],
  chips = [],
  onChip,
  onDetail,
  detailLabel = "자세히 보기",
  collapseText,
  waitingText,
  warn = false,
  onExpand,
  children,
  className,
  style,
}: MarginNoteProps): React.JSX.Element {
  if (state === "collapsed")
    return (
      <button type="button" className={cx("cm-note", "cm-note--collapsed", className)} style={style} onClick={onExpand}>
        <Icon name="bookmark" size={13} style={{ color: "var(--ink-600)" }} />
        <span className="cm-note__ct">
          <b>{term}</b>
          {time ? ` · ${time}` : ""}
          {conclusion ? <> · {conclusion}</> : null}
        </span>
        <Icon name="chevron-down" size={14} style={{ color: "var(--text-4)" }} />
      </button>
    );
  const ready = state === "ready";
  const busy = state === "preparing" ? ({ "aria-busy": true } as const) : {};
  return (
    <div className={cx("cm-note", warn && "cm-note--warn", className)} style={style} {...busy}>
      <div className="cm-note__h">
        <Icon name="bookmark" size={13} />
        <span>{term}</span>
        {time ? <span className="cm-note__tm">· {time}</span> : null}
        {!ready ? <span className="cm-note__hr">붙잡았어요</span> : null}
      </div>
      {children}
      {state === "preparing" ? (
        <div className="cm-note__wait">
          <span>{waitingText || "한 줄로 정리하고 있어요"}</span>
          {!warn ? <div className="cm-note__sweep" aria-hidden="true"></div> : null}
        </div>
      ) : null}
      {ready && conclusion ? <p className="cm-note__c">{conclusion}</p> : null}
      {ready && evidence.length ? (
        <div className="cm-note__ev">
          {evidence.map((e, i) => (
            <Evidence key={i} {...e} />
          ))}
        </div>
      ) : null}
      {ready && chips.length ? (
        <ChipGroup>
          {chips.map((c) => (
            <Chip key={c.id} selected={c.selected ?? false} onClick={() => onChip && onChip(c.id)}>
              {c.label}
            </Chip>
          ))}
        </ChipGroup>
      ) : null}
      {ready && (onDetail || collapseText) ? (
        <div className="cm-note__f">
          {onDetail ? (
            <button type="button" className="cm-note__more" onClick={onDetail}>
              {detailLabel} <span aria-hidden="true">▸</span>
            </button>
          ) : (
            <span></span>
          )}
          {collapseText ? <span>{collapseText}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
