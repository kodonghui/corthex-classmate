/**
 * 확장이 찍는 시각을 **로컬 시간대 표기**로 적습니다.
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
 * 이라 오프셋 표기(`+09:00`)와 소수점 초를 모두 허용합니다. 도우미가 만드는 `at` 도 `+09:00`
 * 이므로, 이렇게 적으면 확장이 만든 시각과 도우미가 만든 시각이 같은 표기로 줄을 섭니다.
 *
 * 시간대는 인자로 받습니다. 기본값은 이 컴퓨터의 오프셋(`-date.getTimezoneOffset()`)이고,
 * 시험은 값을 직접 넣어 어느 컴퓨터에서 돌려도 같은 답이 나오게 합니다.
 */

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
 * `Date` 를 로컬 오프셋이 적힌 ISO-8601 문자열로 바꿉니다.
 *
 *     toLocalIso(new Date(...), 540)  // → "2026-09-03T11:20:46.959+09:00"
 *
 * 밀리초 자리는 남깁니다. 문단이 1초 안에 여러 번 자라는 것이 실측에서 흔해, 초까지만
 * 적으면 서로 다른 도착을 구분할 수 없습니다.
 *
 * @param date        시각. 읽을 수 없는 `Date` 면 `RangeError` 를 던집니다.
 * @param offsetMinutes 시간대(분). 기본값은 그 시각에서 이 컴퓨터가 쓰는 오프셋입니다.
 */
export function toLocalIso(
  date: Date,
  offsetMinutes: number = -date.getTimezoneOffset(),
): string {
  const ms = date.getTime();
  if (!Number.isFinite(ms)) {
    throw new RangeError('읽을 수 있는 시각이 아니에요');
  }
  const shifted = new Date(ms + Math.trunc(offsetMinutes) * 60_000).toISOString();
  // "2026-09-03T11:20:46.959Z" 에서 Z 를 떼고(23자) 오프셋 표기를 붙입니다.
  return `${shifted.slice(0, 23)}${isoOffsetLabel(offsetMinutes)}`;
}
