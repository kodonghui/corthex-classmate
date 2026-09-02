import * as React from 'react';
/** Square icon-only button. `label` is required and becomes aria-label + title. */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Lucide icon name */
  icon: string;
  /** Accessible name, e.g. "닫기" */
  label: string;
  /** 28 / 36 px square */
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'secondary';
  /** Pressed/selected state (ink tint) */
  active?: boolean;
}
export function IconButton(props: IconButtonProps): JSX.Element;
