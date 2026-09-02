// 시각·값을 사람이 읽는 짧은 문자열로 바꿉니다.
//
// ISO 문자열을 Date 로 바꾸지 않습니다. Date 로 바꾸면 만드는 컴퓨터의 표준시대에 따라
// 결과가 달라져서 같은 번들인데 다른 HTML 이 나옵니다. 그래서 글자를 그대로 잘라 씁니다.

import { UNKNOWN_CLOCK } from "./labels.ts";

/** ISO 시각에서 시:분:초만 뽑습니다. 보기 2026-09-02T10:31:35+09:00 → 10:31:35 */
export function formatClock(iso: string | undefined): string {
  if (iso === undefined || iso === "") {
    return UNKNOWN_CLOCK;
  }
  const matched = /T(\d{2}:\d{2}:\d{2})/.exec(iso);
  return matched?.[1] ?? iso;
}

/** ISO 시각에서 날짜만 뽑습니다. 보기 2026-09-02T10:31:35+09:00 → 2026-09-02 */
export function formatDay(iso: string | undefined): string | undefined {
  if (iso === undefined) {
    return undefined;
  }
  return /^(\d{4}-\d{2}-\d{2})/.exec(iso)?.[1];
}

/** 시작~끝을 한 줄로 적습니다. */
export function formatSpan(startedAt: string | undefined, endedAt: string | undefined): string {
  return `${formatClock(startedAt)} ~ ${formatClock(endedAt)}`;
}

/** 자료가 몇 초 전 것인지 적습니다. null 이면 자료가 없었다는 뜻입니다. */
export function formatAge(label: string, seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) {
    return `${label} 자료 없음`;
  }
  return `${label} ${seconds}초 전`;
}

/** 사건 payload 한 칸을 텍스트로 옮깁니다. 객체는 JSON 글자 그대로 보여 줍니다. */
export function formatPayloadValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return "(읽을 수 없는 값)";
  }
}

/** 사건 payload 전체를 한 줄 요약으로 만듭니다. */
export function formatPayload(payload: unknown): string {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return formatPayloadValue(payload);
  }
  const parts = Object.entries(payload as Record<string, unknown>).map(
    ([key, value]) => `${key}=${formatPayloadValue(value)}`,
  );
  return parts.length === 0 ? "(딸림 값 없음)" : parts.join(" · ");
}

/** 파일 이름과 class 이름에 넣어도 안전한 글자만 남깁니다. */
export function toSafeSlug(value: string): string {
  const slug = value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug === "" ? "unknown" : slug;
}
