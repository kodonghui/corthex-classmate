// 정본: design-system/components/forms/Input.jsx (스타일은 같은 폴더 Input.css)
// 이 파일의 CSS 가 `.cm-field` 를 정의합니다. Select.css 보다 먼저 실려야 합니다(styles.css 순서).

import type * as React from "react";
import { useId } from "react";

import { cx } from "../../cx";
import { Icon } from "../core/Icon";

/**
 * Single-line text field with optional label, leading icon, trailing slot and hint.
 */
// 정본 .d.ts 는 `extends React.InputHTMLAttributes<HTMLInputElement>` 였지만,
// HTML 의 size 는 number 라 Classmate 의 'md' | 'lg' 와 부딪힙니다. size 만 빼고 물려받습니다.
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  /** Helper or error text under the field */
  hint?: string;
  /** Leading Lucide icon name */
  icon?: string;
  /** Trailing element, e.g. an IconButton size="sm" */
  trailing?: React.ReactNode;
  /** 36 / 44 px */
  size?: "md" | "lg";
  invalid?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Input({
  label,
  hint,
  icon,
  trailing,
  size = "md",
  invalid = false,
  className,
  style,
  id,
  ...rest
}: InputProps): React.JSX.Element {
  const auto = useId();
  const inputId = id || `cm-in-${auto}`;
  return (
    <div className={cx("cm-field", invalid && "cm-field--invalid", className)} style={style}>
      {label ? (
        <label className="cm-field__label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <div
        className={cx(
          "cm-input",
          `cm-input--${size}`,
          icon && "cm-input--icon",
          // 정본은 `trailing && …` 입니다. trailing 은 ReactNode 라 `!!` 로 boolean 을 만들어 넘깁니다.
          !!trailing && "cm-input--trail",
          invalid && "cm-input--invalid",
        )}
      >
        {icon ? (
          <span className="cm-input__icon">
            <Icon name={icon} size={16} />
          </span>
        ) : null}
        <input id={inputId} className="cm-input__el" aria-invalid={invalid || undefined} {...rest} />
        {trailing ? <span className="cm-input__trail">{trailing}</span> : null}
      </div>
      {hint ? <div className="cm-field__hint">{hint}</div> : null}
    </div>
  );
}
