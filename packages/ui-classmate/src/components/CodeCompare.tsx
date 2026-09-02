import type * as React from "react";

import { cx } from "../cx";
import { tokenizeJava } from "../internal/base";

export interface CompareRow {
  /** "선생님" / "내 코드" */
  who: string;
  code: string;
  tone?: "teacher" | "mine";
}
/** Single lines side by side — the teacher's line vs mine. The differing line is the question. */
export interface CodeCompareProps {
  rows: CompareRow[];
  className?: string;
  style?: React.CSSProperties;
}

// Two (or more) single lines side by side: what the teacher typed vs what I typed. The differing line is the question.
export function CodeCompare({ rows = [], className, style }: CodeCompareProps): React.JSX.Element {
  return (
    <div className={cx("cm-cmp", className)} style={style}>
      {rows.map((r, i) => (
        <div key={i} className={cx("cm-cmp__r", r.tone && `cm-cmp__r--${r.tone}`)}>
          <span className="cm-cmp__w">{r.who}</span>
          <span className="cm-cmp__c">{tokenizeJava(r.code)}</span>
        </div>
      ))}
    </div>
  );
}
