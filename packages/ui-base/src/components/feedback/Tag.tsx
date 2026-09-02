// 정본: design-system/components/feedback/Tag.jsx (스타일은 같은 폴더 Tag.css)

import type * as React from "react";

import { cx } from "../../cx";
import { Icon } from "../core/Icon";

/** Static metadata label (22px): 교시, topic, source. Not clickable — use Chip for actions. */
export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "outline" | "sunken" | "accent";
  /** Leading Lucide icon (12px) */
  icon?: string;
  /** Mono font for identifiers */
  mono?: boolean;
  /** Shows an × button */
  onRemove?: () => void;
  removeLabel?: string;
  children?: React.ReactNode;
}

export function Tag({
  tone = "outline",
  icon,
  mono = false,
  onRemove,
  removeLabel = "삭제",
  children,
  className,
  style,
  ...rest
}: TagProps): React.JSX.Element {
  return (
    <span
      className={cx(
        "cm-tag",
        tone === "sunken" && "cm-tag--sunken",
        tone === "accent" && "cm-tag--accent",
        mono && "cm-tag--mono",
        className,
      )}
      style={style}
      {...rest}
    >
      {icon ? <Icon name={icon} size={12} /> : null}
      <span className="cm-tag__t">{children}</span>
      {onRemove ? (
        <button type="button" className="cm-tag__x" aria-label={removeLabel} onClick={onRemove}>
          <Icon name="x" size={12} />
        </button>
      ) : null}
    </span>
  );
}
