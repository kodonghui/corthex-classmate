// 기록 화면(디자인 상태 G)이 그릴 값 덩어리.
//
//   ReplayState.moments             ─┐
//   도착한 answer.* 사건            ─┼─▶ historyView() ──▶ 교시 묶음 · MomentRow 줄 · 바닥 안내 · 바닥줄
//   ReplayState.machine.connectors  ─┘
//
// 규칙:
//  - 자료는 `state.moments` 와 **도착한** 답(`lesson-view.answerOfQuestion`)에서만 만듭니다.
//    `bundle.events` 는 라이브 모드에서 비어 있으므로 쓰지 않습니다.
//  - 정본(ui_kits/sidepanel/HistoryScreen.jsx)의 지난 교시 3줄은 kit 의 시연 자료라 옮기지 않습니다.
//    지어낸 줄을 기록에 섞으면 "붙잡은 순간" 이라는 말이 거짓이 됩니다.

import type { Id, SessionProfileV2 } from "@classmate/contracts";
import type { FooterSource, MomentRowProps } from "@classmate/ui-classmate";

import type { GoldenBundle } from "./golden-bundle";
import { answerIdByQuestion } from "./lesson-view";
import type { Moment, ReplayState } from "./replay-store";
import { sessionProfileCopy } from "../session-profile";

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

/**
 * 기록 화면의 바닥줄은 **나이 대신 형편**을 보여 줍니다(정본 HistoryScreen.jsx).
 *
 * 예전에는 세 칸이 모두 `"기록 중"` 으로 못 박혀 있었습니다. 실측(2026-09-03 2교시)에서
 * 수업 화면도 IntelliJ도 붙지 않았는데 바닥줄만 「화면 기록 중 · IntelliJ 기록 중」이라
 * 적혀 있었습니다. 화면이 사실이 아닌 말을 하면 사람은 다음부터 그 줄을 안 읽습니다.
 *
 * | 커넥터 형편 | 글자 | 점 |
 * |---|---|---|
 * | `connected` | `기록 중` | 초록(live) |
 * | `paused` | `잠시 멈춤` | 호박 |
 * | `off` | `—` | 빨강 |
 * | 아직 아무 보고도 없음 | `—` | 회색(idle) |
 *
 * 마지막 줄을 `off` 와 나누는 이유: 패널을 연 첫 순간에는 어느 커넥터도 아직 자기 형편을
 * 알리지 않았습니다. 그것을 빨간 점으로 그리면 시작도 안 한 것을 고장이라고 말하게 됩니다
 * (`lesson-view.ts` 의 `tiroPaused` 도 같은 이유로 "없음" 을 멈춤으로 세지 않습니다).
 */
const FOOTER_KEYS = [
  { key: "tiro", connector: "tiro-share" },
  { key: "meet", connector: "meet-tab" },
  { key: "intellij", connector: "intellij-mcp" },
] as const;

/** 커넥터 형편 하나를 바닥줄 한 칸으로 옮깁니다. */
function footerSourceOf(key: string, status: string | undefined): FooterSource {
  switch (status) {
    case "connected":
      return { key, state: "live", ago: "기록 중" };
    case "paused":
      return { key, state: "paused", ago: "잠시 멈춤" };
    case "off":
      return { key, state: "off", ago: "—" };
    default:
      // 아직 아무 보고도 안 왔거나(undefined) 모르는 낱말입니다. 지어내지 않고 비워 둡니다.
      return { key, state: "idle", ago: "—" };
  }
}

/** 바닥줄 세 칸입니다. 자료는 상태기계가 받아 적은 `connector.status` 뿐입니다. */
function recordingSources(state: ReplayState, profile: SessionProfileV2): FooterSource[] {
  const sources = FOOTER_KEYS.map((entry) =>
    footerSourceOf(entry.key, state.machine.connectors[entry.connector]),
  );
  return sessionProfileCopy(profile).includesEditor ? sources : sources.slice(0, 2);
}

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
  const copy = sessionProfileCopy(bundle.profile);
  const arrived = answerIdByQuestion(state);
  const rows = [...state.moments].reverse().map((moment) => rowOf(bundle, arrived, moment));
  return {
    title: "기록",
    subtitle: `오늘 ${rows.length}개`,
    groups: [{ period: bundle.studyBundle ? bundle.subject : copy.slot(bundle.periodIndex), rows }],
    emptyText: HISTORY_EMPTY_TEXT,
    footNote: copy.historyFootNote,
    sources: recordingSources(state, bundle.profile),
    count: rows.length,
  };
}
