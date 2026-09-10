// 스키마 정본이 실제로 컴파일되고, 통과 예시는 통과하고, 거부 예시는 거부되는지 확인합니다.
// 예시 파일 이름의 첫 마디가 스키마 이름입니다. 보기 answer.long-conclusion.json → answer

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CORE_FRAME_SOURCES,
  CORE_MOMENT_SOURCES,
  CORE_QA_KINDS,
  CORE_TOOL_NAMES,
  EVIDENCE_LABELS_KO,
  SCHEMAS,
  SCHEMA_IDS,
  SCHEMA_NAMES,
  SESSION_EVENT_TYPES,
  TUTOR_STATES,
  createValidator,
  formatErrors,
  getAjv,
  type SchemaName,
} from "../src/index";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const schemasDir = join(packageRoot, "schemas");
const examplesDir = join(schemasDir, "examples");
const invalidDir = join(examplesDir, "invalid");
// core-* 예시는 따로 둡니다. apps/native-host 의 transport 크레이트 시험이 examples/ 의 파일 개수와
// 이름을 못 박고 있고(그 크레이트는 코어 스키마를 모릅니다), native-host 는 v0.3 동안 손대지 않습니다.
const coreExamplesDir = join(schemasDir, "core-examples");
const coreInvalidDir = join(coreExamplesDir, "invalid");

const schemaNameSet = new Set<string>(SCHEMA_NAMES);

function listJsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
}

function schemaNameOf(fileName: string): SchemaName {
  const first = fileName.split(".")[0] ?? "";
  if (!schemaNameSet.has(first)) {
    throw new Error(
      `예시 파일 이름의 첫 마디가 스키마 이름이어야 합니다: ${fileName} · 받은 값 ${first}`,
    );
  }
  return first as SchemaName;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

type ExampleFile = { file: string; dir: string };

function listExamples(...dirs: string[]): ExampleFile[] {
  return dirs.flatMap((dir) => listJsonFiles(dir).map((file) => ({ file, dir })));
}

const validExampleFiles = listExamples(examplesDir, coreExamplesDir);
const invalidExampleFiles = listExamples(invalidDir, coreInvalidDir);

describe("스키마 컴파일", () => {
  it("스키마 파일 목록과 SCHEMA_NAMES 가 같다", () => {
    const onDisk = listJsonFiles(schemasDir)
      .filter((file) => file.endsWith(".schema.json"))
      .map((file) => file.replace(/\.schema\.json$/, ""))
      .sort();
    expect(onDisk).toEqual([...SCHEMA_NAMES].sort());
  });

  it.each([...SCHEMA_NAMES])("%s 스키마가 Ajv 로 컴파일된다", (name) => {
    const validate = createValidator(name);
    expect(typeof validate).toBe("function");
  });

  it("모든 스키마가 $id 로 등록되어 있다", () => {
    const ajv = getAjv();
    for (const name of SCHEMA_NAMES) {
      expect(ajv.getSchema(SCHEMA_IDS[name]), `${name} 이(가) 없습니다`).toBeTruthy();
    }
  });
});

describe("통과 예시", () => {
  it("예시 파일이 하나 이상 있다", () => {
    expect(validExampleFiles.length).toBeGreaterThan(0);
  });

  it("모든 스키마에 통과 예시가 하나 이상 있다", () => {
    const covered = new Set(validExampleFiles.map(({ file }) => schemaNameOf(file)));
    expect([...covered].sort()).toEqual([...SCHEMA_NAMES].sort());
  });

  it("core-* 예시는 core-examples/ 에만 있다 (native-host transport 시험이 examples/ 를 못 박고 있습니다)", () => {
    expect(listJsonFiles(examplesDir).filter((file) => file.startsWith("core-"))).toEqual([]);
    expect(listJsonFiles(invalidDir).filter((file) => file.startsWith("core-"))).toEqual([]);
    expect(listJsonFiles(coreExamplesDir).every((file) => file.startsWith("core-"))).toBe(true);
    expect(listJsonFiles(coreInvalidDir).every((file) => file.startsWith("core-"))).toBe(true);
  });

  it.each(validExampleFiles)("$file 이(가) 스키마를 통과한다", ({ file, dir }) => {
    const name = schemaNameOf(file);
    const validate = createValidator(name);
    const data = readJson(join(dir, file));
    const ok = validate(data);
    expect(formatErrors(validate.errors)).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe("거부 예시", () => {
  it("거부 예시가 세 개 이상 있다", () => {
    expect(invalidExampleFiles.length).toBeGreaterThanOrEqual(3);
  });

  it.each(invalidExampleFiles)("$file 이(가) 거부된다", ({ file, dir }) => {
    const name = schemaNameOf(file);
    const validate = createValidator(name);
    const data = readJson(join(dir, file));
    expect(validate(data)).toBe(false);
    expect(formatErrors(validate.errors).length).toBeGreaterThan(0);
  });

  it("41자 결론은 거부되고 40자 결론은 통과한다", () => {
    const validate = createValidator("answer");
    const base = readJson(join(examplesDir, "answer.1.json")) as Record<string, unknown>;

    const forty = { ...base, conclusion: "가".repeat(40) };
    expect(validate(forty)).toBe(true);

    const fortyOne = { ...base, conclusion: "가".repeat(41) };
    expect(validate(fortyOne)).toBe(false);
  });

  it("칩이 1개거나 4개면 거부된다", () => {
    const validate = createValidator("answer");
    const base = readJson(join(examplesDir, "answer.1.json")) as Record<string, unknown>;

    expect(validate({ ...base, chips: ["더 쉽게"] })).toBe(false);
    expect(validate({ ...base, chips: ["가", "나", "다", "라"] })).toBe(false);
    expect(validate({ ...base, chips: ["가", "나", "다"] })).toBe(true);
  });

  it("모르는 필드가 붙으면 거부된다", () => {
    const validate = createValidator("transcript-segment");
    const base = readJson(join(examplesDir, "transcript-segment.1.json")) as Record<
      string,
      unknown
    >;
    expect(validate({ ...base, speakerName: "홍길동" })).toBe(false);
  });

  it("state.changed 의 payload 는 from 과 to 만 받는다", () => {
    const validate = createValidator("session-event");
    const base = readJson(join(examplesDir, "session-event.1.json")) as Record<string, unknown>;

    expect(validate({ ...base, payload: { from: "CAPTURE", to: "EXIT_RECALL" } })).toBe(true);
    expect(validate({ ...base, payload: { from: "CAPTURE" } })).toBe(false);
    expect(validate({ ...base, payload: { from: "CAPTURE", to: "SLEEPING" } })).toBe(false);
  });
});

describe("손으로 적은 상수와 스키마가 같다", () => {
  it("EVIDENCE_LABELS_KO 의 열쇠가 evidence-level enum 과 같다", () => {
    const schema = SCHEMAS["evidence-level"] as { enum: string[]; "x-labels-ko": Record<string, string> };
    expect(Object.keys(EVIDENCE_LABELS_KO)).toEqual(schema.enum);
    expect({ ...EVIDENCE_LABELS_KO }).toEqual(schema["x-labels-ko"]);
  });

  it("SESSION_EVENT_TYPES 가 session-event enum 과 같다", () => {
    const schema = SCHEMAS["session-event"] as {
      properties: { type: { enum: string[] } };
    };
    expect([...SESSION_EVENT_TYPES]).toEqual(schema.properties.type.enum);
  });

  it("TUTOR_STATES 가 common 의 TutorState enum 과 같다", () => {
    const schema = SCHEMAS.common as {
      definitions: { TutorState: { enum: string[] } };
    };
    expect([...TUTOR_STATES]).toEqual(schema.definitions.TutorState.enum);
  });

  it("CORE_TOOL_NAMES 가 core-tools 의 x-tool-names 와 같고 툴마다 Input·Output 정의가 있다", () => {
    const schema = SCHEMAS["core-tools"] as {
      "x-tool-names": string[];
      "x-logical-names": Record<string, string>;
      definitions: Record<string, unknown>;
    };
    expect([...CORE_TOOL_NAMES]).toEqual(schema["x-tool-names"]);
    expect(Object.keys(schema["x-logical-names"])).toEqual(schema["x-tool-names"]);
    for (const name of CORE_TOOL_NAMES) {
      const pascal = name
        .split("_")
        .map((part) => part[0]!.toUpperCase() + part.slice(1))
        .join("");
      expect(schema.definitions, `${pascal}Input`).toHaveProperty(`${pascal}Input`);
      expect(schema.definitions, `${pascal}Output`).toHaveProperty(`${pascal}Output`);
      expect(schema["x-logical-names"][name]).toBe(name.replace("_", "."));
    }
  });

  it("코어 enum 상수가 core-* 스키마와 같다", () => {
    const frame = SCHEMAS["core-frame"] as { properties: { source: { enum: string[] } } };
    const moment = SCHEMAS["core-moment"] as { properties: { source: { enum: string[] } } };
    const qa = SCHEMAS["core-qa-entry"] as { properties: { kind: { enum: string[] } } };
    const tools = SCHEMAS["core-tools"] as {
      definitions: { SessionLogInput: { properties: { kind: { enum: string[] } } } };
    };
    expect([...CORE_FRAME_SOURCES]).toEqual(frame.properties.source.enum);
    expect([...CORE_MOMENT_SOURCES]).toEqual(moment.properties.source.enum);
    expect([...CORE_QA_KINDS]).toEqual(qa.properties.kind.enum);
    expect([...CORE_QA_KINDS]).toEqual(tools.definitions.SessionLogInput.properties.kind.enum);
  });
});

describe("코어 계약 경계", () => {
  it("CoreFrame.path 는 frames/<묶음>/<id>.<확장자> 상대 경로만 받는다", () => {
    const validate = createValidator("core-frame");
    const base = readJson(join(coreExamplesDir, "core-frame.1.json")) as Record<string, unknown>;
    expect(validate({ ...base, path: "frames/1/fr-1789012345678-2.jpg" })).toBe(true);
    for (const path of [
      "frames/1/fr-1789012345678.gif",
      "frames\\1\\fr-1789012345678.webp",
      "../frames/1/fr-1789012345678.webp",
      "frames/현재 공부/fr-1789012345678.webp",
    ]) {
      expect(validate({ ...base, path }), path).toBe(false);
    }
  });

  it("툴 입력은 snake_case 열쇠만 받고 모르는 열쇠는 거부한다", () => {
    const ajv = getAjv();
    const id = "https://schemas.corthex.dev/classmate/core-tools.schema.json";
    const latest = ajv.getSchema(`${id}#/definitions/MomentLatestInput`)!;
    expect(latest({})).toBe(true);
    expect(latest({ max_age_sec: 600 })).toBe(true);
    expect(latest({ maxAgeSec: 600 })).toBe(false);

    const log = ajv.getSchema(`${id}#/definitions/SessionLogInput`)!;
    expect(log({ question: "무상태성이 뭐야", answer: "…", kind: "explain" })).toBe(true);
    expect(log({ question: "", answer: "…", kind: "explain" })).toBe(false);
    expect(log({ question: "x", answer: "…", kind: "chat" })).toBe(false);

    const status = ajv.getSchema(`${id}#/definitions/CoreStatusOutput`)!;
    expect(
      status({
        version: "0.1.0",
        daemon: "alive",
        tiroState: "connected",
        hotkey: "registered",
        counts: { paragraphs: 3, frames: 2, moments: 1, qa: 0 },
      }),
    ).toBe(true);
    expect(status({ version: "0.1.0", daemon: "alive" })).toBe(false);
  });
});

describe("V2 계약 경계", () => {
  it("AssetRef.path 는 안전한 슬래시 상대경로만 받는다", () => {
    const validate = createValidator("asset-ref");
    const base = readJson(join(examplesDir, "asset-ref.1.json")) as Record<string, unknown>;

    expect(validate({ ...base, path: "frames/frame-001.jpg" })).toBe(true);
    for (const path of [
      "C:/private/frame.jpg",
      "/private/frame.jpg",
      "\\private\\frame.jpg",
      "frames\\frame.jpg",
      "../frame.jpg",
      "frames/../frame.jpg",
    ]) {
      expect(validate({ ...base, path }), path).toBe(false);
    }
  });

  it("초기 SessionBundleV2 는 활동이 비어도 되지만 여섯 개는 거부한다", () => {
    const validate = createValidator("session-bundle-v2");
    const base = readJson(join(examplesDir, "session-bundle-v2.1.json")) as Record<
      string,
      unknown
    >;
    const activities = base.activities as unknown[];

    expect(validate({ ...base, activities: [] })).toBe(true);
    expect(validate({ ...base, activities: [...activities, activities[0]] })).toBe(false);
  });

  it("ActivitySetV2 는 다섯 슬롯의 수와 순서를 모두 확인한다", () => {
    const validate = createValidator("activity-set-v2");
    const base = readJson(join(examplesDir, "activity-set-v2.1.json")) as unknown[];
    const wrongOrder = [...base];
    [wrongOrder[0], wrongOrder[1]] = [wrongOrder[1], wrongOrder[0]];

    expect(validate(base)).toBe(true);
    expect(validate(base.slice(0, 4))).toBe(false);
    expect(validate(wrongOrder)).toBe(false);
  });

  it("전사·화면·응답 순간은 각 필수 내용을 갖는다", () => {
    const validate = createValidator("session-bundle-v2");
    const base = readJson(join(examplesDir, "session-bundle-v2.1.json")) as {
      moments: Array<Record<string, unknown>>;
      [key: string]: unknown;
    };

    const transcriptMissingRevision = base.moments.map((moment) =>
      moment.type === "transcript" ? { ...moment, transcript: undefined } : moment,
    );
    const visualMissingAsset = base.moments.map((moment) =>
      moment.type === "visual" ? { ...moment, assetRefIds: [] } : moment,
    );
    const responseMissingBody = base.moments.map((moment) =>
      moment.type === "response" ? { ...moment, response: undefined } : moment,
    );

    expect(validate({ ...base, moments: transcriptMissingRevision })).toBe(false);
    expect(validate({ ...base, moments: visualMissingAsset })).toBe(false);
    expect(validate({ ...base, moments: responseMissingBody })).toBe(false);
  });
});

describe("생성물", () => {
  it("src/generated/index.ts 가 import 된다", async () => {
    const generated = await import("../src/generated/index");
    expect(generated).toBeTypeOf("object");
  });
});
