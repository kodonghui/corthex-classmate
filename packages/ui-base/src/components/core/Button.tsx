// 정본: design-system/components/core/Button.jsx (스타일은 같은 폴더 Button.css)

import type * as React from "react";

import { cx } from "../../cx";
import { Icon } from "./Icon";

/**
 * Action button. Only one `primary` per screen; default is `secondary`.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = the one accent block on screen; secondary = outlined; ghost = text-only; danger = red text, rare */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** 28 / 36 / 44 px */
  size?: "sm" | "md" | "lg";
  /** Leading Lucide icon name */
  icon?: string;
  /** Trailing Lucide icon name */
  iconRight?: string;
  /** Stretch to container width */
  full?: boolean;
  /** Shows a slow spinner and disables the button */
  loading?: boolean;
  children?: React.ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  full = false,
  loading = false,
  disabled = false,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps): React.JSX.Element {
  const iconSize = size === "sm" ? 14 : size === "lg" ? 18 : 16;
  return (
    <button
      type={type}
      className={cx("cm-btn", `cm-btn--${variant}`, `cm-btn--${size}`, full && "cm-btn--full", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Icon name="loader-circle" size={iconSize} style={{ animation: "cm-spin 1.2s linear infinite" }} />
      ) : icon ? (
        <Icon name={icon} size={iconSize} />
      ) : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={iconSize} /> : null}
    </button>
  );
}
