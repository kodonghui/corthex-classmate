# @classmate/tutor-core

튜터의 머리 부분입니다. 상태기계(CAPTURE → ANSWER_MINIMAL → EXIT_RECALL → FEEDBACK → FADE_SUPPORT → DELAYED_CHECK),
질문 시점 봉인 `ContextSnapshot`(최근 전사 N문단 · 최신 프레임 · 에디터 문맥 · 자료 나이), 18초 접힘 타이머,
오류 → 대기 → 복구 전이를 **순수 TS** 로 구현합니다. 지금은 스켈레톤이며 Phase 2 1라운드 단위 (4) 가 채웁니다.

- 정본: `docs/master-prompt.md` §3-4(상태기계·적응형 신호), `docs/design-map.md` §4(PREP=1600 · FOLD=18000 · 칩 클릭 시 리셋 · START 10:32:10), 계약 `packages/contracts`(TutorState · SessionEvent · Question · Answer).
- 규칙: 브라우저 API 없음. 시계·타이머·난수는 인자로 주입받아 시험에서 흉내 냅니다. 계약 타입은 `import type` 만.
- 시험: 전이표(상태 × 사건) 전부 + 봉인이 "질문 이후 자료" 를 섞지 않는지 + 접힘 타이머 리셋/만료.
- 완료 조건: `pnpm --filter @classmate/tutor-core test` exit 0 · README 한 단락 · 비밀정보·Tiro URL 없음.
