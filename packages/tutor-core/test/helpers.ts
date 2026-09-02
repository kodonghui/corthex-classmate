// 시험이 함께 쓰는 도구들입니다. 시험 파일이 아니므로 vitest 가 여기서는 시험을 찾지 않습니다.
//
// 여기에서만 계약을 **값으로** 들여옵니다(제품 코드는 `import type` 만 씁니다).

import { readFileSync } from "node:fs";

import type {
  EditorContext,
  Question,
  QuestionSnapshot,
  ScreenFrame,
  SessionEvent,
  TranscriptSegment,
} from "@classmate/contracts";

import type { Clock, Scheduler, Cancel, MachineInput, MachineState } from "../src/index";
import { initialState, parseIso } from "../src/index";

/** 골든 시나리오 fixture 폴더입니다. 읽기만 합니다. */
export const GOLDEN_DIR = new URL("../../../fixtures/synthetic-class/golden-ioc/", import.meta.url);

/** 계약 스키마 폴더입니다. 읽기만 합니다. */
export const SCHEMA_DIR = new URL("../../contracts/schemas/", import.meta.url);

export const PERIOD_ID = "2026-09-02-p3";

export function readJson<T>(name: string, base: URL = GOLDEN_DIR): T {
  return JSON.parse(readFileSync(new URL(name, base), "utf8")) as T;
}

/** 한 줄에 하나씩 적힌 JSON 을 읽습니다. 빈 줄은 건너뜁니다. */
export function readJsonl<T>(name: string, base: URL = GOLDEN_DIR): T[] {
  return readFileSync(new URL(name, base), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

export function loadTranscript(): TranscriptSegment[] {
  return readJson<TranscriptSegment[]>("transcript.json");
}

export function loadFrames(): ScreenFrame[] {
  return readJson<ScreenFrame[]>("screen-frames.json");
}

export function loadEditor(): EditorContext {
  return readJson<EditorContext>("editor-context.json");
}

export function loadEvents(): SessionEvent[] {
  return readJsonl<SessionEvent>("session-events.jsonl");
}

export function loadQuestion(name: string): Question {
  return readJson<Question>(name);
}

/** 값이 없으면 시험을 바로 실패시킵니다. noUncheckedIndexedAccess 때문에 필요합니다. */
export function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(`fixture 에 ${what} 가 없습니다`);
  }
  return value;
}

/** 손으로 미는 가짜 시계입니다. */
export class ManualClock implements Clock {
  #t: number;

  constructor(start: number) {
    this.#t = start;
  }

  now(): number {
    return this.#t;
  }

  advance(ms: number): void {
    this.#t += ms;
  }
}

interface PendingJob {
  at: number;
  run: () => void;
  cancelled: boolean;
}

/** 스스로 흐르지 않는 가짜 예약기입니다. 시험이 `runDue()` 로 직접 밉니다. */
export class ManualScheduler implements Scheduler {
  readonly #clock: ManualClock;
  readonly #jobs: PendingJob[] = [];

  constructor(clock: ManualClock) {
    this.#clock = clock;
  }

  schedule(delayMs: number, run: () => void): Cancel {
    const job: PendingJob = { at: this.#clock.now() + delayMs, run, cancelled: false };
    this.#jobs.push(job);
    return () => {
      job.cancelled = true;
    };
  }

  /** 지금 시각이 지난 예약을 한 번씩 실행합니다. */
  runDue(): number {
    let fired = 0;
    for (const job of this.#jobs) {
      if (!job.cancelled && job.at <= this.#clock.now()) {
        job.cancelled = true;
        job.run();
        fired += 1;
      }
    }
    return fired;
  }

  get pending(): number {
    return this.#jobs.filter((job) => !job.cancelled).length;
  }
}

/** 시험용 세션 사건을 하나 만듭니다. */
export function event(
  type: SessionEvent["type"],
  at: string,
  payload: Record<string, unknown> = {},
): SessionEvent {
  return { id: `ev-test-${type}-${at}`, periodId: PERIOD_ID, at, type, payload };
}

/** 사건을 상태기계 입력으로 감쌉니다. */
export function eventInput(e: SessionEvent, snapshot?: QuestionSnapshot): MachineInput {
  return snapshot === undefined
    ? { kind: "event", event: e }
    : { kind: "event", event: e, snapshot };
}

/** 시험에서 쓰는 아주 작은 봉인 묶음입니다. */
export const TINY_SNAPSHOT: QuestionSnapshot = {
  transcriptSegmentIds: ["ts-p3-004"],
  ages: { transcriptSec: 4, screenSec: null, editorSec: null },
};

/** 상태 하나를 손으로 만듭니다. */
export function stateAt(now: number, patch: Partial<MachineState> = {}): MachineState {
  return { ...initialState(now), ...patch };
}

export const T_ASKED = parseIso("2026-09-02T10:32:18+09:00");
