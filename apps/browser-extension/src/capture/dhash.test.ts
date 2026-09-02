import { describe, expect, it } from 'vitest';
import {
  computeDHash,
  DEFAULT_CHANGE_THRESHOLD,
  fromHex,
  hammingDistance,
  HASH_BITS,
  HASH_HEX_LENGTH,
  isChanged,
  toGrayscaleGrid,
  toHex,
} from './dhash';
import {
  codeFrameOptions,
  makeCodeFrame,
  makeFrame,
  makeSlideFrame,
  withNoise,
} from './synthetic-frame';

const WIDTH = 1280;
const HEIGHT = 720;

describe('toGrayscaleGrid', () => {
  it('9x8 = 72칸으로 뭉갭니다', () => {
    const grid = toGrayscaleGrid(makeCodeFrame(WIDTH, HEIGHT));
    expect(grid.length).toBe(72);
  });

  it('단색 화면은 모든 칸의 밝기가 같습니다', () => {
    const grid = toGrayscaleGrid(makeFrame({ width: 64, height: 64, background: 128 }));
    for (const value of grid) {
      expect(value).toBeCloseTo(128, 6);
    }
  });

  it('크기가 올바르지 않으면 RangeError 로 막습니다', () => {
    expect(() => toGrayscaleGrid({ width: 0, height: 4, data: new Uint8ClampedArray(0) })).toThrow(
      RangeError,
    );
    expect(() => toGrayscaleGrid({ width: 4, height: 4, data: new Uint8ClampedArray(8) })).toThrow(
      RangeError,
    );
  });
});

describe('computeDHash', () => {
  it('64비트 안에 들어가고 16진 16글자로 적힙니다', () => {
    const hash = computeDHash(makeCodeFrame(WIDTH, HEIGHT));
    expect(hash).toBeLessThan(1n << BigInt(HASH_BITS));
    const hex = toHex(hash);
    expect(hex).toHaveLength(HASH_HEX_LENGTH);
    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(fromHex(hex)).toBe(hash);
  });

  it('똑같은 프레임 두 장의 거리는 0 입니다', () => {
    const a = computeDHash(makeCodeFrame(WIDTH, HEIGHT));
    const b = computeDHash(makeCodeFrame(WIDTH, HEIGHT));
    expect(hammingDistance(a, b)).toBe(0);
    expect(isChanged(a, b)).toBe(false);
  });

  it('잡음만 얹은 프레임은 거리가 임계값보다 훨씬 작습니다', () => {
    const options = codeFrameOptions(WIDTH, HEIGHT);
    const clean = computeDHash(makeFrame(options));

    const distances = [4, 8, 12, 20].map((amplitude) =>
      hammingDistance(clean, computeDHash(withNoise(options, amplitude, 20260902 + amplitude))),
    );
    console.log(`[gate-b] 잡음 ±4·8·12·20 단계의 dHash 거리 ${distances.join(' · ')}`);

    // 잡음은 칸 평균에서 거의 상쇄되므로 몇 비트 안에 머물러야 합니다.
    for (const distance of distances) {
      expect(distance).toBeLessThan(DEFAULT_CHANGE_THRESHOLD);
    }
    expect(isChanged(clean, computeDHash(withNoise(options, 12, 20260902)))).toBe(false);
  });

  it('다른 슬라이드로 넘어가면 거리가 임계값을 크게 넘습니다', () => {
    const code = computeDHash(makeCodeFrame(WIDTH, HEIGHT, 0));
    const slide = computeDHash(makeSlideFrame(WIDTH, HEIGHT));
    const distance = hammingDistance(code, slide);
    console.log(`[gate-b] 코드 화면 ↔ 슬라이드 화면 dHash 거리 ${distance}`);

    expect(distance).toBeGreaterThanOrEqual(DEFAULT_CHANGE_THRESHOLD);
    expect(isChanged(code, slide)).toBe(true);
  });

  it('같은 코드 화면이라도 줄 배치가 바뀌면 바뀐 것으로 봅니다', () => {
    const first = computeDHash(makeCodeFrame(WIDTH, HEIGHT, 0));
    const second = computeDHash(makeCodeFrame(WIDTH, HEIGHT, 1));
    expect(isChanged(first, second)).toBe(true);
  });

  it('1280x720 한 장의 dHash 시간을 20회 평균으로 잽니다', () => {
    const frame = makeCodeFrame(WIDTH, HEIGHT);
    const runs = 20;

    // 첫 회는 JIT 예열이라 재지 않습니다.
    computeDHash(frame);

    const startedAt = performance.now();
    for (let i = 0; i < runs; i += 1) {
      computeDHash(frame);
    }
    const averageMs = (performance.now() - startedAt) / runs;

    // 측정값은 docs/spikes/gate-b-meet.md 에 옮겨 적습니다.
    console.log(`[gate-b] dHash 1280x720 평균 ${averageMs.toFixed(3)} ms (${runs}회)`);

    // 1fps 샘플링이므로 한 장에 1000ms 를 넘으면 파이프라인이 못 따라갑니다.
    // 넉넉히 100ms 로 잡아 회귀만 잡습니다.
    expect(averageMs).toBeLessThan(100);
  });
});

describe('hammingDistance · isChanged', () => {
  it('비트 하나 차이는 1 입니다', () => {
    expect(hammingDistance(0n, 1n)).toBe(1);
    expect(hammingDistance(0b1011n, 0b1110n)).toBe(2);
  });

  it('64비트 전부가 다르면 64 입니다', () => {
    const all = (1n << 64n) - 1n;
    expect(hammingDistance(0n, all)).toBe(64);
  });

  it('앞 프레임이 없으면 첫 장은 언제나 바뀐 것으로 봅니다', () => {
    expect(isChanged(null, 0n)).toBe(true);
    expect(isChanged(undefined, 0n)).toBe(true);
  });

  it('임계값과 정확히 같으면 바뀐 것으로 봅니다', () => {
    expect(isChanged(0n, 0b111n, 3)).toBe(true);
    expect(isChanged(0n, 0b11n, 3)).toBe(false);
  });

  it('음수 해시와 음수 임계값은 RangeError 로 막습니다', () => {
    expect(() => hammingDistance(-1n, 0n)).toThrow(RangeError);
    expect(() => toHex(-1n)).toThrow(RangeError);
    expect(() => fromHex('ZZ')).toThrow(RangeError);
    expect(() => isChanged(0n, 1n, -1)).toThrow(RangeError);
  });
});
