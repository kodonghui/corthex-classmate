// @classmate/report-ui — 스켈레톤입니다. Phase 2 1라운드 단위 (10) 이 채웁니다.
//
// 맡는 것: 교시 세션 번들(fixtures/README.md "교시 세션 번들") → 교시별 상세 HTML + 하루 허브 HTML 정적 생성.
// 규칙: React 템플릿(react-dom/server)으로만 HTML 을 만든다. 모델이 준 문자열은 항상 텍스트로 넣고
//       HTML 로 직접 삽입하지 않는다(dangerouslySetInnerHTML 금지, §4-7). design-tokens 는 이번 라운드에는
//       패키지 import 없이 CSS 변수 이름만 쓴다. 출력은 out/ (gitignore) 에 만든다.

import { createElement, type ReactElement } from "react";

/** 생성물 폴더(저장소 루트 기준). .gitignore 의 out/ 에 해당한다. */
export const REPORT_OUTPUT_DIR = "out";

/** 스켈레톤 확인용 템플릿. 단위 (10) 이 교시 상세 템플릿으로 바꾸면서 지운다. */
export function PeriodPagePlaceholder(props: { periodId: string; title: string }): ReactElement {
  return createElement(
    "main",
    { "data-classmate": "report-ui", "data-period-id": props.periodId },
    createElement("h1", null, props.title),
  );
}
