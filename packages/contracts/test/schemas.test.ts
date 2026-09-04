// 스키마 정본이 실제로 컴파일되고, 통과 예시는 통과하고, 거부 예시는 거부되는지 확인합니다.
// 예시 파일 이름의 첫 마디가 스키마 이름입니다. 보기 answer.long-conclusion.json → answer

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
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

const validExampleFiles = listJsonFiles(examplesDir);
const invalidExampleFiles = listJsonFiles(invalidDir);

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
    const covered = new Set(validExampleFiles.map(schemaNameOf));
    expect([...covered].sort()).toEqual([...SCHEMA_NAMES].sort());
  });

  it.each(validExampleFiles)("%s 이(가) 스키마를 통과한다", (fileName) => {
    const name = schemaNameOf(fileName);
    const validate = createValidator(name);
    const data = readJson(join(examplesDir, fileName));
    const ok = validate(data);
    expect(formatErrors(validate.errors)).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe("거부 예시", () => {
  it("거부 예시가 세 개 이상 있다", () => {
    expect(invalidExampleFiles.length).toBeGreaterThanOrEqual(3);
  });

  it.each(invalidExampleFiles)("%s 이(가) 거부된다", (fileName) => {
    const name = schemaNameOf(fileName);
    const validate = createValidator(name);
    const data = readJson(join(invalidDir, fileName));
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
