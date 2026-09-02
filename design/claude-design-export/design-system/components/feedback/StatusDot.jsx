import React from 'react';
import { css, cx } from '../core/cm.js';

css('cm-statusdot', `
.cm-sd{display:inline-flex;align-items:center;gap:6px;font:var(--type-caption);font-weight:500;white-space:nowrap;vertical-align:middle}
.cm-sd__dot{width:8px;height:8px;border-radius:var(--radius-full);flex:none}
.cm-sd--live .cm-sd__dot{background:var(--status-live)}
.cm-sd--live{color:var(--status-live-text)}
.cm-sd--paused .cm-sd__dot{background:var(--status-paused)}
.cm-sd--paused{color:var(--status-paused-text)}
.cm-sd--off .cm-sd__dot{background:var(--status-off)}
.cm-sd--off{color:var(--status-off-text)}
.cm-sd--idle .cm-sd__dot{background:var(--paper-5)}
.cm-sd--idle{color:var(--text-tertiary)}
.cm-sd--breathe .cm-sd__dot{animation:cm-breathe var(--duration-breathe) var(--ease-in-out) infinite}
.cm-sd--muted{color:var(--text-secondary)}
`);

export function StatusDot({ state = 'live', label, breathe, muted = false, className, style }) {
  const b = breathe === undefined ? state === 'live' : breathe;
  return (
    <span className={cx('cm-sd', `cm-sd--${state}`, b && 'cm-sd--breathe', muted && 'cm-sd--muted', className)} style={style} role={label ? 'status' : undefined}>
      <span className="cm-sd__dot" aria-hidden="true"></span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}
