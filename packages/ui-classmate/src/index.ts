// @classmate/ui-classmate — 스켈레톤입니다. Phase 2 1라운드 단위 (3) 이 채웁니다.
//
// 정본: design/claude-design-export/design-system/components/classmate/*.jsx 10개 + .d.ts + *.prompt.md.
//       지도는 docs/design-map.md §2·§3·§8 (상태 A~H, 문구, 함정 13개).
// 규칙: MarginNote 의 preparing 상태는 children 으로 SourceStatus compact 를 받는 현재 계약을 유지한다.
//       ui-base 를 import 하지 않는다(1라운드 공유 규칙) — 필요한 기본 요소는 이 패키지 안에 최소로 둔다.
//       계약 타입은 `import type { … } from "@classmate/contracts"` 로만(값 import 는 MV3 CSP 에 막힌다).

import { createElement, type ReactElement } from "react";

/** 정본 컴포넌트 이름 10개. 단위 (3) 은 이 이름 그대로 export 한다. */
export const CLASSMATE_COMPONENTS = [
  "TranscriptFlow",
  "MarginNote",
  "GuessList",
  "NowLine",
  "SourceFooter",
  "CodeCompare",
  "MomentRow",
  "AnswerCard",
  "SourceStatus",
  "StuckButton",
] as const;

export type ClassmateComponentName = (typeof CLASSMATE_COMPONENTS)[number];

/** 스켈레톤 확인용 컴포넌트. 단위 (3) 이 실제 컴포넌트로 바꾸면서 지운다. */
export function Placeholder(props: { name: ClassmateComponentName }): ReactElement {
  return createElement("div", { "data-classmate": props.name }, props.name);
}
