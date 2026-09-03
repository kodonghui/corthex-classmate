// 글씨 크기 네 단계 — 코드가 정한 배수와 CSS 가 실제로 곱하는 배수가 같은지, 그리고 그 결과로
// 나오는 글자 크기가 몇 px 인지 봅니다.
//
// 왜 CSS 파일을 읽는가: 배수는 두 자리에 적혀 있습니다. `settings-store.ts` 의 TEXT_SCALE_STEPS 는
// 화면과 시험이 읽고, `entrypoints/sidepanel/style.css` 의 --text-scale 은 브라우저가 읽습니다.
// 둘이 어긋나면 "크게" 를 골랐는데 다른 크기가 되는데, vitest 에는 브라우저가 없어 스타일 계산으로는
// 잡을 수 없습니다. 그래서 CSS 를 글자로 읽어 맞대어 봅니다. 기준 크기(19px 등)도 토큰 파일에서
// 그대로 읽어 오므로, 여기 적힌 px 은 짐작이 아니라 실제로 나올 값입니다.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { SettingsStorage, TextScale, TextScaleRoot } from "./settings-store";
import {
  applyTextScale,
  createMemorySettingsStorage,
  DEFAULT_SETTINGS,
  normalizeSettings,
  readSettings,
  SETTINGS_KEYS,
  TEXT_SCALE_ATTRIBUTE,
  TEXT_SCALE_STEPS,
  textScaleInput,
  withTextScaleApplied,
  writeSetting,
} from "./settings-store";

/** 확장 쪽 사이드패널 스타일 — 여기서 토큰을 덮습니다. */
const PANEL_CSS = readFileSync(new URL("../../entrypoints/sidepanel/style.css", import.meta.url), "utf8");

/** 기준 크기가 든 토큰 원본입니다. 읽기만 하고 고치지 않습니다. */
const TOKENS_CSS = readFileSync(
  new URL("../../../../packages/design-tokens/src/css/typography.css", import.meta.url),
  "utf8",
);

/** `:root[data-text-scale] { … }` 한 덩어리(뒤에 클래스가 붙은 규칙은 걸리지 않습니다). */
function overrideBlock(): string {
  const match = /:root\[data-text-scale\]\s*\{([^}]*)\}/.exec(PANEL_CSS);
  if (match?.[1] === undefined) throw new Error("style.css 에서 :root[data-text-scale] 덩어리를 찾지 못했어요");
  return match[1];
}

/** CSS 가 그 단계에 주는 배수입니다. 기본값(md)은 규칙이 없고, 그때는 뒷값 1 이 쓰입니다. */
function cssFactor(step: TextScale): number {
  const rule = new RegExp(`:root\\[data-text-scale="${step}"\\]\\s*\\{[^}]*--text-scale:\\s*([0-9.]+)\\s*;`);
  const match = rule.exec(PANEL_CSS);
  return match?.[1] === undefined ? 1 : Number(match[1]);
}

/** 토큰 원본에 적힌 기준 크기(px)입니다. */
function tokenPx(name: string): number {
  const match = new RegExp(`--${name}:\\s*([0-9.]+)px`).exec(TOKENS_CSS);
  if (match?.[1] === undefined) throw new Error(`typography.css 에서 --${name} 를 찾지 못했어요`);
  return Number(match[1]);
}

/** 이름표만 받아 적는 가짜 뿌리입니다. env node 라 진짜 문서가 없습니다. */
function fakeRoot(): { readonly root: TextScaleRoot; readonly read: () => string | null } {
  let value: string | null = null;
  return {
    root: {
      setAttribute(name, next) {
        if (name === TEXT_SCALE_ATTRIBUTE) value = next;
      },
      removeAttribute(name) {
        if (name === TEXT_SCALE_ATTRIBUTE) value = null;
      },
    },
    read: () => value,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("단계와 배수", () => {
  it("네 단계가 작은 것부터 차례대로 있고 보통이 기본값이다", () => {
    expect(TEXT_SCALE_STEPS.map((step) => step.value)).toEqual(["sm", "md", "lg", "xl"]);
    expect(TEXT_SCALE_STEPS.map((step) => step.label)).toEqual(["작게", "보통", "크게", "아주 크게"]);
    expect(DEFAULT_SETTINGS.textScale).toBe("md");
    expect(TEXT_SCALE_STEPS.find((step) => step.value === "md")?.factor).toBe(1);
  });

  it("코드가 적은 배수와 CSS 가 곱하는 배수가 같다", () => {
    for (const step of TEXT_SCALE_STEPS) {
      expect(cssFactor(step.value)).toBe(step.factor);
    }
  });

  it("기본값 단계에는 CSS 규칙이 아예 없다 — 골든 장면의 선언을 하나도 늘리지 않는다", () => {
    expect(PANEL_CSS).not.toContain('[data-text-scale="md"]');
  });
});

describe("네 단계의 글자 크기", () => {
  /*
    기준 19px(전사) · 14px(본문)에 배수를 곱한 값입니다. 배수가 8분의 1 단위라 소수 오차 없이
    딱 떨어집니다. 아래 두 시험은 기준값을 토큰 파일에서 읽어 곱하므로, 토큰이 바뀌면 여기서 걸립니다.
  */
  const TRANSCRIPT_PX: Readonly<Record<TextScale, number>> = { sm: 16.625, md: 19, lg: 21.375, xl: 23.75 };
  const BODY_PX: Readonly<Record<TextScale, number>> = { sm: 12.25, md: 14, lg: 15.75, xl: 17.5 };

  it("전사는 16.625 · 19 · 21.375 · 23.75px 가 된다", () => {
    expect(tokenPx("text-transcript-size")).toBe(19);
    for (const step of TEXT_SCALE_STEPS) {
      expect(tokenPx("text-transcript-size") * cssFactor(step.value)).toBe(TRANSCRIPT_PX[step.value]);
    }
  });

  it("본문은 12.25 · 14 · 15.75 · 17.5px 가 된다", () => {
    expect(tokenPx("text-body-size")).toBe(14);
    for (const step of TEXT_SCALE_STEPS) {
      expect(tokenPx("text-body-size") * cssFactor(step.value)).toBe(BODY_PX[step.value]);
    }
  });

  it("보통 단계는 지금 크기 그대로다", () => {
    expect(TRANSCRIPT_PX.md).toBe(tokenPx("text-transcript-size"));
    expect(BODY_PX.md).toBe(tokenPx("text-body-size"));
  });
});

describe("CSS 가 덮는 범위", () => {
  /* 크기를 키우면서 줄 높이를 두고 오면 줄끼리 붙습니다. 아홉 종류를 둘 다 덮어야 합니다. */
  const KINDS = ["display", "title", "conclusion", "body", "label", "caption", "code", "transcript", "time"];

  it("아홉 종류의 크기와 줄 높이를 모두 같은 배수로 덮는다", () => {
    const block = overrideBlock();
    for (const kind of KINDS) {
      expect(block).toContain(`--text-${kind}-size: calc(`);
      expect(block).toContain(`--text-${kind}-lh: calc(`);
    }
  });

  it("모든 계산식이 var(--text-scale, 1) 로 뒷값을 들고 있다", () => {
    const block = overrideBlock();
    const uses = block.match(/var\(--text-scale[^)]*\)/g) ?? [];
    expect(uses).toHaveLength(KINDS.length * 2);
    for (const use of uses) expect(use).toBe("var(--text-scale, 1)");
  });

  it("여백·아이콘 토큰은 곱하지 않는다 — 글자만 커집니다", () => {
    expect(overrideBlock()).not.toContain("--panel-inset");
    expect(overrideBlock()).not.toContain("--space-");
  });
});

describe("값 다듬기", () => {
  it("모르는 값은 보통으로 되돌린다", () => {
    expect(normalizeSettings({ [SETTINGS_KEYS.textScale]: "huge" }).textScale).toBe("md");
    expect(normalizeSettings({ [SETTINGS_KEYS.textScale]: 2 }).textScale).toBe("md");
    expect(normalizeSettings({}).textScale).toBe("md");
  });

  it("네 단계는 그대로 읽는다", () => {
    for (const step of TEXT_SCALE_STEPS) {
      expect(normalizeSettings({ [SETTINGS_KEYS.textScale]: step.value }).textScale).toBe(step.value);
      expect(textScaleInput(step.value)).toBe(step.value);
    }
    expect(textScaleInput("없는단계")).toBe("md");
  });
});

describe("화면에 얹기", () => {
  it("보통은 이름표를 떼고 나머지는 단계 이름을 단다", () => {
    const { root, read } = fakeRoot();
    applyTextScale(root, "lg");
    expect(read()).toBe("lg");
    applyTextScale(root, "xl");
    expect(read()).toBe("xl");
    applyTextScale(root, "md");
    expect(read()).toBeNull();
  });

  it("패널을 열 때 저장된 단계가 곧바로 얹힌다", async () => {
    const { root, read } = fakeRoot();
    const storage = withTextScaleApplied(
      createMemorySettingsStorage({ [SETTINGS_KEYS.textScale]: "xl" }),
      root,
    );
    expect(read()).toBeNull();
    const values = await readSettings(storage);
    expect(values.textScale).toBe("xl");
    expect(read()).toBe("xl");
  });

  it("고르면 저장이 끝나기 전에 이미 얹혀 있다", () => {
    const { root, read } = fakeRoot();
    // 저장이 영영 끝나지 않는 보관소입니다. 그래도 화면은 그 틱에 바뀌어야 합니다.
    const stuck: SettingsStorage = {
      get: () => Promise.resolve({}),
      set: () => new Promise<void>(() => {}),
    };
    void writeSetting(withTextScaleApplied(stuck, root), "textScale", "lg");
    expect(read()).toBe("lg");
  });

  it("다른 칸을 쓸 때는 이름표를 건드리지 않는다", async () => {
    const { root, read } = fakeRoot();
    const storage = withTextScaleApplied(createMemorySettingsStorage(), root);
    applyTextScale(root, "sm");
    await writeSetting(storage, "subject", "IoC 와 DI");
    expect(read()).toBe("sm");
  });

  it("덧옷을 입어도 읽고 쓴 값은 그대로 흐른다", async () => {
    const { root } = fakeRoot();
    const storage = withTextScaleApplied(createMemorySettingsStorage(), root);
    await writeSetting(storage, "textScale", "sm");
    await writeSetting(storage, "periodNumber", 4);
    const values = await readSettings(storage);
    expect(values.textScale).toBe("sm");
    expect(values.periodNumber).toBe(4);
  });
});
