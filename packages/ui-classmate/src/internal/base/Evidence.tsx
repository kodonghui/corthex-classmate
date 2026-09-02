import type * as React from "react";

import { cx } from "../../cx";
import { Icon } from "./Icon";

/** 튜터가 그 말을 어떻게 아는지 붙입니다. 확인됨(자료에서 직접 읽음) · 일부 확인 · 추론(짐작) · 자료 지연(아직 자료를 못 봄) 넷 중 하나가 모든 주장에 하나씩 붙습니다. */
export interface EvidenceProps {
  type?: "verified" | "partial" | "inferred" | "delayed";
  /** tiro → 전사, meet → Meet 화면, intellij → IntelliJ 로 이름을 바꿔 보여 줍니다. */
  source?: "tiro" | "meet" | "intellij" | string;
  /** "10:32" */
  time?: string;
  /** type 이 inferred 일 때 보여 줄 짧은 이유입니다. */
  reason?: string;
  /** 한 줄 칩 대신 여러 줄 덩어리로 그립니다. */
  block?: boolean;
  /** 상세 글자를 직접 넣습니다. source · time · reason 보다 우선합니다. */
  children?: React.ReactNode;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SOURCE: Record<string, string> = { tiro: "전사", meet: "Meet 화면", intellij: "IntelliJ" };
const META = {
  verified: { head: "확인됨", icon: "circle-check", title: "자료에서 직접 확인한 내용" },
  partial: { head: "일부 확인", icon: "circle-dot", title: "자료에서 일부만 확인한 내용" },
  inferred: { head: "추론", icon: "circle-help", title: "근거를 바탕으로 추측한 내용" },
  delayed: { head: "자료 지연", icon: "clock", title: "이 자료가 늦게 와서 아직 못 봤어요" },
} as const;

// 모든 주장에 "튜터가 어떻게 아는지"를 붙입니다. 확인됨 · 일부 확인 · 추론 · 자료 지연
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
