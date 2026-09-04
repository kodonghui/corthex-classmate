// 수업 시계 문구입니다. ISO 문자열을 **수업 시간대(KST)** 로 옮겨 `HH:MM:SS` 만 냅니다.
//
// 예전에는 문자열에서 `T` 뒤 여덟 글자를 그냥 잘라 썼습니다. fixture 는 전부 `+09:00` 이라
// 그래도 맞았지만, 라이브에서 확장이 찍은 `…T02:20:46.959Z`(UTC) 가 오자 화면이 `02:20:46`
// 이 됐습니다(실측 2026-09-03 2교시). 그래서 문자열에 적힌 오프셋과 화면이 쓰는 오프셋이
// 다르면 옮겨서 냅니다.
//
//   "2026-09-02T10:32:18+09:00"  · 화면 +09:00  → "10:32:18"  (그대로)
//   "2026-09-03T02:20:46.959Z"   · 화면 +09:00  → "11:20:46"  (옮김)
//
// 기준은 **보는 사람의 시간대가 아니라 KST 로 못 박습니다.** 한 화면에 이 파일의 두 함수가
// 함께 그려지기 때문입니다 — 헤더 시각은 `clockOfMs`(KST 고정), 전사 줄은 `clockOfIso` 입니다.
// 기본값을 보는 사람 시간대로 두면 뉴욕(-04:00) 화면에서 헤더 10:00:06 · 전사 줄 21:00:06 처럼
// 같은 순간이 한 화면에서 어긋납니다. 수업은 KST 로 돌고 fixture · 사건 `at`
// (`background/ids.ts` 의 `toKstIso`) · 리포트가 모두 KST 라 축을 하나로 맞춥니다.
// 보는 사람 시간대가 정말 필요한 자리는 오프셋을 인자로 **명시해** 넘깁니다.
//
// 원천 쪽도 같은 축입니다 — 확장이 찍는 시각은 `src/tiro/iso-time.ts` 의 `toLocalIso` 가
// KST 오프셋 표기로 적습니다. 이 파일은 옛 기록과 다른 도구가 만든 `Z` 표기를 받는 그물입니다.

import type { IsoDateTime } from "@classmate/contracts";
import { KST_OFFSET_MINUTES, formatIso } from "@classmate/tutor-core";

const CLOCK_IN_ISO = /[Tt ](\d{2}:\d{2}:\d{2})/;

/** 문자열 끝에 적힌 시간대입니다. `Z` · `+09:00` · `+0900` 을 봅니다. */
const OFFSET_IN_ISO = /(?:([Zz])|([+-])(\d{2}):?(\d{2}))$/;

/**
 * 문자열에 **적혀 있는** 시간대를 분으로 읽습니다. 아무것도 안 적혀 있으면 null 입니다.
 *
 * null 은 "이 시각은 이미 화면이 쓰는 벽시계"라는 뜻으로 씁니다. 옮길 근거가 문자열에
 * 없으므로 적힌 글자를 그대로 냅니다.
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
 * @param viewerOffsetMinutes 화면이 쓸 시간대(분). 기본은 수업 시간대 KST(540)입니다.
 *                      **이 컴퓨터의 오프셋을 읽지 않습니다** — 같은 화면의 `clockOfMs` 가
 *                      KST 고정이라, 여기만 컴퓨터를 따르면 한 화면에 시간대가 둘이 됩니다.
 *                      보는 사람 시간대가 필요하면 `-new Date().getTimezoneOffset()` 을
 *                      부르는 쪽에서 넣습니다.
 */
export function clockOfIso(
  iso: IsoDateTime,
  viewerOffsetMinutes: number = KST_OFFSET_MINUTES,
): string {
  const match = CLOCK_IN_ISO.exec(iso);
  if (match === null || match[1] === undefined) {
    throw new RangeError(`시각 문자열이 ISO 8601 모양이 아니에요: ${iso}`);
  }

  const written = writtenOffsetMinutes(iso);
  // 시간대가 안 적혀 있거나 화면과 같으면 옮길 것이 없습니다. 적힌 글자를 그대로 씁니다
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
 * `clockOfIso` 와 **같은 축**이라 한 화면에 섞어 써도 어긋나지 않습니다. 여기서 보는 사람
 * 시각으로 옮기면 같은 스토어가 만든 fixture 재생 화면이 컴퓨터마다 달라집니다
 * (골든 장면이 흔들립니다).
 */
export function clockOfMs(ms: number): string {
  return clockOfIso(formatIso(ms), KST_OFFSET_MINUTES);
}

/**
 * ISO 시각을 화면 축(KST 기본값)의 `YYYY.MM.DD HH:mm`으로 냅니다.
 *
 * `clockOfIso`와 달리 날짜까지 표시하므로 오프셋 변환 중 자정이 넘어가는 경우도 함께
 * 옮깁니다. 과거 세션 목록처럼 날짜와 시각을 한 줄에 쓰는 자리가 이 함수를 공유합니다.
 */
export function dateTimeOfIso(
  iso: IsoDateTime,
  viewerOffsetMinutes: number = KST_OFFSET_MINUTES,
): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new RangeError(`시각 문자열이 ISO 8601 모양이 아니에요: ${iso}`);
  }
  const shifted = new Date(ms + Math.trunc(viewerOffsetMinutes) * 60_000).toISOString();
  return `${shifted.slice(0, 10).replaceAll('-', '.')} ${shifted.slice(11, 16)}`;
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
