// @vitest-environment happy-dom
//
// 진짜 DOM 에서 눌러 보는 시험입니다. 나머지 화면 시험(`screens/screens.test.tsx`)은 HTML 문자열만
// 만들어 보므로 "눌러도 아무 일이 없다" 를 말할 수 없습니다. 여기서는 실제로 눌러 봅니다.
//
//   설정 화면   아직 배선 안 된 칸(캡처 세 칸 · 답변 길이 · 오늘 기록 지우기)이 정말 잠겨 있는가
//   PanelApp    설정 변경이 굴러가는 스토어에 닿는가 · 늦게 온 저장소 값이 방금 누른 값을 덮는가
//   글씨 크기   고른 그 자리에서 문서 뿌리에 이름표가 붙는가(다시 열 때까지 기다리지 않는가)
//
// happy-dom 은 이미 devDependency 입니다(새 의존성 없음). React 19 의 `act` 로 감쌉니다.

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { GOLDEN_BUNDLE } from "./golden-bundle";
import { detailView } from "./lesson-view";
import { PanelApp } from "./PanelApp";
import { ReplayStore } from "./replay-store";
import { DetailScreen } from "./screens/DetailScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import type { Settings, SettingsStorage } from "./settings-store";
import {
  createMemorySettingsStorage,
  DEFAULT_SETTINGS,
  SETTINGS_KEYS,
  TEXT_SCALE_ATTRIBUTE,
  withTextScaleApplied,
} from "./settings-store";

declare global {
  // React 가 act() 안이라는 것을 알아보는 깃발입니다.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(node: React.ReactNode): HTMLElement {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  const created = createRoot(host);
  root = created;
  act(() => {
    created.render(node);
  });
  return host;
}

afterEach(() => {
  const current = root;
  if (current !== null) act(() => current.unmount());
  host?.remove();
  root = null;
  host = null;
});

/** 라벨 글이 든 칸의 `<input>` 하나입니다. Checkbox·Switch·Radio 모두 `<label>` 로 감쌉니다. */
function inputLabelled(text: string): HTMLInputElement {
  const labels = [...document.querySelectorAll("label")];
  const found = labels.find((label) => (label.textContent ?? "").includes(text));
  const input = found?.querySelector("input");
  if (!(input instanceof HTMLInputElement)) throw new Error(`"${text}" 칸을 찾지 못했어요`);
  return input;
}

/** 글이나 `aria-label` 로 단추 하나를 찾습니다(헤더 설정은 아이콘뿐이라 aria-label 만 있습니다). */
function buttonNamed(text: string): HTMLButtonElement {
  const buttons = [...document.querySelectorAll("button")];
  const found = buttons.find(
    (button) => (button.textContent ?? "").includes(text) || button.getAttribute("aria-label") === text,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`"${text}" 단추를 찾지 못했어요`);
  return found;
}

/** 주제 칸입니다. 지금 값으로 찾습니다(설정 화면의 유일한 글 칸입니다). */
function subjectField(): HTMLInputElement {
  const found = [...document.querySelectorAll("input")].find((item) => item.type === "text" || item.type === "");
  if (!(found instanceof HTMLInputElement)) throw new Error("주제 칸을 찾지 못했어요");
  return found;
}

/**
 * 글 칸에 사람이 친 것처럼 값을 넣습니다.
 *
 * React 는 `<input>` 의 value 를 스스로 지켜보다가 "직접 넣은 값" 은 바뀐 적 없는 것으로 봅니다.
 * 그래서 프로토타입의 setter 로 넣어 그 감시를 지나가게 한 뒤 `input` 사건을 냅니다.
 */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** 칸을 떠납니다. React 의 `onBlur` 는 거품이 이는 `focusout` 을 듣습니다. */
function blur(input: HTMLInputElement): void {
  act(() => {
    input.dispatchEvent(new Event("focusout", { bubbles: true }));
  });
}

/** 아직 대기 중인 약속(설정 읽기)을 흘려 보냅니다. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function click(element: Element): void {
  act(() => {
    (element as HTMLElement).click();
  });
}

interface Change {
  readonly key: keyof Settings;
  readonly value: Settings[keyof Settings];
}

function settingsScreen(values: Settings = DEFAULT_SETTINGS): { changes: Change[]; cleared: number[] } {
  const changes: Change[] = [];
  const cleared: number[] = [];
  mount(
    <SettingsScreen
      values={values}
      count={2}
      onBack={() => {}}
      onChange={(key, value) => changes.push({ key, value })}
      onClearToday={() => cleared.push(1)}
    />,
  );
  return { changes, cleared };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("아직 배선되지 않은 설정 칸", () => {
  it("캡처 세 칸은 잠겨 있고 눌러도 값이 바뀌지 않는다", () => {
    const { changes } = settingsScreen();
    for (const label of ["전사", "Meet 화면", "IntelliJ 코드"]) {
      const box = inputLabelled(label);
      expect(box.disabled).toBe(true);
      click(box);
    }
    expect(changes).toHaveLength(0);
    // 왜 잠갔는지를 그 자리에서 말합니다.
    expect(document.body.textContent).toContain("지금은 세 가지를 늘 함께 저장해요 — 골라 끄기는 다음 라운드에 켜져요");
  });

  it("답변 길이 라디오는 잠겨 있고 눌러도 값이 바뀌지 않는다", () => {
    const { changes } = settingsScreen();
    const full = inputLabelled("바로 자세히");
    expect(full.disabled).toBe(true);
    expect(inputLabelled("한 줄만 먼저").disabled).toBe(true);
    click(full);
    expect(changes).toHaveLength(0);
    expect(document.body.textContent).toContain("지금은 늘 한 줄만 먼저 보여 줘요 — 고르기는 다음 라운드에 켜져요");
  });

  it("오늘 기록 지우기는 잠겨 있어 확인 창이 뜨지 않는다", () => {
    const { cleared } = settingsScreen();
    const button = buttonNamed("오늘 기록 지우기");
    expect(button.disabled).toBe(true);
    click(button);
    // 확인 창이 떴다면 "붙잡은 2개 순간이 사라져요" 라고 거짓 확인을 했을 자리입니다.
    expect(document.body.textContent).not.toContain("오늘 기록을 지울까요");
    expect(cleared).toHaveLength(0);
    expect(document.body.textContent).toContain("아직 지울 수 없어요 — 도우미 삭제 기능은 다음 라운드에 켜져요");
  });

  it("18초 자동 접기와 Alt+S 는 그대로 눌린다", () => {
    const { changes } = settingsScreen();
    click(inputLabelled("18초 뒤 자동으로 접기"));
    click(inputLabelled("단축키 Alt+S"));
    expect(changes).toEqual([
      { key: "autoFold", value: false },
      { key: "altS", value: false },
    ]);
  });
});

describe("주제 칸", () => {
  it("다 지운 채 칸을 떠나면 기본값으로 맞춘다", () => {
    const { changes } = settingsScreen();
    const input = subjectField();
    expect(input.value).toBe(DEFAULT_SETTINGS.subject);
    typeInto(input, "   ");
    blur(input);
    // 저장소에 "" 가 들어가면 화면은 빈칸인데 다음에 열 때 "수업" 으로 되살아납니다.
    expect(changes.at(-1)).toEqual({ key: "subject", value: "수업" });
  });

  it("글자를 치는 동안에는 친 그대로 둔다", () => {
    const { changes } = settingsScreen();
    typeInto(subjectField(), "IoC");
    expect(changes.at(-1)).toEqual({ key: "subject", value: "IoC" });
  });
});

describe("PanelApp — 설정과 스토어", () => {
  it("수업 중에 자동 접기를 끄면 굴러가는 스토어의 접힘 시계가 그 자리에서 풀린다", async () => {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    store.goto("answer");
    expect(store.getState().machine.foldDeadline).not.toBeNull();

    mount(<PanelApp store={store} autoClock={false} settings={createMemorySettingsStorage()} />);
    await flush();
    click(buttonNamed("설정"));
    click(inputLabelled("18초 뒤 자동으로 접기"));

    // 스토어까지 닿지 않으면 메모는 껐다고 말해 놓고 18초 뒤에 접힙니다.
    expect(store.getState().machine.foldDeadline).toBeNull();
  });

  it("늦게 도착한 저장소 값이 방금 누른 값을 되돌리지 않는다", async () => {
    let arrive: ((raw: Record<string, unknown>) => void) | null = null;
    const slow: SettingsStorage = {
      get: () =>
        new Promise((resolve) => {
          arrive = resolve;
        }),
      set: () => Promise.resolve(),
    };
    const store = new ReplayStore(GOLDEN_BUNDLE);
    mount(<PanelApp store={store} autoClock={false} settings={slow} />);
    click(buttonNamed("설정"));

    // 저장소가 아직 대답하기 전에 사용자가 Alt+S 를 끕니다.
    click(inputLabelled("단축키 Alt+S"));
    expect(inputLabelled("단축키 Alt+S").checked).toBe(false);

    // 이제 저장소가 옛 값(켜짐)을 들고 뒤늦게 도착합니다.
    const resolve = arrive as unknown as (raw: Record<string, unknown>) => void;
    await act(async () => {
      resolve({ [SETTINGS_KEYS.altS]: true, [SETTINGS_KEYS.subject]: "IoC 와 DI" });
    });
    expect(inputLabelled("단축키 Alt+S").checked).toBe(false);
  });

  it("아직 아무것도 누르지 않았으면 저장소 값이 화면을 채운다", async () => {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    const storage = createMemorySettingsStorage({ [SETTINGS_KEYS.altS]: false });
    mount(<PanelApp store={store} autoClock={false} settings={storage} />);
    await flush();
    click(buttonNamed("설정"));
    expect(inputLabelled("단축키 Alt+S").checked).toBe(false);
  });
});

describe("글씨 크기", () => {
  /* 이름표는 문서 뿌리에 붙습니다. 한 시험이 남긴 이름표가 다음 시험으로 새지 않게 떼어 냅니다. */
  afterEach(() => {
    document.documentElement.removeAttribute(TEXT_SCALE_ATTRIBUTE);
  });

  /** 덧옷 입힌 보관소로 PanelApp 을 세우고 설정 화면까지 엽니다. */
  async function openSettings(seed: Record<string, unknown> = {}): Promise<void> {
    const storage = withTextScaleApplied(createMemorySettingsStorage(seed), document.documentElement);
    mount(<PanelApp store={new ReplayStore(GOLDEN_BUNDLE)} autoClock={false} settings={storage} />);
    await flush();
    click(buttonNamed("설정"));
  }

  it("고른 그 자리에서 뿌리에 이름표가 붙는다 — 다시 열 때까지 기다리지 않는다", async () => {
    await openSettings();
    // 기본값(보통)에서는 이름표가 없어야 합니다. 골든 장면의 픽셀이 지금과 같아야 하기 때문입니다.
    expect(document.documentElement.hasAttribute(TEXT_SCALE_ATTRIBUTE)).toBe(false);

    click(inputLabelled("크게"));
    expect(document.documentElement.getAttribute(TEXT_SCALE_ATTRIBUTE)).toBe("lg");
    expect(inputLabelled("크게").checked).toBe(true);

    click(inputLabelled("아주 크게"));
    expect(document.documentElement.getAttribute(TEXT_SCALE_ATTRIBUTE)).toBe("xl");

    // 보통으로 되돌리면 이름표를 떼어 원래 크기로 돌아갑니다.
    click(inputLabelled("보통"));
    expect(document.documentElement.hasAttribute(TEXT_SCALE_ATTRIBUTE)).toBe(false);
  });

  it("저장된 단계는 패널을 여는 그때 이미 붙어 있다", async () => {
    await openSettings({ [SETTINGS_KEYS.textScale]: "sm" });
    expect(document.documentElement.getAttribute(TEXT_SCALE_ATTRIBUTE)).toBe("sm");
    expect(inputLabelled("작게").checked).toBe(true);
  });

  it("잠긴 칸들과 달리 이 라디오는 눌립니다", async () => {
    await openSettings();
    for (const label of ["작게", "보통", "크게", "아주 크게"]) {
      expect(inputLabelled(label).disabled).toBe(false);
    }
  });
});

describe("자세히 화면 맨 아래 입력창", () => {
  /** 답까지 받은 자세히 화면을 세웁니다. 입력창은 이 화면에만 있습니다(정본 §3-7). */
  function detailScreen(): { store: ReplayStore; asked: string[] } {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    store.goto("detail");
    const asked: string[] = [];
    const state = store.getState();
    const view = detailView(GOLDEN_BUNDLE, state, store.lines(state.now));
    if (view === null) throw new Error("붙잡은 순간이 없어요");
    mount(<DetailScreen view={view} onBack={() => {}} onFollowUp={() => {}} onAsk={(text) => asked.push(text)} />);
    return { store, asked };
  }

  /** 입력창입니다. 이 화면의 유일한 글 칸입니다. */
  function askField(): HTMLInputElement {
    const found = [...document.querySelectorAll("input")].find((item) => item.type === "text" || item.type === "");
    if (!(found instanceof HTMLInputElement)) throw new Error("입력창을 찾지 못했어요");
    return found;
  }

  function press(input: HTMLInputElement, key: string): void {
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    });
  }

  it("빈 칸이면 보내기가 잠겨 있고 Enter 로도 보내지지 않는다", () => {
    const { asked } = detailScreen();
    expect(buttonNamed("보내기").disabled).toBe(true);
    press(askField(), "Enter");
    expect(asked).toHaveLength(0);
  });

  it("공백만 친 것도 보내지 않는다", () => {
    const { asked } = detailScreen();
    typeInto(askField(), "   ");
    expect(buttonNamed("보내기").disabled).toBe(true);
    press(askField(), "Enter");
    expect(asked).toHaveLength(0);
  });

  it("적고 Enter 를 누르면 그 글이 나가고 칸이 빈다", () => {
    const { asked } = detailScreen();
    typeInto(askField(), "그럼 언제 써요?");
    press(askField(), "Enter");
    expect(asked).toEqual(["그럼 언제 써요?"]);
    expect(askField().value).toBe("");
  });

  it("보내기 단추로도 나간다", () => {
    const { asked } = detailScreen();
    typeInto(askField(), "그럼 언제 써요?");
    click(buttonNamed("보내기"));
    expect(asked).toEqual(["그럼 언제 써요?"]);
  });

  it("상한이 가까울 때만 남은 바이트를 알린다", () => {
    detailScreen();
    typeInto(askField(), "짧은 질문");
    expect(document.body.textContent).not.toContain("바이트 남았어요");
    // 한글 한 글자는 3바이트라 1300자면 3900바이트입니다(남은 196바이트).
    typeInto(askField(), "가".repeat(1_300));
    expect(document.body.textContent).toContain("196바이트 남았어요");
  });
});
