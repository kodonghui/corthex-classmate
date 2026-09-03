// 설정 보관소 — 키 이름(2라운드 고정 계약)과 "상한 값은 기본값으로" 규칙을 지킵니다.

import { describe, expect, it } from "vitest";

import { PERIOD_NUMBER_STORAGE_KEY } from "../tiro/period";
import type { SettingsStorage } from "./settings-store";
import {
  createAreaSettingsStorage,
  createMemorySettingsStorage,
  DEFAULT_SETTINGS,
  detectSettingsStorage,
  normalizeSettings,
  PRIVACY_CELLS,
  readSettings,
  SETTINGS_KEYS,
  writeSetting,
} from "./settings-store";

describe("키와 기본값", () => {
  it("교시 키는 커넥터가 쓰는 키와 같은 값이다", () => {
    expect(SETTINGS_KEYS.periodNumber).toBe(PERIOD_NUMBER_STORAGE_KEY);
    expect(SETTINGS_KEYS.periodNumber).toBe("classmate.periodNumber");
  });

  it("아홉 칸의 키가 고정 계약 그대로이고 글씨 크기 한 칸이 더 있다", () => {
    expect(SETTINGS_KEYS).toEqual({
      periodNumber: "classmate.periodNumber",
      provider: "classmate.provider",
      subject: "classmate.subject",
      autoFold: "classmate.autoFold",
      altS: "classmate.altS",
      answerLength: "classmate.answerLength",
      captureTranscript: "classmate.capture.transcript",
      captureScreen: "classmate.capture.screen",
      captureEditor: "classmate.capture.editor",
      // 이번에 더한 열째 칸입니다. 고정 계약의 아홉 이름은 하나도 바뀌지 않았습니다.
      textScale: "classmate.textScale",
    });
  });

  it("기본값은 claude · 수업 · 1교시 · 전부 켜짐 · short · 보통 글씨다", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      periodNumber: 1,
      provider: "claude",
      subject: "수업",
      autoFold: true,
      altS: true,
      answerLength: "short",
      captureTranscript: true,
      captureScreen: true,
      captureEditor: true,
      textScale: "md",
    });
  });

  it("개인정보 세 칸은 불변 원칙 §5 문구 그대로다", () => {
    expect(PRIVACY_CELLS).toEqual(["로컬 보관", "선택한 AI 제공자로 전송될 수 있음", "Corthex 서버 기본 전송 없음"]);
  });
});

describe("값 다듬기", () => {
  it("빈 저장소는 전부 기본값이 된다", () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("범위 밖 교시와 모르는 제공자는 기본값으로 되돌린다", () => {
    const values = normalizeSettings({
      [SETTINGS_KEYS.periodNumber]: 9,
      [SETTINGS_KEYS.provider]: "gpt",
      [SETTINGS_KEYS.answerLength]: "medium",
      [SETTINGS_KEYS.subject]: "   ",
      [SETTINGS_KEYS.autoFold]: "yes",
    });
    expect(values.periodNumber).toBe(1);
    expect(values.provider).toBe("claude");
    expect(values.answerLength).toBe("short");
    expect(values.subject).toBe("수업");
    expect(values.autoFold).toBe(true);
  });

  it("제대로 든 값은 그대로 읽는다", () => {
    const values = normalizeSettings({
      [SETTINGS_KEYS.periodNumber]: 3,
      [SETTINGS_KEYS.provider]: "codex",
      [SETTINGS_KEYS.subject]: "IoC 컨테이너와 의존성 주입",
      [SETTINGS_KEYS.answerLength]: "full",
      [SETTINGS_KEYS.altS]: false,
      [SETTINGS_KEYS.captureScreen]: false,
    });
    expect(values.periodNumber).toBe(3);
    expect(values.provider).toBe("codex");
    expect(values.subject).toBe("IoC 컨테이너와 의존성 주입");
    expect(values.answerLength).toBe("full");
    expect(values.altS).toBe(false);
    expect(values.captureScreen).toBe(false);
    expect(values.captureTranscript).toBe(true);
  });
});

describe("보관소", () => {
  it("메모리 보관소는 쓴 값을 그대로 돌려준다", async () => {
    const storage = createMemorySettingsStorage();
    await writeSetting(storage, "periodNumber", 5);
    await writeSetting(storage, "subject", "스프링 기초");
    const values = await readSettings(storage);
    expect(values.periodNumber).toBe(5);
    expect(values.subject).toBe("스프링 기초");
    expect(values.provider).toBe("claude");
  });

  it("영역 보관소는 넘긴 키만 물어본다", async () => {
    const asked: string[][] = [];
    const written: Record<string, unknown>[] = [];
    const storage: SettingsStorage = createAreaSettingsStorage({
      get(keys) {
        asked.push(keys);
        return Promise.resolve({ [SETTINGS_KEYS.altS]: false });
      },
      set(items) {
        written.push(items);
        return Promise.resolve();
      },
    });
    const values = await readSettings(storage);
    expect(values.altS).toBe(false);
    expect(asked[0]).toEqual(Object.values(SETTINGS_KEYS));
    await writeSetting(storage, "provider", "codex");
    expect(written).toEqual([{ "classmate.provider": "codex" }]);
  });

  it("chrome 이 없는 자리에서는 메모리 보관소를 고른다", async () => {
    // 이 시험 파일은 env node 로 돕니다. chrome 전역이 없어도 터지지 않아야 합니다.
    expect("chrome" in globalThis).toBe(false);
    const storage = detectSettingsStorage();
    await writeSetting(storage, "answerLength", "full");
    expect((await readSettings(storage)).answerLength).toBe("full");
  });
});
