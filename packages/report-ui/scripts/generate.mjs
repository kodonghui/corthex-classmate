// 교시 세션 번들 → 하루치 정적 보고서를 만드는 명령줄 도구입니다.
//
// 보기(저장소 뿌리에서 실행):
//   node packages/report-ui/scripts/generate.mjs --bundle fixtures/synthetic-class/golden-ioc --out out/2026-09-02
//
// --bundle 은 여러 번 쓸 수 있습니다. 경로는 지금 있는 폴더(cwd) 기준입니다.
// src/*.ts 를 그대로 import 합니다. Node 24 가 타입만 벗겨 내고 실행하기 때문에 빌드 단계가 없습니다.
// 그래서 import 하는 자리에 .ts 확장자를 반드시 적습니다.

import path from "node:path";
import { pathToFileURL } from "node:url";

import { generateDay } from "../src/generate.ts";

const USAGE = [
  "쓰는 법:",
  "  node packages/report-ui/scripts/generate.mjs --bundle <번들 폴더> [--bundle <번들 폴더> ...] --out <하루 폴더>",
  "",
  "옵션:",
  "  --bundle <경로>  교시 세션 번들 폴더입니다. 여러 번 쓸 수 있어요.",
  "  --out <경로>     결과를 담을 하루 폴더입니다. 보기 out/2026-09-02",
  "  --day <날짜>     번들이 하나도 없을 때 허브 제목에 쓸 날짜입니다.",
  "  --help           이 도움말을 봅니다.",
].join("\n");

/** 명령줄 낱말을 읽어 옵션 객체로 만듭니다. */
export function parseArgs(argv) {
  const options = { bundles: [], outDir: undefined, dayId: undefined, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--") {
      // pnpm run 이 그대로 넘겨 주는 구분자입니다. 그냥 지나갑니다.
      continue;
    }
    if (token === "--help" || token === "-h") {
      options.help = true;
    } else if (token === "--bundle") {
      i += 1;
      const value = argv[i];
      if (value === undefined) {
        throw new Error("--bundle 뒤에 폴더 경로가 필요해요");
      }
      options.bundles.push(value);
    } else if (token === "--out") {
      i += 1;
      const value = argv[i];
      if (value === undefined) {
        throw new Error("--out 뒤에 폴더 경로가 필요해요");
      }
      options.outDir = value;
    } else if (token === "--day") {
      i += 1;
      const value = argv[i];
      if (value === undefined) {
        throw new Error("--day 뒤에 날짜가 필요해요");
      }
      options.dayId = value;
    } else {
      throw new Error(`모르는 옵션이에요: ${token}`);
    }
  }
  return options;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    console.log(USAGE);
    return;
  }
  if (options.outDir === undefined) {
    console.error("--out 이 필요해요");
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const result = generateDay({
    bundles: options.bundles.map((dir) => path.resolve(process.cwd(), dir)),
    outDir: path.resolve(process.cwd(), options.outDir),
    ...(options.dayId === undefined ? {} : { dayId: options.dayId }),
  });

  console.log(`날짜: ${result.dayId}`);
  console.log(`만든 폴더: ${result.outDir}`);
  for (const page of result.pages) {
    console.log(`  페이지 ${path.relative(result.outDir, page)}`);
  }
  for (const asset of result.assets) {
    console.log(`  그림   ${path.relative(result.outDir, asset)}`);
  }
  for (const warning of result.warnings) {
    console.warn(`  건너뜀 ${warning}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
