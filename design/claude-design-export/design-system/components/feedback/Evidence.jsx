import React from 'react';
import { css, cx } from '../core/cm.js';
import { Icon } from '../core/Icon.jsx';

css('cm-evidence', `
.cm-ev{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 6px;border-radius:var(--radius-sm);font:var(--type-caption);font-weight:500;white-space:nowrap;vertical-align:middle;max-width:100%;border:1px solid;box-sizing:border-box}
.cm-ev--verified{background:var(--evidence-verified-bg);color:var(--evidence-verified-text);border-color:var(--evidence-verified-border)}
.cm-ev--partial{background:var(--evidence-partial-bg);color:var(--evidence-partial-text);border-color:var(--evidence-partial-border)}
.cm-ev--inferred{background:var(--evidence-inferred-bg);color:var(--evidence-inferred-text);border-color:var(--evidence-inferred-border);border-style:dashed}
.cm-ev--delayed{background:var(--evidence-delayed-bg);color:var(--evidence-delayed-text);border-color:var(--evidence-delayed-border)}
.cm-ev__sep{opacity:.6}
.cm-ev__t{overflow:hidden;text-overflow:ellipsis}
.cm-ev--block{display:flex;height:auto;min-height:22px;padding:4px 8px;white-space:normal;align-items:flex-start;gap:6px;line-height:16px}
.cm-ev--block .cm-icon{margin-top:2px}
`);

const SOURCE = { tiro: '전사', meet: 'Meet 화면', intellij: 'IntelliJ' };
const META = {
  verified: { head: '확인됨', icon: 'circle-check', title: '자료에서 직접 확인한 내용' },
  partial: { head: '일부 확인', icon: 'circle-dot', title: '자료에서 일부만 확인한 내용' },
  inferred: { head: '추론', icon: 'circle-help', title: '근거를 바탕으로 추측한 내용' },
  delayed: { head: '자료 지연', icon: 'clock', title: '이 자료가 늦게 와서 아직 못 봤어요' },
};

// Labels every claim with how the tutor knows it: 확인됨 · 일부 확인 · 추론 · 자료 지연
export function Evidence({ type = 'verified', source, time, reason, block = false, children, className, style, title }) {
  const m = META[type] || META.verified;
  const src = source ? (SOURCE[source] || source) : null;
  const detail = children || (type === 'inferred' ? reason : [src, time].filter(Boolean).join(' '));
  return (
    <span className={cx('cm-ev', `cm-ev--${type}`, block && 'cm-ev--block', className)} style={style} title={title || m.title}>
      <Icon name={m.icon} size={11} />
      <span>{m.head}</span>
      {detail ? <><span className="cm-ev__sep">·</span><span className="cm-ev__t">{detail}</span></> : null}
    </span>
  );
}
