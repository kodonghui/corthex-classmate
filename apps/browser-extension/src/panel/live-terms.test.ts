import { describe, expect, it } from "vitest";

import { makeLiveTerms, termsInText } from "./live-terms";

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
});

describe("makeLiveTerms", () => {
  it("전사 전체에서 모으고 긴 낱말을 앞에 둔다", () => {
    const terms = makeLiveTerms();
    const got = terms([{ text: "빈 등록" }, { text: "의존성 주입과 AOP" }]);
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
