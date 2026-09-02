// 질문 시점 봉인(ContextSnapshot) — 붙잡은 순간의 자료만 골라 계약 모양으로 굳힙니다.
//
// 봉인 규칙 세 가지입니다.
//   1. 질문 시각(askedAt)보다 **뒤에 도착한 자료는 넣지 않습니다.** 뒤에 자료가 바뀌어도
//      이 묶음은 그대로 남아야 하기 때문입니다(계약 QuestionSnapshot 설명).
//   2. 전사는 **최근 N문단**만 넣고 오래된 것이 앞, 최근 것이 뒤로 옵니다.
//   3. 자료 나이는 `askedAt - arrivedAt/capturedAt` 을 초로 내림해 셉니다. 자료가 없으면 null 입니다.

import type {
  EditorContext,
  IsoDateTime,
  QuestionSnapshot,
  ScreenFrame,
  SourceAges,
  TranscriptSegment,
} from "@classmate/contracts";

import { ageSeconds, parseIso } from "./time";

/** 전사를 몇 문단까지 봉인할지 기본값입니다. 골든 시나리오 fixture 가 3문단입니다. */
export const DEFAULT_RECENT_PARAGRAPHS = 3;

export interface SealSnapshotInput {
  /** 질문을 붙잡은 시각입니다. 이 시각이 봉인의 기준선입니다. */
  readonly askedAt: IsoDateTime;
  /** 지금까지 받은 전사 조각 전부입니다. 순서는 섞여 있어도 됩니다. */
  readonly transcript: readonly TranscriptSegment[];
  /** 지금까지 받은 화면 프레임입니다. 없으면 넣지 않아도 됩니다. */
  readonly frames?: readonly ScreenFrame[];
  /** 지금까지 받은 편집기 문맥입니다. 없으면 넣지 않아도 됩니다. */
  readonly editor?: readonly EditorContext[];
  /** 봉인할 최근 전사 문단 수(N)입니다. 기본 3 입니다. */
  readonly recentParagraphs?: number;
}

/** 도착 시각이 같으면 seq 가 작은 것이 앞에 오도록 줄 세웁니다. */
function byArrival(a: TranscriptSegment, b: TranscriptSegment): number {
  const gap = parseIso(a.arrivedAt) - parseIso(b.arrivedAt);
  return gap !== 0 ? gap : a.seq - b.seq;
}

/** 기준 시각까지 들어온 것 중 가장 마지막 것을 고릅니다. 없으면 undefined 입니다. */
function newestUntil<T>(items: readonly T[], at: (item: T) => number, limitMs: number): T | undefined {
  let chosen: T | undefined;
  let chosenMs = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const ms = at(item);
    if (ms > limitMs) continue;
    if (ms >= chosenMs) {
      chosen = item;
      chosenMs = ms;
    }
  }
  return chosen;
}

/**
 * 붙잡은 순간의 자료를 계약 `Question.snapshot` 모양으로 봉인합니다.
 *
 *     const snapshot = sealSnapshot({
 *       askedAt: "2026-09-02T10:32:18+09:00",
 *       transcript, frames, editor, recentParagraphs: 3,
 *     });
 *     // → { transcriptSegmentIds: [...3개], screenFrameId, editorContextId, ages: {4, 2, 1} }
 *
 * 자료가 하나도 없으면 그 자리는 아예 넣지 않고(선택 항목) 나이만 null 로 남깁니다.
 */
export function sealSnapshot(input: SealSnapshotInput): QuestionSnapshot {
  const askedMs = parseIso(input.askedAt);
  const wanted = input.recentParagraphs ?? DEFAULT_RECENT_PARAGRAPHS;

  const arrived = [...input.transcript]
    .filter((segment) => parseIso(segment.arrivedAt) <= askedMs)
    .sort(byArrival);
  const sealed = wanted > 0 ? arrived.slice(-wanted) : [];

  const frame = newestUntil(input.frames ?? [], (f) => parseIso(f.capturedAt), askedMs);
  const editor = newestUntil(input.editor ?? [], (e) => parseIso(e.capturedAt), askedMs);
  const newestSegment = sealed.at(-1);

  const ages: SourceAges = {
    transcriptSec: newestSegment ? ageSeconds(askedMs, parseIso(newestSegment.arrivedAt)) : null,
    screenSec: frame ? ageSeconds(askedMs, parseIso(frame.capturedAt)) : null,
    editorSec: editor ? ageSeconds(askedMs, parseIso(editor.capturedAt)) : null,
  };

  return {
    transcriptSegmentIds: sealed.map((segment) => segment.id),
    // exactOptionalPropertyTypes 때문에 undefined 를 넣지 않고 자리 자체를 뺍니다.
    ...(frame === undefined ? {} : { screenFrameId: frame.id }),
    ...(editor === undefined ? {} : { editorContextId: editor.id }),
    ages,
  };
}
