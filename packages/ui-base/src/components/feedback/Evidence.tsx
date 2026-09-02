// 정본: design-system/components/feedback/Evidence.jsx (스타일은 같은 폴더 Evidence.css)

import type * as React from "react";

import { cx } from "../../cx";
import { Icon } from "../core/Icon";

/** How the tutor knows a claim: 확인됨 (read in a source) · 일부 확인 · 추론 (guessed) · 자료 지연 (source not seen yet). Every claim carries one. */
export interface EvidenceProps {
  type?: "verified" | "partial" | "inferred" | "delayed";
  /** tiro → 전사, meet → Meet 화면, intellij → IntelliJ */
  source?: "tiro" | "meet" | "intellij" | string;
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

const SOURCE: Record<string, string> = { tiro: "전사", meet: "Meet 화면", intellij: "IntelliJ" };
const META: Record<"verified" | "partial" | "inferred" | "delayed", { head: string; icon: string; title: string }> = {
  verified: { head: "확인됨", icon: "circle-check", title: "자료에서 직접 확인한 내용" },
  partial: { head: "일부 확인", icon: "circle-dot", title: "자료에서 일부만 확인한 내용" },
  inferred: { head: "추론", icon: "circle-help", title: "근거를 바탕으로 추측한 내용" },
  delayed: { head: "자료 지연", icon: "clock", title: "이 자료가 늦게 와서 아직 못 봤어요" },
};

// Labels every claim with how the tutor knows it: 확인됨 · 일부 확인 · 추론 · 자료 지연
export function Evidence({
  type = "verified",
  source,
  time,
  reason,
  block = false,
  children,
  className,
  style,
  title,
}: EvidenceProps): React.JSX.Element {
  const m = META[type] || META.verified;
  const src = source ? SOURCE[source] || source : null;
  const detail = children || (type === "inferred" ? reason : [src, time].filter(Boolean).join(" "));
  return (
    <span
      className={cx("cm-ev", `cm-ev--${type}`, block && "cm-ev--block", className)}
      style={style}
      title={title || m.title}
    >
      <Icon name={m.icon} size={11} />
      <span>{m.head}</span>
      {detail ? (
        <>
          <span className="cm-ev__sep">·</span>
          <span className="cm-ev__t">{detail}</span>
        </>
      ) : null}
    </span>
  );
}
