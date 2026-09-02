import * as React from 'react';
/**
 * Paper card: paper-0 on the paper-1 canvas, 1px hairline, 8px radius, no shadow.
 */
export interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
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
export function Card(props: CardProps): JSX.Element;
