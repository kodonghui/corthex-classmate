import React from 'react';
import { css, cx } from '../core/cm.js';

css('cm-card', `
.cm-card{background:var(--surface-card);border:1px solid var(--border-hairline);border-radius:var(--radius-lg);padding:16px;min-width:0;color:var(--text-body);transition:var(--transition-color)}
.cm-card--sunken{background:var(--surface-sunken);border-color:transparent}
.cm-card--selected{background:var(--surface-accent-soft);border-color:var(--ink-200)}
.cm-card--interactive{cursor:pointer;text-align:left;width:100%;font:inherit;display:block}
.cm-card--interactive:hover{background:var(--surface-hover)}
.cm-card--interactive:active{background:var(--surface-pressed)}
.cm-card--interactive:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-card--selected.cm-card--interactive:hover{background:var(--ink-100)}
.cm-card--p0{padding:0}.cm-card--p12{padding:12px}
.cm-card__header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.cm-card__title{font:var(--type-body-strong);letter-spacing:var(--text-body-ls);min-width:0}
.cm-card__meta{font:var(--type-caption);color:var(--text-tertiary);margin-top:2px}
.cm-card__footer{border-top:1px solid var(--border-hairline);margin:12px -16px 0;padding:10px 16px 0;display:flex;gap:8px;align-items:center;justify-content:flex-end}
.cm-card--p12 .cm-card__footer{margin:10px -12px 0;padding:8px 12px 0}
`);

export function Card({ title, meta, actions, footer, sunken = false, selected = false, interactive = false, padding = 16, onClick, children, className, style, ...rest }) {
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag type={interactive ? 'button' : undefined} onClick={onClick} className={cx('cm-card', sunken && 'cm-card--sunken', selected && 'cm-card--selected', interactive && 'cm-card--interactive', padding === 0 && 'cm-card--p0', padding === 12 && 'cm-card--p12', className)} style={style} {...rest}>
      {(title || actions) ? <div className="cm-card__header"><div style={{ minWidth: 0 }}>{title ? <div className="cm-card__title">{title}</div> : null}{meta ? <div className="cm-card__meta">{meta}</div> : null}</div>{actions ? <div style={{ display: 'flex', gap: 4, flex: 'none' }}>{actions}</div> : null}</div> : null}
      {children}
      {footer ? <div className="cm-card__footer">{footer}</div> : null}
    </Tag>
  );
}
