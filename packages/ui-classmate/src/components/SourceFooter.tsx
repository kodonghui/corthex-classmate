import type * as React from "react";

import { cx } from "../cx";

export interface FooterSource {
  key: "tiro" | "meet" | "intellij" | string;
  state?: "live" | "paused" | "off" | "idle";
  /** "4초 전" */
  ago?: string;
  label?: string;
}
export interface FooterWarn {
  tone?: "paused" | "off";
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: string;
  onAction?: () => void;
}
/**
 * The quiet bottom line of every screen: three freshness dots + "전사 4초 전 · Meet 2초 전 · IntelliJ 1초 전" + 기록 count.
 * Pass `warn` to replace it with what stopped and what continues (amber), or red when nothing works.
 *
 * `count` 는 넘긴 그대로 그립니다. "붙잡은 순간 중 term 이 있는 것만 센다"는 규칙(docs/DECISIONS.md)은
 * 세는 쪽(화면)의 몫입니다. count 를 넘기지 않으면 기록 칸 자체가 나오지 않습니다.
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

const LABEL: Record<string, string> = { tiro: "전사", meet: "Meet", intellij: "IntelliJ" };

// One quiet line at the bottom: how fresh each source is, and how many moments are kept. warn replaces it with what stopped + what continues.
export function SourceFooter({
  sources = [],
  count,
  countLabel = "기록",
  onCount,
  warn,
  className,
  style,
}: SourceFooterProps): React.JSX.Element {
  const right =
    count == null ? null : onCount ? (
      <button type="button" className="cm-sf__r" onClick={onCount}>
        {countLabel} {count}
      </button>
    ) : (
      <span className="cm-sf__r">
        {countLabel} {count}
      </span>
    );
  if (warn)
    return (
      <div className={cx("cm-sf", `cm-sf--${warn.tone || "paused"}`, className)} style={style} role="status">
        <span className="cm-sf__w">
          <b>{warn.title}</b>
          {warn.description ? <> {warn.description}</> : null}
          {warn.action ? (
            <button type="button" className="cm-sf__a" onClick={warn.onAction}>
              {warn.action}
            </button>
          ) : null}
        </span>
        {right}
      </div>
    );
  return (
    <div className={cx("cm-sf", className)} style={style} role="status">
      <span className="cm-sf__dots" aria-hidden="true">
        {sources.map((s) => (
          <span key={s.key} className={cx("cm-sf__d", s.state && s.state !== "live" && `cm-sf__d--${s.state}`)}></span>
        ))}
      </span>
      <span className="cm-sf__t">
        {sources.map((s) => `${s.label || LABEL[s.key] || s.key} ${s.ago || ""}`.trim()).join(" · ")}
      </span>
      {right}
    </div>
  );
}
