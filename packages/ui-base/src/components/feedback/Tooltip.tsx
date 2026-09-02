// 정본: design-system/components/feedback/Tooltip.jsx (스타일은 같은 폴더 Tooltip.css)

import type * as React from "react";
import { useId, useState } from "react";

import { cx } from "../../cx";

/** Hover/focus tooltip for icon-only controls. */
export interface TooltipProps {
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  /** Controlled visibility */
  open?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Tooltip({ content, side = "top", open, children, className, style }: TooltipProps): React.JSX.Element {
  const [hover, setHover] = useState(false);
  const id = useId();
  const show = open === undefined ? hover : open;
  return (
    <span
      className={cx("cm-tt", className)}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-describedby={show ? `cm-tt-${id}` : undefined}
    >
      {children}
      {show ? (
        <span role="tooltip" id={`cm-tt-${id}`} className={cx("cm-tt__bub", `cm-tt__bub--${side}`)}>
          {content}
        </span>
      ) : null}
    </span>
  );
}
