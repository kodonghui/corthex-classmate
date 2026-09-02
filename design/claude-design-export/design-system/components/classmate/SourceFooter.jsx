import React from 'react';
import { css, cx } from '../core/cm.js';

css('cm-footer', `
.cm-sf{flex:none;min-height:40px;padding:10px var(--panel-inset);border-top:1px solid var(--border-hairline);font:var(--type-caption);color:var(--text-tertiary);display:flex;align-items:center;gap:8px;min-width:0;background:var(--surface-canvas);box-sizing:border-box}
.cm-sf__dots{display:inline-flex;gap:4px;align-items:center;flex:none}
.cm-sf__d{width:6px;height:6px;border-radius:var(--radius-full);background:var(--status-live)}
.cm-sf__d--paused{background:var(--status-paused)}.cm-sf__d--off{background:var(--status-off)}.cm-sf__d--idle{background:var(--paper-5)}
.cm-sf__t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cm-sf__r{margin-left:auto;flex:none;border:0;background:transparent;padding:0;font:inherit;color:var(--text-secondary);font-weight:500;border-radius:3px;white-space:nowrap}
button.cm-sf__r{cursor:pointer}
button.cm-sf__r:hover{color:var(--ink-700);text-decoration:underline}
.cm-sf__r:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-sf--paused{background:var(--amber-50);border-top-color:var(--amber-100);color:var(--amber-700)}
.cm-sf--off{background:var(--red-50);border-top-color:var(--red-100);color:var(--red-700)}
.cm-sf__w{flex:1;min-width:0;line-height:16px}
.cm-sf__w b{font-weight:700}
.cm-sf__a{border:0;background:transparent;padding:0;margin-left:6px;font:inherit;font-weight:500;color:inherit;text-decoration:underline;cursor:pointer;white-space:nowrap}
.cm-sf--paused .cm-sf__r,.cm-sf--off .cm-sf__r{color:inherit;opacity:.85}
`);
const LABEL = { tiro: '전사', meet: 'Meet', intellij: 'IntelliJ' };

// One quiet line at the bottom: how fresh each source is, and how many moments are kept. warn replaces it with what stopped + what continues.
export function SourceFooter({ sources = [], count, countLabel = '기록', onCount, warn, className, style }) {
  const right = count == null ? null : onCount
    ? <button type="button" className="cm-sf__r" onClick={onCount}>{countLabel} {count}</button>
    : <span className="cm-sf__r">{countLabel} {count}</span>;
  if (warn) return (
    <div className={cx('cm-sf', `cm-sf--${warn.tone || 'paused'}`, className)} style={style} role="status">
      <span className="cm-sf__w"><b>{warn.title}</b>{warn.description ? <> {warn.description}</> : null}{warn.action ? <button type="button" className="cm-sf__a" onClick={warn.onAction}>{warn.action}</button> : null}</span>
      {right}
    </div>
  );
  return (
    <div className={cx('cm-sf', className)} style={style} role="status">
      <span className="cm-sf__dots" aria-hidden="true">{sources.map(s => <span key={s.key} className={cx('cm-sf__d', s.state && s.state !== 'live' && `cm-sf__d--${s.state}`)}></span>)}</span>
      <span className="cm-sf__t">{sources.map(s => `${s.label || LABEL[s.key] || s.key} ${s.ago || ''}`.trim()).join(' · ')}</span>
      {right}
    </div>
  );
}
