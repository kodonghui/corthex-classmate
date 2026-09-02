import * as React from 'react';
/** On/off switch (34×20) with label on the left by default — used for settings rows. */
export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  description?: string;
  /** Where the label sits relative to the track */
  labelPosition?: 'start' | 'end';
  className?: string;
  style?: React.CSSProperties;
}
export function Switch(props: SwitchProps): JSX.Element;
