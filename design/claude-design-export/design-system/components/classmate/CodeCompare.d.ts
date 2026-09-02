import * as React from 'react';
export interface CompareRow { /** "선생님" / "내 코드" */ who: string; code: string; tone?: 'teacher' | 'mine' }
/** Single lines side by side — the teacher's line vs mine. The differing line is the question. */
export interface CodeCompareProps { rows: CompareRow[]; className?: string; style?: React.CSSProperties }
export function CodeCompare(props: CodeCompareProps): JSX.Element;
