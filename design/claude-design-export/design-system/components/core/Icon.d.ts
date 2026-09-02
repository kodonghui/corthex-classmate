import * as React from 'react';
/** Lucide stroke icon, sized 16/18/20, color from currentColor. */
export interface IconProps {
  /** Lucide icon name in kebab-case, e.g. "hand", "circle-check", "chevron-down" */
  name: string;
  /** Pixel size. 16 inline, 18 in controls, 20 hero/empty states */
  size?: number;
  strokeWidth?: number;
  /** Accessible title; omit for decorative icons (aria-hidden) */
  title?: string;
  style?: React.CSSProperties;
  className?: string;
}
export function Icon(props: IconProps): JSX.Element;
