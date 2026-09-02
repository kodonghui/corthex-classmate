// 배럴("../src/internal/base")이 내주는 Icon 이 정본 계약대로 그리는지 봅니다.
//
// 2라운드에 Icon 의 알맹이는 @classmate/ui-base 로 옮겼습니다. 여기 시험이 남은 이유는 배럴을 거쳐
// 들어온 물건이 화면에 같은 모양으로 나오는지 보기 위해서입니다(props 계약: name·size·strokeWidth·title).
// 맵에 없는 이름의 개발 경고 판정(`process` 전역이 없는 MV3 번들에서 조용한가)은 ui-base 의 정책이라
// 거기 test/render.test.tsx 가 세 갈래로 봅니다. 여기서 겹쳐 두면 두 시험이 갈라집니다.

import { afterEach, describe, expect, it, vi } from "vitest";

import { Icon } from "../src/internal/base";
import { cleanupAll, render } from "./render";

afterEach(() => {
  cleanupAll();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Icon", () => {
  it("kebab 이름을 lucide 그림으로 바꾸고 size·strokeWidth 를 그대로 쓴다", () => {
    const r = render(<Icon name="circle-check" size={11} />);
    const svg = r.get("svg");
    expect(svg.getAttribute("width")).toBe("11");
    expect(svg.getAttribute("height")).toBe("11");
    expect(svg.getAttribute("stroke-width")).toBe("1.75");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.classList.contains("cm-icon")).toBe(true);
    expect(svg.querySelectorAll("path, circle").length).toBeGreaterThan(0);
  });

  it("title 이 없으면 장식(aria-hidden), 있으면 읽어 주는 그림(role=img)이다", () => {
    const plain = render(<Icon name="mic" />);
    expect(plain.get("svg").getAttribute("aria-hidden")).toBe("true");
    expect(plain.get("svg").getAttribute("role")).toBeNull();

    const titled = render(<Icon name="mic" title="Tiro 전사" />);
    expect(titled.get("svg").getAttribute("role")).toBe("img");
    expect(titled.get("svg").getAttribute("aria-hidden")).toBeNull();
    expect(titled.get("svg title").textContent).toBe("Tiro 전사");
  });

  it('title="" 은 정본처럼 장식으로 지나간다 — 이름 없는 role="img" 를 만들지 않는다', () => {
    const r = render(<Icon name="mic" title="" />);
    expect(r.get("svg").getAttribute("aria-hidden")).toBe("true");
    expect(r.get("svg").getAttribute("role")).toBeNull();
    expect(r.find("svg title")).toBeNull();
  });

  it("맵에 없는 이름은 빈 svg 대신 같은 크기의 빈 자리를 남기고 개발 모드에서 알린다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = render(<Icon name="sparkles" size={16} />);
    expect(r.find("svg")).toBeNull();
    const span = r.get("span.cm-icon");
    expect(span.getAttribute("aria-hidden")).toBe("true");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("sparkles");
  });
});
