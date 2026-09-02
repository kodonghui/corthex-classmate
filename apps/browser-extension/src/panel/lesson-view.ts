// 재생기 상태(ReplayState) → 화면 컴포넌트가 바로 받는 값 덩어리.
//
// 여기에는 React 도 브라우저 API 도 없습니다. 상태기계의 `note` 단계를 디자인 상태 A~H 의
// props 로 옮기는 순수 함수만 둡니다. 문구는 tutor-core(answer-flow) 와 디자인 정본의 것을 그대로 씁니다.
//
//   note        화면(디자인 상태)
//   none ─────▶ 메모 없음 (A) · 짐작 고르는 중이면 choosing (D)
//   preparing ▶ MarginNote preparing + SourceStatus compact (B)
//   waiting ──▶ MarginNote preparing · warn · "튜터가 돌아오면 …" (H)
//   minimal ──▶ MarginNote ready: 결론 · 근거 · 칩 · "N초 뒤 접혀요" (C)
//   detail ───▶ 자세히 화면 (F) — 홈에서는 ready 와 같게 그립니다
//   folded ───▶ MarginNote collapsed (E)

import type { Answer, Id } from "@classmate/contracts";
import { answerView, foldNotice, parseIso, WAITING_FOOTER_LINE, WAITING_NOTE_LINE } from "@classmate/tutor-core";
import type {
  AnswerSection,
  FollowUp,
  FooterSource,
  FooterWarn,
  GuessOption,
  MarginNoteProps,
  NoteChip,
  SourceItem,
  TranscriptLine,
} from "@classmate/ui-classmate";

import { formatAgo } from "../lib/format-time";
import { clockOfIso, clockOfMs } from "./clock";
import { evidenceType } from "./evidence";
import type { GoldenBundle } from "./golden-bundle";
import { guessesForLine } from "./golden-bundle";
import type { ReconnectTarget } from "./ports";
import type { Moment, Reply, ReplayState } from "./replay-store";

export type EvidenceItem = NonNullable<MarginNoteProps["evidence"]>[number];

export type NoteView =
  | { readonly kind: "none" }
  | {
      readonly kind: "choosing";
      readonly lineId: string;
      readonly time: string;
      readonly options: readonly GuessOption[];
      readonly value: string | undefined;
    }
  | {
      readonly kind: "preparing";
      readonly lineId: string;
      readonly term: string;
      readonly time: string;
      readonly warn: boolean;
      readonly waitingText: string | null;
      readonly sources: readonly SourceItem[];
    }
  | {
      readonly kind: "ready";
      readonly lineId: string;
      readonly term: string;
      readonly time: string;
      readonly conclusion: string;
      readonly evidence: readonly EvidenceItem[];
      readonly chips: readonly NoteChip[];
      readonly collapseText: string;
    }
  | {
      readonly kind: "collapsed";
      readonly lineId: string;
      readonly term: string;
      readonly time: string;
      readonly conclusion: string;
    };

export interface HeaderView {
  readonly title: string;
  readonly subtitle: string;
  readonly time: string;
  readonly status: "live" | "paused";
}

/**
 * 바닥줄 안내 + "다시 연결" 이 되살릴 커넥터.
 *
 * `reconnect` 를 `FooterWarn` 안에 둡니다. 되살릴 것이 없는 안내(튜터 멈춤)에는 아예 키가 생기지
 * 않아, 안내 한 덩어리가 곧 "무엇이 멈췄고 무엇을 누를 수 있는지" 전부가 됩니다.
 * 화면은 이 값으로 `onReconnect` 를 묶습니다 — 문구(`action`)와 대상을 따로 두어야 화면이
 * 커넥터 이름을 지어내지 않습니다.
 */
export interface FooterWarnView extends FooterWarn {
  readonly reconnect?: ReconnectTarget;
}

export interface FooterView {
  readonly sources: readonly FooterSource[];
  readonly count: number;
  readonly warn: FooterWarnView | null;
}

export interface ListeningView {
  readonly header: HeaderView;
  /** 헤더 바로 아래 붙박이 "지금 · …" 한 줄. 아직 없으면 null 입니다. */
  readonly pinnedNow: string | null;
  readonly lines: readonly TranscriptLine[];
  readonly active: string | undefined;
  readonly marked: readonly string[];
  readonly note: NoteView;
  /** 메모 아래 "지금 · …" 한 줄입니다. */
  readonly noteNow: string | null;
  readonly footer: FooterView;
  readonly tiroPaused: boolean;
}

export interface DetailView {
  readonly term: string;
  readonly time: string;
  readonly line: TranscriptLine | null;
  readonly marked: readonly string[];
  readonly loading: boolean;
  readonly loadingText: string;
  readonly conclusion: string;
  readonly evidence: readonly EvidenceItem[];
  readonly sections: readonly AnswerSection[];
  readonly followUps: readonly FollowUp[];
  readonly reply: Reply | null;
  readonly nowLine: string | null;
}

/** 화면 칩 문구 → 칩 id. 정본 디자인의 id 를 따릅니다. */
const CHIP_ID_BY_LABEL: Readonly<Record<string, string>> = {
  "더 쉽게": "easier",
  "왜 필요한데?": "why",
  "지금 화면 코드": "screen",
  "내 코드와 비교": "mine",
  "방금 내용": "recent",
};

const FOLLOW_UPS: readonly FollowUp[] = [
  { id: "easier", label: "더 쉽게" },
  { id: "why", label: "왜 필요한데?" },
  { id: "recent", label: "방금 내용" },
];

/** 정본 SourceStatus 의 이름 순서입니다. */
const SOURCE_ORDER = ["tiro", "meet", "intellij"] as const;

/** 바닥줄 호박색 안내에 붙는 되살리기 문구입니다(정본 H-1). */
export const RECONNECT_LABEL = "다시 연결";

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).at(-1) ?? filePath;
}

export function chipId(label: string): string {
  return CHIP_ID_BY_LABEL[label] ?? label.replace(/\s+/g, "-").toLowerCase();
}

export function currentMoment(state: ReplayState): Moment | null {
  const questionId = state.machine.questionId;
  return state.moments.find((moment) => moment.questionId === questionId) ?? null;
}

export function currentAnswer(bundle: GoldenBundle, state: ReplayState): Answer | null {
  const answerId = state.machine.answerId;
  return answerId === null ? null : (bundle.answers[answerId] ?? null);
}

/**
 * 질문 → 도착한 답 id. **도착한 사건만** 봅니다(`bundle.events` 를 쓰지 않습니다 — 라이브 모드에서는 비어 있고,
 * fixture 를 그대로 읽으면 아직 오지 않은 답까지 미리 보여 주게 됩니다).
 * `answer.queued` 와 `answer.failed` 는 아직 답이 아니므로 세지 않습니다(기록에서 "정리 중" 으로 남습니다).
 */
export function answerIdByQuestion(state: ReplayState): Readonly<Record<string, Id>> {
  const map: Record<string, Id> = {};
  for (const event of state.received) {
    if (event.type !== "answer.completed" && event.type !== "answer.recovered") continue;
    const questionId = event.payload["questionId"];
    const answerId = event.payload["answerId"];
    if (typeof questionId === "string" && typeof answerId === "string") map[questionId] = answerId;
  }
  return map;
}

/** 그 질문에 지금까지 도착한 답입니다. 지금 보고 있는 질문이면 상태기계가 든 답을 먼저 씁니다. */
export function answerOfQuestion(bundle: GoldenBundle, state: ReplayState, questionId: Id): Answer | null {
  if (state.machine.questionId === questionId) {
    const current = currentAnswer(bundle, state);
    if (current !== null) return current;
  }
  const answerId = answerIdByQuestion(state)[questionId];
  return answerId === undefined ? null : (bundle.answers[answerId] ?? null);
}

function latestMs(items: readonly { at: number }[], untilMs: number): number | null {
  let best: number | null = null;
  for (const item of items) {
    if (item.at <= untilMs && (best === null || item.at > best)) best = item.at;
  }
  return best;
}

/** 세 자료의 나이(초)입니다. 아직 온 자료가 없으면 null 입니다. */
export function sourceAges(bundle: GoldenBundle, nowMs: number): Record<(typeof SOURCE_ORDER)[number], number | null> {
  const age = (ms: number | null): number | null => (ms === null ? null : Math.floor((nowMs - ms) / 1_000));
  return {
    tiro: age(latestMs(bundle.transcript.map((s) => ({ at: parseIso(s.arrivedAt) })), nowMs)),
    meet: age(latestMs(bundle.frames.map((f) => ({ at: parseIso(f.capturedAt) })), nowMs)),
    intellij: age(latestMs([{ at: parseIso(bundle.editor.capturedAt) }], nowMs)),
  };
}

/**
 * 전사가 멈췄는지입니다(디자인 상태 H-1).
 *
 * **"아직 아무 보고도 안 옴" 은 멈춤이 아닙니다.** 패널을 연 첫 순간에 호박색 안내를 띄우면
 * 아직 시작하지도 않은 것을 고장이라고 말하게 됩니다. 커넥터가 스스로 `connector.status` 로
 * connected 아닌 형편을 알려 준 뒤에만 멈춤으로 봅니다.
 */
function tiroPaused(state: ReplayState): boolean {
  const status = state.machine.connectors["tiro-share"];
  return status !== undefined && status !== "connected";
}

/** 로컬 도우미(native host)가 끊겼는지입니다. 계약 `connector.status` 의 `off` 만 봅니다. */
function nativeHostOff(state: ReplayState): boolean {
  return state.machine.connectors["native-host"] === "off";
}

/** 답이 딸린 세 자료의 근거 칩입니다. 근거 단계는 답의 것을 그대로 쓰고 시각은 붙잡은 시각입니다. */
export function evidenceOf(answer: Answer, moment: Moment | null): EvidenceItem[] {
  const type = evidenceType(answer.evidence);
  const time = moment === null ? undefined : moment.time.slice(0, 5);
  return SOURCE_ORDER.map((source) => (time === undefined ? { type, source } : { type, source, time }));
}

/** 칩을 눌렀을 때 메모에 대신 보일 글과 근거입니다. fixture 의 details 에 있는 것만 씁니다. */
export function chipContent(answer: Answer, chip: string | null, moment: Moment | null): { text: string; evidence: EvidenceItem[] } {
  const details = answer.details ?? {};
  const type = evidenceType(answer.evidence);
  const time = moment === null ? undefined : moment.time.slice(0, 5);
  const withSource = (source: string): EvidenceItem => (time === undefined ? { type, source } : { type, source, time });
  if (chip === "why" && details.why !== undefined) return { text: details.why, evidence: [withSource("tiro")] };
  if (chip === "screen" && details.screenCode !== undefined) return { text: details.screenCode, evidence: [withSource("meet")] };
  if (chip === "mine" && details.compareMyCode !== undefined) {
    return { text: details.compareMyCode, evidence: [withSource("intellij")] };
  }
  if (chip !== null) {
    return {
      text: answer.conclusion,
      evidence: [{ type: "inferred", reason: "이 칩의 글이 fixture 에 없어 결론을 그대로 보여요" }],
    };
  }
  return { text: answer.conclusion, evidence: evidenceOf(answer, moment) };
}

/** 지금까지 온 답 중 "지금 · …" 줄이 있는 가장 최근 것입니다. */
export function pinnedNow(bundle: GoldenBundle, nowMs: number): string | null {
  let best: { at: number; line: string } | null = null;
  for (const answer of Object.values(bundle.answers)) {
    const at = parseIso(answer.createdAt);
    if (answer.nowLine !== undefined && at <= nowMs && (best === null || at > best.at)) {
      best = { at, line: answer.nowLine };
    }
  }
  return best === null ? null : best.line;
}

function preparingSources(bundle: GoldenBundle, moment: Moment | null, paused: boolean): SourceItem[] {
  const ages = moment?.ages;
  const file = basename(bundle.editor.filePath);
  const tiroAge = ages?.transcriptSec ?? null;
  const meetAge = ages?.screenSec ?? null;
  const editorAge = ages?.editorSec ?? null;
  return [
    { key: "tiro", state: paused ? "paused" : "live", label: paused ? "전사 멈춤" : `전사 ${formatAgo(tiroAge)}` },
    { key: "meet", state: "live", label: `Meet ${formatAgo(meetAge)}` },
    { key: "intellij", state: "live", label: `${file} ${formatAgo(editorAge)}` },
  ];
}

function noteOf(bundle: GoldenBundle, state: ReplayState): NoteView {
  const view = answerView(state.machine, state.now);
  const moment = currentMoment(state);

  if (view.phase === "none" || moment === null) {
    if (state.choosing !== null) {
      return {
        kind: "choosing",
        lineId: state.choosing.lineId,
        time: state.choosing.time,
        options: guessesForLine(state.choosing.lineId).map((guess) => ({ id: guess.id, label: guess.label })),
        value: state.choosing.guess ?? undefined,
      };
    }
    return { kind: "none" };
  }

  if (view.phase === "preparing" || view.phase === "waiting") {
    return {
      kind: "preparing",
      lineId: moment.lineId,
      term: moment.term,
      time: moment.time,
      warn: view.waiting,
      waitingText: view.waiting ? WAITING_NOTE_LINE : null,
      sources: preparingSources(bundle, moment, tiroPaused(state)),
    };
  }

  const answer = currentAnswer(bundle, state);
  if (answer === null) {
    return { kind: "none" };
  }

  if (view.phase === "folded") {
    return { kind: "collapsed", lineId: moment.lineId, term: moment.term, time: moment.time, conclusion: answer.conclusion };
  }

  const { text, evidence } = chipContent(answer, state.chip, moment);
  return {
    kind: "ready",
    lineId: moment.lineId,
    term: moment.term,
    time: moment.time,
    conclusion: text,
    evidence,
    chips: answer.chips.map((label) => ({ id: chipId(label), label, selected: state.chip === chipId(label) })),
    collapseText: foldNotice(view.foldsInSec),
  };
}

/** 디자인 규칙: 메모가 떠 있으면 4줄, 아니면 5줄만 보입니다. */
const VISIBLE_WITH_NOTE = 4;
const VISIBLE_WITHOUT_NOTE = 5;

function footerOf(bundle: GoldenBundle, state: ReplayState): FooterView {
  const ages = sourceAges(bundle, state.now);
  const paused = tiroPaused(state);
  const sources: FooterSource[] = [
    { key: "tiro", state: paused ? "paused" : "live", ago: paused ? "멈춤" : formatAgo(ages.tiro) },
    { key: "meet", state: "live", ago: formatAgo(ages.meet) },
    { key: "intellij", state: "live", ago: formatAgo(ages.intellij) },
  ];
  const providerDown = state.machine.provider === "failed" || state.machine.provider === "queued";
  let warn: FooterWarnView | null = null;
  if (providerDown) {
    // H-2 튜터 멈춤: 빨간 계열. 되살리는 것은 사람이 누를 일이 아니라 제공자 쪽이라 "다시 연결" 을 두지 않습니다.
    const [title, ...rest] = WAITING_FOOTER_LINE.split(/(?<=\.)\s+/);
    warn = { tone: "off", title: title ?? WAITING_FOOTER_LINE, description: rest.join(" ") };
  } else if (paused) {
    // H-1 전사 멈춤: 호박색 + "다시 연결".
    warn = {
      tone: "paused",
      title: "전사가 잠시 멈췄어요.",
      description: "화면과 코드는 계속 기록하고 있어요.",
      action: RECONNECT_LABEL,
      reconnect: "tiro-share",
    };
  } else if (nativeHostOff(state)) {
    warn = {
      tone: "paused",
      title: "로컬 도우미와 잠시 끊겼어요.",
      description: "붙잡은 순간은 패널에 남아요.",
      action: RECONNECT_LABEL,
      reconnect: "native-host",
    };
  }
  return { sources, count: state.moments.length, warn };
}

/** 듣는 중 화면(A~E · H)의 값 전부입니다. */
export function listeningView(bundle: GoldenBundle, state: ReplayState, allLines: readonly TranscriptLine[]): ListeningView {
  const note = noteOf(bundle, state);
  const open = note.kind !== "none" && note.kind !== "collapsed";
  const lines = allLines.slice(-(open ? VISIBLE_WITH_NOTE : VISIBLE_WITHOUT_NOTE));
  const moment = currentMoment(state);
  const answer = currentAnswer(bundle, state);
  const paused = tiroPaused(state);
  return {
    header: {
      title: bundle.subject,
      subtitle: `${bundle.periodIndex}교시`,
      time: clockOfMs(state.now),
      status: paused ? "paused" : "live",
    },
    pinnedNow: pinnedNow(bundle, state.now),
    lines,
    active: moment !== null && open && moment.segKey !== null ? moment.segKey : undefined,
    marked: state.moments.flatMap((item) => (item.segKey === null ? [] : [item.segKey])),
    note,
    noteNow: note.kind === "ready" && answer?.nowLine !== undefined ? answer.nowLine : null,
    footer: footerOf(bundle, state),
    tiroPaused: paused,
  };
}

function highlightLinesOf(code: string, needle: string): number[] {
  return code
    .split("\n")
    .map((line, index) => (line.includes(needle) ? index + 1 : 0))
    .filter((index) => index > 0);
}

/** 자세히 화면의 접힌 절 4종입니다. fixture 의 details 에 있는 절만 만듭니다. */
export function sectionsOf(bundle: GoldenBundle, answer: Answer, line: TranscriptLine | null): AnswerSection[] {
  const details = answer.details ?? {};
  const file = basename(bundle.editor.filePath);
  const sections: AnswerSection[] = [];
  if (details.why !== undefined) {
    sections.push({ id: "why", label: "왜 그런가요", content: details.why, defaultOpen: true });
  }
  if (details.compareMyCode !== undefined) {
    sections.push({ id: "cmp", label: "내 코드와 비교", icon: "git-compare", meta: file, content: details.compareMyCode });
  }
  if (details.screenCode !== undefined) {
    sections.push({
      id: "code",
      label: "선생님 화면 코드",
      icon: "monitor",
      type: "code",
      code: bundle.editor.excerpt,
      caption: `Meet · ${file}`,
      source: clockOfIso(bundle.editor.capturedAt),
      highlightLines: highlightLinesOf(bundle.editor.excerpt, "= new "),
      lineNumbers: true,
      content: details.screenCode,
    });
  }
  if (details.teacherSaid !== undefined) {
    sections.push({
      id: "said",
      label: "선생님이 말한 부분",
      type: "quote",
      content: details.teacherSaid,
      ...(line?.time === undefined ? {} : { time: line.time }),
    });
  }
  return sections;
}

/**
 * 붙잡은 순간 **하나**의 자세히 화면(F)입니다. 기록에서 지난 순간을 열 때도 이 함수를 씁니다.
 *
 * 지금 보고 있는 질문이 아니면(기록에서 연 지난 순간) 후속 칩과 칩 답을 두지 않습니다.
 * 후속 칩은 상태기계가 든 `answerId` 로 답을 꺼내므로, 지난 순간에 붙이면 엉뚱한 답이 옵니다.
 */
export function detailViewFor(
  bundle: GoldenBundle,
  state: ReplayState,
  allLines: readonly TranscriptLine[],
  questionId: Id,
): DetailView | null {
  const moment = state.moments.find((item) => item.questionId === questionId) ?? null;
  if (moment === null) return null;
  const current = state.machine.questionId === questionId;
  const view = answerView(state.machine, state.now);
  const answer = answerOfQuestion(bundle, state, questionId);
  const line = allLines.find((item) => item.id === moment.lineId) ?? null;
  const loading = answer === null || (current && (view.phase === "preparing" || view.phase === "waiting"));
  return {
    term: moment.term,
    time: moment.time,
    line,
    marked: moment.segKey === null ? [] : [moment.segKey],
    loading,
    loadingText:
      current && view.waiting ? "튜터가 돌아오면 여기에 나타나요 · 순간은 저장됐어요" : "한 줄로 정리하고 있어요",
    conclusion: answer?.conclusion ?? "",
    evidence: answer === null ? [] : evidenceOf(answer, moment),
    sections: answer === null ? [] : sectionsOf(bundle, answer, line),
    followUps: current ? FOLLOW_UPS : [],
    reply: current ? state.reply : null,
    nowLine: answer?.nowLine === undefined ? pinnedNow(bundle, state.now) : answer.nowLine,
  };
}

/** 지금 보고 있는 순간의 자세히 화면(F)입니다. 붙잡은 순간이 없으면 null 입니다. */
export function detailView(
  bundle: GoldenBundle,
  state: ReplayState,
  allLines: readonly TranscriptLine[],
): DetailView | null {
  const questionId = state.machine.questionId;
  return questionId === null ? null : detailViewFor(bundle, state, allLines, questionId);
}
