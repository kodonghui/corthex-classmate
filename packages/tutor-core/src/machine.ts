// 튜터 상태기계 — 순수 리듀서입니다.
//
// 앱이 단계를 통제합니다(docs/master-prompt.md §3-4). 프롬프트 하나에 맡기지 않습니다.
//
//   CAPTURE → ANSWER_MINIMAL → EXIT_RECALL → FEEDBACK → FADE_SUPPORT → DELAYED_CHECK
//
// 이 파일은 `transition(state, input, env)` 하나만 밖으로 보여 줍니다. 부수 효과는 내지 않고
// **효과(Effect)를 데이터로 돌려주기만** 합니다. 실제로 시각을 읽고 예약을 거는 일은
// `fold-timer.ts` 의 Clock·Scheduler 를 받은 바깥쪽이 합니다.
//
// 전이는 함수 안에 흩어 두지 않고 아래 TRANSITION_TABLE 이라는 **표**에 모았습니다.
// 표에 칸이 없는 (상태, 입력) 짝은 상태를 바꾸지 않고 `ignored` 효과만 남깁니다.

import type {
  Answer,
  Id,
  PeriodId,
  Question,
  QuestionSnapshot,
  SessionEvent,
  TutorState,
} from "@classmate/contracts";

import { ANSWER_STATUS_BY_EVENT } from "./answer-flow";
import type { AnswerEventName } from "./answer-flow";
import { formatIso, KST_OFFSET_MINUTES, parseIso } from "./time";

// ─────────────────────────────────────────────────────────────────────────────
// 이름표와 상수
// ─────────────────────────────────────────────────────────────────────────────

/** 상태 순서입니다. contracts 의 TUTOR_STATES 와 같아야 합니다(시험이 맞대어 봅니다). */
export const TUTOR_STATE_ORDER = [
  "CAPTURE",
  "ANSWER_MINIMAL",
  "EXIT_RECALL",
  "FEEDBACK",
  "FADE_SUPPORT",
  "DELAYED_CHECK",
] as const satisfies readonly TutorState[];

/**
 * 세션 사건 이름 14가지입니다.
 *
 * contracts 의 `SESSION_EVENT_TYPES` 와 같은 목록이지만, 제품 코드에서는 계약을
 * `import type` 으로만 들여올 수 있어(Ajv 가 MV3 CSP 에 막힙니다) 여기에 값으로 다시 적습니다.
 * 두 목록이 어긋나지 않는지는 시험이 계약 원본과 맞대어 봅니다.
 */
export const SESSION_EVENT_TYPE_NAMES = [
  "period.started",
  "period.ended",
  "transcript.segment",
  "screen.frame",
  "editor.context",
  "question.asked",
  "answer.completed",
  "answer.queued",
  "answer.failed",
  "answer.recovered",
  "state.changed",
  "panel.opened",
  "panel.closed",
  "connector.status",
] as const satisfies readonly SessionEvent["type"][];

/** 사람이 하는 조작 6가지입니다. */
export const USER_INPUT_KINDS = ["stuck", "chip", "detail", "back", "next", "tick"] as const;

export type UserInputKind = (typeof USER_INPUT_KINDS)[number];
export type SessionEventType = SessionEvent["type"];

/** 상태기계가 받는 입력 이름 전부(사건 14 + 조작 6 = 20)입니다. */
export type InputKind = SessionEventType | UserInputKind;

export const INPUT_KINDS: readonly InputKind[] = [
  ...SESSION_EVENT_TYPE_NAMES,
  ...USER_INPUT_KINDS,
];

/** 상세가 저절로 접히는 시간(ms)입니다. 칩을 누르면 다시 이만큼입니다. */
export const FOLD_MS = 18_000;

/** "한 줄로 정리하고 있어요" 를 보여 주는 최소 시간(ms)입니다. 답이 더 빨리 와도 이만큼은 보입니다. */
export const PREP_MS = 1_600;

/**
 * 메모 한 장이 지나는 자리입니다.
 *
 *   none      아직 붙잡은 것이 없음
 *   preparing 붙잡은 직후(상태 B) · 최소 PREP_MS 동안
 *   minimal   한 줄 결론(상태 C) · 접힘 시계가 도는 중
 *   waiting   튜터가 멈춤(상태 H) · 접힘 시계 없음
 *   detail    자세히(상태 F) · 접힘 시계 멈춤
 *   folded    점선 한 줄로 접힘(상태 E) · 이때 튜터 상태는 CAPTURE 로 돌아갑니다
 */
export const NOTE_PHASES = ["none", "preparing", "minimal", "waiting", "detail", "folded"] as const;
export type NotePhase = (typeof NOTE_PHASES)[number];

/** AI 제공자 쪽 형편입니다. 계약 Answer.status 와는 다른 축입니다. */
export const PROVIDER_PHASES = ["idle", "asking", "queued", "failed"] as const;
export type ProviderPhase = (typeof PROVIDER_PHASES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// 상태 · 입력 · 효과 · 환경
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingAnswer {
  readonly answerId: Id | null;
  readonly status: Answer["status"];
}

export interface MachineState {
  /** 계약이 정한 6가지 상태 중 하나입니다. */
  readonly state: TutorState;
  /** ANSWER_MINIMAL 안쪽(그리고 접힌 뒤)의 메모 자리입니다. */
  readonly note: NotePhase;
  readonly provider: ProviderPhase;
  readonly questionId: Id | null;
  readonly answerId: Id | null;
  readonly answerStatus: Answer["status"] | null;
  /** 준비 문구를 이 시각까지는 보여 줍니다(ms). */
  readonly prepUntil: number | null;
  /** 준비 시간이 남아 아직 못 보여 준 답입니다. */
  readonly pendingAnswer: PendingAnswer | null;
  /** 접힘 만료 시각(ms)입니다. 시계가 돌지 않으면 null 입니다. */
  readonly foldDeadline: number | null;
  readonly periodEnded: boolean;
  readonly panelOpen: boolean;
  readonly lastSegmentId: Id | null;
  readonly lastFrameId: Id | null;
  readonly lastEditorId: Id | null;
  /** 커넥터 이름 → 마지막으로 알려진 형편입니다. */
  readonly connectors: Readonly<Record<string, string>>;
  /**
   * 마지막으로 본 시각(ms)입니다. **앞으로만 갑니다**(`transition` 이 강제합니다).
   *
   * 늦게 도착한 사건처럼 시각이 뒤로 가는 입력이 와도 이 값은 직전 시각에 머뭅니다.
   * `tick` 이 뒤로 가면 아예 무시하고 `ignored`(reason: `time-went-backward`)만 남깁니다.
   */
  readonly now: number;
}

export type MachineInput =
  | { readonly kind: "event"; readonly event: SessionEvent; readonly snapshot?: QuestionSnapshot }
  | {
      readonly kind: "stuck";
      readonly now: number;
      readonly questionId: Id;
      readonly questionKind: Question["kind"];
      readonly snapshot: QuestionSnapshot;
      readonly word?: string;
    }
  | { readonly kind: "chip"; readonly now: number; readonly chipId: string }
  | { readonly kind: "detail"; readonly now: number }
  | { readonly kind: "back"; readonly now: number }
  | { readonly kind: "next"; readonly now: number }
  | { readonly kind: "tick"; readonly now: number };

/** 아직 id 가 붙지 않은 세션 사건입니다. id 는 기록하는 쪽이 붙입니다. */
export type SessionEventDraft = Omit<SessionEvent, "id">;

export type Effect =
  /** 세션 기록에 이 사건을 남겨 주세요. */
  | { readonly kind: "emit"; readonly event: SessionEventDraft }
  /** 이 시각(ms)에 접힘을 걸어 주세요. 이미 걸린 예약은 대신 지웁니다. */
  | { readonly kind: "schedule"; readonly timer: "fold"; readonly at: number }
  /** 걸어 둔 접힘 예약을 지워 주세요. */
  | { readonly kind: "cancel"; readonly timer: "fold" }
  /** 이 질문을 제공자에게 물어봐 주세요. */
  | {
      readonly kind: "ask";
      readonly provider: Answer["provider"];
      readonly questionId: Id;
      readonly snapshot: QuestionSnapshot | null;
    }
  /** 표에 칸이 없거나 조건이 맞지 않아 아무것도 하지 않았습니다. */
  | {
      readonly kind: "ignored";
      readonly state: TutorState;
      readonly input: InputKind;
      /** 보통(칸 없음·조건 어긋남)에는 붙지 않습니다. 따로 알릴 까닭이 있을 때만 붙습니다. */
      readonly reason?: IgnoreReason;
    };

/** `ignored` 에 붙는 까닭입니다. */
export type IgnoreReason =
  /** 시각이 뒤로 가는 `tick` 이라 아무 일도 하지 않았습니다. */
  "time-went-backward";

export interface Env {
  readonly periodId: PeriodId;
  readonly provider: Answer["provider"];
  readonly foldMs: number;
  readonly prepMs: number;
  /** 설정의 "자동 접기" 스위치입니다. 끄면 접힘 시계를 걸지 않습니다. */
  readonly autoFold: boolean;
  readonly tzOffsetMinutes: number;
}

/** 기본값이 채워진 환경을 만듭니다. 바꾸고 싶은 자리만 넘기면 됩니다. */
export function createEnv(periodId: PeriodId, overrides: Partial<Env> = {}): Env {
  return {
    periodId,
    provider: "mock",
    foldMs: FOLD_MS,
    prepMs: PREP_MS,
    autoFold: true,
    tzOffsetMinutes: KST_OFFSET_MINUTES,
    ...overrides,
  };
}

/** 아무것도 붙잡지 않은 처음 상태입니다. */
export function initialState(now = 0): MachineState {
  return {
    state: "CAPTURE",
    note: "none",
    provider: "idle",
    questionId: null,
    answerId: null,
    answerStatus: null,
    prepUntil: null,
    pendingAnswer: null,
    foldDeadline: null,
    periodEnded: false,
    panelOpen: false,
    lastSegmentId: null,
    lastFrameId: null,
    lastEditorId: null,
    connectors: {},
    now,
  };
}

export interface TransitionResult {
  readonly next: MachineState;
  readonly effects: readonly Effect[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 전이표
// ─────────────────────────────────────────────────────────────────────────────

interface RuleContext {
  /** now 까지 시각만 앞으로 옮겨 둔 상태입니다. */
  readonly state: MachineState;
  readonly input: MachineInput;
  readonly env: Env;
  readonly now: number;
}

interface Draft {
  readonly patch?: Partial<MachineState>;
  readonly effects?: readonly Effect[];
}

export interface TransitionRule {
  /** 이 칸이 무엇을 하는지 한 줄로 적습니다. README 와 시험이 이 문구를 그대로 씁니다. */
  readonly note: string;
  /** 조건이 맞지 않으면 null 을 돌려주고, 그러면 `ignored` 로 남습니다. */
  readonly run: (ctx: RuleContext) => Draft | null;
}

export type TransitionTable = Readonly<
  Record<TutorState, Readonly<Partial<Record<InputKind, TransitionRule>>>>
>;

// --- 작은 도우미들 ------------------------------------------------------------

function asEvent(input: MachineInput): SessionEvent | null {
  return input.kind === "event" ? input.event : null;
}

function stringOf(payload: SessionEvent["payload"], key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

const CANCEL_FOLD: Effect = { kind: "cancel", timer: "fold" };

function cancelIfRunning(state: MachineState): readonly Effect[] {
  return state.foldDeadline === null ? [] : [CANCEL_FOLD];
}

/** 접힘 시계를 지금부터 다시 겁니다. 자동 접기가 꺼져 있으면 걸지 않습니다. */
function armFold(ctx: RuleContext): { deadline: number | null; effects: readonly Effect[] } {
  if (!ctx.env.autoFold) return { deadline: null, effects: [] };
  const deadline = ctx.now + ctx.env.foldMs;
  return { deadline, effects: [{ kind: "schedule", timer: "fold", at: deadline }] };
}

/** 한 줄 결론을 보여 주는 자리로 옮기고 접힘 시계를 겁니다. */
function showMinimal(ctx: RuleContext, patch: Partial<MachineState>): Draft {
  const fold = armFold(ctx);
  return {
    patch: { ...patch, note: "minimal", pendingAnswer: null, foldDeadline: fold.deadline },
    effects: fold.effects,
  };
}

/** 붙잡은 순간의 공통 처리입니다. 메모를 준비 자리로 두고 제공자에게 묻습니다. */
function catchQuestion(
  ctx: RuleContext,
  questionId: Id,
  snapshot: QuestionSnapshot | null,
  extra: readonly Effect[] = [],
): Draft {
  return {
    patch: {
      state: "ANSWER_MINIMAL",
      note: "preparing",
      provider: "asking",
      questionId,
      answerId: null,
      answerStatus: null,
      pendingAnswer: null,
      prepUntil: ctx.now + ctx.env.prepMs,
      foldDeadline: null,
    },
    effects: [
      ...cancelIfRunning(ctx.state),
      ...extra,
      { kind: "ask", provider: ctx.env.provider, questionId, snapshot },
    ],
  };
}

// --- 여러 상태가 함께 쓰는 칸 ---------------------------------------------------

const RECORD_TRANSCRIPT: TransitionRule = {
  note: "전사 조각을 받아 마지막 조각 id 만 기억합니다",
  run: ({ input }) => {
    const event = asEvent(input);
    if (event === null) return null;
    const segmentId = stringOf(event.payload, "segmentId");
    return segmentId === null ? {} : { patch: { lastSegmentId: segmentId } };
  },
};

const RECORD_FRAME: TransitionRule = {
  note: "바뀐 화면 한 장을 받아 마지막 프레임 id 만 기억합니다",
  run: ({ input }) => {
    const event = asEvent(input);
    if (event === null) return null;
    const frameId = stringOf(event.payload, "screenFrameId");
    return frameId === null ? {} : { patch: { lastFrameId: frameId } };
  },
};

const RECORD_EDITOR: TransitionRule = {
  note: "편집기 문맥을 받아 마지막 문맥 id 만 기억합니다",
  run: ({ input }) => {
    const event = asEvent(input);
    if (event === null) return null;
    const editorId = stringOf(event.payload, "editorContextId");
    return editorId === null ? {} : { patch: { lastEditorId: editorId } };
  },
};

const RECORD_CONNECTOR: TransitionRule = {
  note: "커넥터 형편을 적어 둡니다. 화면 아래 한 줄이 이것을 씁니다",
  run: ({ state, input }) => {
    const event = asEvent(input);
    if (event === null) return null;
    const connector = stringOf(event.payload, "connector");
    const connectorState = stringOf(event.payload, "state");
    if (connector === null || connectorState === null) return {};
    return { patch: { connectors: { ...state.connectors, [connector]: connectorState } } };
  },
};

const PANEL_OPENED: TransitionRule = {
  note: "사이드패널이 열렸다고 적습니다",
  run: () => ({ patch: { panelOpen: true } }),
};

const PANEL_CLOSED: TransitionRule = {
  note: "사이드패널이 닫혔다고 적습니다",
  run: () => ({ patch: { panelOpen: false } }),
};

/** ANSWER_MINIMAL 밖에서 온 답 사건입니다. 상태는 그대로 두고 진행 상태만 적습니다. */
function recordAnswer(status: Answer["status"]): TransitionRule {
  return {
    note: `답이 ${status} 로 바뀐 것만 적고 화면은 그대로 둡니다`,
    run: ({ state, input }) => {
      const event = asEvent(input);
      if (event === null) return null;
      const answerId = stringOf(event.payload, "answerId") ?? state.answerId;
      const provider: ProviderPhase =
        status === "queued" ? "queued" : status === "error" ? "failed" : "idle";
      return { patch: { answerId, answerStatus: status, provider } };
    },
  };
}

/** 사건 이름만 주면 "적기만 하는" 칸을 만듭니다. 상태 값은 계약 표에서 가져옵니다. */
function recordAnswerEvent(type: AnswerEventName): TransitionRule {
  return recordAnswer(ANSWER_STATUS_BY_EVENT[type]);
}

const PERIOD_STARTED: TransitionRule = {
  note: "새 교시가 시작되면 CAPTURE 로 돌아가 메모와 시계를 비웁니다",
  run: ({ state }) => ({
    patch: {
      state: "CAPTURE",
      note: "none",
      provider: "idle",
      questionId: null,
      answerId: null,
      answerStatus: null,
      prepUntil: null,
      pendingAnswer: null,
      foldDeadline: null,
      periodEnded: false,
      lastSegmentId: null,
      lastFrameId: null,
      lastEditorId: null,
    },
    effects: cancelIfRunning(state),
  }),
};

const TICK_IDLE: TransitionRule = {
  note: "시계만 앞으로 옮깁니다. 이 상태에는 만료될 시계가 없습니다",
  run: () => ({}),
};

/** 교시 뒤 화면에서 "그만할래요" 로 조용한 기록으로 돌아갑니다. */
const BACK_TO_CAPTURE: TransitionRule = {
  note: "CAPTURE(조용한 기록)로 돌아갑니다",
  run: () => ({ patch: { state: "CAPTURE", note: "none" } }),
};

/** 교시 뒤 단계를 하나 넘깁니다. */
function nextStage(to: TutorState): TransitionRule {
  return {
    note: `이 단계를 마치고 ${to} 로 넘어갑니다`,
    run: () => ({ patch: { state: to, note: "none" } }),
  };
}

// --- CAPTURE ------------------------------------------------------------------

const CAPTURE_RULES: Partial<Record<InputKind, TransitionRule>> = {
  "period.started": PERIOD_STARTED,
  "period.ended": {
    note: "교시가 끝났다고 적습니다. 상태는 그대로 두고 EXIT_RECALL 은 사람이 시작합니다",
    run: ({ state }) => ({
      patch: { periodEnded: true, foldDeadline: null },
      effects: cancelIfRunning(state),
    }),
  },
  "transcript.segment": RECORD_TRANSCRIPT,
  "screen.frame": RECORD_FRAME,
  "editor.context": RECORD_EDITOR,
  "question.asked": {
    note: "단어를 붙잡았습니다. ANSWER_MINIMAL 로 가서 준비 문구를 보여 주고 제공자에게 묻습니다",
    run: (ctx) => {
      const event = asEvent(ctx.input);
      if (event === null) return null;
      const questionId = stringOf(event.payload, "questionId");
      if (questionId === null) return null;
      const snapshot = ctx.input.kind === "event" ? (ctx.input.snapshot ?? null) : null;
      return catchQuestion(ctx, questionId, snapshot);
    },
  },
  "answer.completed": recordAnswerEvent("answer.completed"),
  "answer.queued": recordAnswerEvent("answer.queued"),
  "answer.failed": recordAnswerEvent("answer.failed"),
  "answer.recovered": recordAnswerEvent("answer.recovered"),
  "panel.opened": PANEL_OPENED,
  "panel.closed": PANEL_CLOSED,
  "connector.status": RECORD_CONNECTOR,
  stuck: {
    note: "전사 없이 붙잡기 버튼으로 붙잡았습니다. question.asked 를 기록에 남기고 묻습니다",
    run: (ctx) => {
      if (ctx.input.kind !== "stuck") return null;
      const { questionId, questionKind, snapshot, word } = ctx.input;
      const draft: SessionEventDraft = {
        periodId: ctx.env.periodId,
        at: formatIso(ctx.now, ctx.env.tzOffsetMinutes),
        type: "question.asked",
        payload: {
          questionId,
          kind: questionKind,
          ...(word === undefined ? {} : { word }),
        },
      };
      return catchQuestion(ctx, questionId, snapshot, [{ kind: "emit", event: draft }]);
    },
  },
  detail: {
    note: "접힌 메모를 다시 펴면 ANSWER_MINIMAL 로 돌아가고 접힘 시계를 다시 겁니다",
    run: (ctx) => {
      if (ctx.state.note !== "folded" || ctx.state.questionId === null) return null;
      return showMinimal(ctx, { state: "ANSWER_MINIMAL" });
    },
  },
  next: {
    note: "교시가 끝난 뒤에만 EXIT_RECALL(회상 3분)로 넘어갑니다",
    run: ({ state }) => (state.periodEnded ? { patch: { state: "EXIT_RECALL", note: "none" } } : null),
  },
  tick: TICK_IDLE,
};

// --- ANSWER_MINIMAL -----------------------------------------------------------

/** 답이 도착했을 때 준비 시간이 남았으면 붙들어 두고, 지났으면 바로 보여 줍니다. */
function landAnswer(ctx: RuleContext, status: Answer["status"], answerId: Id | null): Draft {
  const base: Partial<MachineState> = {
    answerId: answerId ?? ctx.state.answerId,
    answerStatus: status,
    provider: "idle",
  };
  if (ctx.state.prepUntil !== null && ctx.now < ctx.state.prepUntil) {
    return {
      patch: { ...base, pendingAnswer: { answerId, status } },
    };
  }
  return showMinimal(ctx, base);
}

const ANSWER_MINIMAL_RULES: Partial<Record<InputKind, TransitionRule>> = {
  "period.started": PERIOD_STARTED,
  "period.ended": {
    note: "교시가 끝나면 메모를 접고 CAPTURE 로 돌아갑니다",
    run: ({ state }) => ({
      patch: { state: "CAPTURE", note: "folded", foldDeadline: null, periodEnded: true },
      effects: cancelIfRunning(state),
    }),
  },
  "transcript.segment": RECORD_TRANSCRIPT,
  "screen.frame": RECORD_FRAME,
  "editor.context": RECORD_EDITOR,
  "question.asked": {
    note: "메모가 떠 있는 채로 또 붙잡았습니다. 상태는 그대로고 새 질문으로 갈아탑니다",
    run: (ctx) => {
      const event = asEvent(ctx.input);
      if (event === null) return null;
      const questionId = stringOf(event.payload, "questionId");
      if (questionId === null) return null;
      const snapshot = ctx.input.kind === "event" ? (ctx.input.snapshot ?? null) : null;
      return catchQuestion(ctx, questionId, snapshot);
    },
  },
  "answer.completed": {
    note: "답이 왔습니다. 준비 시간이 지났으면 한 줄 결론을 보이고 18초 시계를 겁니다",
    run: (ctx) => {
      const event = asEvent(ctx.input);
      if (event === null) return null;
      return landAnswer(
        ctx,
        ANSWER_STATUS_BY_EVENT["answer.completed"],
        stringOf(event.payload, "answerId"),
      );
    },
  },
  "answer.recovered": {
    note: "멈췄던 답이 돌아왔습니다. 한 줄 결론을 보이고 18초 시계를 겁니다",
    run: (ctx) => {
      const event = asEvent(ctx.input);
      if (event === null) return null;
      return landAnswer(
        ctx,
        ANSWER_STATUS_BY_EVENT["answer.recovered"],
        stringOf(event.payload, "answerId"),
      );
    },
  },
  "answer.failed": {
    note: "튜터가 멈췄습니다. 대기 문구로 바꾸고 접힘 시계를 멈춥니다",
    run: (ctx) => {
      const event = asEvent(ctx.input);
      if (event === null) return null;
      return {
        patch: {
          note: "waiting",
          provider: "failed",
          answerStatus: ANSWER_STATUS_BY_EVENT["answer.failed"],
          pendingAnswer: null,
          foldDeadline: null,
        },
        effects: cancelIfRunning(ctx.state),
      };
    },
  },
  "answer.queued": {
    note: "답이 대기 줄에 남았습니다. 순간은 저장됐다는 문구를 보이고 기다립니다",
    run: (ctx) => {
      const event = asEvent(ctx.input);
      if (event === null) return null;
      const answerId = stringOf(event.payload, "answerId") ?? ctx.state.answerId;
      return {
        patch: {
          note: "waiting",
          provider: "queued",
          answerId,
          answerStatus: ANSWER_STATUS_BY_EVENT["answer.queued"],
          pendingAnswer: null,
          foldDeadline: null,
        },
        effects: cancelIfRunning(ctx.state),
      };
    },
  },
  "panel.opened": PANEL_OPENED,
  "panel.closed": PANEL_CLOSED,
  "connector.status": RECORD_CONNECTOR,
  stuck: {
    note: "메모가 떠 있는 채로 붙잡기 버튼을 눌렀습니다. 새 질문으로 갈아탑니다",
    run: (ctx) => {
      if (ctx.input.kind !== "stuck") return null;
      const { questionId, questionKind, snapshot, word } = ctx.input;
      const draft: SessionEventDraft = {
        periodId: ctx.env.periodId,
        at: formatIso(ctx.now, ctx.env.tzOffsetMinutes),
        type: "question.asked",
        payload: {
          questionId,
          kind: questionKind,
          ...(word === undefined ? {} : { word }),
        },
      };
      return catchQuestion(ctx, questionId, snapshot, [{ kind: "emit", event: draft }]);
    },
  },
  chip: {
    note: "칩을 누르면 내용이 그 자리에서 바뀌고 접힘 시계가 18초로 되돌아갑니다",
    run: (ctx) => {
      // 칩은 한 줄 결론 자리에만 뜹니다. 준비·대기·자세히에서는 다른 조건부 칸과 똑같이
      // null 을 돌려주어 `ignored` 로 남깁니다(빈 Draft 를 돌려주면 기록에 흔적이 없습니다).
      if (ctx.state.note !== "minimal") return null;
      const fold = armFold(ctx);
      return { patch: { foldDeadline: fold.deadline }, effects: fold.effects };
    },
  },
  detail: {
    note: "자세히를 열면 접힘 시계를 멈춥니다",
    run: (ctx) => {
      if (ctx.state.questionId === null) return null;
      return { patch: { note: "detail", foldDeadline: null }, effects: cancelIfRunning(ctx.state) };
    },
  },
  back: {
    note: "자세히에서는 한 줄 결론으로 돌아가 18초를 다시 세고, 한 줄 결론에서는 접고 CAPTURE 로 갑니다",
    run: (ctx) => {
      if (ctx.state.note === "detail") {
        if (ctx.state.provider === "queued" || ctx.state.provider === "failed") {
          return { patch: { note: "waiting", foldDeadline: null } };
        }
        return showMinimal(ctx, {});
      }
      return {
        patch: { state: "CAPTURE", note: "folded", foldDeadline: null },
        effects: cancelIfRunning(ctx.state),
      };
    },
  },
  tick: {
    note: "준비 시간이 지나면 붙들어 둔 답을 보이고, 18초가 지나면 접고 CAPTURE 로 갑니다",
    run: (ctx) => {
      const { state, now } = ctx;
      const prepDone = state.prepUntil !== null && now >= state.prepUntil;
      if (prepDone && state.pendingAnswer !== null) {
        const pending = state.pendingAnswer;
        return showMinimal(ctx, {
          answerId: pending.answerId ?? state.answerId,
          answerStatus: pending.status,
          provider: "idle",
        });
      }
      if (state.foldDeadline !== null && now >= state.foldDeadline) {
        return { patch: { state: "CAPTURE", note: "folded", foldDeadline: null } };
      }
      return {};
    },
  },
};

// --- 교시 뒤 네 상태 ------------------------------------------------------------

/** EXIT_RECALL · FEEDBACK · FADE_SUPPORT · DELAYED_CHECK 가 함께 쓰는 칸입니다. */
function afterPeriodRules(next: TutorState): Partial<Record<InputKind, TransitionRule>> {
  return {
    "period.started": PERIOD_STARTED,
    "transcript.segment": RECORD_TRANSCRIPT,
    "screen.frame": RECORD_FRAME,
    "editor.context": RECORD_EDITOR,
    "answer.completed": recordAnswer("answered"),
    "answer.queued": recordAnswer("queued"),
    "answer.failed": recordAnswer("error"),
    "answer.recovered": recordAnswer("recovered"),
    "panel.opened": PANEL_OPENED,
    "panel.closed": PANEL_CLOSED,
    "connector.status": RECORD_CONNECTOR,
    back: BACK_TO_CAPTURE,
    next: nextStage(next),
    tick: TICK_IDLE,
  };
}

const EXIT_RECALL_ONLY: Partial<Record<InputKind, TransitionRule>> = {
  "question.asked": {
    note: "회상 중에 남은 질문 하나를 붙잡습니다. 화면은 그대로 두고 묻기만 합니다",
    run: (ctx) => {
      const event = asEvent(ctx.input);
      if (event === null) return null;
      const questionId = stringOf(event.payload, "questionId");
      if (questionId === null) return null;
      const snapshot = ctx.input.kind === "event" ? (ctx.input.snapshot ?? null) : null;
      return {
        patch: { questionId, provider: "asking" },
        effects: [{ kind: "ask", provider: ctx.env.provider, questionId, snapshot }],
      };
    },
  },
  stuck: {
    note: "회상 중에 붙잡기 버튼으로 남은 질문을 묻습니다",
    run: (ctx) => {
      if (ctx.input.kind !== "stuck") return null;
      const { questionId, questionKind, snapshot, word } = ctx.input;
      const draft: SessionEventDraft = {
        periodId: ctx.env.periodId,
        at: formatIso(ctx.now, ctx.env.tzOffsetMinutes),
        type: "question.asked",
        payload: {
          questionId,
          kind: questionKind,
          ...(word === undefined ? {} : { word }),
        },
      };
      return {
        patch: { questionId, provider: "asking" },
        effects: [
          { kind: "emit", event: draft },
          { kind: "ask", provider: ctx.env.provider, questionId, snapshot },
        ],
      };
    },
  },
};

/**
 * (상태 × 입력) 표입니다. 칸이 없으면 무시하고 `ignored` 효과만 남깁니다.
 * 칸이 있어도 조건이 맞지 않으면(run 이 null) 마찬가지로 무시합니다.
 */
export const TRANSITION_TABLE: TransitionTable = {
  CAPTURE: CAPTURE_RULES,
  ANSWER_MINIMAL: ANSWER_MINIMAL_RULES,
  EXIT_RECALL: { ...afterPeriodRules("FEEDBACK"), ...EXIT_RECALL_ONLY },
  FEEDBACK: afterPeriodRules("FADE_SUPPORT"),
  FADE_SUPPORT: afterPeriodRules("DELAYED_CHECK"),
  DELAYED_CHECK: afterPeriodRules("CAPTURE"),
};

/** 그 칸이 표에 있는지 봅니다. 시험이 전이표를 전수로 훑을 때 씁니다. */
export function hasRule(state: TutorState, input: InputKind): boolean {
  return TRANSITION_TABLE[state][input] !== undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// 리듀서
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 입력의 시각을 읽을 수 없을 때 냅니다.
 *
 * 조용히 직전 시각으로 넘어가면 그 잘못된 시각이 `state.changed` 의 `at` 과 접힘 예약에
 * 그대로 실려 영구 기록에 남습니다. `time.ts` 의 `parseIso` 가 0 을 돌려주지 않고 예외를
 * 던지는 것과 같은 취지입니다.
 */
export class MachineError extends Error {
  /** 문제가 된 입력의 이름입니다. */
  readonly input: InputKind;

  constructor(message: string, input: InputKind) {
    super(message);
    this.name = "MachineError";
    this.input = input;
  }
}

/** 입력의 이름을 뽑습니다. 사건이면 사건 이름, 조작이면 조작 이름입니다. */
export function inputKindOf(input: MachineInput): InputKind {
  return input.kind === "event" ? input.event.type : input.kind;
}

/**
 * 입력이 가리키는 시각(ms)입니다. 사건은 자기 `at`, 조작은 넣어 준 `now` 를 씁니다.
 *
 * 읽을 수 없으면 `MachineError` 를 던집니다. 삼키지 않습니다.
 *   - 사건의 `at` 이 ISO-8601 이 아님(`parseIso` 가 던진 예외를 그대로 올립니다)
 *   - 조작의 `now` 가 유한한 수가 아님(NaN · Infinity)
 */
export function inputTimeOf(input: MachineInput): number {
  if (input.kind !== "event") {
    if (!Number.isFinite(input.now)) {
      throw new MachineError(`조작 ${input.kind} 의 now 가 시각이 아닙니다: ${input.now}`, input.kind);
    }
    return input.now;
  }
  try {
    return parseIso(input.event.at);
  } catch {
    throw new MachineError(
      `사건 ${input.event.type} 의 at 을 읽을 수 없습니다: ${String(input.event.at)}`,
      input.event.type,
    );
  }
}

/**
 * 상태를 한 칸 옮깁니다. 순수 함수라 같은 입력이면 언제나 같은 결과입니다.
 *
 *     const { next, effects } = transition(state, { kind: "tick", now }, env);
 *
 * 상태 이름이 바뀌면 `state.changed` 사건 초안을 **효과 맨 앞에** 자동으로 넣습니다.
 * 규칙이 깜빡해도 기록이 비지 않게 하려는 것입니다.
 *
 * 시각 규칙 두 가지는 README §입력 규칙과 같습니다.
 *   - 입력의 시각을 읽을 수 없으면 `MachineError` 를 던집니다.
 *   - `state.now` 는 뒤로 가지 않습니다. 뒤로 가는 `tick` 은 통째로 무시합니다.
 */
export function transition(state: MachineState, input: MachineInput, env: Env): TransitionResult {
  const kind = inputKindOf(input);
  const at = inputTimeOf(input);

  // 뒤로 가는 tick 은 시계를 되돌릴 뿐 새로 알려 주는 것이 없어 통째로 무시합니다.
  if (input.kind === "tick" && at < state.now) {
    return {
      next: state,
      effects: [{ kind: "ignored", state: state.state, input: kind, reason: "time-went-backward" }],
    };
  }

  // 늦게 도착한 사건도 시계를 되돌리지는 못합니다. 사건 자체는 그대로 처리합니다.
  const now = Math.max(state.now, at);
  const moved: MachineState = { ...state, now };
  const ignored: Effect = { kind: "ignored", state: state.state, input: kind };

  const rule = TRANSITION_TABLE[state.state][kind];
  if (rule === undefined) {
    return { next: moved, effects: [ignored] };
  }

  const draft = rule.run({ state: moved, input, env, now });
  if (draft === null) {
    return { next: moved, effects: [ignored] };
  }

  const next: MachineState = { ...moved, ...(draft.patch ?? {}) };
  const ruleEffects = draft.effects ?? [];
  if (next.state === state.state) {
    return { next, effects: [...ruleEffects] };
  }

  const changed: Effect = {
    kind: "emit",
    event: {
      periodId: env.periodId,
      at: formatIso(now, env.tzOffsetMinutes),
      type: "state.changed",
      payload: { from: state.state, to: next.state },
    },
  };
  return { next, effects: [changed, ...ruleEffects] };
}

/** 입력을 순서대로 흘려보냅니다. 효과는 나온 순서대로 이어 붙입니다. */
export function runAll(
  state: MachineState,
  inputs: readonly MachineInput[],
  env: Env,
): { next: MachineState; effects: Effect[] } {
  let current = state;
  const effects: Effect[] = [];
  for (const input of inputs) {
    const result = transition(current, input, env);
    current = result.next;
    effects.push(...result.effects);
  }
  return { next: current, effects };
}
