import React, { useEffect, useId, useRef } from 'react';
import { css, cx } from '../core/cm.js';
import { Button } from '../core/Button.jsx';
import { IconButton } from '../core/IconButton.jsx';

css('cm-dialog', `
.cm-dlg__scrim{position:absolute;inset:0;background:var(--surface-scrim);backdrop-filter:blur(var(--blur-scrim));display:flex;align-items:flex-end;justify-content:center;padding:var(--panel-inset);z-index:var(--z-dialog);animation:cm-fade-in var(--duration-fast) var(--ease-enter) both}
.cm-dlg__scrim--fixed{position:fixed}
.cm-dlg__scrim--center{align-items:center}
.cm-dlg{width:100%;max-width:420px;background:var(--surface-card);border:1px solid var(--border-hairline);border-radius:var(--radius-xl);box-shadow:var(--shadow-lg);padding:16px;display:flex;flex-direction:column;gap:12px;animation:cm-fade-in var(--duration-base) var(--ease-enter) both;box-sizing:border-box}
.cm-dlg__head{display:flex;align-items:flex-start;gap:8px}
.cm-dlg__title{flex:1;font:var(--type-title);letter-spacing:var(--text-title-ls);color:var(--text-body);margin:0}
.cm-dlg__desc{font:var(--type-body);letter-spacing:var(--text-body-ls);color:var(--text-secondary);margin:0}
.cm-dlg__body{font:var(--type-body);color:var(--text-body)}
.cm-dlg__acts{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}
.cm-dlg__acts--stack{flex-direction:column-reverse}
.cm-dlg__x{margin:-6px -6px -6px 0}
`);

export function Dialog({ open, title, description, children, primaryAction, onPrimary, primaryVariant = 'primary', secondaryAction = '닫기', onClose, position = 'bottom', fixed = false, stackActions = false, className, style }) {
  const id = useId();
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('keydown', onKey);
    const first = ref.current && ref.current.querySelector('button,[href],input,select,textarea');
    if (first) first.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={cx('cm-dlg__scrim', fixed && 'cm-dlg__scrim--fixed', position === 'center' && 'cm-dlg__scrim--center')} onMouseDown={e => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={title ? `cm-dlg-t-${id}` : undefined} aria-describedby={description ? `cm-dlg-d-${id}` : undefined} className={cx('cm-dlg', className)} style={style}>
        <div className="cm-dlg__head">
          {title ? <h2 id={`cm-dlg-t-${id}`} className="cm-dlg__title">{title}</h2> : <span style={{ flex: 1 }}></span>}
          {onClose ? <IconButton icon="x" label="닫기" size="sm" onClick={onClose} className="cm-dlg__x" /> : null}
        </div>
        {description ? <p id={`cm-dlg-d-${id}`} className="cm-dlg__desc">{description}</p> : null}
        {children ? <div className="cm-dlg__body">{children}</div> : null}
        {(primaryAction || secondaryAction) ? (
          <div className={cx('cm-dlg__acts', stackActions && 'cm-dlg__acts--stack')}>
            {secondaryAction && onClose ? <Button variant="ghost" onClick={onClose} full={stackActions}>{secondaryAction}</Button> : null}
            {primaryAction ? <Button variant={primaryVariant} onClick={onPrimary} full={stackActions}>{primaryAction}</Button> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
