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
 * 모든 화면 맨 아래에 조용히 놓이는 한 줄입니다. 신선도 점 3개 + "전사 4초 전 · 화면 2초 전 · IntelliJ 1초 전" + 기록 개수.
 * `warn` 을 넘기면 그 자리가 "무엇이 멈췄고 무엇이 계속되는지"로 바뀝니다(호박색, 아무것도 안 되면 빨간색).
 *
 * `count` 는 넘긴 그대로 그립니다. "붙잡은 순간 중 term 이 있는 것만 센다"는 규칙(docs/DECISIONS.md)은
 * 세는 쪽(화면)의 몫입니다. count 를 넘기지 않으면 기록 칸 자체가 나오지 않습니다.
 */
export interface SourceFooterProps {
  sources?: FooterSource[];
  count?: number;
  countLabel?: string;
  /** 기록 개수를 버튼으로 만듭니다. 누르면 기록이 열립니다. */
  onCount?: () => void;
  warn?: FooterWarn;
  className?: string;
  style?: React.CSSProperties;
}

const LABEL: Record<string, string> = { tiro: "전사", meet: "화면", intellij: "IntelliJ" };

// 맨 아래 조용한 한 줄입니다. 자료마다 얼마나 새것인지와 순간을 몇 개 담아 두었는지 보여 줍니다. warn 이 오면 멈춘 것 + 계속되는 것으로 바뀝니다.
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
