import { describe, expect, it } from 'vitest';

import type { HostSendResult } from './host-client';
import type { HostEnvelope } from './host-messages';
import { handleSessionHistoryRequest } from './session-history';

const SUMMARY = {
  sessionId: '2026-09-04-p1',
  legacyPeriodId: '2026-09-04-p1',
  profile: 'class',
  title: '스프링 AOP',
  startedAt: '2026-09-04T09:00:00+09:00',
  lastAt: '2026-09-04T09:50:00+09:00',
  eventCount: 20,
  transcriptCount: 8,
  questionCount: 2,
  answerCount: 2,
  frameCount: 1,
} as const;

function gateway(result: HostSendResult): { sent: HostEnvelope[]; host: { send(envelope: HostEnvelope): Promise<HostSendResult> } } {
  const sent: HostEnvelope[] = [];
  return {
    sent,
    host: {
      send: (envelope) => {
        sent.push(envelope);
        return Promise.resolve(result);
      },
    },
  };
}

describe('과거 세션 서비스 워커 다리', () => {
  it('목록 요청을 호스트 봉투로 바꾸고 검증된 요약만 돌려줍니다', async () => {
    const rig = gateway({
      status: 'replied',
      message: { type: 'session.listed', sessions: [SUMMARY] },
    });

    const reply = await handleSessionHistoryRequest({ type: 'classmate.session.list' }, rig.host);
    expect(rig.sent).toEqual([{ type: 'session.list' }]);
    expect(reply).toEqual({ type: 'classmate.session.listed', sessions: [SUMMARY] });
  });

  it('요약과 번들은 선택한 세션 id를 그대로 전달합니다', async () => {
    const summaryRig = gateway({ status: 'replied', message: { type: 'session.summary', summary: SUMMARY } });
    expect(
      await handleSessionHistoryRequest(
        { type: 'classmate.session.summary', sessionId: SUMMARY.sessionId },
        summaryRig.host,
      ),
    ).toMatchObject({ type: 'classmate.session.summarized', summary: { sessionId: SUMMARY.sessionId } });
    expect(summaryRig.sent).toEqual([{ type: 'session.getSummary', sessionId: SUMMARY.sessionId }]);

    const bundle = {
      schemaVersion: '2' as const,
      sessionId: SUMMARY.sessionId,
      profile: 'class' as const,
      startedAt: SUMMARY.startedAt,
      sources: [],
      moments: [],
      activities: [],
      artifacts: [],
    };
    const bundleRig = gateway({ status: 'replied', message: { type: 'session.bundled', bundle } });
    expect(
      await handleSessionHistoryRequest(
        { type: 'classmate.session.bundle', sessionId: SUMMARY.sessionId },
        bundleRig.host,
      ),
    ).toEqual({ type: 'classmate.session.bundled', bundle });
    expect(bundleRig.sent).toEqual([{ type: 'session.bundle', sessionId: SUMMARY.sessionId }]);
  });

  it('호스트가 꺼져 있으면 수업 자료나 내부 오류를 섞지 않고 고정 까닭만 돌려줍니다', async () => {
    const rig = gateway({ status: 'dropped', reason: 'host-offline C:\\private\\classmate.sqlite' });
    expect(await handleSessionHistoryRequest({ type: 'classmate.session.list' }, rig.host)).toEqual({
      type: 'classmate.session.error',
      requestType: 'classmate.session.list',
      reason: 'host-unavailable',
    });
  });

  it('요청과 다른 종류의 정상 응답도 화면에 넘기지 않습니다', async () => {
    const rig = gateway({ status: 'replied', message: { type: 'session.summary', summary: SUMMARY } });
    expect(await handleSessionHistoryRequest({ type: 'classmate.session.list' }, rig.host)).toEqual({
      type: 'classmate.session.error',
      requestType: 'classmate.session.list',
      reason: 'invalid-response',
    });
  });
});
