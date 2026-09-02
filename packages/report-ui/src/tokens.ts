// 디자인 토큰 CSS 를 정본 파일에서 읽어 한 덩어리로 잇습니다.
//
// 1라운드 공유 규칙에 따라 `@classmate/design-tokens` 패키지를 import 하지 않습니다.
// 대신 정본 파일(`design/claude-design-export/design-system/tokens/*.css`)을 읽기만 해서
// 생성 HTML 의 <style> 에 그대로 넣습니다. 바깥 주소를 부르지 않는 한 장짜리 HTML 을 만들기 위해서입니다.
//
// fonts.css 는 CDN 을 @import 하므로 절대 넣지 않습니다. 그래서 Pretendard 가 깔려 있지 않은
// 컴퓨터에서는 시스템 sans 로 보입니다(README 의 "한계" 참고).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 정본 순서입니다. 뒤 파일이 앞 파일의 변수를 쓰기 때문에 순서를 지켜야 합니다. */
export const TOKEN_FILE_ORDER = [
  "colors.css",
  "typography.css",
  "spacing.css",
  "elevation.css",
  "motion.css",
  "base.css",
] as const;

/** CDN 을 부르는 파일이라 넣지 않습니다. */
export const EXCLUDED_TOKEN_FILES = ["fonts.css"] as const;

/** 결정 기록의 기본값입니다: 패널 머리 높이는 44px 입니다(정본 파일은 48px). */
export const PANEL_HEADER_HEIGHT = "44px";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** 저장소 안 토큰 정본 폴더입니다. packages/report-ui/src 에서 세 칸 올라가면 저장소 뿌리입니다. */
export const DEFAULT_TOKENS_DIR = path.resolve(
  HERE,
  "../../..",
  "design/claude-design-export/design-system/tokens",
);

/** 결정 기록대로 --panel-header-h 를 44px 로 바꿔 넣습니다. */
export function applyDesignDecisions(css: string): string {
  return css.replace(/(--panel-header-h:\s*)[^;]+;/g, `$1${PANEL_HEADER_HEIGHT};`);
}

/**
 * 토큰 CSS 여섯 장을 정본 순서로 이어 붙입니다.
 * 파일을 못 읽으면 그 자리를 주석 한 줄로 남기고 나머지를 잇습니다(HTML 생성이 멈추지 않게).
 */
export function readDesignTokenCss(tokensDir: string = DEFAULT_TOKENS_DIR): string {
  const blocks: string[] = [];
  for (const fileName of TOKEN_FILE_ORDER) {
    const filePath = path.join(tokensDir, fileName);
    try {
      blocks.push(`/* tokens: ${fileName} */\n${readFileSync(filePath, "utf8").trim()}`);
    } catch {
      blocks.push(`/* tokens: ${fileName} — 읽지 못해 건너뛰었습니다 */`);
    }
  }
  return applyDesignDecisions(blocks.join("\n\n"));
}
