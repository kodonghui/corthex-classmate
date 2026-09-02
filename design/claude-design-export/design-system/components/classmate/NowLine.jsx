import React from 'react';
import { css, cx } from '../core/cm.js';

css('cm-nowline', `
.cm-now{display:flex;align-items:center;gap:8px;font:var(--type-caption);font-weight:500;color:var(--status-live-text);min-width:0}
.cm-now--rule::before,.cm-now--rule::after{content:"";flex:1;height:1px;background:var(--border-hairline)}
.cm-now__t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.cm-now--plain{font-weight:400;color:var(--text-tertiary)}
.cm-now__d{width:6px;height:6px;border-radius:var(--radius-full);background:var(--status-live);flex:none}
.cm-now--plain .cm-now__d{animation:cm-breathe var(--duration-breathe) var(--ease-in-out) infinite}
`);

// Where the teacher is right now — so the learner can step back into class. variant: rule (centered) | plain (dot + text)
export function NowLine({ children, variant = 'rule', className, style }) {
  return (
    <div className={cx('cm-now', `cm-now--${variant}`, className)} style={style} role="status">
      {variant === 'plain' ? <span className="cm-now__d" aria-hidden="true"></span> : null}
      <span className="cm-now__t">{children}</span>
    </div>
  );
}
