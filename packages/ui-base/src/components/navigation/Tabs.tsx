// 정본: design-system/components/navigation/Tabs.jsx (스타일은 같은 폴더 Tabs.css)

import type * as React from "react";

import { cx } from "../../cx";
import { Badge } from "../feedback/Badge";
import { Icon } from "../core/Icon";

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: string;
  count?: number;
  disabled?: boolean;
}

/** Underline tabs (default) or a segmented control; controlled via value/onChange. */
export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange?: (id: string) => void;
  /** 40 / 32 px tall */
  size?: "md" | "sm";
  variant?: "underline" | "segmented";
  /** Tabs share the width equally */
  fill?: boolean;
  "aria-label"?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Tabs({
  items = [],
  value,
  onChange,
  size = "md",
  variant = "underline",
  fill = false,
  className,
  style,
  "aria-label": ariaLabel,
}: TabsProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx(
        "cm-tabs",
        size === "sm" && "cm-tabs--sm",
        variant === "segmented" && "cm-tabs--seg",
        fill && "cm-tabs--fill",
        className,
      )}
      style={style}
    >
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx("cm-tab", active && "cm-tab--active")}
            onClick={() => onChange && onChange(it.id)}
            disabled={it.disabled}
          >
            {it.icon ? <Icon name={it.icon} size={16} /> : null}
            <span>{it.label}</span>
            {it.count != null ? <Badge tone={active ? "soft" : "neutral"}>{it.count}</Badge> : null}
          </button>
        );
      })}
    </div>
  );
}
