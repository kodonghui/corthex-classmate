import React, { useId } from 'react';
import { css, cx } from '../core/cm.js';

css('cm-radio', `
.cm-radio{display:inline-flex;align-items:flex-start;gap:8px;cursor:pointer;font:var(--type-body);color:var(--text-body);position:relative;user-select:none}
.cm-radio--disabled{cursor:default;color:var(--text-disabled)}
.cm-radio__in{position:absolute;opacity:0;width:0;height:0;margin:0}
.cm-radio__dot{flex:none;width:18px;height:18px;margin-top:2px;border:1px solid var(--border-strong);border-radius:var(--radius-full);background:var(--surface-card);display:flex;align-items:center;justify-content:center;transition:var(--transition-color)}
.cm-radio__dot::after{content:"";width:8px;height:8px;border-radius:var(--radius-full);background:var(--text-on-accent);transform:scale(0);transition:transform var(--duration-fast) var(--ease-out)}
.cm-radio:hover .cm-radio__dot{border-color:var(--text-4)}
.cm-radio__in:checked + .cm-radio__dot{background:var(--action-primary);border-color:var(--action-primary)}
.cm-radio__in:checked + .cm-radio__dot::after{transform:scale(1)}
.cm-radio__in:focus-visible + .cm-radio__dot{box-shadow:var(--focus-ring)}
.cm-radio--disabled .cm-radio__dot{background:var(--surface-sunken);border-color:var(--border-hairline)}
.cm-radio--disabled .cm-radio__in:checked + .cm-radio__dot{background:var(--paper-5);border-color:var(--paper-5)}
.cm-radio__text{display:flex;flex-direction:column;gap:2px;min-width:0}
.cm-radio__desc{font:var(--type-caption);color:var(--text-tertiary)}
.cm-radiogroup{display:flex;flex-direction:column;gap:10px}
.cm-radiogroup--row{flex-direction:row;flex-wrap:wrap;gap:16px}
`);

export function Radio({ label, description, disabled = false, className, style, id, ...rest }) {
  const auto = useId();
  const inputId = id || `cm-rd-${auto}`;
  return (
    <label className={cx('cm-radio', disabled && 'cm-radio--disabled', className)} style={style} htmlFor={inputId}>
      <input id={inputId} type="radio" className="cm-radio__in" disabled={disabled} {...rest} />
      <span className="cm-radio__dot" aria-hidden="true"></span>
      {label ? <span className="cm-radio__text"><span>{label}</span>{description ? <span className="cm-radio__desc">{description}</span> : null}</span> : null}
    </label>
  );
}

export function RadioGroup({ name, value, onChange, options = [], direction = 'column', className, style }) {
  return (
    <div role="radiogroup" className={cx('cm-radiogroup', direction === 'row' && 'cm-radiogroup--row', className)} style={style}>
      {options.map(o => <Radio key={o.value} name={name} value={o.value} label={o.label} description={o.description} disabled={o.disabled} checked={value === o.value} onChange={() => onChange && onChange(o.value)} />)}
    </div>
  );
}
