// 교시 세션 번들 폴더 하나를 읽어 PeriodBundle 로 만듭니다.
//
// 규칙 두 가지입니다.
//   1. 파일이 빠져 있어도 깨지지 않습니다(예: 답이 아직 없는 교시). 빈 배열이나 undefined 로 둡니다.
//   2. JSONL 은 줄 단위로 읽고, 깨진 줄은 건너뛴 뒤 warnings 에 남깁니다.
// 읽어 온 값은 계약대로 생겼다고 믿고 타입을 붙입니다. 검증기는 계약 패키지의 시험에서만 씁니다.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { formatDay } from "./format.ts";
import type {
  Answer,
  EditorContext,
  Question,
  ScreenFrame,
  SessionEvent,
  TranscriptSegment,
} from "@classmate/contracts";
import type { PeriodBundle } from "./types.ts";

/** 번들 폴더에서 찾는 파일 이름입니다. */
const EVENTS_FILE = "session-events.jsonl";
const TRANSCRIPT_FILE = "transcript.json";
const FRAMES_FILE = "screen-frames.json";
const EDITOR_FILE = "editor-context.json";

/** 읽는 중에 생긴 안내를 모으는 상자입니다. */
interface ReadState {
  readonly warnings: string[];
}

function listFiles(dir: string, state: ReadState): string[] {
  try {
    return readdirSync(dir)
      .filter((name) => {
        try {
          return statSync(path.join(dir, name)).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  } catch (error) {
    state.warnings.push(`번들 폴더를 열지 못했어요: ${dir} (${describeError(error)})`);
    return [];
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readTextFile(filePath: string): string | undefined {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    // 파일이 없는 것은 흔한 일입니다(답이 아직 없는 교시). 안내를 남기지 않습니다.
    return undefined;
  }
}

function parseJsonFile(filePath: string, state: ReadState): unknown {
  const text = readTextFile(filePath);
  if (text === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    state.warnings.push(`JSON 을 읽지 못해 건너뛰었어요: ${path.basename(filePath)} (${describeError(error)})`);
    return undefined;
  }
}

function asArray<T>(value: unknown, label: string, state: ReadState): T[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    state.warnings.push(`${label} 은(는) 배열이 아니어서 건너뛰었어요`);
    return [];
  }
  return value as T[];
}

function asObject<T>(value: unknown, label: string, state: ReadState): T[] {
  if (value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value !== "object" || value === null) {
    state.warnings.push(`${label} 은(는) 객체가 아니어서 건너뛰었어요`);
    return [];
  }
  return [value as T];
}

/** JSONL 을 줄 단위로 읽습니다. 깨진 줄은 건너뛰고 몇 번째 줄이었는지 남깁니다. */
export function parseJsonLines<T>(text: string, label: string, warnings: string[]): T[] {
  const rows: T[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] ?? "").trim();
    if (line === "") {
      continue;
    }
    try {
      rows.push(JSON.parse(line) as T);
    } catch (error) {
      warnings.push(`${label} ${i + 1}번째 줄을 읽지 못해 건너뛰었어요 (${describeError(error)})`);
    }
  }
  return rows;
}

function readStringField(payload: unknown, key: string): string | undefined {
  if (payload === null || typeof payload !== "object") {
    return undefined;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function readNumberField(payload: unknown, key: string): number | undefined {
  if (payload === null || typeof payload !== "object") {
    return undefined;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** periodId 끝의 -p3 같은 자리에서 교시 번호를 읽습니다. */
export function periodIndexFromId(periodId: string): number | undefined {
  const matched = /-p(\d+)$/.exec(periodId);
  if (matched?.[1] === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(matched[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** 번들 폴더 하나를 읽습니다. 폴더가 없거나 비어 있어도 빈 번들을 돌려줍니다. */
export function readPeriodBundle(dir: string): PeriodBundle {
  const state: ReadState = { warnings: [] };
  const absoluteDir = path.resolve(dir);
  const fileNames = listFiles(absoluteDir, state);
  const has = (name: string): boolean => fileNames.includes(name);

  const eventsText = has(EVENTS_FILE) ? readTextFile(path.join(absoluteDir, EVENTS_FILE)) : undefined;
  const events =
    eventsText === undefined ? [] : parseJsonLines<SessionEvent>(eventsText, EVENTS_FILE, state.warnings);

  const transcript = asArray<TranscriptSegment>(
    has(TRANSCRIPT_FILE) ? parseJsonFile(path.join(absoluteDir, TRANSCRIPT_FILE), state) : undefined,
    TRANSCRIPT_FILE,
    state,
  ).slice().sort((a, b) => a.seq - b.seq);

  const frames = asArray<ScreenFrame>(
    has(FRAMES_FILE) ? parseJsonFile(path.join(absoluteDir, FRAMES_FILE), state) : undefined,
    FRAMES_FILE,
    state,
  );

  const editorContexts = asObject<EditorContext>(
    has(EDITOR_FILE) ? parseJsonFile(path.join(absoluteDir, EDITOR_FILE), state) : undefined,
    EDITOR_FILE,
    state,
  );

  const questions: Question[] = [];
  const answers: Answer[] = [];
  for (const name of fileNames) {
    if (/^question[^/\\]*\.json$/.test(name)) {
      questions.push(...asObject<Question>(parseJsonFile(path.join(absoluteDir, name), state), name, state));
    } else if (/^answer[^/\\]*\.json$/.test(name)) {
      answers.push(...asObject<Answer>(parseJsonFile(path.join(absoluteDir, name), state), name, state));
    }
  }
  questions.sort((a, b) => a.askedAt.localeCompare(b.askedAt));
  answers.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const startedEvent = events.find((event) => event.type === "period.started");
  const endedEvent = events.find((event) => event.type === "period.ended");

  const periodId =
    startedEvent?.periodId ??
    events[0]?.periodId ??
    transcript[0]?.periodId ??
    questions[0]?.periodId ??
    frames[0]?.periodId ??
    editorContexts[0]?.periodId ??
    path.basename(absoluteDir);

  const index = readNumberField(startedEvent?.payload, "index") ?? periodIndexFromId(periodId);
  const subject = readStringField(startedEvent?.payload, "subject");
  const startedAt = startedEvent?.at ?? events[0]?.at ?? transcript[0]?.arrivedAt;
  const endedAt = endedEvent?.at ?? events[events.length - 1]?.at;
  const dayId = formatDay(startedAt) ?? /^(\d{4}-\d{2}-\d{2})/.exec(periodId)?.[1] ?? "날짜-미상";

  return {
    dir: absoluteDir,
    periodId,
    index,
    dayId,
    subject,
    startedAt,
    endedAt,
    events,
    transcript,
    frames,
    editorContexts,
    questions,
    answers,
    warnings: state.warnings,
  };
}

/** 번들 폴더 여러 개를 한 번에 읽습니다. 교시 번호가 있으면 그 순서로 정렬합니다. */
export function readPeriodBundles(dirs: readonly string[]): PeriodBundle[] {
  return dirs
    .map((dir) => readPeriodBundle(dir))
    .sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER));
}
