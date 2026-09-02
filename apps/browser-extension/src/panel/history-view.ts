// 기록 화면(디자인 상태 G)이 그릴 값 덩어리.
//
//   ReplayState.moments ──┐
//                         ├─▶ historyView() ──▶ 교시 묶음 · MomentRow 줄 · 바닥 안내 · "기록 중" 바닥줄
//   도착한 answer.* 사건 ──┘
//
// 규칙:
//  - 자료는 `state.moments` 와 **도착한** 답(`lesson-view.answerOfQuestion`)에서만 만듭니다.
//    `bundle.events` 는 라이브 모드에서 비어 있으므로 쓰지 않습니다.
//  - 정본(ui_kits/sidepanel/HistoryScreen.jsx)의 지난 교시 3줄은 kit 의 시연 자료라 옮기지 않습니다.
//    지어낸 줄을 기록에 섞으면 "붙잡은 순간" 이라는 말이 거짓이 됩니다.

import type { Id } from "@classmate/contracts";
import type { FooterSource, MomentRowProps } from "@classmate/ui-classmate";

import type { GoldenBundle } from "./golden-bundle";
import { answerIdByQuestion } from "./lesson-view";
import type { Moment, ReplayState } from "./replay-store";

/** MomentRow 가 받는 상태 중 이 화면이 쓰는 둘입니다. */
export type HistoryRowState = Extract<NonNullable<MomentRowProps["state"]>, "ready" | "preparing">;

export interface HistoryRow {
  readonly questionId: Id;
  /** "10:32:18" */
  readonly time: string;
  readonly term: string;
  /** 한 줄 결론입니다. 아직 답이 오지 않았으면 null 입니다. */
  readonly title: string | null;
  readonly state: HistoryRowState;
}

export interface HistoryGroup {
  /** "3교시" */
  readonly period: string;
  readonly rows: readonly HistoryRow[];
}

export interface HistoryView {
  readonly title: string;
  /** "오늘 3개" */
  readonly subtitle: string;
  readonly groups: readonly HistoryGroup[];
  readonly emptyText: string;
  readonly footNote: string;
  readonly sources: readonly FooterSource[];
  readonly count: number;
}

/** 기록 바닥 안내입니다(정본 HistoryScreen.jsx · dc.html). */
export const HISTORY_FOOT_NOTE = "붙잡은 순간은 수업이 끝나도 남아요. 지우기는 설정에서.";

/** 아직 아무것도 붙잡지 않았을 때 교시 묶음 안에 뜨는 한 줄입니다(정본 dc.html). */
export const HISTORY_EMPTY_TEXT = "아직 붙잡은 순간이 없어요";

/** 기록 화면의 바닥줄은 나이 대신 "기록 중" 만 보여 줍니다(정본). */
const RECORDING_SOURCES: readonly FooterSource[] = [
  { key: "tiro", ago: "기록 중" },
  { key: "meet", ago: "기록 중" },
  { key: "intellij", ago: "기록 중" },
];

/**
 * 줄 하나.
 *
 * 답은 **도착한 `answer.completed`·`answer.recovered`** 만 봅니다. 상태기계가 지금 들고 있는
 * `answerId` 를 쓰면 대기(queued) 자리표(결론이 "한 줄로 정리하고 있어요")까지 답인 척하게 됩니다.
 */
function rowOf(bundle: GoldenBundle, arrived: Readonly<Record<string, Id>>, moment: Moment): HistoryRow {
  const answerId = arrived[moment.questionId];
  const answer = answerId === undefined ? null : (bundle.answers[answerId] ?? null);
  return {
    questionId: moment.questionId,
    time: moment.time,
    term: moment.term,
    title: answer === null ? null : answer.conclusion,
    state: answer === null ? "preparing" : "ready",
  };
}

/** 기록 화면(G)의 값 전부입니다. 새로 붙잡은 순간이 맨 위에 옵니다. */
export function historyView(bundle: GoldenBundle, state: ReplayState): HistoryView {
  const arrived = answerIdByQuestion(state);
  const rows = [...state.moments].reverse().map((moment) => rowOf(bundle, arrived, moment));
  return {
    title: "기록",
    subtitle: `오늘 ${rows.length}개`,
    groups: [{ period: `${bundle.periodIndex}교시`, rows }],
    emptyText: HISTORY_EMPTY_TEXT,
    footNote: HISTORY_FOOT_NOTE,
    sources: RECORDING_SOURCES,
    count: rows.length,
  };
}
