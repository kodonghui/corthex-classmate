import React from 'react';
import { css, cx } from '../core/cm.js';

css('cm-transcript', `
.cm-tf{display:flex;flex-direction:column;gap:20px;min-width:0;justify-content:flex-end}
.cm-tf__ln{margin:0;font:var(--type-transcript);letter-spacing:var(--text-transcript-ls);word-break:keep-all;transition:color var(--duration-slow) var(--ease-out);animation:cm-fade-in var(--duration-slow) var(--ease-enter) both}
.cm-tf__ln--1{color:var(--transcript-1)}.cm-tf__ln--2{color:var(--transcript-2)}.cm-tf__ln--3{color:var(--transcript-3)}
.cm-tf__ln--tap{cursor:pointer}
.cm-tf__ln--tap:hover{color:var(--text-1)}
.cm-tf__tm{display:block;font:var(--type-time);color:var(--text-4);margin-bottom:2px}
.cm-tf__term{text-decoration:none;border-bottom:1.5px dotted var(--term-underline);padding-bottom:1px;color:inherit;cursor:pointer;border-radius:3px 3px 0 0;transition:var(--transition-color)}
.cm-tf__ln--2 .cm-tf__term,.cm-tf__ln--3 .cm-tf__term{border-color:var(--term-underline-faded)}
.cm-tf__term:hover{background:var(--term-hover-bg);color:var(--term-active-text);border-color:var(--term-underline)}
.cm-tf__term--mk{border-bottom:1.5px solid var(--term-underline);color:var(--term-marked)}
.cm-tf__term--on,.cm-tf__term--on:hover{background:var(--term-active-bg);border-bottom:1.5px solid var(--ink-600);padding:0 4px;color:var(--term-active-text)}
.cm-tf__after{animation:cm-fade-in var(--duration-base) var(--ease-enter) both}
.cm-tf__tip{font:var(--type-caption);color:var(--text-tertiary);padding-top:10px;border-top:1px solid var(--border-hairline)}
.cm-tf--md .cm-tf__ln{font:var(--type-conclusion);font-weight:400;letter-spacing:var(--text-conclusion-ls)}
.cm-tf--md{gap:14px}
`);

// lines: [{ id, time, segments: [{ text, term? }] }]. Newest last; the last two read at full ink, older lines fade.
export function TranscriptFlow({ lines = [], active, marked = [], onTerm, onSentence, renderAfter, tip, showTimes = false, size = 'lg', className, style }) {
  const n = lines.length;
  return (
    <div className={cx('cm-tf', size === 'md' && 'cm-tf--md', className)} style={style}>
      {lines.map((ln, i) => {
        const depth = n - 1 - i; const lvl = depth <= 1 ? 1 : depth === 2 ? 2 : 3;
        const after = renderAfter ? renderAfter(ln.id) : null;
        return (
          <React.Fragment key={ln.id}>
            <p className={cx('cm-tf__ln', `cm-tf__ln--${lvl}`, onSentence && 'cm-tf__ln--tap')} onClick={onSentence ? () => onSentence(ln.id) : undefined}>
              {showTimes && ln.time ? <span className="cm-tf__tm">{ln.time}</span> : null}
              {ln.segments.map((s, j) => s.term
                ? <u key={j} className={cx('cm-tf__term', active === `${ln.id}:${j}` && 'cm-tf__term--on', marked.includes(`${ln.id}:${j}`) && 'cm-tf__term--mk')} onClick={onTerm ? e => { e.stopPropagation(); onTerm(ln.id, j, s); } : undefined}>{s.text}</u>
                : <React.Fragment key={j}>{s.text}</React.Fragment>)}
            </p>
            {after ? <div className="cm-tf__after">{after}</div> : null}
          </React.Fragment>
        );
      })}
      {tip ? <div className="cm-tf__tip">{tip}</div> : null}
    </div>
  );
}
