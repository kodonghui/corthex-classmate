import React from 'react';
import { css, cx } from '../core/cm.js';
import { Icon } from '../core/Icon.jsx';
import { Evidence } from '../feedback/Evidence.jsx';
import { Tag } from '../feedback/Tag.jsx';
import { Disclosure } from '../surfaces/Disclosure.jsx';
import { CodeBlock } from '../surfaces/CodeBlock.jsx';
import { Chip, ChipGroup } from '../forms/Chip.jsx';
import { CodeCompare } from './CodeCompare.jsx';

css('cm-answer', `
.cm-ans{background:var(--surface-card);border:1px solid var(--border-hairline);border-radius:var(--radius-lg);padding:16px;min-width:0;display:flex;flex-direction:column;gap:12px;animation:cm-fade-in var(--duration-base) var(--ease-enter) both}
.cm-ans__meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font:var(--type-caption);color:var(--text-tertiary)}
.cm-ans__meta .cm-tag{margin-right:2px}
.cm-ans__con{font:var(--type-conclusion);letter-spacing:var(--text-conclusion-ls);color:var(--text-body);margin:0;word-break:keep-all}
.cm-ans__con code{font:var(--type-code);font-size:14px;background:var(--code-bg);padding:1px 5px;border-radius:var(--radius-xs)}
.cm-ans__ev{display:flex;flex-wrap:wrap;gap:6px}
.cm-ans__secs{margin:0 -16px -4px;padding:0 16px;border-top:1px solid var(--border-hairline)}
.cm-ans__secs .cm-disc:first-child{border-top:0}
.cm-ans__p{margin:0 0 8px}
.cm-ans__p:last-child{margin-bottom:0}
.cm-ans__quote{background:var(--surface-sunken);border-radius:var(--radius-md);padding:10px 12px;display:flex;flex-direction:column;gap:4px}
.cm-ans__quote-t{font:var(--type-body);color:var(--text-body);margin:0;quotes:"“" "”"}
.cm-ans__quote-t::before{content:open-quote;color:var(--text-4)}
.cm-ans__quote-t::after{content:close-quote;color:var(--text-4)}
.cm-ans__quote-m{font:var(--type-caption);color:var(--text-tertiary)}
.cm-ans__follow{display:flex;flex-direction:column;gap:8px}
.cm-ans__follow-l{font:var(--type-caption);color:var(--text-tertiary)}
.cm-ans__load{display:flex;flex-direction:column;gap:12px}
.cm-ans__load-t{font:var(--type-body);color:var(--text-secondary)}
.cm-ans__sweep{height:2px;background:var(--paper-4);border-radius:1px;overflow:hidden;position:relative}
.cm-ans__sweep::after{content:"";position:absolute;inset:0;width:40%;background:var(--ink-400);animation:cm-sweep 1400ms var(--ease-in-out) infinite}
.cm-ans__sk{height:12px;border-radius:3px;background:var(--paper-3)}
`);

function Section({ s }) {
  if (s.type === 'code') return <CodeBlock code={s.code} caption={s.caption} source={s.source} highlightLines={s.highlightLines} lineNumbers={s.lineNumbers} />;
  if (s.type === 'compare') return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CodeCompare rows={s.rows} />{s.content ? <p className="cm-ans__p" style={{ color: 'var(--text-secondary)' }}>{s.content}</p> : null}</div>;
  if (s.type === 'quote') return <div className="cm-ans__quote"><p className="cm-ans__quote-t">{s.content}</p><span className="cm-ans__quote-m">{[s.speaker || '선생님', s.time && `Tiro ${s.time}`].filter(Boolean).join(' · ')}</span></div>;
  const paras = Array.isArray(s.content) ? s.content : [s.content];
  return <>{paras.map((p, i) => <p key={i} className="cm-ans__p">{p}</p>)}</>;
}

export function AnswerCard({ conclusion, topic, time, period, evidence = [], sections = [], followUps = [], onFollowUp, followUpLabel = '더 알고 싶다면', loading = false, loadingText = '설명을 준비하고 있어요', openSection, onSectionToggle, className, style }) {
  if (loading) return (
    <div className={cx('cm-ans', className)} style={style} aria-busy="true">
      <div className="cm-ans__load">
        <div className="cm-ans__load-t">{loadingText}</div>
        <div className="cm-ans__sweep" aria-hidden="true"></div>
        <div className="cm-ans__sk" style={{ width: '82%' }}></div>
        <div className="cm-ans__sk" style={{ width: '58%' }}></div>
      </div>
    </div>
  );
  const meta = [period, time].filter(Boolean).join(' · ');
  return (
    <article className={cx('cm-ans', className)} style={style}>
      {(topic || meta) ? <div className="cm-ans__meta">{topic ? <Tag tone="sunken">{topic}</Tag> : null}{meta ? <span>{meta}</span> : null}</div> : null}
      <p className="cm-ans__con">{conclusion}</p>
      {evidence.length ? <div className="cm-ans__ev">{evidence.map((e, i) => <Evidence key={i} {...e} />)}</div> : null}
      {sections.length ? (
        <div className="cm-ans__secs">
          {sections.map((s, i) => (
            <Disclosure key={s.id || i} label={s.label} icon={s.icon} meta={s.meta} first={i === 0} open={openSection === undefined ? undefined : openSection === (s.id || i)} defaultOpen={s.defaultOpen} onToggle={o => onSectionToggle && onSectionToggle(s.id || i, o)}>
              <Section s={s} />
            </Disclosure>
          ))}
        </div>
      ) : null}
      {followUps.length ? (
        <div className="cm-ans__follow">
          {followUpLabel ? <div className="cm-ans__follow-l">{followUpLabel}</div> : null}
          <ChipGroup>{followUps.map(f => <Chip key={f.id} icon={f.icon} selected={f.selected} onClick={() => onFollowUp && onFollowUp(f.id)}>{f.label}</Chip>)}</ChipGroup>
        </div>
      ) : null}
    </article>
  );
}
