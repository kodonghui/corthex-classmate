// 수업 시계 문구입니다. ISO 문자열을 **보는 사람의 시각**으로 옮겨 `HH:MM:SS` 만 냅니다.
//
// 예전에는 문자열에서 `T` 뒤 여덟 글자를 그냥 잘라 썼습니다. fixture 는 전부 `+09:00` 이라
// 그래도 맞았지만, 라이브에서 확장이 찍은 `…T02:20:46.959Z`(UTC) 가 오자 화면이 `02:20:46`
// 이 됐습니다(실측 2026-09-03 2교시). 그래서 문자열에 적힌 오프셋과 보는 사람의 오프셋이
// 다르면 옮겨서 냅니다.
//
//   "2026-09-02T10:32:18+09:00"  · 보는 사람 +09:00  → "10:32:18"  (그대로)
//   "2026-09-03T02:20:46.959Z"   · 보는 사람 +09:00  → "11:20:46"  (옮김)
//
// 원천 쪽도 함께 고쳤습니다 — 확장이 찍는 시각은 이제 `src/tiro/iso-time.ts` 의 `toLocalIso`
// 가 오프셋 표기로 적습니다. 이 파일은 옛 기록과 다른 도구가 만든 `Z` 표기를 받는 그물입니다.

import type { IsoDateTime } from "@classmate/contracts";
import { KST_OFFSET_MINUTES, formatIso } from "@classmate/tutor-core";

const CLOCK_IN_ISO = /T(\d{2}:\d{2}:\d{2})/;

/** 문자열 끝에 적힌 시간대입니다. `Z` · `+09:00` · `+0900` 을 봅니다. */
const OFFSET_IN_ISO = /(?:(Z)|([+-])(\d{2}):?(\d{2}))$/;

/** 이 컴퓨터가 지금 쓰는 오프셋(분)입니다. KST 면 540 입니다. */
function localOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

/**
 * 문자열에 **적혀 있는** 시간대를 분으로 읽습니다. 아무것도 안 적혀 있으면 null 입니다.
 *
 * null 은 "이 시각은 이미 보는 사람의 벽시계"라는 뜻으로 씁니다. 자바스크립트의 `Date.parse`
 * 도 오프셋 없는 date-time 을 로컬로 읽으므로 뜻이 같습니다.
 */
function writtenOffsetMinutes(iso: string): number | null {
  const match = OFFSET_IN_ISO.exec(iso);
  if (match === null) return null;
  if (match[1] !== undefined) return 0;
  const hours = Number(match[3]);
  const minutes = Number(match[4]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const total = hours * 60 + minutes;
  return match[2] === "-" ? -total : total;
}

/**
 * `2026-09-02T10:32:18+09:00` → `10:32:18`.
 *
 * @param iso           ISO-8601 시각. 모양이 아니면 `RangeError` 입니다.
 * @param viewerOffsetMinutes 보는 사람의 시간대(분). 기본은 이 컴퓨터의 오프셋입니다.
 *                      시험이 값을 넣어 어느 컴퓨터에서도 답이 같게 합니다.
 */
export function clockOfIso(
  iso: IsoDateTime,
  viewerOffsetMinutes: number = localOffsetMinutes(),
): string {
  const match = CLOCK_IN_ISO.exec(iso);
  if (match === null || match[1] === undefined) {
    throw new RangeError(`시각 문자열이 ISO 8601 모양이 아니에요: ${iso}`);
  }

  const written = writtenOffsetMinutes(iso);
  // 시간대가 안 적혀 있거나 보는 사람과 같으면 옮길 것이 없습니다. 적힌 글자를 그대로 씁니다
  // (밀리초·윤초 표기가 있어도 문자열을 다시 만들지 않아 안전합니다).
  if (written === null || written === Math.trunc(viewerOffsetMinutes)) {
    return match[1];
  }

  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new RangeError(`시각 문자열이 ISO 8601 모양이 아니에요: ${iso}`);
  }
  return new Date(ms + Math.trunc(viewerOffsetMinutes) * 60_000).toISOString().slice(11, 19);
}

/**
 * 밀리초 시각 → `10:32:18`. 시간대는 tutor-core 의 기본값(KST)입니다.
 *
 * 옮기지 않습니다 — `formatIso` 가 이미 KST 로 적고, 여기서 다시 보는 사람 시각으로 옮기면
 * 같은 스토어가 만든 fixture 재생 화면이 컴퓨터마다 달라집니다(골든 장면이 흔들립니다).
 */
export function clockOfMs(ms: number): string {
  return clockOfIso(formatIso(ms), KST_OFFSET_MINUTES);
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
