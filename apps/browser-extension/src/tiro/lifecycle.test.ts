import { describe, expect, it } from 'vitest';

import { attachLifecycleFlush, stopWithFlush } from './lifecycle';
import type { FlushableConnector, LifecycleTarget } from './lifecycle';

/** 아주 작은 이벤트 대상입니다. happy-dom 없이도 돌게 손으로 만듭니다. */
function fakeTarget(): LifecycleTarget & { fire(type: string): void; count(type: string): number } {
  const listeners = new Map<string, Set<() => void>>();
  return {
    addEventListener(type, listener) {
      const bag = listeners.get(type) ?? new Set<() => void>();
      bag.add(listener);
      listeners.set(type, bag);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    fire(type) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener();
    },
    count(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

/** 무엇이 몇 번 불렸는지만 세는 가짜 커넥터입니다. */
function fakeConnector(): FlushableConnector & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    flush() {
      calls.push('flush');
      return [];
    },
    stop() {
      calls.push('stop');
    },
  };
}

describe('attachLifecycleFlush', () => {
  it('pagehide 에서 flush 하고 나서 stop 합니다', () => {
    const connector = fakeConnector();
    const page = fakeTarget();
    const visibility = fakeTarget();

    attachLifecycleFlush({
      connector,
      pageTarget: page,
      visibilityTarget: visibility,
      isHidden: () => false,
    });
    page.fire('pagehide');

    // 순서가 뒤집히면 stop 뒤의 flush 가 아무것도 내지 않아 마지막 문단이 사라집니다.
    expect(connector.calls).toEqual(['flush', 'stop']);
  });

  it('탭이 숨겨지면 flush 만 하고 관찰은 멈추지 않습니다', () => {
    const connector = fakeConnector();
    const page = fakeTarget();
    const visibility = fakeTarget();
    let hidden = false;

    attachLifecycleFlush({
      connector,
      pageTarget: page,
      visibilityTarget: visibility,
      isHidden: () => hidden,
    });

    // 다시 보이게 된 전이에서는 아무것도 하지 않습니다.
    visibility.fire('visibilitychange');
    expect(connector.calls).toEqual([]);

    hidden = true;
    visibility.fire('visibilitychange');
    expect(connector.calls).toEqual(['flush']);
  });

  it('뗀 뒤에는 이벤트가 와도 아무것도 하지 않습니다', () => {
    const connector = fakeConnector();
    const page = fakeTarget();
    const visibility = fakeTarget();

    const detach = attachLifecycleFlush({
      connector,
      pageTarget: page,
      visibilityTarget: visibility,
      isHidden: () => true,
    });
    expect(page.count('pagehide')).toBe(1);
    expect(visibility.count('visibilitychange')).toBe(1);

    detach();
    detach(); // 두 번 불러도 안전합니다.
    expect(page.count('pagehide')).toBe(0);
    expect(visibility.count('visibilitychange')).toBe(0);

    page.fire('pagehide');
    visibility.fire('visibilitychange');
    expect(connector.calls).toEqual([]);
  });
});

describe('stopWithFlush', () => {
  it('flush 하고 나서 stop 합니다', () => {
    const connector = fakeConnector();
    stopWithFlush(connector);
    expect(connector.calls).toEqual(['flush', 'stop']);
  });
});
