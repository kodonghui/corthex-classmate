import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionEvent, TranscriptSegment } from '@classmate/contracts';
import type { AskRequest } from '../panel/ports';
import type { LiveInboundMessage } from '../live/messages';
import {
  LIVE_DELTA,
  LIVE_EVENT,
  LIVE_SEGMENT,
  PANEL_ASK,
  PANEL_EVENT,
  PANEL_RECONNECT,
} from '../live/messages';
import type { FrameStoreOutcome, FrameStorePort } from '../capture/frame-sink';
import { NativeHostFrameSink } from '../capture/frame-sink';
import { buildSnapshotFrame } from '../capture/snapshot';
import { EventIdFactory } from './ids';
import type { HostSendResult } from './host-client';
import type { HostEnvelope } from './host-messages';
import { PeriodLog } from './period-log';
import type { ConnectorControls, PanelPortLike, ScreenSnapshotSource } from './router';
import { Router, captureStateToConnector, clampUtf8, toPartialSegment } from './router';
import type { ClassmateSettings } from './settings';

const PERIOD = '2026-09-02-p3';
// 절대 시각으로 못 박습니다. 숫자 인자를 받는 `new Date(2026, 8, 2, 10, 32, 18)` 은 그 숫자를
// **돌리는 PC 의 지역시**로 읽습니다. 라우터는 이 값을 `toKstIso` 로 언제나 `+09:00` 으로 적으므로
// (`background/ids.ts`), KST 기계에서만 10:32:18 이 되고 UTC 기계에서는 19:32:18 이 됩니다.
// 2026-09-04 CI 첫 초록 시도에서 실제로 터졌습니다(run 33801564903, 268줄).
// CI 러너는 일부러 UTC 로 둡니다 — 이런 어긋남을 잡아 주는 것이 그 값어치입니다.
const NOW = new Date('2026-09-02T10:32:18+09:00');

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
  /** 서비스 워커 콘솔로 나간 DOM 모양 요약입니다. `[이유, 요약]` 짝입니다. */
  shapeWarnings: [string, string][];
  log: PeriodLog;
  /** 끝난 교시들입니다. `onPeriodEnd` 훅이 여기 담습니다. */
  endedPeriods: string[];
  /** 다음 `send` 한 번의 답을 정해 둡니다. */
  replyOnce(result: HostSendResult): void;
}

interface HarnessOptions {
  /** 교시 로그 통을 밖에서 넣습니다(상한을 작게 두어 밀려남을 시험할 때 씁니다). */
  log?: PeriodLog;
  /** 설정 읽기를 늦춥니다. 겹쳐 부르기를 시험할 때 씁니다. */
  gate?: () => Promise<void>;
  /** 질문에 붙일 화면을 구해 오는 자리입니다. 넣지 않으면 화면 없이 나갑니다. */
  screen?: ScreenSnapshotSource;
  /** 화면을 기다려 주는 상한입니다. 가짜 타이머 시험이 이것을 씁니다. */
  screenTimeoutMs?: number;
}

function makeHarness(settings: Partial<ClassmateSettings> = {}, options: HarnessOptions = {}): Harness {
  const sent: HostEnvelope[] = [];
  const warnings: string[] = [];
  const shapeWarnings: [string, string][] = [];
  const controls = { tiro: 0, capture: 0 };
  const queuedReplies: HostSendResult[] = [];
  const panel = new FakePanel();
  const log = options.log ?? new PeriodLog();
  const endedPeriods: string[] = [];
  let reconnects = 0;

  const connectorControls: ConnectorControls = {
    restartTiro: () => {
      controls.tiro += 1;
    },
    reselectLessonTab: () => {
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
      read: async () => {
        await (options.gate?.() ?? Promise.resolve());
        return {
          profile: 'class',
          periodNumber: 3,
          subject: 'IoC 컨테이너와 의존성 주입',
          provider: 'claude',
          ...settings,
        };
      },
    },
    controls: connectorControls,
    log,
    ids: new EventIdFactory('1a2b3c4d'),
    // `exactOptionalPropertyTypes` 라서 undefined 를 넣는 대신 없으면 칸 자체를 뺍니다.
    ...(options.screen === undefined ? {} : { screen: options.screen }),
    ...(options.screenTimeoutMs === undefined ? {} : { screenTimeoutMs: options.screenTimeoutMs }),
    now: () => NOW,
    warn: (message) => warnings.push(message),
    warnShape: (reason, shape) => shapeWarnings.push([reason, shape]),
    onPeriodEnd: (periodId) => endedPeriods.push(periodId),
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
    shapeWarnings,
    log,
    endedPeriods,
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

  it('서로게이트 쌍 한가운데도 자르지 않습니다 (짝 없는 반쪽은 JSON 을 깨뜨립니다)', () => {
    // 이모지 하나는 UTF-16 두 칸·UTF-8 네 바이트입니다. 7바이트 상한이면 이모지 하나(4)에
    // 세 바이트가 남는데, 짝의 앞 칸(0xD83D)만 남기면 TextEncoder 가 그것을 U+FFFD(3바이트)로
    // 세어 "딱 맞는다" 고 판정합니다. 그렇게 남은 반쪽이 JSON 을 깨뜨립니다.
    const clamped = clampUtf8('😀😀', 7);

    expect(clamped).toBe('😀');
    expect(clamped.length).toBe(2);
    for (let i = 0; i < clamped.length; i += 1) {
      const code = clamped.charCodeAt(i);
      const isLoneHigh = code >= 0xd800 && code <= 0xdbff && i === clamped.length - 1;
      expect(isLoneHigh).toBe(false);
    }
    // 짝 없는 서로게이트가 남으면 여기에 `\ud83d` 가 실려 호스트의 JSON 해석이 깨집니다.
    expect(JSON.stringify(clamped)).not.toMatch(/\\ud[89ab][0-9a-f]{2}/i);
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

  it('멈춤 신호의 DOM 모양 요약은 콘솔에만 남고 계약 payload 에는 안 실립니다', async () => {
    // 실측(2026-09-03 2교시)에서 selector-broken 이 떴는데 그때 페이지가 어떤 모양이었는지
    // 기록이 없어 파서를 못 고쳤습니다. 요약은 남기되 사건 payload 는 그대로 둡니다.
    const shape = '그릇 main · 문단 후보 12개 · 클래스 text-body×12';
    await harness.router.handleRuntimeMessage({
      type: 'tiro.selector_broken',
      signal: { at: '2026-09-02T10:32:15+09:00', emptyForMs: 8000, lastMatchedSelector: null, shape },
    });

    expect(harness.shapeWarnings).toEqual([['selector-broken', shape]]);
    const status = harness.appended().find((event) => event.type === 'connector.status');
    expect(status?.payload).toEqual({ connector: 'tiro-share', state: 'paused', reason: 'selector-broken' });
    expect(JSON.stringify(status?.payload)).not.toContain('문단 후보');
  });

  it('등급이 떨어진 신호도 요약을 남기고, 회복은 남기지 않습니다', async () => {
    const shape = '그릇 main · 문단 후보 7개 · 클래스 whitespace-pre-wrap×7';
    await harness.router.handleRuntimeMessage({
      type: 'tiro.hint_degraded',
      signal: {
        at: '2026-09-02T10:32:10+09:00',
        stateSource: 'structure',
        previousStateSource: 'class',
        degraded: true,
        shape,
      },
    });
    await harness.router.handleRuntimeMessage({
      type: 'tiro.hint_degraded',
      signal: {
        at: '2026-09-02T10:32:20+09:00',
        stateSource: 'class',
        previousStateSource: 'structure',
        degraded: false,
      },
    });

    expect(harness.shapeWarnings).toEqual([['hint-structure', shape]]);
  });

  it('요약이 없는 옛 content script 의 신호는 조용히 넘어갑니다', async () => {
    await harness.router.handleRuntimeMessage({
      type: 'tiro.selector_broken',
      signal: { at: '2026-09-02T10:32:15+09:00', emptyForMs: 8000, lastMatchedSelector: null },
    });

    expect(harness.shapeWarnings).toEqual([]);
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

  it('같은 조각이 다시 와도 자란 때만 붙입니다 (partial → 같은 partial → 더 긴 partial → final → 같은 final)', async () => {
    // 실측(2026-09-03 2교시)에서 조각 ts-058 이 partial · partial · final 로 세 번 붙었습니다.
    // 탭이 숨겨질 때마다 content script 의 flush() 가 진행 중 문단을 partial 로 내보내기
    // 때문입니다. 글자가 자란 것은 새 사실이니 남기고, 똑같은 것은 거릅니다.
    const grow = (text: string, state: TranscriptSegment['state']): TranscriptSegment => ({
      ...segment(58),
      state,
      text,
    });
    const short = '여기서 뭔가를 또 타이핑을';
    const longer = '여기서 뭔가를 또 타이핑을 해 줘야 되는데';

    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: grow(short, 'partial') });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: grow(short, 'partial') });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: grow(longer, 'partial') });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: grow(longer, 'final') });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: grow(longer, 'final') });

    const appended = harness
      .appended()
      .filter((event) => event.type === 'transcript.segment')
      .map((event) => [event.payload['state'], event.payload['segmentId']]);
    expect(appended).toEqual([
      ['partial', 'ts-p3-058'],
      ['partial', 'ts-p3-058'],
      ['final', 'ts-p3-058'],
    ]);
    // 사건 이름표는 매번 새로 짓습니다 — 도우미는 사건 id 로 중복을 거르므로,
    // 같은 이름표를 다시 쓰면 자란 문단이 조용히 버려집니다.
    const ids = harness
      .appended()
      .filter((event) => event.type === 'transcript.segment')
      .map((event) => event.id);
    expect(new Set(ids).size).toBe(3);

    // 패널에도 이 3건이 그대로 갑니다. **여기서 보는 것은 라우터의 출력까지입니다** —
    // 이 3건이 화면에서 한 줄로 합쳐지는지는 패널 스토어의 몫이고, 지금 스토어
    // (`src/panel/replay-store.ts` 의 `pushSegment`)는 이미 아는 id 를 통째로 버려 뒤 2건이
    // 화면에 오르지 못합니다(알려진 결함 · 패널 단위에서 upsert 로 고칩니다). 그러니 이 줄을
    // 「화면에 한 줄로 보인다」의 근거로 읽으면 안 됩니다.
    const toPanel = harness.panel.received.filter((message) => message.type === LIVE_SEGMENT);
    expect(toPanel).toHaveLength(3);
  });

  it('교시가 바뀌면 본 조각 기억을 비웁니다', async () => {
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });
    await harness.router.endPeriod();
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });

    const transcripts = harness.appended().filter((event) => event.type === 'transcript.segment');
    expect(transcripts).toHaveLength(2);
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

  it('봉투가 틀렸다는 거절(envelope-invalid)은 paused 입니다 — 제공자는 살아 있습니다', async () => {
    // 고정 계약에서 `not-implemented` 는 사라졌습니다. 꺼짐으로 보는 이유는
    // `provider-unavailable` 하나뿐입니다.
    harness.replyOnce({
      status: 'replied',
      message: { type: 'error', message: 'bad envelope', reason: 'envelope-invalid', received: 'tutor.ask' },
    });

    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    const status = harness.appended().find((event) => event.type === 'connector.status');
    expect(status?.payload).toEqual({ connector: 'provider', state: 'paused', reason: 'envelope-invalid' });
  });

  it('provider-unavailable 만 off 입니다', async () => {
    harness.replyOnce({
      status: 'replied',
      message: { type: 'error', message: 'no provider', reason: 'provider-unavailable', received: 'tutor.ask' },
    });
    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    const status = harness.appended().find((event) => event.type === 'connector.status');
    expect(status?.payload).toMatchObject({ state: 'off', reason: 'provider-unavailable' });
    const failure = harness.panel.received.find((m) => m.type === LIVE_EVENT && m.event.type === 'answer.failed');
    expect(failure).toMatchObject({ event: { payload: { questionId: 'q-p3-001', reason: 'provider-unavailable' } } });
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

  it('도우미가 꺼져 질문이 버려지면 그때만 question.asked 를 붙입니다', async () => {
    // 온라인일 때는 호스트 기록본이 정본이라 붙이지 않습니다. 꺼져 있을 때 붙이지 않으면
    // 붙잡은 질문이 확장 기록에도 호스트 세션 파일에도 남지 않습니다.
    harness.replyOnce({ status: 'dropped', reason: 'host-offline' });

    await harness.router.handlePanelMessage({
      type: PANEL_ASK,
      request: askRequest({ questionId: 'q-offline' }),
    });

    const asked = harness.appended().find((event) => event.type === 'question.asked');
    expect(asked?.payload).toMatchObject({ questionId: 'q-offline', kind: 'missed', hostOffline: true });
    // 물어본 패널은 자기 사건을 이미 압니다. 되돌려 보내면 스토어가 두 번 받습니다.
    expect(harness.panel.eventTypes()).not.toContain('question.asked');
  });

  it('도우미가 살아 있으면 question.asked 를 붙이지 않습니다', async () => {
    harness.replyOnce({
      status: 'replied',
      message: { type: 'tutor.accepted', periodId: PERIOD, questionId: 'q-p3-001' },
    });

    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    expect(harness.appended().some((event) => event.type === 'question.asked')).toBe(false);
  });

  it('모양이 틀린 panel.ask 는 맡지 않습니다 (질문이 조용히 사라지지 않게)', async () => {
    // `question` 이 문자열이 아니면 라우터의 clampUtf8 뒤 `question.length` 에서 TypeError 가
    // 나고, 서비스 워커에서는 그것이 처리되지 않은 약속 거부로 끝납니다.
    const handled = await harness.router.handlePanelMessage({
      type: PANEL_ASK,
      request: { questionId: 'q-bad', kind: 'missed', provider: 'claude', question: null, snapshot: null },
    });

    expect(handled).toBe(false);
    expect(harness.sent).toEqual([]);
  });

  it('패널이 낸 사건도 교시 로그에 남아 닫았다 열면 돌아옵니다', async () => {
    await harness.router.handlePanelMessage({
      type: PANEL_EVENT,
      event: panelEvent('state.changed', { from: 'CAPTURE', to: 'ANSWER_MINIMAL' }),
    });

    const second = new FakePanel();
    await harness.router.openPanel(second);

    expect(second.eventTypes()).toContain('state.changed');
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

// ── 질문에 붙는 화면 한 장 ────────────────────────────────────────────────
//
// 여기까지 오면 캡처는 이미 끝나 있고, 라우터가 보는 것은 "이름표 하나 또는 null" 뿐입니다.
// 실제로 찍는 일(`captureVisibleTab` · 고른 탭인지 보기)은 `src/capture/snapshot.test.ts` 가
// 따로 시험합니다.

describe('Router · 질문에 붙는 화면 한 장', () => {
  const SCREEN_FRAME_ID = 'sf-p3-ask-103210-001';

  /** 호스트로 나간 `tutor.ask` 봉투입니다. */
  function askEnvelope(harness: Harness): HostEnvelope | undefined {
    return harness.sent.find((envelope) => envelope.type === 'tutor.ask');
  }

  it('찍었으면 snapshot.screenFrameId 가 채워지고 ages.screenSec 가 0 입니다', async () => {
    const askedPeriods: string[] = [];
    const harness = makeHarness(
      {},
      {
        screen: {
          capture: async (periodId) => {
            askedPeriods.push(periodId);
            return SCREEN_FRAME_ID;
          },
        },
      },
    );

    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    // 지금 교시로 찍습니다. 앞 교시 폴더에 들어가면 호스트가 거절합니다.
    expect(askedPeriods).toEqual([PERIOD]);
    expect(askEnvelope(harness)).toMatchObject({
      snapshot: {
        transcriptSegmentIds: ['ts-p3-001'],
        screenFrameId: SCREEN_FRAME_ID,
        // 방금 찍었으니 0 입니다. 전사·편집기 나이는 패널이 준 값 그대로 둡니다.
        ages: { transcriptSec: 4, screenSec: 0, editorSec: 1 },
      },
    });
  });

  it('패널이 봉인을 주지 않아도(빈 스냅숏) 화면은 붙습니다', async () => {
    const harness = makeHarness({}, { screen: { capture: async () => SCREEN_FRAME_ID } });

    await harness.router.handlePanelMessage({
      type: PANEL_ASK,
      request: askRequest({ snapshot: null }),
    });

    expect(askEnvelope(harness)).toMatchObject({
      snapshot: {
        transcriptSegmentIds: [],
        screenFrameId: SCREEN_FRAME_ID,
        ages: { transcriptSec: null, screenSec: 0, editorSec: null },
      },
    });
  });

  it('수업 탭을 못 찍었으면 화면 없이 질문이 나갑니다', async () => {
    const harness = makeHarness({}, { screen: { capture: async () => null } });

    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    const ask = askEnvelope(harness);
    expect(ask).toBeDefined();
    expect(ask).not.toHaveProperty('snapshot.screenFrameId');
    // 패널이 준 나이를 손대지 않습니다. 0 으로 적으면 없는 화면이 방금 것처럼 보입니다.
    expect(ask).toMatchObject({ snapshot: { ages: { screenSec: 2 } } });
  });

  it('화면 출구가 아예 없어도 질문은 그대로 나갑니다', async () => {
    const harness = makeHarness();

    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    expect(askEnvelope(harness)).toBeDefined();
    expect(askEnvelope(harness)).not.toHaveProperty('snapshot.screenFrameId');
  });

  it('찍는 쪽이 던져도 질문은 나갑니다', async () => {
    const harness = makeHarness(
      {},
      {
        screen: {
          capture: () => Promise.reject(new Error('탭이 그 사이에 닫혔어요')),
        },
      },
    );

    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    const ask = askEnvelope(harness);
    expect(ask).toBeDefined();
    expect(ask).not.toHaveProperty('snapshot.screenFrameId');
    expect(harness.warnings.some((message) => message.includes('화면'))).toBe(true);
  });

  it('상한을 넘기면 화면 없이 질문이 나갑니다 (가짜 타이머)', async () => {
    vi.useFakeTimers();
    try {
      const harness = makeHarness(
        {},
        {
          // 영영 끝나지 않는 캡처입니다. 상한이 없으면 질문이 여기서 멈춥니다.
          screen: { capture: () => new Promise<string | null>(() => {}) },
          screenTimeoutMs: 1500,
        },
      );

      const asked = harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

      // 상한 직전에는 아직 질문이 나가지 않았습니다 — 화면을 기다리고 있습니다.
      await vi.advanceTimersByTimeAsync(1499);
      expect(askEnvelope(harness)).toBeUndefined();

      // 상한을 넘기는 순간 화면을 포기하고 질문을 보냅니다.
      await vi.advanceTimersByTimeAsync(1);
      await asked;

      const ask = askEnvelope(harness);
      expect(ask).toBeDefined();
      expect(ask).not.toHaveProperty('snapshot.screenFrameId');
    } finally {
      vi.useRealTimers();
    }
  });

  it('도우미가 안 붙어 있으면 화면 없이 질문이 나갑니다', async () => {
    // 배선(`entrypoints/background.ts`)과 **같은 순서**로 이어 봅니다.
    //   찍은 장 → NativeHostFrameSink.storeAndReport → 담긴 것만 이름표를 냅니다.
    const offlinePort: FrameStorePort = {
      store: (): Promise<FrameStoreOutcome> => Promise.resolve({ kind: 'offline' }),
    };
    const sink = new NativeHostFrameSink(offlinePort, { warn: () => {} });
    const shot = { bytes: new Uint8Array([1, 2, 3, 4]), width: 1280, height: 720 };

    const harness = makeHarness(
      {},
      {
        screen: {
          capture: async (periodId) => {
            const frame = buildSnapshotFrame({
              periodId,
              capturedAt: NOW,
              sequence: 1,
              snapshot: shot,
            });
            return (await sink.storeAndReport(frame, shot.bytes)) ? frame.id : null;
          },
        },
      },
    );

    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    const ask = askEnvelope(harness);
    expect(ask).toBeDefined();
    expect(ask).not.toHaveProperty('snapshot.screenFrameId');
    // 장을 버리지는 않습니다. 도우미가 돌아오면 그때 파일로 들어갑니다.
    expect(sink.stats().waiting).toBe(1);
  });

  it('도우미가 담아 주면 그 장의 이름표가 그대로 붙습니다', async () => {
    const storedPort: FrameStorePort = {
      store: (): Promise<FrameStoreOutcome> =>
        Promise.resolve({ kind: 'stored', bytes: 4, seq: 12 }),
    };
    const sink = new NativeHostFrameSink(storedPort, { warn: () => {} });
    const shot = { bytes: new Uint8Array([1, 2, 3, 4]), width: 1280, height: 720 };
    let madeId = '';

    const harness = makeHarness(
      {},
      {
        screen: {
          capture: async (periodId) => {
            const frame = buildSnapshotFrame({
              periodId,
              capturedAt: NOW,
              sequence: 1,
              snapshot: shot,
            });
            madeId = frame.id;
            return (await sink.storeAndReport(frame, shot.bytes)) ? frame.id : null;
          },
        },
      },
    );

    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    expect(madeId).toMatch(/^sf-p3-ask-\d{6}-001$/);
    expect(askEnvelope(harness)).toMatchObject({
      snapshot: { screenFrameId: madeId, ages: { screenSec: 0 } },
    });
  });

  it('도우미가 꺼져 있어 질문이 버려져도 붙은 화면이 기록본에 그대로 남습니다', async () => {
    const harness = makeHarness({}, { screen: { capture: async () => SCREEN_FRAME_ID } });
    // 교시를 먼저 엽니다. 그러지 않으면 `period.started` 가 아래 답을 가로챕니다.
    await harness.router.ensurePeriod();
    harness.replyOnce({ status: 'dropped', reason: 'host-offline' });

    await harness.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest() });

    const asked = harness.appended().find((event) => event.type === 'question.asked');
    expect(asked?.payload).toMatchObject({
      hostOffline: true,
      snapshot: { screenFrameId: SCREEN_FRAME_ID, ages: { screenSec: 0 } },
    });
  });
});

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

// ── 질문에 붙일 화면을 못 얻었을 때 ──────────────────────────────────────

describe('Router · 화면 한 장을 못 얻었을 때', () => {
  /** 마지막 `connector.status {meet-tab}` 사건의 payload 입니다. */
  function meetStatus(harness: Harness): Record<string, unknown> | null {
    const events = harness.appended().filter((event) => event.type === 'connector.status');
    const last = events.filter((event) => event.payload['connector'] === 'meet-tab').at(-1);
    return last?.payload ?? null;
  }

  it('고른 수업 탭이 없으면 connector.status {meet-tab, off, no-lesson-tab} 으로 남깁니다', async () => {
    // 2026-09-03 에는 하루 종일 0장이었는데 오류 기록이 0건이었습니다. 이제 까닭이 남습니다.
    const harness = makeHarness();

    await harness.router.noteScreenMissing('no-lesson-tab');

    expect(meetStatus(harness)).toEqual({ connector: 'meet-tab', state: 'off', reason: 'no-lesson-tab' });
  });

  it('다시 될 수 있는 까닭은 호박색(paused)으로 남깁니다', async () => {
    for (const reason of ['not-active', 'no-permission', 'capture-failed', 'too-large', 'host-offline']) {
      const harness = makeHarness();
      await harness.router.noteScreenMissing(reason);
      expect(meetStatus(harness)).toEqual({ connector: 'meet-tab', state: 'paused', reason });
    }
  });

  it('다시 찍히면 초록으로 되돌립니다', async () => {
    const harness = makeHarness();
    await harness.router.noteScreenMissing('no-lesson-tab');

    await harness.router.noteScreenCaptured();

    expect(meetStatus(harness)).toEqual({ connector: 'meet-tab', state: 'connected' });
  });

  it('같은 까닭이 이어지면 사건을 한 번만 냅니다', async () => {
    const harness = makeHarness();

    await harness.router.noteScreenMissing('no-lesson-tab');
    await harness.router.noteScreenMissing('no-lesson-tab');
    await harness.router.noteScreenMissing('no-lesson-tab');

    const meets = harness
      .appended()
      .filter((event) => event.type === 'connector.status' && event.payload['connector'] === 'meet-tab');
    expect(meets).toHaveLength(1);
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

  it('tutor.delta 는 패널로만 가고 교시 로그에도 담기지 않습니다', async () => {
    const harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    harness.sent.length = 0;
    harness.panel.received.length = 0;

    harness.router.handleHostDelta({
      type: 'tutor.delta',
      periodId: PERIOD,
      questionId: 'q-1',
      seq: 0,
      chars: 15,
    });
    harness.router.handleHostDelta({
      type: 'tutor.delta',
      periodId: PERIOD,
      questionId: 'q-1',
      seq: 1,
      chars: 21,
      text: '생성 책임을',
    });

    // 호스트로 되돌아가지 않습니다 — 조각은 SessionEvent 가 아니라 붙일 자리가 없습니다.
    expect(harness.sent).toEqual([]);
    expect(harness.panel.received).toEqual([
      { type: LIVE_DELTA, delta: { questionId: 'q-1', seq: 0, chars: 15 } },
      { type: LIVE_DELTA, delta: { questionId: 'q-1', seq: 1, chars: 21, text: '생성 책임을' } },
    ]);
    // 교시 로그에 담기면 패널을 닫았다 열 때 이미 답이 온 자리에 옛 조각이 되풀이됩니다.
    expect(harness.log.replay().filter((message) => message.type === LIVE_DELTA)).toEqual([]);
  });

  it('앞 교시의 늦은 조각은 새 교시에 섞지 않습니다', async () => {
    const harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    harness.panel.received.length = 0;

    harness.router.handleHostDelta({
      type: 'tutor.delta',
      periodId: '2026-09-02-p2',
      questionId: 'q-old',
      seq: 0,
      chars: 9,
    });

    expect(harness.panel.received).toEqual([]);
  });

  it('앞 교시의 늦은 push 는 새 교시에 섞지 않습니다', async () => {
    const harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    harness.sent.length = 0;
    harness.panel.received.length = 0;

    await harness.router.handleHostPush({
      type: 'tutor.event',
      periodId: '2026-09-02-p2',
      event: { ...panelEvent('answer.completed', { questionId: 'q-old' }), periodId: '2026-09-02-p2' },
    });

    expect(harness.panel.received).toEqual([]);
    expect(harness.warnings.some((line) => line.includes('앞 교시'))).toBe(true);
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
      profile: 'class',
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

  it.each(['class', 'exam', 'meeting'] as const)('%s profile을 새 period.started에 고정합니다', async (profile) => {
    const harness = makeHarness({ profile });
    await harness.router.openPanel(harness.panel);

    const started = harness.appended().find((event) => event.type === 'period.started');
    expect(started?.payload['profile']).toBe(profile);
  });

  it('같은 periodId 동안 설정 profile만 바뀌어도 활성 세션은 바꾸거나 다시 시작하지 않습니다', async () => {
    let profile: ClassmateSettings['profile'] = 'exam';
    const sent: HostEnvelope[] = [];
    const router = new Router({
      host: {
        send: (envelope) => {
          sent.push(envelope);
          return Promise.resolve({ status: 'queued' });
        },
        reconnectNow: () => {},
      },
      settings: {
        read: () => Promise.resolve({ profile, periodNumber: 3, subject: '민법 총칙', provider: 'claude' }),
      },
      controls: { restartTiro: () => {}, reselectLessonTab: () => {} },
      log: new PeriodLog(),
      ids: new EventIdFactory('1a2b3c4d'),
      now: () => NOW,
      warn: () => {},
    });

    await router.openPanel(new FakePanel());
    profile = 'meeting';
    await router.ensurePeriod();

    const started = sent
      .filter((envelope): envelope is Extract<HostEnvelope, { type: 'event.append' }> => envelope.type === 'event.append')
      .filter((envelope) => envelope.event.type === 'period.started');
    expect(started).toHaveLength(1);
    expect(started[0]?.event.payload['profile']).toBe('exam');
    expect(router.snapshot().periodStarted?.payload['profile']).toBe('exam');
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
      settings: { read: () => Promise.resolve({ profile: 'class', periodNumber, subject: '수업', provider: 'claude' }) },
      controls: { restartTiro: () => {}, reselectLessonTab: () => {} },
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

  it('교시가 바뀌는 사이에 겹쳐 불러도 새 교시를 한 번만 시작합니다', async () => {
    // 앞 교시를 끝내는 `period.ended` 를 호스트가 늦게 받는 사이가 빈틈입니다. 잠금이
    // 없으면 그 사이에 들어온 두 번째 부름이 `currentPeriodId === null` 을 보고 새 교시를
    // 먼저 시작하고, 뒤늦게 깨어난 첫 부름이 **또** 시작해 질문·전사·커넥터 기억을 지웁니다.
    let periodNumber = 3;
    const sent: HostEnvelope[] = [];
    const router = new Router({
      host: {
        send: (envelope) => {
          sent.push(envelope);
          const slow =
            envelope.type === 'event.append' && envelope.event.type === 'period.ended';
          if (!slow) return Promise.resolve<HostSendResult>({ status: 'queued' });
          return new Promise<HostSendResult>((resolve) => {
            setTimeout(() => resolve({ status: 'queued' }), 5);
          });
        },
        reconnectNow: () => {},
      },
      settings: { read: () => Promise.resolve({ profile: 'class', periodNumber, subject: '수업', provider: 'claude' }) },
      controls: { restartTiro: () => {}, reselectLessonTab: () => {} },
      log: new PeriodLog(),
      ids: new EventIdFactory('1a2b3c4d'),
      now: () => NOW,
      warn: () => {},
    });

    await router.openPanel(new FakePanel());
    periodNumber = 4;

    // 패널 연결과 tiro.segment 가 겹치는 자리입니다.
    await Promise.all([router.ensurePeriod(), router.ensurePeriod()]);

    const startedP4 = sent.filter(
      (envelope) =>
        envelope.type === 'event.append' &&
        envelope.event.type === 'period.started' &&
        envelope.event.payload['index'] === 4,
    );
    expect(startedP4).toHaveLength(1);
    expect(router.periodId).toBe('2026-09-02-p4');
  });

  it('교시가 끝나면 onPeriodEnd 로 알립니다 (앞 교시 프레임을 버리는 자리)', async () => {
    const harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    await harness.router.endPeriod();

    expect(harness.endedPeriods).toEqual([PERIOD]);
  });

  it('교시 로그가 밀려 period.started 가 빠져도 새 패널에 다시 보냅니다', async () => {
    // 프레임은 1초에 한 장이라 500건 상한을 8분이면 채웁니다. 그러면 period.started 가
    // 맨 앞에서 밀려나 되풀이에 없고, 화면이 과목명·교시 번호를 기본값으로 그립니다.
    const harness = makeHarness({}, { log: new PeriodLog(2) });
    const first = new FakePanel();
    await harness.router.openPanel(first);
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(2) });
    await harness.router.closePanel(first);

    // 로그에는 period.started 가 남아 있지 않습니다.
    const replayed = harness.log
      .replay()
      .filter((message): message is Extract<LiveInboundMessage, { type: typeof LIVE_EVENT }> =>
        message.type === LIVE_EVENT,
      )
      .map((message) => message.event.type);
    expect(replayed).not.toContain('period.started');

    const second = new FakePanel();
    await harness.router.openPanel(second);

    expect(second.eventTypes()[0]).toBe('period.started');
  });

  it('워커가 다시 떠도 되살린 교시에 period.started 를 또 붙이지 않습니다', async () => {
    // 앞 세대 워커가 남긴 상태입니다.
    const before = makeHarness();
    await before.router.openPanel(before.panel);
    await before.router.handlePanelMessage({ type: PANEL_ASK, request: askRequest({ questionId: 'q-1' }) });
    before.router.noteFrameStored();
    before.router.noteFrameStored();
    const saved = JSON.parse(JSON.stringify(before.router.snapshot())) as unknown;

    // 30초를 놀아 내려갔다 tiro.segment 로 다시 뜬 워커입니다.
    const after = makeHarness();
    expect(after.router.restore(saved)).toBe(true);
    await after.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });

    expect(after.appended().filter((event) => event.type === 'period.started')).toEqual([]);
    expect(after.router.periodId).toBe(PERIOD);

    // 교시 끝의 셈도 앞 세대 몫을 이어 갑니다.
    after.router.noteFrameStored();
    await after.router.endPeriod();
    const ended = after.appended().find((event) => event.type === 'period.ended');
    expect(ended?.payload).toEqual({ periodId: PERIOD, questionCount: 1, frameCount: 3 });
  });

  it('되살린 워커에 패널이 붙으면 period.started 를 화면에 다시 보냅니다', async () => {
    const before = makeHarness();
    await before.router.openPanel(before.panel);
    const saved = JSON.parse(JSON.stringify(before.router.snapshot())) as unknown;

    const after = makeHarness();
    after.router.restore(saved);
    const panel = new FakePanel();
    await after.router.openPanel(panel);

    const started = panel.received.find(
      (message): message is Extract<LiveInboundMessage, { type: typeof LIVE_EVENT }> =>
        message.type === LIVE_EVENT && message.event.type === 'period.started',
    );
    expect(started?.event.payload).toMatchObject({ periodId: PERIOD, index: 3 });
  });

  it('상한 값은 되살리지 않습니다 (모양이 상하면 그냥 false)', () => {
    const harness = makeHarness();
    expect(harness.router.restore(null)).toBe(false);
    expect(harness.router.restore({ periodId: 7 })).toBe(false);
    expect(harness.router.periodId).toBe(null);
  });
});

// ── 기록이 도우미에 안 붙었을 때 ──────────────────────────────────────────

describe('Router · event.append 의 결말', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = makeHarness();
    await harness.router.openPanel(harness.panel);
    harness.sent.length = 0;
    harness.panel.received.length = 0;
    harness.warnings.length = 0;
  });

  /** 나간 `connector.status` 중 `native-host` 축의 payload 만입니다. */
  function nativeHostStatuses(): Record<string, unknown>[] {
    return harness
      .appended()
      .filter((event) => event.type === 'connector.status')
      .map((event) => event.payload)
      .filter((payload) => payload['connector'] === 'native-host');
  }

  it('호스트가 error 로 거절하면 connector.status {native-host, paused, 이유} 가 나갑니다', async () => {
    harness.replyOnce({
      status: 'replied',
      message: { type: 'error', message: 'bad envelope', reason: 'envelope-invalid', received: 'event.append' },
    });

    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });

    expect(nativeHostStatuses()).toEqual([
      { connector: 'native-host', state: 'paused', reason: 'envelope-invalid' },
    ]);
  });

  it('거절은 콘솔에도 한 줄 남깁니다 — 자유 문장(message)은 싣지 않습니다', async () => {
    harness.replyOnce({
      status: 'replied',
      message: {
        type: 'error',
        message: 'C:\Users\someone\세션.jsonl 을 열 수 없습니다',
        reason: 'session-write-failed',
        received: 'event.append',
      },
    });

    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });

    const line = harness.warnings.find((message) => message.includes('session-write-failed'));
    expect(line).toBeDefined();
    expect(line).toContain('transcript.segment');
    expect(line).not.toContain('C:\Users');
  });

  it('event.ack 로 붙으면 호박색을 도로 풉니다', async () => {
    harness.replyOnce({
      status: 'replied',
      message: { type: 'error', message: 'bad', reason: 'envelope-invalid', received: 'event.append' },
    });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });

    harness.replyOnce({
      status: 'replied',
      message: { type: 'event.ack', periodId: PERIOD, seq: 2, id: 'ev-ack-2' },
    });
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(2) });

    expect(nativeHostStatuses()).toEqual([
      { connector: 'native-host', state: 'paused', reason: 'envelope-invalid' },
      { connector: 'native-host', state: 'connected' },
    ]);
  });

  it('duplicate: true 는 성공입니다 — 다시 보낸 줄이 커넥터를 내리지 않습니다', async () => {
    harness.replyOnce({
      status: 'replied',
      message: { type: 'event.ack', periodId: PERIOD, seq: 1, id: 'ev-dup-1', duplicate: true },
    });

    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });

    expect(nativeHostStatuses()).toEqual([{ connector: 'native-host', state: 'connected' }]);
    expect(harness.warnings).toEqual([]);
  });

  it('queued 는 건드리지 않습니다 — 꺼짐은 handleHostStatus 의 자리입니다', async () => {
    // 가짜 호스트의 기본 답이 queued 입니다.
    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });

    expect(nativeHostStatuses()).toEqual([]);
    expect(harness.warnings).toEqual([]);
  });

  it('커넥터 알림 자체가 거절돼도 되풀이하지 않습니다 (한 겹)', async () => {
    // 첫 거절 → connector.status 를 냅니다. 그 알림도 다른 까닭으로 거절당하지만
    // 여기서 또 알리면 스스로를 부르는 고리가 됩니다.
    harness.replyOnce({
      status: 'replied',
      message: { type: 'error', message: 'bad', reason: 'envelope-invalid', received: 'event.append' },
    });
    harness.replyOnce({
      status: 'replied',
      message: { type: 'error', message: 'bad', reason: 'session-write-failed', received: 'event.append' },
    });

    await harness.router.handleRuntimeMessage({ type: 'tiro.segment', segment: segment(1) });

    expect(nativeHostStatuses()).toEqual([
      { connector: 'native-host', state: 'paused', reason: 'envelope-invalid' },
    ]);
    // 안쪽 거절도 콘솔에는 남습니다 — 사라지지는 않습니다.
    expect(harness.warnings.filter((line) => line.includes('안 붙었어요'))).toHaveLength(2);
  });

  it('교시를 닫는 중의 거절은 교시를 다시 열지 않습니다', async () => {
    harness.replyOnce({
      status: 'replied',
      message: { type: 'error', message: 'bad', reason: 'session-write-failed', received: 'event.append' },
    });

    await harness.router.endPeriod();

    expect(harness.router.periodId).toBe(null);
    expect(harness.appended().filter((event) => event.type === 'period.started')).toEqual([]);
    expect(nativeHostStatuses()).toEqual([]);
    // 알리지 못해도 콘솔 한 줄은 남습니다.
    expect(harness.warnings.some((line) => line.includes('session-write-failed'))).toBe(true);
  });
});
