import * as React from 'react';
/**
 * Small actionable chip for quick follow-ups ("더 쉽게", "예시 더") and filters. Toggle with `selected`.
 */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Leading Lucide icon name (14px) */
  icon?: string;
  selected?: boolean;
  children?: React.ReactNode;
}
export function Chip(props: ChipProps): JSX.Element;
/** Wrapping flex row with 6px gaps for chips. */
export interface ChipGroupProps { children?: React.ReactNode; className?: string; style?: React.CSSProperties }
export function ChipGroup(props: ChipGroupProps): JSX.Element;
