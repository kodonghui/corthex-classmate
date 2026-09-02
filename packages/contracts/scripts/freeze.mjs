// schemas/*.schema.json 의 SHA-256 을 frozen.sha256 에 적습니다. "계약 고정" 의 실체입니다.
// 실행: pnpm --filter @classmate/contracts freeze   (사람이 계약 변경을 승인한 뒤에만)
//
// test/frozen.test.ts 가 이 파일과 현재 스키마를 맞대어, 승인 없는 계약 변경을 시험 실패로 막습니다.
// 형식은 sha256sum 과 같은 "<hex>  <경로>" 한 줄씩입니다. 줄 끝 CR 은 지우고 해시하므로
// core.autocrlf 설정이 달라도 값이 같습니다.
//
// 진입점 가드: import 만으로는 파일을 덧쓰지 않습니다 (스파이크 공통 규칙, docs/DECISIONS.md Gate C2).

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const schemasDir = join(packageRoot, "schemas");
const snapshotPath = join(packageRoot, "frozen.sha256");
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

export async function computeSchemaDigests() {
  const names = (await readdir(schemasDir)).filter((name) => name.endsWith(".schema.json")).sort();
  const lines = [];
  for (const name of names) {
    const text = (await readFile(join(schemasDir, name), "utf8")).split(CR).join("");
    const hex = createHash("sha256").update(text, "utf8").digest("hex");
    lines.push(`${hex}  schemas/${name}`);
  }
  return lines;
}

async function main() {
  const lines = await computeSchemaDigests();
  await writeFile(snapshotPath, lines.join(LF) + LF, "utf8");
  console.log(`frozen.sha256 갱신: 스키마 ${lines.length}개`);
  for (const line of lines) console.log("  " + line);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
