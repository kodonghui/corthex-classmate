import { useId, useState } from "react";
import type * as React from "react";

import { cx } from "../../cx";
import { Icon } from "./Icon";

/** Labeled expandable row ("왜 그런가요 ▾"). Details stay hidden until the learner asks. */
export interface DisclosureProps {
  label: React.ReactNode;
  /** Caption next to the label, e.g. "Tiro 14:02" */
  meta?: React.ReactNode;
  /** Leading Lucide icon */
  icon?: string;
  /** Controlled open state */
  open?: boolean;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  /** Removes the top hairline (first in a stack) */
  first?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Disclosure({
  label,
  meta,
  icon,
  open,
  defaultOpen = false,
  onToggle,
  first = false,
  children,
  className,
  style,
}: DisclosureProps): React.JSX.Element {
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = open === undefined ? inner : open;
  const id = useId();
  const toggle = (): void => {
    const next = !isOpen;
    if (open === undefined) setInner(next);
    if (onToggle) onToggle(next);
  };
  return (
    <div className={cx("cm-disc", isOpen && "cm-disc--open", first && "cm-disc--first", className)} style={style}>
      <button type="button" className="cm-disc__btn" aria-expanded={isOpen} aria-controls={`cm-disc-${id}`} onClick={toggle}>
        <span className="cm-disc__lbl">
          {icon ? <Icon name={icon} size={16} /> : null}
          <span>{label}</span>
          {meta ? <span className="cm-disc__meta">{meta}</span> : null}
        </span>
        <span className="cm-disc__chev">
          <Icon name="chevron-down" size={16} />
        </span>
      </button>
      {isOpen ? (
        <div id={`cm-disc-${id}`} className="cm-disc__body">
          {children}
        </div>
      ) : null}
    </div>
  );
}
