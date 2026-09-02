// 눌렀을 때·시간이 지났을 때 무엇이 바뀌는지 보는 시험입니다.
// 이 라운드에는 화면 앱이 없어서 이 렌더 시험들이 e2e 를 대신합니다.

import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { Dialog, Disclosure, Tabs, Toast, ToastHost } from "../src/index";

describe("상호작용", () => {
  it("Disclosure 를 누르면 본문이 열리고 다시 누르면 닫힌다", () => {
    const onToggle = vi.fn();
    render(
      <Disclosure label="왜 그런가요" onToggle={onToggle}>
        객체를 바꾸거나 테스트하기 어려워져요
      </Disclosure>,
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("객체를 바꾸거나 테스트하기 어려워져요").id).toBe(btn.getAttribute("aria-controls"));
    expect(onToggle).toHaveBeenLastCalledWith(true);

    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  it("Tabs 를 누르면 그 탭 id 로 onChange 가 온다", () => {
    const onChange = vi.fn();
    render(
      <Tabs
        value="now"
        onChange={onChange}
        items={[
          { id: "now", label: "지금" },
          { id: "log", label: "기록" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "기록" }));
    expect(onChange).toHaveBeenCalledWith("log");
  });

  it("Dialog 는 열리면 첫 단추에 초점을 주고 Escape·스크림으로 닫힌다", () => {
    const onClose = vi.fn();
    const { container } = render(<Dialog open title="지울까요" primaryAction="지우기" onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog.querySelector("button"));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    const scrim = container.querySelector(".cm-dlg__scrim");
    if (scrim === null) throw new Error("스크림이 없습니다");
    fireEvent.mouseDown(scrim);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("Toast 는 duration 이 지나면 onClose 를 부르고 0 이면 부르지 않는다", () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const { rerender } = render(
        <ToastHost>
          <Toast message="저장했어요" duration={3200} onClose={onClose} />
        </ToastHost>,
      );
      expect(screen.getByRole("status").textContent).toContain("저장했어요");

      act(() => {
        vi.advanceTimersByTime(3199);
      });
      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onClose).toHaveBeenCalledTimes(1);

      rerender(
        <ToastHost>
          <Toast message="저장했어요" duration={0} onClose={onClose} />
        </ToastHost>,
      );
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
