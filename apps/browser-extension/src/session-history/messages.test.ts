import { describe, expect, it } from 'vitest';

import { isSessionHistoryReply, isSessionHistoryRequest } from './messages';

describe('과거 세션 런타임 메시지 경계', () => {
  it('세 읽기 요청만 받고 세션 경로로 바뀔 수 있는 id는 막습니다', () => {
    expect(isSessionHistoryRequest({ type: 'classmate.session.list' })).toBe(true);
    expect(
      isSessionHistoryRequest({ type: 'classmate.session.summary', sessionId: '2026-09-04-p1' }),
    ).toBe(true);
    expect(
      isSessionHistoryRequest({ type: 'classmate.session.bundle', sessionId: '../private' }),
    ).toBe(false);
    expect(isSessionHistoryRequest({ type: 'session.export', sessionId: '2026-09-04-p1' })).toBe(false);
    expect(isSessionHistoryRequest({ type: 'classmate.session.list', privatePath: 'C:\\private' })).toBe(false);
  });

  it('오류 응답도 정해 둔 요청과 까닭 조합만 받습니다', () => {
    expect(
      isSessionHistoryReply({
        type: 'classmate.session.error',
        requestType: 'classmate.session.bundle',
        reason: 'session-not-found',
      }),
    ).toBe(true);
    expect(
      isSessionHistoryReply({
        type: 'classmate.session.error',
        requestType: 'classmate.session.bundle',
        reason: 'C:\\private\\database.sqlite',
      }),
    ).toBe(false);
    expect(
      isSessionHistoryReply({
        type: 'classmate.session.error',
        requestType: 'classmate.session.bundle',
        reason: 'session-not-found',
        detail: 'C:\\private\\database.sqlite',
      }),
    ).toBe(false);
  });
});
