import * as React from 'react';
/** Static metadata label (22px): 교시, topic, source. Not clickable — use Chip for actions. */
export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'outline' | 'sunken' | 'accent';
  /** Leading Lucide icon (12px) */
  icon?: string;
  /** Mono font for identifiers */
  mono?: boolean;
  /** Shows an × button */
  onRemove?: () => void;
  removeLabel?: string;
  children?: React.ReactNode;
}
export function Tag(props: TagProps): JSX.Element;
