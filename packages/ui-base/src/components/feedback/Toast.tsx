// 정본: design-system/components/feedback/Toast.jsx (스타일은 같은 폴더 Toast.css)
// tone="dark" 는 어두운 토스트 한 종류를 뜻할 뿐, 다크 모드가 아닙니다(docs/DECISIONS.md).

import type * as React from "react";
import { useEffect, useRef } from "react";

import { cx } from "../../cx";
import { Icon } from "../core/Icon";

/** Transient confirmation ("저장했어요"); dark by default, auto-closes after 3.2s when onClose is given. */
export interface ToastProps {
  message: React.ReactNode;
  /** Lucide icon name */
  icon?: string;
  tone?: "dark" | "light";
  /** Tint the icon with the live green */
  live?: boolean;
  /** Inline text action, e.g. "보기" */
  action?: string;
  onAction?: () => void;
  /** ms before onClose fires; 0 disables */
  duration?: number;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function Toast({
  message,
  icon,
  tone = "dark",
  live = false,
  action,
  onAction,
  duration = 3200,
  onClose,
  className,
  style,
}: ToastProps): React.JSX.Element {
  const cb = useRef<(() => void) | undefined>(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!duration) return;
    const t = setTimeout(() => cb.current && cb.current(), duration);
    return () => clearTimeout(t);
  }, [duration, message]);
  return (
    <div role="status" className={cx("cm-toast", tone === "light" && "cm-toast--light", className)} style={style}>
      {icon ? (
        <span className={cx("cm-toast__ic", live && "cm-toast__ic--live")}>
          <Icon name={icon} size={16} />
        </span>
      ) : null}
      <span className="cm-toast__msg">{message}</span>
      {action ? (
        <button type="button" className="cm-toast__act" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

/** Absolutely-positioned bottom-center slot inside a relative panel. */
export interface ToastHostProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ToastHost({ children, className, style }: ToastHostProps): React.JSX.Element {
  return (
    <div className={cx("cm-toasthost", className)} style={style} aria-live="polite">
      {children}
    </div>
  );
}
