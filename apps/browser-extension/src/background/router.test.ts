import { beforeEach, describe, expect, it } from 'vitest';

import type { SessionEvent, TranscriptSegment } from '@classmate/contracts';
import type { AskRequest } from '../panel/ports';
import type { LiveInboundMessage } from '../live/messages';
import { LIVE_EVENT, LIVE_SEGMENT, PANEL_ASK, PANEL_EVENT, PANEL_RECONNECT } from '../live/messages';
import { EventIdFactory } from './ids';
import type { HostSendResult } from './host-client';
import type { HostEnvelope } from './host-messages';
import { PeriodLog } from './period-log';
import type { ConnectorControls, PanelPortLike } from './router';
import { Router, captureStateToConnector, clampUtf8, toPartialSegment } from './router';
import type { ClassmateSettings } from './settings';

const PERIOD = '2026-09-02-p3';
/** 시험이 시계에 흔들리지 않게 **로컬** 날짜 조각으로 만듭니다(`makePeriodId` 가 로컬을 봅니다). */
const NOW = new Date(2026, 8, 2, 10, 32, 18);

function segment(seq: number, state: TranscriptSegment['state'] = 'final'): TranscriptSegment {
  return {
    id: `ts-p3-${String(seq).padStart(3, '0')}`,
    periodId: PERIOD,
    seq,
    text: `${seq}번째 문장입니다`,
    state,
    arrivedAt: '2026-09-02T10:31:40+09:00',
    source: 'tiro-share',
  };
}

/** 패널이 낸 사건 하나입니다. id 는 고정 계약의 패널 모양(`…-x…`)을 씁니다. */
function panelEvent(type: SessionEvent['type'], payload: Record<string, unknown> = {}): SessionEvent {
  return { id: `ev-${PERIOD}-xdeadbeef-1`, periodId: PERIOD, at: '2026-09-02T10:32:00+09:00', type, payload };
}

function askRequest(overrides: Partial<AskRequest> = {}): AskRequest {
  return {
    questionId: 'q-p3-001',
    provider: 'claude',
    kind: 'missed',
    question: 'new 가 무슨 뜻인가요',
    snapshot: {
      transcriptSegmentIds: ['ts-p3-001'],
      ages: { transcriptSec: 4, screenSec: 2, editorSec: 1 },
    },
    ...overrides,
  };
}

class FakePanel implements PanelPortLike {
  readonly received: LiveInboundMessage[] = [];
  postMessage(message: LiveInboundMessage): void {
    this.received.push(message);
  }
  /** 받은 사건의 `type` 만입니다. */
  eventTypes(): string[] {
    return this.received
      .filter((message): message is Extract<LiveInboundMessage, { type: typeof LIVE_EVENT }> =>
        message.type === LIVE_EVENT,
      )
      .map((message) => message.event.type);
  }
}

interface Harness {
  router: Router;
  /** 호스트로 나간 봉투 전부입니다. */
  sent: HostEnvelope[];
  /** 호스트로 나간 `event.append` 안의 사건들입니다. */
  appended(): SessionEvent[];
  panel: FakePanel;
  controls: { tiro: number; capture: number };
  reconnects: number;
  warnings: string[];
  log: PeriodLog;
  /** 다음 `send` 한 번의 답을 정해 둡니다. */
  replyOnce(result: HostSendResult): void;
}

function makeHarness(settings: Partial<ClassmateSettings> = {}): Harness {
  const sent: HostEnvelope[] = [];
  const warnings: string[] = [];
  const controls = { tiro: 0, capture: 0 };
  const queuedReplies: HostSendResult[] = [];
  const panel = new FakePanel();
  const log = new PeriodLog();
  let reconnects = 0;

  const connectorControls: ConnectorControls = {
    restartTiro: () => {
      controls.tiro += 1;
    },
    restartCapture: () => {
      controls.capture += 1;
    },
  };

  const router = new Router({
    host: {
      send: (envelope) => {
        sent.push(envelope);
        const next = queuedReplies.shift();
        return Promise.resolve(next ?? { status: 'queued' });
      },
      reconnectNow: () => {
        reconnects += 1;
      },
    },
    settings: {
      read: () =>
        Promise.resolve({
          periodNumber: 3,
          subject: 'IoC 컨테이너와 의존성 주입',
          provider: 'claude',
          ...settings,
        }),
    },
    controls: connectorControls,
    log,
    ids: new EventIdFactory('1a2b3c4d'),
    now: () => NOW,
    warn: (message) => warnings.push(message),
  });

  return {
    router,
    sent,
    appended: () =>
      sent
        .filter((envelope): envelope is Extract<HostEnvelope, { type: 'event.append' }> =>
          envelope.type === 'event.append',
        )
        .map((envelope) => envelope.event),
    panel,
    controls,
    get reconnects() {
      return reconnects;
    },
    warnings,
    log,
    replyOnce: (result) => queuedReplies.push(result),
  };
}

// ── 순수 함수 ─────────────────────────────────────────────────────────────

describe('clampUtf8', () => {
  it('상한 안이면 그대로 둡니다', () => {
    expect(clampUtf8('안녕하세요', 4096)).toBe('안녕하세요');
  });

  it('글자 한가운데를 자르지 않습니다', () => {
    // '가' 는 UTF-8 로 3바이트입니다. 4바이트 상한이면 한 글자만 남아야 합니다.
    const clamped = clampUtf8('가나다', 4);
    expect(clamped).toBe('가');
    expect(new TextEncoder().encode(clamped).length).toBeLessThanOrEqual(4);
  });
});

describe('captureStateToConnector', () => {
  it.each([
    ['capturing', 'connected', undefined],
    ['starting', 'paused', 'starting'],
    ['error', 'off', 'capture-error'],
    ['stopped', 'off', 'stopped'],
    ['idle', 'off', 'idle'],
  ] as const)('%s → %s', (state, expected, reason) => {
    expect(captureStateToConnector(state)).toEqual(
      reason === undefined ? { state: expected } : { state: expected, reason },
    );
  });
});

describe('toPartialSegment', () => {
  it('문단 자리로 식별자를 고정해 같은 문단이 갱신되게 합니다', () => {
    const first = toPartialSegment(
      { periodId: PERIOD, index: 4, text: '아직', arrivedAt: '2026-09-02T10:32:10+09:00' },
      PERIOD,
    );
    const second = toPartialSegment(
      { periodId: PERIOD, index: 4, text: '아직 쓰이는 중', arrivedAt: '2026-09-02T10:32:11+09:00' },
      PERIOD,
    );
    expect(first.id).toBe(second.id);
    expect(second.state).toBe('partial');
    expect(second.seq).toBe(5);
  });
});

// ── 표 주도: 들어온 말 → 나가는 것 ────────────────────────────────────────

describe('Router · 들어온 말 → 나가는 것', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    harness.sent.length = 0;
    harness.panel.received.length = 0;
  });

  it('tiro.segment → 호스트 transcript.segment + 패널 사건·세그먼트', async () => {
    const handled = await harness.router.handleRuntimeMessage({
      type: 'tiro.segment',
      segment: segment(1),
    });

    expect(handled).toBe(true);

    const appended = harness.appended();
    const transcript = appended.find((event) => event.type === 'transcript.segment');
    expect(transcript).toBeDefined();
    expect(transcript?.periodId).toBe(PERIOD);
    expect(transcript?.id).toBe(`ev-${PERIOD}-s1a2b3c4d-3`);
    expect(transcript?.at).toBe('2026-09-02T10:32:18+09:00');
    // 고정 계약 (라): payload 에 segment **전체**가 실립니다.
    expect(transcript?.payload).toEqual({
      segmentId: 'ts-p3-001',
      seq: 1,
      state: 'final',
      segment: segment(1),
    });

    expect(harness.panel.received[0]).toEqual({ type: LIVE_SEGMENT, segment: segment(1) });
    expect(harness.panel.eventTypes()).toEqual(['transcript.segment', 'connector.status']);
  });

  it('tiro.partial → 패널만 (호스트로 가지 않습니다)', async () => {
    await harness.router.handleRuntimeMessage({
      type: 'tiro.partial',
      partial: { periodId: PERIOD, index: 0, text: '지금 들리는 말', arrivedAt: '2026-09-02T10:32:15+09:00' },
    });

    expect(harness.sent).toEqual([]);
    expect(harness.panel.received).toHaveLength(1);
    expect(harness.panel.received[0]).toMatchObject({
      type: LIVE_SEGMENT,
      segment: { state: 'partial', text: '지금 들리는 말' },
    });
  });

  it('tiro.partial 은 교시 로그에 쌓이지 않습니다 (확정되면 다시 옵니다)', async () => {
    const before = harness.log.size;
    await harness.router.handleRuntimeMessage({
      type: 'tiro.partial',
      partial: { periodId: PERIOD, index: 0, text: '중간', arrivedAt: '2026-09-02T10:32:15+09:00' },
    });
    expect(harness.log.size).toBe(before);
  });

  it('tiro.hint_degraded → connector.status {tiro-share, paused}', async () => {
    await harness.router.handleRuntimeMessage({
      type: 'tiro.hint_degraded',
      signal: { at: '2026-09-02T10:32:15+09:00', stateSource: 'structure', previousStateSource: 'class', degraded: true },
    });

    const status = harness.appended().find((event) => event.type === 'connector.status');
    expect(status?.payload).toEqual({ connector: 'tiro-share', state: 'paused', reason: 'hint-structure' });
  });

  it('힌트가 돌아오면 connector.status {tiro-share, connected} 로 회복합니다', async () => {
    await harness.router.handleRuntimeMessage({
      type: 'tiro.hint_degraded',
      signal: { at: '2026-09-02T10:32:15+09:00', stateSource: 'structure', previousStateSource: 'class', degraded: true },
    });
    await harness.router.handleRuntimeMessage({
      type: 'tiro.hint_degraded',
      signal: { at: '2026-09-02T10:32:20+09:00', stateSource: 'class', previousStateSource: 'structure', degraded: false },
    });

    const states = harness
      .appended()
      .filter((event) => event.type === 'connector.status')
      .map((event) => event.payload['state']);
    expect(states).toEqual(['paused', 'connected']);
  });

  it('tiro.selector_broken → connector.status {tiro-share, paused, selector-broken}', async () => {
    await harness.router.handleRuntimeMessage({
      type: 'tiro.selector_broken',
      signal: { at: '2026-09-02T10:32:15+09:00', emptyForMs: 8000, lastMatchedSelector: null },
    });

    const status = harness.appended().find((event) => event.type === 'connector.status');
    expect(status?.payload).toEqual({ connector: 'tiro-share', state: 'paused', reason: 'selector-broken' });
  });

  it('capture.stats → connector.status {meet-tab, …} 를 바뀔 때만 냅니다', async () => {
    const stats = {
      type: 'capture.stats',
      state: 'capturing',
      stats: {},
      loop: {},
      frames: 1,
      totalBytes: 10,
      droppedFrames: 0,
    };
    await harness.router.handleRuntimeMessage(stats);
    await harness.router.handleRuntimeMessage(stats);
    await harness.router.handleRuntimeMessage(stats);

    const statuses = harness.appended().filter((event) => event.type === 'connector.status');
    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.payload).toEqual({ connector: 'meet-tab', state: 'connected' });
  });

  it('capture.error → connector.status {meet-tab, off, 이유}', async () => {
    await harness.router.handleRuntimeMessage({ type: 'capture.error', reason: 'tab-closed' });

    const status = harness.appended().find((event) => event.type === 'connector.status');
    expect(status?.payload).toEqual({ connector: 'meet-tab', state: 'off', reason: 'tab-closed' });
  });

  it('공유 페이지를 새로고침해 같은 문단이 다시 와도 두 번 기록하지 않습니다', async () => {
    // Gate D 「공유 페이지 새로고침 (중복 문단 제거)」 의 확장 쪽 근거가 되는 시험입니다.
    // 새로고침하면 커넥터가 새로 태어나 seq 가 1부터 다시 세므로 같은 id·같은 본문이 옵니다.
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(2) });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(2) });

    const transcripts = harness.appended().filter((event) => event.type === 'transcript.segment');
    expect(transcripts.map((event) => event.payload['segmentId'])).toEqual(['ts-p3-001', 'ts-p3-002']);
  });

  it('같은 문단이 partial 에서 final 로 확정되면 그것은 새 사실이라 남깁니다', async () => {
    const partial = { ...segment(1), state: 'partial' as const };
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: partial });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });

    const states = harness
      .appended()
      .filter((event) => event.type === 'transcript.segment')
      .map((event) => event.payload['state']);
    expect(states).toEqual(['partial', 'final']);
  });

  it('캡처가 끊겨도 전사 기록은 이어집니다', async () => {
    // Gate D 「캡처 중단(탭 닫힘)」 의 확장 쪽 근거가 되는 시험입니다.
    await harness.router.handleRuntimeMessage({ type: 'capture.error', reason: 'tab-closed' });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });
    await harness.router.handlePanelMessage({
      type: PANEL_ASK,
      request: askRequest({ questionId: 'q-after-capture-loss' }),
    });

    const types = harness.appended().map((event) => event.type);
    expect(types).toContain('transcript.segment');
    // 화면 커넥터만 꺼짐이고 나머지는 그대로 돕니다.
    const meet = harness
      .appended()
      .filter((event) => event.type === 'connector.status')
      .map((event) => event.payload)
      .find((payload) => payload['connector'] === 'meet-tab');
    expect(meet).toMatchObject({ state: 'off', reason: 'tab-closed' });
    expect(harness.sent.some((envelope) => envelope.type === 'tutor.ask')).toBe(true);
  });

  it('모르는 말은 맡지 않습니다 (배선 쪽이 이어서 봅니다)', async () => {
    expect(await harness.router.handleRuntimeMessage({ type: 'capture.frame' })).toBe(false);
    expect(await harness.router.handleRuntimeMessage({ type: 'capture.start' })).toBe(false);
    expect(await harness.router.handleRuntimeMessage(null)).toBe(false);
    expect(harness.sent).toEqual([]);
  });
});

// ── 패널이 보내는 말 ──────────────────────────────────────────────────────

describe('Router · 패널이 보내는 말', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    harness.sent.length = 0;
    harness.panel.received.length = 0;
  });

  it('panel.event 의 question.asked 는 붙이지 않습니다 (호스트가 기록본을 만듭니다)', async () => {
    const handled = await harness.router.handlePanelMessage({
      type: PANEL_EVENT,
      event: panelEvent('question.asked', { questionId: 'q-1', kind: 'missed' }),
    });

    expect(handled).toBe(true);
    expect(harness.sent).toEqual([]);
  });

  it('panel.event 의 그 밖(state.changed)은 그대로 붙입니다', async () => {
    await harness.router.handlePanelMessage({
      type: PANEL_EVENT,
      event: panelEvent('state.changed', { from: 'CAPTURE', to: 'ANSWER_MINIMAL' }),
    });

    const appended = harness.appended();
    expect(appended).toHaveLength(1);
    expect(appended[0]?.type).toBe('state.changed');
    // 패널이 낸 사건이므로 id 는 패널 것을 그대로 씁니다.
    expect(appended[0]?.id).toBe(`ev-${PERIOD}-xdeadbeef-1`);
  });

  it('패널이 낸 사건을 그 패널에 되돌려 보내지 않습니다', async () => {
    await harness.router.handlePanelMessage({
      type: PANEL_EVENT,
      event: panelEvent('state.changed', { from: 'CAPTURE', to: 'ANSWER_MINIMAL' }),
    });
    expect(harness.panel.received).toEqual([]);
  });

  it('panel.ask → tutor.ask 봉투 (계약 (마) 의 칸 그대로)', async () => {
    harness.replyOnce({
      status: 'replied',
      message: { type: 'tutor.accepted', periodId: PERIOD, questionId: 'q-p3-001' },
    });

    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    const ask = harness.sent.find((envelope) => envelope.type === 'tutor.ask');
    expect(ask).toEqual({
      type: 'tutor.ask',
      periodId: PERIOD,
      questionId: 'q-p3-001',
      kind: 'missed',
      question: 'new 가 무슨 뜻인가요',
      provider: 'claude',
      snapshot: {
        transcriptSegmentIds: ['ts-p3-001'],
        ages: { transcriptSec: 4, screenSec: 2, editorSec: 1 },
      },
    });
  });

  it('낱말만 붙잡았으면 word 를 싣고, 봉인이 없으면 빈 스냅숏을 만듭니다', async () => {
    await harness.router.handlePanelMessage({
      type: PANEL_ASK,
      request: askRequest({ word: 'new', question: '', snapshot: null }),
    });

    const ask = harness.sent.find((envelope) => envelope.type === 'tutor.ask');
    expect(ask).toMatchObject({
      word: 'new',
      snapshot: { transcriptSegmentIds: [], ages: { transcriptSec: null, screenSec: null, editorSec: null } },
    });
    expect(ask).not.toHaveProperty('question');
  });

  it('호스트가 not-implemented 로 답하면 connector.status {provider, off} 를 냅니다', async () => {
    harness.replyOnce({
      status: 'replied',
      message: { type: 'error', message: 'tutor is not wired yet', reason: 'not-implemented', received: 'tutor.ask' },
    });

    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    const status = harness.appended().find((event) => event.type === 'connector.status');
    expect(status?.payload).toEqual({ connector: 'provider', state: 'off', reason: 'not-implemented' });
  });

  it('provider-unavailable 도 off 입니다', async () => {
    harness.replyOnce({
      status: 'replied',
      message: { type: 'error', message: 'no provider', reason: 'provider-unavailable', received: 'tutor.ask' },
    });
    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    const status = harness.appended().find((event) => event.type === 'connector.status');
    expect(status?.payload).toMatchObject({ state: 'off', reason: 'provider-unavailable' });
  });

  it('그 밖의 거절(question-too-long)은 paused 입니다 — 제공자가 사라진 것은 아닙니다', async () => {
    harness.replyOnce({
      status: 'replied',
      message: { type: 'error', message: 'too long', reason: 'question-too-long', received: 'tutor.ask' },
    });
    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    const status = harness.appended().find((event) => event.type === 'connector.status');
    expect(status?.payload).toMatchObject({ connector: 'provider', state: 'paused', reason: 'question-too-long' });
  });

  it('4096바이트를 넘는 질문은 앞부분만 보내고 한 줄 남깁니다', async () => {
    await harness.router.handlePanelMessage({
      type: PANEL_ASK,
      request: askRequest({ question: '가'.repeat(2000) }),
    });

    const ask = harness.sent.find((envelope) => envelope.type === 'tutor.ask');
    const question = (ask as { question?: string }).question ?? '';
    expect(new TextEncoder().encode(question).length).toBeLessThanOrEqual(4096);
    expect(harness.warnings.some((line) => line.includes('4096'))).toBe(true);
  });
});

// ── 다시 연결 ─────────────────────────────────────────────────────────────

describe('Router · classmate.reconnect', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    harness.sent.length = 0;
  });

  it('native-host → 호스트에 즉시 재연결을 시킵니다', async () => {
    await harness.router.handlePanelMessage({ type: PANEL_RECONNECT, connector: 'native-host' });
    expect(harness.reconnects).toBe(1);
  });

  it('tiro-share → content script 를 다시 세웁니다', async () => {
    await harness.router.handlePanelMessage({ type: PANEL_RECONNECT, connector: 'tiro-share' });
    expect(harness.controls.tiro).toBe(1);
  });

  it('meet-tab → 캡처를 다시 켭니다', async () => {
    await harness.router.handlePanelMessage({ type: PANEL_RECONNECT, connector: 'meet-tab' });
    expect(harness.controls.capture).toBe(1);
  });

  it('provider → 마지막 미완 질문으로 tutor.retry 를 보냅니다', async () => {
    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest({ questionId: 'q-9' }) });
    harness.sent.length = 0;

    await harness.router.handlePanelMessage({ type: PANEL_RECONNECT, connector: 'provider' });

    expect(harness.sent.find((envelope) => envelope.type === 'tutor.retry')).toEqual({
      type: 'tutor.retry',
      periodId: PERIOD,
      questionId: 'q-9',
    });
  });

  it('답이 이미 온 질문은 다시 묻지 않습니다', async () => {
    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest({ questionId: 'q-9' }) });
    await harness.router.handleHostPush({
      type: 'tutor.event',
      periodId: PERIOD,
      event: panelEvent('answer.completed', { questionId: 'q-9', answerId: 'an-9' }),
    });
    harness.sent.length = 0;

    await harness.router.handlePanelMessage({ type: PANEL_RECONNECT, connector: 'provider' });

    expect(harness.sent.filter((envelope) => envelope.type === 'tutor.retry')).toEqual([]);
    expect(harness.warnings.some((line) => line.includes('다시 물어볼 질문이 없어요'))).toBe(true);
  });
});

// ── 호스트가 미는 사건 ────────────────────────────────────────────────────

describe('Router · 호스트 push', () => {
  it('tutor.event 는 패널로만 갑니다 (호스트로 되돌려 붙이지 않습니다)', async () => {
    const harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    harness.sent.length = 0;
    harness.panel.received.length = 0;

    await harness.router.handleHostPush({
      type: 'tutor.event',
      periodId: PERIOD,
      event: panelEvent('answer.completed', { questionId: 'q-1', answerId: 'an-1' }),
    });

    expect(harness.sent).toEqual([]);
    expect(harness.panel.eventTypes()).toEqual(['answer.completed']);
  });

  it('도우미 연결 상태를 connector.status {native-host, …} 로 알립니다', async () => {
    const harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    harness.sent.length = 0;

    await harness.router.handleHostStatus('connected');
    await harness.router.handleHostStatus('off', 'disconnected');

    const payloads = harness
      .appended()
      .filter((event) => event.type === 'connector.status')
      .map((event) => event.payload);
    expect(payloads).toEqual([
      { connector: 'native-host', state: 'connected' },
      { connector: 'native-host', state: 'off', reason: 'disconnected' },
    ]);
  });
});

// ── 교시와 패널 재열기 ────────────────────────────────────────────────────

describe('Router · 교시', () => {
  it('패널이 처음 붙으면 period.started 를 만들고 panel.opened 를 붙입니다', async () => {
    const harness = makeHarness();
    await harness.router.openPanel(harness.panel);

    const appended = harness.appended();
    expect(appended.map((event) => event.type)).toEqual(['period.started', 'panel.opened']);
    expect(appended[0]?.payload).toEqual({
      periodId: PERIOD,
      subject: 'IoC 컨테이너와 의존성 주입',
      index: 3,
    });
    expect(harness.router.periodId).toBe(PERIOD);
  });

  it('교시가 이미 있으면 다시 시작하지 않습니다', async () => {
    const harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    await harness.router.openPanel(new FakePanel());

    expect(harness.appended().filter((event) => event.type === 'period.started')).toHaveLength(1);
  });

  it('패널이 닫히면 panel.closed 를 붙이고 서비스 워커는 계속 기록합니다', async () => {
    const harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    await harness.router.closePanel(harness.panel);
    harness.sent.length = 0;

    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });

    expect(harness.router.panelCount).toBe(0);
    expect(harness.appended().some((event) => event.type === 'transcript.segment')).toBe(true);
  });

  it('닫았다 다시 열면 그동안의 기록을 되풀이해 화면이 복원됩니다', async () => {
    // Gate D 「사이드패널 닫기 → 열기」 의 확장 쪽 근거가 되는 시험입니다.
    const harness = makeHarness();
    const first = new FakePanel();
    await harness.router.openPanel(first);
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(2) });
    await harness.router.closePanel(first);

    const second = new FakePanel();
    await harness.router.openPanel(second);

    const segments = second.received
      .filter((message) => message.type === LIVE_SEGMENT)
      .map((message) => (message.type === LIVE_SEGMENT ? message.segment.id : ''));
    expect(segments).toEqual(['ts-p3-001', 'ts-p3-002']);
    // 본문까지 그대로 돌아옵니다.
    const restored = second.received.find((message) => message.type === LIVE_SEGMENT);
    expect(restored?.type === LIVE_SEGMENT ? restored.segment.text : '').toBe('1번째 문장입니다');
    // 앞 교시의 period.started 도 함께 돌아와야 화면이 교시를 압니다.
    expect(second.eventTypes()).toContain('period.started');
  });

  it('되풀이한 뒤에 panel.opened 가 옵니다 (순서가 반대이면 다음 열기에서 두 번 보입니다)', async () => {
    const harness = makeHarness();
    const first = new FakePanel();
    await harness.router.openPanel(first);
    await harness.router.closePanel(first);

    const second = new FakePanel();
    await harness.router.openPanel(second);

    const types = second.eventTypes();
    expect(types[types.length - 1]).toBe('panel.opened');
  });

  it('교시 번호가 바뀌면 period.ended 를 내고 새 교시를 시작합니다', async () => {
    let periodNumber = 3;
    const sent: HostEnvelope[] = [];
    const router = new Router({
      host: { send: (envelope) => { sent.push(envelope); return Promise.resolve({ status: 'queued' }); }, reconnectNow: () => {} },
      settings: { read: () => Promise.resolve({ periodNumber, subject: '수업', provider: 'claude' }) },
      controls: { restartTiro: () => {}, restartCapture: () => {} },
      log: new PeriodLog(),
      ids: new EventIdFactory('1a2b3c4d'),
      now: () => NOW,
      warn: () => {},
    });

    const panel = new FakePanel();
    await router.openPanel(panel);
    await router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });

    periodNumber = 4;
    await router.ensurePeriod();

    const types = sent
      .filter((envelope): envelope is Extract<HostEnvelope, { type: 'event.append' }> => envelope.type === 'event.append')
      .map((envelope) => envelope.event.type);
    expect(types).toContain('period.ended');
    expect(types.indexOf('period.ended')).toBeLessThan(types.lastIndexOf('period.started'));
    expect(router.periodId).toBe('2026-09-02-p4');
  });

  it('period.ended 는 이번 교시의 질문 수와 화면 장 수를 셉니다', async () => {
    const harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest({ questionId: 'q-1' }) });
    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest({ questionId: 'q-2' }) });
    // 같은 질문을 호스트가 되밀어도 두 번 세지 않습니다.
    await harness.router.handleHostPush({
      type: 'tutor.event',
      periodId: PERIOD,
      event: panelEvent('question.asked', { questionId: 'q-1', kind: 'missed' }),
    });
    harness.router.noteFrameStored();
    harness.router.noteFrameStored();
    harness.router.noteFrameStored();

    await harness.router.endPeriod();

    const ended = harness.appended().find((event) => event.type === 'period.ended');
    expect(ended?.payload).toEqual({ periodId: PERIOD, questionCount: 2, frameCount: 3 });
  });

  it('교시가 이미 끝났으면 endPeriod 가 아무 일도 하지 않습니다', async () => {
    const harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    await harness.router.endPeriod();
    harness.sent.length = 0;
    await harness.router.endPeriod();
    expect(harness.sent).toEqual([]);
  });
});
