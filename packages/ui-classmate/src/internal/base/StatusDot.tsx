import type * as React from "react";

import { cx } from "../../cx";

/** 8px 상태 점입니다. 옆에 글자를 붙일 수 있고 live 인 점은 숨 쉬듯 깜박입니다. */
export interface StatusDotProps {
  state?: "live" | "paused" | "off" | "idle";
  label?: React.ReactNode;
  /** 넘기지 않으면 state 가 live 일 때만 true 입니다. */
  breathe?: boolean;
  /** 글자 색을 상태 색 대신 text-secondary 로 씁니다. */
  muted?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function StatusDot({ state = "live", label, breathe, muted = false, className, style }: StatusDotProps): React.JSX.Element {
  const b = breathe === undefined ? state === "live" : breathe;
  // role 판정은 정본 feedback/StatusDot.jsx 와 같은 참·거짓입니다. label="" 이나 label={0} 처럼
  // 아래에서 글자를 그리지 않는 값이면 role 도 붙이지 않아, 내용 없는 status 자리가 남지 않습니다.
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
