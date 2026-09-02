import React from 'react';
import { css, cx } from './cm.js';
import { Icon } from './Icon.jsx';

css('cm-iconbutton', `
.cm-ibtn{display:inline-flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:var(--radius-md);background:transparent;color:var(--text-secondary);cursor:pointer;transition:var(--transition-color);padding:0;margin:0;-webkit-tap-highlight-color:transparent}
.cm-ibtn:hover{background:var(--surface-hover);color:var(--text-body)}
.cm-ibtn:active{background:var(--surface-pressed)}
.cm-ibtn:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-ibtn[disabled]{color:var(--text-disabled);background:transparent;cursor:default}
.cm-ibtn--sm{width:var(--control-h-sm);height:var(--control-h-sm)}
.cm-ibtn--md{width:var(--control-h-md);height:var(--control-h-md)}
.cm-ibtn--secondary{background:var(--surface-card);border-color:var(--border-strong);color:var(--text-body)}
.cm-ibtn--active{background:var(--ink-50);color:var(--ink-700)}
.cm-ibtn--active:hover{background:var(--ink-100);color:var(--ink-700)}
`);

export function IconButton({ icon, label, size = 'md', variant = 'ghost', active = false, disabled = false, className, type = 'button', ...rest }) {
  return (
    <button type={type} className={cx('cm-ibtn', `cm-ibtn--${size}`, variant === 'secondary' && 'cm-ibtn--secondary', active && 'cm-ibtn--active', className)} aria-label={label} title={label} aria-pressed={active || undefined} disabled={disabled} {...rest}>
      <Icon name={icon} size={size === 'sm' ? 16 : 18} />
    </button>
  );
}
