# @classmate/ui-base

디자인 내보내기의 기본 컴포넌트(`core`·`forms`·`feedback`·`surfaces`·`navigation`·`overlay`, JSX 22개)를
TS React 로 포팅하는 패키지입니다. 지금은 스켈레톤이며 Phase 2 1라운드 단위 (2) 가 채웁니다.

- 정본: `design/claude-design-export/design-system/components/<폴더>/*.jsx` + `.d.ts`(props 계약 유지) + `*.prompt.md`. 지도는 `docs/design-map.md` §2·§8.
- 바꾸는 것: 런타임 CSS 주입 → 빌드타임 CSS, `Icon` 의 CDN → `lucide-react`. 색만으로 상태를 구분하지 않습니다(문구 병기).
- 시험: 컴포넌트마다 Vitest 렌더 시험 1개 이상(환경 happy-dom).
- 공유 규칙(1라운드): 다른 classmate 패키지를 import 하지 않습니다. 계약은 `import type` 만, design-tokens 는 CSS 변수 이름만.
- 완료 조건: `pnpm --filter @classmate/ui-base test` exit 0 · README 한 단락 · 비밀정보·Tiro URL 없음.
- 함정: happy-dom 환경은 전역 `URL` 을 자기 것으로 바꿔 두므로 `fileURLToPath(new URL("..", import.meta.url))` 이 "The URL must be of scheme file" 로 실패합니다. `dirname(fileURLToPath(import.meta.url))` 을 쓰세요.
