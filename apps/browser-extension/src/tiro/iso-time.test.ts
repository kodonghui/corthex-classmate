// 확장이 찍는 시각 표기 — 오프셋을 넣어 어느 컴퓨터에서 돌려도 답이 같게 합니다.

import { describe, expect, it } from 'vitest';

import { isoOffsetLabel, toLocalIso } from './iso-time';

const AT = new Date('2026-09-03T02:20:46.959Z');

describe('isoOffsetLabel', () => {
  it('분을 ISO 오프셋 표기로 적습니다', () => {
    expect(isoOffsetLabel(540)).toBe('+09:00');
    expect(isoOffsetLabel(0)).toBe('+00:00');
    expect(isoOffsetLabel(-300)).toBe('-05:00');
    expect(isoOffsetLabel(330)).toBe('+05:30');
    expect(isoOffsetLabel(-570)).toBe('-09:30');
  });
});

describe('toLocalIso', () => {
  it('UTC 가 아니라 넣어 준 오프셋으로 적습니다', () => {
    // 실측에서 어긋났던 그 시각입니다. UTC 로 적으면 02:20:46, KST 로 적으면 11:20:46.
    expect(AT.toISOString()).toBe('2026-09-03T02:20:46.959Z');
    expect(toLocalIso(AT, 540)).toBe('2026-09-03T11:20:46.959+09:00');
  });

  it('오프셋 0 이면 시각은 UTC 와 같고 표기만 +00:00 입니다', () => {
    expect(toLocalIso(AT, 0)).toBe('2026-09-03T02:20:46.959+00:00');
  });

  it('음수 오프셋은 날짜가 하루 앞으로 넘어가도 맞게 적습니다', () => {
    expect(toLocalIso(AT, -300)).toBe('2026-09-02T21:20:46.959-05:00');
  });

  it('30분 단위 시간대도 적습니다', () => {
    expect(toLocalIso(AT, 330)).toBe('2026-09-03T07:50:46.959+05:30');
  });

  it('기본값은 이 컴퓨터의 오프셋입니다', () => {
    expect(toLocalIso(AT)).toBe(toLocalIso(AT, -AT.getTimezoneOffset()));
  });

  it('읽을 수 없는 시각은 막습니다', () => {
    expect(() => toLocalIso(new Date('아무 날짜도 아님'), 540)).toThrow(RangeError);
  });

  it('다시 읽으면 같은 순간입니다', () => {
    expect(Date.parse(toLocalIso(AT, 540))).toBe(AT.getTime());
    expect(Date.parse(toLocalIso(AT, -300))).toBe(AT.getTime());
  });
});
