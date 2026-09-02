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

/** 프레임 이미지 경로를 만들 때 쓰는 최소 정보입니다. 계약의 ScreenFrame 이 그대로 들어맞습니다. */
export interface FrameRef {
  /** 장면 식별자입니다. 계약상 번들 안에서 유일합니다. 보기 sf-p3-001 */
  readonly id: string;
  /** 번들 폴더를 기준으로 한 그림 경로입니다. 보기 frames/sf-p3-001.webp */
  readonly path: string;
}

/**
 * 번들 경로에서 확장자만 뽑습니다. 보기 frames/a/shot.WebP → .webp
 * 확장자가 없거나 글자·숫자가 아니면 빈 문자열입니다.
 */
function frameExtension(bundlePath: string): string {
  const fileName = bundlePath.split(/[\\/]+/).pop() ?? "";
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  const extension = fileName.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]+$/.test(extension) ? `.${extension}` : "";
}

/**
 * 출력 폴더 기준의 프레임 이미지 경로입니다. 보기 frames/p3/sf-p3-001.webp
 * 경로를 쓸 수 없으면 undefined 를 돌려주고, 화면에는 그림 대신 안내 문구를 둡니다.
 *
 * 목적 이름은 번들 경로의 **파일 이름이 아니라 장면 아이디**로 짓습니다. 파일 이름만 쓰면
 * `frames/a/shot.webp` 와 `frames/b/shot.webp`, `shot 1.webp` 와 `shot-1.webp` 가 모두 같은
 * 목적 경로가 되어 뒤엣것이 앞엣것을 조용히 덮어썼습니다. 아이디는 계약상 유일하므로 겹치지 않습니다.
 * 그래도 아이디가 겹치는 번들이 오면 generate.ts 의 copyFrames 가 warnings 에 남기고 덮어쓰지 않습니다.
 */
export function frameHref(ref: PeriodRef, frame: FrameRef): string | undefined {
  if (!isSafeBundlePath(frame.path)) {
    return undefined;
  }
  return `${FRAMES_DIR}/${periodKey(ref)}/${toSafeSlug(frame.id)}${frameExtension(frame.path)}`;
}
