import * as React from 'react';
/** How the tutor knows a claim: 확인됨 (read in a source) · 일부 확인 · 추론 (guessed) · 자료 지연 (source not seen yet). Every claim carries one. */
export interface EvidenceProps {
  type?: 'verified' | 'partial' | 'inferred' | 'delayed';
  /** tiro → 전사, meet → Meet 화면, intellij → IntelliJ */
  source?: 'tiro' | 'meet' | 'intellij' | string;
  /** "10:32" */
  time?: string;
  /** For inferred: short reason */
  reason?: string;
  /** Multi-line block instead of a one-line chip */
  block?: boolean;
  /** Custom detail text (overrides source/time/reason) */
  children?: React.ReactNode;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}
export function Evidence(props: EvidenceProps): JSX.Element;
