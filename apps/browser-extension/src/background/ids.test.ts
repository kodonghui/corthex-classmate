import { describe, expect, it } from 'vitest';

import { EventIdFactory, makeWorkerToken, toKstIso } from './ids';

describe('toKstIso', () => {
  it('계약 예시와 글자 단위로 같은 모양을 냅니다', () => {
    // 계약 `IsoDateTime` 의 보기: 2026-09-02T10:32:18+09:00
    expect(toKstIso(new Date(Date.UTC(2026, 8, 2, 1, 32, 18)))).toBe('2026-09-02T10:32:18+09:00');
  });

  it('PC 시간대와 상관없이 언제나 +09:00 으로 적습니다', () => {
    // 같은 순간(epoch)을 여러 번 적어도 같은 글자입니다. toISOString 은 Z 로,
    // toLocaleString 은 PC 설정을 따라가서 둘 다 계약과 어긋납니다.
    const at = new Date(0);
    expect(toKstIso(at)).toBe('1970-01-01T09:00:00+09:00');
  });

  it('자정을 넘기면 날짜도 함께 넘어갑니다', () => {
    // UTC 2026-09-01 15:00 = KST 2026-09-02 00:00
    expect(toKstIso(new Date(Date.UTC(2026, 8, 1, 15, 0, 0)))).toBe('2026-09-02T00:00:00+09:00');
  });
});

describe('makeWorkerToken', () => {
  it('붙임표를 뺀 여덟 글자입니다', () => {
    const token = makeWorkerToken(() => '1a2b3c4d-5e6f-7890-abcd-ef0123456789');
    expect(token).toBe('1a2b3c4d');
    expect(token).toHaveLength(8);
  });

  it('주입하지 않으면 실행 환경의 crypto 로 뽑습니다', () => {
    expect(makeWorkerToken()).toHaveLength(8);
  });
});

describe('EventIdFactory', () => {
  it('고정 계약 (라) 의 서비스 워커 모양 `ev-<periodId>-s<토큰>-<순번>` 을 냅니다', () => {
    const ids = new EventIdFactory('1a2b3c4d');
    expect(ids.next('2026-09-02-p3')).toBe('ev-2026-09-02-p3-s1a2b3c4d-1');
    expect(ids.next('2026-09-02-p3')).toBe('ev-2026-09-02-p3-s1a2b3c4d-2');
  });

  it('교시마다 순번을 따로 셉니다', () => {
    const ids = new EventIdFactory('zzzzzzzz');
    ids.next('2026-09-02-p3');
    ids.next('2026-09-02-p3');
    expect(ids.next('2026-09-02-p4')).toBe('ev-2026-09-02-p4-szzzzzzzz-1');
    expect(ids.issued('2026-09-02-p3')).toBe(2);
  });

  it('토큰이 비어 있으면 막습니다', () => {
    expect(() => new EventIdFactory('')).toThrow(RangeError);
  });
});
