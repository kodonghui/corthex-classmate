import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivitySetV2, SessionEvent } from '@classmate/contracts';
import activitySetExample from '@classmate/contracts/schemas/examples/activity-set-v2.1.json';
import type { NativePortLike } from './host-client';
import { NativeHostClient, backoffDelayMs } from './host-client';
import type { EventAppendEnvelope } from './host-messages';
import { isHostReply, isTutorDeltaPush } from './host-messages';

const PERIOD = '2026-09-02-p3';
const ACTIVITY_SET = activitySetExample as unknown as ActivitySetV2;

/**
 * 가짜 Native Messaging 포트입니다.
 *
 * `chrome.runtime.connectNative` 가 주는 포트의 네 가지 얼굴(postMessage · disconnect ·
 * onMessage · onDisconnect)만 흉내 냅니다. 시험은 `reply()` 로 호스트인 척 답하고
 * `die()` 로 호스트가 죽은 척합니다.
 */
class FakePort implements NativePortLike {
  readonly sent: unknown[] = [];
  disconnected = false;
  private messageListeners: ((message: unknown) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];

  postMessage(message: unknown): void {
    this.sent.push(message);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  onMessage = {
    addListener: (callback: (message: unknown) => void) => {
      this.messageListeners.push(callback);
    },
  };

  onDisconnect = {
    addListener: (callback: () => void) => {
      this.disconnectListeners.push(callback);
    },
  };

  /** 호스트가 답한 척합니다. */
  reply(message: unknown): void {
    for (const listener of [...this.messageListeners]) listener(message);
  }

  /** 호스트가 죽은 척합니다. */
  die(): void {
    this.disconnected = true;
    for (const listener of [...this.disconnectListeners]) listener();
  }

  /** 우리가 보낸 봉투들의 `type` 만입니다. */
  get types(): string[] {
    return this.sent.map((message) => (message as { type?: string }).type ?? '?');
  }
}

function appendEnvelope(id: string): EventAppendEnvelope {
  const event: SessionEvent = {
    id,
    periodId: PERIOD,
    at: '2026-09-02T10:31:40+09:00',
    type: 'transcript.segment',
    payload: { segmentId: 'ts-p3-001', seq: 1, state: 'final' },
  };
  return { type: 'event.append', periodId: PERIOD, event };
}

interface Harness {
  client: NativeHostClient;
  ports: FakePort[];
  statuses: { state: string; reason: string | undefined }[];
  pushes: unknown[];
  /** 답이 만들어지는 동안 흐르는 조각들입니다. */
  deltas: unknown[];
  warnings: string[];
  /** 마지막으로 만들어진 포트입니다. */
  port(): FakePort;
  /** 붙고 `hello` 까지 받아 "연결됨" 으로 만듭니다. */
  handshake(): void;
}

function makeHarness(options: { maxQueued?: number; requestTimeoutMs?: number } = {}): Harness {
  const ports: FakePort[] = [];
  const statuses: { state: string; reason: string | undefined }[] = [];
  const pushes: unknown[] = [];
  const deltas: unknown[] = [];
  const warnings: string[] = [];

  const client = new NativeHostClient({
    connect: () => {
      const port = new FakePort();
      ports.push(port);
      return port;
    },
    ...(options.maxQueued === undefined ? {} : { maxQueued: options.maxQueued }),
    ...(options.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: options.requestTimeoutMs }),
    onStatus: (state, reason) => statuses.push({ state, reason }),
    onPush: (push) => pushes.push(push),
    onDelta: (delta) => deltas.push(delta),
    warn: (message) => warnings.push(message),
  });

  const harness: Harness = {
    client,
    ports,
    statuses,
    pushes,
    deltas,
    warnings,
    port: () => {
      const last = ports[ports.length - 1];
      if (last === undefined) throw new Error('포트가 아직 없습니다');
      return last;
    },
    handshake: () => {
      harness.port().reply({ type: 'hello', host: 'classmate-host', version: '0.1.0', protocol: 1 });
    },
  };
  return harness;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('backoffDelayMs', () => {
  it('1·2·4·8·16·30·30…초로 늘다가 30초에서 멈춥니다', () => {
    const delays = [0, 1, 2, 3, 4, 5, 6, 7].map((attempt) => backoffDelayMs(attempt));
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16_000, 30_000, 30_000, 30_000]);
  });

  it('아주 큰 회차에서도 상한을 지킵니다 (지수가 넘치지 않습니다)', () => {
    expect(backoffDelayMs(1000)).toBe(30_000);
  });
});

describe('NativeHostClient · 왕복', () => {
  it('붙으면 ping 을 먼저 보내고, hello 를 받아야 연결됨입니다', () => {
    const harness = makeHarness();
    harness.client.start();

    expect(harness.port().types).toEqual(['ping']);
    expect(harness.client.connected).toBe(false);
    expect(harness.statuses).toEqual([]);

    harness.handshake();

    expect(harness.client.connected).toBe(true);
    expect(harness.statuses).toEqual([{ state: 'connected', reason: undefined }]);
  });

  it('답을 보낸 순서대로 짝지웁니다 (호스트가 한 줄로 일하므로 FIFO)', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const first = harness.client.send(appendEnvelope('ev-1'));
    const second = harness.client.send(appendEnvelope('ev-2'));

    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 1, id: 'ev-1' });
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 2, id: 'ev-2' });

    const firstResult = await first;
    const secondResult = await second;
    expect(firstResult).toMatchObject({ status: 'replied', message: { id: 'ev-1' } });
    expect(secondResult).toMatchObject({ status: 'replied', message: { id: 'ev-2' } });
  });

  it('과거 세션 목록 응답도 기다리던 읽기 요청과 짝지웁니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const sending = harness.client.send({ type: 'session.list' });
    harness.port().reply({
      type: 'session.listed',
      sessions: [
        {
          sessionId: PERIOD,
          legacyPeriodId: PERIOD,
          profile: 'class',
          eventCount: 12,
          transcriptCount: 5,
          questionCount: 2,
          answerCount: 1,
          frameCount: 1,
        },
      ],
    });

    expect(await sending).toMatchObject({
      status: 'replied',
      message: { type: 'session.listed', sessions: [{ sessionId: PERIOD }] },
    });
  });

  it('활동 ACK의 reply type·sessionId가 다르면 FIFO를 소비하지 않습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const sending = harness.client.send({
      type: 'activity.save',
      sessionId: PERIOD,
      activitySet: ACTIVITY_SET,
    });
    harness.port().reply({ type: 'session.listed', sessions: [] });
    harness.port().reply({
      type: 'activity.saved',
      sessionId: 'other-session',
      activitySet: ACTIVITY_SET,
    });
    harness.port().reply({
      type: 'activity.saved',
      sessionId: PERIOD,
      activitySet: ACTIVITY_SET.map((activity, index) =>
        index === 0 ? { ...activity, prompt: '다른 저장 요청입니다.' } : activity,
      ),
    });
    expect(harness.client.stats().waiting).toBe(1);

    harness.port().reply({
      type: 'activity.saved',
      sessionId: PERIOD,
      activitySet: ACTIVITY_SET,
    });

    expect(await sending).toMatchObject({
      status: 'replied',
      message: { type: 'activity.saved', sessionId: PERIOD },
    });
    expect(harness.warnings.filter((line) => line.includes('기다리던 부탁과 다른 답'))).toHaveLength(3);
  });

  it('다른 부탁의 오류도 활동 저장 FIFO를 소비하지 않습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const sending = harness.client.send({
      type: 'activity.save',
      sessionId: PERIOD,
      activitySet: ACTIVITY_SET,
    });
    harness.port().reply({
      type: 'error',
      message: 'session read failed',
      reason: 'session-not-found',
      received: 'session.bundle',
    });
    harness.port().reply({
      type: 'activity.saved',
      sessionId: PERIOD,
      activitySet: ACTIVITY_SET,
    });

    expect(await sending).toMatchObject({ status: 'replied', message: { type: 'activity.saved' } });
    expect(harness.warnings.some((line) => line.includes('기다리던 부탁과 다른 답'))).toBe(true);
  });

  it('모양은 정상이어도 맨 앞 부탁과 다른 답은 FIFO를 소비하지 않습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const history = harness.client.send({ type: 'session.list' });
    const live = harness.client.send(appendEnvelope('ev-live'));
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 1, id: 'ev-too-early' });
    harness.port().reply({ type: 'session.listed', sessions: [] });
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 2, id: 'ev-live' });

    expect(await history).toMatchObject({ status: 'replied', message: { type: 'session.listed' } });
    expect(await live).toMatchObject({ status: 'replied', message: { type: 'event.ack', id: 'ev-live' } });
    expect(harness.warnings.some((line) => line.includes('기다리던 부탁과 다른 답'))).toBe(true);
  });

  it('같은 답 종류라도 다른 사건 id면 라이브 FIFO를 소비하지 않습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const live = harness.client.send(appendEnvelope('ev-live'));
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 1, id: 'ev-other' });
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 2, id: 'ev-live' });

    expect(await live).toMatchObject({ status: 'replied', message: { id: 'ev-live' } });
    expect(harness.warnings.some((line) => line.includes('기다리던 부탁과 다른 답'))).toBe(true);
  });

  it('절대 자산 경로가 든 번들 응답은 대기열을 소비하지 않습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const sending = harness.client.send({ type: 'session.bundle', sessionId: PERIOD });
    harness.port().reply({
      type: 'session.bundled',
      bundle: {
        schemaVersion: '2',
        sessionId: PERIOD,
        profile: 'class',
        startedAt: '2026-09-02T10:00:00+09:00',
        sources: [],
        moments: [],
        activities: [],
        artifacts: [
          { id: 'asset-1', kind: 'image', mediaType: 'image/jpeg', path: 'C:\\private\\frame.jpg' },
        ],
      },
    });
    harness.port().reply({
      type: 'session.bundled',
      bundle: {
        schemaVersion: '2',
        sessionId: PERIOD,
        profile: 'class',
        startedAt: '2026-09-02T10:00:00+09:00',
        sources: [],
        moments: [],
        activities: [],
        artifacts: [
          { id: 'asset-1', kind: 'image', mediaType: 'image/jpeg', path: 'frames/frame.jpg' },
        ],
      },
    });

    expect(harness.warnings.some((line) => line.includes('모양이 다른 말'))).toBe(true);
    expect(await sending).toMatchObject({ status: 'replied', message: { type: 'session.bundled' } });
  });

  it('같은 사건을 다시 보내면 오는 duplicate:true 를 성공으로 봅니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const sending = harness.client.send(appendEnvelope('ev-1'));
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 1, id: 'ev-1', duplicate: true });

    const result = await sending;
    expect(result.status).toBe('replied');
    if (result.status === 'replied') {
      expect(result.message).toMatchObject({ type: 'event.ack', duplicate: true });
    }
  });

  it('tutor.event 는 자발 push 라 대기열을 쓰지 않습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const sending = harness.client.send(appendEnvelope('ev-1'));

    // 답이 오기 **전에** push 가 끼어들어도 짝이 어긋나지 않아야 합니다.
    harness.port().reply({
      type: 'tutor.event',
      periodId: PERIOD,
      event: { id: 'ev-host-1', periodId: PERIOD, at: '2026-09-02T10:33:00+09:00', type: 'answer.completed', payload: {} },
    });
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 9, id: 'ev-1' });

    expect(harness.pushes).toHaveLength(1);
    expect(await sending).toMatchObject({ status: 'replied', message: { seq: 9 } });
    expect(harness.warnings.filter((line) => line.includes('부탁하지 않은 답'))).toEqual([]);
  });

  it('tutor.delta 는 조각 구독자에게 가고 대기열을 건드리지 않습니다', async () => {
    // 2026-09-03 전에는 이 봉투가 `isHostReply` 의 여섯 갈래에 없어 조각마다 "모양이 다른
    // 말" 경고를 찍고 버려졌습니다. 그동안 화면은 21~25초 내내 비어 있었습니다.
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const sending = harness.client.send(appendEnvelope('ev-1'));

    harness.port().reply({ type: 'tutor.delta', periodId: PERIOD, questionId: 'q-1', seq: 0, chars: 15 });
    harness.port().reply({
      type: 'tutor.delta',
      periodId: PERIOD,
      questionId: 'q-1',
      seq: 1,
      chars: 21,
      text: '생성 책임을',
    });
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 4, id: 'ev-1' });

    expect(harness.deltas).toHaveLength(2);
    expect(harness.deltas[1]).toMatchObject({ questionId: 'q-1', seq: 1, text: '생성 책임을' });
    // 조각은 사건이 아니므로 `onPush` 로 가지 않습니다.
    expect(harness.pushes).toEqual([]);
    // 짝이 어긋나지 않습니다.
    expect(await sending).toMatchObject({ status: 'replied', message: { id: 'ev-1', seq: 4 } });
    // 한 회차에 수십 건이 오므로 경고를 찍지 않습니다.
    expect(harness.warnings.some((line) => line.includes('모양이 다른 말'))).toBe(false);
  });

  it('isHostReply 는 여전히 tutor.delta 를 답으로 먹지 않습니다', () => {
    const delta = { type: 'tutor.delta', periodId: PERIOD, questionId: 'q-1', seq: 0, chars: 15 };

    // 먹으면 그 뒤의 모든 event.ack·tutor.accepted·error 가 한 칸씩 밀립니다.
    expect(isHostReply(delta)).toBe(false);
    expect(isTutorDeltaPush(delta)).toBe(true);
  });

  it('조각의 seq·chars 가 숫자가 아니면 조각으로도 답으로도 보지 않습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const sending = harness.client.send(appendEnvelope('ev-1'));

    harness.port().reply({ type: 'tutor.delta', periodId: PERIOD, questionId: 'q-1', seq: '0', chars: 15 });
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 5, id: 'ev-1' });

    expect(harness.deltas).toEqual([]);
    expect(await sending).toMatchObject({ status: 'replied', message: { id: 'ev-1', seq: 5 } });
    expect(harness.warnings.some((line) => line.includes('모양이 다른 말'))).toBe(true);
  });

  it('모양이 다른 말은 대기열을 건드리지 않고 버립니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const sending = harness.client.send(appendEnvelope('ev-1'));

    // `tutor.event` 인데 `event` 가 문자열입니다. push 로도 답으로도 볼 수 없는 말입니다.
    // 이것이 답으로 소비되면 이 뒤의 모든 짝이 한 칸씩 밀려 영구히 어긋납니다.
    harness.port().reply({ type: 'tutor.event', periodId: PERIOD, event: '답이 아닙니다' });
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 7, id: 'ev-1' });

    expect(harness.pushes).toEqual([]);
    expect(await sending).toMatchObject({ status: 'replied', message: { id: 'ev-1', seq: 7 } });
    expect(harness.warnings.some((line) => line.includes('모양이 다른 말'))).toBe(true);
  });

  it('답이 오지 않으면 포트를 새로 열고 재전송 가능한 부탁의 순서를 보존합니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();
    const oldPort = harness.port();

    const stalled = harness.client.send(appendEnvelope('ev-1'));
    // 둘째 부탁은 10초 뒤에 보냅니다. 그래야 첫째만 45초를 채워 포기합니다.
    await vi.advanceTimersByTimeAsync(10_000);
    const next = harness.client.send(appendEnvelope('ev-2'));

    await vi.advanceTimersByTimeAsync(35_000);
    expect(await stalled).toEqual({ status: 'dropped', reason: 'timeout' });
    expect(await next).toEqual({ status: 'queued' });

    // 옛 포트의 늦은 답은 격리되고, 새 포트에는 두 라이브 기록이 원래 순서로 재전송됩니다.
    oldPort.reply({ type: 'event.ack', periodId: PERIOD, seq: 1, id: 'ev-1' });
    await vi.advanceTimersByTimeAsync(1000);
    harness.handshake();
    const resent = harness.port().sent.slice(1) as { event?: { id?: string } }[];
    expect(resent.map((message) => message.event?.id)).toEqual(['ev-1', 'ev-2']);
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 1, id: 'ev-1' });
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 2, id: 'ev-2' });
    expect(harness.client.stats().waiting).toBe(0);
  });

  it('과거 세션 답이 영영 오지 않아도 새 연결에서 라이브 기록을 계속합니다', async () => {
    const harness = makeHarness({ requestTimeoutMs: 100 });
    harness.client.start();
    harness.handshake();

    const history = harness.client.send({ type: 'session.bundle', sessionId: PERIOD });
    await vi.advanceTimersByTimeAsync(100);

    expect(await history).toEqual({ status: 'dropped', reason: 'timeout' });
    expect(harness.client.connected).toBe(false);
    expect(harness.client.stats().waiting).toBe(0);

    await vi.advanceTimersByTimeAsync(1000);
    harness.handshake();
    const live = harness.client.send(appendEnvelope('ev-after-history-timeout'));
    harness.port().reply({
      type: 'event.ack',
      periodId: PERIOD,
      seq: 1,
      id: 'ev-after-history-timeout',
    });

    expect(await live).toMatchObject({
      status: 'replied',
      message: { type: 'event.ack', id: 'ev-after-history-timeout' },
    });
    expect(harness.client.stats().waiting).toBe(0);
  });

  it('활동 저장 ACK가 시간 안에 안 오면 다시 보내지 않고 timeout으로 끝냅니다', async () => {
    const harness = makeHarness({ requestTimeoutMs: 100 });
    harness.client.start();
    harness.handshake();

    const saving = harness.client.send({
      type: 'activity.save',
      sessionId: PERIOD,
      activitySet: ACTIVITY_SET,
    });
    await vi.advanceTimersByTimeAsync(100);

    expect(await saving).toEqual({ status: 'dropped', reason: 'timeout' });
    expect(harness.client.stats()).toMatchObject({ waiting: 0, queued: 0, connected: false });
  });
});

describe('NativeHostClient · 끊김과 재연결', () => {
  it('끊기면 1·2·4…초 백오프로 다시 붙습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.port().die();

    expect(harness.ports).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(harness.ports).toHaveLength(1); // 아직 1초가 안 됐습니다

    await vi.advanceTimersByTimeAsync(1);
    expect(harness.ports).toHaveLength(2); // 1초

    harness.port().die();
    await vi.advanceTimersByTimeAsync(1999);
    expect(harness.ports).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.ports).toHaveLength(3); // 2초

    harness.port().die();
    await vi.advanceTimersByTimeAsync(4000);
    expect(harness.ports).toHaveLength(4); // 4초
  });

  it('도우미가 없는 PC 에서 로그를 도배하지 않습니다 (첫 끊김에만 한 줄)', async () => {
    const harness = makeHarness();
    harness.client.start();

    for (let i = 0; i < 10; i += 1) {
      harness.port().die();
      await vi.advanceTimersByTimeAsync(30_000);
    }

    expect(harness.warnings.filter((line) => line.includes('끊겼어요'))).toHaveLength(1);
  });

  it('붙은 적이 없으면 "꺼짐" 을 알리지 않습니다 (초록↔회색 깜빡임 방지)', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.port().die();
    await vi.advanceTimersByTimeAsync(1000);

    expect(harness.statuses).toEqual([]);
  });

  it('연결됐다가 끊기면 off 를, 다시 붙으면 connected 를 알립니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();
    harness.port().die();

    await vi.advanceTimersByTimeAsync(1000);
    harness.handshake();

    expect(harness.statuses).toEqual([
      { state: 'connected', reason: undefined },
      { state: 'off', reason: 'disconnected' },
      { state: 'connected', reason: undefined },
    ]);
  });

  it('꺼진 동안의 event.append 를 들고 있다가 돌아오면 순서대로 다시 보냅니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.port().die();

    expect(await harness.client.send(appendEnvelope('ev-1'))).toEqual({ status: 'queued' });
    expect(await harness.client.send(appendEnvelope('ev-2'))).toEqual({ status: 'queued' });
    expect(harness.client.stats().queued).toBe(2);

    await vi.advanceTimersByTimeAsync(1000);
    harness.handshake();

    const resent = harness.port().sent.slice(1) as { event?: { id?: string } }[];
    expect(resent.map((message) => message.event?.id)).toEqual(['ev-1', 'ev-2']);
    expect(harness.client.stats().queued).toBe(0);
  });

  it('보내는 중에 끊기면 그 부탁도 다시 보낼 것으로 되돌립니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const sending = harness.client.send(appendEnvelope('ev-1'));
    harness.port().die();

    expect(await sending).toEqual({ status: 'queued' });
    expect(harness.client.stats().queued).toBe(1);
  });

  it('상한을 넘으면 오래된 것부터 버리고 한 줄 남깁니다', async () => {
    const harness = makeHarness({ maxQueued: 2 });
    harness.client.start();
    harness.port().die();

    await harness.client.send(appendEnvelope('ev-1'));
    await harness.client.send(appendEnvelope('ev-2'));
    await harness.client.send(appendEnvelope('ev-3'));

    expect(harness.client.stats()).toMatchObject({ queued: 2, dropped: 1 });
    expect(harness.warnings.some((line) => line.includes('오래된 부탁'))).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    harness.handshake();
    const resent = harness.port().sent.slice(1) as { event?: { id?: string } }[];
    expect(resent.map((message) => message.event?.id)).toEqual(['ev-2', 'ev-3']);
  });

  it('사람이 기다리는 부탁(tutor.ask)은 들고 있지 않고 그 자리에서 포기합니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.port().die();

    const result = await harness.client.send({
      type: 'tutor.ask',
      periodId: PERIOD,
      questionId: 'q-1',
      kind: 'missed',
      provider: 'claude',
      snapshot: { transcriptSegmentIds: [], ages: { transcriptSec: null, screenSec: null, editorSec: null } },
    });

    expect(result).toEqual({ status: 'dropped', reason: 'host-offline' });
    expect(harness.client.stats().queued).toBe(0);
  });

  it('resend:false 인 부탁은 들고 있지 않습니다 (프레임은 통이 따로 들고 있습니다)', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.port().die();

    const result = await harness.client.send(appendEnvelope('ev-frameish'), { resend: false });

    expect(result).toEqual({ status: 'dropped', reason: 'host-offline' });
    expect(harness.client.stats().queued).toBe(0);
  });

  it('resend:false 인 부탁은 보내는 중에 끊겨도 되돌리지 않습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const sending = harness.client.send(appendEnvelope('ev-frameish'), { resend: false });
    harness.port().die();

    expect(await sending).toEqual({ status: 'dropped', reason: 'disconnected' });
    expect(harness.client.stats().queued).toBe(0);
  });

  it('reconnectNow 는 백오프를 기다리지 않고 바로 붙습니다', () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    harness.client.reconnectNow();

    expect(harness.ports).toHaveLength(2);
    expect(harness.ports[0]?.disconnected).toBe(true);
  });

  it('connect 가 던져도 조용히 백오프로 다시 붙습니다', async () => {
    let failures = 2;
    const ports: FakePort[] = [];
    const client = new NativeHostClient({
      connect: () => {
        if (failures > 0) {
          failures -= 1;
          throw new Error('Native host has exited.');
        }
        const port = new FakePort();
        ports.push(port);
        return port;
      },
      warn: () => {},
    });

    client.start();
    expect(ports).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ports).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(ports).toHaveLength(1);
  });

  it('connect 예외의 민감한 원문은 경고에 싣지 않습니다', () => {
    const warnings: string[] = [];
    const client = new NativeHostClient({
      connect: () => {
        throw new Error('manifest C:\\Users\\learner\\host.json?access_token=secret');
      },
      warn: (message) => warnings.push(message),
    });

    client.start();

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('connect-failed');
    expect(warnings[0]).not.toContain('C:\\Users');
    expect(warnings[0]).not.toContain('access_token');
  });

  it('postMessage 예외의 민감한 원문은 호출 결과에 싣지 않습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();
    harness.port().postMessage = () => {
      throw new Error('file:///home/learner/private?token=secret');
    };

    expect(await harness.client.send(appendEnvelope('ev-1'))).toEqual({
      status: 'dropped',
      reason: 'post-failed',
    });
  });

  it('stop 뒤에는 다시 붙지 않습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.client.stop();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(harness.ports).toHaveLength(1);
  });
});
