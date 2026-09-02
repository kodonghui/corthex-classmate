import * as React from 'react';
/** Hover/focus tooltip for icon-only controls. */
export interface TooltipProps {
  content: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Controlled visibility */
  open?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
export function Tooltip(props: TooltipProps): JSX.Element;
