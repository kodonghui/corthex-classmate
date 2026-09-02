import type * as React from "react";

import { cx } from "../cx";
import { tokenizeJava } from "../internal/base";

export interface CompareRow {
  /** "선생님" / "내 코드" */
  who: string;
  code: string;
  tone?: "teacher" | "mine";
}
/** 선생님 줄과 내 줄을 한 줄씩 나란히 놓습니다. 다른 줄이 곧 질문입니다. */
export interface CodeCompareProps {
  rows: CompareRow[];
  className?: string;
  style?: React.CSSProperties;
}

// 선생님이 친 줄과 내가 친 줄을 둘 이상 나란히 놓습니다. 다른 줄이 곧 질문입니다.
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
