import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  EditorContext,
  ScreenFrame,
  SessionEvent,
  TranscriptSegment,
} from '@classmate/contracts';
import type { AnswerDelta, PanelInbox, PanelOutbox } from '../panel/ports';
import type { LivePortLike, LiveRuntimeLike } from './attach';
import { attachLive, panelBackoffMs } from './attach';
import { PANEL_ASK, PANEL_EVENT, PANEL_PORT_NAME, PANEL_RECONNECT } from './messages';

const PERIOD = '2026-09-02-p3';

/**
 * 가짜 포트입니다.
 *
 * `chrome.runtime.connect` 가 주는 포트의 얼굴만 흉내 냅니다. `deliver()` 로 서비스 워커인
 * 척 말을 보내고 `die()` 로 서비스 워커가 잠든 척합니다(MV3 는 30초 유휴에 내려갑니다).
 */
class FakePort implements LivePortLike {
  readonly sent: unknown[] = [];
  disconnected = false;
  private messageListeners: ((message: unknown) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];

  postMessage(message: unknown): void {
    if (this.disconnected) throw new Error('Attempting to use a disconnected port object');
    this.sent.push(message);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  onMessage = {
    addListener: (callback: (message: unknown) => void) => {
      this.messageListeners.push(callback);
    },
    removeListener: (callback: (message: unknown) => void) => {
      this.messageListeners = this.messageListeners.filter((listener) => listener !== callback);
    },
  };

  onDisconnect = {
    addListener: (callback: () => void) => {
      this.disconnectListeners.push(callback);
    },
    removeListener: (callback: () => void) => {
      this.disconnectListeners = this.disconnectListeners.filter((listener) => listener !== callback);
    },
  };

  deliver(message: unknown): void {
    for (const listener of [...this.messageListeners]) listener(message);
  }

  die(): void {
    this.disconnected = true;
    for (const listener of [...this.disconnectListeners]) listener();
  }

  get types(): string[] {
    return this.sent.map((message) => (message as { type?: string }).type ?? '?');
  }
}

/** 스토어가 받은 것을 그대로 모으는 가짜 입구입니다. */
class FakeInbox implements PanelInbox {
  readonly events: SessionEvent[] = [];
  readonly segments: TranscriptSegment[] = [];
  readonly frames: ScreenFrame[] = [];
  readonly editors: EditorContext[] = [];
  readonly deltas: AnswerDelta[] = [];

  pushEvent(event: SessionEvent): void {
    this.events.push(event);
  }
  pushSegment(segment: TranscriptSegment): void {
    this.segments.push(segment);
  }
  pushFrame(frame: ScreenFrame): void {
    this.frames.push(frame);
  }
  pushEditor(context: EditorContext): void {
    this.editors.push(context);
  }
  pushDelta(delta: AnswerDelta): void {
    this.deltas.push(delta);
  }
}

/** 스토어가 사건을 내는 가짜 출구입니다. */
class FakeOutbox implements PanelOutbox {
  private listeners: ((event: SessionEvent) => void)[] = [];
  unsubscribes = 0;

  subscribeEmitted(listener: (event: SessionEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.unsubscribes += 1;
      this.listeners = this.listeners.filter((one) => one !== listener);
    };
  }

  emit(event: SessionEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}

function makeEvent(type: SessionEvent['type']): SessionEvent {
  return { id: `ev-${PERIOD}-xdeadbeef-1`, periodId: PERIOD, at: '2026-09-02T10:32:00+09:00', type, payload: {} };
}

function makeSegment(): TranscriptSegment {
  return {
    id: 'ts-p3-001',
    periodId: PERIOD,
    seq: 1,
    text: '스프링은 객체를 대신 만들어 줍니다',
    state: 'final',
    arrivedAt: '2026-09-02T10:31:40+09:00',
    source: 'tiro-share',
  };
}

interface Harness {
  ports: FakePort[];
  runtime: LiveRuntimeLike;
  inbox: FakeInbox;
  outbox: FakeOutbox;
  warnings: string[];
  port(): FakePort;
}

function makeHarness(): Harness {
  const ports: FakePort[] = [];
  const warnings: string[] = [];
  const harness: Harness = {
    ports,
    runtime: {
      connect: (info) => {
        expect(info.name).toBe(PANEL_PORT_NAME);
        const port = new FakePort();
        ports.push(port);
        return port;
      },
    },
    inbox: new FakeInbox(),
    outbox: new FakeOutbox(),
    warnings,
    port: () => {
      const last = ports[ports.length - 1];
      if (last === undefined) throw new Error('포트가 아직 없습니다');
      return last;
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

describe('panelBackoffMs', () => {
  it('1·2·4·8·10·10…초로 늘다가 10초에서 멈춥니다', () => {
    expect([0, 1, 2, 3, 4, 5].map((attempt) => panelBackoffMs(attempt))).toEqual([
      1000, 2000, 4000, 8000, 10_000, 10_000,
    ]);
  });
});

describe('attachLive · 들어오는 것', () => {
  it('붙자마자 classmate-panel 이름으로 포트를 엽니다', () => {
    const harness = makeHarness();
    const handle = attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime);

    expect(harness.ports).toHaveLength(1);
    expect(handle.connected).toBe(true);
  });

  it('live.* 다섯 가지를 스토어의 알맞은 입구로 넘깁니다', () => {
    const harness = makeHarness();
    attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime, {
      warn: (m) => harness.warnings.push(m),
    });

    const frame: ScreenFrame = {
      id: 'sf-p3-001',
      periodId: PERIOD,
      capturedAt: '2026-09-02T10:32:18+09:00',
      path: 'frames/sf-p3-001.webp',
      width: 1280,
      height: 720,
      hash: 'a1b2c3d4',
      changedFromPrev: true,
      source: 'meet-tab',
    };
    const context: EditorContext = {
      id: 'ec-p3-001',
      periodId: PERIOD,
      capturedAt: '2026-09-02T10:32:18+09:00',
      filePath: 'src/main/java/OrderService.java',
      language: 'java',
      source: 'intellij-mcp',
      excerpt: 'class OrderService {}',
      visibleRange: { startLine: 1, endLine: 10 },
    };

    harness.port().deliver({ type: 'live.event', event: makeEvent('panel.opened') });
    harness.port().deliver({ type: 'live.segment', segment: makeSegment() });
    harness.port().deliver({ type: 'live.frame', frame });
    harness.port().deliver({ type: 'live.editor', context });
    harness
      .port()
      .deliver({ type: 'live.delta', delta: { questionId: 'q-1', seq: 1, chars: 21, text: '생성 책임을' } });

    expect(harness.inbox.events).toHaveLength(1);
    expect(harness.inbox.segments[0]?.id).toBe('ts-p3-001');
    expect(harness.inbox.frames[0]?.id).toBe('sf-p3-001');
    expect(harness.inbox.editors[0]?.id).toBe('ec-p3-001');
    expect(harness.inbox.deltas[0]).toEqual({ questionId: 'q-1', seq: 1, chars: 21, text: '생성 책임을' });
  });

  it('text 가 없는 조각도 그대로 넘깁니다 (아직 결론 칸에 안 닿은 조각)', () => {
    const harness = makeHarness();
    attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime);

    harness.port().deliver({ type: 'live.delta', delta: { questionId: 'q-1', seq: 0, chars: 7 } });

    expect(harness.inbox.deltas).toEqual([{ questionId: 'q-1', seq: 0, chars: 7 }]);
  });

  it('seq·chars 가 숫자가 아닌 조각은 버립니다', () => {
    // 그대로 넘기면 스토어의 되감기 판정(seq <= 이전 seq)이 NaN 비교로 무너집니다.
    const harness = makeHarness();
    attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime);

    harness.port().deliver({ type: 'live.delta', delta: { questionId: 'q-1', seq: '0', chars: 7 } });
    harness.port().deliver({ type: 'live.delta', delta: { questionId: '', seq: 0, chars: 7 } });
    harness.port().deliver({ type: 'live.delta', delta: { questionId: 'q-1', seq: 0 } });

    expect(harness.inbox.deltas).toEqual([]);
  });

  it('낯선 모양은 그냥 무시합니다', () => {
    const harness = makeHarness();
    attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime);

    harness.port().deliver({ type: 'live.nope' });
    harness.port().deliver(null);
    harness.port().deliver('문자열');

    expect(harness.inbox.events).toEqual([]);
    expect(harness.inbox.segments).toEqual([]);
  });
});

describe('attachLive · 나가는 것', () => {
  it('스토어가 낸 사건을 panel.event 로 흘립니다', () => {
    const harness = makeHarness();
    attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime);

    harness.outbox.emit(makeEvent('state.changed'));

    expect(harness.port().types).toEqual([PANEL_EVENT]);
  });

  it('ask 는 panel.ask 로 재료를 그대로 넘깁니다 (봉투로 바꾸는 것은 라우터 몫)', () => {
    const harness = makeHarness();
    const handle = attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime);

    handle.ask.ask({
      questionId: 'q-1',
      provider: 'claude',
      kind: 'missed',
      word: 'new',
      question: 'new 가 무슨 뜻인가요',
      snapshot: null,
    });

    expect(harness.port().sent[0]).toEqual({
      type: PANEL_ASK,
      request: {
        questionId: 'q-1',
        provider: 'claude',
        kind: 'missed',
        word: 'new',
        question: 'new 가 무슨 뜻인가요',
        snapshot: null,
      },
    });
  });

  it('reconnect 는 classmate.reconnect 를 보냅니다', () => {
    const harness = makeHarness();
    const handle = attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime);

    handle.reconnect('native-host');

    expect(harness.port().sent[0]).toEqual({ type: PANEL_RECONNECT, connector: 'native-host' });
  });
});

describe('attachLive · 끊김', () => {
  it('서비스 워커가 잠들면 1·2·4…초 백오프로 다시 붙습니다', async () => {
    const harness = makeHarness();
    attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime, {
      warn: () => {},
    });

    harness.port().die();
    expect(harness.ports).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(harness.ports).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.ports).toHaveLength(2);

    harness.port().die();
    await vi.advanceTimersByTimeAsync(2000);
    expect(harness.ports).toHaveLength(3);
  });

  it('말이 한 번 오가면 첫 회차 지연으로 돌아갑니다', async () => {
    const harness = makeHarness();
    attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime, { warn: () => {} });

    harness.port().die();
    await vi.advanceTimersByTimeAsync(1000);
    // 서비스 워커가 붙자마자 보내는 `period.started` 입니다. 왕복이 성립했으니 회차가 0 으로
    // 돌아가고 다음 끊김도 1초입니다.
    harness.port().deliver({ type: 'live.event', event: makeEvent('period.started') });
    harness.port().die();
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.ports).toHaveLength(3);
  });

  it('붙자마자 끊기기만 하면 백오프가 자랍니다 (1Hz 재접속 루프를 막습니다)', async () => {
    const harness = makeHarness();
    attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime, { warn: () => {} });

    // 말이 한 번도 오가지 않은 연결입니다. 포트가 생긴 것만으로는 왕복이 성립하지 않습니다.
    harness.port().die();
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.ports).toHaveLength(2); // 1초

    harness.port().die();
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.ports).toHaveLength(2); // 아직 2초가 안 됐습니다
    await vi.advanceTimersByTimeAsync(1000);
    expect(harness.ports).toHaveLength(3); // 2초
  });

  it('다시 붙은 뒤에는 새 포트로 말이 옵니다', async () => {
    const harness = makeHarness();
    attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime, { warn: () => {} });

    const first = harness.port();
    first.die();
    await vi.advanceTimersByTimeAsync(1000);

    // 죽은 포트로 오는 말은 이미 리스너를 뗐으므로 들어오지 않습니다.
    first.deliver({ type: 'live.segment', segment: makeSegment() });
    expect(harness.inbox.segments).toHaveLength(0);

    harness.port().deliver({ type: 'live.segment', segment: makeSegment() });
    expect(harness.inbox.segments).toHaveLength(1);
  });

  it('끊긴 사이의 손짓은 되살리지 않고 한 줄만 남깁니다', () => {
    const harness = makeHarness();
    const handle = attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime, {
      warn: (m) => harness.warnings.push(m),
    });

    harness.port().die();
    handle.reconnect('tiro-share');

    expect(harness.warnings.some((line) => line.includes('끊긴 사이'))).toBe(true);
  });

  it('detach 하면 구독을 떼고 다시 붙지 않습니다', async () => {
    const harness = makeHarness();
    const handle = attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime, {
      warn: () => {},
    });

    handle.detach();

    expect(harness.outbox.unsubscribes).toBe(1);
    expect(harness.ports[0]?.disconnected).toBe(true);
    expect(handle.connected).toBe(false);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(harness.ports).toHaveLength(1);
  });

  it('detach 뒤에는 스토어가 사건을 내도 보내지 않습니다', () => {
    const harness = makeHarness();
    const handle = attachLive({ inbox: harness.inbox, outbox: harness.outbox }, harness.runtime, {
      warn: () => {},
    });
    const port = harness.port();
    handle.detach();

    harness.outbox.emit(makeEvent('state.changed'));
    expect(port.sent).toEqual([]);
  });

  it('connect 자체가 던져도 조용히 다시 붙습니다', async () => {
    let failures = 1;
    const ports: FakePort[] = [];
    const runtime: LiveRuntimeLike = {
      connect: () => {
        if (failures > 0) {
          failures -= 1;
          throw new Error('Extension context invalidated.');
        }
        const port = new FakePort();
        ports.push(port);
        return port;
      },
    };

    const handle = attachLive({ inbox: new FakeInbox(), outbox: new FakeOutbox() }, runtime, {
      warn: () => {},
    });

    expect(handle.connected).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ports).toHaveLength(1);
  });
});
