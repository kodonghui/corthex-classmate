import * as React from 'react';
/** A caught moment in 기록: time · the word · its one-line answer. Whole row is the button. */
export interface MomentRowProps {
  /** "10:32:18" */
  time: string;
  /** The caught word or "문장" */
  term?: React.ReactNode;
  /** The one-sentence conclusion; clamps to 2 lines */
  title?: React.ReactNode;
  period?: string;
  topic?: string;
  state?: 'ready' | 'preparing' | 'unread';
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}
export function MomentRow(props: MomentRowProps): JSX.Element;
