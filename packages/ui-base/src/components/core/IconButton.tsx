// 정본: design-system/components/core/IconButton.jsx (스타일은 같은 폴더 IconButton.css)

import type * as React from "react";

import { cx } from "../../cx";
import { Icon } from "./Icon";

/** Square icon-only button. `label` is required and becomes aria-label + title. */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Lucide icon name */
  icon: string;
  /** Accessible name, e.g. "닫기" */
  label: string;
  /** 28 / 36 px square */
  size?: "sm" | "md";
  variant?: "ghost" | "secondary";
  /** Pressed/selected state (ink tint) */
  active?: boolean;
}

export function IconButton({
  icon,
  label,
  size = "md",
  variant = "ghost",
  active = false,
  disabled = false,
  className,
  type = "button",
  ...rest
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={cx(
        "cm-ibtn",
        `cm-ibtn--${size}`,
        variant === "secondary" && "cm-ibtn--secondary",
        active && "cm-ibtn--active",
        className,
      )}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 16 : 18} />
    </button>
  );
}
