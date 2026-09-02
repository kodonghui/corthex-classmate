import * as React from 'react';
/** Modal sheet sized for the panel (bottom-anchored by default). Escape / scrim click call onClose. */
export interface DialogProps {
  open: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Primary button label */
  primaryAction?: string;
  onPrimary?: () => void;
  primaryVariant?: 'primary' | 'danger' | 'secondary';
  /** Ghost button label; default "닫기" */
  secondaryAction?: string;
  onClose?: () => void;
  /** Sheet at the bottom (default) or centered */
  position?: 'bottom' | 'center';
  /** position:fixed scrim instead of absolute (use when not inside a relative panel) */
  fixed?: boolean;
  /** Stack actions vertically, full width */
  stackActions?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function Dialog(props: DialogProps): JSX.Element | null;
