// 시험이 정본과 포팅본을 찾는 경로입니다.
//
// 함정: happy-dom 환경은 전역 URL 을 자기 것으로 바꿔 두어 fileURLToPath(new URL(".", import.meta.url)) 이
// "The URL must be of scheme file" 로 죽습니다. 문자열 import.meta.url 을 바로 넘기고 dirname 으로 올라갑니다.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** packages/ui-classmate */
export const pkgRoot = join(here, "..");
/** packages/ui-classmate/src */
export const srcRoot = join(pkgRoot, "src");
/** 저장소 뿌리 */
export const repoRoot = join(pkgRoot, "..", "..");
/** 디자인 내보내기 뿌리 (읽기만 합니다) */
export const designRoot = join(repoRoot, "design/claude-design-export");
/** 정본 컴포넌트 폴더 (읽기만 합니다) */
export const canonRoot = join(designRoot, "design-system/components");
/** 문구 결정이 갈린 자리. dc.html 은 오타와 합니다체가 남아 있는 쪽입니다 (docs/design-map.md §7 함정 7·8). */
export const sidePanelDcHtml = join(designRoot, "project-classmate-side-panel/Classmate Side Panel.dc.html");
