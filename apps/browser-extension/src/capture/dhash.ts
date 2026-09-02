/**
 * dHash(difference hash · 차이 해시) — 화면이 바뀌었는지만 알아내는 아주 작은 지문입니다.
 *
 * 왜 필요한가 (불변 원칙 §4-4):
 *   화면 전체 영상은 저장하지 않습니다. 그래서 "바뀐 장면"만 골라내야 하는데,
 *   픽셀을 통째로 비교하면 마우스 커서 한 칸·인코딩 잡음에도 매번 "바뀌었다"가 됩니다.
 *   dHash 는 그림을 9x8 회색조로 뭉갠 뒤 **가로로 이웃한 밝기 대소만** 64비트로 적습니다.
 *   밝기가 통째로 오르내려도(창 밝기·비디오 비트레이트) 대소 관계는 잘 안 바뀌므로,
 *   잡음에는 둔하고 슬라이드 교체 같은 구조 변화에는 민감합니다.
 *
 * 이 파일에는 브라우저 API 가 하나도 없습니다. Node(Vitest)에서도 그대로 돌아가야
 * 합성 프레임으로 감지 성능을 잴 수 있고, spikes/meet-capture-measure.mjs 가
 * 이 파일을 그대로 브라우저에 주입해 같은 코드로 두 곳을 잴 수 있기 때문입니다.
 * (그래서 enum·namespace·매개변수 프로퍼티를 쓰지 않습니다. Node 의 타입 제거가
 *  지원하지 않는 문법입니다.)
 */

/**
 * RGBA 픽셀 한 장. 브라우저의 `ImageData` 와 같은 모양이지만 DOM 타입에 기대지 않습니다.
 * `data` 길이는 `width * height * 4` 여야 합니다(R,G,B,A 순서).
 */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** 축소 가로 칸 수. 가로 비교를 8번 하려면 칸이 9개 있어야 합니다. */
export const HASH_WIDTH = 9;

/** 축소 세로 칸 수. */
export const HASH_HEIGHT = 8;

/** 해시 비트 수. (HASH_WIDTH - 1) * HASH_HEIGHT = 64. */
export const HASH_BITS = (HASH_WIDTH - 1) * HASH_HEIGHT;

/** 16진 문자열로 적었을 때의 길이. 64비트 = 16글자. */
export const HASH_HEX_LENGTH = HASH_BITS / 4;

/**
 * 기본 변화 임계값. 64비트 중 이만큼 이상 다르면 "화면이 바뀌었다"로 봅니다.
 * 합성 프레임 측정(dhash.test.ts)에서 잡음은 0~2, 다른 슬라이드는 20 이상이 나와
 * 그 사이를 넉넉히 갈라 놓은 값입니다. 실측 뒤 docs/DECISIONS.md 에 확정합니다.
 */
export const DEFAULT_CHANGE_THRESHOLD = 10;

/**
 * 대소를 가를 때 두는 여유(회색 단계 0~255 기준).
 *
 * 왜 필요한가: 수업 화면에는 완전히 평평한 자리가 많습니다(흰 슬라이드 여백, 에디터 배경).
 * 그런 자리는 이웃 두 칸의 평균 밝기가 **거의 정확히 같아서**, 잡음이 0.01만 얹혀도
 * 대소가 뒤집히고 "화면이 바뀌었다" 가 됩니다. 그러면 안 바뀐 장면을 계속 WebP 로
 * 인코딩하게 됩니다. 이 여유만큼 차이가 나야 1로 세면 동률 근처가 안정됩니다.
 *
 * 값이 1.0 인 근거: 1280x720 을 9x8 로 뭉치면 한 칸이 약 142x90 = 12,780 픽셀입니다.
 * ±12 단계 균일 잡음의 칸 평균 표준편차는 12/√3/√12780 ≈ 0.06 단계이므로 1.0 은
 * 그 16배쯤 되는 여유입니다. 실측은 dhash.test.ts 가 찍는 거리 로그로 확인합니다.
 */
export const HASH_EPSILON = 1;

function assertImage(image: RgbaImage): void {
  if (!Number.isInteger(image.width) || image.width <= 0) {
    throw new RangeError('프레임 가로 크기가 올바르지 않아요');
  }
  if (!Number.isInteger(image.height) || image.height <= 0) {
    throw new RangeError('프레임 세로 크기가 올바르지 않아요');
  }
  if (image.data.length < image.width * image.height * 4) {
    throw new RangeError('프레임 픽셀 수가 가로x세로x4 보다 적어요');
  }
}

/**
 * 그림을 회색조로 바꾸면서 `targetWidth x targetHeight` 칸으로 뭉갭니다.
 *
 * 칸마다 그 안에 들어온 원본 픽셀의 밝기 평균을 냅니다(박스 평균). 가장 가까운 픽셀
 * 하나만 집으면 1픽셀 잡음이 그대로 살아남아 잡음에 민감해지기 때문입니다.
 *
 * 밝기 = 0.299R + 0.587G + 0.114B (Rec.601 휘도). 알파는 보지 않습니다.
 */
export function toGrayscaleGrid(
  image: RgbaImage,
  targetWidth: number = HASH_WIDTH,
  targetHeight: number = HASH_HEIGHT,
): Float64Array {
  assertImage(image);

  const width = image.width;
  const height = image.height;
  const data = image.data;

  const sums = new Float64Array(targetWidth * targetHeight);
  const counts = new Uint32Array(targetWidth * targetHeight);

  // x -> 가로 칸 번호를 미리 계산합니다. 안쪽 반복에서 나눗셈을 없애려는 것입니다.
  const columnBins = new Uint16Array(width);
  for (let x = 0; x < width; x += 1) {
    const bin = Math.floor((x * targetWidth) / width);
    columnBins[x] = bin < targetWidth ? bin : targetWidth - 1;
  }

  for (let y = 0; y < height; y += 1) {
    const rowBin = Math.min(targetHeight - 1, Math.floor((y * targetHeight) / height));
    const binRowBase = rowBin * targetWidth;
    const pixelRowBase = y * width * 4;

    for (let x = 0; x < width; x += 1) {
      const p = pixelRowBase + x * 4;
      const r = data[p] ?? 0;
      const g = data[p + 1] ?? 0;
      const b = data[p + 2] ?? 0;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      const bin = binRowBase + (columnBins[x] ?? 0);
      sums[bin] = (sums[bin] ?? 0) + gray;
      counts[bin] = (counts[bin] ?? 0) + 1;
    }
  }

  const grid = new Float64Array(targetWidth * targetHeight);
  for (let i = 0; i < grid.length; i += 1) {
    const count = counts[i] ?? 0;
    grid[i] = count === 0 ? 0 : (sums[i] ?? 0) / count;
  }
  return grid;
}

/**
 * 프레임 한 장의 64비트 dHash 를 만듭니다.
 *
 * 비트 순서는 위 줄부터, 각 줄은 왼쪽부터입니다. 첫 비교가 가장 높은 자리(MSB)입니다.
 * "왼쪽 칸이 오른쪽 칸보다 `epsilon` 이상 밝으면 1" 규칙 하나만 씁니다.
 */
export function computeDHash(image: RgbaImage, epsilon: number = HASH_EPSILON): bigint {
  if (!Number.isFinite(epsilon) || epsilon < 0) {
    throw new RangeError('여유 값은 0 이상의 숫자여야 해요');
  }
  const grid = toGrayscaleGrid(image, HASH_WIDTH, HASH_HEIGHT);

  let hash = 0n;
  for (let row = 0; row < HASH_HEIGHT; row += 1) {
    const base = row * HASH_WIDTH;
    for (let col = 0; col < HASH_WIDTH - 1; col += 1) {
      const left = grid[base + col] ?? 0;
      const right = grid[base + col + 1] ?? 0;
      hash = (hash << 1n) | (left > right + epsilon ? 1n : 0n);
    }
  }
  return hash;
}

/**
 * 해시를 소문자 16진 16글자로 적습니다.
 * packages/contracts 의 screen-frame.schema.json `hash` 규칙(`^[0-9a-f]+$`, 8~64글자)에 맞습니다.
 */
export function toHex(hash: bigint): string {
  if (hash < 0n) {
    throw new RangeError('해시는 음수가 될 수 없어요');
  }
  return hash.toString(16).padStart(HASH_HEX_LENGTH, '0');
}

/** 16진 문자열을 해시로 되돌립니다. 저장한 프레임과 다시 견줄 때 씁니다. */
export function fromHex(hex: string): bigint {
  if (!/^[0-9a-f]+$/.test(hex)) {
    throw new RangeError('해시 문자열은 소문자 16진이어야 해요');
  }
  return BigInt(`0x${hex}`);
}

/**
 * 두 해시가 몇 비트나 다른지 셉니다(해밍 거리). 0 이면 완전히 같은 지문입니다.
 * 32비트씩 잘라 세면 BigInt 연산 횟수가 64번에서 두 번으로 줄어듭니다.
 */
export function hammingDistance(a: bigint, b: bigint): number {
  if (a < 0n || b < 0n) {
    throw new RangeError('해시는 음수가 될 수 없어요');
  }

  let diff = a ^ b;
  let count = 0;
  while (diff > 0n) {
    let chunk = Number(diff & 0xffffffffn);
    diff >>= 32n;
    while (chunk !== 0) {
      chunk &= chunk - 1; // 가장 낮은 1비트 하나를 지웁니다.
      count += 1;
    }
  }
  return count;
}

/**
 * 화면이 바뀌었는지 판정합니다.
 *
 * - 앞 프레임이 없으면(첫 장) 무조건 `true` 입니다. 첫 장은 기준이 되어야 하니까요.
 * - 그 밖에는 해밍 거리가 `threshold` **이상**이면 바뀐 것으로 봅니다.
 */
export function isChanged(
  previous: bigint | null | undefined,
  next: bigint,
  threshold: number = DEFAULT_CHANGE_THRESHOLD,
): boolean {
  if (previous === null || previous === undefined) {
    return true;
  }
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new RangeError('임계값은 0 이상의 숫자여야 해요');
  }
  return hammingDistance(previous, next) >= threshold;
}
