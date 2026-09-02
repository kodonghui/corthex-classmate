import type * as React from "react";

import { cx } from "../../cx";
import { ICONS } from "../../icons";

/** Lucide stroke icon, sized 16/18/20, color from currentColor. */
export interface IconProps {
  /** Lucide icon name in kebab-case, e.g. "hand", "circle-check", "chevron-down" */
  name: string;
  /** Pixel size. 16 inline, 18 in controls, 20 hero/empty states */
  size?: number;
  strokeWidth?: number;
  /** Accessible title; omit for decorative icons (aria-hidden) */
  title?: string;
  style?: React.CSSProperties;
  className?: string;
}

const isDev = typeof process !== "undefined" && process.env["NODE_ENV"] !== "production";
const warned = new Set<string>();

export function Icon({ name, size = 16, strokeWidth = 1.75, title, style, className }: IconProps): React.JSX.Element {
  const base: React.CSSProperties = { flex: "none", display: "inline-block", verticalAlign: "middle", ...style };
  const Glyph = ICONS[name];

  // 맵에 없는 이름은 화면을 깨뜨리지 않고 같은 크기의 빈 자리를 남깁니다. 개발 중에만 한 번 알립니다.
  if (Glyph === undefined) {
    if (isDev && !warned.has(name)) {
      warned.add(name);
      console.warn(`[ui-classmate] 아이콘 이름 "${name}" 이 src/icons.ts 맵에 없습니다.`);
    }
    return <span className={cx("cm-icon", className)} aria-hidden="true" style={{ width: size, height: size, ...base }} />;
  }

  // title 이 있으면 읽어 주는 그림, 없으면 장식입니다. exactOptionalPropertyTypes 때문에 펼쳐서 넘깁니다.
  const a11y = title === undefined ? ({ "aria-hidden": true } as const) : ({ role: "img" } as const);
  return (
    <Glyph className={cx("cm-icon", className)} size={size} strokeWidth={strokeWidth} style={base} {...a11y}>
      {title === undefined ? null : <title>{title}</title>}
    </Glyph>
  );
}
