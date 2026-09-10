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
export type { Answer, AnswerDetails, AnswerDiagram } from "./answer";
export type { SessionEvent } from "./session-event";
export type { SessionProfileV2 } from "./session-profile-v2";
export type { VerificationStatusV2, MaterialRef, VerificationMetadataV2 } from "./material-ref";
export type { AssetRef } from "./asset-ref";
export type { TutorResponseV2, TutorResponseSectionV2 } from "./tutor-response-v2";
export type { ActivitySlot, ActivityKind, ActivityCard, ActivityAttempt } from "./activity-card";
export type { ActivitySetV2 } from "./activity-set-v2";
export type { SessionSummaryV2 } from "./session-summary-v2";
export type { SessionMomentTypeV2, SessionBundleV2, SessionMomentV2, TranscriptRevisionV2, TranscriptWordV2 } from "./session-bundle-v2";
export type { CoreParagraph } from "./core-paragraph";
export type { CoreQaEntry } from "./core-qa-entry";
export type { CoreFrame } from "./core-frame";
export type { CoreMoment } from "./core-moment";
export type { TiroState, CoreTools, MomentLatestInput, MomentLatestOutput, MomentCaptureInput, MomentCaptureOutput, MomentGetInput, MomentGetOutput, TranscriptRecentInput, TranscriptRecentOutput, SessionLogInput, SessionLogOutput, SessionSummaryInput, SessionSummaryOutput, Counts, CoreStatusInput, CoreStatusOutput } from "./core-tools";
