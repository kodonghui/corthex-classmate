import React, { useId } from 'react';
import { css, cx } from '../core/cm.js';
import { Icon } from '../core/Icon.jsx';

css('cm-input', `
.cm-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.cm-field__label{font:var(--type-label);color:var(--text-secondary)}
.cm-input{position:relative;display:flex;align-items:center;min-width:0}
.cm-input__el{width:100%;min-width:0;height:var(--control-h-md);padding:0 12px;border:1px solid var(--border-strong);border-radius:var(--radius-md);background:var(--surface-card);color:var(--text-body);font:var(--type-body);letter-spacing:var(--text-body-ls);transition:var(--transition-color);outline:none;margin:0;-webkit-appearance:none;appearance:none}
.cm-input--lg .cm-input__el{height:var(--control-h-lg);padding:0 14px}
.cm-input--icon .cm-input__el{padding-left:36px}
.cm-input--trail .cm-input__el{padding-right:40px}
.cm-input__el::placeholder{color:var(--text-placeholder)}
.cm-input__el:hover{border-color:var(--text-4)}
.cm-input__el:focus{border-color:var(--border-focus);box-shadow:0 0 0 3px var(--ink-100)}
.cm-input__el[disabled]{background:var(--surface-sunken);color:var(--text-disabled);border-color:var(--border-hairline)}
.cm-input--invalid .cm-input__el{border-color:var(--status-off)}
.cm-input--invalid .cm-input__el:focus{box-shadow:0 0 0 3px var(--red-100)}
.cm-input__icon{position:absolute;left:12px;color:var(--text-tertiary);pointer-events:none;display:flex}
.cm-input__trail{position:absolute;right:4px;display:flex}
.cm-field__hint{font:var(--type-caption);color:var(--text-tertiary)}
.cm-field--invalid .cm-field__hint{color:var(--status-off-text)}
`);

export function Input({ label, hint, icon, trailing, size = 'md', invalid = false, className, style, id, ...rest }) {
  const auto = useId();
  const inputId = id || `cm-in-${auto}`;
  return (
    <div className={cx('cm-field', invalid && 'cm-field--invalid', className)} style={style}>
      {label ? <label className="cm-field__label" htmlFor={inputId}>{label}</label> : null}
      <div className={cx('cm-input', `cm-input--${size}`, icon && 'cm-input--icon', trailing && 'cm-input--trail', invalid && 'cm-input--invalid')}>
        {icon ? <span className="cm-input__icon"><Icon name={icon} size={16} /></span> : null}
        <input id={inputId} className="cm-input__el" aria-invalid={invalid || undefined} {...rest} />
        {trailing ? <span className="cm-input__trail">{trailing}</span> : null}
      </div>
      {hint ? <div className="cm-field__hint">{hint}</div> : null}
    </div>
  );
}
