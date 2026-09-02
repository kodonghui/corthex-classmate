// (b) 교시 상세 HTML 유효성과 fixture 내용, (c) 모델 문자열 이스케이프.

import { describe, expect, it } from "vitest";

import { EVIDENCE_LABELS_KO as CONTRACT_EVIDENCE_LABELS_KO } from "@classmate/contracts";

import { readPeriodBundle } from "../src/bundle.ts";
import { ANSWER_STATUS_LABELS_KO } from "../src/labels.ts";
import { renderPeriodHtml } from "../src/render.ts";
import { findUnbalancedTags, GOLDEN_BUNDLE_DIR, makeSyntheticBundle, STUB_TOKEN_CSS } from "./helpers.ts";
import type { Answer, TranscriptSegment } from "@classmate/contracts";

const goldenBundle = readPeriodBundle(GOLDEN_BUNDLE_DIR);
const goldenHtml = renderPeriodHtml(goldenBundle);

describe("교시 상세 HTML · 문서 뼈대", () => {
  it("한국어 문서로 시작한다", () => {
    expect(goldenHtml.startsWith("<!doctype html>\n")).toBe(true);
    expect(goldenHtml).toContain('<html lang="ko">');
    expect(goldenHtml).toContain('<meta charset="utf-8">');
    expect(goldenHtml).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(goldenHtml.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("태그가 짝을 이룬다", () => {
    expect(findUnbalancedTags(goldenHtml)).toEqual([]);
  });

  it("스크립트도 바깥 주소도 없는 한 장짜리다", () => {
    expect(goldenHtml).not.toContain("<script");
    expect(goldenHtml).not.toContain("http://");
    expect(goldenHtml).not.toContain("https://");
    expect(goldenHtml).not.toContain("@import");
  });

  it("제목 줄에 날짜와 과목이 들어간다", () => {
    expect(goldenHtml).toContain("<title>2026-09-02 3교시 · IoC 컨테이너와 의존성 주입 · 교시 복습자료</title>");
  });

  it("디자인 결정대로 패널 머리 높이는 44px 로 들어간다", () => {
    expect(goldenHtml).toContain("--panel-header-h: 44px;");
    expect(goldenHtml).not.toContain("--panel-header-h: 48px;");
  });
});

describe("교시 상세 HTML · 번들 내용", () => {
  it("교시 머리에 과목과 시간이 나온다", () => {
    expect(goldenHtml).toContain("IoC 컨테이너와 의존성 주입");
    expect(goldenHtml).toContain("2026-09-02-p3");
    expect(goldenHtml).toContain("10:31:35 ~ 10:33:14");
  });

  it("전사 아홉 줄이 모두 나오고 partial 은 표시된다", () => {
    expect(goldenHtml).toContain("자 그러면 지금까지 만든 주문 서비스를 다시 볼게요.");
    expect(goldenHtml).toContain("생성자에서 필요한 객체를 받아 오면 테스트에서 바꿔 끼우기가");
    expect(goldenHtml).toContain("아직 바뀔 수 있는 문장");
  });

  it("화면 장면과 당시 코드가 나온다", () => {
    expect(goldenHtml).toContain('src="frames/p3/sf-p3-001.webp"');
    expect(goldenHtml).toContain("src/main/java/com/ohgiraffers/order/OrderService.java");
    expect(goldenHtml).toContain("this.orderRepository = new OrderRepository();");
  });

  it("질문과 답이 나온다", () => {
    expect(goldenHtml).toContain("q-p3-001");
    expect(goldenHtml).toContain("왜 new로 직접 만들면 안 돼요?");
    expect(goldenHtml).toContain("생성자 주입으로 바꾸면 무엇이 달라져요?");
    expect(goldenHtml).toContain("new 자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요");
    expect(goldenHtml).toContain("지금 · 생성자 주입 코드로 넘어갔어요");
    expect(goldenHtml).toContain("왜 그런가요");
  });

  it("근거 단계와 대기 상태를 색이 아닌 한국어 문구로 알린다", () => {
    expect(goldenHtml).toContain(`근거 ${CONTRACT_EVIDENCE_LABELS_KO.confirmed}`);
    expect(goldenHtml).toContain(`근거 ${CONTRACT_EVIDENCE_LABELS_KO.partial}`);
    expect(goldenHtml).toContain(`근거 ${CONTRACT_EVIDENCE_LABELS_KO.stale}`);
    expect(goldenHtml).toContain(ANSWER_STATUS_LABELS_KO.queued);
    expect(goldenHtml).toContain(ANSWER_STATUS_LABELS_KO.recovered);
  });

  it("근거 타임라인에 사건 27건이 모두 들어간다", () => {
    const rows = goldenHtml.match(/class="timeline-row"/g) ?? [];
    expect(rows).toHaveLength(27);
    expect(goldenHtml).toContain("교시 시작");
    expect(goldenHtml).toContain("답 되살아남");
  });

  it("자료가 없는 자리는 지어내지 않고 비었다고 적는다", () => {
    expect(goldenHtml).toContain("오개념");
    expect(goldenHtml).toContain("값 흐름");
    expect(goldenHtml).toContain("직접 해볼 변형");
    const emptyNotes = goldenHtml.match(/이번 교시에는 기록이 없어요/g) ?? [];
    expect(emptyNotes.length).toBeGreaterThanOrEqual(3);
  });
});

describe("교시 상세 HTML · 빈 번들", () => {
  it("자료가 하나도 없어도 깨지지 않는다", () => {
    const html = renderPeriodHtml(makeSyntheticBundle({ subject: undefined }), { tokenCss: STUB_TOKEN_CSS });
    expect(findUnbalancedTags(html)).toEqual([]);
    expect(html).toContain("이번 교시에는 받아 둔 전사가 없어요");
    expect(html).toContain("이번 교시에는 붙잡은 질문이 없어요");
    expect(html).toContain("과목 이름이 기록되지 않았어요");
  });
});

describe("모델이 준 문자열은 태그가 되지 않는다 (§4-7)", () => {
  const transcript: TranscriptSegment[] = [
    {
      id: "ts-x-001",
      periodId: "2026-09-02-p1",
      seq: 1,
      text: "<script>alert(1)</script>",
      state: "final",
      arrivedAt: "2026-09-02T09:00:01+09:00",
      source: "fixture",
    },
  ];
  const answers: Answer[] = [
    {
      id: "ans-x-001",
      questionId: "q-x-001",
      createdAt: "2026-09-02T09:00:02+09:00",
      conclusion: '<img src=x onerror=alert(1)>',
      evidence: "inferred",
      chips: ["<b>굵게</b>", "그냥 칩"],
      details: { why: "</style><script>alert(2)</script>" },
      provider: "mock",
      status: "answered",
    },
  ];
  const html = renderPeriodHtml(makeSyntheticBundle({ transcript, answers }), { tokenCss: STUB_TOKEN_CSS });

  it("태그로 해석될 자리가 남지 않는다", () => {
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("</style><script>");
  });

  it("글자 그대로 이스케이프되어 보인다", () => {
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;b&gt;굵게&lt;/b&gt;");
  });

  it("이스케이프한 뒤에도 태그 짝은 맞다", () => {
    expect(findUnbalancedTags(html)).toEqual([]);
  });
});
