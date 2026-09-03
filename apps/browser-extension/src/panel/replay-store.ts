// 사이드패널의 머리 — tutor-core 상태기계를 fixture 사건으로 굴리는 재생기입니다.
//
//   fixture 사건(session-events.jsonl) ──┐
//   화면 손짓(낱말 누름 · 칩 · 자세히 · 뒤로) ──┼──▶ transition() ──▶ MachineState ──▶ 화면(lesson-view)
//   1초 tick ────────────────────────────┘             │
//                                                      └─▶ effects: emit(기록) · ask(모의 제공자)
//
// 규칙:
//  - 상태기계는 `@classmate/tutor-core` 의 것을 그대로 쓰고, 여기서는 입력을 만들고 효과를 처리만 합니다.
//  - fixture 의 `state.changed` 줄은 기계가 스스로 내야 할 답이므로 입력으로 넣지 않습니다.
//  - `ask` 효과는 fixture 가 답 사건을 함께 실은 질문(q-p3-*)이면 무시하고, 화면에서 새로 붙잡은
//    질문(q-panel-*)이면 모의 제공자가 그 낱말의 fixture 답을 2초 뒤 `answer.completed` 로 돌려줍니다.
//  - 브라우저 API 를 쓰지 않습니다. 시계는 `advanceTo` 로만 갑니다(화면이 1초마다 밀어 줍니다).
//
// ── 모드 두 가지 ──────────────────────────────────────────────────────────────
//
//   재생(replay)   `new ReplayStore(GOLDEN_BUNDLE)` — fixture 를 시각순으로 흘립니다. 위 그림 그대로.
//   라이브(live)   `ReplayStore.live({ periodId, startMs, askPort })` — **빈 번들**로 시작해
//                  밖에서 들어오는 자료를 번들에 채워 넣습니다.
//
//     service worker ──pushSegment · pushFrame · pushEditor · pushEvent──▶ ReplayStore
//                                                                            │ 번들 채움
//                                                                            ▼
//                                                             lesson-view (한 줄도 안 고침)
//     ReplayStore ──ask 효과──▶ AskPort.ask(...)  ──▶ 바깥 제공자
//     ReplayStore ──emit 효과──▶ subscribeEmitted(listener) ──▶ 세션 기록
//
// 라이브 모드에서 60초 안에 답이 안 오면 스토어가 스스로 `answer.failed` 를 넣어 화면을
// 대기(H) 로 보냅니다. tutor-core 는 `answer.failed` 하나로 note 를 `waiting` 으로 옮기므로
// fixture 처럼 `answer.queued` 를 뒤따라 붙이지 않아도 H 가 됩니다(`ANSWER_MINIMAL_RULES`).

import type {
  Answer,
  EditorContext,
  Id,
  IsoDateTime,
  PeriodId,
  Question,
  QuestionSnapshot,
  ScreenFrame,
  SessionEvent,
  TranscriptSegment,
} from "@classmate/contracts";
import type { Effect, Env, MachineInput, MachineState } from "@classmate/tutor-core";
import { createEnv, formatIso, initialState, parseIso, sealSnapshot, transition } from "@classmate/tutor-core";

import { atClock, clockOfIso, clockOfMs } from "./clock";
import { makeIdToken, panelEventId, panelQuestionId } from "./event-ids";
import type { GoldenBundle } from "./golden-bundle";
import { emptyBundle, GOLDEN_TERMS, guessesForLine } from "./golden-bundle";
import type { AskPort, AskRequest, PanelInbox, PanelOutbox } from "./ports";
import { segmentKeyOfWord, toTranscriptLines } from "./transcript-lines";

export type Screen = "home" | "detail";

/** 붙잡은 순간 하나. 어느 줄의 어느 낱말을 언제 붙잡았는지입니다. */
export interface Moment {
  readonly questionId: Id;
  readonly lineId: Id;
  readonly term: string;
  /** "10:32:18" */
  readonly time: string;
  /** TranscriptFlow 의 `<줄 id>:<조각 번호>`. 문장을 통째로 붙잡았으면 null 입니다. */
  readonly segKey: string | null;
  readonly ages: QuestionSnapshot["ages"];
}

/** 문장을 통째로 붙잡아 "혹시 이게 막혔나요?" 를 고르는 중입니다(디자인 상태 D). */
export interface Choosing {
  readonly lineId: Id;
  readonly time: string;
  readonly guess: string | null;
}

/** 자세히 화면에서 후속 칩을 눌러 받은 답 한 덩어리입니다. */
export interface Reply {
  readonly q: string;
  readonly a: string;
  readonly reason: string;
}

export interface ReplayState {
  readonly machine: MachineState;
  /** 재생기의 시계(ms). 기계의 `now` 와 같거나 앞섭니다. */
  readonly now: number;
  readonly screen: Screen;
  readonly moments: readonly Moment[];
  readonly choosing: Choosing | null;
  /** 지금 메모에서 고른 칩 id. 없으면 null 입니다. */
  readonly chip: string | null;
  readonly reply: Reply | null;
  /** 기계가 기록에 남기라고 한 사건(emit)입니다. id 는 여기서 붙입니다. */
  readonly emitted: readonly SessionEvent[];
  /** 밖에서 들어온 사건 전부입니다(fixture · 모의 제공자). */
  readonly received: readonly SessionEvent[];
}

/** 골든 시나리오 체크포인트 9개. E2E 가 이 순서로 스크린샷을 찍습니다. */
export const CHECKPOINTS = [
  "listening",
  "caught",
  "sentence",
  "answer",
  "detail",
  "returned",
  "folded",
  "waiting",
  "recovered",
] as const;

export type Checkpoint = (typeof CHECKPOINTS)[number];

export const CHECKPOINT_LABEL: Readonly<Record<Checkpoint, string>> = {
  listening: "A 듣는 중 (CAPTURE)",
  caught: "B 붙잡은 직후 (ANSWER_MINIMAL · preparing)",
  sentence: "D 문장을 붙잡음 (혹시 이게 막혔나요?)",
  answer: "C 한 줄 답변 (ANSWER_MINIMAL · minimal)",
  detail: "F 자세히 (상세 펼침)",
  returned: "수업으로 돌아가기 (다시 minimal · 18초)",
  folded: "E 접힌 메모 (CAPTURE · folded)",
  waiting: "H 튜터 멈춤 → 대기 (answer.failed · answer.queued)",
  recovered: "복구 (answer.recovered · minimal)",
};

/** 답이 60초 안 오면 스토어가 스스로 넣는 `answer.failed` 의 문구입니다(계약 (라) 그대로). */
export const ASK_TIMEOUT_MESSAGE =
  "튜터 답변이 잠시 멈췄어요. 수업 기록과 질문 지점은 계속 저장하고 있어요. 연결되면 설명을 완성해 둘게요.";

/** 질문 뒤 이만큼(ms) 답이 없으면 튜터가 멈춘 것으로 봅니다. */
export const ASK_TIMEOUT_MS = 60_000;

/** 라이브 모드 설정입니다. `ReplayStore.live()` 가 채워 넣습니다. */
export interface LiveConfig {
  /** 라이브 스토어의 0초입니다(보통 `Date.now()`). */
  readonly startMs: number;
  /** 질문을 밖으로 보내는 출구입니다. 없으면 아무 데도 묻지 않고 워치독만 돕니다. */
  readonly askPort?: AskPort;
  /** `tick()` 이 읽는 시계입니다. 기본은 `Date.now`, 시험은 가짜 시계를 넣습니다. */
  readonly now?: () => number;
  /** id 토큰을 고정합니다. 비우면 `crypto.randomUUID` 앞 8글자입니다. */
  readonly idToken?: string;
  /** 워치독 시간(ms)입니다. 기본 `ASK_TIMEOUT_MS`. */
  readonly askTimeoutMs?: number;
}

export interface ReplayStoreOptions {
  readonly env?: Partial<Env>;
  /** 화면에서 새로 붙잡은 질문에 모의 제공자가 답을 돌려주기까지의 시간(ms)입니다. */
  readonly mockAnswerDelayMs?: number;
  /** 있으면 라이브 모드입니다. 손으로 넣지 말고 `ReplayStore.live()` 를 쓰세요. */
  readonly live?: LiveConfig;
}

/** `ReplayStore.live()` 가 받는 값입니다. */
export interface LiveStoreOptions {
  readonly periodId: PeriodId;
  readonly startMs: number;
  readonly askPort?: AskPort;
  /** 헤더 제목입니다. `period.started` 가 오면 그것으로 덮습니다. */
  readonly subject?: string;
  readonly env?: Partial<Env>;
  readonly now?: () => number;
  readonly idToken?: string;
  readonly askTimeoutMs?: number;
}

/** 수업 중에 바꿀 수 있는 환경 값입니다. `updateEnv` 가 받습니다. */
export type EnvUpdate = Partial<Pick<Env, "provider" | "autoFold">>;

export type Listener = () => void;
export type EmitListener = (event: SessionEvent) => void;

/** 붙잡은 질문 하나를 밖에 물을 때 쓸 문구입니다. `ask` 효과가 올 때 꺼내 씁니다. */
interface AskDraft {
  readonly kind: string;
  readonly question: string;
  readonly word?: string;
}

/** 답 사건 네 가지입니다. 이 사건이 오면 그 질문의 워치독을 끕니다. */
const ANSWER_EVENT_TYPES: readonly SessionEvent["type"][] = [
  "answer.completed",
  "answer.queued",
  "answer.failed",
  "answer.recovered",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOf(payload: SessionEvent["payload"], key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOf(payload: SessionEvent["payload"], key: string): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** 낱말 하나를 붙잡았을 때 밖으로 보낼 질문 문장입니다. */
export function questionTextOf(word: string | undefined): string {
  return word === undefined || word.length === 0 ? "이 부분이 무슨 뜻이에요?" : `${word} 이 무슨 뜻이에요?`;
}

export class ReplayStore implements PanelInbox, PanelOutbox {
  #env: Env;
  readonly #mockDelayMs: number;
  readonly #live: LiveConfig | null;
  readonly #idToken: string;
  readonly #askTimeoutMs: number;
  readonly #startMs: number;
  readonly #listeners = new Set<Listener>();
  readonly #emitListeners = new Set<EmitListener>();
  /** 질문 id → 밖에 물을 때 쓸 문구입니다. */
  readonly #asked = new Map<Id, AskDraft>();
  /** 이미 한 번 물어본 질문 id 입니다. `AskPort.ask` 는 질문마다 한 번뿐입니다. */
  readonly #askedIds = new Set<Id>();
  /** 질문 id → 이 시각(ms)까지 답이 없으면 멈춘 것으로 봅니다. */
  readonly #watching = new Map<Id, number>();
  /** 이미 받은 사건 id 입니다. 같은 id 는 두 번 처리하지 않습니다. */
  readonly #seen = new Set<Id>();
  /** 번들은 라이브 모드에서 자랍니다. 그래서 `readonly` 가 아닙니다. */
  #bundle: GoldenBundle;
  /** 진짜 편집기 문맥이 한 번이라도 왔는지입니다. 자리표시는 봉인에 넣지 않습니다. */
  #hasEditor: boolean;
  #state: ReplayState;
  #pending: SessionEvent[] = [];
  #panelQuestionSeq = 0;
  #emitSeq = 0;
  #mockSeq = 0;

  constructor(bundle: GoldenBundle, options: ReplayStoreOptions = {}) {
    this.#bundle = bundle;
    this.#live = options.live ?? null;
    this.#idToken = this.#live?.idToken ?? makeIdToken();
    this.#askTimeoutMs = this.#live?.askTimeoutMs ?? ASK_TIMEOUT_MS;
    this.#hasEditor = this.#live === null;
    this.#env = createEnv(bundle.periodId, options.env ?? {});
    this.#mockDelayMs = options.mockAnswerDelayMs ?? 2_000;
    this.#startMs = this.#live === null ? parseIso(this.#firstEvent().at) : this.#live.startMs;
    this.#state = this.#fresh();
    this.#step(this.#state.now);
  }

  /**
   * 라이브 스토어를 만듭니다. 번들은 비어 있고 본문은 `push*` 로 들어옵니다.
   *
   *     const store = ReplayStore.live({
   *       periodId: "2026-09-02-p3",
   *       startMs: Date.now(),
   *       askPort: { ask: (request) => port.postMessage(request) },
   *     });
   */
  static live(options: LiveStoreOptions): ReplayStore {
    const { periodId, startMs, subject } = options;
    const live: LiveConfig = {
      startMs,
      ...(options.askPort === undefined ? {} : { askPort: options.askPort }),
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.idToken === undefined ? {} : { idToken: options.idToken }),
      ...(options.askTimeoutMs === undefined ? {} : { askTimeoutMs: options.askTimeoutMs }),
    };
    return new ReplayStore(emptyBundle(periodId, startMs, subject), {
      ...(options.env === undefined ? {} : { env: options.env }),
      live,
    });
  }

  /** 재생 모드면 fixture 첫 사건의 시각, 라이브 모드면 `startMs` 입니다(ms). */
  get startMs(): number {
    return this.#startMs;
  }

  /** 라이브 모드인지입니다. 화면이 체크포인트 손잡이를 감출 때 씁니다. */
  get isLive(): boolean {
    return this.#live !== null;
  }

  get bundle(): GoldenBundle {
    return this.#bundle;
  }

  getState = (): ReplayState => this.#state;

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** 스토어가 낸 사건(`question.asked` · `state.changed`)을 그때그때 흘려 줍니다. */
  subscribeEmitted(listener: EmitListener): () => void {
    this.#emitListeners.add(listener);
    return () => {
      this.#emitListeners.delete(listener);
    };
  }

  /** 처음 상태로 되돌리고 첫 초의 사건을 다시 받습니다. */
  reset(): void {
    this.#pending = [];
    this.#panelQuestionSeq = 0;
    this.#emitSeq = 0;
    this.#mockSeq = 0;
    this.#asked.clear();
    this.#askedIds.clear();
    this.#watching.clear();
    this.#seen.clear();
    this.#state = this.#fresh();
    this.#step(this.#state.now);
    this.#notify();
  }

  /** 시계를 1초씩 `target` 까지 밀며 그 초의 사건과 tick 을 넣습니다. */
  advanceTo(target: number | IsoDateTime): void {
    const targetMs = typeof target === "number" ? target : parseIso(target);
    for (let t = this.#state.now + 1_000; t <= targetMs; t += 1_000) {
      this.#step(t);
    }
  }

  /**
   * 시계를 한 칸 밉니다. 화면의 1초 타이머가 부릅니다.
   *
   * 재생 모드는 정확히 1초씩(그래야 fixture 사건이 초 단위로 맞아떨어집니다),
   * 라이브 모드는 진짜 시계(`Date.now` 또는 주입한 시계)를 읽습니다.
   */
  tick(): void {
    if (this.#live === null) {
      this.#step(this.#state.now + 1_000);
      return;
    }
    this.#step(Math.max(this.#state.now, this.#nowMs()));
  }

  /** 밖에서 온 세션 사건 하나를 받습니다. 2라운드에 실제 커넥터·세션 스토어가 붙는 자리입니다. */
  pushEvent(event: SessionEvent): void {
    if (this.#seen.has(event.id)) return;
    this.#seen.add(event.id);
    if (this.#live !== null) {
      this.#moveClock(parseIso(event.at));
      // 본문(질문·답·전사·편집기)을 번들에 먼저 채우고 나서 기계에 넣습니다.
      this.#absorb(event);
    }
    const received = [...this.#state.received, event];
    if (event.type === "state.changed") {
      // 기계가 스스로 낼 답입니다. 기록만 하고 입력으로 쓰지 않습니다.
      this.#set({ received });
      return;
    }

    if (event.type === "question.asked" && this.#hasMomentFor(stringOf(event.payload, "questionId"))) {
      // 호스트가 `tutor.ask` 를 받고 자기 `question.asked` 기록본을 되민 것입니다. 사건 id 가 달라
      // `#seen` 을 통과하지만 질문은 패널이 이미 붙잡은 그 질문입니다. 순간을 하나 더 만들면
      // 바닥줄이 "기록 2" 가 되고 기록 화면에 같은 줄이 둘 생깁니다. 기계에도 다시 넣지 않습니다 —
      // `catchQuestion` 이 메모를 준비 자리로 되돌리고 준비 시계를 다시 걸기 때문입니다.
      this.#set({ received });
      return;
    }
    if (this.#isStaleAnswer(event)) {
      // 지금 보고 있는 질문의 답이 아닙니다(늦게 온 옛 질문의 답). 기록에는 남기고 화면에는 얹지
      // 않습니다 — 기계의 `landAnswer` 는 questionId 를 보지 않아 엉뚱한 낱말에 붙습니다.
      this.#set({ received });
      return;
    }

    let input: MachineInput = { kind: "event", event };
    let moments = this.#state.moments;
    if (event.type === "question.asked") {
      const questionId = String(event.payload.questionId ?? "");
      const question = this.#bundle.questions[questionId];
      const snapshot = question?.snapshot ?? this.#seal(event.at);
      const word =
        typeof event.payload.word === "string" ? event.payload.word : (question?.anchor?.word ?? "문장");
      const lineId = question?.anchor?.segmentId ?? this.#state.machine.lastSegmentId ?? "";
      input = { kind: "event", event, snapshot };
      moments = [...moments, this.#momentFor(questionId, lineId, word, clockOfIso(event.at), snapshot.ages)];
    }
    this.#set({ received, moments, chip: event.type === "question.asked" ? null : this.#state.chip });
    this.#apply(input);
  }

  /**
   * 전사 한 조각을 받습니다. 같은 id 는 무시하고 `seq` 순서를 지킵니다.
   * 넣은 뒤 바로 `lines()` 에 새 줄이 보이도록 시계를 도착 시각까지 밉니다.
   */
  pushSegment(segment: TranscriptSegment): void {
    if (this.#bundle.transcript.some((item) => item.id === segment.id)) return;
    const transcript = [...this.#bundle.transcript, segment].sort((a, b) => a.seq - b.seq);
    this.#bundle = { ...this.#bundle, transcript };
    this.#moveClock(parseIso(segment.arrivedAt));
    this.#touch();
  }

  /** 바뀐 화면 한 장을 받습니다. 같은 id 는 무시합니다. */
  pushFrame(frame: ScreenFrame): void {
    if (this.#bundle.frames.some((item) => item.id === frame.id)) return;
    this.#bundle = { ...this.#bundle, frames: [...this.#bundle.frames, frame] };
    this.#moveClock(parseIso(frame.capturedAt));
    this.#touch();
  }

  /** 편집기 문맥을 받습니다. 한 자리뿐이라 늘 최신 것으로 갈아 끼웁니다. */
  pushEditor(context: EditorContext): void {
    this.#bundle = { ...this.#bundle, editor: context };
    this.#hasEditor = true;
    this.#moveClock(parseIso(context.capturedAt));
    this.#touch();
  }

  /**
   * 수업 중에 바뀐 설정 둘(제공자 · 자동 접기)을 굴러가는 스토어에 넣습니다.
   *
   *     설정 화면 ──onChange──▶ PanelApp ──updateEnv({ provider, autoFold })──▶ ReplayStore#env
   *
   * 교시 번호와 주제는 스토어를 만들 때 한 번 박히므로 여기로 들어오지 않습니다(패널을 다시 열어야
   * 바뀝니다). 자동 접기를 끄면 **이미 걸려 있는 접힘 시계도 그 자리에서 풉니다** — 끄자마자
   * 지금 떠 있는 메모가 접히면 껐다는 말이 거짓이 됩니다.
   */
  updateEnv(partial: EnvUpdate): void {
    const next: Env = {
      ...this.#env,
      ...(partial.provider === undefined ? {} : { provider: partial.provider }),
      ...(partial.autoFold === undefined ? {} : { autoFold: partial.autoFold }),
    };
    if (next.provider === this.#env.provider && next.autoFold === this.#env.autoFold) return;
    this.#env = next;
    if (!next.autoFold && this.#state.machine.foldDeadline !== null) {
      this.#set({ machine: { ...this.#state.machine, foldDeadline: null } });
      return;
    }
    this.#notify();
  }

  // ── 화면 손짓 ───────────────────────────────────────────────────────────────

  /** 점선 낱말을 눌렀습니다. 그 자리에서 바로 질문이 됩니다. */
  catchTerm(lineId: Id, segmentIndex: number, word: string): void {
    if (this.#state.screen !== "home") return;
    this.#stuck(lineId, word, `${lineId}:${segmentIndex}`, clockOfMs(this.#state.now));
  }

  /** 문장을 통째로 눌렀거나 Alt+S 를 눌렀습니다. 짐작 목록을 보여 줍니다. */
  catchSentence(lineId: Id): void {
    if (this.#state.screen !== "home") return;
    this.#set({ choosing: { lineId, time: clockOfMs(this.#state.now), guess: null } });
  }

  /** 짐작 하나를 골랐습니다. 그 낱말을 붙잡은 것으로 보고 묻습니다. */
  chooseGuess(guessId: string): void {
    const choosing = this.#state.choosing;
    if (choosing === null) return;
    const guess = guessesForLine(choosing.lineId).find((item) => item.id === guessId);
    if (guess === undefined) return;
    const line = this.lines().find((item) => item.id === choosing.lineId);
    const segKey = line === undefined ? null : segmentKeyOfWord(line, guess.term);
    this.#set({ choosing: null });
    // 밖으로 보낼 질문 문장은 짐작 라벨 그대로입니다("왜 new로 직접 만들면 안 되는지").
    this.#stuck(choosing.lineId, guess.term, segKey, choosing.time, guess.label);
  }

  /** 짐작 고르기를 그만둡니다. */
  cancelChoosing(): void {
    this.#set({ choosing: null });
  }

  /** 메모의 칩을 눌렀습니다. 같은 칩을 다시 누르면 결론으로 돌아갑니다. 접힘 시계는 18초로 되돌아갑니다. */
  chip(chipId: string): void {
    this.#set({ chip: this.#state.chip === chipId ? null : chipId });
    this.#apply({ kind: "chip", now: this.#state.now, chipId });
  }

  /** "자세히 보기" — 접힘 시계를 멈추고 자세히 화면으로 갑니다. */
  openDetail(): void {
    const { machine } = this.#state;
    if (machine.questionId === null || machine.note === "none" || machine.note === "folded") return;
    this.#apply({ kind: "detail", now: this.#state.now });
    this.#set({ screen: "detail", reply: null });
  }

  /** "수업으로 돌아가기" — 한 줄 결론으로 돌아가 18초를 다시 셉니다. */
  back(): void {
    if (this.#state.machine.note === "detail") {
      this.#apply({ kind: "back", now: this.#state.now });
    }
    this.#set({ screen: "home", reply: null });
  }

  /** 접힌 메모를 눌러 다시 폅니다. */
  expand(): void {
    if (this.#state.machine.note !== "folded") return;
    this.#apply({ kind: "detail", now: this.#state.now });
  }

  /** 자세히 화면의 후속 칩입니다. 답은 fixture 의 details 에서만 꺼냅니다. */
  followUp(followUpId: string): void {
    const answerId = this.#state.machine.answerId;
    const answer = answerId === null ? undefined : this.#bundle.answers[answerId];
    if (answer === undefined) return;
    const details = answer.details ?? {};
    let reply: Reply;
    if (followUpId === "why") {
      reply =
        details.why === undefined
          ? { q: "왜 필요한데?", a: answer.conclusion, reason: "이 답에는 이유 절이 아직 없어 결론을 그대로 보여요" }
          : { q: "왜 필요한데?", a: details.why, reason: "수업 자료에서 확인한 내용이에요" };
    } else if (followUpId === "recent") {
      const now = answer.nowLine === undefined ? "같은 내용을 이어가고 있어요" : answer.nowLine.replace(/^지금 · /, "");
      reply = { q: "방금 내용", a: `선생님은 지금 ${now}`, reason: "전사 마지막 문장 기준" };
    } else {
      reply = { q: "더 쉽게", a: answer.conclusion, reason: "더 쉬운 판이 아직 없어 결론을 그대로 보여요" };
    }
    this.#set({ reply });
  }

  // ── 체크포인트 ───────────────────────────────────────────────────────────────

  /**
   * 처음부터 다시 굴려 그 장면까지 갑니다. 시각은 fixture 사건에서 읽으므로 fixture 가 바뀌면 함께 움직입니다.
   *
   *     listening  첫 질문 2초 전         caught     첫 question.asked
   *     sentence   listening + 마지막 문장 붙잡기     answer     첫 answer.completed + 1초
   *     detail     answer + 자세히           returned   detail + 4초 + 뒤로
   *     folded     첫 ANSWER_MINIMAL→CAPTURE 접힘 + 1초   waiting    answer.queued
   *     recovered  answer.recovered + 1초
   */
  goto(checkpoint: Checkpoint): void {
    if (this.#live !== null) {
      throw new Error("라이브 모드에는 체크포인트가 없어요. fixture 재생 스토어에서만 됩니다");
    }
    this.reset();
    const firstQuestion = this.#timeOf("question.asked");
    const firstAnswer = this.#timeOf("answer.completed");
    switch (checkpoint) {
      case "listening":
        this.advanceTo(firstQuestion - 2_000);
        break;
      case "caught":
        this.advanceTo(firstQuestion);
        break;
      case "sentence": {
        this.advanceTo(firstQuestion - 2_000);
        const last = this.lines().at(-1);
        if (last !== undefined) this.catchSentence(last.id);
        break;
      }
      case "answer":
        this.advanceTo(firstAnswer + 1_000);
        break;
      case "detail":
        this.advanceTo(firstAnswer + 2_000);
        this.openDetail();
        break;
      case "returned":
        this.advanceTo(firstAnswer + 2_000);
        this.openDetail();
        this.advanceTo(firstAnswer + 6_000);
        this.back();
        break;
      case "folded":
        this.advanceTo(this.#timeOfFold() + 1_000);
        break;
      case "waiting":
        this.advanceTo(this.#timeOf("answer.queued"));
        break;
      case "recovered":
        this.advanceTo(this.#timeOf("answer.recovered") + 1_000);
        break;
    }
  }

  /** 지금까지 도착한 전사를 화면 줄로 만듭니다. */
  lines(untilMs: number = this.#state.now) {
    return toTranscriptLines(this.#bundle.transcript, GOLDEN_TERMS, untilMs);
  }

  /** 스토어와 같은 날짜의 시각(ms)을 만듭니다. `clockMs("10:32:16")`. */
  clockMs(clock: string): number {
    return parseIso(atClock(this.#anchorIso(), clock));
  }

  // ── 안쪽 ─────────────────────────────────────────────────────────────────────

  /** 날짜를 빌려 오는 기준 시각입니다. 재생은 fixture 첫 사건, 라이브는 `startMs` 입니다. */
  #anchorIso(): IsoDateTime {
    const first = this.#bundle.events[0];
    return first === undefined ? formatIso(this.#startMs) : first.at;
  }

  /** 라이브 모드에서 시계를 앞으로만 밉니다. 알림은 부르는 쪽이 냅니다. */
  #moveClock(ms: number): void {
    if (Number.isFinite(ms) && ms > this.#state.now) {
      this.#state = { ...this.#state, now: ms };
    }
  }

  /** 라이브 모드 시계를 읽습니다. */
  #nowMs(): number {
    const read = this.#live?.now;
    return read === undefined ? Date.now() : read();
  }

  /** 번들만 바뀌었을 때도 화면이 다시 그려지도록 상태 껍데기를 새로 만듭니다. */
  #touch(): void {
    this.#set({});
  }

  #fresh(): ReplayState {
    const now = this.startMs;
    return {
      machine: initialState(now),
      now,
      screen: "home",
      moments: [],
      choosing: null,
      chip: null,
      reply: null,
      emitted: [],
      received: [],
    };
  }

  #firstEvent(): SessionEvent {
    const first = this.#bundle.events[0];
    if (first === undefined) {
      throw new Error("골든 fixture 에 사건이 하나도 없어요");
    }
    return first;
  }

  #timeOf(type: SessionEvent["type"]): number {
    const event = this.#bundle.events.find((item) => item.type === type);
    if (event === undefined) {
      throw new Error(`골든 fixture 에 ${type} 사건이 없어요`);
    }
    return parseIso(event.at);
  }

  /** fixture 가 적어 둔 첫 접힘(ANSWER_MINIMAL → CAPTURE) 시각입니다. */
  #timeOfFold(): number {
    const event = this.#bundle.events.find(
      (item) =>
        item.type === "state.changed" &&
        item.payload.from === "ANSWER_MINIMAL" &&
        item.payload.to === "CAPTURE",
    );
    if (event === undefined) {
      throw new Error("골든 fixture 에 접힘(state.changed ANSWER_MINIMAL→CAPTURE) 사건이 없어요");
    }
    return parseIso(event.at);
  }

  #step(t: number): void {
    this.#set({ now: t });
    const due = [
      ...this.#bundle.events.filter((event) => parseIso(event.at) === t),
      ...this.#pending.filter((event) => parseIso(event.at) === t),
    ];
    this.#pending = this.#pending.filter((event) => parseIso(event.at) !== t);
    for (const event of due) {
      this.pushEvent(event);
    }
    this.#watchdog(t);
    this.#apply({ kind: "tick", now: t });
  }

  /**
   * 워치독 — 물어본 지 60초가 지나도록 그 질문의 답 사건이 하나도 안 오면
   * 스토어가 스스로 `answer.failed` 를 넣어 화면을 대기(H)로 보냅니다.
   *
   * tutor-core 의 ANSWER_MINIMAL 칸이 `answer.failed` 하나로 note 를 `waiting` 으로
   * 옮기고 provider 를 `failed` 로 적으므로, fixture 처럼 `answer.queued` 를 뒤따라
   * 넣지 않아도 메모 warn 과 호박색 바닥줄이 함께 켜집니다.
   */
  #watchdog(t: number): void {
    if (this.#live === null || this.#watching.size === 0) return;
    for (const [questionId, deadline] of [...this.#watching]) {
      if (deadline > t) continue;
      this.#watching.delete(questionId);
      this.pushEvent({
        id: this.#nextEventId(),
        periodId: this.#bundle.periodId,
        at: formatIso(t),
        type: "answer.failed",
        payload: { questionId, provider: this.#env.provider, message: ASK_TIMEOUT_MESSAGE },
      });
    }
  }

  #apply(input: MachineInput): readonly Effect[] {
    const { next, effects } = transition(this.#state.machine, input, this.#env);
    const emitted = [...this.#state.emitted];
    const fresh: SessionEvent[] = [];
    const asks: Extract<Effect, { kind: "ask" }>[] = [];
    for (const effect of effects) {
      if (effect.kind === "emit") {
        const event: SessionEvent = { id: this.#nextEventId(), ...effect.event };
        emitted.push(event);
        fresh.push(event);
      } else if (effect.kind === "ask") {
        asks.push(effect);
      }
    }
    this.#set({ machine: next, emitted });
    for (const event of fresh) {
      for (const listener of this.#emitListeners) listener(event);
    }
    for (const ask of asks) {
      this.#onAsk(ask, next.now);
    }
    return effects;
  }

  /**
   * `ask` 효과 하나를 처리합니다.
   *
   *   재생 모드   화면에서 새로 붙잡은 질문(q-panel-*)만 모의 제공자에게 넘깁니다.
   *   라이브 모드 `AskPort` 가 있으면 질문마다 **딱 한 번** 밖으로 보내고, 워치독을 겁니다.
   *               모의 제공자는 쓰지 않습니다(빈 번들이라 돌려줄 fixture 답이 없습니다).
   */
  #onAsk(effect: Extract<Effect, { kind: "ask" }>, nowMs: number): void {
    const { questionId } = effect;
    if (this.#live === null) {
      if (questionId.startsWith("q-panel-")) this.#mockAnswer(questionId, nowMs);
      return;
    }
    if (this.#askedIds.has(questionId)) return;
    this.#askedIds.add(questionId);
    this.#watching.set(questionId, nowMs + this.#askTimeoutMs);
    const port = this.#live.askPort;
    if (port === undefined) return;
    port.ask(this.#askRequest(questionId, effect));
  }

  #askRequest(questionId: Id, effect: Extract<Effect, { kind: "ask" }>): AskRequest {
    const draft = this.#asked.get(questionId);
    const word = draft?.word;
    return {
      questionId,
      provider: effect.provider,
      kind: draft?.kind ?? "confused",
      ...(word === undefined ? {} : { word }),
      question: draft?.question ?? questionTextOf(word),
      snapshot: effect.snapshot,
    };
  }

  #remember(questionId: Id, kind: string, question: string, word: string | undefined): void {
    this.#asked.set(questionId, { kind, question, ...(word === undefined ? {} : { word }) });
  }

  /**
   * 라이브 모드에서 사건에 딸려 온 **본문**을 번들에 채웁니다(기계에 넣기 전).
   * `lesson-view` 는 번들만 읽으므로, 여기서 채워 두면 화면이 fixture 때와 똑같이 그려집니다.
   */
  #absorb(event: SessionEvent): void {
    const { payload } = event;
    switch (event.type) {
      case "period.started": {
        const subject = stringOf(payload, "subject");
        const index = numberOf(payload, "index");
        this.#bundle = {
          ...this.#bundle,
          ...(subject === null ? {} : { subject }),
          ...(index === null ? {} : { periodIndex: index }),
        };
        return;
      }
      case "transcript.segment": {
        const body = payload["segment"];
        if (isRecord(body)) this.pushSegment(body as unknown as TranscriptSegment);
        return;
      }
      case "editor.context": {
        const body = payload["context"];
        if (isRecord(body)) this.pushEditor(body as unknown as EditorContext);
        return;
      }
      case "question.asked": {
        const questionId = stringOf(payload, "questionId");
        if (questionId === null) return;
        const body = payload["question"];
        if (isRecord(body)) {
          const question = body as unknown as Question;
          this.#bundle = {
            ...this.#bundle,
            questions: { ...this.#bundle.questions, [questionId]: question },
          };
        }
        const question = this.#bundle.questions[questionId];
        const word = stringOf(payload, "word") ?? question?.anchor?.word;
        const kind = stringOf(payload, "kind") ?? question?.kind ?? "confused";
        this.#remember(questionId, kind, question?.text ?? questionTextOf(word), word);
        return;
      }
      default: {
        if (!ANSWER_EVENT_TYPES.includes(event.type)) return;
        const answerId = stringOf(payload, "answerId");
        const body = payload["answer"];
        if (answerId !== null && isRecord(body)) {
          const answer = body as unknown as Answer;
          this.#bundle = { ...this.#bundle, answers: { ...this.#bundle.answers, [answerId]: answer } };
        }
        const questionId = stringOf(payload, "questionId");
        // 어떤 답 사건이든 하나만 오면 그 질문은 더 기다리지 않습니다.
        if (questionId !== null) this.#watching.delete(questionId);
        return;
      }
    }
  }

  /** 패널이 기록에 남기는 사건 id 하나입니다. */
  #nextEventId(): Id {
    this.#emitSeq += 1;
    return this.#live === null
      ? `ev-panel-${String(this.#emitSeq).padStart(4, "0")}`
      : panelEventId(this.#bundle.periodId, this.#idToken, this.#emitSeq);
  }

  /** 패널에서 새로 붙잡은 질문 id 하나입니다. */
  #nextQuestionId(): Id {
    this.#panelQuestionSeq += 1;
    return this.#live === null
      ? `q-panel-${String(this.#panelQuestionSeq).padStart(3, "0")}`
      : panelQuestionId(this.#bundle.periodId, this.#idToken, this.#panelQuestionSeq);
  }

  /**
   * 모의 제공자 — 화면에서 새로 붙잡은 낱말의 fixture 답을 조금 뒤 `answer.completed` 로 돌려줍니다.
   * fixture 에 그 낱말의 답이 없으면 `answer.failed` 로 튜터 멈춤을 재현합니다. 글을 지어내지 않습니다.
   */
  #mockAnswer(questionId: Id, nowMs: number): void {
    const moment = this.#state.moments.find((item) => item.questionId === questionId);
    const answer = Object.values(this.#bundle.answers).find((item) => {
      const question = this.#bundle.questions[item.questionId];
      return (
        question?.anchor?.word === moment?.term && (item.status === "answered" || item.status === "recovered")
      );
    });
    this.#mockSeq += 1;
    const at = formatIso(nowMs + this.#mockDelayMs);
    const base = {
      id: `ev-mock-${String(this.#mockSeq).padStart(4, "0")}`,
      periodId: this.#bundle.periodId,
      at,
    };
    this.#pending.push(
      answer === undefined
        ? {
            ...base,
            type: "answer.failed",
            payload: {
              questionId,
              provider: this.#env.provider,
              message: "이 낱말의 fixture 답이 없어요. 순간은 저장됐어요.",
            },
          }
        : {
            ...base,
            type: "answer.completed",
            payload: {
              questionId,
              answerId: answer.id,
              evidence: answer.evidence,
              provider: this.#env.provider,
            },
          },
    );
  }

  #stuck(lineId: Id, word: string, segKey: string | null, time: string, label?: string): void {
    const now = this.#state.now;
    const questionId = this.#nextQuestionId();
    const snapshot = this.#seal(formatIso(now));
    this.#remember(questionId, "confused", label ?? questionTextOf(word), word);
    this.#set({
      moments: [...this.#state.moments, { questionId, lineId, term: word, time, segKey, ages: snapshot.ages }],
      chip: null,
    });
    this.#apply({ kind: "stuck", now, questionId, questionKind: "confused", snapshot, word });
  }

  #seal(askedAt: IsoDateTime): QuestionSnapshot {
    return sealSnapshot({
      askedAt,
      transcript: this.#bundle.transcript,
      frames: this.#bundle.frames,
      // 라이브 자리표시(ec-live-none)는 봉인에 넣지 않습니다. 진짜 문맥이 와야 나이가 셉니다.
      editor: this.#hasEditor ? [this.#bundle.editor] : [],
    });
  }

  /** 그 질문의 순간을 이미 만들어 두었는지입니다. 같은 질문은 순간 하나뿐입니다. */
  #hasMomentFor(questionId: string | null): boolean {
    return questionId !== null && this.#state.moments.some((item) => item.questionId === questionId);
  }

  /**
   * 지금 보고 있는 질문의 답이 아닌 답 사건인지입니다.
   *
   *     Q1 붙잡음 ─▶ (답 오기 전) Q2 붙잡음 ─▶ machine.questionId = Q2
   *                                            └─▶ 여기서 Q1 의 answer.completed 가 오면 true
   *
   * 기계의 `landAnswer` 는 questionId 를 보지 않아 그대로 얹히고, 메모가 "Q2 낱말 + Q1 답" 이
   * 됩니다. 기록 화면은 `state.received` 로 만드니 여기서 걸러도 그 답은 그대로 남습니다.
   */
  #isStaleAnswer(event: SessionEvent): boolean {
    if (!ANSWER_EVENT_TYPES.includes(event.type)) return false;
    const forQuestion = stringOf(event.payload, "questionId");
    const current = this.#state.machine.questionId;
    return forQuestion !== null && current !== null && forQuestion !== current;
  }

  #momentFor(questionId: Id, lineId: Id, term: string, time: string, ages: QuestionSnapshot["ages"]): Moment {
    const line = this.lines().find((item) => item.id === lineId);
    const segKey = line === undefined ? null : segmentKeyOfWord(line, term);
    return { questionId, lineId, term, time, segKey, ages };
  }

  #set(patch: Partial<ReplayState>): void {
    this.#state = { ...this.#state, ...patch };
    this.#notify();
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
