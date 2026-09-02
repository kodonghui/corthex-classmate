import * as React from 'react';
/** One line saying where the teacher is right now ("지금 · 생성자 주입 코드로 넘어갔어요") so the learner can step back in. */
export interface NowLineProps {
  children?: React.ReactNode;
  /** rule = centered between hairlines (inside the transcript) · plain = green dot + text */
  variant?: 'rule' | 'plain';
  className?: string;
  style?: React.CSSProperties;
}
export function NowLine(props: NowLineProps): JSX.Element;
