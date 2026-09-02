import * as React from 'react';
export interface SourceItem {
  /** tiro / meet / intellij get default labels and icons */
  key: 'tiro' | 'meet' | 'intellij' | string;
  state: 'live' | 'paused' | 'off' | 'idle';
  label?: string;
  icon?: string;
  /** Overrides 기록 중 / 멈춤 / 연결 안 됨 */
  stateLabel?: string;
  /** Caption, e.g. "마지막 전사 14:02" */
  detail?: string;
  /** Small secondary button label, e.g. "다시 연결" */
  action?: string;
}
/**
 * Live status of the three inputs (Tiro 전사, Meet 화면, IntelliJ 코드) as a list or a compact row.
 */
export interface SourceStatusProps {
  sources?: SourceItem[];
  /** One row of dot + icon + short name */
  compact?: boolean;
  onAction?: (key: string) => void;
  className?: string;
  style?: React.CSSProperties;
}
export function SourceStatus(props: SourceStatusProps): JSX.Element;
