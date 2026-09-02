import type * as React from "react";

import { cx } from "../cx";
import { Button, Icon, StatusDot } from "../internal/base";

export interface SourceItem {
  /** tiro / meet / intellij 는 기본 이름과 아이콘을 자동으로 받습니다. */
  key: "tiro" | "meet" | "intellij" | string;
  state: "live" | "paused" | "off" | "idle";
  label?: string;
  icon?: string;
  /** 기록 중 / 멈춤 / 연결 안 됨 대신 쓸 글자입니다. */
  stateLabel?: string;
  /** 아래에 덧붙이는 작은 글자입니다. 예: "마지막 전사 14:02" */
  detail?: string;
  /** 오른쪽 작은 버튼의 글자입니다. 예: "다시 연결" */
  action?: string;
}
/**
 * 세 자료(Tiro 전사 · Meet 화면 · IntelliJ 코드)의 지금 상태를 목록으로, 또는 compact 한 줄로 보여 줍니다.
 */
export interface SourceStatusProps {
  sources?: SourceItem[];
  /** 점 + 아이콘 + 짧은 이름만 한 줄로 그립니다. detail·action·stateLabel 은 이때 그리지 않습니다. */
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
