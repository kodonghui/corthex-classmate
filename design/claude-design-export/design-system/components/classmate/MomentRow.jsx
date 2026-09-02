import React from 'react';
import { css, cx } from '../core/cm.js';

css('cm-moment', `
.cm-mo{display:grid;grid-template-columns:60px 1fr auto;column-gap:10px;align-items:start;width:100%;padding:10px var(--panel-inset);border:0;margin:0;background:transparent;text-align:left;cursor:pointer;color:var(--text-body);font:inherit;transition:var(--transition-color);min-width:0;border-radius:0;box-sizing:border-box}
.cm-mo:hover{background:var(--surface-hover)}
.cm-mo:active{background:var(--surface-pressed)}
.cm-mo:focus-visible{outline:none;box-shadow:inset var(--focus-ring)}
.cm-mo--selected{background:var(--surface-accent-soft)}
.cm-mo__time{font:var(--type-time);color:var(--text-tertiary);padding-top:3px;font-variant-numeric:tabular-nums}
.cm-mo__main{min-width:0;display:flex;flex-direction:column;gap:2px}
.cm-mo__term{font:var(--type-label);color:var(--ink-700)}
.cm-mo--preparing .cm-mo__term{color:var(--text-tertiary)}
.cm-mo__title{font:var(--type-body);letter-spacing:var(--text-body-ls);color:var(--text-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all}
.cm-mo--unread .cm-mo__title{color:var(--text-body)}
.cm-mo__meta{font:var(--type-caption);color:var(--text-4)}
.cm-mo__end{padding-top:6px;display:flex;align-items:center;gap:6px;min-width:8px}
.cm-mo__dot{width:8px;height:8px;border-radius:var(--radius-full);background:var(--ink-600)}
.cm-mo__prep{width:14px;height:2px;border-radius:1px;background:var(--paper-4);overflow:hidden;position:relative}
.cm-mo__prep::after{content:"";position:absolute;inset:0;width:50%;background:var(--ink-400);animation:cm-sweep 1400ms var(--ease-in-out) infinite}
`);

// One caught moment in 기록: when · which word · the one-line answer. Whole row is the button; no chevrons, no icon clutter.
export function MomentRow({ time, term, title, period, topic, state = 'ready', selected = false, onClick, className, style }) {
  const meta = [period, topic, state === 'preparing' ? '정리 중' : state === 'unread' ? '새 답변' : null].filter(Boolean).join(' · ');
  return (
    <button type="button" className={cx('cm-mo', `cm-mo--${state}`, selected && 'cm-mo--selected', className)} style={style} onClick={onClick} aria-current={selected || undefined}>
      <span className="cm-mo__time">{time}</span>
      <span className="cm-mo__main">
        {term ? <span className="cm-mo__term">{term}</span> : null}
        {title ? <span className="cm-mo__title">{title}</span> : null}
        {meta ? <span className="cm-mo__meta">{meta}</span> : null}
      </span>
      <span className="cm-mo__end" aria-hidden="true">{state === 'preparing' ? <span className="cm-mo__prep"></span> : state === 'unread' ? <span className="cm-mo__dot"></span> : null}</span>
    </button>
  );
}
