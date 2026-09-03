// 계약의 전사 조각(TranscriptSegment)을 화면 컴포넌트(TranscriptFlow)가 받는 줄 모양으로 바꿉니다.
//
//   계약  { id, seq, text: "객체를 직접 new로 만들면 …", arrivedAt, spokenAt, state }
//   화면  { id, time: "10:32:10", segments: [{ text: "객체를 직접 " }, { text: "new", term: true }, { text: "로 만들면 …" }] }
//
// 점선 밑줄(term)은 낱말 목록에 있는 글자 그대로의 자리에만 긋습니다. 형태소 분석은 하지 않습니다.

import type { TranscriptSegment } from "@classmate/contracts";
import type { TranscriptLine, TranscriptSegment as UiSegment } from "@classmate/ui-classmate";
import { parseIso } from "@classmate/tutor-core";

import { clockOfIso } from "./clock";

/**
 * 글에서 낱말을 찾아 점선 조각으로 나눕니다. 같은 자리에서 여러 낱말이 맞으면 긴 것을 고릅니다.
 *
 *     splitTerms("객체를 직접 new로 만들면", ["new"])
 *     → [{ text: "객체를 직접 " }, { text: "new", term: true }, { text: "로 만들면" }]
 */
export function splitTerms(text: string, terms: readonly string[]): UiSegment[] {
  const sorted = [...terms].filter((term) => term.length > 0).sort((a, b) => b.length - a.length);
  const out: UiSegment[] = [];
  let plain = "";
  let i = 0;
  while (i < text.length) {
    const hit = sorted.find((term) => text.startsWith(term, i));
    if (hit === undefined) {
      plain += text[i];
      i += 1;
      continue;
    }
    if (plain.length > 0) {
      out.push({ text: plain });
      plain = "";
    }
    out.push({ text: hit, term: true });
    i += hit.length;
  }
  if (plain.length > 0) {
    out.push({ text: plain });
  }
  return out;
}

/** 도착 시각이 같으면 seq 가 작은 것이 앞에 오도록 줄 세웁니다. */
function byArrival(a: TranscriptSegment, b: TranscriptSegment): number {
  const gap = parseIso(a.arrivedAt) - parseIso(b.arrivedAt);
  return gap !== 0 ? gap : a.seq - b.seq;
}

/** 둘 중 더 나아간 조각입니다. 확정(final)이 이기고, 같은 등급이면 더 긴 글이 이깁니다. */
function moreAdvanced(a: TranscriptSegment, b: TranscriptSegment): TranscriptSegment {
  if (a.state !== b.state) return a.state === "final" ? a : b;
  return b.text.length > a.text.length ? b : a;
}

/**
 * 같은 문단이 두 줄로 보이는 것을 막습니다.
 *
 * 공유 페이지에서 한 문단은 **두 가지 길**로 패널에 옵니다.
 *
 *     진행 중  tiro.partial  → id `ts-<교시>-partial-<번호>`  ┐ 같은 문단인데
 *     확정 전  tiro.segment  → id `ts-058` (state partial)   ┘ id 가 다릅니다
 *     확정     tiro.segment  → id `ts-058` (state final)
 *
 * 2026-09-03 실측에서 같은 문단이 패널에 두 번 그려졌습니다. 두 가지로 거릅니다.
 *
 *   ① `seq` 가 같으면 더 나아간 것 하나만 남깁니다(final > partial, 같으면 긴 글).
 *   ② 남은 `partial` 중, 다른 줄의 글이 그 글로 시작하면(자라는 중인 같은 문단) 버립니다.
 *
 * 확정된 줄끼리는 서로 지우지 않습니다 — 짧은 문장이 우연히 다른 문장의 앞머리와 같아도
 * `final` 은 ②의 대상이 아닙니다.
 */
export function dedupeSegments(segments: readonly TranscriptSegment[]): TranscriptSegment[] {
  const bySeq = new Map<number, TranscriptSegment>();
  for (const segment of segments) {
    const before = bySeq.get(segment.seq);
    bySeq.set(segment.seq, before === undefined ? segment : moreAdvanced(before, segment));
  }
  // 긴 글부터 훑으며 담습니다. 글이 같은 두 조각도 뒤엣것 하나만 빠지도록 id 로 순서를 못 박습니다.
  const ordered = [...bySeq.values()].sort((a, b) => b.text.length - a.text.length || (a.id < b.id ? -1 : 1));
  const kept: TranscriptSegment[] = [];
  for (const segment of ordered) {
    if (segment.state !== "final" && kept.some((other) => other.text.startsWith(segment.text))) continue;
    kept.push(segment);
  }
  return kept;
}

/**
 * `untilMs` 까지 도착한 조각을 시간순 줄로 만듭니다. 시각은 말한 시각(spokenAt)이 있으면 그것,
 * 없으면 도착 시각입니다.
 */
export function toTranscriptLines(
  segments: readonly TranscriptSegment[],
  terms: readonly string[],
  untilMs: number,
): TranscriptLine[] {
  return dedupeSegments(segments.filter((segment) => parseIso(segment.arrivedAt) <= untilMs))
    .sort(byArrival)
    .map((segment) => ({
      id: segment.id,
      time: clockOfIso(segment.spokenAt ?? segment.arrivedAt),
      segments: splitTerms(segment.text, terms),
    }));
}

/**
 * 줄 안에서 그 낱말이 점선으로 그어진 첫 자리를 `<줄 id>:<조각 번호>` 로 돌려줍니다.
 * TranscriptFlow 의 `active`·`marked` 가 이 열쇠를 씁니다. 없으면 null 입니다.
 */
export function segmentKeyOfWord(line: TranscriptLine, word: string): string | null {
  const index = line.segments.findIndex((segment) => segment.term === true && segment.text === word);
  return index < 0 ? null : `${line.id}:${index}`;
}
