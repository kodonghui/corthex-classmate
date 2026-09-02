// 컴포넌트 25개의 렌더 시험입니다. 하나마다 최소 한 개씩, 주요 props·상태·접근성 속성·문구를 봅니다.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  CodeBlock,
  Dialog,
  Disclosure,
  Evidence,
  Icon,
  IconButton,
  Input,
  PanelHeader,
  Radio,
  RadioGroup,
  Select,
  StatusDot,
  Switch,
  Tabs,
  Tag,
  Toast,
  ToastHost,
  Tooltip,
  tokenizeJava,
} from "../src/index";

describe("core", () => {
  it("Button 은 variant·size 클래스를 붙이고 loading 이면 스스로 잠긴다", () => {
    const { rerender } = render(
      <Button variant="primary" size="lg" icon="bookmark">
        붙잡기
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "붙잡기" });
    expect(btn.className).toContain("cm-btn--primary");
    expect(btn.className).toContain("cm-btn--lg");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.querySelector("svg.cm-icon")).not.toBeNull();

    rerender(<Button loading>붙잡기</Button>);
    const busy = screen.getByRole("button", { name: "붙잡기" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(busy.getAttribute("aria-busy")).toBe("true");
  });

  it("Icon 은 맵에 있는 이름을 그리고, 없는 이름은 경고 뒤 빈 span 을 그린다", () => {
    const { container, rerender } = render(<Icon name="circle-check" size={20} title="확인됨" />);
    const svg = container.querySelector("svg.cm-icon");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("20");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.querySelector("title")?.textContent).toBe("확인됨");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    rerender(<Icon name="ui-base-없는-아이콘" />);
    const span = container.querySelector("span.cm-icon");
    expect(span).not.toBeNull();
    expect(span?.getAttribute("aria-hidden")).toBe("true");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("IconButton 은 label 을 aria-label 과 title 로 함께 쓴다", () => {
    render(<IconButton icon="x" label="닫기" active />);
    const btn = screen.getByRole("button", { name: "닫기" });
    expect(btn.getAttribute("title")).toBe("닫기");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.className).toContain("cm-ibtn--active");
  });
});

describe("forms", () => {
  it("Checkbox 는 label·description 을 붙이고 indeterminate 를 DOM 속성으로 넘긴다", () => {
    render(<Checkbox label="전사 저장" description="최근 30초를 함께 저장해요" indeterminate />);
    const input = screen.getByRole("checkbox") as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
    expect(screen.getByText("전사 저장")).not.toBeNull();
    expect(screen.getByText("최근 30초를 함께 저장해요").className).toBe("cm-check__desc");
  });

  it("Chip 은 selected 를 aria-pressed 로 알린다", () => {
    render(<Chip icon="chevron-right" selected>
      더 쉽게
    </Chip>);
    const chip = screen.getByRole("button", { name: "더 쉽게" });
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(chip.className).toContain("cm-chip--selected");
  });

  it("ChipGroup 은 칩을 감싸는 줄이다", () => {
    const { container } = render(
      <ChipGroup>
        <Chip>왜 필요한데?</Chip>
      </ChipGroup>,
    );
    const group = container.querySelector(".cm-chipgroup");
    expect(group).not.toBeNull();
    expect(group?.querySelectorAll("button").length).toBe(1);
  });

  it("Input 은 label 을 입력과 잇고 invalid 를 aria-invalid 로 알린다", () => {
    const { container } = render(<Input label="검색" hint="두 글자 이상" icon="mic" invalid />);
    const input = screen.getByLabelText("검색") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector(".cm-field--invalid")).not.toBeNull();
    expect(container.querySelector(".cm-input--icon")).not.toBeNull();
    expect(screen.getByText("두 글자 이상").className).toBe("cm-field__hint");
  });

  it("Radio 는 라디오 입력과 설명을 함께 그린다", () => {
    render(<Radio name="speed" value="slow" label="천천히" description="한 줄씩 보여 줘요" />);
    const input = screen.getByRole("radio") as HTMLInputElement;
    expect(input.getAttribute("name")).toBe("speed");
    expect(input.getAttribute("value")).toBe("slow");
    expect(screen.getByText("한 줄씩 보여 줘요")).not.toBeNull();
  });

  it("RadioGroup 은 role=radiogroup 안에 항목을 만들고 고른 것만 checked 다", () => {
    render(
      <RadioGroup
        name="tone"
        value="b"
        options={[
          { value: "a", label: "짧게" },
          { value: "b", label: "보통", description: "기본값이에요" },
          { value: "c", label: "자세히", disabled: true },
        ]}
      />,
    );
    const group = screen.getByRole("radiogroup");
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(group.className).toContain("cm-radiogroup");
    expect(radios.length).toBe(3);
    expect(radios.map((r) => r.checked)).toEqual([false, true, false]);
    expect(radios[2]?.disabled).toBe(true);
  });

  it("Select 는 문자열과 객체 옵션을 모두 받는다", () => {
    render(<Select label="교시" options={["1교시", { value: "2", label: "2교시", disabled: true }]} />);
    const select = screen.getByLabelText("교시") as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    expect(select.options[0]?.value).toBe("1교시");
    expect(select.options[1]?.textContent).toBe("2교시");
    expect(select.options[1]?.disabled).toBe(true);
  });

  it("Switch 는 role=switch 이고 라벨 자리를 바꿀 수 있다", () => {
    const { container } = render(<Switch label="전사 받기" labelPosition="end" defaultChecked />);
    const input = screen.getByRole("switch") as HTMLInputElement;
    expect(input.checked).toBe(true);
    const label = container.querySelector("label.cm-switch");
    // labelPosition="end" 면 텍스트가 트랙 뒤에 옵니다.
    expect(label?.lastElementChild?.className).toBe("cm-switch__text");
  });
});

describe("feedback", () => {
  it("Badge 는 tone 클래스를 붙이고 dot 이면 글자를 감춘다", () => {
    const { container, rerender } = render(<Badge tone="soft">3</Badge>);
    expect(container.querySelector(".cm-badge--soft")?.textContent).toBe("3");
    rerender(<Badge tone="live" dot />);
    const dot = container.querySelector(".cm-badge--dot");
    expect(dot?.textContent).toBe("");
    expect(dot?.className).toContain("cm-badge--live");
  });

  it("Banner 는 role=status 로 무엇이 멈췄는지와 할 일 하나를 말한다", () => {
    render(
      <Banner
        tone="paused"
        title="전사가 잠시 멈췄어요"
        description="화면과 코드는 계속 기록하고 있어요"
        action="다시 연결"
        onDismiss={() => undefined}
      />,
    );
    const banner = screen.getByRole("status");
    expect(banner.className).toContain("cm-banner--paused");
    expect(screen.getByText("전사가 잠시 멈췄어요")).not.toBeNull();
    expect(screen.getByRole("button", { name: "다시 연결" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "닫기" })).not.toBeNull();
  });

  it("Evidence 는 어떻게 아는지를 글자로 함께 적는다(색만으로 구분하지 않음)", () => {
    const { container, rerender } = render(<Evidence type="verified" source="tiro" time="10:32" />);
    const chip = container.querySelector(".cm-ev");
    expect(chip?.className).toContain("cm-ev--verified");
    expect(chip?.textContent).toContain("확인됨");
    expect(chip?.textContent).toContain("전사 10:32");
    expect(chip?.getAttribute("title")).toBe("자료에서 직접 확인한 내용");

    rerender(<Evidence type="inferred" reason="테스트 이야기" block />);
    const inferred = container.querySelector(".cm-ev");
    expect(inferred?.className).toContain("cm-ev--block");
    expect(inferred?.textContent).toContain("추론");
    expect(inferred?.textContent).toContain("테스트 이야기");
  });

  it("StatusDot 은 live 면 기본으로 숨쉬고 라벨이 있으면 role=status 다", () => {
    const { container, rerender } = render(<StatusDot state="live" label="연결됨" />);
    const dot = screen.getByRole("status");
    expect(dot.className).toContain("cm-sd--live");
    expect(dot.className).toContain("cm-sd--breathe");
    rerender(<StatusDot state="off" />);
    const off = container.querySelector(".cm-sd");
    expect(off?.className).toContain("cm-sd--off");
    expect(off?.className).not.toContain("cm-sd--breathe");
  });

  it("Tag 는 메타 글자이고 onRemove 를 주면 × 단추가 생긴다", () => {
    render(
      <Tag tone="accent" icon="clock" mono onRemove={() => undefined}>
        3교시
      </Tag>,
    );
    expect(screen.getByText("3교시").className).toBe("cm-tag__t");
    expect(screen.getByRole("button", { name: "삭제" })).not.toBeNull();
  });

  it("Toast 는 role=status 로 한 줄과 행동 하나를 보여 준다", () => {
    render(<Toast message="저장했어요" icon="circle-check" live action="보기" duration={0} />);
    const toast = screen.getByRole("status");
    expect(toast.textContent).toContain("저장했어요");
    expect(toast.querySelector(".cm-toast__ic--live")).not.toBeNull();
    expect(screen.getByRole("button", { name: "보기" })).not.toBeNull();
  });

  it("ToastHost 는 aria-live 를 켠 바닥 자리다", () => {
    const { container } = render(
      <ToastHost>
        <Toast message="저장했어요" duration={0} />
      </ToastHost>,
    );
    const host = container.querySelector(".cm-toasthost");
    expect(host?.getAttribute("aria-live")).toBe("polite");
  });

  it("Tooltip 은 open 을 주면 그대로 따르고 role=tooltip 을 연결한다", () => {
    const { container } = render(
      <Tooltip content="설정" side="bottom" open>
        <IconButton icon="settings-2" label="설정" />
      </Tooltip>,
    );
    const bubble = screen.getByRole("tooltip");
    expect(bubble.className).toContain("cm-tt__bub--bottom");
    expect(container.querySelector(".cm-tt")?.getAttribute("aria-describedby")).toBe(bubble.id);
  });
});

describe("surfaces", () => {
  it("Card 는 제목·메타·바닥을 그리고 interactive 면 button 이 된다", () => {
    const { container, rerender } = render(
      <Card title="IoC 컨테이너" meta="3교시 · 14:02" footer={<span>바닥</span>} padding={12}>
        본문
      </Card>,
    );
    const card = container.querySelector(".cm-card");
    expect(card?.tagName).toBe("DIV");
    expect(card?.className).toContain("cm-card--p12");
    expect(screen.getByText("3교시 · 14:02").className).toBe("cm-card__meta");
    expect(container.querySelector(".cm-card__footer")?.textContent).toBe("바닥");

    rerender(
      <Card interactive selected>
        고른 카드
      </Card>,
    );
    const btn = screen.getByRole("button", { name: "고른 카드" });
    expect(btn.className).toContain("cm-card--interactive");
    expect(btn.className).toContain("cm-card--selected");
  });

  it("CodeBlock 은 줄 번호·강조 줄을 그리고 inline 이면 code 하나만 그린다", () => {
    const { container, rerender } = render(
      <CodeBlock code={'class A {\n  String s = "x";\n}'} caption="IntelliJ · A.java" source="14:02" lineNumbers highlightLines={[2]} />,
    );
    const lines = container.querySelectorAll(".cm-code__ln");
    expect(lines.length).toBe(3);
    expect(lines[1]?.className).toContain("cm-code__ln--hl");
    expect(container.querySelectorAll(".cm-code__num").length).toBe(3);
    expect(container.querySelector(".cm-code__cap")?.textContent).toContain("IntelliJ · A.java");
    expect(container.querySelector("pre")?.getAttribute("data-language")).toBe("java");

    rerender(<CodeBlock code="new Foo()" inline />);
    const code = container.querySelector("code.cm-code--inline");
    expect(code?.textContent).toBe("new Foo()");
  });

  it("tokenizeJava 는 예약어·타입·문자열·주석·애너테이션을 나눈다", () => {
    const { container } = render(<pre>{tokenizeJava('@Bean public String s = "x"; // 메모')}</pre>);
    expect(container.querySelector(".cm-a")?.textContent).toBe("@Bean");
    expect(container.querySelector(".cm-k")?.textContent).toBe("public");
    expect(container.querySelector(".cm-t")?.textContent).toBe("String");
    expect(container.querySelector(".cm-s")?.textContent).toBe('"x"');
    expect(container.querySelector(".cm-c")?.textContent).toBe("// 메모");
  });

  it("Disclosure 는 닫혀 있고 aria-expanded 로 상태를 알린다", () => {
    const { container } = render(
      <Disclosure label="왜 그런가요" meta="전사 14:02" icon="circle-help" first>
        본문이에요
      </Disclosure>,
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".cm-disc")?.className).toContain("cm-disc--first");
    expect(container.querySelector(".cm-disc__body")).toBeNull();
    expect(screen.getByText("전사 14:02").className).toBe("cm-disc__meta");
  });
});

describe("navigation · overlay", () => {
  it("PanelHeader 는 제목이 없으면 워드마크를, 있으면 제목·교시·시계를 보여 준다", () => {
    const { container, rerender } = render(<PanelHeader />);
    expect(container.querySelector(".cm-ph__wm")?.textContent).toBe("Corthex Classmate");

    rerender(
      <PanelHeader
        title="IoC 컨테이너"
        subtitle="3교시"
        strong
        time="10:32:18"
        status="live"
        onBack={() => undefined}
        actions={<IconButton icon="settings-2" label="설정" />}
      />,
    );
    const header = container.querySelector("header.cm-ph");
    expect(header?.className).toContain("cm-ph--back");
    expect(header?.className).toContain("cm-ph--acts");
    expect(container.querySelector(".cm-ph__d--live")).not.toBeNull();
    expect(container.querySelector(".cm-ph__t")?.textContent).toBe("IoC 컨테이너 · 3교시");
    expect(container.querySelector(".cm-ph__time")?.textContent).toBe("10:32:18");
    expect(screen.getByRole("button", { name: "뒤로" })).not.toBeNull();
  });

  it("Tabs 는 role=tablist 안에서 고른 탭만 aria-selected 다", () => {
    const { container } = render(
      <Tabs
        aria-label="화면"
        value="log"
        items={[
          { id: "now", label: "지금", icon: "mic" },
          { id: "log", label: "기록", count: 2 },
          { id: "set", label: "설정", disabled: true },
        ]}
      />,
    );
    expect(screen.getByRole("tablist").getAttribute("aria-label")).toBe("화면");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(container.querySelector(".cm-badge--soft")?.textContent).toBe("2");
  });

  it("Dialog 는 닫혀 있으면 아무것도 안 그리고, 열리면 role=dialog 다", () => {
    const { container, rerender } = render(<Dialog open={false} title="지울까요" />);
    expect(container.querySelector(".cm-dlg")).toBeNull();

    rerender(
      <Dialog open title="기록을 지울까요" description="되돌릴 수 없어요" primaryAction="지우기" onClose={() => undefined} />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe(screen.getByText("기록을 지울까요").id);
    expect(dialog.getAttribute("aria-describedby")).toBe(screen.getByText("되돌릴 수 없어요").id);
    expect(screen.getByRole("button", { name: "지우기" })).not.toBeNull();
    // × 아이콘 단추와 바닥의 ghost 단추 둘 다 이름이 "닫기" 입니다.
    const closers = screen.getAllByRole("button", { name: "닫기" });
    expect(closers.length).toBe(2);
    expect(closers.some((b) => b.className.includes("cm-btn--ghost"))).toBe(true);
    expect(closers.some((b) => b.className.includes("cm-ibtn"))).toBe(true);
  });
});
