import activitySetExample from '@classmate/contracts/schemas/examples/activity-set-v2.1.json';
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

  it('활동 저장 요청과 ACK는 안전한 세션 id와 정본 다섯 카드만 받습니다', () => {
    expect(
      isSessionHistoryRequest({
        type: 'classmate.activity.save',
        sessionId: '2026-09-04-p1',
        activitySet: activitySetExample,
      }),
    ).toBe(true);
    expect(
      isSessionHistoryRequest({
        type: 'classmate.activity.save',
        sessionId: '../private',
        activitySet: activitySetExample,
      }),
    ).toBe(false);
    expect(
      isSessionHistoryRequest({
        type: 'classmate.activity.save',
        sessionId: '2026-09-04-p1',
        activitySet: activitySetExample.slice(0, 4),
      }),
    ).toBe(false);

    expect(
      isSessionHistoryReply({
        type: 'classmate.activity.saved',
        sessionId: '2026-09-04-p1',
        activitySet: activitySetExample,
      }),
    ).toBe(true);
    expect(
      isSessionHistoryReply({
        type: 'classmate.activity.saved',
        sessionId: '2026-09-04-p1',
        activitySet: activitySetExample,
        path: 'C:\\private\\classmate.sqlite',
      }),
    ).toBe(false);
  });

  it('활동 오류는 고정 reason만 받고 원시 오류나 경로 필드를 막습니다', () => {
    expect(
      isSessionHistoryReply({
        type: 'classmate.session.error',
        requestType: 'classmate.activity.save',
        reason: 'unknown-activity-evidence',
      }),
    ).toBe(true);
    expect(
      isSessionHistoryReply({
        type: 'classmate.session.error',
        requestType: 'classmate.activity.save',
        reason: 'C:\\private\\classmate.sqlite',
      }),
    ).toBe(false);
    expect(
      isSessionHistoryReply({
        type: 'classmate.session.error',
        requestType: 'classmate.activity.save',
        reason: 'malformed-activity-set',
        detail: 'file:///private/answer.txt',
      }),
    ).toBe(false);
  });
});
