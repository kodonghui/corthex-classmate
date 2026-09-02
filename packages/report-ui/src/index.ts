// @classmate/report-ui — 교시 세션 번들(JSON)을 교시별 상세 HTML 과 하루 허브 HTML 로 만듭니다.
//
// 맡는 것: 번들 읽기(bundle) → React 템플릿(templates) → 한 장짜리 HTML(render) → 폴더 생성(generate).
// 규칙: 모델이 준 문자열은 언제나 React 텍스트 노드로만 넣습니다. HTML 문자열을 그대로 꽂는 React prop 은
//       한 번도 쓰지 않습니다(§4-7). 지켜지는지는 test/page-css.test.ts 가 소스를 훑어 확인합니다.
//       디자인 토큰은 패키지를 import 하지 않고 정본 CSS 를 읽어 <style> 에 인라인합니다(1라운드 공유 규칙).

/** 생성물 폴더(저장소 루트 기준). .gitignore 의 out/ 에 해당합니다. */
export const REPORT_OUTPUT_DIR = "out";

export type { PeriodBundle, PeriodRef } from "./types.ts";

export { parseJsonLines, periodIndexFromId, readPeriodBundle, readPeriodBundles } from "./bundle.ts";
export {
  FRAMES_DIR,
  HUB_FILE_NAME,
  frameHref,
  isSafeBundlePath,
  periodFileName,
  periodKey,
} from "./assets.ts";
export {
  ANSWER_DETAIL_LABELS_KO,
  ANSWER_STATUS_LABELS_KO,
  EVIDENCE_LABELS_KO,
  NO_RECORD_IN_PERIOD,
  NO_RECORD_SLOT,
  QUESTION_KIND_LABELS_KO,
  SESSION_EVENT_LABELS_KO,
  TRANSCRIPT_STATE_LABELS_KO,
} from "./labels.ts";
export { PAGE_CSS } from "./page-css.ts";
export {
  DEFAULT_TOKENS_DIR,
  EXCLUDED_TOKEN_FILES,
  PANEL_HEADER_HEIGHT,
  TOKEN_FILE_ORDER,
  applyDesignDecisions,
  readDesignTokenCss,
} from "./tokens.ts";
export { HubPage, PERIODS_PER_DAY, hubPageTitle } from "./templates/HubPage.ts";
export { PeriodPage, periodPageTitle } from "./templates/PeriodPage.ts";
export { renderHubHtml, renderPeriodHtml } from "./render.ts";
export type { HubRenderOptions, RenderOptions } from "./render.ts";
export { generateDay } from "./generate.ts";
export type { GenerateDayOptions, GenerateDayResult } from "./generate.ts";
