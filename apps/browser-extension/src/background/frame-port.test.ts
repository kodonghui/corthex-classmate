/**
 * 프레임 통과 도우미 연결을 잇는 한 겹(`createFrameStorePort`)의 시험입니다.
 *
 * 여기서 지키는 것은 하나입니다: **같은 장이 두 대기열에 함께 담기지 않는다.**
 * 담는 자리를 두 곳으로 두면 도우미가 돌아왔을 때 두 곳이 각각 보내고, 뒤엣것이
 * `duplicate-frame` 으로 돌아와 화면 커넥터가 멀쩡한데도 호박색이 됩니다.
 */

import { describe, expect, it } from 'vitest';

import type { ScreenFrame } from '@classmate/contracts';
import { NativeHostFrameSink } from '../capture/frame-sink';
import type { FrameStoreMessage } from '../capture/host-messages';
import { NativeHostClient } from './host-client';
import type { NativePortLike } from './host-client';
import { createFrameStorePort, toFrameStoreOutcome } from './frame-port';

const PERIOD = '2026-09-02-p3';

function frame(index: number): ScreenFrame {
  const id = `sf-p3-${String(index).padStart(3, '0')}`;
  return {
    id,
    periodId: PERIOD,
    capturedAt: '2026-09-02T10:32:18+09:00',
    path: `frames/${id}.webp`,
    width: 1280,
    height: 720,
    hash: 'a1b2c3d4',
    changedFromPrev: true,
    source: 'meet-tab',
  };
}

/** 가짜 Native Messaging 포트입니다. `host-client.test.ts` 의 것과 같은 얼굴입니다. */
class FakePort implements NativePortLike {
  readonly sent: unknown[] = [];
  private messageListeners: ((message: unknown) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];

  /** 참이면 `frame.store` 에 그 자리에서 `frame.stored` 로 답합니다. */
  autoStore = true;

  postMessage(message: unknown): void {
    this.sent.push(message);
    const envelope = message as { type?: string };
    if (!this.autoStore || envelope.type !== 'frame.store') return;
    const stored = message as FrameStoreMessage;
    this.reply({
      type: 'frame.stored',
      periodId: stored.periodId,
      id: stored.frame.id,
      path: stored.frame.path,
      bytes: 16,
      seq: 1,
    });
  }
  disconnect(): void {}
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
  reply(message: unknown): void {
    for (const listener of [...this.messageListeners]) listener(message);
  }
  die(): void {
    for (const listener of [...this.disconnectListeners]) listener();
  }
  /** 우리가 보낸 `frame.store` 봉투들의 프레임 id 만입니다. */
  get frameIds(): string[] {
    return this.sent
      .filter((message): message is FrameStoreMessage => (message as { type?: string }).type === 'frame.store')
      .map((message) => message.frame.id);
  }
}

describe('toFrameStoreOutcome', () => {
  it('답이 오지 않았으면 offline 입니다 (통이 들고 있다가 다시 보냅니다)', () => {
    expect(toFrameStoreOutcome({ status: 'dropped', reason: 'host-offline' })).toEqual({ kind: 'offline' });
    expect(toFrameStoreOutcome({ status: 'queued' })).toEqual({ kind: 'offline' });
  });

  it('frame.stored 는 stored, error 는 rejected 입니다', () => {
    expect(
      toFrameStoreOutcome({
        status: 'replied',
        message: { type: 'frame.stored', periodId: PERIOD, id: 'sf-1', path: 'frames/sf-1.webp', bytes: 12, seq: 4 },
      }),
    ).toEqual({ kind: 'stored', bytes: 12, seq: 4 });

    expect(
      toFrameStoreOutcome({
        status: 'replied',
        message: { type: 'error', message: '이미 있어요', reason: 'duplicate-frame', received: 'frame.store' },
      }),
    ).toEqual({ kind: 'rejected', reason: 'duplicate-frame' });
  });

  it('모르는 답은 rejected 로 봅니다 (다시 보내도 같은 답이 옵니다)', () => {
    expect(toFrameStoreOutcome({ status: 'replied', message: { type: 'hello' } })).toEqual({
      kind: 'rejected',
      reason: 'unexpected-reply',
    });
  });
});

describe('프레임 대기열은 한 곳뿐입니다', () => {
  it('도우미가 꺼져 있을 때 같은 장이 두 대기열에 담기지 않습니다', async () => {
    const ports: FakePort[] = [];
    const client = new NativeHostClient({
      connect: () => {
        const port = new FakePort();
        ports.push(port);
        return port;
      },
      warn: () => {},
    });
    const rejections: string[] = [];
    const sink = new NativeHostFrameSink(createFrameStorePort(client), {
      warn: () => {},
      onRejected: (reason) => rejections.push(reason),
    });

    client.start();
    // 아직 hello 를 받지 않았으니 "꺼짐" 입니다.
    await sink.store(frame(1), new Uint8Array(16).fill(7));

    // 들고 있는 자리는 통 하나뿐이어야 합니다.
    expect(sink.stats().waiting).toBe(1);
    expect(client.stats().queued).toBe(0);

    // 도우미가 돌아왔습니다. 두 곳이 각각 보내면 뒤엣것이 duplicate-frame 으로 돌아옵니다.
    const port = ports[0];
    if (port === undefined) throw new Error('포트가 없습니다');
    port.reply({ type: 'hello', host: 'classmate-host', version: '0.1.0', protocol: 1 });
    await sink.flushWaiting();

    expect(port.frameIds).toEqual(['sf-p3-001']);
    expect(rejections).toEqual([]);
  });
});
