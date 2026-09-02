import * as React from 'react';
export interface TranscriptSegment { text: string; /** true = tappable term (dotted underline) */ term?: boolean }
export interface TranscriptLine { id: string; /** "10:32:18" */ time?: string; segments: TranscriptSegment[] }
/**
 * The teacher's recent sentences, large (19/31), newest at the bottom. Tapping a dotted term — or the whole sentence — IS the question.
 * The last two lines read at full ink; older lines fade toward paper.
 */
export interface TranscriptFlowProps {
  lines: TranscriptLine[];
  /** "<lineId>:<segmentIndex>" of the term currently caught */
  active?: string;
  /** Terms already caught earlier (solid underline) */
  marked?: string[];
  onTerm?: (lineId: string, segmentIndex: number, segment: TranscriptSegment) => void;
  /** Tap on a sentence's plain text */
  onSentence?: (lineId: string) => void;
  /** Render content directly under a line (a MarginNote) */
  renderAfter?: (lineId: string) => React.ReactNode;
  /** Hairline caption at the bottom, e.g. "걸리는 말을 누르세요" */
  tip?: React.ReactNode;
  showTimes?: boolean;
  /** lg 19/31 (default) · md 16/25 for 기록 detail */
  size?: 'lg' | 'md';
  className?: string;
  style?: React.CSSProperties;
}
export function TranscriptFlow(props: TranscriptFlowProps): JSX.Element;
