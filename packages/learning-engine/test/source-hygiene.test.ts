import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("순수 엔진 경계", () => {
  it("src에서 네트워크·브라우저·시계·난수를 직접 사용하지 않는다", () => {
    const srcDir = fileURLToPath(new URL("../src/", import.meta.url));
    const source = sourceFiles(srcDir).map((path) => readFileSync(path, "utf8")).join("\n");

    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\b(?:chrome|browser)\./);
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("setTimeout(");
  });
});
