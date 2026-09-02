// @classmate/ui-base — 스켈레톤입니다. Phase 2 1라운드 단위 (2) 가 채웁니다.
//
// 정본: design/claude-design-export/design-system/components/{core,forms,feedback,surfaces,navigation,overlay}/*.jsx
//       + 같은 이름의 .d.ts(props 계약) + *.prompt.md(의도). 지도는 docs/design-map.md §2·§8.
// 규칙: .d.ts 의 props 계약을 지키며 TS React 로 포팅한다. 런타임 CSS 주입은 빌드타임 CSS 로,
//       Icon 의 CDN 로딩은 lucide-react 로 바꾼다. 컴포넌트마다 Vitest 렌더 시험 1개 이상.
//       다른 classmate 패키지는 import 하지 않는다(계약 타입 `import type` · design-tokens 변수 이름만).

import { createElement, type ReactElement } from "react";

/** 정본 컴포넌트 폴더 이름. 단위 (2) 가 이 여섯 폴더의 *.jsx 를 모두 옮긴다. */
export const UI_BASE_SOURCE_DIRS = ["core", "forms", "feedback", "surfaces", "navigation", "overlay"] as const;

/** 스켈레톤 확인용 컴포넌트. 단위 (2) 가 실제 컴포넌트로 바꾸면서 지운다. */
export function Placeholder(props: { label: string }): ReactElement {
  return createElement("div", { "data-classmate": "ui-base" }, props.label);
}
