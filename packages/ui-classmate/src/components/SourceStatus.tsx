import type * as React from "react";

import { cx } from "../cx";
import { Button, Icon, StatusDot } from "../internal/base";

export interface SourceItem {
  /** tiro / meet / intellij get default labels and icons */
  key: "tiro" | "meet" | "intellij" | string;
  state: "live" | "paused" | "off" | "idle";
  label?: string;
  icon?: string;
  /** Overrides 기록 중 / 멈춤 / 연결 안 됨 */
  stateLabel?: string;
  /** Caption, e.g. "마지막 전사 14:02" */
  detail?: string;
  /** Small secondary button label, e.g. "다시 연결" */
  action?: string;
}
/**
 * Live status of the three inputs (Tiro 전사, Meet 화면, IntelliJ 코드) as a list or a compact row.
 */
export interface SourceStatusProps {
  sources?: SourceItem[];
  /** One row of dot + icon + short name. detail·action·stateLabel 은 이때 그리지 않습니다. */
  compact?: boolean;
  onAction?: (key: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const META: Record<string, { label: string; icon: string }> = {
  tiro: { label: "Tiro 전사", icon: "mic" },
  meet: { label: "Meet 화면", icon: "monitor" },
  intellij: { label: "IntelliJ 코드", icon: "code-xml" },
};
const STATE_LABEL: Record<string, string> = { live: "기록 중", paused: "멈춤", off: "연결 안 됨", idle: "대기" };

const DEFAULT_SOURCES: SourceItem[] = [
  { key: "tiro", state: "live" },
  { key: "meet", state: "live" },
  { key: "intellij", state: "live" },
];

export function SourceStatus({
  sources = DEFAULT_SOURCES,
  compact = false,
  onAction,
  className,
  style,
}: SourceStatusProps): React.JSX.Element {
  if (compact)
    return (
      <div className={cx("cm-src", "cm-src--compact", className)} style={style}>
        {sources.map((s) => {
          const m = META[s.key] || { label: s.label || s.key, icon: s.icon || "circle" };
          return (
            <span key={s.key} className="cm-src__c" title={`${m.label} · ${STATE_LABEL[s.state] || s.state}`}>
              <StatusDot state={s.state} />
              <Icon name={m.icon} size={14} />
              <span>{s.label || m.label.split(" ")[0] || ""}</span>
            </span>
          );
        })}
      </div>
    );
  return (
    <div className={cx("cm-src", className)} style={style} role="list">
      {sources.map((s) => {
        const m = META[s.key] || { label: s.label || s.key, icon: s.icon || "circle" };
        return (
          <div key={s.key} role="listitem" className={cx("cm-src__row", `cm-src__row--${s.state}`)}>
            <span className="cm-src__ic">
              <Icon name={m.icon} size={18} />
            </span>
            <div className="cm-src__main">
              <div className="cm-src__name">
                <span>{s.label || m.label}</span>
                <StatusDot state={s.state} label={s.stateLabel || STATE_LABEL[s.state]} />
              </div>
              {s.detail ? <div className="cm-src__detail">{s.detail}</div> : null}
            </div>
            {s.action ? (
              <span className="cm-src__act">
                <Button size="sm" onClick={() => onAction && onAction(s.key)}>
                  {s.action}
                </Button>
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
