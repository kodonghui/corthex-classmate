// packages/contracts 는 Phase 2 1라운드 동안 "고정" 입니다 (docs/DECISIONS.md 2026-09-02).
// frozen.sha256 에 적힌 스키마 해시와 지금 파일이 다르면 여기서 실패합니다.
//
// 계약을 바꿔야 하면: 코드를 고치지 말고 docs/DECISIONS.md 에 제안(무엇을·왜·대안)을 적고 멈춥니다.
// 사람이 승인하면 `pnpm --filter @classmate/contracts freeze` 로 스냅샷을 갱신해 같은 커밋에 담습니다.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const schemasDir = join(packageRoot, "schemas");
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

function currentDigests(): string[] {
  return readdirSync(schemasDir)
    .filter((name) => name.endsWith(".schema.json"))
    .sort()
    .map((name) => {
      const text = readFileSync(join(schemasDir, name), "utf8").split(CR).join("");
      const hex = createHash("sha256").update(text, "utf8").digest("hex");
      return `${hex}  schemas/${name}`;
    });
}

function frozenDigests(): string[] {
  return readFileSync(join(packageRoot, "frozen.sha256"), "utf8")
    .split(CR)
    .join("")
    .split(LF)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const pathOf = (line: string): string => line.slice(line.indexOf("  ") + 2);

describe("계약 고정 (frozen.sha256)", () => {
  it("스키마 파일 목록이 스냅샷과 같다", () => {
    expect(currentDigests().map(pathOf)).toEqual(frozenDigests().map(pathOf));
  });

  it("스키마 내용이 스냅샷과 같다 — 다르면 DECISIONS.md 에 제안만 적고 멈춘다", () => {
    expect(currentDigests()).toEqual(frozenDigests());
  });
});
