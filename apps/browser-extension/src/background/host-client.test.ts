import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionEvent } from '@classmate/contracts';
import type { NativePortLike } from './host-client';
import { NativeHostClient, backoffDelayMs } from './host-client';
import type { EventAppendEnvelope } from './host-messages';

const PERIOD = '2026-09-02-p3';

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
  warnings: string[];
  /** 마지막으로 만들어진 포트입니다. */
  port(): FakePort;
  /** 붙고 `hello` 까지 받아 "연결됨" 으로 만듭니다. */
  handshake(): void;
}

function makeHarness(options: { maxQueued?: number } = {}): Harness {
  const ports: FakePort[] = [];
  const statuses: { state: string; reason: string | undefined }[] = [];
  const pushes: unknown[] = [];
  const warnings: string[] = [];

  const client = new NativeHostClient({
    connect: () => {
      const port = new FakePort();
      ports.push(port);
      return port;
    },
    ...(options.maxQueued === undefined ? {} : { maxQueued: options.maxQueued }),
    onStatus: (state, reason) => statuses.push({ state, reason }),
    onPush: (push) => pushes.push(push),
    warn: (message) => warnings.push(message),
  });

  const harness: Harness = {
    client,
    ports,
    statuses,
    pushes,
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

  it('답이 오지 않으면 그 부탁만 포기하고 뒤엣것의 짝은 그대로 맞습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.handshake();

    const stalled = harness.client.send(appendEnvelope('ev-1'));
    // 둘째 부탁은 10초 뒤에 보냅니다. 그래야 첫째만 45초를 채워 포기합니다.
    await vi.advanceTimersByTimeAsync(10_000);
    const next = harness.client.send(appendEnvelope('ev-2'));

    await vi.advanceTimersByTimeAsync(35_000);
    expect(await stalled).toEqual({ status: 'dropped', reason: 'timeout' });

    // 뒤늦게 온 첫 답은 포기한 자리와 짝지어지고 버려집니다. 둘째 답이 둘째 부탁의 것입니다.
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 1, id: 'ev-1' });
    harness.port().reply({ type: 'event.ack', periodId: PERIOD, seq: 2, id: 'ev-2' });
    expect(await next).toMatchObject({ status: 'replied', message: { id: 'ev-2' } });
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

  it('stop 뒤에는 다시 붙지 않습니다', async () => {
    const harness = makeHarness();
    harness.client.start();
    harness.client.stop();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(harness.ports).toHaveLength(1);
  });
});
