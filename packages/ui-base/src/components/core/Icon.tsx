// 정본: design-system/components/core/Icon.jsx
// 다른 점: CDN(unpkg) 의 lucide UMD 를 <script> 로 싣던 자리를 `lucide-react` 선별 맵으로 바꿨습니다.
//          그래서 로딩 상태(useEffect·useState)가 없어지고 첫 렌더부터 아이콘이 그려집니다.

import type * as React from "react";

import { cx } from "../../cx";
import { lookupIcon } from "../../icons";

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

const warned = new Set<string>();

/**
 * 맵에 없는 이름은 개발 모드에서 한 번만 알립니다. 배포 빌드와 브라우저 번들에서는 조용합니다.
 *
 * MV3 확장·브라우저 번들에는 `process` 전역이 아예 없습니다. 예전 조건
 * (`typeof process !== "undefined" && process.env["NODE_ENV"] === "production"`)은 그때 거짓이 되어
 * 배포 빌드에서도 경고가 나갔고, 번들러의 치환도 보통 점 표기 `process.env.NODE_ENV` 만 바꿔
 * 대괄호 표기는 그대로 남았습니다. 그래서 `process` 가 없으면 조용히 지나가고,
 * 있을 때만 점 표기로 NODE_ENV 를 봅니다(`env` 가 없는 얇은 흉내 객체도 견딥니다).
 */
function warnUnknownIcon(name: string): void {
  if (typeof process === "undefined" || process.env?.NODE_ENV === "production") return;
  if (warned.has(name)) return;
  warned.add(name);
  // eslint-disable-next-line no-console -- 개발 중에만 나오는 안내입니다.
  console.warn(`[@classmate/ui-base] Icon: "${name}" 은 src/icons.ts 맵에 없어요. 맵에 이름을 추가하세요.`);
}

export function Icon({ name, size = 16, strokeWidth = 1.75, title, style, className }: IconProps): React.JSX.Element {
  const Glyph = lookupIcon(name);
  if (Glyph === undefined) {
    warnUnknownIcon(name);
    // 빈 <svg> 대신 자리만 잡는 span 을 그립니다. 읽어 주는 도구에는 보이지 않습니다.
    return (
      <span
        className={cx("cm-icon", className)}
        aria-hidden="true"
        style={{ flex: "none", display: "inline-block", width: size, height: size, verticalAlign: "middle", ...style }}
      />
    );
  }
  return (
    <Glyph
      className={cx("cm-icon", className)}
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      style={{ flex: "none", display: "inline-block", verticalAlign: "middle", ...style }}
    >
      {title ? <title>{title}</title> : null}
    </Glyph>
  );
}
