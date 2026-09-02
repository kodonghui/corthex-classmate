// (f) 생성 e2e: 임시 폴더에 하루치 결과를 만들고 파일과 그림이 제자리에 있는지 봅니다.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { generateDay } from "../src/generate.ts";
import { GOLDEN_BUNDLE_DIR, STUB_TOKEN_CSS } from "./helpers.ts";

const outDir = mkdtempSync(path.join(os.tmpdir(), "classmate-report-out-"));
const scratchDirs: string[] = [outDir];

afterAll(() => {
  for (const dir of scratchDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeScratchDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

/** 시험용 번들 폴더 하나를 손으로 만듭니다. 프레임 그림은 아이디 글자를 그대로 담아 바이트로 구별합니다. */
function makeBundleDir(args: {
  readonly periodId: string;
  readonly index: number;
  readonly subject: string;
  readonly frames?: ReadonlyArray<{ readonly id: string; readonly path: string }>;
  readonly extraFiles?: Readonly<Record<string, string>>;
}): string {
  const dir = makeScratchDir("classmate-report-bundle-");
  const started = {
    id: `ev-${args.periodId}-1`,
    periodId: args.periodId,
    type: "period.started",
    at: "2026-09-02T13:00:00+09:00",
    payload: { index: args.index, subject: args.subject },
    source: "fixture",
  };
  writeFileSync(path.join(dir, "session-events.jsonl"), `${JSON.stringify(started)}\n`, "utf8");

  const frames = args.frames ?? [];
  if (frames.length > 0) {
    const rows = frames.map((frame, position) => ({
      id: frame.id,
      periodId: args.periodId,
      capturedAt: `2026-09-02T13:0${position}:00+09:00`,
      path: frame.path,
      width: 1,
      height: 1,
      hash: `hash-${position}`,
      changedFromPrev: true,
      source: "fixture",
    }));
    writeFileSync(path.join(dir, "screen-frames.json"), JSON.stringify(rows), "utf8");
    for (const frame of frames) {
      const target = path.join(dir, frame.path);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, `그림 바이트 ${frame.path}`, "utf8");
    }
  }

  for (const [name, text] of Object.entries(args.extraFiles ?? {})) {
    writeFileSync(path.join(dir, name), text, "utf8");
  }
  return dir;
}

const result = generateDay({ bundles: [GOLDEN_BUNDLE_DIR], outDir });

describe("generateDay", () => {
  it("날짜와 만든 파일을 알려 준다", () => {
    expect(result.dayId).toBe("2026-09-02");
    expect(result.warnings).toEqual([]);
    expect(result.pages.map((page) => path.basename(page))).toEqual(["period-3.html", "hub.html"]);
  });

  it("교시 상세와 허브 파일을 만든다", () => {
    expect(existsSync(path.join(outDir, "period-3.html"))).toBe(true);
    expect(existsSync(path.join(outDir, "hub.html"))).toBe(true);
  });

  it("프레임 이미지를 frames/ 로 옮긴다", () => {
    const framesDir = path.join(outDir, "frames");
    expect(statSync(framesDir).isDirectory()).toBe(true);
    expect(existsSync(path.join(framesDir, "p3", "sf-p3-001.webp"))).toBe(true);
    expect(existsSync(path.join(framesDir, "p3", "sf-p3-002.webp"))).toBe(true);
    expect(result.assets).toHaveLength(2);
  });

  it("옮긴 이미지가 원본과 바이트까지 같다", () => {
    const from = readFileSync(path.join(GOLDEN_BUNDLE_DIR, "frames", "sf-p3-001.webp"));
    const to = readFileSync(path.join(outDir, "frames", "p3", "sf-p3-001.webp"));
    expect(to.equals(from)).toBe(true);
  });

  it("허브가 만든 교시 파일을 정확히 가리킨다", () => {
    const hub = readFileSync(path.join(outDir, "hub.html"), "utf8");
    expect(hub).toContain('href="period-3.html"');
    const periodHtml = readFileSync(path.join(outDir, "period-3.html"), "utf8");
    expect(periodHtml).toContain('src="frames/p3/sf-p3-001.webp"');
    expect(periodHtml).toContain('href="hub.html"');
  });

  it("번들이 하나도 없어도 허브만 만들고 멈추지 않는다", () => {
    const emptyOut = mkdtempSync(path.join(os.tmpdir(), "classmate-report-empty-"));
    try {
      const empty = generateDay({ bundles: [], outDir: emptyOut, dayId: "2026-09-04" });
      expect(empty.dayId).toBe("2026-09-04");
      expect(existsSync(path.join(emptyOut, "hub.html"))).toBe(true);
      expect(empty.assets).toEqual([]);
    } finally {
      rmSync(emptyOut, { recursive: true, force: true });
    }
  });
});

describe("generateDay · 그림 자리가 겹칠 때", () => {
  it("하위 폴더만 다른 두 그림을 서로 다른 자리에 옮긴다", () => {
    const bundleDir = makeBundleDir({
      periodId: "2026-09-02-p5",
      index: 5,
      subject: "겹치는 파일 이름",
      frames: [
        { id: "sf-p5-001", path: "frames/a/shot.webp" },
        { id: "sf-p5-002", path: "frames/b/shot.webp" },
      ],
    });
    const out = makeScratchDir("classmate-report-collide-");
    const made = generateDay({ bundles: [bundleDir], outDir: out, tokenCss: STUB_TOKEN_CSS });

    expect(made.warnings).toEqual([]);
    expect(made.assets).toHaveLength(2);
    expect(existsSync(path.join(out, "frames", "p5", "sf-p5-001.webp"))).toBe(true);
    expect(existsSync(path.join(out, "frames", "p5", "sf-p5-002.webp"))).toBe(true);
    // 덮어쓰지 않았으니 두 파일의 바이트가 원본대로 다릅니다.
    expect(readFileSync(path.join(out, "frames", "p5", "sf-p5-001.webp"), "utf8")).toContain("frames/a/shot.webp");
    expect(readFileSync(path.join(out, "frames", "p5", "sf-p5-002.webp"), "utf8")).toContain("frames/b/shot.webp");
  });

  it("장면 아이디가 겹치면 덮어쓰지 않고 건너뛴 자리를 한 줄 남긴다", () => {
    const bundleDir = makeBundleDir({
      periodId: "2026-09-02-p6",
      index: 6,
      subject: "겹치는 장면 아이디",
      frames: [
        { id: "sf-p6-001", path: "frames/a/shot.webp" },
        { id: "sf-p6-001", path: "frames/b/shot.webp" },
      ],
    });
    const out = makeScratchDir("classmate-report-dup-id-");
    const made = generateDay({ bundles: [bundleDir], outDir: out, tokenCss: STUB_TOKEN_CSS });

    expect(made.warnings).toHaveLength(1);
    expect(made.warnings[0]).toContain("sf-p6-001");
    expect(made.warnings[0]).toContain("겹쳐서");
    expect(made.assets).toHaveLength(1);
    // 먼저 온 그림이 남고 뒤엣것이 덮어쓰지 않았습니다.
    expect(readFileSync(path.join(out, "frames", "p6", "sf-p6-001.webp"), "utf8")).toContain("frames/a/shot.webp");
  });
});

describe("generateDay · 기록 하나가 잘못됐을 때", () => {
  it("칸이 빠진 질문이 있어도 그 교시만 건너뛰고 나머지를 이어 그린다", () => {
    // snapshot 칸이 통째로 빠진 question.json 입니다. 그리다 TypeError 가 납니다.
    const broken = makeBundleDir({
      periodId: "2026-09-02-p7",
      index: 7,
      subject: "칸이 빠진 교시",
      extraFiles: {
        "question-broken.json": JSON.stringify({
          id: "q-p7-001",
          periodId: "2026-09-02-p7",
          kind: "why",
          text: "이 질문에는 snapshot 이 없어요",
          askedAt: "2026-09-02T13:01:00+09:00",
        }),
      },
    });
    const healthy = makeBundleDir({ periodId: "2026-09-02-p8", index: 8, subject: "멀쩡한 교시" });
    const out = makeScratchDir("classmate-report-broken-");
    const made = generateDay({ bundles: [broken, healthy], outDir: out, tokenCss: STUB_TOKEN_CSS });

    expect(existsSync(path.join(out, "period-7.html"))).toBe(false);
    expect(existsSync(path.join(out, "period-8.html"))).toBe(true);
    expect(existsSync(path.join(out, "hub.html"))).toBe(true);
    expect(made.warnings.some((warning) => warning.includes("2026-09-02-p7"))).toBe(true);
    // 허브가 만들지 않은 페이지를 가리키지 않습니다.
    expect(readFileSync(path.join(out, "hub.html"), "utf8")).not.toContain('href="period-7.html"');
  });

  it("교시 번호가 겹치면 뒤 번들을 덮어쓰지 않고 건너뛴 자리를 남긴다", () => {
    const first = makeBundleDir({ periodId: "2026-09-02-p4", index: 4, subject: "먼저 온 4교시" });
    const second = makeBundleDir({ periodId: "2026-09-02-p4-again", index: 4, subject: "나중에 온 4교시" });
    const out = makeScratchDir("classmate-report-same-slot-");
    const made = generateDay({ bundles: [first, second], outDir: out, tokenCss: STUB_TOKEN_CSS });

    expect(made.pages.map((page) => path.basename(page))).toEqual(["period-4.html", "hub.html"]);
    expect(made.warnings.some((warning) => warning.includes("period-4.html"))).toBe(true);
    const page = readFileSync(path.join(out, "period-4.html"), "utf8");
    expect(page).toContain("먼저 온 4교시");
    expect(page).not.toContain("나중에 온 4교시");
  });
});
