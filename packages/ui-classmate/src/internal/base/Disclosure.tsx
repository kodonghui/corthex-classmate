import { useId, useState } from "react";
import type * as React from "react";

import { cx } from "../../cx";
import { Icon } from "./Icon";

/** 이름표가 붙은 펼침 줄입니다("왜 그런가요 ▾"). 학습자가 물을 때까지 상세는 감춰 둡니다. */
export interface DisclosureProps {
  label: React.ReactNode;
  /** 이름표 옆에 붙는 작은 글자입니다. 예: "Tiro 14:02" */
  meta?: React.ReactNode;
  /** 이름표 앞에 놓을 Lucide 아이콘입니다. */
  icon?: string;
  /** 여닫음을 밖에서 쥘 때 쓰는 값입니다. */
  open?: boolean;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  /** 맨 위 가는 선을 지웁니다. 여러 개를 쌓을 때 첫 줄에 씁니다. */
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
