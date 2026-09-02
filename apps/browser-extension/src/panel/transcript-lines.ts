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

/**
 * `untilMs` 까지 도착한 조각을 시간순 줄로 만듭니다. 시각은 말한 시각(spokenAt)이 있으면 그것,
 * 없으면 도착 시각입니다.
 */
export function toTranscriptLines(
  segments: readonly TranscriptSegment[],
  terms: readonly string[],
  untilMs: number,
): TranscriptLine[] {
  return segments
    .filter((segment) => parseIso(segment.arrivedAt) <= untilMs)
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
