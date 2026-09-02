import type * as React from "react";

import { cx } from "../cx";

/** One line saying where the teacher is right now ("지금 · 생성자 주입 코드로 넘어갔어요") so the learner can step back in. */
export interface NowLineProps {
  children?: React.ReactNode;
  /** rule = centered between hairlines (inside the transcript) · plain = green dot + text */
  variant?: "rule" | "plain";
  className?: string;
  style?: React.CSSProperties;
}

// Where the teacher is right now — so the learner can step back into class. variant: rule (centered) | plain (dot + text)
export function NowLine({ children, variant = "rule", className, style }: NowLineProps): React.JSX.Element {
  return (
    <div className={cx("cm-now", `cm-now--${variant}`, className)} style={style} role="status">
      {variant === "plain" ? <span className="cm-now__d" aria-hidden="true"></span> : null}
      <span className="cm-now__t">{children}</span>
    </div>
  );
}
