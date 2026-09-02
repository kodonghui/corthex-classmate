// 배럴이 내주는 기본 요소가 정본 jsx 와 같은 참·거짓 판정을 쓰는지 봅니다.
//
// 1라운드에는 internal/base 의 사본을 보는 시험이었습니다. 2라운드에 그 자리가 @classmate/ui-base 로
// 바뀌었으니, 이제는 "갈아 끼운 뒤에도 판정이 그대로인가"를 보는 시험입니다. 이름과 props 가 같아도
// 판정이 다르면 화면이 조용히 바뀝니다(StatusDot 의 label 이 그런 자리입니다).

import { afterEach, describe, expect, it } from "vitest";

import { StatusDot } from "../src/internal/base";
import { cleanupAll, render } from "./render";

afterEach(cleanupAll);

describe("StatusDot", () => {
  it("label 이 있으면 role=status 를 붙이고 글자도 그린다", () => {
    const r = render(<StatusDot state="live" label="기록 중" />);
    const root = r.get("span.cm-sd");
    expect(root.getAttribute("role")).toBe("status");
    expect(root.className).toContain("cm-sd--live");
    expect(root.className).toContain("cm-sd--breathe");
    expect(r.text()).toBe("기록 중");
  });

  it("label 이 없으면 role 을 붙이지 않는다", () => {
    const r = render(<StatusDot state="off" />);
    expect(r.get("span.cm-sd").getAttribute("role")).toBeNull();
    expect(r.all("span.cm-sd > span")).toHaveLength(1);
  });

  it('label="" 이나 label={0} 이면 정본처럼 role 을 붙이지 않는다 — 내용 없는 status 자리를 남기지 않는다', () => {
    const empty = render(<StatusDot state="live" label="" />);
    expect(empty.get("span.cm-sd").getAttribute("role")).toBeNull();
    expect(empty.all("span.cm-sd > span")).toHaveLength(1);
    expect(empty.text()).toBe("");

    const zero = render(<StatusDot state="paused" label={0} />);
    expect(zero.get("span.cm-sd").getAttribute("role")).toBeNull();
    expect(zero.all("span.cm-sd > span")).toHaveLength(1);
    expect(zero.text()).toBe("");
  });
});
