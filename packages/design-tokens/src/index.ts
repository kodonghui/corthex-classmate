// @classmate/design-tokens — Corthex Classmate 의 디자인 토큰입니다.
//
// CSS 정본은 design/claude-design-export/design-system 이고, src/css/ 는 그것을 그대로 옮긴 사본입니다.
// 값을 바꾼 자리는 docs/DECISIONS.md "디자인 정본 적용 기본값" 에 적힌 --panel-header-h (48px → 44px)
// 한 줄뿐이며, fonts.css 만 CDN 대신 npm 폰트 패키지를 가리키도록 다시 썼습니다.
// TS 상수(tokens · TOKEN_NAMES · REDUCED_MOTION_OVERRIDES)는 scripts/generate-tokens.mjs 가 만듭니다.

export { REDUCED_MOTION_OVERRIDES, TOKEN_NAMES, tokens } from "./tokens";
export type { TokenName } from "./tokens";

/** 디자인 내보내기 정본 폴더 (저장소 루트 기준). src/css/ 가 이것을 옮긴 사본입니다. */
export const DESIGN_SOURCE_DIR = "design/claude-design-export/design-system";

/** 정본 토큰 파일 이름 7개. src/css/ 에 같은 이름으로 들어 있습니다. */
export const TOKEN_FILES = [
  "base.css",
  "colors.css",
  "elevation.css",
  "fonts.css",
  "motion.css",
  "spacing.css",
  "typography.css",
] as const;

export type TokenFile = (typeof TOKEN_FILES)[number];

/**
 * 정본에서 바이트 그대로 옮긴 파일 6개(fonts.css 제외).
 * spacing.css 의 --panel-header-h 한 줄만 예외로 다릅니다.
 */
export const VERBATIM_TOKEN_FILES = [
  "base.css",
  "colors.css",
  "elevation.css",
  "motion.css",
  "spacing.css",
  "typography.css",
] as const;

/** 소비자가 한 번만 import 하는 진입 CSS: `@import "@classmate/design-tokens/styles.css";` */
export const STYLES_ENTRY = "styles.css";
