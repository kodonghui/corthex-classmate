# @classmate/ui-classmate

Classmate 전용 컴포넌트 10개(`TranscriptFlow`·`MarginNote`·`GuessList`·`NowLine`·`SourceFooter`·`CodeCompare`·
`MomentRow`·`AnswerCard`·`SourceStatus`·`StuckButton`)를 TS React 로 포팅하는 패키지입니다.
지금은 스켈레톤이며 Phase 2 1라운드 단위 (3) 이 채웁니다.

- 정본: `design/claude-design-export/design-system/components/classmate/*.jsx` + `.d.ts` + `*.prompt.md`. 지도·상태 A~H·문구·함정은 `docs/design-map.md`.
- 계약 유지: `MarginNote` preparing 상태는 children 으로 `SourceStatus compact` 를 받습니다. `.d.ts` 손질은 `docs/design-map.md` §2 를 따릅니다.
- 문구 결정(`docs/DECISIONS.md` "디자인 정본 적용 기본값"): 오타 `멈췼어요`→`멈췄어요`, `new` 결론은 해요체, Alt+S 는 `e.code === "KeyS"`, `SourceFooter` count 는 term 이 있는 순간만.
- 공유 규칙(1라운드): `@classmate/ui-base` 를 import 하지 않습니다. 계약은 `import type` 만, design-tokens 는 CSS 변수 이름만.
- 완료 조건: `pnpm --filter @classmate/ui-classmate test` exit 0 · README 한 단락 · 비밀정보·Tiro URL 없음.
- 함정: happy-dom 환경은 전역 `URL` 을 자기 것으로 바꿔 두므로 `fileURLToPath(new URL("..", import.meta.url))` 이 "The URL must be of scheme file" 로 실패합니다. `dirname(fileURLToPath(import.meta.url))` 을 쓰세요.
