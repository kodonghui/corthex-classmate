// @vitest-environment happy-dom
//
// 진짜 DOM 에서 눌러 보는 시험입니다. 나머지 화면 시험(`screens/screens.test.tsx`)은 HTML 문자열만
// 만들어 보므로 "눌러도 아무 일이 없다" 를 말할 수 없습니다. 여기서는 실제로 눌러 봅니다.
//
//   설정 화면   아직 배선 안 된 칸(캡처 세 칸 · 답변 길이 · 오늘 기록 지우기)이 정말 잠겨 있는가
//   PanelApp    설정 변경이 굴러가는 스토어에 닿는가 · 늦게 온 저장소 값이 방금 누른 값을 덮는가
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
import { createMemorySettingsStorage, DEFAULT_SETTINGS, SETTINGS_KEYS } from "./settings-store";

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

// ─────────────────────────────────────────────────────────────────────────────

/*
  듣는 중 화면 맨 아래 한 줄 묻는 자리(단위 C)입니다.

    접힘  "궁금한 건 여기에 바로 물어보세요"   ← 안내 글 한 줄 자리를 그대로 씁니다
    펼침  [ 지금 궁금한 걸 적어요        ↑ ]  ← 누르거나 포커스가 오면
    보냄  askTyped → AskPort.ask({ kind: "free" })

  재생(fixture)에는 물을 곳이 없어 칸을 아예 만들지 않습니다 — 골든 9장면이 걸려 있습니다.
*/
describe("듣는 중 화면에서 바로 묻기", () => {
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
  function askField(): HTMLInputElement {
    const found = [...document.querySelectorAll("input")].find((item) => item.type === "text" || item.type === "");
    if (!(found instanceof HTMLInputElement)) throw new Error("묻는 칸을 찾지 못했어요");
    return found;
  }

  function press(input: HTMLInputElement, key: string): void {
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    });
  }

  /** 접힌 한 줄을 눌러 칸을 폅니다. */
  function open(): HTMLInputElement {
    click(buttonNamed("궁금한 건 여기에 바로 물어보세요"));
    return askField();
  }

  it("재생 모드에는 칸이 없고 안내 글도 예전 그대로다", async () => {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    store.goto("listening");
    mount(<PanelApp store={store} autoClock={false} settings={createMemorySettingsStorage()} />);
    await flush();
    expect(document.body.textContent).toContain("문장을 누르면 문장 전체를 붙잡아요");
    expect(document.body.textContent).not.toContain("궁금한 건 여기에 바로 물어보세요");
    expect([...document.querySelectorAll("input")]).toHaveLength(0);
  });

  it("평소에는 안내 글 한 줄만큼만 쓰고, 누르면 칸이 펼쳐진다", async () => {
    await liveRig();
    // 접혀 있을 때는 글 칸이 아예 없습니다(세로 자리를 새로 먹지 않습니다).
    expect([...document.querySelectorAll("input")]).toHaveLength(0);
    expect(document.body.textContent).toContain("궁금한 건 여기에 바로 물어보세요");
    expect(open().getAttribute("aria-label")).toBe("바로 묻기");
  });

  it("Esc 는 적던 글을 버리고 칸에서 빠져나온다(키보드만으로 도로 접기)", async () => {
    const rig = await liveRig();
    const input = open();
    typeInto(input, "이게 무슨 말이에요?");
    press(input, "Escape");
    // 글이 비고 포커스도 떠나므로 그 자리는 다시 안내 글 한 줄이 됩니다.
    expect([...document.querySelectorAll("input")]).toHaveLength(0);
    expect(document.body.textContent).toContain("궁금한 건 여기에 바로 물어보세요");
    expect(rig.asks).toHaveLength(0);
  });

  it("아무것도 안 적고 칸을 떠나면 도로 접힌다", async () => {
    await liveRig();
    blur(open());
    expect([...document.querySelectorAll("input")]).toHaveLength(0);
    expect(document.body.textContent).toContain("궁금한 건 여기에 바로 물어보세요");
  });

  it("빈 글과 공백뿐인 글은 나가지 않는다", async () => {
    const rig = await liveRig();
    const input = open();
    press(input, "Enter");
    typeInto(askField(), "   ");
    expect(buttonNamed("보내기").disabled).toBe(true);
    press(askField(), "Enter");
    expect(rig.asks).toHaveLength(0);
  });

  it("Enter 를 치면 kind free 질문으로 나가고 답을 기다리는 한 줄이 남는다", async () => {
    const rig = await liveRig();
    typeInto(open(), "지금 그게 왜 필요해요?");
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

  it("답이 오면 그 자리가 결론으로 바뀌고, 닫으면 도로 조용해진다", async () => {
    const rig = await liveRig();
    typeInto(open(), "지금 그게 왜 필요해요?");
    press(askField(), "Enter");
    rig.answer("바꿔 끼울 자리를 남겨 두려고요");

    expect(document.body.textContent).toContain("바꿔 끼울 자리를 남겨 두려고요");
    expect(document.body.textContent).not.toContain("답을 만들고 있어요");

    click(buttonNamed("답 닫기"));
    expect(document.body.textContent).not.toContain("바꿔 끼울 자리를 남겨 두려고요");
  });

  it("글을 쓰는 동안 온 문장은 조용한 표시로만 알리고, 글을 비우면 사라진다", async () => {
    const rig = await liveRig();
    const input = open();
    typeInto(input, "이거");
    rig.push(2, "그래서 스프링이 대신 만들어 줍니다");

    // 전사는 계속 흐르지만(줄은 화면에 있습니다) 바닥으로 끌지 않고 한 줄로만 알립니다.
    expect(document.body.textContent).toContain("그래서 스프링이 대신 만들어 줍니다");
    expect(document.body.textContent).toContain("새 문장 1개");

    typeInto(askField(), "");
    expect(document.body.textContent).not.toContain("새 문장 1개");
  });
});
