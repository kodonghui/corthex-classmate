import type * as React from "react";

import { cx } from "../cx";

/** 지금 선생님이 어디를 하고 있는지 한 줄로 알립니다("지금 · 생성자 주입 코드로 넘어갔어요"). 학습자가 수업으로 돌아오는 발판입니다. */
export interface NowLineProps {
  children?: React.ReactNode;
  /** rule 은 가는 선 사이 가운데(전사 안), plain 은 초록 점 + 글자입니다. */
  variant?: "rule" | "plain";
  className?: string;
  style?: React.CSSProperties;
}

// 지금 선생님이 어디를 하고 있는지 알려 학습자가 수업으로 돌아오게 합니다. variant 는 rule(가운데) | plain(점 + 글자) 입니다.
export function NowLine({ children, variant = "rule", className, style }: NowLineProps): React.JSX.Element {
  return (
    <div className={cx("cm-now", `cm-now--${variant}`, className)} style={style} role="status">
      {variant === "plain" ? <span className="cm-now__d" aria-hidden="true"></span> : null}
      <span className="cm-now__t">{children}</span>
    </div>
  );
}
