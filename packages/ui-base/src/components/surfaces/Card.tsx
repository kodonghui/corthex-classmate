// 정본: design-system/components/surfaces/Card.jsx (스타일은 같은 폴더 Card.css)
// 정본은 `const Tag = interactive ? 'button' : 'div'` 로 태그를 골랐습니다. TS 에서는 두 태그의
// 속성 집합이 달라 하나의 변수로 다룰 수 없어, 같은 내용을 두 갈래로 나눠 그립니다(DOM 결과는 같습니다).

import type * as React from "react";

import { cx } from "../../cx";

/**
 * Paper card: paper-0 on the paper-1 canvas, 1px hairline, 8px radius, no shadow.
 */
export interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  /** Caption line under the title, e.g. "3교시 · 14:02" */
  meta?: React.ReactNode;
  /** Right-aligned header actions (IconButtons) */
  actions?: React.ReactNode;
  /** Footer row under a full-bleed hairline */
  footer?: React.ReactNode;
  /** paper-2 fill, no border — for quotes/code areas */
  sunken?: boolean;
  /** ink-50 fill + ink-200 border */
  selected?: boolean;
  /** Renders as a <button> with hover/press states */
  interactive?: boolean;
  /** 16 (default), 12 or 0 */
  padding?: 16 | 12 | 0;
  children?: React.ReactNode;
}

export function Card({
  title,
  meta,
  actions,
  footer,
  sunken = false,
  selected = false,
  interactive = false,
  padding = 16,
  onClick,
  children,
  className,
  style,
  ...rest
}: CardProps): React.JSX.Element {
  const classes = cx(
    "cm-card",
    sunken && "cm-card--sunken",
    selected && "cm-card--selected",
    interactive && "cm-card--interactive",
    padding === 0 && "cm-card--p0",
    padding === 12 && "cm-card--p12",
    className,
  );
  const inside = (
    <>
      {title || actions ? (
        <div className="cm-card__header">
          <div style={{ minWidth: 0 }}>
            {title ? <div className="cm-card__title">{title}</div> : null}
            {meta ? <div className="cm-card__meta">{meta}</div> : null}
          </div>
          {actions ? <div style={{ display: "flex", gap: 4, flex: "none" }}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
      {footer ? <div className="cm-card__footer">{footer}</div> : null}
    </>
  );
  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={classes} style={style} {...rest}>
        {inside}
      </button>
    );
  }
  return (
    <div onClick={onClick} className={classes} style={style} {...rest}>
      {inside}
    </div>
  );
}
