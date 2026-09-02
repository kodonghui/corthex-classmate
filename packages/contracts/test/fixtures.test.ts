// fixtures/synthetic-class/golden-ioc 의 골든 시나리오가 계약 정본을 그대로 지키는지 봅니다.
//
// fixtures 폴더는 읽기만 합니다. 여기서 실패하면 스키마나 fixture 중 하나가 어긋난 것이고,
// 어느 쪽을 고칠지는 사람이 정합니다. 그래서 실패 메시지에 파일·줄·필드·오류를 모두 적습니다.
//
// 파일 → 스키마 대응은 fixtures/README.md 의 "폴더 구조" 표를 그대로 옮긴 것입니다.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createValidator, formatErrors, type SchemaName } from "../src/index";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(packageRoot, "..", "..");
const goldenDir = join(repoRoot, "fixtures", "synthetic-class", "golden-ioc");

/** JSON fixture 한 개가 어느 스키마를 따르고, 파일이 배열인지 낱개인지 적어 둡니다. */
type JsonFixture = {
  file: string;
  schema: SchemaName;
  /** true 면 파일 최상위가 배열이고 원소 하나하나를 검사합니다. */
  many: boolean;
};

const JSON_FIXTURES: JsonFixture[] = [
  { file: "transcript.json", schema: "transcript-segment", many: true },
  { file: "screen-frames.json", schema: "screen-frame", many: true },
  { file: "editor-context.json", schema: "editor-context", many: false },
  { file: "question.json", schema: "question", many: false },
  { file: "question-2.json", schema: "question", many: false },
  { file: "answer.json", schema: "answer", many: false },
  { file: "answer-2.json", schema: "answer", many: false },
  { file: "answer-queued.json", schema: "answer", many: false },
];

const EVENTS_FILE = "session-events.jsonl";

/** 이벤트 payload 안에서 다른 파일의 id 를 가리키는 열쇠들입니다. */
const REFERENCE_KEYS = [
  "segmentId",
  "screenFrameId",
  "editorContextId",
  "questionId",
  "answerId",
] as const;

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

function readJson(path: string): unknown {
  return JSON.parse(readText(path)) as unknown;
}

/**
 * session-events.jsonl 을 줄 단위로 읽습니다.
 * 빈 줄은 건너뛰되 원래 줄 번호는 그대로 들고 다닙니다. 실패 메시지가 파일과 맞아야 합니다.
 */
function readEventLines(): Array<{ lineNo: number; text: string }> {
  return readText(join(goldenDir, EVENTS_FILE))
    .split(/\r?\n/)
    .map((text, index) => ({ lineNo: index + 1, text }))
    .filter((entry) => entry.text.trim().length > 0);
}

/** fixture 파일 하나가 담은 id 들을 뽑습니다. 배열 파일이면 원소마다 하나씩입니다. */
function idsOf(fixture: JsonFixture): string[] {
  const data = readJson(join(goldenDir, fixture.file));
  const items = fixture.many ? (data as unknown[]) : [data];
  return items.map((item) => String((item as { id?: unknown }).id));
}

/** 한 항목을 검사하고, 어긋나면 어디가 왜 틀렸는지 한 덩어리로 만들어 냅니다. */
function checkOne(schema: SchemaName, where: string, data: unknown): string[] {
  const validate = createValidator(schema);
  if (validate(data)) return [];
  return formatErrors(validate.errors).map((line) => `${where} · ${schema} · ${line}`);
}

describe("골든 시나리오 fixture", () => {
  it("golden-ioc 폴더가 있다", () => {
    expect(existsSync(goldenDir), `${goldenDir} 이(가) 없습니다`).toBe(true);
  });

  it("README 에 적힌 JSON fixture 를 하나도 빠뜨리지 않았다", () => {
    const onDisk = readdirSync(goldenDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort();
    const listed = JSON_FIXTURES.map((fixture) => fixture.file).sort();
    expect(onDisk).toEqual(listed);
  });

  it.each(JSON_FIXTURES)("$file 이(가) $schema 스키마를 통과한다", ({ file, schema, many }) => {
    const path = join(goldenDir, file);
    const data = readJson(path);

    if (!many) {
      expect(checkOne(schema, file, data)).toEqual([]);
      return;
    }

    expect(Array.isArray(data), `${file} 의 최상위는 배열이어야 합니다`).toBe(true);
    const items = data as unknown[];
    expect(items.length, `${file} 이(가) 비어 있습니다`).toBeGreaterThan(0);

    const problems: string[] = [];
    items.forEach((item, index) => {
      problems.push(...checkOne(schema, `${file}[${index}]`, item));
    });
    expect(problems).toEqual([]);
  });
});

describe(`골든 시나리오 ${EVENTS_FILE}`, () => {
  const lines = readEventLines();

  it("줄이 하나 이상 있다", () => {
    expect(lines.length).toBeGreaterThan(0);
  });

  it("모든 줄이 JSON 한 개로 파싱된다", () => {
    const problems: string[] = [];
    for (const { lineNo, text } of lines) {
      try {
        JSON.parse(text);
      } catch (error) {
        problems.push(`${EVENTS_FILE}:${lineNo} · JSON 파싱 실패 · ${String(error)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("모든 줄이 session-event 스키마를 통과한다", () => {
    const problems: string[] = [];
    for (const { lineNo, text } of lines) {
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        continue; // 위 시험이 이미 보고합니다.
      }
      problems.push(...checkOne("session-event", `${EVENTS_FILE}:${lineNo}`, data));
    }
    expect(problems).toEqual([]);
  });
});

// 스키마는 한 파일 안이 맞는지만 봅니다. 파일 사이를 잇는 id 가 실제로 있는지는 여기서 봅니다.
// 이벤트 로그가 없는 전사 조각이나 없는 답을 가리키면 E2E 는 조용히 빈 화면을 그립니다.
describe("골든 시나리오 참조 무결성", () => {
  const allIds = new Set<string>();
  const questionIds = new Set<string>();
  const answerIds = new Set<string>();
  const duplicated: string[] = [];

  for (const fixture of JSON_FIXTURES) {
    for (const id of idsOf(fixture)) {
      if (allIds.has(id)) duplicated.push(`${fixture.file} · 겹치는 id ${id}`);
      allIds.add(id);
      if (fixture.schema === "question") questionIds.add(id);
      if (fixture.schema === "answer") answerIds.add(id);
    }
  }

  /** 이벤트 한 줄에서 참조 검사에 필요한 부분만 꺼냅니다. */
  function eventPayloads(): Array<{ lineNo: number; payload: Record<string, unknown> }> {
    const out: Array<{ lineNo: number; payload: Record<string, unknown> }> = [];
    for (const { lineNo, text } of readEventLines()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue; // 위 시험이 이미 보고합니다.
      }
      const payload = (parsed as { payload?: unknown }).payload;
      out.push({
        lineNo,
        payload: (typeof payload === "object" && payload !== null
          ? payload
          : {}) as Record<string, unknown>,
      });
    }
    return out;
  }

  it("fixture 안에서 id 가 겹치지 않는다", () => {
    expect(duplicated).toEqual([]);
  });

  it("question fixture 의 anchor 와 snapshot 이 있는 id 만 가리킨다", () => {
    const problems: string[] = [];

    for (const fixture of JSON_FIXTURES.filter((entry) => entry.schema === "question")) {
      const question = readJson(join(goldenDir, fixture.file)) as {
        anchor?: { segmentId?: string };
        snapshot?: {
          transcriptSegmentIds?: string[];
          screenFrameId?: string;
          editorContextId?: string;
        };
      };

      const refs: Array<{ where: string; id: string | undefined }> = [
        { where: "anchor.segmentId", id: question.anchor?.segmentId },
        { where: "snapshot.screenFrameId", id: question.snapshot?.screenFrameId },
        { where: "snapshot.editorContextId", id: question.snapshot?.editorContextId },
      ];
      for (const [index, id] of (question.snapshot?.transcriptSegmentIds ?? []).entries()) {
        refs.push({ where: `snapshot.transcriptSegmentIds[${index}]`, id });
      }

      for (const { where, id } of refs) {
        if (id === undefined) continue;
        if (!allIds.has(id)) problems.push(`${fixture.file} · ${where} · 없는 id ${id}`);
      }
    }

    expect(problems).toEqual([]);
  });

  it(`${EVENTS_FILE} 의 payload 가 있는 id 만 가리킨다`, () => {
    const problems: string[] = [];

    for (const { lineNo, payload } of eventPayloads()) {
      for (const key of REFERENCE_KEYS) {
        const value = payload[key];
        if (typeof value !== "string") continue;
        if (!allIds.has(value)) {
          problems.push(`${EVENTS_FILE}:${lineNo} · payload.${key} · 없는 id ${value}`);
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it("이벤트가 가리키는 question·answer id 마다 대응 fixture 파일이 있다", () => {
    const problems: string[] = [];

    for (const { lineNo, payload } of eventPayloads()) {
      const questionId = payload.questionId;
      const answerId = payload.answerId;
      if (typeof questionId === "string" && !questionIds.has(questionId)) {
        problems.push(`${EVENTS_FILE}:${lineNo} · question fixture 가 없는 questionId ${questionId}`);
      }
      if (typeof answerId === "string" && !answerIds.has(answerId)) {
        problems.push(`${EVENTS_FILE}:${lineNo} · answer fixture 가 없는 answerId ${answerId}`);
      }
    }

    expect(problems).toEqual([]);
  });
});
