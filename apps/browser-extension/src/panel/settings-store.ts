// 설정 화면이 읽고 쓰는 값 열 개와 그 보관소입니다.
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
//
// 이 파일 아래쪽에는 값 하나(글씨 크기)를 **화면에 얹는** 자리도 있습니다. 나머지 아홉 칸은 읽는 쪽이
// 따로 있는데, 글씨 크기는 읽는 쪽이 CSS 라서 뿌리 요소의 이름표(`data-text-scale`)가 곧 읽는 길입니다.

import type { SessionProfileV2 } from "@classmate/contracts";

import {
  DEFAULT_SESSION_PROFILE,
  normalizeSessionProfile,
  SESSION_PROFILE_STORAGE_KEY,
} from "../session-profile";
import { PERIOD_NUMBER_MAX, PERIOD_NUMBER_MIN, PERIOD_NUMBER_STORAGE_KEY } from "../tiro/period";

/** 답변을 만들 곳입니다. codex 는 한도가 돌아오기 전까지 고를 수 없습니다. */
export type ProviderChoice = "claude" | "codex";

/** 처음에 얼마나 보여 줄지입니다. short = 한 줄만 먼저, full = 바로 자세히. */
export type AnswerLength = "short" | "full";

/** 패널 글씨 크기 네 단계입니다. `md` 가 지금까지의 크기(= 기본값)입니다. */
export type TextScale = "sm" | "md" | "lg" | "xl";

export interface Settings {
  /** 수업·시험 공부·회의 중 이 세션을 어떤 목적으로 쓰는지입니다. */
  readonly profile: SessionProfileV2;
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
  /** 패널 글씨 크기입니다. 전사·메모·답변·설명이 **함께** 커지고 줄어듭니다. */
  readonly textScale: TextScale;
}

/**
 * 설정 이름 → `chrome.storage.local` 키. 앞의 아홉 개는 2라운드 고정 계약(다)이라 이름을 바꾸지 않습니다.
 * `textScale` 만 이번에 더한 열째 칸입니다 — 계약의 아홉 개는 그대로 두고 새 이름 하나만 늘렸습니다.
 */
export const SETTINGS_KEYS = {
  profile: SESSION_PROFILE_STORAGE_KEY,
  periodNumber: PERIOD_NUMBER_STORAGE_KEY,
  provider: "classmate.provider",
  subject: "classmate.subject",
  autoFold: "classmate.autoFold",
  altS: "classmate.altS",
  answerLength: "classmate.answerLength",
  captureTranscript: "classmate.capture.transcript",
  captureScreen: "classmate.capture.screen",
  captureEditor: "classmate.capture.editor",
  textScale: "classmate.textScale",
} as const satisfies Readonly<Record<keyof Settings, string>>;

export const DEFAULT_SETTINGS: Settings = {
  profile: DEFAULT_SESSION_PROFILE,
  periodNumber: PERIOD_NUMBER_MIN,
  provider: "claude",
  subject: "수업",
  autoFold: true,
  altS: true,
  answerLength: "short",
  captureTranscript: true,
  captureScreen: true,
  captureEditor: true,
  textScale: "md",
};

export interface TextScaleStep {
  readonly value: TextScale;
  /** 설정 화면의 라디오에 뜨는 이름입니다. */
  readonly label: string;
  /** 글자 크기 토큰에 곱하는 배수입니다. */
  readonly factor: number;
}

/**
 * 글씨 크기 네 단계입니다. 설정 화면이 이 차례대로 라디오를 폅니다.
 *
 * `factor` 는 적어 둔 값일 뿐 **실제 계산은 CSS 가 합니다**
 * (`entrypoints/sidepanel/style.css` 의 `--text-scale`). 여기에도 적는 까닭은 두 가지입니다.
 *  - 어느 단계가 몇 배인지 코드만 읽고도 알 수 있게 하려고,
 *  - `src/panel/text-scale.test.ts` 가 CSS 파일의 값과 이 표를 맞대어 볼 수 있게 하려고.
 *
 * 8분의 1씩 벌렸습니다. 2진수로 딱 떨어지는 값이라 19px·14px 을 곱해도 소수 오차가 생기지 않습니다
 * (19 × 0.875 = 16.625 · 19 × 1.125 = 21.375 · 19 × 1.25 = 23.75).
 */
export const TEXT_SCALE_STEPS: readonly TextScaleStep[] = [
  { value: "sm", label: "작게", factor: 0.875 },
  { value: "md", label: "보통", factor: 1 },
  { value: "lg", label: "크게", factor: 1.125 },
  { value: "xl", label: "아주 크게", factor: 1.25 },
];

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

function asTextScale(value: unknown): TextScale {
  return value === "sm" || value === "md" || value === "lg" || value === "xl" ? value : DEFAULT_SETTINGS.textScale;
}

/** 라디오가 돌려준 글자를 단계 넷 중 하나로 좁힙니다. 모르는 값은 기본값(보통)입니다. */
export function textScaleInput(value: string): TextScale {
  return asTextScale(value);
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
    profile: normalizeSessionProfile(raw[SETTINGS_KEYS.profile]),
    periodNumber: asPeriodNumber(raw[SETTINGS_KEYS.periodNumber]),
    provider: asProvider(raw[SETTINGS_KEYS.provider]),
    subject: asSubject(raw[SETTINGS_KEYS.subject]),
    autoFold: asBoolean(raw[SETTINGS_KEYS.autoFold], DEFAULT_SETTINGS.autoFold),
    altS: asBoolean(raw[SETTINGS_KEYS.altS], DEFAULT_SETTINGS.altS),
    answerLength: asAnswerLength(raw[SETTINGS_KEYS.answerLength]),
    captureTranscript: asBoolean(raw[SETTINGS_KEYS.captureTranscript], DEFAULT_SETTINGS.captureTranscript),
    captureScreen: asBoolean(raw[SETTINGS_KEYS.captureScreen], DEFAULT_SETTINGS.captureScreen),
    captureEditor: asBoolean(raw[SETTINGS_KEYS.captureEditor], DEFAULT_SETTINGS.captureEditor),
    textScale: asTextScale(raw[SETTINGS_KEYS.textScale]),
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

/** 열 칸을 한 번에 읽습니다. 저장소가 비어 있으면 전부 기본값입니다. */
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

// ── 글씨 크기를 화면에 얹기 ─────────────────────────────────────────────────────

/** 문서 뿌리에 다는 이름표입니다. `entrypoints/sidepanel/style.css` 가 이 이름을 봅니다. */
export const TEXT_SCALE_ATTRIBUTE = "data-text-scale";

/**
 * `applyTextScale` 이 실제로 만지는 두 가지만 적은 얼굴입니다.
 * `Element` 를 통째로 요구하지 않아서 env node 시험도 가짜 하나로 확인할 수 있습니다.
 */
export interface TextScaleRoot {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * 고른 단계를 문서 뿌리에 이름표로 답니다. 몇 px 이 되는지는 CSS 가 셉니다.
 *
 *   <html data-text-scale="lg">  ──▶  :root[data-text-scale="lg"] { --text-scale: 1.125 }
 *                                     :root[data-text-scale]      { --text-body-size: calc(14px * var(--text-scale, 1)) … }
 *
 * 기본값(`md`)일 때는 이름표를 **떼어 냅니다.** 붙여 두어도 `calc(14px * 1)` 이라 값은 같지만,
 * 골든 장면에는 선언이 하나도 더 걸리지 않는 편이 안전합니다.
 */
export function applyTextScale(root: TextScaleRoot, scale: TextScale): void {
  if (scale === DEFAULT_SETTINGS.textScale) {
    root.removeAttribute(TEXT_SCALE_ATTRIBUTE);
    return;
  }
  root.setAttribute(TEXT_SCALE_ATTRIBUTE, scale);
}

/**
 * 보관소를 지나는 글씨 크기를 그 자리에서 화면에 얹는 덧옷입니다.
 *
 *   패널 열 때   readSettings ──get──▶ [덧옷] ──▶ 진짜 보관소
 *                                        └──▶ applyTextScale(<html>, 읽은 단계)
 *   고를 때      SettingsScreen ──onChange──▶ PanelApp ──writeSetting──set──▶ [덧옷] ──▶ 진짜 보관소
 *                                                                              └──▶ applyTextScale(<html>, 고른 단계)
 *
 * 왜 보관소에 다는가: 값을 **읽는 길과 바꾸는 길이 둘 다 보관소 하나를 지납니다.** 그래서 이 한 자리만
 * 잡으면 "패널을 열 때 이미 큰 글씨" 와 "고르는 즉시 커짐" 이 함께 됩니다. 설정 화면 쪽에 `useEffect` 를
 * 심으면 설정을 연 동안에만 도는 반쪽이 됩니다.
 *
 * 얹기는 `await` 앞에서 합니다. 누른 그 틱에 이름표가 붙어야 화면이 바로 바뀝니다 — 저장이 끝나기를
 * 기다리면 `chrome.storage.local` 왕복만큼 늦게 커집니다.
 *
 * `?replay=` fixture 경로에는 이 덧옷을 씌우지 않습니다(`entrypoints/sidepanel/App.tsx`).
 * 골든 장면은 늘 기본 크기여야 합니다.
 */
export function withTextScaleApplied(storage: SettingsStorage, root: TextScaleRoot): SettingsStorage {
  return {
    async get(keys) {
      const raw = await storage.get(keys);
      // 글씨 크기 키를 묻지 않은 읽기까지 기본값으로 되돌리면 안 됩니다(그 읽기는 이 값을 모릅니다).
      if (keys.includes(SETTINGS_KEYS.textScale)) applyTextScale(root, asTextScale(raw[SETTINGS_KEYS.textScale]));
      return raw;
    },
    async set(values) {
      if (SETTINGS_KEYS.textScale in values) applyTextScale(root, asTextScale(values[SETTINGS_KEYS.textScale]));
      await storage.set(values);
    },
  };
}
