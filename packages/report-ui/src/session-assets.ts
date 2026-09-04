// V2 세션 보고서의 파일 이름과 화면 자산 목적 경로를 한자리에서 정합니다.

import path from "node:path";

import { isSafeBundlePath } from "./assets.ts";
import { toSafeSlug } from "./format.ts";
import type { AssetRef, SessionBundleV2 } from "./types.ts";

/** 컬렉션 허브 파일 이름입니다. */
export const COLLECTION_FILE_NAME = "collection.html";

/** V2 화면 자산을 모아 두는 출력 하위 폴더입니다. */
export const SESSION_ASSETS_DIR = "assets";

/** 세션 상세 파일 이름입니다. */
export function sessionFileName(bundle: Pick<SessionBundleV2, "sessionId">): string {
  return `session-${toSafeSlug(bundle.sessionId)}.html`;
}

/** 실제 manifest path의 확장자를 그대로 보존합니다. */
function physicalExtension(assetPath: string): string | undefined {
  const extension = path.posix.extname(assetPath.replaceAll("\\", "/"));
  if (!/^\.(?:jpe?g|png|webp)$/i.test(extension)) {
    return undefined;
  }
  return extension;
}

function mediaTypeMatchesExtension(mediaType: string, extension: string): boolean {
  const normalized = mediaType.toLowerCase();
  switch (extension.toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return normalized === "image/jpeg";
    case ".png":
      return normalized === "image/png";
    case ".webp":
      return normalized === "image/webp";
    default:
      return false;
  }
}

/** 세션 HTML에서 쓸 화면 자산 상대경로입니다. 안전한 실제 이미지 경로가 아니면 만들지 않습니다. */
export function sessionAssetHref(
  bundle: Pick<SessionBundleV2, "sessionId">,
  asset: AssetRef,
): string | undefined {
  if (asset.kind !== "image" || !asset.mediaType.toLowerCase().startsWith("image/")) {
    return undefined;
  }
  if (asset.path.includes("\\") || !isSafeBundlePath(asset.path)) {
    return undefined;
  }
  const extension = physicalExtension(asset.path);
  if (extension === undefined || !mediaTypeMatchesExtension(asset.mediaType, extension)) {
    return undefined;
  }
  return `${SESSION_ASSETS_DIR}/${toSafeSlug(bundle.sessionId)}/${toSafeSlug(asset.id)}${extension}`;
}
