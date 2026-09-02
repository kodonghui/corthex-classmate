import * as React from 'react';
/**
 * Single-line text field with optional label, leading icon, trailing slot and hint.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Helper or error text under the field */
  hint?: string;
  /** Leading Lucide icon name */
  icon?: string;
  /** Trailing element, e.g. an IconButton size="sm" */
  trailing?: React.ReactNode;
  /** 36 / 44 px */
  size?: 'md' | 'lg';
  invalid?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function Input(props: InputProps): JSX.Element;
