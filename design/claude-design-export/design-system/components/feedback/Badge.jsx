import React from 'react';
import { css, cx } from '../core/cm.js';

css('cm-badge', `
.cm-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:var(--radius-full);font:var(--type-caption);font-weight:700;font-size:11px;line-height:1;white-space:nowrap;vertical-align:middle}
.cm-badge--neutral{background:var(--paper-3);color:var(--text-secondary)}
.cm-badge--accent{background:var(--ink-600);color:var(--text-on-accent)}
.cm-badge--soft{background:var(--ink-100);color:var(--ink-700)}
.cm-badge--live{background:var(--status-live-bg);color:var(--status-live-text)}
.cm-badge--paused{background:var(--status-paused-bg);color:var(--status-paused-text)}
.cm-badge--off{background:var(--status-off-bg);color:var(--status-off-text)}
.cm-badge--dot{min-width:8px;width:8px;height:8px;padding:0}
`);

export function Badge({ tone = 'neutral', dot = false, children, className, style, ...rest }) {
  return <span className={cx('cm-badge', `cm-badge--${tone}`, dot && 'cm-badge--dot', className)} style={style} {...rest}>{dot ? null : children}</span>;
}
