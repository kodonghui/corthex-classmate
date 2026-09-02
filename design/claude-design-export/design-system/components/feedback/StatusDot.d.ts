import * as React from 'react';
/** 8px status dot with optional caption; live dots breathe. */
export interface StatusDotProps {
  state?: 'live' | 'paused' | 'off' | 'idle';
  label?: React.ReactNode;
  /** Defaults to true for live */
  breathe?: boolean;
  /** Use text-secondary instead of the status color for the label */
  muted?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function StatusDot(props: StatusDotProps): JSX.Element;
