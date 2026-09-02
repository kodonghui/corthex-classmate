import * as React from 'react';
/** 44px sticky header: status dot · "topic · 3교시" · clock · actions. Quiet by design; the transcript below is the loud part. */
export interface PanelHeaderProps {
  /** e.g. "IoC 컨테이너와 의존성 주입" — omit title+subtitle to show the wordmark */
  title?: React.ReactNode;
  /** e.g. "3교시" */
  subtitle?: React.ReactNode;
  /** Bold title */
  strong?: boolean;
  /** "10:32:18" in mono */
  time?: string;
  status?: 'live' | 'paused' | 'off' | 'idle';
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
export function PanelHeader(props: PanelHeaderProps): JSX.Element;
