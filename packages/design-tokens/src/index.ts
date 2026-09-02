// @classmate/design-tokens — 스켈레톤입니다. Phase 2 1라운드 단위 (1) 이 채웁니다.
//
// 정본: design/claude-design-export/design-system/tokens/*.css + styles.css (docs/design-map.md §1·§8)
// 규칙: CSS 는 값을 바꾸지 않고 그대로 옮긴다. 예외는 docs/DECISIONS.md "디자인 정본 적용 기본값" 에
//       적힌 것만(예: --panel-header-h 48 → 44). TS 상수(export const tokens)는 CSS 에서 만들고,
//       CSS 변수 이름 목록은 스냅샷 시험으로 고정한다. 폰트는 CDN 대신 npm 셀프호스팅(pretendard ·
//       @fontsource/ibm-plex-mono). 다크 모드는 없다.

/** 디자인 내보내기 정본 폴더 (저장소 루트 기준). */
export const DESIGN_SOURCE_DIR = "design/claude-design-export/design-system";

/** 정본 토큰 파일 이름. 단위 (1) 은 이 목록을 그대로 옮기고 변수 이름 스냅샷 시험을 붙인다. */
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
