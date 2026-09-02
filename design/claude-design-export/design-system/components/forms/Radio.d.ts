import * as React from 'react';
/** Single radio with label/description. Prefer RadioGroup for a set. */
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: string;
  className?: string;
  style?: React.CSSProperties;
}
export function Radio(props: RadioProps): JSX.Element;
export interface RadioGroupOption { value: string; label: React.ReactNode; description?: string; disabled?: boolean }
/** Controlled group of radios. */
export interface RadioGroupProps {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  options: RadioGroupOption[];
  direction?: 'column' | 'row';
  className?: string;
  style?: React.CSSProperties;
}
export function RadioGroup(props: RadioGroupProps): JSX.Element;
