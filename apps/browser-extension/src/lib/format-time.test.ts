import { describe, expect, it } from 'vitest';
import { formatAgo, formatClock, NO_VALUE } from './format-time';

// 로컬 시간대에 흔들리지 않도록 로컬 기준으로 Date 를 만듭니다.
function localDate(hours: number, minutes: number, seconds: number): Date {
  return new Date(2026, 8, 2, hours, minutes, seconds);
}

describe('formatClock', () => {
  it('골든 시나리오의 질문 시각을 10:32:18 로 씁니다', () => {
    expect(formatClock(localDate(10, 32, 18))).toBe('10:32:18');
  });

  it('한 자리 수는 앞에 0 을 붙여 두 자리로 맞춥니다', () => {
    expect(formatClock(localDate(9, 5, 7))).toBe('09:05:07');
  });

  it('자정과 하루의 끝을 24시간 형식으로 씁니다', () => {
    expect(formatClock(localDate(0, 0, 0))).toBe('00:00:00');
    expect(formatClock(localDate(23, 59, 59))).toBe('23:59:59');
  });

  it('올바르지 않은 Date 는 RangeError 로 막습니다', () => {
    expect(() => formatClock(new Date('아무 날짜도 아님'))).toThrow(RangeError);
  });
});

describe('formatAgo', () => {
  it('아직 붙잡은 자료가 없으면 — 한 글자만 남깁니다', () => {
    expect(formatAgo(null)).toBe(NO_VALUE);
    expect(formatAgo(undefined)).toBe(NO_VALUE);
  });

  it('초 단위는 N초 전 으로 씁니다', () => {
    expect(formatAgo(0)).toBe('0초 전');
    expect(formatAgo(4)).toBe('4초 전');
    expect(formatAgo(59)).toBe('59초 전');
  });

  it('소수점은 버려서 실제보다 새것이라고 말하지 않습니다', () => {
    expect(formatAgo(3.9)).toBe('3초 전');
  });

  it('60초 이상은 분, 60분 이상은 시간으로 올립니다', () => {
    expect(formatAgo(60)).toBe('1분 전');
    expect(formatAgo(3599)).toBe('59분 전');
    expect(formatAgo(3600)).toBe('1시간 전');
    expect(formatAgo(7260)).toBe('2시간 전');
  });

  it('음수와 숫자가 아닌 값도 — 로 떨어뜨립니다', () => {
    expect(formatAgo(-1)).toBe(NO_VALUE);
    expect(formatAgo(Number.NaN)).toBe(NO_VALUE);
    expect(formatAgo(Number.POSITIVE_INFINITY)).toBe(NO_VALUE);
  });
});
