import * as React from 'react';
import { EvidenceProps } from '../feedback/Evidence';
export interface AnswerSection {
  id?: string;
  label: React.ReactNode;
  icon?: string;
  meta?: React.ReactNode;
  type?: 'text' | 'code' | 'quote';
  /** text: string or string[] paragraphs; quote: the quoted sentence */
  content?: string | string[];
  code?: string;
  caption?: React.ReactNode;
  source?: React.ReactNode;
  highlightLines?: number[];
  lineNumbers?: boolean;
  /** quote: speaker (default 선생님) and Tiro time */
  speaker?: string;
  time?: string;
  defaultOpen?: boolean;
}
export interface FollowUp { id: string; label: React.ReactNode; icon?: string; selected?: boolean }
/**
 * Conclusion-first answer: one sentence, evidence tags, collapsed detail sections, quick follow-up chips.
 */
export interface AnswerCardProps {
  /** One sentence, ≤ 40 Korean characters */
  conclusion: React.ReactNode;
  topic?: string;
  time?: string;
  period?: string;
  evidence?: EvidenceProps[];
  sections?: AnswerSection[];
  followUps?: FollowUp[];
  onFollowUp?: (id: string) => void;
  followUpLabel?: React.ReactNode;
  /** Skeleton with sweep and loadingText */
  loading?: boolean;
  loadingText?: string;
  /** Controlled: id of the single open section */
  openSection?: string | number | null;
  onSectionToggle?: (id: string | number, open: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
}
export function AnswerCard(props: AnswerCardProps): JSX.Element;
