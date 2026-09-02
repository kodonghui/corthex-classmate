// 정본: design-system/components/overlay/Dialog.jsx (스타일은 같은 폴더 Dialog.css)

import type * as React from "react";
import { useEffect, useId, useRef } from "react";

import { cx } from "../../cx";
import { Button } from "../core/Button";
import { IconButton } from "../core/IconButton";

/** Modal sheet sized for the panel (bottom-anchored by default). Escape / scrim click call onClose. */
export interface DialogProps {
  open: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Primary button label */
  primaryAction?: string;
  onPrimary?: () => void;
  primaryVariant?: "primary" | "danger" | "secondary";
  /** Ghost button label; default "닫기" */
  secondaryAction?: string;
  onClose?: () => void;
  /** Sheet at the bottom (default) or centered */
  position?: "bottom" | "center";
  /** position:fixed scrim instead of absolute (use when not inside a relative panel) */
  fixed?: boolean;
  /** Stack actions vertically, full width */
  stackActions?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Dialog({
  open,
  title,
  description,
  children,
  primaryAction,
  onPrimary,
  primaryVariant = "primary",
  secondaryAction = "닫기",
  onClose,
  position = "bottom",
  fixed = false,
  stackActions = false,
  className,
  style,
}: DialogProps): React.JSX.Element | null {
  const id = useId();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", onKey);
    const first = ref.current && ref.current.querySelector<HTMLElement>("button,[href],input,select,textarea");
    if (first) first.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className={cx("cm-dlg__scrim", fixed && "cm-dlg__scrim--fixed", position === "center" && "cm-dlg__scrim--center")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `cm-dlg-t-${id}` : undefined}
        aria-describedby={description ? `cm-dlg-d-${id}` : undefined}
        className={cx("cm-dlg", className)}
        style={style}
      >
        <div className="cm-dlg__head">
          {title ? (
            <h2 id={`cm-dlg-t-${id}`} className="cm-dlg__title">
              {title}
            </h2>
          ) : (
            <span style={{ flex: 1 }}></span>
          )}
          {onClose ? <IconButton icon="x" label="닫기" size="sm" onClick={onClose} className="cm-dlg__x" /> : null}
        </div>
        {description ? (
          <p id={`cm-dlg-d-${id}`} className="cm-dlg__desc">
            {description}
          </p>
        ) : null}
        {children ? <div className="cm-dlg__body">{children}</div> : null}
        {primaryAction || secondaryAction ? (
          <div className={cx("cm-dlg__acts", stackActions && "cm-dlg__acts--stack")}>
            {secondaryAction && onClose ? (
              <Button variant="ghost" onClick={onClose} full={stackActions}>
                {secondaryAction}
              </Button>
            ) : null}
            {primaryAction ? (
              <Button variant={primaryVariant} onClick={onPrimary} full={stackActions}>
                {primaryAction}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
