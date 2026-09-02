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
// 2라운드에서 실제 커넥터·세션 스토어가 붙으면 `pushEvent` 가 그 입구가 됩니다.

import type { Id, IsoDateTime, QuestionSnapshot, SessionEvent } from "@classmate/contracts";
import type { Effect, Env, MachineInput, MachineState } from "@classmate/tutor-core";
import { createEnv, formatIso, initialState, parseIso, sealSnapshot, transition } from "@classmate/tutor-core";

import { atClock, clockOfIso, clockOfMs } from "./clock";
import type { GoldenBundle } from "./golden-bundle";
import { GOLDEN_TERMS, guessesForLine } from "./golden-bundle";
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

export interface ReplayStoreOptions {
  readonly env?: Partial<Env>;
  /** 화면에서 새로 붙잡은 질문에 모의 제공자가 답을 돌려주기까지의 시간(ms)입니다. */
  readonly mockAnswerDelayMs?: number;
}

export type Listener = () => void;

export class ReplayStore {
  readonly #bundle: GoldenBundle;
  readonly #env: Env;
  readonly #mockDelayMs: number;
  readonly #listeners = new Set<Listener>();
  #state: ReplayState;
  #pending: SessionEvent[] = [];
  #panelQuestionSeq = 0;
  #emitSeq = 0;
  #mockSeq = 0;

  constructor(bundle: GoldenBundle, options: ReplayStoreOptions = {}) {
    this.#bundle = bundle;
    this.#env = createEnv(bundle.periodId, options.env ?? {});
    this.#mockDelayMs = options.mockAnswerDelayMs ?? 2_000;
    this.#state = this.#fresh();
    this.#step(this.#state.now);
  }

  /** fixture 첫 사건(period.started)의 시각(ms)입니다. */
  get startMs(): number {
    return parseIso(this.#firstEvent().at);
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

  /** 처음 상태로 되돌리고 첫 초의 사건을 다시 받습니다. */
  reset(): void {
    this.#pending = [];
    this.#panelQuestionSeq = 0;
    this.#emitSeq = 0;
    this.#mockSeq = 0;
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

  /** 지금 시계에서 1초 앞으로 갑니다. 화면의 1초 타이머가 부릅니다. */
  tick(): void {
    this.#step(this.#state.now + 1_000);
  }

  /** 밖에서 온 세션 사건 하나를 받습니다. 2라운드에 실제 커넥터·세션 스토어가 붙는 자리입니다. */
  pushEvent(event: SessionEvent): void {
    const received = [...this.#state.received, event];
    if (event.type === "state.changed") {
      // 기계가 스스로 낼 답입니다. 기록만 하고 입력으로 쓰지 않습니다.
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
    this.#stuck(choosing.lineId, guess.term, segKey, choosing.time);
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

  /** fixture 와 같은 날짜의 시각(ms)을 만듭니다. `clockMs("10:32:16")`. */
  clockMs(clock: string): number {
    return parseIso(atClock(this.#firstEvent().at, clock));
  }

  // ── 안쪽 ─────────────────────────────────────────────────────────────────────

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
    this.#apply({ kind: "tick", now: t });
  }

  #apply(input: MachineInput): readonly Effect[] {
    const { next, effects } = transition(this.#state.machine, input, this.#env);
    const emitted = [...this.#state.emitted];
    for (const effect of effects) {
      if (effect.kind === "emit") {
        this.#emitSeq += 1;
        emitted.push({ id: `ev-panel-${String(this.#emitSeq).padStart(4, "0")}`, ...effect.event });
      } else if (effect.kind === "ask" && effect.questionId.startsWith("q-panel-")) {
        this.#mockAnswer(effect.questionId, next.now);
      }
    }
    this.#set({ machine: next, emitted });
    return effects;
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

  #stuck(lineId: Id, word: string, segKey: string | null, time: string): void {
    const now = this.#state.now;
    this.#panelQuestionSeq += 1;
    const questionId = `q-panel-${String(this.#panelQuestionSeq).padStart(3, "0")}`;
    const snapshot = this.#seal(formatIso(now));
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
      editor: [this.#bundle.editor],
    });
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
