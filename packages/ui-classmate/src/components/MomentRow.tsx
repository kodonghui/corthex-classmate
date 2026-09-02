import type * as React from "react";

import { cx } from "../cx";

/** 기록에 쌓인 붙잡은 순간 한 줄입니다. 시각 · 낱말 · 한 줄 답 순서이고 줄 전체가 버튼입니다. */
export interface MomentRowProps {
  /** "10:32:18" */
  time: string;
  /** 붙잡은 낱말입니다. 문장을 통째로 붙잡았으면 "문장" 이 들어옵니다. */
  term?: React.ReactNode;
  /** 한 문장 결론입니다. 두 줄까지만 보이고 넘치면 잘립니다. */
  title?: React.ReactNode;
  period?: string;
  topic?: string;
  state?: "ready" | "preparing" | "unread";
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

// 기록의 붙잡은 순간 하나입니다. 언제 · 어느 낱말 · 한 줄 답. 줄 전체가 버튼이고 화살표나 아이콘을 덧붙이지 않습니다.
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
