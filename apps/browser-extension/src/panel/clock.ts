// 수업 시계 문구입니다. ISO 문자열이 든 시간대(+09:00)를 그대로 써서, 브라우저의 시간대와
// 상관없이 fixture 에 적힌 `10:32:18` 이 화면에도 `10:32:18` 로 나오게 합니다.

import type { IsoDateTime } from "@classmate/contracts";
import { formatIso } from "@classmate/tutor-core";

const CLOCK_IN_ISO = /T(\d{2}:\d{2}:\d{2})/;

/** `2026-09-02T10:32:18+09:00` → `10:32:18`. */
export function clockOfIso(iso: IsoDateTime): string {
  const match = CLOCK_IN_ISO.exec(iso);
  if (match === null || match[1] === undefined) {
    throw new RangeError(`시각 문자열이 ISO 8601 모양이 아니에요: ${iso}`);
  }
  return match[1];
}

/** 밀리초 시각 → `10:32:18`. 시간대는 tutor-core 의 기본값(KST)입니다. */
export function clockOfMs(ms: number): string {
  return clockOfIso(formatIso(ms));
}

/**
 * 같은 날짜의 다른 시각을 만듭니다. `atClock("2026-09-02T10:31:35+09:00", "10:32:16")`
 * → `2026-09-02T10:32:16+09:00`. 재생기의 체크포인트가 날짜를 fixture 에서 빌려 쓸 때 씁니다.
 */
export function atClock(sameDayAs: IsoDateTime, clock: string): IsoDateTime {
  if (!/^\d{2}:\d{2}:\d{2}$/.test(clock)) {
    throw new RangeError(`시계 문구는 HH:MM:SS 여야 해요: ${clock}`);
  }
  if (!CLOCK_IN_ISO.test(sameDayAs)) {
    throw new RangeError(`기준 시각이 ISO 8601 모양이 아니에요: ${sameDayAs}`);
  }
  return sameDayAs.replace(CLOCK_IN_ISO, `T${clock}`);
}
