import type * as React from "react";

import { cx } from "../cx";
import { Chip, ChipGroup, Evidence, Icon, type EvidenceProps } from "../internal/base";

export interface NoteChip {
  id: string;
  label: React.ReactNode;
  selected?: boolean;
}
/**
 * 답을 그 문장 바로 밑에 여백 메모로 붙입니다. 낱말 · 시각, 한 문장 결론, 근거, 칩 2~3개, "자세히 보기" 순서입니다.
 * 상태는 preparing(쓸어내림) → ready → collapsed(학습자가 다시 펼 수 있는 점선 한 줄) 로 흐릅니다.
 */
export interface MarginNoteProps {
  /** 붙잡은 낱말입니다. 문장을 통째로 붙잡았으면 "문장" 이 들어옵니다. */
  term: React.ReactNode;
  time?: string;
  state?: "preparing" | "choosing" | "ready" | "collapsed";
  conclusion?: React.ReactNode;
  evidence?: EvidenceProps[];
  chips?: NoteChip[];
  onChip?: (id: string) => void;
  /** 바닥글에 "자세히 보기 ▸" 를 보여 줍니다. */
  onDetail?: () => void;
  detailLabel?: string;
  /** 바닥글 오른쪽 글자입니다. 예: "18초 뒤 접혀요 · 기록에 남아요" */
  collapseText?: React.ReactNode;
  /** preparing 동안 보여 줄 글자입니다(기본값 "한 줄로 정리하고 있어요"). */
  waitingText?: React.ReactNode;
  /** 튜터가 연결을 기다리는 동안 호박색으로 물들입니다. */
  warn?: boolean;
  /** collapsed 를 눌러 다시 펼 때 부릅니다. */
  onExpand?: () => void;
  /**
   * 헤더와 결론 사이에 덧붙이는 내용입니다. 상태와 상관없이 헤더 바로 아래에 그립니다:
   * choosing 이면 GuessList, preparing 이면 `<SourceStatus compact />`(붙잡는 순간 봉인한 세 자료),
   * ready 이면 CodeCompare 같은 덧붙임이 들어옵니다.
   */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// 그 문장 바로 밑에 나타나는 답입니다. state 는 preparing | choosing | ready | collapsed 입니다.
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
