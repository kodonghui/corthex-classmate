# @classmate/design-tokens

디자인 내보내기의 토큰 CSS 를 **그대로** 담고, 같은 값을 TS 상수로도 내놓는 패키지입니다.
지금은 스켈레톤이며 Phase 2 1라운드 단위 (1) 이 채웁니다.

- 정본: `design/claude-design-export/design-system/tokens/*.css`(7개) + `styles.css`. 지도는 `docs/design-map.md` §1·§8.
- 할 일: CSS 를 값 수정 없이 옮기기 → `export const tokens`(CSS 에서 생성) → CSS 변수 이름 목록 스냅샷 시험 → 폰트를 npm 셀프호스팅(pretendard · @fontsource/ibm-plex-mono)으로.
- 값을 바꾸는 예외는 `docs/DECISIONS.md` "디자인 정본 적용 기본값" 에 적힌 것만(`--panel-header-h` 48→44 등).
- 다른 패키지는 이 패키지를 **CSS 변수 이름으로만** 씁니다(1라운드 공유 규칙). 다크 모드 없음.
- 완료 조건: `pnpm --filter @classmate/design-tokens test` exit 0 · 이 README 한 단락 갱신 · 비밀정보·Tiro URL 없음.
