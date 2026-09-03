// 설정 화면이 읽고 쓰는 값 아홉 개와 그 보관소입니다.
//
//   SettingsScreen ──onChange──▶ PanelApp ──writeSetting──▶ SettingsStorage ──▶ chrome.storage.local
//                                    ▲                                             │
//                                    └────────── readSettings ◀────────────────────┘
//
// 규칙:
//  - `chrome` 전역을 **모듈 최상위에서 만지지 않습니다.** 만지면 vitest(env node)가 그 자리에서 깨집니다.
//    보관소는 주입받고, 주입이 없을 때만 `detectSettingsStorage()` 가 그때그때 전역을 살핍니다.
//  - 저장소 값은 못 믿습니다. 모양이 어긋나면 막지 말고 **기본값으로 되돌립니다.** 설정 한 칸이 상해서
//    패널 전체가 멈추는 것보다 그 칸만 기본값으로 뭉치는 편이 덜 나쁩니다(`src/tiro/period.ts` 와 같은 태도).
//  - 키 이름은 2라운드 고정 계약입니다. service worker 가 같은 키를 읽습니다.

import { PERIOD_NUMBER_MAX, PERIOD_NUMBER_MIN, PERIOD_NUMBER_STORAGE_KEY } from "../tiro/period";

/** 답변을 만들 곳입니다. codex 는 한도가 돌아오기 전까지 고를 수 없습니다. */
export type ProviderChoice = "claude" | "codex";

/** 처음에 얼마나 보여 줄지입니다. short = 한 줄만 먼저, full = 바로 자세히. */
export type AnswerLength = "short" | "full";

export interface Settings {
  /** 지금 교시(1~8). `PeriodId` 를 만들 때 씁니다. */
  readonly periodNumber: number;
  readonly provider: ProviderChoice;
  /** 헤더에 뜨는 수업 주제입니다. */
  readonly subject: string;
  /** 18초 뒤 메모를 스스로 접을지입니다. */
  readonly autoFold: boolean;
  /** Alt+S 로 마지막 문장을 붙잡을지입니다. */
  readonly altS: boolean;
  readonly answerLength: AnswerLength;
  readonly captureTranscript: boolean;
  readonly captureScreen: boolean;
  readonly captureEditor: boolean;
}

/** 설정 이름 → `chrome.storage.local` 키. 2라운드 고정 계약(다)입니다. */
export const SETTINGS_KEYS = {
  periodNumber: PERIOD_NUMBER_STORAGE_KEY,
  provider: "classmate.provider",
  subject: "classmate.subject",
  autoFold: "classmate.autoFold",
  altS: "classmate.altS",
  answerLength: "classmate.answerLength",
  captureTranscript: "classmate.capture.transcript",
  captureScreen: "classmate.capture.screen",
  captureEditor: "classmate.capture.editor",
} as const satisfies Readonly<Record<keyof Settings, string>>;

export const DEFAULT_SETTINGS: Settings = {
  periodNumber: PERIOD_NUMBER_MIN,
  provider: "claude",
  subject: "수업",
  autoFold: true,
  altS: true,
  answerLength: "short",
  captureTranscript: true,
  captureScreen: true,
  captureEditor: true,
};

/**
 * 개인정보 세 칸입니다. 불변 원칙 §5 의 정본 문구를 **글자 그대로** 씁니다.
 * 설정의 "붙잡을 때 함께 저장" 바로 아래에 붙습니다(docs/design-map.md §4-1).
 */
export const PRIVACY_CELLS: readonly string[] = [
  "로컬 보관",
  "선택한 AI 제공자로 전송될 수 있음",
  "Corthex 서버 기본 전송 없음",
];

/** 설정을 담아 두는 곳. 주입식이라 시험은 가짜를 넣습니다. */
export interface SettingsStorage {
  get(keys: readonly string[]): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
}

/** `chrome.storage.local` 이 생긴 모양만 적어 둔 것입니다. `chrome` 네임스페이스에 기대지 않습니다. */
export interface StorageAreaLike {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

// ── 값 다듬기 ──────────────────────────────────────────────────────────────────

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asPeriodNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return DEFAULT_SETTINGS.periodNumber;
  if (value < PERIOD_NUMBER_MIN || value > PERIOD_NUMBER_MAX) return DEFAULT_SETTINGS.periodNumber;
  return value;
}

function asProvider(value: unknown): ProviderChoice {
  return value === "codex" || value === "claude" ? value : DEFAULT_SETTINGS.provider;
}

function asAnswerLength(value: unknown): AnswerLength {
  return value === "full" || value === "short" ? value : DEFAULT_SETTINGS.answerLength;
}

function asSubject(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value : DEFAULT_SETTINGS.subject;
}

/**
 * 주제 칸에 친 글을 **저장할 값**으로 다듬습니다.
 *
 * 다 지우면 저장소에는 `""` 가 들어가는데 `asSubject` 는 읽을 때만 기본값으로 되살립니다.
 * 그래서 화면은 빈칸, 다음에 패널을 열면 "수업" 으로 어긋납니다. 빈 값(공백뿐인 값 포함)은
 * 처음부터 기본값으로 맞춰 화면과 저장소를 같게 둡니다.
 */
export function subjectInput(value: string): string {
  return value.trim().length === 0 ? DEFAULT_SETTINGS.subject : value;
}

/**
 * 저장소에서 늦게 도착한 값을 지금 화면 값에 얹을지 정합니다.
 *
 *     읽기 시작 ─────(수십 ms)─────▶ 값 도착
 *                  └ 그 사이 사용자가 스위치를 눌렀으면 **누른 값이 이깁니다**
 *
 * 아직 아무것도 건드리지 않았을 때(= 값이 기본값 그 객체 그대로)만 채웁니다. `changeSetting` 은
 * 늘 새 객체를 만들므로 한 번이라도 눌렀으면 이 검사가 걸러 냅니다.
 */
export function mergeLoadedSettings(previous: Settings, loaded: Settings): Settings {
  return previous === DEFAULT_SETTINGS ? loaded : previous;
}

/** 저장소에서 읽어 온 날것을 설정 한 벌로 다듬습니다. 모르는 값은 기본값이 됩니다. */
export function normalizeSettings(raw: Record<string, unknown>): Settings {
  return {
    periodNumber: asPeriodNumber(raw[SETTINGS_KEYS.periodNumber]),
    provider: asProvider(raw[SETTINGS_KEYS.provider]),
    subject: asSubject(raw[SETTINGS_KEYS.subject]),
    autoFold: asBoolean(raw[SETTINGS_KEYS.autoFold], DEFAULT_SETTINGS.autoFold),
    altS: asBoolean(raw[SETTINGS_KEYS.altS], DEFAULT_SETTINGS.altS),
    answerLength: asAnswerLength(raw[SETTINGS_KEYS.answerLength]),
    captureTranscript: asBoolean(raw[SETTINGS_KEYS.captureTranscript], DEFAULT_SETTINGS.captureTranscript),
    captureScreen: asBoolean(raw[SETTINGS_KEYS.captureScreen], DEFAULT_SETTINGS.captureScreen),
    captureEditor: asBoolean(raw[SETTINGS_KEYS.captureEditor], DEFAULT_SETTINGS.captureEditor),
  };
}

// ── 보관소 ────────────────────────────────────────────────────────────────────

/** 메모리 보관소. 확장 밖(시험 · 브라우저 아닌 곳)에서 씁니다. 새로 고치면 사라집니다. */
export function createMemorySettingsStorage(seed: Record<string, unknown> = {}): SettingsStorage {
  const bag: Record<string, unknown> = { ...seed };
  return {
    get(keys) {
      const out: Record<string, unknown> = {};
      for (const key of keys) {
        if (key in bag) out[key] = bag[key];
      }
      return Promise.resolve(out);
    },
    set(values) {
      Object.assign(bag, values);
      return Promise.resolve();
    },
  };
}

/** `chrome.storage.local` 같은 영역 하나를 보관소로 감쌉니다. */
export function createAreaSettingsStorage(area: StorageAreaLike): SettingsStorage {
  return {
    get: (keys) => area.get([...keys]),
    set: (values) => area.set(values),
  };
}

/**
 * 지금 자리에 `chrome.storage.local` 이 있으면 그것을, 없으면 메모리를 씁니다.
 * **부를 때** 전역을 살핍니다 — 모듈이 실릴 때가 아닙니다.
 */
export function detectSettingsStorage(): SettingsStorage {
  const area = (globalThis as { chrome?: { storage?: { local?: StorageAreaLike } } }).chrome?.storage?.local;
  return area === undefined ? createMemorySettingsStorage() : createAreaSettingsStorage(area);
}

/** 아홉 칸을 한 번에 읽습니다. 저장소가 비어 있으면 전부 기본값입니다. */
export async function readSettings(storage: SettingsStorage): Promise<Settings> {
  const raw = await storage.get(Object.values(SETTINGS_KEYS));
  return normalizeSettings(raw);
}

/** 한 칸만 씁니다. 키 이름은 `SETTINGS_KEYS` 가 정합니다. */
export async function writeSetting<K extends keyof Settings>(
  storage: SettingsStorage,
  key: K,
  value: Settings[K],
): Promise<void> {
  await storage.set({ [SETTINGS_KEYS[key]]: value });
}
