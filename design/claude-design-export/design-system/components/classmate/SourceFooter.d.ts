import * as React from 'react';
export interface FooterSource { key: 'tiro' | 'meet' | 'intellij' | string; state?: 'live' | 'paused' | 'off' | 'idle'; /** "4초 전" */ ago?: string; label?: string }
export interface FooterWarn { tone?: 'paused' | 'off'; title: React.ReactNode; description?: React.ReactNode; action?: string; onAction?: () => void }
/**
 * The quiet bottom line of every screen: three freshness dots + "전사 4초 전 · Meet 2초 전 · IntelliJ 1초 전" + 기록 count.
 * Pass `warn` to replace it with what stopped and what continues (amber), or red when nothing works.
 */
export interface SourceFooterProps {
  sources?: FooterSource[];
  count?: number;
  countLabel?: string;
  /** Makes the count a button (opens 기록) */
  onCount?: () => void;
  warn?: FooterWarn;
  className?: string;
  style?: React.CSSProperties;
}
export function SourceFooter(props: SourceFooterProps): JSX.Element;
