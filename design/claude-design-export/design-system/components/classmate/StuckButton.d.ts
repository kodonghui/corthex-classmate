import * as React from 'react';
/**
 * The one hero action (56px): "지금 막혔어요". Saves the recent transcript, Meet frame and IntelliJ code in one press.
 */
export interface StuckButtonProps {
  /** idle → saving (sweep bar, disabled) → saved (check) */
  state?: 'idle' | 'saving' | 'saved';
  /** Override the state label */
  label?: React.ReactNode;
  /** Caption under the button; pass '' to hide */
  sublabel?: React.ReactNode;
  /** Keyboard hint shown at the right, e.g. "Alt+S" */
  shortcut?: string;
  /** Outlined, low-emphasis version for screens where it is not the primary action */
  quiet?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}
export function StuckButton(props: StuckButtonProps): JSX.Element;
