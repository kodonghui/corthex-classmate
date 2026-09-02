import type * as React from "react";

import { cx } from "../../cx";
import { Icon } from "./Icon";

/**
 * 후속 질문("더 쉽게", "예시 더")과 거르개에 쓰는 작은 칩입니다. `selected` 로 켜고 끕니다.
 */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 글자 앞에 놓을 Lucide 아이콘 이름입니다(14px). */
  icon?: string;
  selected?: boolean;
  children?: React.ReactNode;
}

export function Chip({
  icon,
  selected = false,
  disabled = false,
  children,
  className,
  type = "button",
  ...rest
}: ChipProps): React.JSX.Element {
  const pressed = selected ? ({ "aria-pressed": true } as const) : {};
  return (
    <button
      type={type}
      className={cx("cm-chip", selected && "cm-chip--selected", className)}
      disabled={disabled}
      {...pressed}
      {...rest}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  );
}

/** 칩을 6px 간격으로 늘어놓고 넘치면 줄을 바꾸는 가로줄입니다. */
export interface ChipGroupProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ChipGroup({ children, className, style }: ChipGroupProps): React.JSX.Element {
  return (
    <div className={cx("cm-chipgroup", className)} style={style}>
      {children}
    </div>
  );
}
