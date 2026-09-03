/**
 * 확장이 찍는 시각을 **수업 시간대(KST) 표기**로 적습니다.
 *
 * 왜 `Date.prototype.toISOString()` 을 그대로 쓰지 않나: 그 함수는 언제나 UTC(`Z`) 로 적습니다.
 * 실측(2026-09-03 2교시)에서 11:20:46 에 도착한 문단이 패널 「자세히」 화면에 `02:20:46` 으로
 * 보였습니다. 패널의 시계 문구(`src/panel/clock.ts`)가 문자열에서 `HH:MM:SS` 만 잘라 쓰는데,
 * 그 값이 UTC 라 9시간이 어긋난 것입니다.
 *
 * ```text
 *   toISOString()  "2026-09-03T02:20:46.959Z"       → 화면 02:20:46   ✗
 *   toLocalIso()   "2026-09-03T11:20:46.959+09:00"  → 화면 11:20:46   ✓
 * ```
 *
 * 계약(`packages/contracts/schemas/common.schema.json` 의 `IsoDateTime`)은 `format: date-time`
 * 이라 오프셋 표기(`+09:00`)와 소수점 초를 모두 허용합니다.
 *
 * 기본 시간대는 **이 컴퓨터가 아니라 KST** 입니다. 확장 안에서 시각을 적는 자리가 셋이라
 * (여기 · 라우터의 `toKstIso`(`background/ids.ts`) · 패널·리포트의 `formatIso`
 * (`packages/tutor-core/src/time.ts`)) 여기만 컴퓨터를 따르면 KST 밖 PC 에서 한 사건 안에
 * `at: …+09:00` 과 `arrivedAt: …-05:00` 이 함께 실립니다. 축을 하나로 두려고 같은 상수
 * (`KST_OFFSET_MINUTES`)를 씁니다. 다른 시간대가 필요하면 인자로 명시해 넘깁니다.
 *
 * `formatIso` 와 다른 점은 소수점 초 한 자리뿐입니다 — 여기는 밀리초를 **남깁니다**(아래 참조).
 */

import { KST_OFFSET_MINUTES } from '@classmate/tutor-core';

/** 오프셋(분)을 ISO 표기로 적습니다. 보기 `540` → `"+09:00"`, `0` → `"+00:00"`. */
export function isoOffsetLabel(offsetMinutes: number): string {
  const whole = Math.trunc(offsetMinutes);
  const sign = whole < 0 ? '-' : '+';
  const total = Math.abs(whole);
  const hours = String(Math.floor(total / 60)).padStart(2, '0');
  const minutes = String(total % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

/**
 * `Date` 를 오프셋이 적힌 ISO-8601 문자열로 바꿉니다.
 *
 *     toLocalIso(new Date(...))       // → "2026-09-03T11:20:46.959+09:00"  (기본 KST)
 *     toLocalIso(new Date(...), 540)  // → "2026-09-03T11:20:46.959+09:00"
 *
 * 밀리초 자리는 남깁니다. 문단이 1초 안에 여러 번 자라는 것이 실측에서 흔해, 초까지만
 * 적으면 서로 다른 도착을 구분할 수 없습니다. `formatIso` 는 반대로 초까지만 적습니다 —
 * 그쪽은 fixture 와 골든 장면이 글자까지 같아야 해서입니다. 계약은 둘 다 받습니다.
 *
 * @param date        시각. 읽을 수 없는 `Date` 면 `RangeError` 를 던집니다.
 * @param offsetMinutes 시간대(분). 기본값은 수업 시간대 KST(540)입니다. 이 컴퓨터의
 *                      오프셋을 읽지 않습니다 — 확장이 적는 시각의 축을 하나로 두기 위해서입니다.
 */
export function toLocalIso(
  date: Date,
  offsetMinutes: number = KST_OFFSET_MINUTES,
): string {
  const ms = date.getTime();
  if (!Number.isFinite(ms)) {
    throw new RangeError('읽을 수 있는 시각이 아니에요');
  }
  const shifted = new Date(ms + Math.trunc(offsetMinutes) * 60_000).toISOString();
  // "2026-09-03T11:20:46.959Z" 에서 Z 를 떼고(23자) 오프셋 표기를 붙입니다.
  return `${shifted.slice(0, 23)}${isoOffsetLabel(offsetMinutes)}`;
}
