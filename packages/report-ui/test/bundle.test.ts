// (a) 번들 읽기: 골든 번들을 그대로 읽고, 파일이 빠져도 깨지지 않고, 깨진 JSONL 줄은 건너뜁니다.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { parseJsonLines, periodIndexFromId, readPeriodBundle, readPeriodBundles } from "../src/bundle.ts";
import { GOLDEN_BUNDLE_DIR } from "./helpers.ts";

const scratchDirs: string[] = [];

function makeScratchDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "classmate-bundle-"));
  scratchDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of scratchDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("readPeriodBundle · 골든 번들", () => {
  const bundle = readPeriodBundle(GOLDEN_BUNDLE_DIR);

  it("교시 머리 정보를 period.started 사건에서 읽는다", () => {
    expect(bundle.periodId).toBe("2026-09-02-p3");
    expect(bundle.index).toBe(3);
    expect(bundle.subject).toBe("IoC 컨테이너와 의존성 주입");
    expect(bundle.dayId).toBe("2026-09-02");
    expect(bundle.startedAt).toBe("2026-09-02T10:31:35+09:00");
    expect(bundle.endedAt).toBe("2026-09-02T10:33:14+09:00");
  });

  it("fixtures/README.md 가 적어 둔 개수와 같다", () => {
    expect(bundle.events).toHaveLength(27);
    expect(bundle.transcript).toHaveLength(9);
    expect(bundle.frames).toHaveLength(2);
    expect(bundle.editorContexts).toHaveLength(1);
    expect(bundle.questions).toHaveLength(2);
    expect(bundle.answers).toHaveLength(3);
    expect(bundle.warnings).toEqual([]);
  });

  it("전사는 seq 순서로, 질문과 답은 시각 순서로 늘어선다", () => {
    expect(bundle.transcript.map((segment) => segment.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(bundle.questions.map((question) => question.id)).toEqual(["q-p3-001", "q-p3-002"]);
    expect(bundle.answers.map((answer) => answer.id)).toEqual([
      "ans-p3-001",
      "ans-p3-002-queued",
      "ans-p3-002",
    ]);
  });

  it("답의 세 갈래(완료·대기·되살아남)를 모두 담는다", () => {
    expect(bundle.answers.map((answer) => answer.status).sort()).toEqual(["answered", "queued", "recovered"]);
  });
});

describe("readPeriodBundle · 자료가 빠졌을 때", () => {
  it("폴더가 아예 없어도 빈 번들을 돌려준다", () => {
    const bundle = readPeriodBundle(path.join(os.tmpdir(), "classmate-없는-폴더-2026"));
    expect(bundle.events).toEqual([]);
    expect(bundle.transcript).toEqual([]);
    expect(bundle.answers).toEqual([]);
    expect(bundle.warnings.length).toBeGreaterThan(0);
  });

  it("답이 아직 없는 교시도 읽힌다", () => {
    const dir = makeScratchDir();
    writeFileSync(
      path.join(dir, "session-events.jsonl"),
      `${JSON.stringify({
        id: "ev-1",
        periodId: "2026-09-02-p5",
        at: "2026-09-02T13:00:00+09:00",
        type: "period.started",
        payload: { subject: "답이 없는 교시", index: 5 },
      })}\n`,
      "utf8",
    );
    const bundle = readPeriodBundle(dir);
    expect(bundle.periodId).toBe("2026-09-02-p5");
    expect(bundle.index).toBe(5);
    expect(bundle.subject).toBe("답이 없는 교시");
    expect(bundle.questions).toEqual([]);
    expect(bundle.answers).toEqual([]);
    expect(bundle.warnings).toEqual([]);
  });

  it("JSON 이 깨진 파일은 건너뛰고 안내를 남긴다", () => {
    const dir = makeScratchDir();
    writeFileSync(path.join(dir, "transcript.json"), "{이건 JSON 이 아니에요", "utf8");
    const bundle = readPeriodBundle(dir);
    expect(bundle.transcript).toEqual([]);
    expect(bundle.warnings.join("\n")).toContain("transcript.json");
  });

  it("배열이 와야 할 자리에 객체가 오면 건너뛴다", () => {
    const dir = makeScratchDir();
    writeFileSync(path.join(dir, "screen-frames.json"), JSON.stringify({ id: "sf-1" }), "utf8");
    const bundle = readPeriodBundle(dir);
    expect(bundle.frames).toEqual([]);
    expect(bundle.warnings.join("\n")).toContain("screen-frames.json");
  });
});

describe("parseJsonLines · 깨진 줄 건너뛰기", () => {
  it("성한 줄만 남기고 몇 번째 줄이 깨졌는지 적는다", () => {
    const warnings: string[] = [];
    const rows = parseJsonLines<{ id: string }>(
      ['{"id":"a"}', "{깨진 줄", "", '{"id":"b"}', "   "].join("\n"),
      "session-events.jsonl",
      warnings,
    );
    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("2번째 줄");
  });

  it("깨진 줄이 섞인 번들도 나머지를 그대로 읽는다", () => {
    const dir = makeScratchDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "session-events.jsonl"),
      [
        JSON.stringify({
          id: "ev-1",
          periodId: "2026-09-02-p2",
          at: "2026-09-02T10:00:00+09:00",
          type: "period.started",
          payload: { subject: "깨진 줄 섞인 교시", index: 2 },
        }),
        "{여기서 줄이 잘렸어요",
        JSON.stringify({
          id: "ev-2",
          periodId: "2026-09-02-p2",
          at: "2026-09-02T10:50:00+09:00",
          type: "period.ended",
          payload: {},
        }),
      ].join("\n"),
      "utf8",
    );
    const bundle = readPeriodBundle(dir);
    expect(bundle.events).toHaveLength(2);
    expect(bundle.warnings).toHaveLength(1);
    expect(bundle.endedAt).toBe("2026-09-02T10:50:00+09:00");
  });
});

describe("교시 번호 읽기", () => {
  it("periodId 끝의 -p3 에서 교시 번호를 읽는다", () => {
    expect(periodIndexFromId("2026-09-02-p3")).toBe(3);
    expect(periodIndexFromId("이상한-이름")).toBeUndefined();
  });

  it("여러 번들은 교시 번호 순서로 늘어선다", () => {
    const dirs = [GOLDEN_BUNDLE_DIR, GOLDEN_BUNDLE_DIR];
    expect(readPeriodBundles(dirs).map((bundle) => bundle.index)).toEqual([3, 3]);
  });
});
