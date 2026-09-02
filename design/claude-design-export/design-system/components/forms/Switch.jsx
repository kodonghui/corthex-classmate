import React, { useId } from 'react';
import { css, cx } from '../core/cm.js';

css('cm-switch', `
.cm-switch{display:inline-flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;font:var(--type-body);color:var(--text-body);position:relative;user-select:none;min-width:0}
.cm-switch--disabled{cursor:default;color:var(--text-disabled)}
.cm-switch__in{position:absolute;opacity:0;width:0;height:0;margin:0}
.cm-switch__track{flex:none;width:34px;height:20px;border-radius:var(--radius-full);background:var(--paper-5);position:relative;transition:var(--transition-color)}
.cm-switch__track::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:var(--radius-full);background:var(--white);box-shadow:var(--shadow-sm);transition:transform var(--duration-base) var(--ease-out)}
.cm-switch:hover .cm-switch__track{background:var(--text-4)}
.cm-switch__in:checked + .cm-switch__track{background:var(--action-primary)}
.cm-switch:hover .cm-switch__in:checked + .cm-switch__track{background:var(--action-primary-hover)}
.cm-switch__in:checked + .cm-switch__track::after{transform:translateX(14px)}
.cm-switch__in:focus-visible + .cm-switch__track{box-shadow:var(--focus-ring)}
.cm-switch--disabled .cm-switch__track,.cm-switch--disabled:hover .cm-switch__track{background:var(--paper-4)}
.cm-switch__text{display:flex;flex-direction:column;gap:2px;min-width:0}
.cm-switch__desc{font:var(--type-caption);color:var(--text-tertiary)}
`);

export function Switch({ label, description, disabled = false, labelPosition = 'start', className, style, id, ...rest }) {
  const auto = useId();
  const inputId = id || `cm-sw-${auto}`;
  const text = label ? <span className="cm-switch__text"><span>{label}</span>{description ? <span className="cm-switch__desc">{description}</span> : null}</span> : null;
  return (
    <label className={cx('cm-switch', disabled && 'cm-switch--disabled', className)} style={style} htmlFor={inputId}>
      {labelPosition === 'start' ? text : null}
      <input id={inputId} type="checkbox" role="switch" className="cm-switch__in" disabled={disabled} {...rest} />
      <span className="cm-switch__track" aria-hidden="true"></span>
      {labelPosition === 'end' ? text : null}
    </label>
  );
}
