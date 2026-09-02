import type * as React from "react";

import { cx } from "../cx";

/** A caught moment in 기록: time · the word · its one-line answer. Whole row is the button. */
export interface MomentRowProps {
  /** "10:32:18" */
  time: string;
  /** The caught word or "문장" */
  term?: React.ReactNode;
  /** The one-sentence conclusion; clamps to 2 lines */
  title?: React.ReactNode;
  period?: string;
  topic?: string;
  state?: "ready" | "preparing" | "unread";
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

// One caught moment in 기록: when · which word · the one-line answer. Whole row is the button; no chevrons, no icon clutter.
export function MomentRow({
  time,
  term,
  title,
  period,
  topic,
  state = "ready",
  selected = false,
  onClick,
  className,
  style,
}: MomentRowProps): React.JSX.Element {
  const meta = [period, topic, state === "preparing" ? "정리 중" : state === "unread" ? "새 답변" : null]
    .filter(Boolean)
    .join(" · ");
  const current = selected ? ({ "aria-current": true } as const) : {};
  return (
    <button
      type="button"
      className={cx("cm-mo", `cm-mo--${state}`, selected && "cm-mo--selected", className)}
      style={style}
      onClick={onClick}
      {...current}
    >
      <span className="cm-mo__time">{time}</span>
      <span className="cm-mo__main">
        {term ? <span className="cm-mo__term">{term}</span> : null}
        {title ? <span className="cm-mo__title">{title}</span> : null}
        {meta ? <span className="cm-mo__meta">{meta}</span> : null}
      </span>
      <span className="cm-mo__end" aria-hidden="true">
        {state === "preparing" ? (
          <span className="cm-mo__prep"></span>
        ) : state === "unread" ? (
          <span className="cm-mo__dot"></span>
        ) : null}
      </span>
    </button>
  );
}
