import React, { useId, useState } from 'react';
import { css, cx } from '../core/cm.js';

css('cm-tooltip', `
.cm-tt{position:relative;display:inline-flex}
.cm-tt__bub{position:absolute;z-index:var(--z-tooltip);padding:5px 8px;border-radius:var(--radius-md);background:var(--surface-inverse);color:var(--text-inverse);font:var(--type-caption);white-space:nowrap;box-shadow:var(--shadow-md);pointer-events:none;animation:cm-fade-in var(--duration-fast) var(--ease-enter) both}
.cm-tt__bub--top{bottom:calc(100% + 6px);left:50%;transform:translateX(-50%)}
.cm-tt__bub--bottom{top:calc(100% + 6px);left:50%;transform:translateX(-50%)}
.cm-tt__bub--left{right:calc(100% + 6px);top:50%;transform:translateY(-50%)}
.cm-tt__bub--right{left:calc(100% + 6px);top:50%;transform:translateY(-50%)}
`);

export function Tooltip({ content, side = 'top', open, children, className, style }) {
  const [hover, setHover] = useState(false);
  const id = useId();
  const show = open === undefined ? hover : open;
  return (
    <span className={cx('cm-tt', className)} style={style} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)} aria-describedby={show ? `cm-tt-${id}` : undefined}>
      {children}
      {show ? <span role="tooltip" id={`cm-tt-${id}`} className={cx('cm-tt__bub', `cm-tt__bub--${side}`)}>{content}</span> : null}
    </span>
  );
}
