import activitySetExample from '@classmate/contracts/schemas/examples/activity-set-v2.1.json';
import { describe, expect, it } from 'vitest';

import { createSessionHistoryClient, sessionHistoryErrorText } from './client';
import type { ActivitySetV2 } from './types';

const ACTIVITY_SET = activitySetExample as unknown as ActivitySetV2;
const CHANGED_ACTIVITY_SET = ACTIVITY_SET.map((activity, index) =>
  index === 0 ? { ...activity, prompt: '다른 저장 요청입니다.' } : activity,
) as unknown as ActivitySetV2;

const SUMMARY = {
  sessionId: '2026-09-04-p1',
  profile: 'class',
  eventCount: 12,
  transcriptCount: 5,
  questionCount: 2,
  answerCount: 1,
  frameCount: 1,
} as const;

describe('과거 세션 패널 클라이언트', () => {
  it('목록·요약·번들의 요청 이름을 구분하고 값을 돌려줍니다', async () => {
    const sent: unknown[] = [];
    const client = createSessionHistoryClient({
      async sendMessage(message) {
        sent.push(message);
        const type = (message as { type?: string }).type;
        if (type === 'classmate.session.list') {
          return { type: 'classmate.session.listed', sessions: [SUMMARY] };
        }
        if (type === 'classmate.session.summary') {
          return { type: 'classmate.session.summarized', summary: SUMMARY };
        }
        if (type === 'classmate.activity.save') {
          return {
            type: 'classmate.activity.saved',
            sessionId: SUMMARY.sessionId,
            activitySet: ACTIVITY_SET,
          };
        }
        return {
          type: 'classmate.session.bundled',
          bundle: {
            schemaVersion: '2',
            sessionId: SUMMARY.sessionId,
            profile: 'class',
            startedAt: '2026-09-04T09:00:00+09:00',
            sources: [],
            moments: [],
            activities: [],
            artifacts: [],
          },
        };
      },
    });

    expect(await client.list()).toMatchObject({ status: 'ok', value: [{ sessionId: SUMMARY.sessionId }] });
    expect(await client.getSummary(SUMMARY.sessionId)).toMatchObject({
      status: 'ok',
      value: { sessionId: SUMMARY.sessionId },
    });
    expect(await client.getBundle(SUMMARY.sessionId)).toMatchObject({
      status: 'ok',
      value: { schemaVersion: '2', sessionId: SUMMARY.sessionId },
    });
    expect(await client.saveActivities(SUMMARY.sessionId, ACTIVITY_SET)).toEqual({
      status: 'ok',
      value: ACTIVITY_SET,
    });
    expect(sent).toEqual([
      { type: 'classmate.session.list' },
      { type: 'classmate.session.summary', sessionId: SUMMARY.sessionId },
      { type: 'classmate.session.bundle', sessionId: SUMMARY.sessionId },
      { type: 'classmate.activity.save', sessionId: SUMMARY.sessionId, activitySet: ACTIVITY_SET },
    ]);
  });

  it('다른 세션의 상세와 모양이 깨진 응답을 받지 않습니다', async () => {
    const client = createSessionHistoryClient({
      sendMessage: async () => ({ type: 'classmate.session.summarized', summary: { ...SUMMARY, sessionId: 'other' } }),
    });
    expect(await client.getSummary(SUMMARY.sessionId)).toEqual({
      status: 'error',
      reason: 'invalid-response',
    });
  });

  it('런타임 연결 실패를 로컬 도우미 안내로 바꿉니다', async () => {
    const client = createSessionHistoryClient({
      sendMessage: async () => Promise.reject(new Error('C:\\private\\internal path')),
    });
    const result = await client.list();
    expect(result).toEqual({ status: 'error', reason: 'host-unavailable' });
    expect(sessionHistoryErrorText('host-unavailable')).not.toContain('C:\\');
  });

  it('안전하지 않은 세션 id는 서비스 워커에 보내기 전에 막습니다', async () => {
    const sent: unknown[] = [];
    const client = createSessionHistoryClient({
      sendMessage: async (message) => {
        sent.push(message);
        return undefined;
      },
    });

    expect(await client.getSummary('../private')).toEqual({ status: 'error', reason: 'invalid-session-id' });
    expect(await client.getBundle('C:\\private')).toEqual({ status: 'error', reason: 'invalid-session-id' });
    expect(await client.saveActivities('../private', ACTIVITY_SET)).toEqual({
      status: 'error',
      reason: 'invalid-session-id',
    });
    expect(sent).toEqual([]);
  });

  it('정본 다섯 카드가 아니면 서비스 워커에 보내기 전에 막습니다', async () => {
    const sent: unknown[] = [];
    const client = createSessionHistoryClient({
      sendMessage: async (message) => {
        sent.push(message);
        return undefined;
      },
    });

    expect(
      await client.saveActivities(
        SUMMARY.sessionId,
        ACTIVITY_SET.slice(0, 4) as unknown as ActivitySetV2,
      ),
    ).toEqual({ status: 'error', reason: 'malformed-activity-set' });
    expect(sent).toEqual([]);
  });

  it('다른 요청에 대한 오류 응답을 현재 요청의 오류로 오인하지 않습니다', async () => {
    const client = createSessionHistoryClient({
      sendMessage: async () => ({
        type: 'classmate.session.error',
        requestType: 'classmate.session.bundle',
        reason: 'session-not-found',
      }),
    });

    expect(await client.getSummary(SUMMARY.sessionId)).toEqual({ status: 'error', reason: 'invalid-response' });
  });

  it('활동 저장은 같은 요청의 고정 오류만 받고 다른 타입·세션 ACK를 거절합니다', async () => {
    const replies = [
      {
        type: 'classmate.session.error',
        requestType: 'classmate.activity.save',
        reason: 'unknown-activity-evidence',
      },
      { type: 'classmate.session.listed', sessions: [] },
      { type: 'classmate.activity.saved', sessionId: 'other-session', activitySet: ACTIVITY_SET },
      {
        type: 'classmate.activity.saved',
        sessionId: SUMMARY.sessionId,
        activitySet: CHANGED_ACTIVITY_SET,
      },
    ];
    const client = createSessionHistoryClient({
      sendMessage: async () => replies.shift(),
    });

    expect(await client.saveActivities(SUMMARY.sessionId, ACTIVITY_SET)).toEqual({
      status: 'error',
      reason: 'unknown-activity-evidence',
    });
    expect(await client.saveActivities(SUMMARY.sessionId, ACTIVITY_SET)).toEqual({
      status: 'error',
      reason: 'invalid-response',
    });
    expect(await client.saveActivities(SUMMARY.sessionId, ACTIVITY_SET)).toEqual({
      status: 'error',
      reason: 'invalid-response',
    });
    expect(await client.saveActivities(SUMMARY.sessionId, ACTIVITY_SET)).toEqual({
      status: 'error',
      reason: 'invalid-response',
    });
  });

  it('활동 저장 런타임 실패의 원문은 host-unavailable 한 단어로만 바꿉니다', async () => {
    const client = createSessionHistoryClient({
      sendMessage: async () => Promise.reject(new Error('C:\\private\\classmate.sqlite?token=secret')),
    });

    expect(await client.saveActivities(SUMMARY.sessionId, ACTIVITY_SET)).toEqual({
      status: 'error',
      reason: 'host-unavailable',
    });
    expect(sessionHistoryErrorText('unknown-activity-evidence')).not.toContain('C:\\');
  });
});
