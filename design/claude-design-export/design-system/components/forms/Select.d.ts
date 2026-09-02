import * as React from 'react';
export interface SelectOption { value: string; label: string; disabled?: boolean }
/** Native select styled as a Classmate control with a chevron. */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  /** Strings or {value,label} objects */
  options: Array<string | SelectOption>;
  /** 28 / 36 px */
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}
export function Select(props: SelectProps): JSX.Element;
