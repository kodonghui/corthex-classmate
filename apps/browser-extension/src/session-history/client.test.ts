import { describe, expect, it } from 'vitest';

import { createSessionHistoryClient, sessionHistoryErrorText } from './client';

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
    expect(sent).toEqual([
      { type: 'classmate.session.list' },
      { type: 'classmate.session.summary', sessionId: SUMMARY.sessionId },
      { type: 'classmate.session.bundle', sessionId: SUMMARY.sessionId },
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
});
