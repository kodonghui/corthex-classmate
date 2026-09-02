// 출력 폴더 안에서 파일이 어디에 놓이는지 한자리에서 정합니다.
//
// 템플릿(img 의 src)과 생성기(파일 복사)가 같은 계산을 써야 그림이 깨지지 않습니다.
// 그래서 두 곳이 모두 이 파일의 함수만 부릅니다.

import { toSafeSlug } from "./format.ts";
import type { PeriodRef } from "./types.ts";

/** 출력 폴더 안에서 프레임 이미지를 모아 두는 자리입니다. */
export const FRAMES_DIR = "frames";

/** 하루 허브 파일 이름입니다. */
export const HUB_FILE_NAME = "hub.html";

/** 교시를 파일 이름에 쓸 수 있는 짧은 열쇠로 바꿉니다. 보기 3교시 → p3 */
export function periodKey(ref: PeriodRef): string {
  return ref.index === undefined ? toSafeSlug(ref.periodId) : `p${ref.index}`;
}

/** 교시 상세 HTML 파일 이름입니다. 보기 period-3.html */
export function periodFileName(ref: PeriodRef): string {
  return ref.index === undefined
    ? `period-${toSafeSlug(ref.periodId)}.html`
    : `period-${ref.index}.html`;
}

/**
 * 번들이 적어 준 프레임 경로가 출력 폴더 밖으로 나가지 않는지 봅니다.
 * 절대 경로나 상위 폴더(..)로 올라가는 경로는 받지 않습니다.
 */
export function isSafeBundlePath(bundlePath: string): boolean {
  if (bundlePath === "" || /^[A-Za-z]:/.test(bundlePath) || bundlePath.startsWith("/") || bundlePath.startsWith("\\")) {
    return false;
  }
  return bundlePath
    .split(/[\\/]+/)
    .every((part) => part !== "" && part !== "." && part !== "..");
}

/**
 * 출력 폴더 기준의 프레임 이미지 경로입니다. 보기 frames/p3/frame-001.webp
 * 경로를 쓸 수 없으면 undefined 를 돌려주고, 화면에는 그림 대신 안내 문구를 둡니다.
 */
export function frameHref(ref: PeriodRef, bundlePath: string): string | undefined {
  if (!isSafeBundlePath(bundlePath)) {
    return undefined;
  }
  const parts = bundlePath.split(/[\\/]+/);
  const fileName = parts[parts.length - 1];
  if (fileName === undefined) {
    return undefined;
  }
  return `${FRAMES_DIR}/${periodKey(ref)}/${toSafeSlug(fileName)}`;
}
