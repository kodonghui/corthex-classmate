import * as React from 'react';
/** Transient confirmation ("저장했어요"); dark by default, auto-closes after 3.2s when onClose is given. */
export interface ToastProps {
  message: React.ReactNode;
  /** Lucide icon name */
  icon?: string;
  tone?: 'dark' | 'light';
  /** Tint the icon with the live green */
  live?: boolean;
  /** Inline text action, e.g. "보기" */
  action?: string;
  onAction?: () => void;
  /** ms before onClose fires; 0 disables */
  duration?: number;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
}
export function Toast(props: ToastProps): JSX.Element;
/** Absolutely-positioned bottom-center slot inside a relative panel. */
export interface ToastHostProps { children?: React.ReactNode; className?: string; style?: React.CSSProperties }
export function ToastHost(props: ToastHostProps): JSX.Element;
