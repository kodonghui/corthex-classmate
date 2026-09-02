// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultMakeId, startShareObserver } from './share-observer';
import { createApiConnector, createShareConnector } from './index';
import type { SelectorBrokenSignal, TiroPartial, TranscriptSegment } from './types';

// 계약 정본은 packages/contracts 입니다. 여기서는 **값**(Ajv 검증기)을 불러 씁니다.
// 시험은 번들에 들어가지 않으므로 괜찮습니다. 제품 코드(src/** · entrypoints/**)에서는
// 이 패키지를 `import type` 으로만 씁니다 — Ajv 가 content script 에 섞이면 MV3 CSP 에 막힙니다.
import { createValidator, formatErrors } from '@classmate/contracts';

import recordingHtml from '../../../../fixtures/tiro/share-page-recording.html?raw';
import brokenHtml from '../../../../fixtures/tiro/share-page-selector-broken.html?raw';
import markerDriftHtml from '../../../../fixtures/tiro/share-page-marker-drift.html?raw';

const PERIOD_ID = '2026-09-02-p3';
const FINAL_CLASS_ATTR = 'whitespace-pre-wrap font-medium text-tds-fg-subtle leading-7';
const IN_PROGRESS_CLASS_ATTR = 'whitespace-pre-wrap font-semibold leading-7';

/** 시험이 시계에 흔들리지 않도록 시각을 손으로 밉니다. */
function fakeClock(startIso: string) {
  let current = new Date(startIso).getTime();
  return {
    now: () => new Date(current),
    advance(ms: number) {
      current += ms;
    },
  };
}

function paragraphs(): Element[] {
  return Array.from(document.body.querySelectorAll('div.whitespace-pre-wrap'));
}

/** 마지막 진행 중 문단을 확정으로 바꾸고 새 진행 중 문단을 이어 붙입니다. */
function finalizeLastAndAppend(nextText: string): void {
  const all = paragraphs();
  const last = all[all.length - 1];
  last?.setAttribute('class', FINAL_CLASS_ATTR);

  const next = document.createElement('div');
  next.setAttribute('class', IN_PROGRESS_CLASS_ATTR);
  next.textContent = nextText;
  last?.parentElement?.appendChild(next);
}

/** MutationObserver 콜백은 마이크로태스크로 옵니다. 한 틱 기다립니다. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('defaultMakeId', () => {
  it('ts- 접두사에 세 자리 순번을 붙입니다', () => {
    expect(defaultMakeId(1)).toBe('ts-001');
    expect(defaultMakeId(42)).toBe('ts-042');
    expect(defaultMakeId(1234)).toBe('ts-1234');
  });
});

describe('startShareObserver — 첫 스캔', () => {
  it('붙자마자 이미 쌓여 있던 확정 문단 4개를 순번 1~4 로 냅니다', () => {
    document.body.innerHTML = recordingHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const segments: TranscriptSegment[] = [];
    const partials: TiroPartial[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: (segment) => segments.push(segment),
      onPartial: (partial) => partials.push(partial),
    });

    expect(segments.map((s) => s.seq)).toEqual([1, 2, 3, 4]);
    expect(segments.map((s) => s.id)).toEqual(['ts-001', 'ts-002', 'ts-003', 'ts-004']);
    expect(segments.every((s) => s.state === 'final')).toBe(true);
    expect(segments.every((s) => s.source === 'tiro-share')).toBe(true);
    expect(segments[0]?.text).toBe('자 그러면 지금까지 만든 주문 서비스를 다시 볼게요.');

    // 진행 중 문단은 세그먼트가 아니라 partial 로만 나갑니다.
    expect(partials).toHaveLength(1);
    expect(partials[0]?.index).toBe(4);
    expect(partials[0]?.text).toBe('컨테이너가 대신 만들어 주면 우리는 언어테이션');

    handle.stop();
  });

  it('도착 시각은 주입한 now() 로 찍습니다', () => {
    document.body.innerHTML = recordingHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const segments: TranscriptSegment[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: (segment) => segments.push(segment),
    });

    const expected = new Date('2026-09-02T10:32:00+09:00').toISOString();
    expect(segments.map((s) => s.arrivedAt)).toEqual([expected, expected, expected, expected]);

    handle.stop();
  });
});

describe('startShareObserver — 진행 → 확정 전이', () => {
  it('같은 문단이 확정될 때 세그먼트를 딱 한 개만 냅니다', () => {
    document.body.innerHTML = recordingHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const segments: TranscriptSegment[] = [];
    const partials: TiroPartial[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: (segment) => segments.push(segment),
      onPartial: (partial) => partials.push(partial),
    });
    expect(segments).toHaveLength(4);
    expect(partials).toHaveLength(1);

    // 1) 진행 중 문단에 글자가 더 붙습니다. 아직 확정이 아닙니다.
    clock.advance(1_200);
    const all = paragraphs();
    const growing = all[all.length - 1];
    if (growing) growing.textContent = '컨테이너가 대신 만들어 주면 우리는 언어테이션 하나만';
    handle.scanNow();

    expect(segments).toHaveLength(4);
    expect(partials).toHaveLength(2);
    expect(partials[1]?.text).toBe('컨테이너가 대신 만들어 주면 우리는 언어테이션 하나만');

    // 2) 글자가 그대로면 partial 을 다시 내지 않습니다.
    clock.advance(300);
    handle.scanNow();
    expect(partials).toHaveLength(2);

    // 3) 그 문단이 확정되고 새 진행 중 문단이 붙습니다.
    clock.advance(2_500);
    finalizeLastAndAppend('그래서 생성자 주입 방식으로');
    handle.scanNow();

    expect(segments).toHaveLength(5);
    expect(segments[4]?.seq).toBe(5);
    expect(segments[4]?.id).toBe('ts-005');
    expect(segments[4]?.text).toBe('컨테이너가 대신 만들어 주면 우리는 언어테이션 하나만');
    expect(segments[4]?.arrivedAt).toBe(new Date('2026-09-02T10:32:04+09:00').toISOString());

    // 4) 몇 번을 더 훑어도 이미 낸 문단은 다시 나오지 않습니다.
    handle.scanNow();
    handle.scanNow();
    expect(segments).toHaveLength(5);
    expect(handle.emittedCount).toBe(5);

    handle.stop();
  });

  it('MutationObserver 로도 같은 결과가 나옵니다(scanNow 를 부르지 않고)', async () => {
    document.body.innerHTML = recordingHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const segments: TranscriptSegment[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: (segment) => segments.push(segment),
    });
    expect(segments).toHaveLength(4);

    clock.advance(3_000);
    finalizeLastAndAppend('그래서 생성자 주입 방식으로');
    await flush();

    expect(segments).toHaveLength(5);
    expect(segments[4]?.seq).toBe(5);

    handle.stop();
  });

  it('stop() 뒤에는 DOM 이 바뀌어도 아무것도 내지 않습니다', async () => {
    document.body.innerHTML = recordingHtml;
    const segments: TranscriptSegment[] = [];
    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      onSegment: (segment) => segments.push(segment),
    });
    handle.stop();

    finalizeLastAndAppend('그래서 생성자 주입 방식으로');
    await flush();

    expect(segments).toHaveLength(4);
  });

  it('stop() 뒤에 scanNow() 를 손으로 불러도 세그먼트도 partial 도 나가지 않습니다', () => {
    document.body.innerHTML = recordingHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const segments: TranscriptSegment[] = [];
    const partials: TiroPartial[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: (segment) => segments.push(segment),
      onPartial: (partial) => partials.push(partial),
    });
    expect(segments).toHaveLength(4);
    expect(partials).toHaveLength(1);

    handle.stop();

    // 멈춘 뒤 페이지가 계속 자라고, 누군가 손잡이의 scanNow() 를 다시 부릅니다.
    clock.advance(3_000);
    finalizeLastAndAppend('그래서 생성자 주입 방식으로');
    const result = handle.scanNow();
    handle.scanNow();

    expect(segments).toHaveLength(4);
    expect(partials).toHaveLength(1);
    expect(handle.emittedCount).toBe(4);
    // 멈춘 관찰기는 새로 훑지 않고 마지막으로 훑은 결과를 그대로 돌려줍니다.
    expect(result.paragraphs).toHaveLength(5);
    expect(result.matchedSelector).toBe('main div.whitespace-pre-wrap');
  });

  it('선택자 깨짐도 stop() 뒤에는 다시 알리지 않습니다', () => {
    document.body.innerHTML = recordingHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const signals: SelectorBrokenSignal[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      selectorBrokenGraceMs: 0,
      onSegment: () => {},
      onSelectorBroken: (signal) => signals.push(signal),
    });
    expect(signals).toHaveLength(0);

    handle.stop();
    document.body.innerHTML = brokenHtml;
    clock.advance(60_000);
    handle.scanNow();

    expect(signals).toHaveLength(0);
  });
});

describe('startShareObserver — 클래스 이름이 바뀐 페이지', () => {
  it('확정 표시가 없는 마지막 문단은 세그먼트로 내보내지 않고 partial 로만 냅니다', () => {
    document.body.innerHTML = markerDriftHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const segments: TranscriptSegment[] = [];
    const partials: TiroPartial[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: (segment) => segments.push(segment),
      onPartial: (partial) => partials.push(partial),
    });

    // 확정 클래스를 그대로 달고 있는 앞 문단 3개만 세그먼트가 됩니다.
    expect(segments.map((s) => s.seq)).toEqual([1, 2, 3]);
    expect(partials).toHaveLength(1);
    expect(partials[0]?.index).toBe(3);
    expect(partials[0]?.text).toBe('이제 생성 책임을 컨테이너에');

    // 그 문단이 자라도 여전히 partial 입니다.
    clock.advance(1_000);
    const all = paragraphs();
    const growing = all[all.length - 1];
    if (growing) growing.textContent = '이제 생성 책임을 컨테이너에 맡겨 볼게요.';
    handle.scanNow();

    expect(segments).toHaveLength(3);
    expect(partials).toHaveLength(2);

    handle.stop();
  });
});

describe('startShareObserver — 선택자 깨짐', () => {
  it('유예 시간을 0 으로 두면 첫 스캔에서 바로 한 번 알립니다', () => {
    document.body.innerHTML = brokenHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const signals: SelectorBrokenSignal[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      selectorBrokenGraceMs: 0,
      onSegment: () => {},
      onSelectorBroken: (signal) => signals.push(signal),
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]?.emptyForMs).toBe(0);
    expect(signals[0]?.lastMatchedSelector).toBeNull();

    // 계속 비어 있어도 같은 구간에서 두 번 알리지 않습니다.
    clock.advance(5_000);
    handle.scanNow();
    expect(signals).toHaveLength(1);

    handle.stop();
  });

  it('유예 시간(기본 30초) 안에는 알리지 않고, 넘어서면 알립니다', () => {
    document.body.innerHTML = brokenHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const signals: SelectorBrokenSignal[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: () => {},
      onSelectorBroken: (signal) => signals.push(signal),
    });
    expect(signals).toHaveLength(0);

    clock.advance(29_000);
    handle.scanNow();
    expect(signals).toHaveLength(0);

    clock.advance(1_000);
    handle.scanNow();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.emptyForMs).toBe(30_000);

    handle.stop();
  });

  it('문단이 다시 잡히면 세그먼트가 이어지고 깨짐 판정도 다시 잽니다', () => {
    document.body.innerHTML = brokenHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const signals: SelectorBrokenSignal[] = [];
    const segments: TranscriptSegment[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      selectorBrokenGraceMs: 0,
      onSegment: (segment) => segments.push(segment),
      onSelectorBroken: (signal) => signals.push(signal),
    });
    expect(signals).toHaveLength(1);
    expect(segments).toHaveLength(0);

    clock.advance(1_000);
    document.body.innerHTML = recordingHtml;
    handle.scanNow();
    expect(segments).toHaveLength(4);
    expect(signals).toHaveLength(1);

    clock.advance(1_000);
    document.body.innerHTML = brokenHtml;
    handle.scanNow();
    expect(signals).toHaveLength(2);
    expect(signals[1]?.lastMatchedSelector).toBe('main div.whitespace-pre-wrap');

    handle.stop();
  });
});

describe('만들어진 세그먼트가 contracts 스키마를 통과합니다', () => {
  it('transcript-segment.schema.json 검증을 모두 통과합니다', () => {
    document.body.innerHTML = recordingHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const segments: TranscriptSegment[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: (segment) => segments.push(segment),
    });
    clock.advance(2_000);
    finalizeLastAndAppend('그래서 생성자 주입 방식으로');
    handle.scanNow();
    handle.stop();

    expect(segments).toHaveLength(5);

    const validate = createValidator<TranscriptSegment>('transcript-segment');
    for (const segment of segments) {
      const ok = validate(segment);
      expect(formatErrors(validate.errors)).toEqual([]);
      expect(ok).toBe(true);
    }
  });

  it('교시 식별자가 계약 모양이 아니면 검증이 잡아냅니다', () => {
    document.body.innerHTML = recordingHtml;
    const segments: TranscriptSegment[] = [];
    const handle = startShareObserver({
      root: document.body,
      periodId: '오늘-3교시',
      onSegment: (segment) => segments.push(segment),
    });
    handle.stop();

    const validate = createValidator<TranscriptSegment>('transcript-segment');
    expect(validate(segments[0])).toBe(false);
  });
});

describe('커넥터 인터페이스', () => {
  it('공유 페이지 커넥터는 start 전에는 아무것도 하지 않고 리스너를 뗄 수 있습니다', () => {
    document.body.innerHTML = recordingHtml;
    const onSegment = vi.fn();

    const connector = createShareConnector({
      root: document.body,
      periodId: PERIOD_ID,
      now: fakeClock('2026-09-02T10:32:00+09:00').now,
    });
    expect(connector.kind).toBe('tiro-share');
    expect(connector.implemented).toBe(true);

    const off = connector.onSegment(onSegment);
    off();
    connector.start();
    expect(onSegment).not.toHaveBeenCalled();

    connector.stop();

    const connector2 = createShareConnector({ root: document.body, periodId: PERIOD_ID });
    const seen: TranscriptSegment[] = [];
    connector2.onSegment((segment) => seen.push(segment));
    connector2.start();
    connector2.start(); // 두 번 불러도 한 번만 시작합니다.
    expect(seen).toHaveLength(4);
    connector2.stop();
  });

  it('MCP 커넥터는 아직 스텁이라 start 하면 이유를 말하며 멈춥니다', () => {
    const connector = createApiConnector();
    expect(connector.kind).toBe('tiro-api');
    expect(connector.implemented).toBe(false);
    expect(() => connector.start()).toThrow(/구현되지 않았어요/);
    expect(() => connector.stop()).not.toThrow();
  });
});
