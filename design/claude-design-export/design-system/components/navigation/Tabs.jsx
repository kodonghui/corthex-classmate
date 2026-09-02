import React from 'react';
import { css, cx } from '../core/cm.js';
import { Icon } from '../core/Icon.jsx';
import { Badge } from '../feedback/Badge.jsx';

css('cm-tabs', `
.cm-tabs{display:flex;gap:2px;border-bottom:1px solid var(--border-hairline);min-width:0;overflow-x:auto;scrollbar-width:none}
.cm-tabs::-webkit-scrollbar{display:none}
.cm-tabs--fill .cm-tab{flex:1}
.cm-tab{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:40px;padding:0 12px;border:0;background:transparent;margin:0 0 -1px;color:var(--text-secondary);font:var(--type-label);cursor:pointer;white-space:nowrap;transition:var(--transition-color);border-radius:var(--radius-sm) var(--radius-sm) 0 0}
.cm-tab:hover{color:var(--text-body);background:var(--surface-hover)}
.cm-tab:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-tab--active{color:var(--text-body);font-weight:700}
.cm-tab--active::after{content:"";position:absolute;left:8px;right:8px;bottom:0;height:2px;border-radius:1px;background:var(--ink-600)}
.cm-tabs--sm .cm-tab{height:32px;padding:0 10px;font-size:12px}
.cm-tabs--seg{border:1px solid var(--border-hairline);border-radius:var(--radius-md);padding:2px;gap:2px;background:var(--surface-sunken)}
.cm-tabs--seg .cm-tab{height:28px;margin:0;border-radius:var(--radius-sm);flex:1}
.cm-tabs--seg .cm-tab--active{background:var(--surface-card);box-shadow:var(--shadow-sm)}
.cm-tabs--seg .cm-tab--active::after{display:none}
`);

export function Tabs({ items = [], value, onChange, size = 'md', variant = 'underline', fill = false, className, style, 'aria-label': ariaLabel }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cx('cm-tabs', size === 'sm' && 'cm-tabs--sm', variant === 'segmented' && 'cm-tabs--seg', fill && 'cm-tabs--fill', className)} style={style}>
      {items.map(it => {
        const active = it.id === value;
        return (
          <button key={it.id} type="button" role="tab" aria-selected={active} className={cx('cm-tab', active && 'cm-tab--active')} onClick={() => onChange && onChange(it.id)} disabled={it.disabled}>
            {it.icon ? <Icon name={it.icon} size={16} /> : null}
            <span>{it.label}</span>
            {it.count != null ? <Badge tone={active ? 'soft' : 'neutral'}>{it.count}</Badge> : null}
          </button>
        );
      })}
    </div>
  );
}
