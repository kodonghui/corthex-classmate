// 낱말 판정이 사는 유일한 자리를 봅니다. 2026-09-03 실수업에서 "단어 밑줄이 자기 맘대로"라는
// 말이 나온 결함(상한 2 · 낱말 경계 없음 · 밑줄과 짐작의 잣대가 다름)을 막는 자리입니다.

import { describe, expect, it } from "vitest";

import { isLessonToken, isWordAt, lessonTokens, makeLiveTerms, termsInText } from "./live-terms";
import { splitTerms } from "./transcript-lines";

describe("termsInText", () => {
  it("어노테이션·대문자 약자·가운데 대문자 낱말을 뽑는다", () => {
    const found = termsInText("여기에 @Autowired 를 붙이면 DI 가 되고 enableWebSecurity 도 켜집니다");
    expect(found).toContain("@Autowired");
    expect(found).toContain("DI");
    expect(found).toContain("enableWebSecurity");
  });

  it("사전에 있는 우리말 용어를 글에 나온 것만 뽑는다", () => {
    const found = termsInText("앞에서 배웠던 의존성 주입이 필요한 순간입니다");
    expect(found).toContain("의존성 주입");
    expect(found).not.toContain("트랜잭션");
  });

  it("소문자 Java 예약어도 뽑는다", () => {
    const found = termsInText("객체를 직접 new로 만들면 강하게 묶여요");
    expect(found).toContain("new");
  });

  it("흔한 영어 약자는 밑줄 후보로 두지 않는다", () => {
    expect(termsInText("OK 그러면 TV 를 봅시다")).toEqual([]);
  });

  it("한 글자는 뽑지 않는다", () => {
    expect(termsInText("A 를 B 로 바꿉니다")).toEqual([]);
  });

  it("자격을 갖춘 낱말은 개수를 줄이지 않고 전부 뽑는다", () => {
    // 짐작 목록만 두 개로 줄입니다(`MAX_TOKEN_GUESSES`). 밑줄까지 그 상한에 걸어 두면 한 문단에
    // 낱말이 넷일 때 앞의 둘만 그어져 제멋대로 선 것처럼 보입니다.
    expect(termsInText("before 와 after 와 around 를 쓰면 pointcut 이 필요합니다")).toEqual([
      "before",
      "after",
      "around",
      "pointcut",
    ]);
  });

  it("남의 낱말 안쪽에 박힌 조각은 뽑지 않는다", () => {
    // "인가"(권한) 가 "무엇인가요" 에, "동기" 가 "비동기" · "동기화" 에 박혀 있습니다.
    expect(termsInText("이게 무엇인가요 하고 물어보면 됩니다")).toEqual([]);
    expect(termsInText("비동기 방식으로 갑니다")).toEqual(["비동기"]);
    expect(termsInText("동기화 블록을 걸어요")).not.toContain("동기");
  });

  it("조사와 용언이 붙은 자리는 낱말로 본다", () => {
    expect(termsInText("인가를 나눠 두면 됩니다")).toContain("인가");
    expect(termsInText("부모 클래스를 상속받으면 됩니다")).toContain("상속");
    expect(termsInText("여기서 빈으로 등록합니다")).toContain("빈");
  });

  it("한 글자 용어는 조사가 붙은 자리에서만 낱말로 본다", () => {
    // "빈 화면" 의 "빈"(비어 있다) 과 스프링 빈은 글자만으로 가를 수 없습니다.
    expect(termsInText("빈 화면이 뜹니다")).not.toContain("빈");
    expect(termsInText("빈 등록을 해 둡시다")).toContain("빈 등록");
  });
});

describe("isLessonToken", () => {
  it("밑줄과 짐작이 같은 답을 내도록 자격을 한 자리에서 정한다", () => {
    expect(isLessonToken("@Autowired")).toBe(true);
    expect(isLessonToken("AOP")).toBe(true);
    expect(isLessonToken("DI")).toBe(true);
    expect(isLessonToken("enableWebSecurity")).toBe(true);
    expect(isLessonToken("context.getBean")).toBe(true);
    expect(isLessonToken("new")).toBe(true);
    expect(isLessonToken("before")).toBe(true);
    expect(isLessonToken("Spring")).toBe(true);
    expect(isLessonToken("Map")).toBe(false);
    expect(isLessonToken("OK")).toBe(false);
    expect(isLessonToken("A")).toBe(false);
  });
});

describe("lessonTokens", () => {
  it("나온 순서대로 전부 돌려주고 개수를 줄이지 않는다", () => {
    expect(lessonTokens("AOP 와 DI 와 OrderService 와 @Around 를 봅니다")).toEqual([
      "AOP",
      "DI",
      "OrderService",
      "@Around",
    ]);
  });
});

describe("isWordAt", () => {
  it("앞뒤로 낱말이 이어지면 낱말 자리가 아니다", () => {
    expect(isWordAt("무엇인가요", "인가", 2)).toBe(false);
    expect(isWordAt("인가를 나눕니다", "인가", 0)).toBe(true);
    expect(isWordAt("동기화 블록", "동기", 0)).toBe(false);
    expect(isWordAt("비동기 방식", "동기", 1)).toBe(false);
    expect(isWordAt("newValue 를 씁니다", "new", 0)).toBe(false);
    expect(isWordAt("new 로 만들면", "new", 0)).toBe(true);
  });
});

describe("2026-09-03 실수업 전사", () => {
  // 실제로 무엇에 밑줄이 서는지 눈으로 확인하는 자리입니다. 기대는 "수업의 핵심 낱말에 서고
  // 흔한 말에는 안 서는 것" 입니다.
  const lines = [
    "로깅 에스펙트 쪽에 와주시면 됩니다. 우리가 before랑 after라고 하는 그 어드바이스를 끼워 넣어 봤는데, 그 인텔리지에는 아이콘으로 힌트를 많이 준다라고 했었잖아요.",
    "자, 그러면 이 before랑 after를 합쳐 놓은. 어라운드. 있거든요. 이거는 뒤에서 볼 건데, 아이콘만 보여드릴게요.",
    "바로 주석 적으면은 조금 졸릴 수도 있겠지만, 그래도 이론적인 내용은 한번 짚고 넘어가야 됩니다. 자, 골뱅이 에스펙트라고 하는 이 위에다가.",
  ];

  it("수업의 핵심 낱말에 밑줄이 서고 흔한 말에는 안 선다", () => {
    const terms = makeLiveTerms()(lines.map((text) => ({ text })));
    expect(terms).toEqual(
      expect.arrayContaining(["로깅", "에스펙트", "어드바이스", "어라운드", "주석", "before", "after"]),
    );
    for (const common of ["이렇게", "보면은", "아이콘", "힌트", "이거는"]) {
      expect(terms).not.toContain(common);
    }
  });

  it("점선이 실제로 그 낱말 자리에만 그어진다", () => {
    const terms = makeLiveTerms()(lines.map((text) => ({ text })));
    const underlined = lines.flatMap((line) =>
      splitTerms(line, terms)
        .filter((piece) => piece.term === true)
        .map((piece) => piece.text),
    );
    expect(underlined).toEqual([
      "로깅",
      "에스펙트",
      "before",
      "after",
      "어드바이스",
      "before",
      "after",
      "어라운드",
      "주석",
      "에스펙트",
    ]);
  });
});

describe("makeLiveTerms", () => {
  it("전사 전체에서 모으고 긴 낱말을 앞에 둔다", () => {
    const terms = makeLiveTerms();
    const got = terms([{ text: "빈으로 등록하면" }, { text: "의존성 주입과 AOP" }]);
    expect(got).toContain("빈");
    expect(got).toContain("의존성 주입");
    expect(got.indexOf("의존성 주입")).toBeLessThan(got.indexOf("빈"));
  });

  it("조각 수와 마지막 글 길이가 같으면 지난 결과를 그대로 쓴다", () => {
    const terms = makeLiveTerms();
    const first = terms([{ text: "프록시" }]);
    expect(terms([{ text: "프록시" }])).toBe(first);
  });

  it("진행 중 문단이 길어지면 다시 센다", () => {
    const terms = makeLiveTerms();
    const first = terms([{ text: "프록시" }]);
    const second = terms([{ text: "프록시와 트랜잭션" }]);
    expect(second).not.toBe(first);
    expect(second).toContain("트랜잭션");
  });
});
