// 정본: design-system/components/forms/Switch.jsx (스타일은 같은 폴더 Switch.css)

import type * as React from "react";
import { useId } from "react";

import { cx } from "../../cx";

/** On/off switch (34×20) with label on the left by default — used for settings rows. */
export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: string;
  /** Where the label sits relative to the track */
  labelPosition?: "start" | "end";
  className?: string;
  style?: React.CSSProperties;
}

export function Switch({
  label,
  description,
  disabled = false,
  labelPosition = "start",
  className,
  style,
  id,
  ...rest
}: SwitchProps): React.JSX.Element {
  const auto = useId();
  const inputId = id || `cm-sw-${auto}`;
  const text = label ? (
    <span className="cm-switch__text">
      <span>{label}</span>
      {description ? <span className="cm-switch__desc">{description}</span> : null}
    </span>
  ) : null;
  return (
    <label className={cx("cm-switch", disabled && "cm-switch--disabled", className)} style={style} htmlFor={inputId}>
      {labelPosition === "start" ? text : null}
      <input id={inputId} type="checkbox" role="switch" className="cm-switch__in" disabled={disabled} {...rest} />
      <span className="cm-switch__track" aria-hidden="true"></span>
      {labelPosition === "end" ? text : null}
    </label>
  );
}
