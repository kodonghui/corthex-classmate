import React from 'react';
import { css, cx } from '../core/cm.js';
import { Icon } from '../core/Icon.jsx';

css('cm-stuck', `
.cm-stuck{display:flex;flex-direction:column;gap:8px;min-width:0}
.cm-stuck__btn{position:relative;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:var(--control-h-hero);padding:0 16px;border:0;margin:0;border-radius:var(--radius-lg);background:var(--action-primary);color:var(--text-on-accent);font:var(--weight-bold) 16px/24px var(--font-sans);letter-spacing:-0.01em;cursor:pointer;overflow:hidden;transition:var(--transition-color);-webkit-tap-highlight-color:transparent}
.cm-stuck__btn:hover{background:var(--action-primary-hover)}
.cm-stuck__btn:active{background:var(--action-primary-active)}
.cm-stuck__btn:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-stuck__btn[disabled]{cursor:default}
.cm-stuck__btn--saving{background:var(--ink-700)}
.cm-stuck__btn--saved{background:var(--ink-800)}
.cm-stuck__btn--quiet{background:var(--surface-card);color:var(--text-body);border:1px solid var(--border-strong)}
.cm-stuck__btn--quiet:hover{background:var(--surface-hover)}
.cm-stuck__kbd{position:absolute;right:12px;top:50%;transform:translateY(-50%);font:var(--type-caption);font-family:var(--font-mono);padding:1px 6px;border-radius:var(--radius-xs);background:rgba(255,255,255,.14);color:rgba(255,255,255,.85)}
.cm-stuck__btn--quiet .cm-stuck__kbd{background:var(--surface-sunken);color:var(--text-tertiary)}
.cm-stuck__bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.18);overflow:hidden}
.cm-stuck__bar::after{content:"";position:absolute;inset:0;width:40%;background:rgba(255,255,255,.85);animation:cm-sweep 1400ms var(--ease-in-out) infinite}
.cm-stuck__sub{font:var(--type-caption);color:var(--text-tertiary);text-align:center;padding:0 8px}
.cm-stuck__sub b{font-weight:500;color:var(--text-secondary)}
`);
const LABEL = { idle: '지금 막혔어요', saving: '저장하고 있어요', saved: '저장했어요' };
const ICON = { idle: 'hand', saving: 'bookmark', saved: 'circle-check' };

export function StuckButton({ state = 'idle', label, sublabel = '최근 30초 전사 · Meet 화면 · IntelliJ 코드를 함께 저장해요', shortcut, quiet = false, disabled = false, onClick, className, style }) {
  const busy = state === 'saving';
  return (
    <div className={cx('cm-stuck', className)} style={style}>
      <button type="button" className={cx('cm-stuck__btn', `cm-stuck__btn--${state}`, quiet && 'cm-stuck__btn--quiet')} onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined} aria-live="polite">
        <Icon name={ICON[state] || 'hand'} size={20} strokeWidth={2} />
        <span>{label || LABEL[state]}</span>
        {shortcut && state === 'idle' ? <kbd className="cm-stuck__kbd" aria-hidden="true">{shortcut}</kbd> : null}
        {busy ? <span className="cm-stuck__bar" aria-hidden="true"></span> : null}
      </button>
      {sublabel ? <div className="cm-stuck__sub">{sublabel}</div> : null}
    </div>
  );
}
