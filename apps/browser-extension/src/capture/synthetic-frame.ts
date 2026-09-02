/**
 * 시험용 합성 프레임 생성기.
 *
 * 실제 수업 화면을 저장소에 담지 않기 위해(불변 원칙 §4-3·§4-4) 감지 시험은 전부
 * 지어낸 그림으로 합니다. 여기에는 수업 내용이 한 글자도 들어가지 않고, 회색 사각형만
 * 그립니다. 그래도 dHash 가 보는 것은 "이웃한 칸 중 어느 쪽이 밝은가" 뿐이라
 * 슬라이드 교체와 잡음의 차이를 재는 데는 이 정도면 충분합니다.
 *
 * 이 파일은 시험에서만 부릅니다. 확장 번들에는 아무 데서도 참조하지 않아 들어가지 않습니다.
 */

import type { RgbaImage } from './dhash';

/** 그림 위에 얹을 사각형 하나. 좌표는 0~1 비율입니다. */
export interface Block {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0(검정)~255(흰색) 회색 값입니다. */
  gray: number;
}

export interface SyntheticFrameOptions {
  width: number;
  height: number;
  /** 바탕 회색 값입니다. */
  background: number;
  blocks?: Block[];
  /** 픽셀마다 더할 잡음의 진폭(±). 0 이면 잡음 없음. */
  noise?: number;
  /** 잡음 난수 씨앗. 같은 씨앗이면 같은 그림이 나옵니다. */
  seed?: number;
}

/** 아주 작은 결정적 난수(32비트 LCG). 시험이 매번 같은 결과를 내게 하려는 것입니다. */
function makeRandom(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function clampGray(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

/** 옵션대로 RGBA 프레임 한 장을 만듭니다. 알파는 항상 255 입니다. */
export function makeFrame(options: SyntheticFrameOptions): RgbaImage {
  const { width, height, background } = options;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i += 1) {
    const p = i * 4;
    data[p] = background;
    data[p + 1] = background;
    data[p + 2] = background;
    data[p + 3] = 255;
  }

  for (const block of options.blocks ?? []) {
    const x0 = Math.max(0, Math.round(block.x * width));
    const y0 = Math.max(0, Math.round(block.y * height));
    const x1 = Math.min(width, Math.round((block.x + block.width) * width));
    const y1 = Math.min(height, Math.round((block.y + block.height) * height));

    for (let y = y0; y < y1; y += 1) {
      const rowBase = y * width * 4;
      for (let x = x0; x < x1; x += 1) {
        const p = rowBase + x * 4;
        data[p] = block.gray;
        data[p + 1] = block.gray;
        data[p + 2] = block.gray;
        data[p + 3] = 255;
      }
    }
  }

  const noise = options.noise ?? 0;
  if (noise > 0) {
    const random = makeRandom(options.seed ?? 1);
    for (let i = 0; i < width * height; i += 1) {
      const p = i * 4;
      const delta = (random() * 2 - 1) * noise;
      data[p] = clampGray((data[p] ?? 0) + delta);
      data[p + 1] = clampGray((data[p + 1] ?? 0) + delta);
      data[p + 2] = clampGray((data[p + 2] ?? 0) + delta);
    }
  }

  return { width, height, data };
}

/** 코드 화면 흉내에 쓰는 줄 길이 배치 두 벌입니다. */
const CODE_LINE_WIDTHS = [
  [0.55, 0.32, 0.71, 0.18, 0.62, 0.4, 0.25, 0.5],
  [0.2, 0.68, 0.35, 0.58, 0.14, 0.74, 0.46, 0.28],
];

/**
 * "코드 화면" 옵션입니다. 어두운 바탕에 왼쪽 정렬된 밝은 줄 여덟 개.
 * `variant` 를 바꾸면 줄 길이 배치가 달라져 다른 화면이 됩니다.
 * 옵션을 따로 내주는 이유는 같은 화면에 잡음만 얹은 장을 만들기 위해서입니다.
 */
export function codeFrameOptions(
  width: number,
  height: number,
  variant = 0,
): SyntheticFrameOptions {
  const pattern = CODE_LINE_WIDTHS[variant % CODE_LINE_WIDTHS.length] ?? [];
  const blocks: Block[] = pattern.map((lineWidth, index) => ({
    x: 0.06,
    y: 0.08 + index * 0.11,
    width: lineWidth,
    height: 0.05,
    gray: 210,
  }));
  return { width, height, background: 28, blocks };
}

/** 코드 화면 한 장을 만듭니다. */
export function makeCodeFrame(width: number, height: number, variant = 0): RgbaImage {
  return makeFrame(codeFrameOptions(width, height, variant));
}

/** "슬라이드 화면" 옵션입니다. 밝은 바탕에 큰 제목 덩어리와 항목 줄들. */
export function slideFrameOptions(width: number, height: number): SyntheticFrameOptions {
  return {
    width,
    height,
    background: 236,
    blocks: [
      { x: 0.08, y: 0.12, width: 0.62, height: 0.14, gray: 30 },
      { x: 0.08, y: 0.42, width: 0.78, height: 0.07, gray: 90 },
      { x: 0.08, y: 0.58, width: 0.44, height: 0.07, gray: 90 },
      { x: 0.62, y: 0.72, width: 0.3, height: 0.18, gray: 150 },
    ],
  };
}

/** 슬라이드 화면 한 장을 만듭니다. */
export function makeSlideFrame(width: number, height: number): RgbaImage {
  return makeFrame(slideFrameOptions(width, height));
}

/** 같은 그림에 잡음만 얹은 장을 만듭니다. 캡처 인코딩 잡음·커서 흔들림을 흉내 냅니다. */
export function withNoise(
  base: SyntheticFrameOptions,
  noise: number,
  seed: number,
): RgbaImage {
  return makeFrame({ ...base, noise, seed });
}
