/* eslint-disable */
/**
 * 생성물 · 직접 고치지 말 것
 *
 * 정본은 packages/contracts/schemas/*.schema.json 입니다.
 * 타입을 바꾸려면 스키마를 고치고 `pnpm --filter @classmate/contracts generate` 를 다시 실행하세요.
 */

export type { Id, IsoDateTime, PeriodId, TutorState, Common, SourceAges } from "./common";
export type { EvidenceLevel } from "./evidence-level";
export type { TranscriptSegment } from "./transcript-segment";
export type { ScreenFrame } from "./screen-frame";
export type { EditorContext, VisibleRange } from "./editor-context";
export type { Question, QuestionAnchor, QuestionSnapshot } from "./question";
export type { Answer, AnswerDetails } from "./answer";
export type { SessionEvent } from "./session-event";
