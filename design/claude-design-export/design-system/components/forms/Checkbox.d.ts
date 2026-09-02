import * as React from 'react';
/** Checkbox with label and optional description; 18px box, ink fill when checked. */
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: string;
  indeterminate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function Checkbox(props: CheckboxProps): JSX.Element;
