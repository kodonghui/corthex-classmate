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

function copyFrames(bundle: PeriodBundle, outDir: string, warnings: string[]): string[] {
  const copied: string[] = [];
  for (const frame of bundle.frames) {
    if (!isSafeBundlePath(frame.path)) {
      warnings.push(`${frame.id} 의 그림 경로가 폴더 밖을 가리켜서 옮기지 않았어요: ${frame.path}`);
      continue;
    }
    const href = frameHref(bundle, frame.path);
    if (href === undefined) {
      warnings.push(`${frame.id} 의 그림 경로를 쓸 수 없어 옮기지 않았어요: ${frame.path}`);
      continue;
    }
    const from = path.join(bundle.dir, frame.path);
    const to = path.join(outDir, href);
    try {
      mkdirSync(path.dirname(to), { recursive: true });
      copyFileSync(from, to);
      copied.push(to);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      warnings.push(`${frame.id} 의 그림을 옮기지 못했어요: ${frame.path} (${reason})`);
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

  for (const bundle of bundles) {
    const pagePath = path.join(outDir, periodFileName(bundle));
    writeFileSync(pagePath, renderPeriodHtml(bundle, { tokenCss }), "utf8");
    pages.push(pagePath);
    assets.push(...copyFrames(bundle, outDir, warnings));
  }

  const dayId = bundles[0]?.dayId ?? options.dayId ?? "날짜-미상";
  const hubPath = path.join(outDir, HUB_FILE_NAME);
  writeFileSync(hubPath, renderHubHtml(bundles, { tokenCss, dayId }), "utf8");
  pages.push(hubPath);

  return { outDir, dayId, pages, assets, warnings };
}
