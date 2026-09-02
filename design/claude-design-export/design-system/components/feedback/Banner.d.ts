import * as React from 'react';
/**
 * Inline, persistent status banner: what stopped, what continues, one action. Amber by default; red only for total loss.
 */
export interface BannerProps {
  tone?: 'paused' | 'off' | 'info' | 'live';
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Primary action label, e.g. "다시 연결" */
  action?: string;
  onAction?: () => void;
  secondaryAction?: string;
  onSecondaryAction?: () => void;
  /** Shows an × button */
  onDismiss?: () => void;
  /** Override the tone icon */
  icon?: string;
  className?: string;
  style?: React.CSSProperties;
}
export function Banner(props: BannerProps): JSX.Element;
