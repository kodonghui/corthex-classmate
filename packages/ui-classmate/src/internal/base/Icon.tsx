import type * as React from "react";

import { cx } from "../../cx";
import { ICONS } from "../../icons";

/** 선으로 그린 Lucide 아이콘입니다. 크기는 16/18/20 이고 색은 currentColor 를 따릅니다. */
export interface IconProps {
  /** kebab-case 로 적은 Lucide 아이콘 이름입니다. 예: "hand", "circle-check", "chevron-down" */
  name: string;
  /** 픽셀 크기입니다. 글 속은 16, 조작 요소 안은 18, 큰 자리와 빈 상태는 20 입니다. */
  size?: number;
  strokeWidth?: number;
  /** 읽어 주는 도구가 부를 이름입니다. 장식용 아이콘이면 넘기지 않습니다(aria-hidden 이 붙습니다). */
  title?: string;
  style?: React.CSSProperties;
  className?: string;
}

const warned = new Set<string>();

/**
 * 맵에 없는 이름을 이름마다 한 번씩만 알립니다.
 *
 * 판정을 "배포 빌드일 때만 조용"으로 둡니다. 이 패키지가 겨냥하는 MV3 확장 번들에는 `process` 자체가
 * 없어서, 반대로 "개발 모드일 때만 시끄럽게"로 두면 정작 그 자리에서 경고가 영영 나오지 않습니다.
 * `typeof` 로 먼저 막고 `?.` 를 붙여, `process` 가 없거나 `env` 가 비어 있어도 오류가 나지 않습니다.
 */
function warnUnknownIcon(name: string): void {
  if (typeof process !== "undefined" && process.env?.["NODE_ENV"] === "production") return;
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(`[ui-classmate] 아이콘 이름 "${name}" 이 src/icons.ts 맵에 없습니다.`);
}

export function Icon({ name, size = 16, strokeWidth = 1.75, title, style, className }: IconProps): React.JSX.Element {
  const base: React.CSSProperties = { flex: "none", display: "inline-block", verticalAlign: "middle", ...style };
  const Glyph = ICONS[name];

  // 맵에 없는 이름은 화면을 깨뜨리지 않고 같은 크기의 빈 자리를 남깁니다.
  if (Glyph === undefined) {
    warnUnknownIcon(name);
    return <span className={cx("cm-icon", className)} aria-hidden="true" style={{ width: size, height: size, ...base }} />;
  }

  // title 이 있으면 읽어 주는 그림, 없으면 장식입니다. 참·거짓 판정이라 title="" 도 장식으로 지나갑니다
  // (정본 core/Icon.jsx 와 같습니다. 이름 없는 role="img" 를 만들지 않으려는 것입니다).
  // exactOptionalPropertyTypes 때문에 속성을 객체로 만들어 펼쳐서 넘깁니다.
  const a11y = title ? ({ role: "img" } as const) : ({ "aria-hidden": true } as const);
  return (
    <Glyph className={cx("cm-icon", className)} size={size} strokeWidth={strokeWidth} style={base} {...a11y}>
      {title ? <title>{title}</title> : null}
    </Glyph>
  );
}
