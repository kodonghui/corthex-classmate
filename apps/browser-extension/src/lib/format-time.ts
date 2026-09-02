/**
 * 시각·경과 시간 문구를 한 곳에서 만듭니다.
 *
 * 문구 규칙 (master-prompt §3-7):
 *  - 시각은 `10:32:18` 형식(24시간 · 두 자리 고정 · 콜론 구분).
 *  - 자료가 아직 없으면 숫자 대신 `—` 한 글자만 씁니다.
 *  - 해요체를 쓰고 느낌표·이모지를 넣지 않습니다.
 */

/** 자료가 없을 때 쓰는 한 글자. em dash(U+2014) 입니다. */
export const NO_VALUE = '—';

/** 자료의 나이. 초 단위이고, 아직 붙은 자료가 없으면 null 입니다. */
export type AgeInSeconds = number | null | undefined;

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Date 를 `10:32:18` 형식으로 씁니다. 기준은 사용자의 로컬 시간대입니다.
 *
 * @throws RangeError 올바르지 않은 Date 를 받으면 던집니다. 화면에 `Invalid Date` 가
 *   새어 나가는 것보다 부르는 쪽에서 막는 편이 낫습니다.
 */
export function formatClock(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError('시각이 올바르지 않아요');
  }
  return `${padTwo(value.getHours())}:${padTwo(value.getMinutes())}:${padTwo(value.getSeconds())}`;
}

/**
 * 자료의 나이를 `4초 전` 같은 문구로 씁니다.
 *
 * - null · undefined · 숫자가 아닌 값 · 음수 → `—`
 * - 60초 미만 → `N초 전`
 * - 60분 미만 → `N분 전`
 * - 그 이상 → `N시간 전`
 *
 * 소수점은 버립니다. 3.9초는 `3초 전` 이 됩니다. 실제보다 오래됐다고 말하는 쪽이
 * 실제보다 새것이라고 말하는 쪽보다 안전하기 때문입니다.
 */
export function formatAgo(seconds: AgeInSeconds): string {
  if (seconds === null || seconds === undefined) {
    return NO_VALUE;
  }
  if (!Number.isFinite(seconds) || seconds < 0) {
    return NO_VALUE;
  }

  const whole = Math.floor(seconds);
  if (whole < 60) {
    return `${whole}초 전`;
  }

  const minutes = Math.floor(whole / 60);
  if (minutes < 60) {
    return `${minutes}분 전`;
  }

  return `${Math.floor(minutes / 60)}시간 전`;
}
