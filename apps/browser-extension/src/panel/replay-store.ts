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
  SessionProfileV2,
  TranscriptSegment,
} from "@classmate/contracts";
import type { Effect, Env, MachineInput, MachineState } from "@classmate/tutor-core";
import { createEnv, formatIso, initialState, parseIso, sealSnapshot, transition } from "@classmate/tutor-core";
import type { TranscriptLine } from "@classmate/ui-classmate";

import {
  ASK_EASIER,
  askWhyForProfile,
  clampAskQuestion,
  followUpQuestion,
  normalizeAskText,
} from "./ask-text";
import { atClock, clockOfIso, clockOfMs } from "./clock";
import { makeIdToken, panelEventId, panelQuestionId } from "./event-ids";
import type { GoldenBundle } from "./golden-bundle";
import { emptyBundle, GOLDEN_TERMS, guessesForLine } from "./golden-bundle";
import type { Guess } from "./guesses";
import { guessesFromSentence, WHOLE_SENTENCE_TERM } from "./guesses";
import { termsInText } from "./live-terms";
import type { AnswerDelta, AskPort, AskRequest, PanelInbox, PanelOutbox } from "./ports";
import { foldSegments, resolveAlias, segmentKeyOfWord, toTranscriptLines } from "./transcript-lines";
import { normalizeSessionProfile, sessionProfileCopy } from "../session-profile";
import { providerFailureText } from "./provider-failure";

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
  /**
   * 이 문장에 내놓은 짐작들입니다. **재생은 fixture 의 것, 라이브는 붙잡은 문장에서 만든 것**입니다.
   * 여기 담아 두는 까닭은 고른 뒤에 다시 만들면 라이브에서 그 사이 전사가 바뀔 수 있어서입니다.
   */
  readonly options: readonly Guess[];
}

/** 자세히 화면에서 후속 칩을 눌러 받은 답 한 덩어리입니다(fixture 재생 전용). */
export interface Reply {
  readonly q: string;
  readonly a: string;
  readonly reason: string;
}

/**
 * 자세히 화면에서 **이어 물은** 질문 하나입니다(자유 입력창 · 후속 칩).
 *
 *     붙잡은 순간 q1 ─┬─ 후속 f1 "더 쉽게"          waiting → answered
 *                     └─ 후속 f2 "그럼 언제 써요?"   waiting → failed
 *
 * 상태기계에는 넣지 않습니다. 넣으면 `stuck` 이 지금 보고 있는 질문을 새 질문으로 갈아치워
 * 자세히 화면이 통째로 준비 중으로 돌아갑니다.
 */
export interface FollowUpAsk {
  /** 이 후속 질문의 id 입니다. 답 사건이 이 id 로 돌아옵니다. */
  readonly id: Id;
  /** 어느 붙잡은 순간에 이어 묻는지입니다. */
  readonly parentId: Id;
  /** 화면에 보일 질문 줄입니다(사람이 친 문장 또는 칩 라벨). */
  readonly question: string;
  /** "10:32:41" */
  readonly time: string;
  readonly state: "waiting" | "answered" | "failed";
  readonly answerId: Id | null;
  /** 실패했을 때 보여 줄 문구입니다. 그 밖에는 null 입니다. */
  readonly message: string | null;
}

export interface ReplayState {
  readonly machine: MachineState;
  /** 재생기의 시계(ms). 기계의 `now` 와 같거나 앞섭니다. */
  readonly now: number;
  /** 라이브 모드인지입니다. 화면이 fixture 전용 길과 라이브 길을 가릅니다. */
  readonly live: boolean;
  readonly screen: Screen;
  readonly moments: readonly Moment[];
  readonly choosing: Choosing | null;
  /** 지금 메모에서 고른 칩 id. 없으면 null 입니다. */
  readonly chip: string | null;
  readonly reply: Reply | null;
  /** 붙잡은 순간 id → 그 순간에 이어 물은 후속들(물은 순서). */
  readonly threads: Readonly<Record<Id, readonly FollowUpAsk[]>>;
  /**
   * 답을 기다리는 중에 밀려난 붙잡기 질문 id 들입니다(밀려난 순서 · U-34).
   *
   * 기계는 질문 하나만 듭니다. 앞 질문은 여기에 이름만 남고, 화면은 그 질문의 `Moment` 가
   * 가리키는 **그 문장 옆**에 메모를 그대로 둡니다. 대화 칸으로 내려보내지 않습니다.
   */
  readonly carried: readonly Id[];
  /**
   * 아직 답을 기다리는 질문들의 **자라는 결론**입니다. `질문 id → 마지막 조각`.
   *
   *     q-…-001 ─▶ {seq: 3, chars: 82, text: "생성 책임을"}   답이 오면 이 칸이 사라집니다
   *
   * 재생(fixture) 모드에서는 **언제나 비어 있습니다**(`pushDelta` 가 그 자리에서 돌아섭니다).
   * 골든 9장면이 이 값 때문에 달라지지 않습니다.
   */
  readonly deltas: Readonly<Record<Id, AnswerDelta>>;
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

/**
 * 라이브 봉인에 담을 전사 **글자 수** 상한입니다.
 *
 * 왜 조각 수가 아니라 글자 수인가: 문단 길이가 들쭉날쭉해서 "3조각" 은 어떤 때는 10초,
 * 어떤 때는 1분이 됩니다. 얼마나 담기는지 예측이 안 됩니다. 글자 수로 두면 어느 수업에서나
 * 같은 분량이 담깁니다.
 *
 * 2000자로 잡은 까닭입니다.
 *   - 2026-09-03 4교시 실측에서 한 문단이 평균 30~60자, 10~15초였습니다. 기본값 3문단은
 *     30초 남짓이라 개념 하나가 끝나기도 전에 잘렸습니다.
 *   - 2000자면 대략 40문단, 강의로 5~8분입니다. 개념 하나의 도입부터 예제까지가 들어옵니다.
 *   - 호스트는 봉인된 조각의 본문을 한 줄씩 그대로 프롬프트에 붙입니다
 *     (`apps/native-host/src/tutor/materials.rs` 의 `render`). 한글 2000자는 UTF-8 6KB 로,
 *     사람이 적는 질문 상한(4096바이트 · `MAX_ASK_QUESTION_BYTES`)의 한 배 반쯤입니다.
 *     호스트 프롬프트가 감당하는 크기입니다.
 */
export const LIVE_SNAPSHOT_MAX_CHARS = 2_000;

/**
 * 물은 자리 **뒤쪽**을 함께 담아 주는 시간 폭(ms)입니다.
 *
 * 한 문장의 뜻이 바로 다음 숨에서 끝나는 일이 잦아 뒤도 조금은 담아야 합니다. 그렇다고 넓게
 * 담으면 6분 전 문장을 물었을 때 그 사이의 딴 이야기가 통째로 딸려 옵니다(실측 사례 ②).
 * 그래서 뒤쪽은 **같은 호흡으로 이어진 30초**까지만 봅니다. 앞쪽에는 시간 제한을 두지 않습니다 —
 * 설명은 앞에서 쌓여 오므로 글자 수 상한이 다할 때까지 거슬러 담습니다.
 */
export const LIVE_SNAPSHOT_AFTER_MS = 30_000;

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
  /** 새 세션이 시작되기 전의 설정값입니다. 첫 `period.started`가 오면 그 기록값이 정본이 됩니다. */
  readonly profile?: SessionProfileV2;
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

/**
 * 그 열쇠(`<줄 id>:<조각 번호>`)가 아직 그 낱말을 가리키고 있는지입니다.
 *
 *     ts-058:0  →  ["new"(점선), " 로 만들면"]        가리킴 O
 *     ts-058:0  →  ["그러니까 ", "new"(점선), " …"]   가리킴 X — 앞머리가 자라 번호가 밀렸습니다
 */
function holdsTerm(line: TranscriptLine, segKey: string | null, term: string): boolean {
  if (segKey === null) return false;
  const index = Number.parseInt(segKey.slice(segKey.lastIndexOf(":") + 1), 10);
  if (!Number.isInteger(index)) return false;
  const piece = line.segments[index];
  return piece !== undefined && piece.term === true && piece.text === term;
}

/** 낱말 하나를 붙잡았을 때 밖으로 보낼 질문 문장입니다. */
export function questionTextOf(word: string | undefined): string {
  return word === undefined || word.length === 0 ? "이 부분이 무슨 뜻이에요?" : `${word} 이 무슨 뜻이에요?`;
}

/** 후속 칩 id 앞에 붙는 이름표입니다. `model-0` 은 답의 `chips[0]` 입니다. */
export const MODEL_CHIP_PREFIX = "model-";

/** 후속 스레드의 답을 기다리는 동안 보이는 한 줄입니다. */
export const FOLLOW_UP_WAITING_LINE = "답을 만들고 있어요";

/** `#stuck` 이 받는 값입니다. 화면에 보일 낱말과 밖으로 보낼 질문을 따로 둡니다. */
interface StuckOptions {
  readonly lineId: Id;
  /** 메모 제목·기록 줄에 보일 낱말입니다. */
  readonly term: string;
  readonly segKey: string | null;
  readonly time: string;
  /** 밖으로 보낼 질문 문장입니다. 없으면 낱말로 만듭니다. */
  readonly question?: string;
  /** `AskRequest.word` 로 실을 낱말입니다. 문장 전체를 붙잡았으면 없습니다. */
  readonly word?: string;
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
  readonly #watchStarted = new Map<Id, number>();
  /** 이미 받은 사건 id 입니다. 같은 id 는 두 번 처리하지 않습니다. */
  readonly #seen = new Set<Id>();
  /**
   * 질문 id → 그 질문이 봉인한 수업 맥락입니다. **이어 묻기가 같은 자리를 잇는 데** 씁니다
   * (`#followUpSeal`). 패널이 스스로 붙잡은 질문은 번들에 들어가지 않아 여기에만 남습니다.
   */
  readonly #snapshots = new Map<Id, QuestionSnapshot>();
  /** 번들은 라이브 모드에서 자랍니다. 그래서 `readonly` 가 아닙니다. */
  #bundle: GoldenBundle;
  /** 진짜 편집기 문맥이 한 번이라도 왔는지입니다. 자리표시는 봉인에 넣지 않습니다. */
  #hasEditor: boolean;
  #state: ReplayState;
  /**
   * 라이브 점선 낱말을 기억해 둡니다. 전사와 순간이 그대로면 낱말을 다시 뽑지 않습니다
   * (`lines()` 는 화면이 다시 그려질 때마다 불립니다).
   */
  #liveTerms: {
    readonly transcript: readonly TranscriptSegment[];
    readonly moments: readonly Moment[];
    readonly list: readonly string[];
  } | null = null;
  #pending: SessionEvent[] = [];
  #panelQuestionSeq = 0;
  #emitSeq = 0;
  #mockSeq = 0;
  /** 라이브 세션의 최초 `period.started`를 흡수했는지입니다. 같은 세션의 정체성은 이후 고정합니다. */
  #hasAuthoritativeStart = false;

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
    const { periodId, startMs, subject, profile } = options;
    const live: LiveConfig = {
      startMs,
      ...(options.askPort === undefined ? {} : { askPort: options.askPort }),
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.idToken === undefined ? {} : { idToken: options.idToken }),
      ...(options.askTimeoutMs === undefined ? {} : { askTimeoutMs: options.askTimeoutMs }),
    };
    return new ReplayStore(emptyBundle(periodId, startMs, subject, profile), {
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
    this.#hasAuthoritativeStart = false;
    this.#asked.clear();
    this.#askedIds.clear();
    this.#watching.clear();
    this.#watchStarted.clear();
    this.#seen.clear();
    this.#snapshots.clear();
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
    // 답 사건이 왔으면 그 질문의 조각 자리를 **먼저** 비웁니다. 아래 갈래마다 일찍 돌아서는
    // 길이 있어서(늦게 온 답 · 호스트 되밀기), 여기서 한 번만 지워야 빠짐이 없습니다.
    // 지우지 않으면 자라던 조각과 다 쓴 답이 한 화면에 겹쳐 보입니다.
    this.#clearDelta(event);
    if (this.#live !== null) {
      this.#moveClock(parseIso(event.at));
      // 본문(질문·답·전사·편집기)을 번들에 먼저 채우고 나서 기계에 넣습니다.
      this.#absorb(event);
    }
    const received = [...this.#state.received, event];
    const threads = this.#threadsAfter(event);
    if (threads !== null) {
      // 자세히 화면에서 이어 물은 후속의 답입니다. 그 줄만 갈아 끼우고 기계는 건드리지 않습니다.
      this.#set({ received, threads });
      return;
    }
    if (event.type === "state.changed") {
      // 기계가 스스로 낼 답입니다. 기록만 하고 입력으로 쓰지 않습니다.
      this.#set({ received });
      return;
    }

    if (
      event.type === "question.asked" &&
      (this.#hasMomentFor(stringOf(event.payload, "questionId")) ||
        this.#isThreadQuestion(stringOf(event.payload, "questionId")))
    ) {
      // 호스트가 `tutor.ask` 를 받고 자기 `question.asked` 기록본을 되민 것입니다. 사건 id 가 달라
      // `#seen` 을 통과하지만 질문은 패널이 이미 붙잡은 그 질문입니다. 순간을 하나 더 만들면
      // 바닥줄이 "기록 2" 가 되고 기록 화면에 같은 줄이 둘 생깁니다. 기계에도 다시 넣지 않습니다 —
      // `catchQuestion` 이 메모를 준비 자리로 되돌리고 준비 시계를 다시 걸기 때문입니다.
      //
      // 이어 물은 후속(`threads`)의 되밀기도 여기서 멈춥니다. 후속은 붙잡은 순간이 아니라서
      // `#hasMomentFor` 로는 걸리지 않는데, 그대로 두면 없는 순간이 하나 생기고 기계가 자세히
      // 화면을 통째로 준비 중으로 되돌립니다.
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
      const word =
        typeof event.payload.word === "string" ? event.payload.word : (question?.anchor?.word ?? "문장");
      const lineId = question?.anchor?.segmentId ?? this.#state.machine.lastSegmentId ?? "";
      // 밖에서 온 질문이 봉인을 안 실어 왔으면 여기서 만듭니다. 이때도 **그 질문이 가리키는
      // 줄**이 창의 중심입니다. 질문이 어느 줄도 안 가리키면 마지막 대목이 중심입니다.
      const snapshot = question?.snapshot ?? this.#seal(event.at, lineId);
      this.#snapshots.set(questionId, snapshot);
      input = { kind: "event", event, snapshot };
      moments = [...moments, this.#momentFor(questionId, lineId, word, clockOfIso(event.at), snapshot.ages)];
    }
    this.#set({ received, moments, chip: event.type === "question.asked" ? null : this.#state.chip });
    this.#apply(input);
  }

  /**
   * 전사 한 조각을 받습니다. `seq` 순서를 지킵니다.
   *
   * **같은 id 가 다시 오면 갈아 끼웁니다.** 공유 페이지 관찰기는 한 문단에 id 를 미리 잡아 두고
   * 진행 중에는 `partial`, 확정되면 `final` 로 같은 id 를 다시 보냅니다(2026-09-03 실측에서
   * `ts-058` 이 partial·partial·final 로 세 번 왔습니다). 예전처럼 무시하면 화면에 맨 처음의
   * 짧은 토막만 남고 완성된 문장이 영영 오지 않습니다.
   *
   * 되돌아가는 것만 막습니다: 이미 `final` 인 줄을 `partial` 로 덮지 않습니다.
   */
  pushSegment(segment: TranscriptSegment): void {
    const index = this.#bundle.transcript.findIndex((item) => item.id === segment.id);
    if (index >= 0) {
      const before = this.#bundle.transcript[index];
      if (before === undefined || (before.state === "final" && segment.state !== "final")) return;
      const transcript = [...this.#bundle.transcript];
      transcript[index] = segment;
      this.#bundle = { ...this.#bundle, transcript: transcript.sort((a, b) => a.seq - b.seq) };
    } else {
      const transcript = [...this.#bundle.transcript, segment].sort((a, b) => a.seq - b.seq);
      this.#bundle = { ...this.#bundle, transcript };
    }
    this.#moveClock(parseIso(segment.arrivedAt));
    // 줄이 접히거나 글이 갈아 끼워졌을 수 있습니다. 붙잡아 둔 자리를 새 줄에 다시 맞춥니다.
    this.#realignMoments();
    this.#touch();
  }

  /** 바뀐 화면 한 장을 받습니다. 같은 id 는 무시합니다. */
  pushFrame(frame: ScreenFrame): void {
    if (this.#bundle.frames.some((item) => item.id === frame.id)) return;
    this.#bundle = { ...this.#bundle, frames: [...this.#bundle.frames, frame] };
    this.#moveClock(parseIso(frame.capturedAt));
    this.#touch();
  }

  /**
   * 답이 만들어지는 **동안** 흐르는 조각 하나를 받습니다.
   *
   * ```text
   *   seq 0 ─▶ seq 1 ─▶ seq 2 ─▶ answer.completed
   *     │        │        │            └─ 조각 자리가 사라지고 진짜 답이 그 자리에 옵니다
   *     │        │        └ text 를 **갈아 끼웁니다**(증분이 아니라 결론 전체입니다)
   *     │        └ 늦게 온 seq 0 이 여기 오면 **버립니다** (되감기 금지)
   *     └ 다른 questionId 의 조각은 자기 칸에만 쌓입니다
   * ```
   *
   * **재생(fixture) 모드에서는 아무 일도 하지 않습니다.** 재생에는 흐르는 답이 없고, 골든
   * 9장면이 조각 때문에 달라지면 안 됩니다.
   *
   * 칸 수에 상한을 두지 않습니다. 답 사건 하나가 그 질문의 칸을 지우고, 한 교시의 질문은
   * 많아야 수십 개이며 결론은 계약상 40자 이내라(`answer.schema.json`) 쌓여도 몇 KB 입니다.
   */
  pushDelta(delta: AnswerDelta): void {
    if (this.#live === null) return;
    const before = this.#state.deltas[delta.questionId];
    // 같은 seq 도 버립니다. 같은 회차의 같은 번호는 다시 그릴 것이 없습니다.
    if (before !== undefined && delta.seq <= before.seq) return;
    this.#set({ deltas: { ...this.#state.deltas, [delta.questionId]: delta } });
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
    this.#stuck({
      lineId,
      term: word,
      segKey: `${lineId}:${segmentIndex}`,
      time: clockOfMs(this.#state.now),
      word,
    });
  }

  /** 문장을 통째로 눌렀거나 Alt+S 를 눌렀습니다. 짐작 목록을 보여 줍니다. */
  catchSentence(lineId: Id): void {
    if (this.#state.screen !== "home") return;
    this.#set({
      choosing: { lineId, time: clockOfMs(this.#state.now), guess: null, options: this.#guessesFor(lineId) },
    });
  }

  /** 짐작 하나를 골랐습니다. 그 낱말을 붙잡은 것으로 보고 묻습니다. */
  chooseGuess(guessId: string): void {
    const choosing = this.#state.choosing;
    if (choosing === null) return;
    const guess = choosing.options.find((item) => item.id === guessId);
    if (guess === undefined) return;
    const line = this.lines().find((item) => item.id === choosing.lineId);
    const segKey = line === undefined ? null : segmentKeyOfWord(line, guess.term);
    this.#set({ choosing: null });
    this.#stuck({
      lineId: choosing.lineId,
      term: guess.term,
      segKey,
      time: choosing.time,
      question: guess.question,
      ...(guess.word === undefined ? {} : { word: guess.word }),
    });
  }

  /** 짐작 고르기를 그만둡니다. */
  cancelChoosing(): void {
    this.#set({ choosing: null });
  }

  /** Direct questions preserve the selected paragraph, not the latest incoming transcript. */
  askSentence(lineId: Id, text: string): void {
    const question = normalizeAskText(text);
    if (!question || !this.lines().some((line) => line.id === lineId)) return;
    this.#set({ choosing: null });
    this.#stuck({ lineId, term: question, segKey: null, time: clockOfMs(this.#state.now), question });
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

  /**
   * 자세히 화면의 후속 칩입니다.
   *
   *   재생(fixture)  답은 fixture 의 `details` 에서만 꺼내 `reply` 한 덩어리로 보여 줍니다(예전 그대로).
   *   라이브         "방금 내용" 만 그 자리에서 만들고, 나머지는 **진짜 후속 질문**으로 밖에 묻습니다.
   *                  모델이 답에 실어 준 칩(`answer.chips`)은 `model-0` · `model-1` 로 들어옵니다.
   */
  followUp(parentId: Id, followUpId: string): void {
    const answer = this.#answerOf(parentId);
    if (answer === null) return;
    if (this.#live === null) {
      this.#set({ reply: this.#fixtureReply(answer, followUpId) });
      return;
    }
    if (followUpId === "recent") {
      // 전사 마지막 문장으로 만드는 로컬 문구입니다. 모델에게 물을 것이 없습니다.
      this.#set({ reply: this.#recentReply(answer) });
      return;
    }
    const chip = this.#modelChip(answer, followUpId);
    const label = chip ?? (followUpId === "why" ? "왜 필요한데?" : "더 쉽게");
    const ask = chip ?? (followUpId === "why" ? askWhyForProfile(this.#bundle.profile) : ASK_EASIER);
    this.#ask(parentId, label, followUpQuestion(this.#latestReply(parentId)?.conclusion ?? answer.conclusion, ask));
  }

  /**
   * 자세히 화면 맨 아래 입력창에 적어 보냈습니다(정본 §3-7 "텍스트 입력창은 여기 맨 아래에만").
   * 빈 글과 공백뿐인 글은 보내지 않습니다.
   */
  askTyped(parentId: Id, text: string): void {
    const typed = normalizeAskText(text);
    if (typed.length === 0) return;
    const answer = this.#latestReply(parentId);
    this.#ask(parentId, typed, followUpQuestion(answer?.conclusion ?? null, typed));
  }

  /** 같은 자리에서 여러 번 이어 물으면 원래 결론 대신 가장 최근 답을 가리킵니다. */
  #latestReply(parentId: Id): Answer | null {
    const replies = this.#state.threads[parentId] ?? [];
    for (let i = replies.length - 1; i >= 0; i -= 1) {
      const id = replies[i]?.answerId;
      if (id !== undefined && id !== null) {
        const answer = this.#bundle.answers[id];
        if (answer !== undefined) return answer;
      }
    }
    return this.#answerOf(parentId);
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
    return toTranscriptLines(this.#bundle.transcript, this.#termList(), untilMs);
  }

  /** 스토어와 같은 날짜의 시각(ms)을 만듭니다. `clockMs("10:32:16")`. */
  clockMs(clock: string): number {
    return parseIso(atClock(this.#anchorIso(), clock));
  }

  // ── 안쪽 ─────────────────────────────────────────────────────────────────────

  /**
   * 점선 밑줄을 그을 낱말입니다. **점선 자리가 곧 누를 수 있는 자리**입니다(`onTerm` → `catchTerm`).
   *
   *   재생(fixture)  골든 시나리오의 낱말 둘(`new` · `생성자`)
   *   라이브         줄마다 `termsInText` 가 고른 낱말 **전부** + 이미 붙잡은 낱말
   *
   * 라이브에서도 fixture 낱말만 쓰면 선생님이 하지도 않은 낱말에만 점선이 가고, 문장을 붙잡아
   * 고른 짐작 낱말(`enableWebSecurity` 같은 것)은 전사 어디에도 표시되지 않습니다. 누를 자리
   * 자체가 없어 `catchTerm` 이 라이브에서 죽은 길이 됩니다(2026-09-03 검토).
   *
   * 전에는 여기서 `codeTokens(..., MAX_TOKEN_GUESSES)` 도 함께 불렀습니다. 그 상한 2는 "혹시
   * 이게 막혔나요?" **짐작 목록**을 두 개로 줄이려는 것이지 밑줄을 줄이려는 것이 아닙니다.
   * 그래서 한 문단에 `before` · `after` · `around` · `pointcut` 이 다 나와도 앞의 둘에만
   * 밑줄이 섰습니다(약자와 낙타등은 `termsInText` 로 따로 들어와 살아남고, 그냥 영어 낱말만
   * 잘려 나갔습니다). 어느 낱말이 남을지 규칙이 눈에 안 보여 제멋대로 서는 것처럼 보였습니다
   * (2026-09-03 "단어 밑줄이 자기 맘대로"). 밑줄은 자격을 갖춘 낱말 전부에 긋습니다.
   *
   * 전사와 순간이 그대로면 지난번에 뽑아 둔 목록을 그대로 씁니다 — `lines()` 는 화면이 다시
   * 그려질 때마다 불립니다.
   */
  #termList(): readonly string[] {
    if (this.#live === null) return GOLDEN_TERMS;
    const cached = this.#liveTerms;
    const { transcript } = this.#bundle;
    const { moments } = this.#state;
    if (cached !== null && cached.transcript === transcript && cached.moments === moments) {
      return cached.list;
    }
    const seen = new Set<string>();
    const list: string[] = [];
    const add = (term: string): void => {
      const key = term.toLowerCase();
      if (term.length === 0 || seen.has(key)) return;
      seen.add(key);
      list.push(term);
    };
    for (const segment of transcript) {
      // `termsInText` 하나가 영문 낱말과 우리말 용어를 함께 돌려줍니다. 코드 낱말만 보면
      // 우리말 강의에서 밑줄이 거의 안 생깁니다(2026-09-03 3교시 실측).
      for (const term of termsInText(segment.text)) add(term);
    }
    // 이미 붙잡은 낱말은 목록 규칙에 안 걸려도 점선으로 남깁니다(자세히 화면의 표시 자리).
    for (const moment of moments) {
      if (moment.term !== WHOLE_SENTENCE_TERM) add(moment.term);
    }
    this.#liveTerms = { transcript, moments, list };
    return list;
  }

  /**
   * 전사가 바뀌면 붙잡은 자리를 다시 맞춥니다.
   *
   *     진행 중 줄을 붙잡음 ─▶ 그 문단이 다른 id 로 확정 ─▶ moment.lineId 를 이긴 줄로 옮깁니다
   *     같은 id 의 글이 갈아 끼워짐(앞머리가 자람)        ─▶ segKey 의 조각 번호를 다시 셉니다
   *
   * 이걸 안 하면 자세히 화면의 인용 전사 줄이 통째로 사라지거나(줄을 못 찾음), 표시가 엉뚱한
   * 글자에 붙습니다(조각 번호가 밀림). 둘 다 2026-09-03 검토에서 재현됐습니다.
   *
   * 아직 그 낱말을 제대로 가리키고 있는 열쇠는 건드리지 않습니다 — 같은 낱말이 한 줄에 두 번
   * 나오면 다시 세다가 사람이 누른 자리가 아닌 첫 자리로 옮겨 가기 때문입니다.
   */
  #realignMoments(): void {
    if (this.#state.moments.length === 0) return;
    const until = this.#state.now;
    const { alias } = foldSegments(
      this.#bundle.transcript.filter((segment) => parseIso(segment.arrivedAt) <= until),
    );
    const lines = this.lines(until);
    let moved = false;
    const moments = this.#state.moments.map<Moment>((moment) => {
      const lineId = resolveAlias(alias, moment.lineId);
      const line = lines.find((item) => item.id === lineId);
      // 아직 안 온 줄(시계보다 뒤)이거나 사라진 줄이면 그대로 둡니다. 없는 자리로 옮기지 않습니다.
      if (line === undefined) return moment;
      const segKey =
        moment.term === WHOLE_SENTENCE_TERM
          ? null
          : lineId === moment.lineId && holdsTerm(line, moment.segKey, moment.term)
            ? moment.segKey
            : segmentKeyOfWord(line, moment.term);
      if (lineId === moment.lineId && segKey === moment.segKey) return moment;
      moved = true;
      return { ...moment, lineId, segKey };
    });
    if (moved) this.#set({ moments });
  }

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
      live: this.#live !== null,
      screen: "home",
      moments: [],
      choosing: null,
      chip: null,
      reply: null,
      threads: {},
      carried: [],
      deltas: {},
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
      this.#watchStarted.delete(questionId);
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
    this.#set({ machine: this.#holdFold(next), emitted });
    for (const event of fresh) {
      for (const listener of this.#emitListeners) listener(event);
    }
    for (const ask of asks) {
      this.#onAsk(ask, next.now);
    }
    return effects;
  }

  /**
   * 읽는 중에 접히지 않게 접힘 시계를 그 자리에서 풉니다 (U-33 · U-24 흡수).
   *
   * 메모가 결론 아래에 답 본문을 그리게 되었으므로(U-33) 18초로는 다 못 읽습니다. 자세히 화면이
   * 열려 있는 동안 답이 늦게 오면 minimal 로 되돌리며 시계를 다시 거는데, 그 18초가 지나면
   * note 만 folded 로 가고 screen 은 detail 에 남아 어긋납니다(U-24). 두 경우 모두 풉니다.
   *
   * **라이브에서만 겁니다.** 재생(fixture)은 골든 장면 아홉을 그대로 재현해야 하고, 고정된
   * fixture 자체가 `state.changed ANSWER_MINIMAL→CAPTURE` 접힘 사건을 기록하고 있습니다.
   * 재생에서까지 시계를 풀면 제품이 대본과 어긋납니다(같은 갈림은 lesson-view 의
   * LIVE_VISIBLE 이 먼저 쓴 규칙입니다).
   */
  #holdFold(machine: MachineState): MachineState {
    if (this.#live === null || machine.foldDeadline === null) return machine;
    const answer = machine.answerId === null ? undefined : this.#bundle.answers[machine.answerId];
    const reading = this.#state.screen === "detail" || answer?.details?.why !== undefined;
    return reading ? { ...machine, foldDeadline: null } : machine;
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
    this.#watchStarted.set(questionId, nowMs);
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
        // 이 스토어는 세션 하나에 묶입니다. 다른 period의 시작이나 같은 period의 두 번째 시작으로
        // 주제·프로필을 소급 변경하지 않습니다. 설정을 바꾼 값은 다음 새 스토어/새 세션부터입니다.
        if (event.periodId !== this.#bundle.periodId || this.#hasAuthoritativeStart) return;
        this.#hasAuthoritativeStart = true;
        const subject = stringOf(payload, "subject");
        const index = numberOf(payload, "index");
        this.#bundle = {
          ...this.#bundle,
          profile: normalizeSessionProfile(payload["profile"]),
          ...(payload['studyBundle'] === true ? { studyBundle: true } : {}),
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
        if (questionId === null) return;
        if (event.type === "answer.queued" && !this.#alreadyStopped(questionId)) {
          // 줄 세워 뒀다는 알림은 답이 아닙니다. 시계를 풀어 버리면 아무 안내도 없이 영영
          // 기다리게 되므로 여기서 다시 겁니다. 멈춤 안내가 이미 떠 있으면 걸지 않습니다 —
          // 같은 멈춤을 60초마다 한 번 더 적을 까닭이 없습니다.
          const started = this.#watchStarted.get(questionId) ?? this.#state.now;
          this.#watchStarted.set(questionId, started);
          this.#watching.set(questionId, Math.min(this.#state.now + this.#askTimeoutMs, started + 2 * this.#askTimeoutMs));
          return;
        }
        // 그 밖의 답 사건이 하나라도 오면 그 질문은 더 기다리지 않습니다.
        this.#watching.delete(questionId);
        this.#watchStarted.delete(questionId);
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

  /**
   * 선택을 새 질문으로 넘기기 직전에 앞 질문을 원래 문단에 보존합니다.
   *
   * ```text
   *   Q1 붙잡음(완료·대기·실패) ──▶ Q2 붙잡음
   *        │                       └─ 기계의 현재 선택은 Q2
   *        └─ carried 에 Q1 ID 유지 → 원래 문단에 답과 후속 대화 표시
   * ```
   *
   * 완료된 답은 워치독에서 이미 빠졌더라도 남겨야 합니다. 보존 여부를 답 도착 여부와
   * 결합하면 Q2 를 물을 때 읽던 Q1 설명이 사라집니다. 늦게 온 답도 같은 ID로 채웁니다.
   *
   * 어디로 옮기나(U-34 에서 정한 것): **물어본 그 문장 옆, 그 줄의 메모 자리**입니다.
   * 아래 대화 칸이 아닙니다. 학습자 말 그대로 「대화창은 내가 따로 질문하는거면 좋겠는데」 —
   * 대화 칸은 사람이 직접 친 질문(`kind free`)만 담습니다. 전사 위 고정 띠도 고려했지만
   * 쓰지 않았습니다: ① 물은 자리와 답이 떨어져 "무엇에 대한 답인지" 를 다시 찾아야 하고,
   * ② 그 자리에는 이미 `NowLine` 이 있어 둘이 자리를 다투며, ③ 줄 옆 메모 자리는
   * `Moment.lineId` 와 `renderAfter(lineId)` 로 이미 있는 자리라 새 화면을 만들지 않습니다.
   *
   * 재생(fixture) 모드에서는 아무 일도 하지 않습니다 — 골든 9장면을 지킵니다.
   */
  #carryOverMoment(): void {
    if (this.#live === null) return;
    const previous = this.#state.machine.questionId;
    if (previous === null) return;
    if (this.#isThreadQuestion(previous)) return;
    if (this.#state.carried.includes(previous)) return;
    // 그 질문의 순간이 있어야 어느 줄 옆에 그릴지 압니다. 없으면 그릴 자리가 없습니다.
    if (!this.#state.moments.some((item) => item.questionId === previous)) return;
    this.#set({ carried: [...this.#state.carried, previous] });
  }

  #stuck({ lineId, term, segKey, time, question, word }: StuckOptions): void {
    // 답 도착 여부와 무관하게 이전 문단의 설명과 후속 대화를 남깁니다.
    this.#carryOverMoment();
    const now = this.#state.now;
    const questionId = this.#nextQuestionId();
    // 붙잡은 그 줄이 봉인 창의 중심입니다. "지금 시각의 최근 몇 개" 가 아닙니다.
    const snapshot = this.#seal(formatIso(now), lineId);
    this.#snapshots.set(questionId, snapshot);
    this.#remember(questionId, "confused", question ?? questionTextOf(word), word);
    this.#set({
      moments: [...this.#state.moments, { questionId, lineId, term, time, segKey, ages: snapshot.ages }],
      chip: null,
    });
    // 붙잡은 낱말은 이제 점선 목록에 들어갑니다(라이브). 그 자리에서 열쇠를 한 번 맞춰 둡니다.
    this.#realignMoments();
    this.#apply({
      kind: "stuck",
      now,
      questionId,
      questionKind: "confused",
      snapshot,
      ...(word === undefined ? {} : { word }),
    });
  }

  /**
   * 이 줄을 통째로 붙잡았을 때 내놓을 짐작입니다.
   *
   *   재생(fixture)  `golden-bundle` 이 줄마다 적어 둔 짐작(정본 시나리오)
   *   라이브         붙잡은 문장과 **바로 앞 2문장**에서 그 자리에서 만든 짐작(`guesses.ts`)
   *
   * 라이브에서 fixture 짐작을 쓰면 선생님이 하지도 않은 말이 "혹시 이게 막혔나요?" 에 뜹니다.
   *
   * "바로 앞 2문장" 은 **접은 뒤**에 셉니다. 접기 전에는 같은 문단의 진행 중(partial) 판과
   * 확정 판이 둘 다 앞줄로 잡혀, 앞 2문장이 실은 앞 1문단인 일이 생깁니다.
   */
  #guessesFor(lineId: Id): Guess[] {
    if (this.#live === null) {
      return guessesForLine(lineId).map((guess) => ({
        id: guess.id,
        label: guess.label,
        term: guess.term,
        // 재생 모드의 질문 문장은 예전처럼 짐작 라벨 그대로입니다(골든 장면을 지킵니다).
        question: guess.label,
        word: guess.term,
      }));
    }
    const { kept, alias } = foldSegments(this.#bundle.transcript);
    const ordered = [...kept].sort((a, b) => a.seq - b.seq);
    const index = ordered.findIndex((item) => item.id === resolveAlias(alias, lineId));
    if (index < 0) return guessesFromSentence("");
    const sentence = ordered[index]?.text ?? "";
    const before = ordered
      .slice(Math.max(0, index - 2), index)
      .reverse()
      .map((item) => item.text);
    return guessesFromSentence(sentence, before, this.#bundle.profile);
  }

  /** 그 붙잡은 순간에 지금까지 도착한 답입니다. 없으면 null 입니다. */
  #answerOf(questionId: Id): Answer | null {
    if (this.#state.machine.questionId === questionId && this.#state.machine.answerId !== null) {
      return this.#bundle.answers[this.#state.machine.answerId] ?? null;
    }
    for (let i = this.#state.received.length - 1; i >= 0; i -= 1) {
      const event = this.#state.received[i];
      if (event === undefined) continue;
      if (event.type !== "answer.completed" && event.type !== "answer.recovered") continue;
      if (stringOf(event.payload, "questionId") !== questionId) continue;
      const answerId = stringOf(event.payload, "answerId");
      if (answerId !== null) return this.#bundle.answers[answerId] ?? null;
    }
    return null;
  }

  /** 재생 모드의 후속 칩 답입니다. fixture 의 `details` 에 있는 것만 씁니다. */
  #fixtureReply(answer: Answer, followUpId: string): Reply {
    const details = answer.details ?? {};
    if (followUpId === "why") {
      return details.why === undefined
        ? { q: "왜 필요한데?", a: answer.conclusion, reason: "이 답에는 이유 절이 아직 없어 결론을 그대로 보여요" }
        : { q: "왜 필요한데?", a: details.why, reason: "수업 자료에서 확인한 내용이에요" };
    }
    if (followUpId === "recent") return this.#recentReply(answer);
    return { q: "더 쉽게", a: answer.conclusion, reason: "더 쉬운 판이 아직 없어 결론을 그대로 보여요" };
  }

  /** "방금 내용" — 답의 진행 줄이 있으면 그것, 없으면 전사 마지막 문장으로 만듭니다. */
  #recentReply(answer: Answer): Reply {
    const last = [...this.#bundle.transcript].sort((a, b) => a.seq - b.seq).at(-1);
    const line =
      answer.nowLine !== undefined
        ? answer.nowLine.replace(/^지금 · /, "")
        : (last?.text ?? "같은 내용을 이어가고 있어요");
    return {
      q: "방금 내용",
      a: `${sessionProfileCopy(this.#bundle.profile).nowPrefix} ${line}`,
      reason: "전사 마지막 문장 기준",
    };
  }

  /** `model-0` 같은 칩 id 를 답이 실어 준 칩 문장으로 바꿉니다. 그 칩이 없으면 null 입니다. */
  #modelChip(answer: Answer, followUpId: string): string | null {
    if (!followUpId.startsWith(MODEL_CHIP_PREFIX)) return null;
    const index = Number.parseInt(followUpId.slice(MODEL_CHIP_PREFIX.length), 10);
    if (!Number.isInteger(index)) return null;
    return answer.chips[index] ?? null;
  }

  /**
   * 후속 질문 하나를 만들어 기록에 남기고 밖으로 묻습니다.
   *
   *     askTyped · followUp ─▶ #ask ─┬─▶ threads[parentId] 에 대기 줄 하나
   *                                  ├─▶ emit question.asked (kind "free")
   *                                  └─▶ AskPort.ask({ kind: "free", question, snapshot })
   *
   * 상태기계는 건드리지 않습니다. 그래서 자세히 화면의 본 답이 그대로 남아 있고, 같은 순간에
   * 몇 번이든 이어 물을 수 있습니다. 답 사건은 `pushEvent` 가 이 스레드로 되돌려 줍니다.
   *
   * 봉인은 **앞 질문이 보던 자리를 잇습니다**(`#followUpSeal`). 듣는 중 화면에서 그냥 적어
   * 보낸 첫 질문은 이을 앞 질문이 없어 마지막 대목을 중심으로 새로 봉인합니다.
   */
  #ask(parentId: Id, label: string, questionText: string): void {
    const now = this.#state.now;
    const at = formatIso(now);
    const questionId = this.#nextQuestionId();
    const snapshot = this.#followUpSeal(parentId, at);
    this.#snapshots.set(questionId, snapshot);
    const question: Question = {
      id: questionId,
      periodId: this.#bundle.periodId,
      askedAt: at,
      kind: "free",
      text: label,
      snapshot,
    };
    this.#bundle = { ...this.#bundle, questions: { ...this.#bundle.questions, [questionId]: question } };
    const thread: FollowUpAsk = {
      id: questionId,
      parentId,
      question: label,
      time: clockOfMs(now),
      state: "waiting",
      answerId: null,
      message: null,
    };
    const asked: SessionEvent = {
      id: this.#nextEventId(),
      periodId: this.#bundle.periodId,
      at,
      type: "question.asked",
      payload: { questionId, kind: "free", question },
    };
    this.#set({
      threads: { ...this.#state.threads, [parentId]: [...(this.#state.threads[parentId] ?? []), thread] },
      emitted: [...this.#state.emitted, asked],
      reply: null,
    });
    for (const listener of this.#emitListeners) listener(asked);
    if (this.#live === null) return;
    // 재생 모드에는 물을 곳이 없습니다. 대기 줄만 남기고 끝냅니다(골든 장면 13).
    this.#askedIds.add(questionId);
    this.#watching.set(questionId, now + this.#askTimeoutMs);
    this.#watchStarted.set(questionId, now);
    this.#live.askPort?.ask({
      questionId,
      provider: this.#env.provider,
      kind: "free",
      question: clampAskQuestion(questionText),
      snapshot,
    });
  }

  /**
   * 후속 스레드의 답 사건이면 그 스레드만 갈아 끼운 새 지도를 돌려줍니다. 아니면 null 입니다.
   * 기계에는 넣지 않습니다 — 후속 답이 본 답 자리를 차지하면 자세히 화면이 통째로 바뀝니다.
   */
  #threadsAfter(event: SessionEvent): Readonly<Record<Id, readonly FollowUpAsk[]>> | null {
    if (!ANSWER_EVENT_TYPES.includes(event.type)) return null;
    const questionId = stringOf(event.payload, "questionId");
    if (questionId === null) return null;
    const parentId = Object.keys(this.#state.threads).find((key) =>
      (this.#state.threads[key] ?? []).some((item) => item.id === questionId),
    );
    if (parentId === undefined) return null;
    const rows = (this.#state.threads[parentId] ?? []).map<FollowUpAsk>((item) => {
      if (item.id !== questionId) return item;
      if (event.type === "answer.completed" || event.type === "answer.recovered") {
        return { ...item, state: "answered", answerId: stringOf(event.payload, "answerId"), message: null };
      }
      if (event.type === "answer.failed") {
        return {
          ...item,
          state: "failed",
          message: stringOf(event.payload, "reason") !== null ? providerFailureText(stringOf(event.payload, "reason")!) : stringOf(event.payload, "message") ?? ASK_TIMEOUT_MESSAGE,
        };
      }
      // `answer.queued` — "줄 세워 뒀다" 는 알림이지 답이 아닙니다. 이미 떠 있는 멈춤 안내를
      // 지우지 않습니다. 지우면 계약의 멈춤 흐름(failed 1초 뒤 queued)에서 안내가 1초만
      // 보이고 사라진 뒤 그 줄이 영영 "답을 만들고 있어요" 로 돕니다(2026-09-03 검토).
      if (item.state === "failed") return item;
      return { ...item, state: "waiting", message: null };
    });
    return { ...this.#state.threads, [parentId]: rows };
  }

  /**
   * 질문 하나에 붙일 수업 맥락을 봉인합니다.
   *
   *   재생(fixture)  예전 그대로 — `sealSnapshot` 의 기본값(지금 시각의 최근 3문단)입니다.
   *                  골든 9장면의 봉인이 fixture 와 한 글자도 달라지면 안 됩니다.
   *   라이브         **물은 자리(`anchorLineId`)를 중심으로** 앞뒤를 넓게 담습니다.
   *
   * @param anchorLineId 학습자가 누른 줄(또는 인용한 줄)입니다. 없으면 마지막 대목이 중심입니다.
   */
  #seal(askedAt: IsoDateTime, anchorLineId: Id | null = null): QuestionSnapshot {
    const around = this.#live === null ? null : this.#contextWindow(askedAt, anchorLineId);
    return sealSnapshot({
      askedAt,
      transcript: around ?? this.#bundle.transcript,
      // 라이브는 창을 여기서 이미 골랐습니다. tutor-core 가 뒤에서 3개로 다시 자르지 않게 합니다.
      ...(around === null ? {} : { recentParagraphs: Math.max(around.length, 1) }),
      frames: this.#bundle.frames,
      // 라이브 자리표시(ec-live-none)는 봉인에 넣지 않습니다. 진짜 문맥이 와야 나이가 셉니다.
      editor: this.#hasEditor ? [this.#bundle.editor] : [],
    });
  }

  /**
   * 라이브 봉인에 담을 전사 창입니다. **물은 자리가 창의 중심**입니다.
   *
   *     …앞 문단 …앞 문단 [물은 문단] 바로 뒤 문단 │ 30초 넘긴 뒤 문단은 버림
   *     └────── 글자 수 상한(2000자)까지 거슬러 담음 ──────┘
   *
   * 전에는 여기가 없었고 `sealSnapshot` 이 **지금 시각의 최근 3조각**을 담았습니다. 그래서
   * 14:12 에 나온 AOP 문장을 인용해 14:18 에 물으면 봉인에는 그 사이 잡담이 실렸습니다
   * (2026-09-03 4교시 실측 사례 ②). 물은 자리와 봉인한 자리가 서로 남남이었습니다.
   *
   * 담기 전에 `foldSegments` 로 접습니다. 진행 중(partial) 판과 확정 판이 같은 문단인데도
   * 자리를 둘 차지해, 실측에서 3자리 중 하나를 `…-partial-51` 이 먹었습니다.
   *
   * 담는 순서는 ① 물은 문단 ② 바로 뒤(30초 안) ③ 남은 자리 전부를 앞쪽으로, 입니다. 앞쪽을
   * 나중에 채우는 까닭은 뒤쪽 자리를 먼저 확보해 두기 위해서입니다 — 반대로 하면 앞이 상한을
   * 다 먹어 바로 뒤 한 문단도 못 담습니다.
   */
  #contextWindow(askedAt: IsoDateTime, anchorLineId: Id | null): readonly TranscriptSegment[] {
    const askedMs = parseIso(askedAt);
    // `kept` 는 시간순입니다(`foldSegments` 설명). 여기서 다시 세우지 않습니다.
    const { kept, alias } = foldSegments(
      this.#bundle.transcript.filter((segment) => parseIso(segment.arrivedAt) <= askedMs),
    );
    if (kept.length === 0) return [];
    // 붙잡아 둔 줄이 그 사이 접혔을 수 있습니다. 이긴 줄로 따라갑니다.
    const wanted = anchorLineId === null || anchorLineId.length === 0 ? null : resolveAlias(alias, anchorLineId);
    const found = wanted === null ? -1 : kept.findIndex((item) => item.id === wanted);
    // 누른 줄이 없으면(자유 질문 · 아직 안 온 줄) 지금 보이는 마지막 대목이 중심입니다.
    const center = found >= 0 ? found : kept.length - 1;
    const anchor = kept[center];
    if (anchor === undefined) return [];

    // ① 물은 문단은 상한을 넘더라도 반드시 담습니다. 이것을 빼면 봉인이 물음과 무관해집니다.
    let used = anchor.text.length;
    let first = center;
    let last = center;

    // ② 바로 뒤 — 같은 호흡으로 이어진 것만.
    const anchorMs = parseIso(anchor.arrivedAt);
    for (let i = center + 1; i < kept.length; i += 1) {
      const next = kept[i];
      if (next === undefined) break;
      if (parseIso(next.arrivedAt) - anchorMs > LIVE_SNAPSHOT_AFTER_MS) break;
      if (used + next.text.length > LIVE_SNAPSHOT_MAX_CHARS) break;
      used += next.text.length;
      last = i;
    }

    // ③ 남은 자리는 전부 앞쪽으로. 중간을 건너뛰지 않고 붙어 있는 데까지만 담습니다.
    for (let i = center - 1; i >= 0; i -= 1) {
      const prev = kept[i];
      if (prev === undefined) break;
      if (used + prev.text.length > LIVE_SNAPSHOT_MAX_CHARS) break;
      used += prev.text.length;
      first = i;
    }

    return kept.slice(first, last + 1);
  }

  /**
   * 이어 묻기의 봉인입니다. **앞 질문이 보던 자리를 그대로 잇습니다.**
   *
   *     Q  "조인 포인트가 뭐예요?"  ─ 봉인: ts-047 … ts-050 (AOP 대목)
   *     └─ 이어 묻기 "더 쉽게"      ─ 봉인: ts-047 … ts-050  ← 같은 자리
   *
   * 새로 봉인하면 그 사이 수업이 흘러간 만큼 창이 통째로 옮겨 가, "더 쉽게" 가 엉뚱한 대목을
   * 가리킵니다. 앞 질문에 이어 묻는 말이므로 보던 자리도 이어야 맞습니다.
   *
   * 전사만 잇고 화면·편집기는 지금 것을 씁니다 — 이어 물을 때 학습자가 보고 있는 화면은
   * 지금 화면이고, 호스트도 화면은 장 수만 셉니다(`materials.rs`).
   *
   * 자료 나이(`ages`)는 이어 물은 시각 기준으로 다시 셉니다. 같은 자료라도 시간이 흐른 만큼
   * 오래된 것이 맞습니다. 앞 질문이 없거나(듣는 중 화면에서 그냥 물은 것) 재생 모드면 새로 봉인합니다.
   */
  #followUpSeal(parentId: Id, askedAt: IsoDateTime): QuestionSnapshot {
    const parent = this.#snapshots.get(parentId) ?? this.#bundle.questions[parentId]?.snapshot;
    if (this.#live === null || parent === undefined) return this.#seal(askedAt);
    const byId = new Map(this.#bundle.transcript.map((segment) => [segment.id, segment] as const));
    const sealed = parent.transcriptSegmentIds
      .map((id) => byId.get(id))
      .filter((segment): segment is TranscriptSegment => segment !== undefined);
    // 앞 질문이 전사를 하나도 못 봤으면(교시 시작 직후에 물은 것) 이을 자리가 없습니다. 새로 봉인합니다.
    if (sealed.length === 0) return this.#seal(askedAt);
    return sealSnapshot({
      askedAt,
      transcript: sealed,
      recentParagraphs: sealed.length,
      frames: this.#bundle.frames,
      editor: this.#hasEditor ? [this.#bundle.editor] : [],
    });
  }

  /** 그 질문의 순간을 이미 만들어 두었는지입니다. 같은 질문은 순간 하나뿐입니다. */
  #hasMomentFor(questionId: string | null): boolean {
    return questionId !== null && this.#state.moments.some((item) => item.questionId === questionId);
  }

  /**
   * 이 질문에 멈춤 안내가 이미 떠 있는지입니다.
   *
   *     이어 물은 줄   threads[*] 의 그 줄이 `failed`
   *     본 질문        기계가 그 질문을 들고 provider 가 `failed`
   */
  #alreadyStopped(questionId: Id): boolean {
    const stoppedThread = Object.values(this.#state.threads).some((rows) =>
      rows.some((item) => item.id === questionId && item.state === "failed"),
    );
    if (stoppedThread) return true;
    const { machine } = this.#state;
    return machine.questionId === questionId && machine.provider === "failed";
  }

  /** 이어 물은 후속 질문인지입니다. 후속은 붙잡은 순간(Moment)을 만들지 않습니다. */
  #isThreadQuestion(questionId: string | null): boolean {
    if (questionId === null) return false;
    return Object.values(this.#state.threads).some((rows) => rows.some((item) => item.id === questionId));
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

  /**
   * 답 사건이 오면 그 질문의 조각 자리를 비웁니다.
   *
   * 네 가지 답 사건 전부에서 비웁니다. `answer.queued` · `answer.failed` 는 답이 아니지만
   * 그 회차의 흐름이 끝났다는 뜻이라, 자라다 만 조각을 그대로 두면 "쓰는 중" 이 영원히
   * 남습니다.
   */
  #clearDelta(event: SessionEvent): void {
    if (!ANSWER_EVENT_TYPES.includes(event.type)) return;
    const questionId = stringOf(event.payload, "questionId");
    if (questionId === null || this.#state.deltas[questionId] === undefined) return;
    const next = { ...this.#state.deltas };
    delete next[questionId];
    this.#set({ deltas: next });
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
