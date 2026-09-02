// Icon 은 정본에서 unpkg 의 lucide UMD 를 런타임에 불러왔습니다. npm lucide-react 로 바꾼 뒤에도
// props 계약(name·size·strokeWidth·title)과 그리는 모양이 같은지 봅니다.

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

  // 아래 두 가지가 이 패키지의 실제 실행 환경입니다. MV3 확장 번들에는 process 가 없고,
  // 배포 빌드에서만 NODE_ENV 가 production 입니다. 경고 판정이 그 둘을 제대로 가르는지 봅니다.
  it("process 가 없는 MV3 번들에서도 오류 없이 경고가 나온다", () => {
    vi.stubGlobal("process", undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = render(<Icon name="mv3-빠진-아이콘" size={16} />);
    expect(r.find("svg")).toBeNull();
    expect(r.get("span.cm-icon").getAttribute("aria-hidden")).toBe("true");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("mv3-빠진-아이콘");
  });

  it("배포 빌드(NODE_ENV=production)에서는 조용히 빈 자리만 남긴다", () => {
    vi.stubGlobal("process", { env: { NODE_ENV: "production" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = render(<Icon name="배포-빠진-아이콘" size={16} />);
    expect(r.find("svg")).toBeNull();
    expect(r.get("span.cm-icon")).toBeTruthy();
    expect(warn).not.toHaveBeenCalled();
  });
});
