import type * as React from "react";

import { cx } from "../../cx";
import { Icon } from "./Icon";

/** 눌리지 않는 22px 이름표입니다. 교시 · 주제 · 자료 같은 곁정보를 답니다. 누르는 것은 Chip 을 씁니다. */
export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "outline" | "sunken" | "accent";
  /** 글자 앞에 놓을 Lucide 아이콘입니다(12px). */
  icon?: string;
  /** 식별자를 보여 줄 때 고정폭 글꼴로 그립니다. */
  mono?: boolean;
  /** × 버튼을 보여 줍니다. */
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
