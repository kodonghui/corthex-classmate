import * as React from 'react';
import { EvidenceProps } from '../feedback/Evidence';
export interface NoteChip { id: string; label: React.ReactNode; selected?: boolean }
/**
 * The answer as a margin note under the sentence it belongs to: term · time, one-sentence conclusion, evidence, 2–3 chips, "자세히 보기".
 * States: preparing (sweep) → ready → collapsed (one dashed line the learner can reopen).
 */
export interface MarginNoteProps {
  /** The caught word or "문장" */
  term: React.ReactNode;
  time?: string;
  state?: 'preparing' | 'choosing' | 'ready' | 'collapsed';
  conclusion?: React.ReactNode;
  evidence?: EvidenceProps[];
  chips?: NoteChip[];
  onChip?: (id: string) => void;
  /** Shows "자세히 보기 ▸" in the footer */
  onDetail?: () => void;
  detailLabel?: string;
  /** Right footer text, e.g. "18초 뒤 접혀요 · 기록에 남아요" */
  collapseText?: React.ReactNode;
  /** Text while preparing (default "한 줄로 정리하고 있어요") */
  waitingText?: React.ReactNode;
  /** Amber tint when the tutor is waiting on a connection */
  warn?: boolean;
  /** Collapsed → expand */
  onExpand?: () => void;
  /** Extra content between header and conclusion (e.g. a GuessList while choosing) */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
export function MarginNote(props: MarginNoteProps): JSX.Element;
