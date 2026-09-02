// @classmate/tutor-core — 스켈레톤입니다. Phase 2 1라운드 단위 (4) 가 채웁니다.
//
// 맡는 것: 상태기계 CAPTURE → ANSWER_MINIMAL → EXIT_RECALL → FEEDBACK → FADE_SUPPORT → DELAYED_CHECK,
//          질문 시점 봉인 ContextSnapshot(최근 전사 N문단 · 최신 프레임 · 에디터 문맥 · 각 자료의 나이),
//          18초 접힘 타이머, 오류 → 대기(queued) → 복구(recovered) 전이.
// 규칙: 순수 TS. 브라우저 API(window·document·chrome·setTimeout 직접 호출)를 쓰지 않고 시계·타이머는 주입받는다.
//       계약 타입은 `import type` 으로만 들여온다. 전이표의 모든 칸을 단위 시험으로 덮는다.
//       상수·동작의 정본은 docs/master-prompt.md §3-4 와 docs/design-map.md §4(PREP=1600 · FOLD=18000 · 칩 클릭 시 접힘 타이머 리셋).

import type { TutorState } from "@classmate/contracts";

/** 상태 순서. contracts 의 TUTOR_STATES 와 같아야 한다(시험이 맞대어 본다). */
export const TUTOR_STATE_ORDER: readonly TutorState[] = [
  "CAPTURE",
  "ANSWER_MINIMAL",
  "EXIT_RECALL",
  "FEEDBACK",
  "FADE_SUPPORT",
  "DELAYED_CHECK",
];

/** 상세가 저절로 접히는 시간(ms). 칩(질문 요약) 클릭 시 리셋한다. */
export const FOLD_MS = 18_000;

/** "준비 중" 표시를 보여 주는 최소 시간(ms). 답이 더 빨리 와도 이만큼은 보인다. */
export const PREP_MS = 1_600;
