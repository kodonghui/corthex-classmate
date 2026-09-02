// 정본: design-system/components/feedback/StatusDot.jsx (스타일은 같은 폴더 StatusDot.css)

import type * as React from "react";

import { cx } from "../../cx";

/** 8px status dot with optional caption; live dots breathe. */
export interface StatusDotProps {
  state?: "live" | "paused" | "off" | "idle";
  label?: React.ReactNode;
  /** Defaults to true for live */
  breathe?: boolean;
  /** Use text-secondary instead of the status color for the label */
  muted?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function StatusDot({
  state = "live",
  label,
  breathe,
  muted = false,
  className,
  style,
}: StatusDotProps): React.JSX.Element {
  const b = breathe === undefined ? state === "live" : breathe;
  return (
    <span
      className={cx("cm-sd", `cm-sd--${state}`, b && "cm-sd--breathe", muted && "cm-sd--muted", className)}
      style={style}
      role={label ? "status" : undefined}
    >
      <span className="cm-sd__dot" aria-hidden="true"></span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}
