// @classmate/tutor-core — 튜터의 머리 부분입니다.
//
// 맡는 것: 상태기계 CAPTURE → ANSWER_MINIMAL → EXIT_RECALL → FEEDBACK → FADE_SUPPORT → DELAYED_CHECK,
//          질문 시점 봉인 ContextSnapshot(최근 전사 N문단 · 최신 프레임 · 에디터 문맥 · 각 자료의 나이),
//          18초 접힘 타이머, 오류 → 대기(queued) → 복구(recovered) 전이.
// 규칙: 순수 TS. 브라우저 API(창·문서·확장 객체·예약 함수 직접 호출)를 쓰지 않고 시계·예약은 주입받는다.
//       계약 타입은 `import type` 으로만 들여온다. 전이표의 모든 칸을 단위 시험으로 덮는다.
//       상수·동작의 정본은 docs/master-prompt.md §3-4 와 docs/design-map.md §4(PREP=1600 · FOLD=18000 · 칩 클릭 시 접힘 타이머 리셋).

export {
  createEnv,
  FOLD_MS,
  hasRule,
  INPUT_KINDS,
  initialState,
  inputKindOf,
  inputTimeOf,
  NOTE_PHASES,
  PREP_MS,
  PROVIDER_PHASES,
  runAll,
  SESSION_EVENT_TYPE_NAMES,
  transition,
  TRANSITION_TABLE,
  TUTOR_STATE_ORDER,
  USER_INPUT_KINDS,
} from "./machine";
export type {
  Effect,
  Env,
  InputKind,
  MachineInput,
  MachineState,
  NotePhase,
  PendingAnswer,
  ProviderPhase,
  SessionEventDraft,
  SessionEventType,
  TransitionResult,
  TransitionRule,
  TransitionTable,
  UserInputKind,
} from "./machine";

export { DEFAULT_RECENT_PARAGRAPHS, sealSnapshot } from "./snapshot";
export type { SealSnapshotInput } from "./snapshot";

export { FoldTimer } from "./fold-timer";
export type { Cancel, Clock, FoldTimerDeps, Scheduler } from "./fold-timer";

export {
  ANSWER_STATUS_BY_EVENT,
  answerView,
  foldNotice,
  PREPARING_LINE,
  WAITING_FOOTER_LINE,
  WAITING_NOTE_LINE,
} from "./answer-flow";
export type { AnswerEventName, AnswerView } from "./answer-flow";

export { ageSeconds, formatIso, KST_OFFSET_MINUTES, parseIso } from "./time";
