import type * as React from "react";

import { cx } from "../cx";
import { Icon } from "../internal/base";

/**
 * The one hero action (56px): "지금 막혔어요". Saves the recent transcript, Meet frame and IntelliJ code in one press.
 *
 * `shortcut` 은 오른쪽에 보여 주는 안내(<kbd>)일 뿐이고 키를 잡지는 않습니다. 정본도 그렇고,
 * Alt+S 를 실제로 듣는 자리는 사이드패널 화면입니다(docs/DECISIONS.md: `e.code === "KeyS"` 로 판정).
 */
export interface StuckButtonProps {
  /** idle → saving (sweep bar, disabled) → saved (check) */
  state?: "idle" | "saving" | "saved";
  /** Override the state label */
  label?: React.ReactNode;
  /** Caption under the button; pass '' to hide */
  sublabel?: React.ReactNode;
  /** Keyboard hint shown at the right, e.g. "Alt+S" */
  shortcut?: string;
  /** Outlined, low-emphasis version for screens where it is not the primary action */
  quiet?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const LABEL: Record<string, string> = { idle: "지금 막혔어요", saving: "저장하고 있어요", saved: "저장했어요" };
const ICON: Record<string, string> = { idle: "hand", saving: "bookmark", saved: "circle-check" };

export function StuckButton({
  state = "idle",
  label,
  sublabel = "최근 30초 전사 · Meet 화면 · IntelliJ 코드를 함께 저장해요",
  shortcut,
  quiet = false,
  disabled = false,
  onClick,
  className,
  style,
}: StuckButtonProps): React.JSX.Element {
  const busy = state === "saving";
  const busyAttr = busy ? ({ "aria-busy": true } as const) : {};
  return (
    <div className={cx("cm-stuck", className)} style={style}>
      <button
        type="button"
        className={cx("cm-stuck__btn", `cm-stuck__btn--${state}`, quiet && "cm-stuck__btn--quiet")}
        onClick={onClick}
        disabled={disabled || busy}
        aria-live="polite"
        {...busyAttr}
      >
        <Icon name={ICON[state] || "hand"} size={20} strokeWidth={2} />
        <span>{label || LABEL[state]}</span>
        {shortcut && state === "idle" ? (
          <kbd className="cm-stuck__kbd" aria-hidden="true">
            {shortcut}
          </kbd>
        ) : null}
        {busy ? <span className="cm-stuck__bar" aria-hidden="true"></span> : null}
      </button>
      {sublabel ? <div className="cm-stuck__sub">{sublabel}</div> : null}
    </div>
  );
}
