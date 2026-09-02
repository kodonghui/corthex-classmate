import type * as React from "react";

import { cx } from "../cx";
import { Icon } from "../internal/base";

export interface GuessOption {
  id: string;
  label: React.ReactNode;
}
/** "혹시 이게 막혔나요?" — the tutor's 2–3 guesses when a whole sentence (not a word) was caught. Pick one to get the one-sentence answer. */
export interface GuessListProps {
  title?: React.ReactNode;
  options: GuessOption[];
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

// "혹시 이게 막혔나요?" — the tutor's three guesses when the learner caught a whole sentence.
export function GuessList({
  title = "혹시 이게 막혔나요?",
  options = [],
  value,
  onChange,
  className,
  style,
}: GuessListProps): React.JSX.Element {
  const labelled = typeof title === "string" ? ({ "aria-label": title } as const) : {};
  return (
    <div className={cx("cm-gl", className)} style={style} role="group" {...labelled}>
      {title ? <p className="cm-gl__t">{title}</p> : null}
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            className={cx("cm-gl__o", on && "cm-gl__o--on")}
            aria-pressed={on}
            onClick={() => onChange && onChange(o.id)}
          >
            <span>{o.label}</span>
            <Icon name={on ? "check" : "chevron-right"} size={14} />
          </button>
        );
      })}
    </div>
  );
}
