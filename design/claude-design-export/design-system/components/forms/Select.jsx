import React, { useId } from 'react';
import { css, cx } from '../core/cm.js';
import { Icon } from '../core/Icon.jsx';

css('cm-select', `
.cm-select{position:relative;display:flex;align-items:center;min-width:0}
.cm-select__el{width:100%;min-width:0;height:var(--control-h-md);padding:0 32px 0 12px;border:1px solid var(--border-strong);border-radius:var(--radius-md);background:var(--surface-card);color:var(--text-body);font:var(--type-body);letter-spacing:var(--text-body-ls);transition:var(--transition-color);outline:none;margin:0;-webkit-appearance:none;appearance:none;cursor:pointer}
.cm-select--sm .cm-select__el{height:var(--control-h-sm);font:var(--type-label);padding:0 28px 0 10px}
.cm-select__el:hover{border-color:var(--text-4)}
.cm-select__el:focus{border-color:var(--border-focus);box-shadow:0 0 0 3px var(--ink-100)}
.cm-select__el[disabled]{background:var(--surface-sunken);color:var(--text-disabled);border-color:var(--border-hairline);cursor:default}
.cm-select__chev{position:absolute;right:10px;color:var(--text-tertiary);pointer-events:none;display:flex}
.cm-select--sm .cm-select__chev{right:8px}
`);

export function Select({ label, options = [], size = 'md', className, style, id, ...rest }) {
  const auto = useId();
  const selectId = id || `cm-sel-${auto}`;
  return (
    <div className={cx('cm-field', className)} style={style}>
      {label ? <label className="cm-field__label" htmlFor={selectId} style={{ font: 'var(--type-label)', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{label}</label> : null}
      <div className={cx('cm-select', `cm-select--${size}`)}>
        <select id={selectId} className="cm-select__el" {...rest}>
          {options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
        <span className="cm-select__chev"><Icon name="chevron-down" size={size === 'sm' ? 14 : 16} /></span>
      </div>
    </div>
  );
}
