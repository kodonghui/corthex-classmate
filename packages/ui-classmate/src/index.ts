// @classmate/ui-classmate — Classmate 전용 컴포넌트 10개의 출입구입니다.
//
// 정본: design/claude-design-export/design-system/components/classmate 의 *.jsx 10개 + .d.ts + .prompt.md.
//       지도는 docs/design-map.md §2·§3·§8, 판정은 docs/DECISIONS.md 의 "디자인 정본 적용 기본값".
// 계약: MarginNote 의 preparing 상태는 children 으로 `<SourceStatus compact />` 를 받습니다.
//       CSS 는 런타임 주입 대신 파일로 나갑니다 → import "@classmate/ui-classmate/styles.css";
//       기본 요소 8개는 src/internal 안에만 있고 여기서 내보내지 않습니다(2라운드에 ui-base 로 바뀝니다).

export { AnswerCard, type AnswerCardProps, type AnswerSection, type FollowUp } from "./components/AnswerCard";
export { CodeCompare, type CodeCompareProps, type CompareRow } from "./components/CodeCompare";
export { GuessList, type GuessListProps, type GuessOption } from "./components/GuessList";
export { MarginNote, type MarginNoteProps, type NoteChip } from "./components/MarginNote";
export { MomentRow, type MomentRowProps } from "./components/MomentRow";
export { NowLine, type NowLineProps } from "./components/NowLine";
export { SourceFooter, type FooterSource, type FooterWarn, type SourceFooterProps } from "./components/SourceFooter";
export { SourceStatus, type SourceItem, type SourceStatusProps } from "./components/SourceStatus";
export { StuckButton, type StuckButtonProps } from "./components/StuckButton";
export {
  TranscriptFlow,
  type TranscriptFlowProps,
  type TranscriptLine,
  type TranscriptSegment,
} from "./components/TranscriptFlow";

/** 정본 컴포넌트 이름 10개. 화면 쪽에서 목록을 훑을 때 쓰고, 시험이 개수와 이름을 지킵니다. */
export const CLASSMATE_COMPONENTS = [
  "TranscriptFlow",
  "MarginNote",
  "GuessList",
  "NowLine",
  "SourceFooter",
  "CodeCompare",
  "MomentRow",
  "AnswerCard",
  "SourceStatus",
  "StuckButton",
] as const;

export type ClassmateComponentName = (typeof CLASSMATE_COMPONENTS)[number];
