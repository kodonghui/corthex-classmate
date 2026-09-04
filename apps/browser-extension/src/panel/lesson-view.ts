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
import { LIVE_EDITOR_PLACEHOLDER_ID } from "./golden-bundle";
import type { ReconnectTarget } from "./ports";
import type { Moment, Reply, ReplayState } from "./replay-store";
import { MODEL_CHIP_PREFIX } from "./replay-store";

export type EvidenceItem = NonNullable<MarginNoteProps["evidence"]>[number];

/**
 * 답이 만들어지는 **동안** 화면에 보여 줄 것입니다. 답을 기다리는 자리에만 붙습니다.
 *
 *     text 가 있다  ─▶ 자라는 결론을 그대로 보여 줍니다 (아직 완성이 아닙니다)
 *     text 가 없다  ─▶ chars 만 있습니다. 숫자가 자라는 것으로 "오는 중" 을 말합니다
 *
 * 완성된 답으로 착각하지 않게 하는 일은 **그리는 쪽**이 합니다: 결론 자리(`cm-note__c` ·
 * `cm-reply__a`)가 아니라 대기 자리에 그리고, 움직이는 띠를 함께 둡니다.
 */
export interface AnswerStreamView {
  /** 지금까지 해독한 결론 전체입니다. 아직 한 글자도 없으면 null 입니다. */
  readonly text: string | null;
  /** 지금까지 받은 날 본문 글자 수입니다. */
  readonly chars: number;
}

/** 문장을 통째로 붙잡아 짐작을 고르는 자리입니다(디자인 상태 D). */
export interface ChoosingView {
  readonly lineId: string;
  readonly time: string;
  readonly options: readonly GuessOption[];
  readonly value: string | undefined;
}

export type NoteView =
  | { readonly kind: "none" }
  | ({ readonly kind: "choosing" } & ChoosingView)
  | {
      readonly kind: "preparing";
      readonly lineId: string;
      readonly term: string;
      readonly time: string;
      readonly warn: boolean;
      readonly waitingText: string | null;
      /** 답이 흐르고 있으면 그 조각입니다. 아직 한 조각도 안 왔으면 null 입니다. */
      readonly stream: AnswerStreamView | null;
      readonly sources: readonly SourceItem[];
    }
  | {
      readonly kind: "ready";
      readonly lineId: string;
      readonly term: string;
      readonly time: string;
      readonly conclusion: string;
      /**
       * 결론 바로 아래에 그 자리에서 보여 줄 답 본문의 첫 문단입니다(U-33).
       * 칩을 눌러 결론 자리가 이미 본문으로 바뀐 동안에는 null 입니다 — 같은 글이 두 번 나옵니다.
       */
      readonly body: string | null;
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
  /**
   * 앞 질문의 메모가 자리를 차지한 채로 **새로 문장을 붙잡았을 때**의 짐작 목록입니다.
   *
   * 왜 `note` 와 따로 두는가: `note` 는 한 번에 하나뿐인데(상태기계가 질문 하나만 듭니다)
   * 앞 질문의 답을 기다리는 동안에도 다음 문장을 붙잡을 수 있어야 합니다. 예전에는
   * `noteOf` 가 `phase === "none"` 일 때만 짐작을 냈기 때문에, 답을 기다리는 중에 문단을
   * 누르면 스토어에는 `choosing` 이 잡히는데 화면에는 아무것도 안 나와 "안 눌린다" 로
   * 보였습니다(2026-09-03 실측: 4분 32초 동안 질문 0건).
   *
   * `note.kind === "choosing"` 인 자리(앞 질문이 없는 평상시)에서는 **null 입니다.** 그래야
   * 같은 짐작 목록이 두 번 그려지지 않고, 재생(fixture) 골든 장면이 예전 길 그대로 갑니다.
   */
  readonly choosing: ChoosingView | null;
  /** 메모 아래 "지금 · …" 한 줄입니다. */
  readonly noteNow: string | null;
  readonly footer: FooterView;
  readonly tiroPaused: boolean;
  /**
   * 맨 아래 한 줄에서 바로 물을 수 있는지입니다. 라이브에서만 참입니다 —
   * 재생(fixture)에는 물을 곳이 없어 칸을 만들지 않고 골든 장면도 예전 그대로입니다.
   */
  readonly canAsk: boolean;
  /** 듣다가 바로 물은 것들입니다. 물은 순서이고 마지막이 가장 나중입니다. */
  readonly asks: readonly ThreadView[];
  /** 답을 기다리는 중에 밀려난 붙잡기 질문들입니다. 물어본 그 줄 옆에 그립니다(U-34). */
  readonly carried: readonly CarriedNoteView[];
}

/**
 * 밀려난 붙잡기 질문 하나를 그 줄 옆에 그리는 데 필요한 것들입니다(U-34).
 *
 * 답을 기다리는 중에 다른 문단을 누르면 앞 질문이 상태기계에서 밀려납니다. 그래도 그 질문은
 * **물어본 그 문장 옆에 그대로 남습니다** — 아래 대화 칸으로 내려가지 않습니다. 답이 늦게
 * 와도 버리지 않고 이 자리에서 채웁니다(REQ-11).
 */
export interface CarriedNoteView {
  readonly questionId: Id;
  readonly lineId: string;
  readonly term: string;
  readonly time: string;
  /** 답이 왔으면 한 줄 결론, 아직이면 null 입니다. */
  readonly conclusion: string | null;
  /** 결론 아래에 그릴 답 본문 첫 문단입니다(U-33 과 같은 규칙). */
  readonly body: string | null;
  readonly evidence: readonly EvidenceItem[];
  /** 기다리는 동안 흐르는 조각입니다. 답이 왔거나 한 조각도 안 왔으면 null 입니다. */
  readonly stream: AnswerStreamView | null;
  /** 튜터가 멈췄을 때의 안내 문구입니다. 그 밖에는 null 입니다. */
  readonly failure: string | null;
}

/** 자세히 화면에서 이어 물은 한 줄입니다(질문 → 대기 · 답 · 실패). */
export interface ThreadView {
  readonly id: string;
  /** 화면에 보일 질문 줄입니다. */
  readonly question: string;
  readonly time: string;
  /** 아직 답을 기다리는 중입니다. */
  readonly loading: boolean;
  /** 기다리는 동안 흐르는 조각입니다. 다 왔거나 아직 한 조각도 안 왔으면 null 입니다. */
  readonly stream: AnswerStreamView | null;
  readonly conclusion: string;
  readonly evidence: readonly EvidenceItem[];
  /** 튜터가 멈췄을 때의 안내 문구입니다. 그 밖에는 null 입니다. */
  readonly failure: string | null;
}

export interface DetailView {
  /** 이 화면이 보고 있는 붙잡은 순간의 질문 id 입니다. 이어 묻기가 이 id 에 매답니다. */
  readonly questionId: Id;
  readonly term: string;
  readonly time: string;
  readonly line: TranscriptLine | null;
  readonly marked: readonly string[];
  readonly loading: boolean;
  readonly loadingText: string;
  /** 기다리는 동안 흐르는 조각입니다. 없으면 null 입니다. */
  readonly stream: AnswerStreamView | null;
  readonly conclusion: string;
  readonly evidence: readonly EvidenceItem[];
  readonly sections: readonly AnswerSection[];
  readonly followUps: readonly FollowUp[];
  readonly reply: Reply | null;
  /** 이어 물은 후속들입니다(물은 순서). */
  readonly threads: readonly ThreadView[];
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

/**
 * 세 자료의 나이(초)입니다. 아직 온 자료가 없으면 null 입니다.
 *
 * 편집기 자리는 라이브 자리표시(`ec-live-none`)를 세지 않습니다. 자리표시의 `capturedAt` 은
 * 패널을 연 시각이라, 그대로 세면 IntelliJ 에서 아무것도 오지 않았는데 바닥줄이 "IntelliJ 0초 전"
 * 이라고 말합니다. 같은 화면 메모(`preparingSources`)는 봉인의 `editorSec = null` 을 읽어 "—" 를
 * 보이므로 서로 어긋나기도 합니다.
 */
export function sourceAges(bundle: GoldenBundle, nowMs: number): Record<(typeof SOURCE_ORDER)[number], number | null> {
  const age = (ms: number | null): number | null => (ms === null ? null : Math.floor((nowMs - ms) / 1_000));
  const editorArrived = bundle.editor.id !== LIVE_EDITOR_PLACEHOLDER_ID;
  return {
    tiro: age(latestMs(bundle.transcript.map((s) => ({ at: parseIso(s.arrivedAt) })), nowMs)),
    meet: age(latestMs(bundle.frames.map((f) => ({ at: parseIso(f.capturedAt) })), nowMs)),
    intellij: editorArrived ? age(latestMs([{ at: parseIso(bundle.editor.capturedAt) }], nowMs)) : null,
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

/**
 * 사용자가 고른 수업 화면이 안 찍히고 있는지와 그 까닭입니다. 멀쩡하면 null 입니다.
 *
 * 상태 낱말은 상태기계가 들고 있지만(`connectors`) **까닭**은 들고 있지 않아서, 마지막
 * `connector.status {meet-tab}` 사건에서 직접 꺼냅니다. 이 한 낱말이 있어야 바닥줄이
 * "왜" 를 말할 수 있습니다 — 2026-09-03 에는 하루 종일 0장이었는데 화면에 `—` 만 떴습니다.
 */
function screenTrouble(state: ReplayState): { state: string; reason: string | null } | null {
  const status = state.machine.connectors["meet-tab"];
  if (status === undefined || status === "connected") return null;
  let reason: string | null = null;
  for (const event of state.received) {
    if (event.type !== "connector.status") continue;
    if (event.payload["connector"] !== "meet-tab") continue;
    const value = event.payload["reason"];
    reason = typeof value === "string" && value.length > 0 ? value : null;
  }
  return { state: status, reason };
}

/**
 * 화면을 못 찍는 까닭 낱말 → 학습자가 읽을 한 줄입니다.
 *
 * 낱말은 `src/capture/snapshot.ts` 의 `SnapshotFailure` 여섯 가지입니다. 모르는 낱말이
 * 오면 지어내지 않고 일반 문장을 씁니다.
 */
const SCREEN_TROUBLE_LINE: Readonly<Record<string, string>> = {
  "no-lesson-tab": "수업 화면 탭을 아직 안 골랐어요. 영상 탭에서 확장 아이콘을 눌러 주세요.",
  "no-permission": "이 탭은 찍을 권한이 없어요. 영상 탭에서 확장 아이콘을 한 번 눌러 주세요.",
  "not-active": "수업 화면 탭이 그 창에서 뒤에 있어요. 앞으로 꺼내 주세요.",
  "capture-failed": "화면을 찍는 데 실패했어요.",
  "too-large": "화면이 너무 커서 담지 못했어요.",
  "host-offline": "로컬 도우미가 화면을 담지 못했어요.",
};

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

/**
 * 결론 아래에 그대로 보여 줄 답 본문의 첫 문단입니다(U-33).
 *
 * 학습자 말 그대로 「한 줄로 설명해줘서 뭐 도움이 안돼」 — 40자 결론만으로는 못 알아듣습니다.
 * 「자세히 보기」를 눌러야 나오던 `details.why` 의 첫 문단을 메모 안으로 끌어옵니다.
 * 설정 `answerLength(short|full)` 는 아직 읽는 곳이 0줄이라 이 단위는 **full 로 고정**합니다.
 * 칩이 눌려 있으면 결론 칸이 이미 그 칩의 본문이므로 겹쳐 쓰지 않습니다.
 */
export function noteBody(answer: Answer, chip: string | null): string | null {
  if (chip !== null) return null;
  const why = answer.details?.why;
  if (why === undefined) return null;
  return firstParagraph(why);
}

/** 빈 줄로 나뉜 첫 덩어리입니다. 빈 줄이 없으면 글 전체가 한 문단입니다. */
function firstParagraph(text: string): string | null {
  const first = text.split(/\n\s*\n/)[0]?.trim() ?? "";
  return first === "" ? null : first;
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
  const screenAge = ages?.screenSec ?? null;
  const editorAge = ages?.editorSec ?? null;
  return [
    { key: "tiro", state: paused ? "paused" : "live", label: paused ? "전사 멈춤" : `전사 ${formatAgo(tiroAge)}` },
    { key: "meet", state: "live", label: `화면 ${formatAgo(screenAge)}` },
    { key: "intellij", state: "live", label: `${file} ${formatAgo(editorAge)}` },
  ];
}

/**
 * 그 질문에 지금 흐르고 있는 조각입니다. 없으면 null 입니다.
 *
 * 스토어가 답 사건이 오는 순간 그 칸을 비우므로(`ReplayStore#clearDelta`), 답이 온 질문은
 * 여기서 언제나 null 입니다 — 조각과 다 쓴 답이 한 화면에 겹치는 길이 없습니다.
 */
export function streamOf(state: ReplayState, questionId: Id | null): AnswerStreamView | null {
  if (questionId === null) return null;
  const delta = state.deltas[questionId];
  if (delta === undefined) return null;
  return { text: delta.text ?? null, chars: delta.chars };
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
        // 짐작은 스토어가 붙잡는 순간에 만들어 둡니다(재생은 fixture 의 것, 라이브는 그 문장에서 만든 것).
        options: state.choosing.options.map((guess) => ({ id: guess.id, label: guess.label })),
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
      stream: streamOf(state, state.machine.questionId),
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
    body: noteBody(answer, state.chip),
    evidence,
    chips: answer.chips.map((label) => ({ id: chipId(label), label, selected: state.chip === chipId(label) })),
    collapseText: foldNotice(view.foldsInSec),
  };
}

/** 디자인 규칙: 메모가 떠 있으면 4줄, 아니면 5줄만 보입니다. */
// 재생(fixture) 화면은 장면 9개를 정확히 재현해야 해서 보이는 줄 수를 묶어 둡니다.
// 라이브는 다릅니다 — 학습자가 위로 올려 지난 이야기를 다시 읽어야 하므로 자르지 않습니다.
// (2026-09-03: 5줄만 남기고 위를 통째로 버리고 있어서 "올릴 게 없다"는 말이 나왔습니다.)
const VISIBLE_WITH_NOTE = 4;
const VISIBLE_WITHOUT_NOTE = 5;
/** 라이브에서 붙잡아 두는 줄 수. 한 교시 문단이 100~150개라 넉넉히 잡습니다. */
const LIVE_VISIBLE = 400;

function footerOf(bundle: GoldenBundle, state: ReplayState): FooterView {
  const ages = sourceAges(bundle, state.now);
  const paused = tiroPaused(state);
  const sources: FooterSource[] = [
    { key: "tiro", state: paused ? "paused" : "live", ago: paused ? "멈춤" : formatAgo(ages.tiro) },
    { key: "meet", state: "live", ago: formatAgo(ages.meet) },
    { key: "intellij", state: "live", ago: formatAgo(ages.intellij) },
  ];
  const screen = screenTrouble(state);
  if (screen !== null) {
    // 점 하나로도 "지금 안 찍히고 있다" 가 보이게 합니다. 아래 안내가 다른 것에 밀려도
    // 이 자리는 남습니다.
    sources[1] = { key: "meet", state: screen.state === "off" ? "off" : "paused", ago: formatAgo(ages.meet) };
  }
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
  } else if (screen !== null) {
    // 화면이 안 찍혀도 질문·전사·기록은 그대로 돕니다. 그래서 가장 낮은 자리에 둡니다 —
    // 위의 셋(제공자·전사·도우미)이 멀쩡할 때만 이 줄이 보입니다.
    warn = {
      tone: "paused",
      title: "수업 화면을 못 찍고 있어요.",
      description: `${screen.reason === null ? "" : `${SCREEN_TROUBLE_LINE[screen.reason] ?? "까닭을 알 수 없어요."} `}질문과 전사는 그대로 기록해요.`,
      action: RECONNECT_LABEL,
      reconnect: "meet-tab",
    };
  }
  return { sources, count: state.moments.length, warn };
}

/**
 * 듣는 중 화면에서 **바로 물은** 질문들이 매달리는 자리입니다.
 *
 * 스토어의 자유 질문(`ReplayStore.askTyped`)은 "어느 답에 이어 물었나" 를 부모 id 로 받습니다.
 * 그런데 듣다가 바로 묻는 것은 이어 묻기가 아니라 그 자체가 첫 질문이라 매달 답이 없습니다.
 * 그래서 교시 id 한 칸을 씁니다.
 *
 *   threads["q-…-001"]      자세히 화면에서 그 답에 이어 물은 것들
 *   threads["2026-…-p3"]    듣는 중 화면에서 그냥 물은 것들   ← 이 함수가 주는 열쇠
 *
 * 질문 id 는 `q-` 로 시작하고 교시 id 는 날짜로 시작하므로 두 칸은 겹치지 않습니다.
 * 부모가 질문이 아니어서 `askTyped` 는 앞선 결론을 못 찾고, 사람이 적은 글만 그대로 밖에
 * 나갑니다 — 이어 묻기가 아닌 첫 질문이므로 그게 맞습니다.
 */
export function listeningAskParent(bundle: GoldenBundle): Id {
  return bundle.periodId;
}

/** 듣는 중 화면(A~E · H)의 값 전부입니다. */
export function listeningView(
  bundle: GoldenBundle,
  state: ReplayState,
  allLines: readonly TranscriptLine[],
  live = false,
): ListeningView {
  const note = noteOf(bundle, state);
  const open = note.kind !== "none" && note.kind !== "collapsed";
  const keep = live ? LIVE_VISIBLE : open ? VISIBLE_WITH_NOTE : VISIBLE_WITHOUT_NOTE;
  const lines = allLines.slice(-keep);
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
    // 앞 질문의 메모가 자리를 차지하고 있을 때만 짐작을 따로 냅니다. 평상시에는 `note` 가
    // `kind: "choosing"` 으로 이미 그리고 있어서, 여기서도 내면 목록이 두 번 그려집니다.
    choosing: state.choosing === null || note.kind === "choosing" ? null : {
      lineId: state.choosing.lineId,
      time: state.choosing.time,
      options: state.choosing.options.map((guess) => ({ id: guess.id, label: guess.label })),
      value: state.choosing.guess ?? undefined,
    },
    active: moment !== null && open && moment.segKey !== null ? moment.segKey : undefined,
    marked: state.moments.flatMap((item) => (item.segKey === null ? [] : [item.segKey])),
    note,
    noteNow: note.kind === "ready" && answer?.nowLine !== undefined ? answer.nowLine : null,
    footer: footerOf(bundle, state),
    tiroPaused: paused,
    canAsk: state.live,
    asks: threadsOf(bundle, state, listeningAskParent(bundle)),
    carried: carriedOf(bundle, state),
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
      caption: `화면 · ${file}`,
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
 * 자세히 화면의 후속 칩입니다.
 *
 *     재생(fixture)  더 쉽게 · 왜 필요한데? · 방금 내용 (fixture 의 details 로 그 자리에서 답합니다)
 *     라이브         위 셋 + **모델이 답에 실어 준 칩**(`answer.chips`) — 누르면 그 문장을 그대로 묻습니다
 *
 * 지난 순간(기록에서 연 것)에는 칩을 두지 않습니다. 칩 답은 상태기계가 든 답으로 만드는데,
 * 지난 순간에 붙이면 엉뚱한 답이 옵니다. 이어 묻기(맨 아래 입력창)는 지난 순간에도 됩니다.
 */
function followUpsOf(state: ReplayState, answer: Answer | null, current: boolean): FollowUp[] {
  if (!current) return [];
  if (!state.live || answer === null) return [...FOLLOW_UPS];
  const fromModel = answer.chips.map<FollowUp>((label, index) => ({
    id: `${MODEL_CHIP_PREFIX}${index}`,
    label,
  }));
  return [...FOLLOW_UPS, ...fromModel];
}

/**
 * 밀려난 붙잡기 질문들을 그 줄 옆 메모로 만듭니다(U-34). 밀려난 순서입니다.
 *
 * 답은 `answerOfQuestion` 이 **도착한 사건에서만** 찾습니다. 기계는 이 질문을 이미 놓았으므로
 * `machine.answerId` 로는 못 찾습니다 — 그것이 이 자리가 따로 필요한 까닭입니다.
 */
function carriedOf(bundle: GoldenBundle, state: ReplayState): CarriedNoteView[] {
  return state.carried.flatMap<CarriedNoteView>((questionId) => {
    const moment = state.moments.find((item) => item.questionId === questionId);
    if (moment === undefined) return [];
    const answer = answerOfQuestion(bundle, state, questionId);
    return [
      {
        questionId,
        lineId: moment.lineId,
        term: moment.term,
        time: moment.time,
        conclusion: answer?.conclusion ?? null,
        body: answer === null ? null : noteBody(answer, null),
        evidence: answer === null ? [] : evidenceOf(answer, moment),
        stream: answer === null ? streamOf(state, questionId) : null,
        failure: answer === null ? failureOf(state, questionId) : null,
      },
    ];
  });
}

/** 그 질문에 온 `answer.failed` 의 안내 문구입니다. 없으면 null 입니다. */
function failureOf(state: ReplayState, questionId: Id): string | null {
  for (let i = state.received.length - 1; i >= 0; i -= 1) {
    const event = state.received[i];
    if (event === undefined || event.type !== "answer.failed") continue;
    if (event.payload["questionId"] !== questionId) continue;
    const message = event.payload["message"];
    return typeof message === "string" ? message : null;
  }
  return null;
}

/** 이어 물은 후속들을 화면 줄로 만듭니다. 답이 온 줄만 결론과 근거를 답니다. */
function threadsOf(bundle: GoldenBundle, state: ReplayState, questionId: Id): ThreadView[] {
  return (state.threads[questionId] ?? []).map<ThreadView>((item) => {
    const answer = item.answerId === null ? null : (bundle.answers[item.answerId] ?? null);
    return {
      id: item.id,
      question: item.question,
      time: item.time,
      loading: item.state === "waiting",
      stream: item.state === "waiting" ? streamOf(state, item.id) : null,
      conclusion: answer?.conclusion ?? "",
      evidence: answer === null ? [] : evidenceOf(answer, null),
      failure: item.state === "failed" ? item.message : null,
    };
  });
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
    questionId,
    term: moment.term,
    time: moment.time,
    line,
    marked: moment.segKey === null ? [] : [moment.segKey],
    loading,
    loadingText:
      current && view.waiting ? "튜터가 돌아오면 여기에 나타나요 · 순간은 저장됐어요" : "한 줄로 정리하고 있어요",
    stream: loading ? streamOf(state, questionId) : null,
    conclusion: answer?.conclusion ?? "",
    evidence: answer === null ? [] : evidenceOf(answer, moment),
    sections: answer === null ? [] : sectionsOf(bundle, answer, line),
    followUps: followUpsOf(state, answer, current),
    reply: current ? state.reply : null,
    threads: threadsOf(bundle, state, questionId),
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
