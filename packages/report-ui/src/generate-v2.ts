// 메모리에 있는 SessionBundleV2를 정적 상세 페이지와 컬렉션 허브로 만듭니다.

import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { isSafeBundlePath } from "./assets.ts";
import { renderCollectionHtml, renderSessionHtml } from "./render.ts";
import {
  COLLECTION_FILE_NAME,
  sessionAssetHref,
  sessionFileName,
} from "./session-assets.ts";
import { readDesignTokenCss } from "./tokens.ts";
import type { AssetRef, SessionBundleV2 } from "./types.ts";
import { sanitizeWarnings } from "./warnings.ts";

export interface GenerateSessionOptions {
  /** 이미 읽어 메모리에 둔 V2 JSON 객체입니다. */
  readonly bundle: SessionBundleV2;
  /** AssetRef.path가 기준으로 삼는 번들 폴더입니다. HTML에는 쓰지 않습니다. */
  readonly bundleDir: string;
  readonly outDir: string;
  readonly tokenCss?: string | undefined;
  readonly collectionHref?: string | undefined;
}

export interface GenerateSessionResult {
  readonly outDir: string;
  readonly sessionId: string;
  readonly page: string;
  readonly assets: readonly string[];
  readonly warnings: readonly string[];
}

interface GenerateSessionCoreOptions extends Omit<GenerateSessionOptions, "bundleDir"> {
  readonly bundleDir?: string | undefined;
}

export interface GenerateCollectionOptions {
  readonly bundles: readonly SessionBundleV2[];
  /** 모든 번들이 같은 기준 폴더를 쓸 때의 기본값입니다. */
  readonly bundleDir?: string | undefined;
  /** 세션별 기준 폴더가 다르면 sessionId를 열쇠로 이 값을 우선합니다. */
  readonly bundleDirs?: Readonly<Record<string, string>> | undefined;
  readonly outDir: string;
  readonly collectionId?: string | undefined;
  readonly tokenCss?: string | undefined;
}

export interface GenerateCollectionResult {
  readonly outDir: string;
  readonly collectionId: string;
  readonly pages: readonly string[];
  readonly assets: readonly string[];
  readonly warnings: readonly string[];
}

function isWithinRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function isWithinOrEqual(root: string, target: string): boolean {
  return root === target || isWithinRoot(root, target);
}

function pathEntryExists(entryPath: string): boolean {
  try {
    lstatSync(entryPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 출력 폴더 아래 기존 조상과 기존 파일의 실제 경로를 확인합니다.
 * junction/symlink가 출력 폴더 밖을 가리키면 undefined를 돌려 외부 쓰기를 막습니다.
 */
function safeOutputTarget(outDir: string, href: string): string | undefined {
  const realOutDir = realpathSync(outDir);
  const parts = href.split("/");
  const fileName = parts.pop();
  if (fileName === undefined) return undefined;

  let current = outDir;
  for (const part of parts) {
    current = path.join(current, part);
    if (!pathEntryExists(current)) {
      mkdirSync(current);
    }
    const realCurrent = realpathSync(current);
    if (!isWithinOrEqual(realOutDir, realCurrent) || !statSync(realCurrent).isDirectory()) {
      return undefined;
    }
  }

  const target = path.join(current, fileName);
  if (pathEntryExists(target)) {
    const realTarget = realpathSync(target);
    if (!isWithinRoot(realOutDir, realTarget) || !statSync(realTarget).isFile()) {
      return undefined;
    }
  }
  return target;
}

interface PreparedAssets {
  readonly copied: string[];
  readonly hrefs: Map<string, string>;
}

function prepareAssets(
  bundle: SessionBundleV2,
  bundleDir: string | undefined,
  outDir: string,
  warnings: string[],
): PreparedAssets {
  const copied: string[] = [];
  const hrefs = new Map<string, string>();
  const referencedIds = new Set(
    bundle.moments.filter((moment) => moment.type === "visual").flatMap((moment) => moment.assetRefIds),
  );
  const artifactsById = new Map<string, AssetRef>();

  for (const artifact of bundle.artifacts) {
    if (artifactsById.has(artifact.id)) {
      warnings.push(`manifest의 자산 아이디 ${artifact.id}가 겹쳐서 첫 항목만 사용했어요`);
      continue;
    }
    artifactsById.set(artifact.id, artifact);
  }

  let realRoot: string | undefined;
  try {
    if (bundleDir !== undefined) {
      realRoot = realpathSync(bundleDir);
    }
  } catch {
    // 아래 공통 경고가 절대경로 없이 이유를 알립니다.
  }
  if (realRoot === undefined) {
    if (referencedIds.size > 0) {
      warnings.push("화면 자산 기준 폴더를 열 수 없어 화면 파일을 복사하지 않았어요");
    }
  }

  const takenHrefs = new Set<string>();
  for (const assetId of referencedIds) {
    const artifact = artifactsById.get(assetId);
    if (artifact === undefined) {
      warnings.push(`화면 기록이 가리킨 자산 ${assetId}가 manifest에 없어요`);
      continue;
    }
    if (!isSafeBundlePath(artifact.path)) {
      warnings.push(`자산 ${assetId}의 실제 경로가 안전한 상대경로가 아니라 복사하지 않았어요`);
      continue;
    }
    const href = sessionAssetHref(bundle, artifact);
    if (href === undefined) {
      warnings.push(`자산 ${assetId}가 지원하는 화면 이미지가 아니라 복사하지 않았어요`);
      continue;
    }
    if (takenHrefs.has(href)) {
      warnings.push(`자산 ${assetId}의 출력 자리가 겹쳐서 덮어쓰지 않았어요`);
      continue;
    }
    if (realRoot === undefined) continue;

    const lexicalSource = path.resolve(realRoot, artifact.path);
    let realSource: string;
    try {
      realSource = realpathSync(lexicalSource);
      const file = statSync(realSource);
      if (!isWithinRoot(realRoot, realSource) || !file.isFile()) {
        warnings.push(`자산 ${assetId}가 번들 폴더 안의 일반 파일이 아니라 복사하지 않았어요`);
        continue;
      }
      if (artifact.byteLength !== undefined && artifact.byteLength !== file.size) {
        warnings.push(`자산 ${assetId}의 실제 크기가 manifest와 달라 복사하지 않았어요`);
        continue;
      }
      if (artifact.sha256 !== undefined) {
        const actualHash = createHash("sha256").update(readFileSync(realSource)).digest("hex");
        if (actualHash !== artifact.sha256) {
          warnings.push(`자산 ${assetId}의 실제 해시가 manifest와 달라 복사하지 않았어요`);
          continue;
        }
      }
    } catch {
      warnings.push(`자산 ${assetId}의 실제 파일을 찾지 못해 복사하지 않았어요`);
      continue;
    }

    try {
      const target = safeOutputTarget(outDir, href);
      if (target === undefined) {
        warnings.push(`자산 ${assetId}의 출력 경로가 출력 폴더 밖으로 이어져 복사하지 않았어요`);
        continue;
      }
      copyFileSync(realSource, target);
      copied.push(target);
      hrefs.set(assetId, href);
      takenHrefs.add(href);
    } catch {
      warnings.push(`자산 ${assetId}를 출력 폴더로 복사하지 못했어요`);
    }
  }
  return { copied, hrefs };
}

function generateSessionCore(options: GenerateSessionCoreOptions): GenerateSessionResult {
  const outDir = path.resolve(options.outDir);
  const warnings = sanitizeWarnings(options.bundle.warnings ?? []);
  mkdirSync(outDir, { recursive: true });

  const prepared = prepareAssets(options.bundle, options.bundleDir, outDir, warnings);
  const page = path.join(outDir, sessionFileName(options.bundle));
  const html = renderSessionHtml(options.bundle, {
    tokenCss: options.tokenCss ?? readDesignTokenCss(),
    assetHrefs: prepared.hrefs,
    warnings,
    ...(options.collectionHref === undefined ? {} : { collectionHref: options.collectionHref }),
  });
  writeFileSync(page, html, "utf8");

  return {
    outDir,
    sessionId: options.bundle.sessionId,
    page,
    assets: prepared.copied,
    warnings,
  };
}

/** V2 세션 상세 HTML과 안전한 화면 자산을 만듭니다. */
export function generateSession(options: GenerateSessionOptions): GenerateSessionResult {
  return generateSessionCore(options);
}

function defaultCollectionId(bundles: readonly SessionBundleV2[]): string {
  const day = bundles[0]?.startedAt.slice(0, 10);
  return day === undefined || day === "" ? "세션 모음" : day;
}

/** V2 세션 상세 여러 장과 class/exam/meeting 공용 컬렉션 허브를 만듭니다. */
export function generateCollection(options: GenerateCollectionOptions): GenerateCollectionResult {
  const outDir = path.resolve(options.outDir);
  const collectionId = options.collectionId ?? defaultCollectionId(options.bundles);
  const tokenCss = options.tokenCss ?? readDesignTokenCss();
  const warnings: string[] = [];
  const pages: string[] = [];
  const assets: string[] = [];
  const drawn: SessionBundleV2[] = [];
  const takenPages = new Map<string, string>();
  mkdirSync(outDir, { recursive: true });

  for (const bundle of options.bundles) {
    const fileName = sessionFileName(bundle);
    const firstOwner = takenPages.get(fileName);
    if (firstOwner !== undefined) {
      warnings.push(`세션 ${bundle.sessionId}는 ${firstOwner}와 출력 파일 이름이 겹쳐서 건너뛰었어요`);
      continue;
    }
    try {
      const generated = generateSessionCore({
        bundle,
        outDir,
        tokenCss,
        collectionHref: COLLECTION_FILE_NAME,
        ...((options.bundleDirs?.[bundle.sessionId] ?? options.bundleDir) === undefined
          ? {}
          : {
              bundleDir: options.bundleDirs?.[bundle.sessionId] ?? options.bundleDir,
            }),
      });
      takenPages.set(fileName, bundle.sessionId);
      drawn.push(bundle);
      pages.push(generated.page);
      assets.push(...generated.assets);
      warnings.push(...generated.warnings.map((warning) => `${bundle.sessionId}: ${warning}`));
    } catch {
      warnings.push(`세션 ${bundle.sessionId} 상세 페이지를 만들지 못해 이 세션만 건너뛰었어요`);
    }
  }

  const hub = path.join(outDir, COLLECTION_FILE_NAME);
  writeFileSync(hub, renderCollectionHtml(drawn, { tokenCss, collectionId }), "utf8");
  pages.push(hub);
  return { outDir, collectionId, pages, assets, warnings };
}
