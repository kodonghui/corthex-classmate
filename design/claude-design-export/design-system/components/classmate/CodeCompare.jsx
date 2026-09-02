import React from 'react';
import { css, cx } from '../core/cm.js';
import { tokenizeJava } from '../surfaces/CodeBlock.jsx';

css('cm-compare', `
.cm-cmp{display:flex;flex-direction:column;gap:6px;min-width:0}
.cm-cmp__r{display:grid;grid-template-columns:52px 1fr;gap:8px;align-items:center;font:var(--type-code);font-size:11.5px;padding:6px 10px;border-radius:var(--radius-md);white-space:nowrap;overflow:hidden;background:var(--surface-sunken);color:var(--code-text)}
.cm-cmp__w{font:var(--type-caption);color:var(--text-tertiary)}
.cm-cmp__r--teacher{background:var(--ink-50)}
.cm-cmp__r--mine{background:var(--amber-50)}
.cm-cmp__c{overflow:hidden;text-overflow:ellipsis;min-width:0}
`);

// Two (or more) single lines side by side: what the teacher typed vs what I typed. The differing line is the question.
export function CodeCompare({ rows = [], className, style }) {
  return (
    <div className={cx('cm-cmp', className)} style={style}>
      {rows.map((r, i) => (
        <div key={i} className={cx('cm-cmp__r', r.tone && `cm-cmp__r--${r.tone}`)}>
          <span className="cm-cmp__w">{r.who}</span>
          <span className="cm-cmp__c">{tokenizeJava(r.code)}</span>
        </div>
      ))}
    </div>
  );
}
