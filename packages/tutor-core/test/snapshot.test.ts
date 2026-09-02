// 봉인 시험 — 붙잡은 순간 이후의 자료가 섞이지 않는지, 나이를 제대로 세는지 봅니다.

import { createValidator, formatErrors } from "@classmate/contracts";
import type { Question, TranscriptSegment } from "@classmate/contracts";
import { describe, expect, it } from "vitest";

import { sealSnapshot } from "../src/index";
import { loadEditor, loadFrames, loadQuestion, loadTranscript, must } from "./helpers";

const transcript = loadTranscript();
const frames = loadFrames();
const editor = loadEditor();

describe("sealSnapshot", () => {
  it("골든 시나리오 첫 질문의 봉인을 그대로 다시 만든다 (전사 4초 · 화면 2초 · 편집기 1초)", () => {
    const question = loadQuestion("question.json");
    const sealed = sealSnapshot({
      askedAt: question.askedAt,
      transcript,
      frames,
      editor: [editor],
      recentParagraphs: 3,
    });
    expect(sealed).toEqual(question.snapshot);
  });

  it("골든 시나리오 두 번째 질문의 봉인도 그대로 다시 만든다 (전사 3초 · 화면 12초 · 편집기 35초)", () => {
    const question = loadQuestion("question-2.json");
    const sealed = sealSnapshot({
      askedAt: question.askedAt,
      transcript,
      frames,
      editor: [editor],
      recentParagraphs: 3,
    });
    expect(sealed).toEqual(question.snapshot);
  });

  it("질문 시각보다 뒤에 도착한 자료는 넣지 않는다", () => {
    const question = loadQuestion("question.json");
    const later: TranscriptSegment = {
      id: "ts-p3-999",
      periodId: question.periodId,
      seq: 99,
      text: "질문 뒤에 도착한 문장입니다.",
      state: "final",
      arrivedAt: "2026-09-02T10:32:26+09:00",
      source: "fixture",
    };
    const sealed = sealSnapshot({
      askedAt: question.askedAt,
      transcript: [...transcript, later],
      frames,
      editor: [editor],
      recentParagraphs: 3,
    });
    expect(sealed.transcriptSegmentIds).not.toContain("ts-p3-999");
    expect(sealed).toEqual(question.snapshot);
  });

  it("전사 문단 수 N 을 지킨다", () => {
    const question = loadQuestion("question.json");
    const one = sealSnapshot({ askedAt: question.askedAt, transcript, recentParagraphs: 1 });
    expect(one.transcriptSegmentIds).toEqual(["ts-p3-005"]);

    const five = sealSnapshot({ askedAt: question.askedAt, transcript, recentParagraphs: 5 });
    expect(five.transcriptSegmentIds).toEqual([
      "ts-p3-001",
      "ts-p3-002",
      "ts-p3-003",
      "ts-p3-004",
      "ts-p3-005",
    ]);
  });

  it("자료가 없으면 그 자리를 아예 넣지 않고 나이는 null 로 둔다", () => {
    const sealed = sealSnapshot({
      askedAt: "2026-09-02T10:31:39+09:00",
      transcript,
      recentParagraphs: 3,
    });
    expect(sealed.transcriptSegmentIds).toEqual([]);
    expect(sealed.ages).toEqual({ transcriptSec: null, screenSec: null, editorSec: null });
    expect("screenFrameId" in sealed).toBe(false);
    expect("editorContextId" in sealed).toBe(false);
  });

  it("나이는 초 미만을 버리고 셈한다", () => {
    // 마지막 전사(ts-p3-005)는 10:32:14 도착이라 4.9초 전, 첫 프레임은 10:32:16 이라 2.9초 전입니다.
    const sealed = sealSnapshot({
      askedAt: "2026-09-02T10:32:18.900+09:00",
      transcript,
      frames: [must(frames[0], "첫 프레임")],
      recentParagraphs: 1,
    });
    expect(sealed.ages.transcriptSec).toBe(4);
    expect(sealed.ages.screenSec).toBe(2);
  });

  it("봉인을 넣은 Question 은 계약 검증기를 통과한다", () => {
    const source = loadQuestion("question.json");
    const rebuilt: Question = {
      id: source.id,
      periodId: source.periodId,
      askedAt: source.askedAt,
      kind: source.kind,
      snapshot: sealSnapshot({
        askedAt: source.askedAt,
        transcript,
        frames,
        editor: [editor],
        recentParagraphs: 3,
      }),
    };
    const validate = createValidator<Question>("question");
    expect(validate(rebuilt), formatErrors(validate.errors).join(" / ")).toBe(true);
  });
});
