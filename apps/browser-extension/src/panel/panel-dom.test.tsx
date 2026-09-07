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

import type { Answer, SessionEvent, TranscriptSegment } from "@classmate/contracts";
import { formatIso, parseIso } from "@classmate/tutor-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { GOLDEN_BUNDLE } from "./golden-bundle";
import { detailView } from "./lesson-view";
import { PanelApp } from "./PanelApp";
import type { AskRequest } from "./ports";
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
function typeInto(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** 칸을 떠납니다. React 의 `onBlur` 는 거품이 이는 `focusout` 을 듣습니다. */
function blur(input: HTMLInputElement | HTMLTextAreaElement): void {
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
    for (const label of ["전사", "수업 화면", "IntelliJ 코드"]) {
      const box = inputLabelled(label);
      expect(box.disabled).toBe(true);
      click(box);
    }
    expect(changes).toHaveLength(0);
    // 왜 잠갔는지를 그 자리에서 말합니다.
    expect(document.body.textContent).toContain("지금은 연결된 자료를 늘 함께 저장해요 — 골라 끄기는 다음 라운드에 켜져요");
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

describe("사용 목적", () => {
  it("수업·시험 공부·회의를 모두 고를 수 있고 profile 설정만 바꾼다", () => {
    const { changes } = settingsScreen();
    const profiles = [...document.querySelectorAll<HTMLInputElement>('input[name="session-profile"]')];
    expect(profiles.map((input) => input.value)).toEqual(["class", "exam", "meeting"]);
    expect(profiles.every((input) => !input.disabled)).toBe(true);

    click(inputLabelled("회의"));
    expect(changes).toEqual([{ key: "profile", value: "meeting" }]);
  });

  it("회의 설정에서는 공유 화면만 안내하고 IntelliJ를 필수 자료처럼 보이지 않는다", () => {
    settingsScreen({ ...DEFAULT_SETTINGS, profile: "meeting" });

    expect(inputLabelled("회의").checked).toBe(true);
    expect(document.body.textContent).toContain("공유 화면");
    expect(document.body.textContent).not.toContain("IntelliJ 코드");
  });
});

describe("PanelApp — 설정과 스토어", () => {
  it("주입된 현재 빌드 식별자를 설정 화면까지 그대로 전달합니다", async () => {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    mount(
      <PanelApp
        store={store}
        autoClock={false}
        settings={createMemorySettingsStorage()}
        releaseIdentity="0.0.3+gabcdef12"
      />,
    );
    await flush();
    click(buttonNamed("설정"));
    expect(document.querySelector('.cm-set__meta code')?.textContent).toBe('0.0.3+gabcdef12');
  });

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

  function press(input: HTMLInputElement | HTMLTextAreaElement, key: string): void {
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

// ─────────────────────────────────────────────────────────────────────────────

/*
  듣는 중 화면 아래 약 1/3 을 차지하는 **대화 칸**입니다(단위 A).

    전사   .cm-lecture__scroll   위에서 흐르고 혼자 구릅니다
    경계   .cm-chat__grip           끌거나 화살표로 비율을 바꿉니다(role="separator")
    대화   .cm-chat__log            지난 문답이 쌓이고 혼자 구릅니다
    글 칸  [ 지금 궁금한 걸 적어 주세요 ↑]  누르는 동작 없이 **언제나 열려 있습니다**
    보냄   askTyped → AskPort.ask({ kind: "free" })

  재생(fixture)에는 물을 곳이 없어 대화 칸을 아예 만들지 않습니다 — 골든 9장면이 걸려 있습니다.
*/
describe("듣는 중 화면의 대화 칸", () => {
  const PERIOD = "2026-09-02-p3";
  const START = parseIso("2026-09-02T10:00:00+09:00");

  function segment(seq: number, text: string): TranscriptSegment {
    return {
      id: `ts-ask-${String(seq).padStart(3, "0")}`,
      periodId: PERIOD,
      seq,
      text,
      state: "final",
      arrivedAt: formatIso(START + seq * 1_000),
      source: "tiro-share",
    };
  }

  interface Rig {
    readonly store: ReplayStore;
    /** 밖으로 나간 질문들입니다. */
    readonly asks: AskRequest[];
    /** 전사 한 줄이 더 옵니다. */
    push(seq: number, text: string): void;
    /** 방금 물은 질문에 답 하나를 돌려줍니다. */
    answer(conclusion: string): void;
  }

  /** 전사 한 줄이 이미 와 있는 라이브 패널 하나를 세웁니다. */
  async function liveRig(): Promise<Rig> {
    const asks: AskRequest[] = [];
    const store = ReplayStore.live({
      periodId: PERIOD,
      startMs: START,
      idToken: "asktoken",
      askPort: { ask: (request) => asks.push(request) },
      now: () => START,
    });
    store.pushSegment(segment(1, "객체를 직접 만들면 바꾸기 어려워요"));
    mount(<PanelApp store={store} autoClock={false} settings={createMemorySettingsStorage()} />);
    await flush();
    return {
      store,
      asks,
      push: (seq, text) => {
        act(() => store.pushSegment(segment(seq, text)));
      },
      answer: (conclusion) => {
        const questionId = asks.at(-1)?.questionId;
        if (questionId === undefined) throw new Error("아직 물은 것이 없어요");
        const body: Answer = {
          id: "ans-ask-001",
          questionId,
          createdAt: formatIso(START + 5_000),
          conclusion,
          evidence: "confirmed",
          chips: [],
          provider: "mock",
          status: "answered",
        };
        const arrived: SessionEvent = {
          id: "ev-ask-answer",
          periodId: PERIOD,
          at: formatIso(START + 5_000),
          type: "answer.completed",
          payload: { questionId, answerId: body.id, evidence: "confirmed", provider: "mock", answer: body },
        };
        act(() => store.pushEvent(arrived));
      },
    };
  }

  /** 묻는 칸입니다. 듣는 중 화면의 유일한 글 칸입니다. */
  function askField(): HTMLTextAreaElement {
    const found = document.querySelector('textarea[aria-label="바로 묻기"]');
    if (!(found instanceof HTMLTextAreaElement)) throw new Error("묻는 칸을 찾지 못했어요");
    return found;
  }

  function press(input: HTMLInputElement | HTMLTextAreaElement, key: string): void {
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    });
  }

  /** 전사와 대화 사이의 경계입니다. */

  it("재생 모드에는 대화 칸이 없고 안내 글도 예전 그대로다", async () => {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    store.goto("listening");
    mount(<PanelApp store={store} autoClock={false} settings={createMemorySettingsStorage()} />);
    await flush();
    expect(document.body.textContent).toContain("문장을 누르면 문장 전체를 붙잡아요");
    expect(document.querySelector(".cm-chat")).toBeNull();
    expect([...document.querySelectorAll("input")]).toHaveLength(0);
  });

  it("글 칸은 누르는 동작 없이 처음부터 열려 있다", async () => {
    await liveRig();
    // 예전에는 접힌 한 줄을 눌러야 칸이 나왔습니다. 그 한 번이 사라진 것이 이 단위의 요점입니다.
    expect(document.body.textContent).not.toContain("궁금한 건 여기에 바로 물어보세요");
    expect([...document.querySelectorAll("textarea")]).toHaveLength(1);
    expect(askField().getAttribute("aria-label")).toBe("바로 묻기");
    expect(askField().getAttribute("placeholder")).toBe("지금 궁금한 걸 적어 주세요");
    // 아직 물은 것이 없으면 이 칸이 무엇을 하는 자리인지 한 줄로 말합니다.
    expect(document.body.textContent).toContain("수업 · 질문과 함께 읽기");
  });

  it("전사와 문답은 한 읽기 영역에 있고 입력 칸은 독립적으로 남는다", async () => {
    const rig = await liveRig();
    typeInto(askField(), "이 문장에 대한 질문");
    press(askField(), "Enter");
    const body = document.querySelector(".cm-lecture__scroll");
    const thread = document.querySelector(".cm-study__thread");
    expect(body?.contains(thread)).toBe(true);
    expect(thread?.closest(".cm-inline-conversation")).not.toBeNull();
    expect(body?.contains(askField())).toBe(false);
    expect(document.querySelector(".cm-chat__log")).toBeNull();
    expect(rig.asks).toHaveLength(1);
  });

  it("Esc를 눌러도 작성 중인 질문을 버리지 않는다", async () => {
    const rig = await liveRig();
    typeInto(askField(), "이게 무슨 말이에요?");
    press(askField(), "Escape");
    expect(askField().value).toBe("이게 무슨 말이에요?");
    // 접히지 않습니다 — 늘 열려 있는 것이 이 칸의 약속입니다.
    expect([...document.querySelectorAll("textarea")]).toHaveLength(1);
    expect(rig.asks).toHaveLength(0);
  });

  it("아무것도 안 적고 칸을 떠나도 접히지 않는다", async () => {
    await liveRig();
    blur(askField());
    expect([...document.querySelectorAll("textarea")]).toHaveLength(1);
  });

  it("빈 글과 공백뿐인 글은 나가지 않는다", async () => {
    const rig = await liveRig();
    press(askField(), "Enter");
    typeInto(askField(), "   ");
    expect(buttonNamed("보내기").disabled).toBe(true);
    press(askField(), "Enter");
    expect(rig.asks).toHaveLength(0);
  });

  it("Enter 를 치면 kind free 질문으로 나가고 답을 기다리는 한 줄이 남는다", async () => {
    const rig = await liveRig();
    typeInto(askField(), "지금 그게 왜 필요해요?");
    press(askField(), "Enter");

    expect(rig.asks).toHaveLength(1);
    expect(rig.asks[0]?.kind).toBe("free");
    // 이어 묻기가 아니라 첫 질문이라 "앞선 답은 …" 이 붙지 않고 적은 글이 그대로 나갑니다.
    expect(rig.asks[0]?.question).toBe("지금 그게 왜 필요해요?");

    const asked = rig.store.getState().emitted.filter((event) => event.type === "question.asked");
    expect(asked).toHaveLength(1);
    expect(asked[0]?.payload["kind"]).toBe("free");

    expect(askField().value).toBe("");
    expect(document.body.textContent).toContain("지금 그게 왜 필요해요?");
    expect(document.body.textContent).toContain("답을 만들고 있어요");
  });

  it("답이 오면 결론으로 바뀌고 새 질문을 작성해도 기록은 유지된다", async () => {
    const rig = await liveRig();
    typeInto(askField(), "지금 그게 왜 필요해요?");
    press(askField(), "Enter");
    rig.answer("바꿔 끼울 자리를 남겨 두려고요");

    expect(document.body.textContent).toContain("바꿔 끼울 자리를 남겨 두려고요");
    expect(document.body.textContent).not.toContain("답을 만들고 있어요");

    typeInto(askField(), "다음 질문을 적고 있어요");
    expect(document.body.textContent).toContain("바꿔 끼울 자리를 남겨 두려고요");
  });

  it("주고받은 문답이 대화 칸에 그대로 쌓인다 — 마지막 하나만 남기지 않는다", async () => {
    const rig = await liveRig();
    typeInto(askField(), "첫 번째 질문이에요");
    press(askField(), "Enter");
    rig.answer("첫 번째 답이에요");
    typeInto(askField(), "두 번째 질문이에요");
    press(askField(), "Enter");

    const log = document.querySelector(".cm-lecture__scroll");
    expect(log?.textContent).toContain("첫 번째 질문이에요");
    expect(log?.textContent).toContain("첫 번째 답이에요");
    expect(log?.textContent).toContain("두 번째 질문이에요");
    // 답을 기다리는 줄에는 기다리는 표시가 함께 보입니다.
    expect(log?.textContent).toContain("답을 만들고 있어요");
  });

  /**
   * happy-dom 은 실제 배치를 하지 않아 스크롤 값이 전부 0 입니다("바닥에 있다"로 읽힙니다).
   * 위로 올려 읽는 형편은 그 값을 직접 심어 만듭니다.
   */
  function scrollTranscriptUp(): HTMLElement {
    const found = document.querySelector(".cm-lecture__scroll");
    if (!(found instanceof HTMLElement)) throw new Error("전사 칸을 찾지 못했어요");
    Object.defineProperty(found, "scrollHeight", { value: 900, configurable: true });
    Object.defineProperty(found, "clientHeight", { value: 300, configurable: true });
    Object.defineProperty(found, "scrollTop", { value: 100, writable: true, configurable: true });
    act(() => {
      found.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    return found;
  }

  it("위로 올려 읽는 동안 온 문장은 전사를 끌어내리지 않고 한 줄로만 알린다", async () => {
    const rig = await liveRig();
    const body = scrollTranscriptUp();
    rig.push(2, "그래서 스프링이 대신 만들어 줍니다");

    // 전사는 계속 흐르지만(줄은 화면에 있습니다) 읽던 자리를 바닥으로 끌지 않습니다.
    expect(document.body.textContent).toContain("그래서 스프링이 대신 만들어 줍니다");
    expect(document.body.textContent).toContain("새 수업 · 답변으로 이동");
    expect(body.scrollTop).toBe(100);

    // 눌러서 따라가면 바닥으로 붙고 알림도 사라집니다.
    click(buttonNamed("새 수업 · 답변으로 이동"));
    expect(document.body.textContent).not.toContain("새 수업 · 답변으로 이동");
    expect(body.scrollTop).toBe(900);
  });

  it("바닥에서 듣는 동안에는 새 문장이 그냥 따라옵니다", async () => {
    const rig = await liveRig();
    rig.push(2, "그래서 스프링이 대신 만들어 줍니다");
    expect(document.body.textContent).not.toContain("새 수업 · 답변으로 이동");
  });

  it("뒤 문장이 도착해도 앞 질문은 원 문단 아래에 남는다", async () => {
    const rig = await liveRig();
    typeInto(askField(), "첫 문장 질문");
    press(askField(), "Enter");
    rig.answer("첫 문장 답");
    const first = document.querySelector(".cm-study__thread");
    const anchor = first?.closest("[data-source-line-id]")?.getAttribute("data-source-line-id");
    expect(anchor).toBeTruthy();
    rig.push(2, "새 수업 문장입니다");
    typeInto(askField(), "두번째 문장 질문");
    press(askField(), "Enter");
    expect(document.querySelectorAll(".cm-study__thread")).toHaveLength(2);
    expect(first?.textContent).toContain("첫 문장 답");
    expect(first?.closest("[data-source-line-id]")?.getAttribute("data-source-line-id")).toBe(anchor);
    expect(document.querySelector('[role="separator"]')).toBeNull();
  });
});
