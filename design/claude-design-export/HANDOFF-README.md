# Claude Design 핸드오프 번들 — Corthex Classmate (2026-09-02)

이 폴더는 claude.ai/design 의 두 프로젝트를 **원본 그대로** 내려받은 것입니다(내용 수정 없음).
Claude Code 는 웹 링크를 열 수 없으므로, 이 로컬 사본을 읽습니다.

| 폴더 | 원본 | 프로젝트 ID |
|---|---|---|
| `design-system/` | Corthex Classmate Design System (디자인 시스템, 173개 중 158개 파일) | `a7a4530d-ff4f-40af-90a3-324a5a784ac5` |
| `project-classmate-side-panel/` | Classmate Side Panel Review (디자인 프로젝트, 15개 파일) | `0a8a5e6c-8de1-4233-a18a-ef778e0125bd` |

제외: 썸네일(`.thumbnail`), `uploads/*.png` 1장. 그 외 텍스트 파일은 전부 포함.

## 먼저 읽을 순서 (Claude Code)
1. `design-system/readme.md` — 상호작용 모델 **"단어 잡기"**, CONTENT FUNDAMENTALS, VISUAL FOUNDATIONS, 컴포넌트 목록
2. `design-system/SKILL.md` — 에이전트용 진입점
3. `design-system/styles.css` → `tokens/*.css` — 디자인 토큰 정본
4. `design-system/components/classmate/*.jsx` + `*.prompt.md` — 제품 컴포넌트(React JSX, `core/cm.js` 의 `css()`/`cx()` 사용)
5. `design-system/ui_kits/sidepanel/` — 사이드패널 4화면 참고 구현 + `data.jsx`(전사·답변 샘플 데이터)
6. `project-classmate-side-panel/Classmate Side Panel.dc.html` — 위 시스템으로 만든 인터랙티브 프로토타입(상태 A–H)
7. `design-system/prompts/claude-design-prompt.md` — 그 프로토타입을 만들 때 준 브리프(요구 상태·문구·규칙)
8. `design-system/explorations/` — 과거 발산 4방향(01 단어 잡기(채택) · 02 되감기 · 03 내 코드 옆에 · 04 조용한 불빛). 참고만.

## 다시 받는 방법
- Cowork(Claude 데스크톱) 세션에서 `DesignSync` 도구 `list_files`/`get_file` 로 내려받음(이 번들이 그 방법).
- Claude Design 웹에서 Export → **Download zip** 또는 standalone HTML.
- Claude Code 에서 MCP 연결: `claude mcp add --scope user --transport http claude-design https://api.anthropic.com/v1/design/mcp` → `/design-login` → "Import this Claude Design project using the Claude Design connector: https://claude.ai/design/p/<ID>?file=<FILE>.dc.html". Windows 데스크톱 앱에서의 `/design-login` 동작은 미검증(이슈 #75024).
- 코드→디자인 방향(저장소의 React 디자인 시스템을 Claude Design 에 업로드)은 `/design-sync`.
