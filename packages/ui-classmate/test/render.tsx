// happy-dom 위에서 컴포넌트를 실제로 붙였다 떼는 최소 헬퍼입니다.
// @testing-library 를 새로 들이지 않고 react-dom/client + act 만 씁니다.

import { act } from "react";
import type * as React from "react";
import { createRoot, type Root } from "react-dom/client";

export interface Mounted {
  container: HTMLElement;
  /** 다시 그리기 */
  rerender: (next: React.ReactElement) => void;
  unmount: () => void;
  html: () => string;
  /** CSS 선택자로 하나 찾기. 없으면 시험이 바로 죽도록 던집니다. */
  get: (selector: string) => HTMLElement;
  find: (selector: string) => HTMLElement | null;
  all: (selector: string) => HTMLElement[];
  /** 화면에 보이는 글자 전부 */
  text: () => string;
}

const mounted: Array<{ root: Root; container: HTMLElement }> = [];

export function render(element: React.ReactElement): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  mounted.push({ root, container });
  return {
    container,
    rerender: (next) =>
      act(() => {
        root.render(next);
      }),
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    html: () => container.innerHTML,
    get: (selector) => {
      const el = container.querySelector<HTMLElement>(selector);
      if (el === null) throw new Error(`선택자에 걸리는 요소가 없습니다: ${selector}`);
      return el;
    },
    find: (selector) => container.querySelector<HTMLElement>(selector),
    all: (selector) => Array.from(container.querySelectorAll<HTMLElement>(selector)),
    text: () => container.textContent ?? "",
  };
}

/** 클릭·키 입력처럼 상태를 바꾸는 일은 act 로 감쌉니다. */
export function fire(fn: () => void): void {
  act(fn);
}

export function click(el: HTMLElement): void {
  fire(() => el.click());
}

export function keyDown(el: HTMLElement, key: string, init: KeyboardEventInit = {}): void {
  fire(() => {
    el.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });
}

export function cleanupAll(): void {
  while (mounted.length > 0) {
    const m = mounted.pop();
    if (m === undefined) break;
    act(() => {
      m.root.unmount();
    });
    m.container.remove();
  }
}
