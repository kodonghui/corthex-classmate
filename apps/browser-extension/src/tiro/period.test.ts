import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PERIOD_NUMBER,
  PERIOD_NUMBER_STORAGE_KEY,
  normalizePeriodNumber,
  readPeriodNumber,
  resolvePeriodId,
} from './period';
import type { PeriodNumberStorage } from './period';

// 계약 정본의 PeriodId 모양입니다(common.schema.json). 값 검증은 관찰기 시험에서 Ajv 로 합니다.
const PERIOD_ID_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-p[1-9][0-9]*$/;

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
  it('저장소에 든 값을 그대로 씁니다', async () => {
    const storage = fakeStorage({ [PERIOD_NUMBER_STORAGE_KEY]: 5 });
    await expect(readPeriodNumber(storage)).resolves.toBe(5);
  });

  it('저장소가 비어 있으면 기본값 1 입니다', async () => {
    await expect(readPeriodNumber(fakeStorage({}))).resolves.toBe(DEFAULT_PERIOD_NUMBER);
  });

  it('저장소 값이 범위 밖이면 1 로 보정합니다', async () => {
    await expect(readPeriodNumber(fakeStorage({ [PERIOD_NUMBER_STORAGE_KEY]: 12 }))).resolves.toBe(
      1,
    );
    await expect(
      readPeriodNumber(fakeStorage({ [PERIOD_NUMBER_STORAGE_KEY]: '3교시' })),
    ).resolves.toBe(1);
  });

  it('저장소 읽기가 실패해도 오류를 던지지 않고 1 을 줍니다', async () => {
    const broken: PeriodNumberStorage = {
      get: () => Promise.reject(new Error('확장 문맥이 내려갔어요')),
    };
    await expect(readPeriodNumber(broken)).resolves.toBe(1);
  });

  it('chrome 전역이 없는 곳(단위 시험·일반 웹페이지)에서도 1 을 줍니다', async () => {
    // 저장소를 넣지 않으면 chrome.storage.local 을 찾는데, 여기에는 chrome 전역이 없습니다.
    expect(typeof chrome).toBe('undefined');
    await expect(readPeriodNumber()).resolves.toBe(1);
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
});
