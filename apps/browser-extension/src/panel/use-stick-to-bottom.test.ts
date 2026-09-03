// @vitest-environment happy-dom
//
// `useStickToBottom` 이 실제 DOM 에서 어떻게 구는지 봅니다.
//
// happy-dom 에는 배치(layout)가 없습니다. `scrollHeight`·`clientHeight` 는 언제나 0 이고
// `scrollTop` 도 잘라 주지 않습니다. 그래서 상자 하나에 그 세 값을 손으로 심어 브라우저 흉내를
// 냅니다(`installMetrics`). 높이는 "열두 글자마다 한 줄로 접히고 접힌 줄 하나가 40px" 로 칩니다 —
// 그래야 **줄 수는 그대로인데 마지막 줄만 길어지는** 진짜 상황(Tiro 가 같은 문단을 자라게 보내는
// 것)을 그대로 만들어 볼 수 있습니다.
//
// 이 파일은 `.ts` 라 JSX 를 쓰지 않고 `createElement` 로 상자를 만듭니다.

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { STICK_TO_BOTTOM_SLACK_PX, useStickToBottom } from "./use-stick-to-bottom";

declare global {
  // React 가 act() 안이라는 것을 알아보는 깃발입니다.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/** 상자의 보이는 높이(px). 사이드패널 본문쯤으로 잡았습니다. */
const VIEW_H = 300;

interface Handle {
  readonly stuck: boolean;
  readonly hasNew: boolean;
  readonly toBottom: () => void;
}

let root: Root | null = null;
let host: HTMLElement | null = null;
let latest: Handle | null = null;
/** 상자가 지금 그리고 있다고 치는 내용의 높이입니다. `scrollHeight` 가 이 값을 읽습니다. */
let contentH = 0;
/** `scrollTop` 이 들고 있는 값입니다. 브라우저처럼 0 과 최대값 사이로 잘립니다. */
let top = 0;
/** 이 시험이 훅에게 준 `startStuck` 입니다. 훅은 첫 그림에서만 읽습니다. */
let startStuck = true;

function Probe({ lines, pins }: { readonly lines: readonly string[]; readonly pins: number }): ReactElement {
  const body = useStickToBottom<HTMLDivElement>({ startStuck, pinOn: pins });
  latest = { stuck: body.stuck, hasNew: body.hasNew, toBottom: body.toBottom };
  return createElement(
    "div",
    { id: "box", ref: body.ref },
    lines.map((line, index) => createElement("p", { key: index }, line)),
  );
}

function box(): HTMLDivElement {
  const found = document.getElementById("box");
  if (!(found instanceof HTMLDivElement)) throw new Error("상자를 찾지 못했어요");
  return found;
}

function handle(): Handle {
  if (latest === null) throw new Error("훅이 아직 안 돌았어요");
  return latest;
}

/** 열두 글자마다 접히고 접힌 줄 하나가 40px 이라고 친 내용 높이입니다. */
function heightOf(lines: readonly string[]): number {
  return lines.reduce((sum, line) => sum + 40 * Math.max(1, Math.ceil(line.length / 12)), 0);
}

/** 실제 전사처럼 길이가 있는 문장들입니다. 이만큼이면 상자보다 확실히 깁니다. */
const BASE = [
  "객체를 직접 new 로 만들면 그 클래스에 딱 붙어 버려요",
  "그래서 스프링은 만드는 일을 컨테이너에게 맡깁니다",
  "생성자 주입은 필요한 것을 밖에서 받아 오는 방법이에요",
  "그러면 시험할 때 가짜 구현을 끼워 넣을 수 있습니다",
] as const;

/** 새로 도착한 다섯째 문장입니다. */
const ARRIVED = "새로 온 다섯째 문장이 화면 아래에 붙었어요";

/** 지금 내용에서 스크롤이 갈 수 있는 가장 아래 값입니다. */
function bottomTop(): number {
  return Math.max(0, contentH - VIEW_H);
}

/** 배치가 없는 happy-dom 상자에 브라우저의 세 값을 심습니다. */
function installMetrics(el: HTMLDivElement): void {
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => contentH });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => VIEW_H });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, bottomTop()));
    },
  });
}

/** 첫 그림을 그리고 값 세 개를 심습니다. 아직 내용은 없습니다. */
function mount(begins = true): void {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  contentH = 0;
  top = 0;
  latest = null;
  startStuck = begins;
  host = document.createElement("div");
  document.body.append(host);
  const created = createRoot(host);
  root = created;
  act(() => created.render(createElement(Probe, { lines: [], pins: 0 })));
  installMetrics(box());
}

/** 새 내용으로 다시 그립니다. 높이는 글자 수에서 나옵니다. `pins` 는 자세히 화면의 이어 물은 줄 수입니다. */
function paint(lines: readonly string[], pins = 0): void {
  contentH = heightOf(lines);
  const current = root;
  if (current === null) throw new Error("먼저 mount() 하세요");
  act(() => current.render(createElement(Probe, { lines, pins })));
}

/**
 * 사람이 스크롤 막대를 끈 것처럼 움직입니다. 브라우저는 값이 바뀐 뒤에 `scroll` 을 냅니다.
 * 우리 코드가 만든 스크롤도 똑같이 `scroll` 을 내므로, 이 함수는 그 둘을 구분하지 않습니다.
 */
function scrollTo(value: number): void {
  const el = box();
  act(() => {
    el.scrollTop = value;
    el.dispatchEvent(new Event("scroll"));
  });
}

afterEach(() => {
  const current = root;
  if (current !== null) act(() => current.unmount());
  host?.remove();
  root = null;
  host = null;
  latest = null;
  startStuck = true;
});

describe("useStickToBottom", () => {
  it("1. 줄 수는 그대로인데 마지막 줄 글자 수만 늘어도 바닥에 붙는다", () => {
    mount();
    const growing = "생성자 주입은 필요한 것을";
    paint([...BASE.slice(0, 2), growing]);
    expect(box().scrollTop).toBe(bottomTop());

    // Tiro 가 같은 문단의 더 긴 판을 보냅니다. 줄 수는 셋 그대로입니다.
    const before = bottomTop();
    paint([...BASE.slice(0, 2), `${growing} 밖에서 받아 오는 방법이에요. 그러면 시험할 때 가짜 구현을 끼워 넣을 수 있습니다`]);
    expect(bottomTop()).toBeGreaterThan(before);
    expect(box().scrollTop).toBe(bottomTop());
    expect(handle().stuck).toBe(true);
    expect(handle().hasNew).toBe(false);
  });

  it("2. 사용자가 위로 올려 두면 새 내용이 와도 그 자리에 있고 hasNew 가 켜진다", () => {
    mount();
    paint(BASE);

    scrollTo(0);
    expect(handle().stuck).toBe(false);

    paint([...BASE, ARRIVED]);
    expect(box().scrollTop).toBe(0);
    expect(handle().stuck).toBe(false);
    expect(handle().hasNew).toBe(true);
  });

  it("3. 다시 바닥 근처로 내려오면 저절로 붙고 hasNew 가 꺼진다", () => {
    mount();
    paint(BASE);
    scrollTo(0);
    paint([...BASE, ARRIVED]);
    expect(handle().hasNew).toBe(true);

    // 바닥까지 딱 맞추지 않고 임계값 안쪽까지만 내려옵니다. 그래도 붙어야 합니다.
    scrollTo(bottomTop() - (STICK_TO_BOTTOM_SLACK_PX - 1));
    expect(handle().stuck).toBe(true);
    expect(handle().hasNew).toBe(false);
    expect(box().scrollTop).toBe(bottomTop());

    // 붙었으니 다음 내용도 따라갑니다.
    paint([...BASE, ARRIVED, "여섯째 문장까지 이어서 들어왔습니다"]);
    expect(box().scrollTop).toBe(bottomTop());
  });

  it("4. 우리가 만든 스크롤은 풀림을 일으키지 않는다", () => {
    mount();
    paint(BASE);
    expect(box().scrollTop).toBe(bottomTop());

    // 브라우저는 `scrollTop = …` 뒤에도 `scroll` 을 냅니다. 그 이벤트를 "사용자가 움직였다" 로
    // 읽었다면 여기서 바로 풀렸을 것입니다.
    act(() => box().dispatchEvent(new Event("scroll")));
    expect(handle().stuck).toBe(true);
    expect(handle().hasNew).toBe(false);

    // 열 번을 더 자라게 해도 붙어 있어야 합니다.
    let lines: readonly string[] = [...BASE];
    for (let step = 0; step < 10; step += 1) {
      lines = [...lines.slice(0, 3), `${lines[3] ?? ""}·자라는 중`];
      paint(lines);
      act(() => box().dispatchEvent(new Event("scroll")));
      expect(box().scrollTop).toBe(bottomTop());
      expect(handle().stuck).toBe(true);
    }
    expect(handle().hasNew).toBe(false);
  });

  it("5. 눌러서 내려가는 자리를 쓰면 다시 붙고 알림이 사라진다", () => {
    mount();
    paint(BASE);
    scrollTo(0);
    paint([...BASE, ARRIVED]);
    expect(handle().hasNew).toBe(true);

    act(() => handle().toBottom());
    expect(box().scrollTop).toBe(bottomTop());
    expect(handle().stuck).toBe(true);
    expect(handle().hasNew).toBe(false);
  });

  it("6. startStuck:false 는 열자마자 바닥으로 내리지 않고, 따라간 적이 없으니 알리지도 않는다", () => {
    // 자세히 화면입니다. 답은 위에서부터 읽으므로 결론이 화면 밖으로 밀리면 안 됩니다.
    mount(false);
    paint(BASE);
    expect(box().scrollTop).toBe(0);
    expect(handle().stuck).toBe(false);

    // 답이 흘러 들어와 길어져도, 따라가고 있던 적이 없으므로 "새 글" 자리를 띄우지 않습니다.
    paint([...BASE, ARRIVED]);
    expect(box().scrollTop).toBe(0);
    expect(handle().hasNew).toBe(false);
  });

  it("7. pinOn 이 바뀌면 그때 바닥으로 내려가고 그 뒤로는 자라는 답을 따라간다", () => {
    mount(false);
    paint(BASE);
    expect(box().scrollTop).toBe(0);

    // 이어 물었습니다. 방금 보낸 질문이 접힌 절 아래에 숨지 않게 바닥으로 내려갑니다.
    paint([...BASE, "이어 물은 질문 · 10:33:02"], 1);
    expect(box().scrollTop).toBe(bottomTop());
    expect(handle().stuck).toBe(true);

    // 답이 한 글자씩 길어집니다. 줄 수는 그대로입니다.
    paint([...BASE, "이어 물은 질문 · 10:33:02 — 스프링은 그 자리를 컨테이너가 채워 줍니다"], 1);
    expect(box().scrollTop).toBe(bottomTop());
    expect(handle().hasNew).toBe(false);
  });
});
