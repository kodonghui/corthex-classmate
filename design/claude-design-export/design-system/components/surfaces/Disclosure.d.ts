import * as React from 'react';
/** Labeled expandable row ("왜 그런가요 ▾"). Details stay hidden until the learner asks. */
export interface DisclosureProps {
  label: React.ReactNode;
  /** Caption next to the label, e.g. "Tiro 14:02" */
  meta?: React.ReactNode;
  /** Leading Lucide icon */
  icon?: string;
  /** Controlled open state */
  open?: boolean;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  /** Removes the top hairline (first in a stack) */
  first?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
export function Disclosure(props: DisclosureProps): JSX.Element;
