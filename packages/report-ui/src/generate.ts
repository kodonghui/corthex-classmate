// 번들 폴더들을 읽어 하루치 정적 사이트를 만듭니다.
//
// 만드는 것: <outDir>/period-<교시>.html · <outDir>/hub.html · <outDir>/frames/<교시열쇠>/<그림>
// outDir 은 "하루 폴더" 입니다. 보기 out/2026-09-02

import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { frameHref, HUB_FILE_NAME, isSafeBundlePath, periodFileName } from "./assets.ts";
import { readPeriodBundles } from "./bundle.ts";
import { renderHubHtml, renderPeriodHtml } from "./render.ts";
import { readDesignTokenCss } from "./tokens.ts";
import type { PeriodBundle } from "./types.ts";

/** generateDay 에 넘기는 값입니다. */
export interface GenerateDayOptions {
  /** 교시 세션 번들 폴더 경로들입니다. */
  readonly bundles: readonly string[];
  /** 하루치 결과를 담을 폴더입니다. 보기 out/2026-09-02 */
  readonly outDir: string;
  /** 인라인할 토큰 CSS 입니다. 넘기지 않으면 정본 파일에서 읽습니다. */
  readonly tokenCss?: string | undefined;
  /** 번들이 하나도 없을 때 허브 제목에 쓸 날짜입니다. */
  readonly dayId?: string | undefined;
}

/** generateDay 가 돌려주는 결과입니다. */
export interface GenerateDayResult {
  readonly outDir: string;
  readonly dayId: string;
  /** 만든 HTML 파일의 절대 경로들입니다. */
  readonly pages: readonly string[];
  /** 복사한 그림 파일의 절대 경로들입니다. */
  readonly assets: readonly string[];
  /** 번들을 읽고 그림을 옮기는 동안 건너뛴 자리입니다. */
  readonly warnings: readonly string[];
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function copyFrames(bundle: PeriodBundle, outDir: string, warnings: string[]): string[] {
  const copied: string[] = [];
  // 목적 경로 → 그 자리를 먼저 차지한 장면 아이디입니다. 겹치면 덮어쓰지 않고 warnings 에 남깁니다.
  const takenHrefs = new Map<string, string>();
  for (const frame of bundle.frames) {
    if (!isSafeBundlePath(frame.path)) {
      warnings.push(`${frame.id} 의 그림 경로가 폴더 밖을 가리켜서 옮기지 않았어요: ${frame.path}`);
      continue;
    }
    const href = frameHref(bundle, frame);
    if (href === undefined) {
      warnings.push(`${frame.id} 의 그림 경로를 쓸 수 없어 옮기지 않았어요: ${frame.path}`);
      continue;
    }
    const firstOwner = takenHrefs.get(href);
    if (firstOwner !== undefined) {
      warnings.push(
        `${frame.id} 의 그림 자리가 ${firstOwner} 와 겹쳐서 덮어쓰지 않고 옮기지 않았어요: ${href}`,
      );
      continue;
    }
    takenHrefs.set(href, frame.id);
    const from = path.join(bundle.dir, frame.path);
    const to = path.join(outDir, href);
    try {
      mkdirSync(path.dirname(to), { recursive: true });
      copyFileSync(from, to);
      copied.push(to);
    } catch (error) {
      warnings.push(`${frame.id} 의 그림을 옮기지 못했어요: ${frame.path} (${describeError(error)})`);
    }
  }
  return copied;
}

/** 하루치 보고서를 만듭니다. 폴더가 없으면 만들고, 이미 있으면 덮어씁니다. */
export function generateDay(options: GenerateDayOptions): GenerateDayResult {
  const outDir = path.resolve(options.outDir);
  const bundles = readPeriodBundles(options.bundles);
  const tokenCss = options.tokenCss ?? readDesignTokenCss();
  const warnings: string[] = bundles.flatMap((bundle) => bundle.warnings);
  const pages: string[] = [];
  const assets: string[] = [];

  mkdirSync(outDir, { recursive: true });

  // 페이지 파일 이름 → 그 이름을 먼저 쓴 교시 아이디입니다. 교시 번호가 겹쳐도 덮어쓰지 않습니다.
  const takenPages = new Map<string, string>();
  // 실제로 그린 번들만 허브에 넣습니다. 그래야 허브 링크가 없는 파일을 가리키지 않습니다.
  const drawn: PeriodBundle[] = [];

  for (const bundle of bundles) {
    const fileName = periodFileName(bundle);
    const firstOwner = takenPages.get(fileName);
    if (firstOwner !== undefined) {
      warnings.push(
        `${bundle.periodId} 는 ${firstOwner} 와 같은 페이지 이름(${fileName})이라 덮어쓰지 않고 건너뛰었어요`,
      );
      continue;
    }
    // 칸이 빠진 기록 하나 때문에 하루 전체가 멈추지 않게, 이 교시만 건너뛰고 나머지를 이어 그립니다.
    let html: string;
    try {
      html = renderPeriodHtml(bundle, { tokenCss });
    } catch (error) {
      warnings.push(`${bundle.periodId} 교시 페이지를 그리다 멈춰서 이 교시만 건너뛰었어요 (${describeError(error)})`);
      continue;
    }
    takenPages.set(fileName, bundle.periodId);
    const pagePath = path.join(outDir, fileName);
    writeFileSync(pagePath, html, "utf8");
    pages.push(pagePath);
    drawn.push(bundle);
    assets.push(...copyFrames(bundle, outDir, warnings));
  }

  const dayId = bundles[0]?.dayId ?? options.dayId ?? "날짜-미상";
  const hubPath = path.join(outDir, HUB_FILE_NAME);
  writeFileSync(hubPath, renderHubHtml(drawn, { tokenCss, dayId }), "utf8");
  pages.push(hubPath);

  return { outDir, dayId, pages, assets, warnings };
}
