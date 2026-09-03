// 붙잡은 문장에서 짐작과 질문 문장을 만드는 순수 함수들을 봅니다.
// 2026-09-03 실측에서 라이브가 fixture 짐작을 그대로 보여 주어 생긴 결함을 막는 자리입니다.

import { describe, expect, it } from "vitest";

import {
  askAboutSentence,
  askAboutToken,
  clampAskQuestion,
  followUpQuestion,
  MAX_ASK_QUESTION_BYTES,
  normalizeAskText,
  utf8ByteLength,
} from "./ask-text";
import { codeTokens, guessesFromSentence, looksLikeCode, WHOLE_SENTENCE_LABEL } from "./guesses";

describe("codeTokens", () => {
  it("코드처럼 생긴 낱말을 앞에 둔다", () => {
    expect(codeTokens(["Spring 에서 enableWebSecurity 를 켭니다"])).toEqual(["enableWebSecurity", "Spring"]);
  });

  it("어노테이션과 점 표기도 한 낱말로 본다", () => {
    expect(codeTokens(["@EnableAspectJAutoProxy 를 붙이면 context.getBean 이 됩니다"])).toEqual([
      "@EnableAspectJAutoProxy",
      "context.getBean",
    ]);
  });

  it("세 글자짜리 그냥 영어와 한글만 있는 문장에서는 아무것도 뽑지 않는다", () => {
    expect(codeTokens(["Map 을 하나 만듭니다"])).toEqual([]);
    expect(codeTokens(["이제 생성 책임을 컨테이너에 맡겨 볼게요"])).toEqual([]);
  });

  it("밑줄이 그어지는 낱말은 짐작에도 나온다", () => {
    // 자격 판정이 `live-terms.isLessonToken` 한 곳이라 두 쓰임이 같은 답을 냅니다.
    // 예전에는 여기만 네 글자 이상을 요구해 `new` · `AOP` 가 밑줄만 되고 짐작에는 없었습니다.
    expect(codeTokens(["Map 과 new 를 씁니다"])).toEqual(["new"]);
    expect(codeTokens(["AOP 와 DI 를 봅니다"])).toEqual(["AOP", "DI"]);
  });

  it("같은 낱말은 대소문자를 무시하고 한 번만 센다", () => {
    expect(codeTokens(["OrderService 와 orderservice 와 PaymentGateway"])).toEqual([
      "OrderService",
      "PaymentGateway",
    ]);
  });

  it("가까운 글이 앞에 오도록 넘긴 순서를 지킨다", () => {
    // 붙잡은 문장에 코드 낱말이 없으면 바로 앞 문장에서 가져옵니다.
    expect(codeTokens(["뭔가를 또 타이핑을 해 줘야 되는데", "여기에 enableWebSecurity 를 켜 주면"])).toEqual([
      "enableWebSecurity",
    ]);
  });

  it("몇 개까지 뽑을지는 부르는 쪽이 정한다", () => {
    expect(codeTokens(["alphaBeta gammaDelta epsilonZeta"], 1)).toEqual(["alphaBeta"]);
  });
});

describe("looksLikeCode", () => {
  it("어노테이션 · 점 · 밑줄 · 낙타등이면 코드처럼 본다", () => {
    expect(looksLikeCode("@Bean")).toBe(true);
    expect(looksLikeCode("context.getBean")).toBe(true);
    expect(looksLikeCode("MAX_SIZE")).toBe(true);
    expect(looksLikeCode("OrderService")).toBe(true);
    expect(looksLikeCode("Spring")).toBe(false);
  });
});

describe("guessesFromSentence", () => {
  it("코드 낱말 최대 2개 뒤에 언제나 문장 전체가 온다", () => {
    const guesses = guessesFromSentence("여기서 enableWebSecurity 와 @EnableAspectJAutoProxy 를 켭니다");
    expect(guesses.map((item) => item.label)).toEqual([
      "enableWebSecurity 가 뭔지",
      "@EnableAspectJAutoProxy 가 뭔지",
      WHOLE_SENTENCE_LABEL,
    ]);
    expect(guesses.at(-1)?.term).toBe("문장");
    expect(guesses.at(-1)?.word).toBeUndefined();
  });

  it("코드 낱말이 없으면 문장 전체 하나만 내놓는다", () => {
    const guesses = guessesFromSentence("이제 생성 책임을 컨테이너에 맡겨 볼게요");
    expect(guesses).toHaveLength(1);
    expect(guesses[0]?.id).toBe("gs");
  });

  it("붙잡은 문장에 없으면 앞 문장에서 낱말을 빌려 오고, 인용은 붙잡은 문장이다", () => {
    const guesses = guessesFromSentence("뭔가를 또 타이핑을 해 줘야 되는데", [
      "여기에 enableWebSecurity 를 켜 주면",
    ]);
    expect(guesses[0]?.term).toBe("enableWebSecurity");
    expect(guesses[0]?.question).toContain('"뭔가를 또 타이핑을 해 줘야 되는데"');
    expect(guesses[0]?.question).toContain("enableWebSecurity 가 무엇인지");
  });
});

describe("밖으로 보낼 질문 문장", () => {
  it("낱말 질문에는 붙잡은 문장이 인용으로 들어간다", () => {
    expect(askAboutToken("여기서 new 를 씁니다", "OrderService")).toBe(
      '선생님이 방금 "여기서 new 를 씁니다" 이라고 했는데, OrderService 가 무엇인지 지금 수업 맥락에서 설명해 주세요',
    );
  });

  it("문장 질문은 그 문장이 무슨 뜻인지 묻는다", () => {
    expect(askAboutSentence("  이제   생성 책임을 맡겨요 ")).toBe(
      '선생님이 방금 "이제 생성 책임을 맡겨요" 이라고 했는데, 이 문장이 무슨 뜻인지 지금 수업 맥락에서 설명해 주세요',
    );
  });

  it("문장 안의 큰따옴표는 작은따옴표로 바꿔 인용이 깨지지 않게 한다", () => {
    expect(askAboutSentence('그는 "안녕" 이라고 했어요')).toContain("그는 '안녕' 이라고 했어요");
  });

  it("이어 묻기에는 앞선 답의 결론이 한 줄 맥락으로 붙는다", () => {
    expect(followUpQuestion("new 자체는 괜찮아요", "그럼 언제 써요?")).toBe(
      '앞선 답은 "new 자체는 괜찮아요" 이었어요. 이어서 물어요 — 그럼 언제 써요?',
    );
    expect(followUpQuestion(null, "그럼 언제 써요?")).toBe("그럼 언제 써요?");
    expect(followUpQuestion("", "그럼 언제 써요?")).toBe("그럼 언제 써요?");
  });
});

describe("4096바이트 상한", () => {
  it("상한 안이면 그대로 둔다", () => {
    expect(clampAskQuestion("안녕하세요")).toBe("안녕하세요");
    expect(utf8ByteLength("안녕하세요")).toBe(15);
  });

  it("넘으면 앞부분만 남기고 …를 붙이며 상한을 넘지 않는다", () => {
    const long = "가".repeat(2_000);
    const clamped = clampAskQuestion(long);
    expect(clamped.endsWith("…")).toBe(true);
    expect(utf8ByteLength(clamped)).toBeLessThanOrEqual(MAX_ASK_QUESTION_BYTES);
    expect(utf8ByteLength(clamped)).toBeGreaterThan(MAX_ASK_QUESTION_BYTES - 6);
  });

  it("글자 한가운데를 자르지 않는다", () => {
    // '가' 는 3바이트. 상한 7이면 "…"(3) 을 빼고 4바이트가 남아 한 글자만 들어갑니다.
    expect(clampAskQuestion("가나다", 7)).toBe("가…");
    expect(utf8ByteLength(clampAskQuestion("가나다", 7))).toBeLessThanOrEqual(7);
  });

  it("서로게이트 쌍 한가운데도 자르지 않는다", () => {
    const clamped = clampAskQuestion("🙂🙂", 7);
    expect(clamped).toBe("🙂…");
    expect(utf8ByteLength(clamped)).toBeLessThanOrEqual(7);
  });

  it("자를 자리조차 없으면 빈 글이다", () => {
    expect(clampAskQuestion("가나다", 2)).toBe("");
  });
});

describe("normalizeAskText", () => {
  it("줄바꿈과 이어진 공백을 한 칸으로 줄이고 앞뒤를 턴다", () => {
    expect(normalizeAskText("  그럼\n  언제   써요?  ")).toBe("그럼 언제 써요?");
    expect(normalizeAskText("   ")).toBe("");
  });
});
