import React from 'react';
import { css, cx } from '../core/cm.js';
import { IconButton } from '../core/IconButton.jsx';

css('cm-panelheader', `
.cm-ph{display:flex;align-items:center;gap:8px;height:44px;padding:0 var(--panel-inset);background:var(--surface-canvas);border-bottom:1px solid var(--border-hairline);position:sticky;top:0;z-index:var(--z-sticky);min-width:0;box-sizing:border-box;flex:none}
.cm-ph--back{padding-left:calc(var(--panel-inset) - 6px)}
.cm-ph--acts{padding-right:calc(var(--panel-inset) - 6px)}
.cm-ph__d{width:6px;height:6px;border-radius:var(--radius-full);background:var(--status-live);flex:none}
.cm-ph__d--live{animation:cm-breathe var(--duration-breathe) var(--ease-in-out) infinite}
.cm-ph__d--paused{background:var(--status-paused)}.cm-ph__d--off{background:var(--status-off)}.cm-ph__d--idle{background:var(--paper-5)}
.cm-ph__t{flex:1;min-width:0;font:var(--type-label);color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cm-ph__t b{font-weight:700;color:var(--text-body)}
.cm-ph__wm{flex:1;font:var(--type-body-strong);letter-spacing:-0.02em;white-space:nowrap;color:var(--text-body)}
.cm-ph__wm i{font-style:normal;color:var(--ink-600)}
.cm-ph__time{font:var(--type-time);color:var(--text-tertiary);flex:none;font-variant-numeric:tabular-nums}
.cm-ph__acts{display:flex;align-items:center;gap:2px;flex:none}
`);

// 44px sticky header: status dot · what the class is on right now · clock. Titles are quiet; the transcript below is the loud part.
export function PanelHeader({ title, subtitle, strong = false, time, status, onBack, backLabel = '뒤로', actions, className, style }) {
  const text = [title, subtitle].filter(Boolean);
  return (
    <header className={cx('cm-ph', onBack && 'cm-ph--back', actions && 'cm-ph--acts', className)} style={style}>
      {onBack ? <IconButton icon="arrow-left" label={backLabel} onClick={onBack} size="sm" /> : null}
      {status ? <span className={cx('cm-ph__d', `cm-ph__d--${status}`)} aria-hidden="true"></span> : null}
      {text.length ? <div className="cm-ph__t">{strong ? <b>{title}</b> : title}{subtitle ? <>{title ? ' · ' : ''}{subtitle}</> : null}</div> : <div className="cm-ph__wm">Corthex <i>Classmate</i></div>}
      {time ? <span className="cm-ph__time">{time}</span> : null}
      {actions ? <div className="cm-ph__acts">{actions}</div> : null}
    </header>
  );
}
