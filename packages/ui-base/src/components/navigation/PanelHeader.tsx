// 정본: design-system/components/navigation/PanelHeader.jsx (스타일은 같은 폴더 PanelHeader.css)
// 높이는 CSS 에 44px 로 박혀 있습니다(--panel-header-h 는 쓰지 않습니다, docs/DECISIONS.md).

import type * as React from "react";

import { cx } from "../../cx";
import { IconButton } from "../core/IconButton";

/** 44px sticky header: status dot · "topic · 3교시" · clock · actions. Quiet by design; the transcript below is the loud part. */
export interface PanelHeaderProps {
  /** e.g. "IoC 컨테이너와 의존성 주입" — omit title+subtitle to show the wordmark */
  title?: React.ReactNode;
  /** e.g. "3교시" */
  subtitle?: React.ReactNode;
  /** Bold title */
  strong?: boolean;
  /** "10:32:18" in mono */
  time?: string;
  status?: "live" | "paused" | "off" | "idle";
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// 44px 로 위에 붙어 있는 머리말입니다: 상태 점 · 지금 수업이 어디를 지나는지 · 시계.
// 제목은 조용하게 두고, 아래 전사가 눈에 띄는 자리입니다.
export function PanelHeader({
  title,
  subtitle,
  strong = false,
  time,
  status,
  onBack,
  backLabel = "뒤로",
  actions,
  className,
  style,
}: PanelHeaderProps): React.JSX.Element {
  const text = [title, subtitle].filter(Boolean);
  return (
    // 정본은 `onBack && …` · `actions && …` 입니다. 함수·ReactNode 라 `!!` 로 boolean 을 만들어 넘깁니다.
    <header className={cx("cm-ph", !!onBack && "cm-ph--back", !!actions && "cm-ph--acts", className)} style={style}>
      {onBack ? <IconButton icon="arrow-left" label={backLabel} onClick={onBack} size="sm" /> : null}
      {status ? <span className={cx("cm-ph__d", `cm-ph__d--${status}`)} aria-hidden="true"></span> : null}
      {text.length ? (
        <div className="cm-ph__t">
          {strong ? <b>{title}</b> : title}
          {subtitle ? (
            <>
              {title ? " · " : ""}
              {subtitle}
            </>
          ) : null}
        </div>
      ) : (
        <div className="cm-ph__wm">
          Corthex <i>Classmate</i>
        </div>
      )}
      {time ? <span className="cm-ph__time">{time}</span> : null}
      {actions ? <div className="cm-ph__acts">{actions}</div> : null}
    </header>
  );
}
