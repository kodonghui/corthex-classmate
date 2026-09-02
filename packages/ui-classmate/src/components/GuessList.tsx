import type * as React from "react";

import { cx } from "../cx";
import { Icon } from "../internal/base";

export interface GuessOption {
  id: string;
  label: React.ReactNode;
}
/** "혹시 이게 막혔나요?" — 낱말이 아니라 문장을 통째로 붙잡았을 때 튜터가 내놓는 짐작 2~3개입니다. 하나를 고르면 한 문장 답이 옵니다. */
export interface GuessListProps {
  title?: React.ReactNode;
  options: GuessOption[];
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

// "혹시 이게 막혔나요?" — 학습자가 문장을 통째로 붙잡았을 때 튜터가 내놓는 짐작 목록입니다.
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
