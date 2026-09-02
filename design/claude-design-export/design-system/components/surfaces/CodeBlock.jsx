import React from 'react';
import { css, cx } from '../core/cm.js';

css('cm-code', `
.cm-code{background:var(--code-bg);border-radius:var(--radius-lg);color:var(--code-text);font:var(--type-code);overflow:hidden;min-width:0}
.cm-code__cap{display:flex;justify-content:space-between;gap:8px;padding:8px 12px 0;font:var(--type-caption);color:var(--text-tertiary)}
.cm-code__pre{margin:0;padding:10px 12px;overflow-x:auto;font:inherit;tab-size:2}
.cm-code__ln{display:block;padding:0 12px;margin:0 -12px;white-space:pre}
.cm-code__ln--hl{background:var(--code-highlight)}
.cm-code__num{display:inline-block;width:2ch;margin-right:12px;color:var(--text-4);text-align:right;user-select:none}
.cm-k{color:var(--code-keyword)}.cm-t{color:var(--code-type)}.cm-s{color:var(--code-string)}.cm-n{color:var(--code-number)}.cm-c{color:var(--code-comment)}.cm-a{color:var(--code-keyword)}
.cm-code--inline{display:inline;padding:1px 5px;border-radius:var(--radius-xs);background:var(--code-bg);font:var(--type-code);color:var(--code-text)}
`);

const KW = /^(public|private|protected|static|final|class|interface|enum|extends|implements|return|new|if|else|for|while|do|switch|case|break|continue|void|this|super|import|package|try|catch|finally|throw|throws|null|true|false|var|record|abstract|default|instanceof)$/;
const TYPES = /^(int|long|double|float|boolean|char|byte|short|String|List|Map|Set|Optional|Integer|Long|Object)$/;
// Tiny Java tokenizer — enough to color keywords, types, strings, numbers, comments and annotations.
export function tokenizeJava(line) {
  const out = []; let i = 0; const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(@[A-Za-z_]\w*)|([A-Za-z_]\w*)|(\b\d[\d_.]*[LlFfDd]?\b)|(\s+|[^\sA-Za-z_"@\d]+)/g; let m;
  while ((m = re.exec(line))) {
    const [t, cmt, str, ann, id, num] = m;
    let cls = null;
    if (cmt) cls = 'cm-c'; else if (str) cls = 'cm-s'; else if (ann) cls = 'cm-a'; else if (num) cls = 'cm-n'; else if (id) { if (KW.test(id)) cls = 'cm-k'; else if (TYPES.test(id) || /^[A-Z]/.test(id)) cls = 'cm-t'; }
    out.push(cls ? <span key={i++} className={cls}>{t}</span> : t);
  }
  return out;
}

export function CodeBlock({ code = '', language = 'java', caption, source, highlightLines = [], lineNumbers = false, inline = false, className, style }) {
  if (inline) return <code className={cx('cm-code--inline', className)} style={style}>{code}</code>;
  const lines = code.replace(/\n$/, '').split('\n');
  return (
    <div className={cx('cm-code', className)} style={style}>
      {(caption || source) ? <div className="cm-code__cap"><span>{caption}</span><span>{source}</span></div> : null}
      <pre className="cm-code__pre" data-language={language}>
        {lines.map((ln, i) => <span key={i} className={cx('cm-code__ln', highlightLines.includes(i + 1) && 'cm-code__ln--hl')}>{lineNumbers ? <span className="cm-code__num">{i + 1}</span> : null}{language === 'java' ? tokenizeJava(ln) : ln}{ln === '' ? ' ' : ''}</span>)}
      </pre>
    </div>
  );
}
