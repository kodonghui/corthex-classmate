import { expect, it } from 'vitest';
import type { SessionEvent } from '@classmate/contracts';
import { Router } from './router';
import { PeriodLog } from './period-log';
import { EventIdFactory } from './ids';
import { normalizeSettings } from './settings';
import { isHostReply, replyMatchesEnvelope } from './host-messages';
import { ReplayStore } from '../panel/replay-store';
import { listeningView } from '../panel/lesson-view';

const id = '2026-09-08-p1788880000000';
const started: SessionEvent = { id: 'ev-study-start', periodId: id, at: '2026-09-08T01:00:00Z', type: 'period.started', payload: { subject: 'old name', profile: 'class', index: 1 } };
it('persists a named identity independently of tomorrow and rejects path-shaped settings', () => {
  expect(normalizeSettings({ 'classmate.activeSessionId': id }).activeSessionId).toBe(id);
  expect(normalizeSettings({ 'classmate.activeSessionId': '../private' }).activeSessionId).toBeUndefined();
});
it('matches only the correct study action in the host FIFO', () => {
  const reply = { type: 'study.result' as const, action: 'read', data: {} };
  expect(isHostReply(reply)).toBe(true);
  expect(replyMatchesEnvelope({ type: 'study.manage', action: 'read' }, reply)).toBe(true);
  expect(replyMatchesEnvelope({ type: 'study.manage', action: 'export' }, reply)).toBe(false);
});
it('resumes paged saved events without starting a different day or writing them again', async () => {
  const sent: string[] = [];
  const log = new PeriodLog();
  const router = new Router({ log, ids: new EventIdFactory('abc12345'),
    controls: { restartTiro() {}, reselectLessonTab() {} },
    settings: { read: async () => ({ activeSessionId: id, subject: 'wrong', periodNumber: 1, provider: 'claude', profile: 'class' }) },
    now: () => new Date('2026-09-10T01:00:00Z'),
    host: { reconnectNow() {}, send: async e => {
      sent.push(e.type);
      if (e.type !== 'study.manage') return { status: 'queued' };
      return { status: 'replied', message: { type: 'study.result', action: 'read', data: {
        events: e.after === 0 ? [started] : [{ ...started, id:'ev-question', type:'question.asked', payload:{ questionId:'q-kept' } }],
        summary: { title: '04~06_Spring_framework' }, next: e.after === 0 ? 1 : 2, more: e.after === 0,
      } } };
    } },
  });
  expect(await router.ensurePeriod()).toBe(id);
  expect(await router.ensurePeriod()).toBe(id);
  expect(sent).toEqual(['study.manage','study.manage']);
  expect(router.snapshot().questionIds).toEqual(['q-kept']);
  expect(router.snapshot().periodStarted?.payload['subject']).toBe('04~06_Spring_framework');
  expect(log.replay()).toHaveLength(1);
});
it('shows the chosen bundle title without period text', () => {
  const store = ReplayStore.live({ periodId:id, startMs:Date.parse(started.at), subject:'old' });
  store.pushEvent({ ...started, payload:{ ...started.payload, studyBundle:true, subject:'04~06' } });
  expect(listeningView(store.bundle, store.getState(), store.lines(store.getState().now)).header).toMatchObject({ title:'04~06', subtitle:'학습 묶음' });
});
