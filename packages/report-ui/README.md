# @classmate/report-ui

교시 세션 번들(JSON)을 읽어 **교시별 상세 HTML** 과 **하루 허브 HTML** 을 정적으로 만드는 생성기입니다.
지금은 스켈레톤이며 Phase 2 1라운드 단위 (10) 이 채웁니다.

- 입력: `fixtures/README.md` "교시 세션 번들" — `fixtures/synthetic-class/golden-ioc/` 폴더 하나가 교시 1개입니다.
- 출력: `out/<날짜>/period-<n>.html` + `out/<날짜>/hub.html` (`out/` 은 gitignore). 허브는 8교시 칸을 그리고 기록 없는 칸은 "기록 없음".
- 규칙: React 템플릿(`react-dom/server`)만. 모델 문자열은 텍스트로만 넣고 `dangerouslySetInnerHTML` 을 쓰지 않습니다(§4-7). design-tokens 는 이번 라운드에는 CSS 변수 이름만(패키지 import 는 2라운드).
- 시험: fixture 번들 1개로 out/ 생성 + HTML 유효성(닫힌 태그·`<script>` 0개·문자셋) + 이스케이프.
- 완료 조건: `pnpm --filter @classmate/report-ui test` exit 0 · README 한 단락 · 비밀정보·Tiro URL 없음.
