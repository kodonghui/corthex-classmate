import * as React from 'react';
export interface TabItem { id: string; label: React.ReactNode; icon?: string; count?: number; disabled?: boolean }
/** Underline tabs (default) or a segmented control; controlled via value/onChange. */
export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange?: (id: string) => void;
  /** 40 / 32 px tall */
  size?: 'md' | 'sm';
  variant?: 'underline' | 'segmented';
  /** Tabs share the width equally */
  fill?: boolean;
  'aria-label'?: string;
  className?: string;
  style?: React.CSSProperties;
}
export function Tabs(props: TabsProps): JSX.Element;
