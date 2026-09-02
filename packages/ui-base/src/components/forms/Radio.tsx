// 정본: design-system/components/forms/Radio.jsx (스타일은 같은 폴더 Radio.css)

import type * as React from "react";
import { useId } from "react";

import { cx } from "../../cx";

/** Single radio with label/description. Prefer RadioGroup for a set. */
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Radio({
  label,
  description,
  disabled = false,
  className,
  style,
  id,
  ...rest
}: RadioProps): React.JSX.Element {
  const auto = useId();
  const inputId = id || `cm-rd-${auto}`;
  return (
    <label className={cx("cm-radio", disabled && "cm-radio--disabled", className)} style={style} htmlFor={inputId}>
      <input id={inputId} type="radio" className="cm-radio__in" disabled={disabled} {...rest} />
      <span className="cm-radio__dot" aria-hidden="true"></span>
      {label ? (
        <span className="cm-radio__text">
          <span>{label}</span>
          {description ? <span className="cm-radio__desc">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}

export interface RadioGroupOption {
  value: string;
  label: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

/** Controlled group of radios. */
export interface RadioGroupProps {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  options: RadioGroupOption[];
  direction?: "column" | "row";
  className?: string;
  style?: React.CSSProperties;
}

export function RadioGroup({
  name,
  value,
  onChange,
  options = [],
  direction = "column",
  className,
  style,
}: RadioGroupProps): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      className={cx("cm-radiogroup", direction === "row" && "cm-radiogroup--row", className)}
      style={style}
    >
      {options.map((o) => (
        <Radio
          key={o.value}
          name={name}
          value={o.value}
          label={o.label}
          // exactOptionalPropertyTypes 라 description 이 없으면 아예 넘기지 않습니다.
          {...(o.description === undefined ? {} : { description: o.description })}
          disabled={o.disabled}
          checked={value === o.value}
          onChange={() => onChange && onChange(o.value)}
        />
      ))}
    </div>
  );
}
