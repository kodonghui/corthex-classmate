import React, { useEffect, useRef } from 'react';
import { css, cx } from '../core/cm.js';
import { Icon } from '../core/Icon.jsx';

css('cm-toast', `
.cm-toast{display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:8px 12px;border-radius:var(--radius-lg);background:var(--surface-inverse);color:var(--text-inverse);font:var(--type-label);box-shadow:var(--shadow-inverse);animation:cm-fade-in var(--duration-base) var(--ease-enter) both;max-width:100%;box-sizing:border-box}
.cm-toast--light{background:var(--surface-card);color:var(--text-body);border:1px solid var(--border-hairline);box-shadow:var(--shadow-md)}
.cm-toast__ic{display:flex;flex:none;color:var(--ink-300)}
.cm-toast--light .cm-toast__ic{color:var(--ink-600)}
.cm-toast__ic--live{color:var(--status-live)}
.cm-toast__msg{min-width:0;flex:1}
.cm-toast__act{flex:none;margin:-4px -4px -4px 4px;padding:4px 8px;border:0;border-radius:var(--radius-sm);background:transparent;color:var(--ink-200);font:var(--type-label);cursor:pointer}
.cm-toast--light .cm-toast__act{color:var(--text-link)}
.cm-toast__act:hover{text-decoration:underline}
.cm-toast__act:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-toasthost{position:absolute;left:0;right:0;bottom:16px;display:flex;justify-content:center;padding:0 var(--panel-inset);pointer-events:none;z-index:var(--z-toast)}
.cm-toasthost > *{pointer-events:auto}
`);

export function Toast({ message, icon, tone = 'dark', live = false, action, onAction, duration = 3200, onClose, className, style }) {
  const cb = useRef(onClose); cb.current = onClose;
  useEffect(() => { if (!duration) return; const t = setTimeout(() => cb.current && cb.current(), duration); return () => clearTimeout(t); }, [duration, message]);
  return (
    <div role="status" className={cx('cm-toast', tone === 'light' && 'cm-toast--light', className)} style={style}>
      {icon ? <span className={cx('cm-toast__ic', live && 'cm-toast__ic--live')}><Icon name={icon} size={16} /></span> : null}
      <span className="cm-toast__msg">{message}</span>
      {action ? <button type="button" className="cm-toast__act" onClick={onAction}>{action}</button> : null}
    </div>
  );
}

export function ToastHost({ children, className, style }) {
  return <div className={cx('cm-toasthost', className)} style={style} aria-live="polite">{children}</div>;
}
