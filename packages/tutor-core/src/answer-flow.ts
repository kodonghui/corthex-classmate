// 답 한 장이 지나는 길 — 붙잡음 → 준비 → 한 줄 결론 → 자세히 → 접힘,
// 그리고 튜터가 멈췄을 때의 곁길 오류 → 대기(queued) → 되살아남(recovered) 입니다.
//
// 여기에는 화면 그리기가 없습니다. 상태기계가 만든 상태를 화면이 바로 쓸 수 있는
// 한 덩어리로 바꿔 주는 순수 함수와, 계약 값에 맞춘 표·문구만 둡니다.

import type { Answer, Id } from "@classmate/contracts";

import type { MachineState, NotePhase } from "./machine";

/**
 * 세션 사건 이름 → 계약 `Answer.status` 값입니다.
 *
 * 계약이 정한 네 값(answered · queued · error · recovered)을 그대로 씁니다.
 * `answer.failed` 만 이름이 달라서(사건은 failed, 답의 상태는 error) 표가 필요합니다.
 */
export const ANSWER_STATUS_BY_EVENT = {
  "answer.completed": "answered",
  "answer.queued": "queued",
  "answer.failed": "error",
  "answer.recovered": "recovered",
} as const satisfies Record<string, Answer["status"]>;

export type AnswerEventName = keyof typeof ANSWER_STATUS_BY_EVENT;

/** 붙잡은 직후 준비 문구입니다(디자인 상태 B). */
export const PREPARING_LINE = "한 줄로 정리하고 있어요";

/** 튜터가 멈췄을 때 메모 자리에 뜨는 대기 문구입니다(디자인 상태 H). */
export const WAITING_NOTE_LINE = "튜터가 돌아오면 여기에 한 줄이 나타나요 · 순간은 저장됐어요";

/** 튜터가 멈췄을 때 화면 맨 아래 한 줄입니다(디자인 상태 H). */
export const WAITING_FOOTER_LINE =
  "튜터 답변이 잠시 멈췄어요. 수업 기록과 질문 지점은 계속 저장하고 있어요.";

/** 접힘까지 남은 시간을 알리는 문구입니다. */
export function foldNotice(leftSeconds: number | null): string {
  return leftSeconds === null ? "기록에 남아요" : `${leftSeconds}초 뒤 접혀요 · 기록에 남아요`;
}

export interface AnswerView {
  /** 메모가 지금 어느 자리에 있는지입니다. */
  readonly phase: NotePhase;
  readonly questionId: Id | null;
  readonly answerId: Id | null;
  /** 계약 Answer.status 값입니다. 아직 답이 없으면 null 입니다. */
  readonly status: Answer["status"] | null;
  /** 튜터가 멈춰 기다리는 중인지입니다. */
  readonly waiting: boolean;
  /** 지금 메모 자리에 보여 줄 안내 문구입니다. 결론이 있으면 null 입니다. */
  readonly line: string | null;
  /** 접힘까지 남은 초입니다. 시계가 돌지 않으면 null 입니다. */
  readonly foldsInSec: number | null;
}

/**
 * 상태를 화면이 쓰는 한 덩어리로 바꿉니다.
 *
 *     const view = answerView(state, now);
 *     view.phase       // "preparing" | "minimal" | "waiting" | "detail" | "folded" | "none"
 *     view.foldsInSec  // 18 → 17 → … → 0
 */
export function answerView(state: MachineState, now: number): AnswerView {
  const waiting = state.note === "waiting";
  const line =
    state.note === "preparing" ? PREPARING_LINE : waiting ? WAITING_NOTE_LINE : null;
  const foldsInSec =
    state.foldDeadline === null ? null : Math.max(0, Math.ceil((state.foldDeadline - now) / 1000));

  return {
    phase: state.note,
    questionId: state.questionId,
    answerId: state.answerId,
    status: state.answerStatus,
    waiting,
    line,
    foldsInSec,
  };
}
