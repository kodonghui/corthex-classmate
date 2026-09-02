// 정본: design-system/components/forms/Select.jsx (스타일은 같은 폴더 Select.css)
// `.cm-field` 는 Input.css 가 정의합니다.

import type * as React from "react";
import { useId } from "react";

import { cx } from "../../cx";
import { Icon } from "../core/Icon";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Native select styled as a Classmate control with a chevron. */
// 정본 .d.ts 는 `extends React.SelectHTMLAttributes<HTMLSelectElement>` 였지만,
// HTML 의 size 는 number 라 Classmate 의 'sm' | 'md' 와 부딪힙니다. size 만 빼고 물려받습니다.
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  /** Strings or {value,label} objects */
  options: Array<string | SelectOption>;
  /** 28 / 36 px */
  size?: "sm" | "md";
  className?: string;
  style?: React.CSSProperties;
}

export function Select({
  label,
  options = [],
  size = "md",
  className,
  style,
  id,
  ...rest
}: SelectProps): React.JSX.Element {
  const auto = useId();
  const selectId = id || `cm-sel-${auto}`;
  return (
    <div className={cx("cm-field", className)} style={style}>
      {label ? (
        <label
          className="cm-field__label"
          htmlFor={selectId}
          style={{ font: "var(--type-label)", color: "var(--text-secondary)", display: "block", marginBottom: 6 }}
        >
          {label}
        </label>
      ) : null}
      <div className={cx("cm-select", `cm-select--${size}`)}>
        <select id={selectId} className="cm-select__el" {...rest}>
          {options.map((o) =>
            typeof o === "string" ? (
              <option key={o} value={o}>
                {o}
              </option>
            ) : (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ),
          )}
        </select>
        <span className="cm-select__chev">
          <Icon name="chevron-down" size={size === "sm" ? 14 : 16} />
        </span>
      </div>
    </div>
  );
}
