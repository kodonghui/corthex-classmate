import React from 'react';
import { css, cx } from '../core/cm.js';
import { Icon } from '../core/Icon.jsx';

css('cm-guess', `
.cm-gl{display:flex;flex-direction:column;gap:6px;min-width:0}
.cm-gl__t{margin:0;font:var(--type-caption);color:var(--text-tertiary)}
.cm-gl__o{display:flex;align-items:center;gap:8px;min-height:36px;padding:6px 12px;border:1px solid var(--border-hairline);border-radius:var(--radius-md);background:var(--surface-card);font:var(--type-label);color:var(--text-secondary);cursor:pointer;text-align:left;width:100%;transition:var(--transition-color);margin:0;word-break:keep-all}
.cm-gl__o:hover{background:var(--surface-hover);color:var(--text-body)}
.cm-gl__o:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-gl__o .cm-icon{margin-left:auto;color:var(--text-4);flex:none}
.cm-gl__o--on{background:var(--ink-50);border-color:var(--ink-200);color:var(--ink-800)}
.cm-gl__o--on .cm-icon{color:var(--ink-600)}
`);

// "혹시 이게 막혔나요?" — the tutor's three guesses when the learner caught a whole sentence.
export function GuessList({ title = '혹시 이게 막혔나요?', options = [], value, onChange, className, style }) {
  return (
    <div className={cx('cm-gl', className)} style={style} role="group" aria-label={typeof title === 'string' ? title : undefined}>
      {title ? <p className="cm-gl__t">{title}</p> : null}
      {options.map(o => { const on = o.id === value; return (
        <button key={o.id} type="button" className={cx('cm-gl__o', on && 'cm-gl__o--on')} aria-pressed={on} onClick={() => onChange && onChange(o.id)}>
          <span>{o.label}</span><Icon name={on ? 'check' : 'chevron-right'} size={14} />
        </button>
      ); })}
    </div>
  );
}
