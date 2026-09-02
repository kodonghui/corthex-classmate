import React, { useId } from 'react';
import { css, cx } from '../core/cm.js';
import { Icon } from '../core/Icon.jsx';

css('cm-checkbox', `
.cm-check{display:inline-flex;align-items:flex-start;gap:8px;cursor:pointer;font:var(--type-body);color:var(--text-body);position:relative;user-select:none}
.cm-check--disabled{cursor:default;color:var(--text-disabled)}
.cm-check__in{position:absolute;opacity:0;width:0;height:0;margin:0}
.cm-check__box{flex:none;width:18px;height:18px;margin-top:2px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);background:var(--surface-card);display:flex;align-items:center;justify-content:center;color:var(--text-on-accent);transition:var(--transition-color)}
.cm-check:hover .cm-check__box{border-color:var(--text-4)}
.cm-check__in:checked + .cm-check__box{background:var(--action-primary);border-color:var(--action-primary)}
.cm-check__in:focus-visible + .cm-check__box{box-shadow:var(--focus-ring)}
.cm-check--disabled .cm-check__box{background:var(--surface-sunken);border-color:var(--border-hairline)}
.cm-check--disabled .cm-check__in:checked + .cm-check__box{background:var(--paper-5);border-color:var(--paper-5)}
.cm-check__text{display:flex;flex-direction:column;gap:2px;min-width:0}
.cm-check__desc{font:var(--type-caption);color:var(--text-tertiary)}
`);

export function Checkbox({ label, description, disabled = false, indeterminate = false, className, style, id, ...rest }) {
  const auto = useId();
  const inputId = id || `cm-cb-${auto}`;
  return (
    <label className={cx('cm-check', disabled && 'cm-check--disabled', className)} style={style} htmlFor={inputId}>
      <input id={inputId} type="checkbox" className="cm-check__in" disabled={disabled} ref={el => { if (el) el.indeterminate = indeterminate; }} {...rest} />
      <span className="cm-check__box" aria-hidden="true"><Icon name={indeterminate ? 'minus' : 'check'} size={14} strokeWidth={2.25} /></span>
      {label ? <span className="cm-check__text"><span>{label}</span>{description ? <span className="cm-check__desc">{description}</span> : null}</span> : null}
    </label>
  );
}
