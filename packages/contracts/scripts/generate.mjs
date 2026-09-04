// schemas/*.schema.json (정본) → src/generated/*.ts (생성물) 로 타입을 만듭니다.
// 실행: pnpm --filter @classmate/contracts generate
//
// $ref 해석 메모
//   각 스키마는 형제 파일을 "common.schema.json#/definitions/Id" 처럼 상대 경로로 가리킵니다.
//   json-schema-to-typescript 의 compileFromFile 은 cwd 를 기준으로 상대 $ref 를 풉니다.
//   (README 의 Options 표: cwd 기본값은 process.cwd(), "Root directory for resolving $refs")
//   그래서 cwd 를 schemas/ 로 못 박습니다. 저장소 어디에서 실행해도 결과가 같습니다.

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { compileFromFile } from "json-schema-to-typescript";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const schemasDir = join(packageRoot, "schemas");
const outDir = join(packageRoot, "src", "generated");

// 생성 순서입니다. common 을 먼저 두어야 공통 타입이 common.ts 것으로 재수출됩니다.
const SCHEMA_NAMES = [
  "common",
  "evidence-level",
  "transcript-segment",
  "screen-frame",
  "editor-context",
  "question",
  "answer",
  "session-event",
  "session-profile-v2",
  "material-ref",
  "asset-ref",
  "tutor-response-v2",
  "activity-card",
  "activity-set-v2",
  "session-summary-v2",
  "session-bundle-v2",
];

const BANNER = [
  "/* eslint-disable */",
  "/**",
  " * 생성물 · 직접 고치지 말 것",
  " *",
  " * 정본은 packages/contracts/schemas/*.schema.json 입니다.",
  " * 타입을 바꾸려면 스키마를 고치고 `pnpm --filter @classmate/contracts generate` 를 다시 실행하세요.",
  " */",
].join("\n");

// json-schema-to-typescript 가 allOf 제약을 풀 때 만드는 내부 구현 타입입니다.
// 루트 공개 API에는 사람이 이름 붙인 계약 타입만 내보냅니다.
const INTERNAL_TYPE_NAMES = new Set(["SessionMomentRecordV2"]);

/** 생성된 코드에서 최상위 export 이름을 뽑습니다. 모두 타입이라 런타임 값은 없습니다. */
function collectExportedTypeNames(source) {
  const names = [];
  const pattern = /^export\s+(?:declare\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)/gm;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    names.push(match[1]);
  }
  return names;
}

async function main() {
  // 스키마 파일을 하나라도 빠뜨리지 않았는지 먼저 확인합니다.
  const listed = new Set(SCHEMA_NAMES.map((name) => `${name}.schema.json`));
  const actual = (await readdir(schemasDir)).filter((file) => file.endsWith(".schema.json"));
  const missing = actual.filter((file) => !listed.has(file));
  if (missing.length > 0) {
    throw new Error(
      `SCHEMA_NAMES 에 빠진 스키마가 있습니다: ${missing.join(", ")} · scripts/generate.mjs 를 고치세요`,
    );
  }

  await mkdir(outDir, { recursive: true });

  /** @type {Array<{ name: string, exported: string[] }>} */
  const modules = [];
  const seen = new Set();

  for (const name of SCHEMA_NAMES) {
    const schemaPath = join(schemasDir, `${name}.schema.json`);

    const ts = await compileFromFile(schemaPath, {
      // $ref 뿌리. 뒤에 구분자를 붙여야 디렉터리로 다뤄집니다.
      cwd: schemasDir + sep,
      bannerComment: BANNER,
      // 스키마가 additionalProperties: false 를 직접 적으므로 기본값도 false 로 맞춥니다.
      additionalProperties: false,
      // common.schema.json 처럼 definitions 만 있는 파일도 타입을 내놓게 합니다.
      unreachableDefinitions: true,
      declareExternallyReferenced: true,
      // const enum 은 isolatedModules 와 맞지 않아 끕니다.
      enableConstEnums: false,
      // minItems/maxItems 를 튜플로 굳히지 않습니다. chips 는 계약대로 string[] 입니다
      // (2~3개 제한은 스키마 검증이 맡습니다).
      ignoreMinAndMaxItems: true,
      unknownAny: true,
      style: {
        bracketSpacing: true,
        printWidth: 100,
        semi: true,
        singleQuote: false,
        tabWidth: 2,
        trailingComma: "none",
        useTabs: false,
      },
    });

    await writeFile(join(outDir, `${name}.ts`), ts, "utf8");

    const exported = [];
    for (const typeName of collectExportedTypeNames(ts)) {
      if (INTERNAL_TYPE_NAMES.has(typeName)) continue;
      if (seen.has(typeName)) continue;
      seen.add(typeName);
      exported.push(typeName);
    }
    modules.push({ name, exported });

    console.log(`생성 ${name}.ts · export ${exported.length}개`);
  }

  const indexLines = [BANNER, ""];
  for (const { name, exported } of modules) {
    if (exported.length === 0) {
      indexLines.push(`// ./${name} 에는 새로 내보낼 타입이 없습니다 (공통 타입과 겹칩니다).`);
      continue;
    }
    indexLines.push(`export type { ${exported.join(", ")} } from "./${name}";`);
  }
  indexLines.push("");

  await writeFile(join(outDir, "index.ts"), indexLines.join("\n"), "utf8");
  console.log(`생성 index.ts · 모듈 ${modules.length}개`);
}

await main();
