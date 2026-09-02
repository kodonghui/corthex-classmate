// 정본: design-system/components/feedback/Badge.jsx (스타일은 같은 폴더 Badge.css)

import type * as React from "react";

import { cx } from "../../cx";

/** Tiny count/status pill (18px) or an 8px dot. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "soft" | "live" | "paused" | "off";
  /** Render as an 8px dot with no text */
  dot?: boolean;
  children?: React.ReactNode;
}

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
  style,
  ...rest
}: BadgeProps): React.JSX.Element {
  return (
    <span className={cx("cm-badge", `cm-badge--${tone}`, dot && "cm-badge--dot", className)} style={style} {...rest}>
      {dot ? null : children}
    </span>
  );
}
