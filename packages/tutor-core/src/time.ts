// 시각 다루기 — 순수 함수만 둡니다.
//
// 지금 몇 시인지는 여기서 읽지 않습니다. 상태기계는 사건에 적힌 `at` 이나 밖에서 넣어 준
// `now`(epoch 밀리초)만 봅니다. 그래야 시험에서 가짜 시계로 시간을 밀 수 있습니다.

import type { IsoDateTime } from "@classmate/contracts";

/** 골든 시나리오 fixture 가 쓰는 시간대(분 단위)입니다. +09:00 이라 540 입니다. */
export const KST_OFFSET_MINUTES = 540;

/** 한 시간대 표기를 만듭니다. 보기 540 → "+09:00" */
function offsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const total = Math.abs(Math.trunc(offsetMinutes));
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

/**
 * ISO-8601 시각 문자열을 epoch 밀리초로 바꿉니다.
 *
 *     parseIso("2026-09-02T10:32:18+09:00")  // → 밀리초 수
 *
 * 읽을 수 없는 문자열이면 예외를 던집니다. 조용히 0 을 돌려주면 나이 계산이 엉뚱해집니다.
 */
export function parseIso(value: IsoDateTime): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`ISO-8601 시각이 아닙니다: ${value}`);
  }
  return ms;
}

/**
 * epoch 밀리초를 초 단위 ISO-8601 문자열로 바꿉니다.
 *
 *     formatIso(ms, 540)  // → "2026-09-02T10:32:18+09:00"
 *
 * 밀리초 자리는 버립니다. 계약의 IsoDateTime 은 초까지만 쓰기로 했고 fixture 도 그렇습니다.
 */
export function formatIso(ms: number, offsetMinutes: number = KST_OFFSET_MINUTES): IsoDateTime {
  const shifted = new Date(Math.trunc(ms) + offsetMinutes * 60_000).toISOString();
  return `${shifted.slice(0, 19)}${offsetLabel(offsetMinutes)}`;
}

/**
 * 자료가 몇 초 전 것인지 셉니다. 초 미만은 버립니다(내림).
 *
 * 질문보다 뒤에 도착한 자료는 봉인에서 빼기 때문에 여기까지 오지 않습니다.
 * 그래도 음수가 들어오면 0 으로 봅니다.
 */
export function ageSeconds(askedAtMs: number, sourceMs: number): number {
  return Math.max(0, Math.floor((askedAtMs - sourceMs) / 1000));
}
