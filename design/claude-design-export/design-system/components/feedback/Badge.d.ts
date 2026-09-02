import * as React from 'react';
/** Tiny count/status pill (18px) or an 8px dot. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'soft' | 'live' | 'paused' | 'off';
  /** Render as an 8px dot with no text */
  dot?: boolean;
  children?: React.ReactNode;
}
export function Badge(props: BadgeProps): JSX.Element;
