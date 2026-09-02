import * as React from 'react';
/**
 * Action button. Only one `primary` per screen; default is `secondary`.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = the one accent block on screen; secondary = outlined; ghost = text-only; danger = red text, rare */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** 28 / 36 / 44 px */
  size?: 'sm' | 'md' | 'lg';
  /** Leading Lucide icon name */
  icon?: string;
  /** Trailing Lucide icon name */
  iconRight?: string;
  /** Stretch to container width */
  full?: boolean;
  /** Shows a slow spinner and disables the button */
  loading?: boolean;
  children?: React.ReactNode;
}
export function Button(props: ButtonProps): JSX.Element;
