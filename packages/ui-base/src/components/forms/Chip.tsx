// 정본: design-system/components/forms/Chip.jsx (스타일은 같은 폴더 Chip.css)

import type * as React from "react";

import { cx } from "../../cx";
import { Icon } from "../core/Icon";

/**
 * Small actionable chip for quick follow-ups ("더 쉽게", "예시 더") and filters. Toggle with `selected`.
 */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Leading Lucide icon name (14px) */
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
  return (
    <button
      type={type}
      className={cx("cm-chip", selected && "cm-chip--selected", className)}
      aria-pressed={selected || undefined}
      disabled={disabled}
      {...rest}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  );
}

/** Wrapping flex row with 6px gaps for chips. */
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
