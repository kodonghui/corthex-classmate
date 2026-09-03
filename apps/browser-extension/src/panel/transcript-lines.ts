// 계약의 전사 조각(TranscriptSegment)을 화면 컴포넌트(TranscriptFlow)가 받는 줄 모양으로 바꿉니다.
//
//   계약  { id, seq, text: "객체를 직접 new로 만들면 …", arrivedAt, spokenAt, state }
//   화면  { id, time: "10:32:10", segments: [{ text: "객체를 직접 " }, { text: "new", term: true }, { text: "로 만들면 …" }] }
//
// 점선 밑줄(term)은 낱말 목록에 있는 글자 그대로의 자리에만 긋습니다. 형태소 분석은 하지 않고,
// 낱말 경계만 `live-terms` 의 `isWordAt` 으로 봅니다.

import type { TranscriptSegment } from "@classmate/contracts";
import type { TranscriptLine, TranscriptSegment as UiSegment } from "@classmate/ui-classmate";
import { parseIso } from "@classmate/tutor-core";

import { clockOfIso } from "./clock";
import { isWordAt } from "./live-terms";

/**
 * 글에서 낱말을 찾아 점선 조각으로 나눕니다. 같은 자리에서 여러 낱말이 맞으면 긴 것을 고릅니다.
 *
 *     splitTerms("객체를 직접 new로 만들면", ["new"])
 *     → [{ text: "객체를 직접 " }, { text: "new", term: true }, { text: "로 만들면" }]
 *
 * 글자가 맞아도 **낱말 경계가 아니면 긋지 않습니다.** 목록은 전사 전체에서 한 번 만드는데,
 * 어느 줄에서는 낱말이던 것이 다른 줄에서는 남의 낱말 안쪽 조각이기 때문입니다.
 *
 *     목록에 "인가"(권한)  →  "무엇인가요" 의 가운데에는 긋지 않습니다
 *     목록에 "동기"        →  "비동기" · "동기화" 안쪽에는 긋지 않습니다
 */
export function splitTerms(text: string, terms: readonly string[]): UiSegment[] {
  const sorted = [...terms].filter((term) => term.length > 0).sort((a, b) => b.length - a.length);
  const out: UiSegment[] = [];
  let plain = "";
  let i = 0;
  while (i < text.length) {
    const hit = sorted.find((term) => text.startsWith(term, i) && isWordAt(text, term, i));
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

/** 접은 결과입니다. 남긴 줄과, 접힌 줄이 어디로 갔는지 적은 쪽지입니다. */
export interface FoldedSegments {
  /** 화면에 남길 조각입니다(시간순). */
  readonly kept: readonly TranscriptSegment[];
  /** 접힌 조각 id → 그 자리를 이어받은 조각 id 입니다. 붙잡은 자리를 옮길 때 씁니다. */
  readonly alias: ReadonlyMap<string, string>;
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
 *   ② 남은 `partial` 중, **뒤에 온** 줄의 글이 그 글로 시작하면(자라는 중인 같은 문단) 버립니다.
 *
 * ②가 뒤에 온 줄만 보는 까닭이 있습니다. 진행 중 줄은 한 글자에서 시작해 자라므로 `그` ·
 * `이제` · `그러니까` 같은 앞머리가 한 교시 안 **남남 문단**과 쉽게 겹칩니다. 앞뒤를 안 가리면
 * 지금 들리는 말 줄이 옛 문단 때문에 통째로 사라집니다(2026-09-03 검토에서 실제로 났습니다).
 * 같은 문단의 확정본은 언제나 진행 중 줄보다 **뒤에** 오므로 이 좁힘으로 놓치는 것은 없습니다.
 *
 * 확정된 줄끼리는 서로 지우지 않습니다 — 짧은 문장이 우연히 다른 문장의 앞머리와 같아도
 * `final` 은 ②의 대상이 아닙니다.
 *
 * 접힌 줄은 그냥 사라지지 않습니다. `alias` 에 "버린 id → 이어받은 id" 를 적어 두어, 그 줄을
 * 붙잡아 둔 순간(Moment)이 이긴 줄로 따라갈 수 있게 합니다(`ReplayStore#realignMoments`).
 */
export function foldSegments(segments: readonly TranscriptSegment[]): FoldedSegments {
  const bySeq = new Map<number, TranscriptSegment>();
  const alias = new Map<string, string>();
  for (const segment of segments) {
    const before = bySeq.get(segment.seq);
    if (before === undefined) {
      bySeq.set(segment.seq, segment);
      continue;
    }
    const winner = moreAdvanced(before, segment);
    const loser = winner === before ? segment : before;
    bySeq.set(segment.seq, winner);
    if (loser.id !== winner.id) alias.set(loser.id, winner.id);
  }
  // 시간순으로 세웁니다. ② 는 "그 뒤에 온 줄" 만 보므로 이 순서가 곧 규칙입니다.
  const ordered = [...bySeq.values()].sort(byArrival);
  const kept: TranscriptSegment[] = [];
  for (const [index, segment] of ordered.entries()) {
    if (segment.state !== "final") {
      const winner = ordered.slice(index + 1).find((other) => other.text.startsWith(segment.text));
      if (winner !== undefined) {
        alias.set(segment.id, winner.id);
        continue;
      }
    }
    kept.push(segment);
  }
  return { kept, alias };
}

/** `foldSegments` 에서 남긴 줄만 꺼냅니다. */
export function dedupeSegments(segments: readonly TranscriptSegment[]): TranscriptSegment[] {
  return [...foldSegments(segments).kept];
}

/**
 * 접힘 쪽지를 끝까지 따라가 지금 살아 있는 줄 id 를 돌려줍니다.
 *
 *     partial-0 ─▶ ts-058(partial) ─▶ ts-058(final)   사슬이 있어도 한 번에 끝까지 갑니다.
 *
 * 접힌 적이 없으면 받은 id 를 그대로 돌려줍니다. 고리(자기 자신으로 도는 쪽지)가 생겨도
 * 이미 지나온 id 를 기억해 멈춥니다.
 */
export function resolveAlias(alias: ReadonlyMap<string, string>, id: string): string {
  const seen = new Set<string>([id]);
  let out = id;
  for (;;) {
    const next = alias.get(out);
    if (next === undefined || seen.has(next)) return out;
    seen.add(next);
    out = next;
  }
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
  const { kept } = foldSegments(segments.filter((segment) => parseIso(segment.arrivedAt) <= untilMs));
  return [...kept]
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
