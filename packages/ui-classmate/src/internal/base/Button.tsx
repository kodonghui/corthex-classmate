import type * as React from "react";

import { cx } from "../../cx";
import { Icon } from "./Icon";

/**
 * 동작 버튼입니다. 화면마다 `primary` 는 하나뿐이고 기본값은 `secondary` 입니다.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary 는 화면에 하나뿐인 강조 덩어리, secondary 는 테두리, ghost 는 글자만, danger 는 빨간 글자(드물게)입니다. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** 28 / 36 / 44 px */
  size?: "sm" | "md" | "lg";
  /** 글자 앞에 놓을 Lucide 아이콘 이름입니다. */
  icon?: string;
  /** 글자 뒤에 놓을 Lucide 아이콘 이름입니다. */
  iconRight?: string;
  /** 담긴 자리의 너비만큼 늘립니다. */
  full?: boolean;
  /** 느리게 도는 표시를 보여 주고 버튼을 누를 수 없게 합니다. */
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
  const busy = loading ? ({ "aria-busy": true } as const) : {};
  return (
    <button
      type={type}
      className={cx("cm-btn", `cm-btn--${variant}`, `cm-btn--${size}`, full && "cm-btn--full", className)}
      disabled={disabled || loading}
      {...busy}
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
