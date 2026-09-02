/* eslint-disable */
/**
 * 생성물 · 직접 고치지 말 것
 *
 * 정본은 packages/contracts/schemas/*.schema.json 입니다.
 * 타입을 바꾸려면 스키마를 고치고 `pnpm --filter @classmate/contracts generate` 를 다시 실행하세요.
 */

/**
 * 한 교시 세션에서 일어난 일을 시간 순서로 남기는 기록 한 줄입니다.
 */
export type SessionEvent = {
  id: Id;
  periodId: PeriodId;
  at: IsoDateTime;
  /**
   * 어떤 일이 일어났는지입니다. 여기 없는 이름은 받지 않습니다.
   */
  type:
    | "period.started"
    | "period.ended"
    | "transcript.segment"
    | "screen.frame"
    | "editor.context"
    | "question.asked"
    | "answer.completed"
    | "answer.queued"
    | "answer.failed"
    | "answer.recovered"
    | "state.changed"
    | "panel.opened"
    | "panel.closed"
    | "connector.status";
  /**
   * type 마다 다른 딸림 값입니다. state.changed 일 때는 from 과 to 만 담습니다.
   */
  payload: {
    [k: string]: unknown;
  };
};
/**
 * 한 항목을 가리키는 문자열 식별자입니다.
 */
export type Id = string;
/**
 * 교시 세션 식별자입니다. 보기 2026-09-02-p3
 */
export type PeriodId = string;
/**
 * ISO-8601 시각 문자열입니다. 보기 2026-09-02T10:32:18+09:00
 */
export type IsoDateTime = string;
