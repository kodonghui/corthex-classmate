import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PERIOD_NUMBER,
  PERIOD_ID_PATTERN,
  PERIOD_NUMBER_STORAGE_KEY,
  isPeriodId,
  normalizePeriodNumber,
  readPeriodNumber,
  resolvePeriodId,
} from './period';
import type { PeriodNumberStorage } from './period';

// 계약 정본을 **파일에서** 읽어 옵니다. 제품 코드는 계약 패키지를 `import type` 으로만 쓰지만
// 시험은 번들에 들어가지 않으므로 원본 JSON 을 그대로 맞대어 볼 수 있습니다.
import commonSchema from '@classmate/contracts/schemas/common.schema.json';

const PERIOD_ID_PATTERN_FROM_CONTRACT = new RegExp(commonSchema.definitions.PeriodId.pattern);

/** `chrome.storage.local` 흉내입니다. 확장 문맥 없이 값만 돌려줍니다. */
function fakeStorage(bag: Record<string, unknown>): PeriodNumberStorage {
  return {
    get: (key: string) => Promise.resolve(key in bag ? { [key]: bag[key] } : {}),
  };
}

describe('normalizePeriodNumber', () => {
  it('1~8 정수는 그대로 둡니다', () => {
    expect(normalizePeriodNumber(1)).toBe(1);
    expect(normalizePeriodNumber(3)).toBe(3);
    expect(normalizePeriodNumber(8)).toBe(8);
  });

  it('범위 밖·소수·숫자가 아닌 값은 1 로 되돌립니다', () => {
    expect(normalizePeriodNumber(0)).toBe(1);
    expect(normalizePeriodNumber(9)).toBe(1);
    expect(normalizePeriodNumber(-2)).toBe(1);
    expect(normalizePeriodNumber(2.5)).toBe(1);
    expect(normalizePeriodNumber('3')).toBe(1);
    expect(normalizePeriodNumber(null)).toBe(1);
    expect(normalizePeriodNumber(undefined)).toBe(1);
    expect(normalizePeriodNumber(Number.NaN)).toBe(1);
  });
});

describe('readPeriodNumber', () => {
  it('저장소에 든 값을 그대로 쓰고 근거를 storage 로 알립니다', async () => {
    const storage = fakeStorage({ [PERIOD_NUMBER_STORAGE_KEY]: 5 });
    await expect(readPeriodNumber(storage)).resolves.toEqual({ value: 5, source: 'storage' });
  });

  it('저장소가 비어 있으면 기본값 1 이고 근거는 default 입니다', async () => {
    await expect(readPeriodNumber(fakeStorage({}))).resolves.toEqual({
      value: DEFAULT_PERIOD_NUMBER,
      source: 'default',
    });
  });

  it('저장소 값이 범위 밖이면 1 로 보정하고 근거는 default 입니다', async () => {
    await expect(
      readPeriodNumber(fakeStorage({ [PERIOD_NUMBER_STORAGE_KEY]: 12 })),
    ).resolves.toEqual({ value: 1, source: 'default' });
    await expect(
      readPeriodNumber(fakeStorage({ [PERIOD_NUMBER_STORAGE_KEY]: '3교시' })),
    ).resolves.toEqual({ value: 1, source: 'default' });
  });

  it('저장소 읽기가 실패해도 오류를 던지지 않고 1 을 주되 error 라고 알립니다', async () => {
    // "값 없음"과 "읽기 실패"가 똑같이 1 로 나오면, 3교시 수업이 저장소 오류로 조용히
    // 1교시에 섞여도 부르는 쪽이 알아챌 방법이 없습니다.
    const broken: PeriodNumberStorage = {
      get: () => Promise.reject(new Error('확장 문맥이 내려갔어요')),
    };
    await expect(readPeriodNumber(broken)).resolves.toEqual({ value: 1, source: 'error' });
  });

  it('chrome 전역이 없는 곳(단위 시험·일반 웹페이지)에서도 1 을 줍니다', async () => {
    // 저장소를 넣지 않으면 chrome.storage.local 을 찾는데, 여기에는 chrome 전역이 없습니다.
    // 저장소가 아예 없는 것은 실패가 아니라 "값 없음"입니다.
    expect(typeof chrome).toBe('undefined');
    await expect(readPeriodNumber()).resolves.toEqual({ value: 1, source: 'default' });
  });
});

describe('isPeriodId', () => {
  it('계약 정본(common.schema.json)의 PeriodId 모양만 통과시킵니다', () => {
    expect(isPeriodId('2026-09-02-p3')).toBe(true);
    expect(isPeriodId('2026-09-02-p12')).toBe(true);

    expect(isPeriodId('오늘-3교시')).toBe(false);
    expect(isPeriodId('2026-9-2-p3')).toBe(false);
    expect(isPeriodId('2026-09-02-p0')).toBe(false);
    expect(isPeriodId('2026-09-02')).toBe(false);
    expect(isPeriodId(' 2026-09-02-p3')).toBe(false);
  });

  it('여기 적은 정규식이 계약 스키마의 패턴과 같습니다', () => {
    // 계약 패키지는 제품 코드에서 `import type` 으로만 빌려 오므로 정규식을 값으로 가져올 수
    // 없습니다. 그래서 이 시험이 두 곳이 갈라지지 않게 지킵니다.
    expect(PERIOD_ID_PATTERN.source).toBe(PERIOD_ID_PATTERN_FROM_CONTRACT.source);
  });
});

describe('resolvePeriodId', () => {
  it('periodId 를 직접 넣으면 그대로 씁니다', () => {
    expect(resolvePeriodId({ periodId: '2026-09-02-p3' })).toBe('2026-09-02-p3');
  });

  it('교시 번호와 시계를 넣으면 계약 모양으로 만듭니다', () => {
    const id = resolvePeriodId({
      periodNumber: 4,
      now: () => new Date(2026, 8, 2, 10, 32, 18),
    });
    expect(id).toBe('2026-09-02-p4');
    expect(id).toMatch(PERIOD_ID_PATTERN);
  });

  it('교시 번호가 범위 밖이면 1교시로 보정합니다', () => {
    expect(resolvePeriodId({ periodNumber: 0, now: () => new Date(2026, 8, 2) })).toBe(
      '2026-09-02-p1',
    );
    expect(resolvePeriodId({ periodNumber: 99, now: () => new Date(2026, 8, 2) })).toBe(
      '2026-09-02-p1',
    );
  });

  it('아무것도 넣지 않으면 오늘 날짜의 1교시입니다', () => {
    expect(resolvePeriodId({})).toMatch(PERIOD_ID_PATTERN);
    expect(resolvePeriodId({})).toMatch(/-p1$/);
  });

  it('periodId 가 있으면 교시 번호는 보지 않습니다', () => {
    expect(resolvePeriodId({ periodId: '2026-09-02-p7', periodNumber: 2 })).toBe('2026-09-02-p7');
  });

  it('주입한 periodId 가 계약 모양이 아니면 그 자리에서 던집니다', () => {
    // 교시 번호와 달리 1 로 되돌릴 안전한 값이 없습니다. 이 값은 손대지 않은 채 모든
    // 세그먼트에 실려 나가므로, 세그먼트가 다 만들어진 뒤 스키마에 걸리는 것보다
    // 넣는 자리에서 막는 편이 낫습니다.
    expect(() => resolvePeriodId({ periodId: '오늘-3교시' })).toThrow(RangeError);
    expect(() => resolvePeriodId({ periodId: '2026-9-2-p3' })).toThrow(/YYYY-MM-DD-p/);
    expect(() => resolvePeriodId({ periodId: '2026-09-02-p0' })).toThrow(RangeError);
    expect(() => resolvePeriodId({ periodId: '' })).toThrow(RangeError);
  });

  it('만들어 낸 값은 언제나 계약 모양입니다', () => {
    for (const periodNumber of [1, 3, 8, 0, 99, -1]) {
      expect(resolvePeriodId({ periodNumber, now: () => new Date(2026, 8, 2) })).toMatch(
        PERIOD_ID_PATTERN_FROM_CONTRACT,
      );
    }
  });
});
