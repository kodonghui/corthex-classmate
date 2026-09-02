import React from 'react';
import { css, cx } from '../core/cm.js';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../core/Button.jsx';
import { IconButton } from '../core/IconButton.jsx';

css('cm-banner', `
.cm-banner{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:var(--radius-xl);font:var(--type-body);letter-spacing:var(--text-body-ls);animation:cm-fade-in var(--duration-base) var(--ease-enter) both;min-width:0}
.cm-banner--paused{background:var(--status-paused-bg);color:var(--amber-700)}
.cm-banner--off{background:var(--status-off-bg);color:var(--red-700)}
.cm-banner--info{background:var(--status-info-bg);color:var(--ink-800)}
.cm-banner--live{background:var(--status-live-bg);color:var(--green-700)}
.cm-banner__ic{flex:none;margin-top:3px;display:flex}
.cm-banner__body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.cm-banner__title{font-weight:700}
.cm-banner__desc{font:var(--type-label);font-weight:400;opacity:.9}
.cm-banner__act{display:flex;gap:6px;margin-top:8px}
.cm-banner__x{flex:none;margin:-4px -6px -4px 0;color:inherit;opacity:.7}
.cm-banner__x:hover{opacity:1}
`);
const ICONS = { paused: 'pause-circle', off: 'wifi-off', info: 'info', live: 'circle-check' };

export function Banner({ tone = 'paused', title, description, action, onAction, secondaryAction, onSecondaryAction, onDismiss, icon, className, style }) {
  return (
    <div role="status" className={cx('cm-banner', `cm-banner--${tone}`, className)} style={style}>
      <span className="cm-banner__ic"><Icon name={icon || ICONS[tone]} size={16} /></span>
      <div className="cm-banner__body">
        {title ? <div className="cm-banner__title">{title}</div> : null}
        {description ? <div className="cm-banner__desc">{description}</div> : null}
        {(action || secondaryAction) ? <div className="cm-banner__act">{action ? <Button size="sm" onClick={onAction} style={{ color: 'inherit', borderColor: 'currentColor', background: 'transparent' }}>{action}</Button> : null}{secondaryAction ? <Button size="sm" variant="ghost" onClick={onSecondaryAction} style={{ color: 'inherit' }}>{secondaryAction}</Button> : null}</div> : null}
      </div>
      {onDismiss ? <IconButton icon="x" label="닫기" size="sm" onClick={onDismiss} className="cm-banner__x" /> : null}
    </div>
  );
}
