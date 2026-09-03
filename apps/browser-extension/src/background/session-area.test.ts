import { describe, expect, it } from 'vitest';

import { pickSessionArea } from './session-area';
import type { SessionAreaLike } from './session-area';

const area = (name: string): SessionAreaLike => ({
  get: () => Promise.resolve({ name }),
  set: () => Promise.resolve(),
});

describe('pickSessionArea', () => {
  it('storage.session 을 고릅니다', () => {
    const session = area('session');
    expect(pickSessionArea({ session, local: area('local') })).toBe(session);
  });

  it('session 이 없으면 local 로 물러서지 않고 복원을 포기합니다', () => {
    // 불변 원칙 §4-1: `storage.local` 은 디스크에 남습니다. 전사 본문 500건을 그리로
    // 옮겨 적느니 "패널을 닫았다 열면 백지" 를 받아들입니다.
    expect(pickSessionArea({ local: area('local') })).toBe(null);
    expect(pickSessionArea({})).toBe(null);
    expect(pickSessionArea(undefined)).toBe(null);
  });
});
