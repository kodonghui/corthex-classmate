// 정본: design-system/components/feedback/Banner.jsx (스타일은 같은 폴더 Banner.css)

import type * as React from "react";

import { cx } from "../../cx";
import { Button } from "../core/Button";
import { Icon } from "../core/Icon";
import { IconButton } from "../core/IconButton";

/**
 * Inline, persistent status banner: what stopped, what continues, one action. Amber by default; red only for total loss.
 */
export interface BannerProps {
  tone?: "paused" | "off" | "info" | "live";
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Primary action label, e.g. "다시 연결" */
  action?: string;
  onAction?: () => void;
  secondaryAction?: string;
  onSecondaryAction?: () => void;
  /** Shows an × button */
  onDismiss?: () => void;
  /** Override the tone icon */
  icon?: string;
  className?: string;
  style?: React.CSSProperties;
}

const ICONS: Record<"paused" | "off" | "info" | "live", string> = {
  paused: "pause-circle",
  off: "wifi-off",
  info: "info",
  live: "circle-check",
};

export function Banner({
  tone = "paused",
  title,
  description,
  action,
  onAction,
  secondaryAction,
  onSecondaryAction,
  onDismiss,
  icon,
  className,
  style,
}: BannerProps): React.JSX.Element {
  return (
    <div role="status" className={cx("cm-banner", `cm-banner--${tone}`, className)} style={style}>
      <span className="cm-banner__ic">
        <Icon name={icon || ICONS[tone]} size={16} />
      </span>
      <div className="cm-banner__body">
        {title ? <div className="cm-banner__title">{title}</div> : null}
        {description ? <div className="cm-banner__desc">{description}</div> : null}
        {action || secondaryAction ? (
          <div className="cm-banner__act">
            {action ? (
              <Button
                size="sm"
                onClick={onAction}
                style={{ color: "inherit", borderColor: "currentColor", background: "transparent" }}
              >
                {action}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button size="sm" variant="ghost" onClick={onSecondaryAction} style={{ color: "inherit" }}>
                {secondaryAction}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {onDismiss ? <IconButton icon="x" label="닫기" size="sm" onClick={onDismiss} className="cm-banner__x" /> : null}
    </div>
  );
}
