// 정본: design-system/components/forms/Checkbox.jsx (스타일은 같은 폴더 Checkbox.css)

import type * as React from "react";
import { useId } from "react";

import { cx } from "../../cx";
import { Icon } from "../core/Icon";

/** Checkbox with label and optional description; 18px box, ink fill when checked. */
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: string;
  indeterminate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Checkbox({
  label,
  description,
  disabled = false,
  indeterminate = false,
  className,
  style,
  id,
  ...rest
}: CheckboxProps): React.JSX.Element {
  const auto = useId();
  const inputId = id || `cm-cb-${auto}`;
  return (
    <label className={cx("cm-check", disabled && "cm-check--disabled", className)} style={style} htmlFor={inputId}>
      <input
        id={inputId}
        type="checkbox"
        className="cm-check__in"
        disabled={disabled}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        {...rest}
      />
      <span className="cm-check__box" aria-hidden="true">
        <Icon name={indeterminate ? "minus" : "check"} size={14} strokeWidth={2.25} />
      </span>
      {label ? (
        <span className="cm-check__text">
          <span>{label}</span>
          {description ? <span className="cm-check__desc">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
