// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toLocalIso } from './iso-time';
import { defaultMakeId, startShareObserver } from './share-observer';
import {
  createApiConnector,
  createMcpConnector,
  createShareConnector,
  NOT_IMPLEMENTED_CODE,
  stopWithFlush,
} from './index';
import { DOM_SHAPE_MAX_CHARS, domShapeLine } from './share-parser';
import type {
  HintDegradedSignal,
  SelectorBrokenSignal,
  TiroPartial,
  TranscriptSegment,
} from './types';

// 계약 정본은 packages/contracts 입니다. 여기서는 **값**(Ajv 검증기)을 불러 씁니다.
// 시험은 번들에 들어가지 않으므로 괜찮습니다. 제품 코드(src/** · entrypoints/**)에서는
// 이 패키지를 `import type` 으로만 씁니다 — Ajv 가 content script 에 섞이면 MV3 CSP 에 막힙니다.
import { createValidator, formatErrors } from '@classmate/contracts';

import recordingHtml from '../../../../fixtures/tiro/share-page-recording.html?raw';
import brokenHtml from '../../../../fixtures/tiro/share-page-selector-broken.html?raw';
import markerDriftHtml from '../../../../fixtures/tiro/share-page-marker-drift.html?raw';
import noHintsHtml from '../../../../fixtures/tiro/share-page-no-class-hints.html?raw';

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

/** 마지막 문단 옆에 문단 하나를 그대로 이어 붙입니다. 클래스도 글자도 부르는 쪽이 정합니다. */
function appendParagraph(classAttr: string, text: string): void {
  const all = paragraphs();
  const container = all[all.length - 1]?.parentElement ?? document.body.querySelector('main');
  const next = document.createElement('div');
  next.setAttribute('class', classAttr);
  next.textContent = text;
  container?.appendChild(next);
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

    // 시각은 UTC(`Z`) 가 아니라 수업 시간대(KST) 오프셋 표기로 적힙니다(`toLocalIso`).
    const expected = toLocalIso(new Date('2026-09-02T10:32:00+09:00'));
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
    expect(segments[4]?.arrivedAt).toBe(toLocalIso(new Date('2026-09-02T10:32:04+09:00')));

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

  it('깨짐 신호에 그때의 DOM 모양 요약이 함께 실립니다', () => {
    // 실측(2026-09-03 2교시)에서 selector-broken 이 떴는데 그때 페이지 모양을 몰라 파서를
    // 못 고쳤습니다. 요약에는 개수와 클래스 이름만 들어 있습니다(본문·주소·id 없음).
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

    const shape = signals[0]?.shape ?? '';
    expect(shape).toBe(domShapeLine(document.body));
    expect(shape).toContain('그릇 main');
    expect(shape).toContain('문단 후보 3개');
    expect(shape).toContain('tds-transcript-line×3');
    // 본문 문장은 절대 들어가지 않습니다.
    expect(shape).not.toContain('주문 서비스');
    expect(shape.length).toBeLessThanOrEqual(DOM_SHAPE_MAX_CHARS);

    handle.stop();
  });

  it('「다시 연결」로 관찰기를 새로 세우면 깨졌던 페이지도 다시 읽습니다', () => {
    // 사람이 패널에서 「전사 다시 연결」을 누르면 서비스 워커가 content script 에
    // `tiro.stop` → `tiro.start` 를 보냅니다. content script 는 그 두 말을
    // `stopWithFlush(connector)` 와 `connector.start()` 로 옮깁니다. 여기서 그 두 줄을
    // 그대로 부르고, 멈춘 뒤 다시 시작한 관찰기가 **새로** 파싱하는지 봅니다.
    //
    // 여기서 보는 것은 **관찰기까지**입니다. 이 시험이 통과한다고 패널 화면의 줄까지
    // 되살아난다는 뜻은 아닙니다 — 재시작 뒤 화면이 어디서 막히는지는 README 의
    // 「다시 시작하면 `seq` 가 1부터 다시 셉니다」에 그림으로 적어 두었습니다.
    document.body.innerHTML = brokenHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const segments: TranscriptSegment[] = [];
    const broken: SelectorBrokenSignal[] = [];

    const connector = createShareConnector({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      selectorBrokenGraceMs: 0,
    });
    connector.onSegment((segment) => segments.push(segment));
    connector.onSelectorBroken((signal) => broken.push(signal));

    connector.start();
    expect(broken).toHaveLength(1);
    expect(segments).toHaveLength(0);

    // tiro.stop — 진행 중 문단을 건지고 관찰을 멈춥니다. 깨진 화면이라 건질 것이 없습니다.
    clock.advance(1_000);
    stopWithFlush(connector);
    expect(segments).toHaveLength(0);

    // 그 사이 페이지가 정상 모양으로 돌아왔습니다(다음 배포·새로고침).
    clock.advance(1_000);
    document.body.innerHTML = recordingHtml;

    // tiro.start — 관찰기를 새로 세웁니다. 붙자마자 한 번 훑으므로 곧바로 문단이 나옵니다.
    connector.start();
    expect(segments).toHaveLength(4);
    // 순번은 1 부터 다시 셉니다. **일부러 그렇습니다** — 같은 문단이 같은 id 로 다시 와야
    // 라우터가 새로고침 중복을 알아보고 거릅니다(`router.test.ts` 의 새로고침 시험).
    // 이어 세면 화면에 이미 있는 문단 전부가 새 id 로 다시 올라와 전사가 두 벌이 됩니다.
    expect(segments[0]?.seq).toBe(1);
    // 구독은 살아 있어야 합니다. 끊겨 있으면 전사가 조용히 사라집니다.
    expect(broken).toHaveLength(1);

    connector.stop();
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
    const connector = createMcpConnector();
    expect(connector.kind).toBe('tiro-api');
    expect(connector.implemented).toBe(false);
    expect(() => connector.start()).toThrow(/구현되지 않았어요/);
    expect(() => connector.stop()).not.toThrow();
  });

  it('MCP·REST 스텁 둘 다 not-implemented 표시를 달고 멈춥니다', () => {
    for (const connector of [createMcpConnector(), createApiConnector()]) {
      // 계약(transcript-segment.schema.json)의 source 열거는 tiro-share·tiro-api·fixture 로
      // 고정입니다. MCP 도 REST 도 실어 나르는 길만 다르고 계약상 출처는 tiro-api 입니다.
      expect(connector.kind).toBe('tiro-api');
      expect(connector.implemented).toBe(false);
      expect(() => connector.start()).toThrow(new RegExp(NOT_IMPLEMENTED_CODE));
      // 교시 종료 정리가 스텁 때문에 끊기면 안 되므로 flush·stop 은 조용히 넘어갑니다.
      expect(connector.flush()).toEqual([]);
      expect(() => connector.stop()).not.toThrow();
      // 구독은 붙여도 되고 떼도 됩니다. 부를 일이 없을 뿐입니다.
      expect(() => connector.onSegment(() => {})()).not.toThrow();
      expect(() => connector.onPartial(() => {})()).not.toThrow();
      expect(() => connector.onHintDegraded(() => {})()).not.toThrow();
      expect(() => connector.onSelectorBroken(() => {})()).not.toThrow();
    }
  });

  it('스텁이 던지는 오류에는 자격증명이 들어갈 자리가 없습니다', () => {
    // 인자를 받지 않는 것이 곧 "토큰이 스택 추적에 남지 않는다"입니다(불변 원칙 §4).
    expect(createMcpConnector.length).toBe(0);
    expect(createApiConnector.length).toBe(0);
  });

  it('커넥터에 교시 번호를 넣으면 세그먼트의 periodId 가 그 번호로 나옵니다', () => {
    document.body.innerHTML = recordingHtml;
    const segments: TranscriptSegment[] = [];

    const connector = createShareConnector({
      root: document.body,
      periodNumber: 4,
      // 오프셋 없는 ISO 는 로컬 시각으로 읽힙니다. periodId 의 날짜가 시간대에 흔들리지 않게 합니다.
      now: fakeClock('2026-09-02T10:32:00').now,
    });
    connector.onSegment((segment) => segments.push(segment));
    connector.start();

    expect(segments).toHaveLength(4);
    expect(segments.every((s) => s.periodId === '2026-09-02-p4')).toBe(true);

    connector.stop();
  });

  it('교시 번호가 범위 밖이면 1교시로 보정해 세그먼트에 싣습니다', () => {
    document.body.innerHTML = recordingHtml;
    const segments: TranscriptSegment[] = [];

    const connector = createShareConnector({
      root: document.body,
      periodNumber: 99,
      now: fakeClock('2026-09-02T10:32:00').now,
    });
    connector.onSegment((segment) => segments.push(segment));
    connector.start();

    expect(segments[0]?.periodId).toBe('2026-09-02-p1');

    connector.stop();
  });

  it('stop 뒤에 다시 start 하면 구독이 살아 있어 세그먼트를 다시 받습니다', () => {
    // SPA 안에서 공유 페이지를 나갔다 돌아오면 실제로 이 길을 지납니다
    // (`lifecycle.decideNavigationAction` 이 stop → start 를 내줍니다).
    // 예전에는 stop() 이 리스너 묶음까지 비워, 다시 start 하면 관찰기는 도는데 받는 사람이
    // 없어 전사가 조용히 사라졌습니다.
    document.body.innerHTML = recordingHtml;
    const seen: TranscriptSegment[] = [];

    const connector = createShareConnector({ root: document.body, periodId: PERIOD_ID });
    connector.onSegment((segment) => seen.push(segment));

    connector.start();
    expect(seen).toHaveLength(4);

    connector.stop();
    // 멈춘 사이에 화면이 바뀌어도 아무것도 오지 않습니다.
    document.body.innerHTML = recordingHtml;
    expect(seen).toHaveLength(4);

    connector.start();
    expect(seen.length).toBeGreaterThan(4);

    connector.stop();
  });

  it('구독을 직접 떼면 stop 뒤 재시작해도 오지 않습니다', () => {
    // 구독을 정말 끊는 방법은 stop() 이 아니라 onSegment() 가 돌려준 해제 함수입니다.
    document.body.innerHTML = recordingHtml;
    const seen: TranscriptSegment[] = [];

    const connector = createShareConnector({ root: document.body, periodId: PERIOD_ID });
    const off = connector.onSegment((segment) => seen.push(segment));

    connector.start();
    expect(seen).toHaveLength(4);

    connector.stop();
    off();
    connector.start();
    expect(seen).toHaveLength(4);

    connector.stop();
  });

  it('커넥터의 flush() 도 진행 중 문단을 partial 로 내보냅니다', () => {
    document.body.innerHTML = recordingHtml;
    const segments: TranscriptSegment[] = [];

    const connector = createShareConnector({
      root: document.body,
      periodId: PERIOD_ID,
      now: fakeClock('2026-09-02T10:32:00+09:00').now,
    });
    connector.onSegment((segment) => segments.push(segment));

    // start 전에 부르면 아직 볼 것이 없습니다.
    expect(connector.flush()).toEqual([]);

    connector.start();
    const flushed = connector.flush();

    expect(flushed).toHaveLength(1);
    expect(flushed[0]?.state).toBe('partial');
    expect(segments).toHaveLength(5);

    connector.stop();
  });
});

describe('startShareObserver — flush()', () => {
  it('진행 중 문단을 partial 세그먼트 한 건으로 내보냅니다', () => {
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

    clock.advance(1_000);
    const flushed = handle.flush();

    expect(flushed).toHaveLength(1);
    const partial = flushed[0];
    expect(partial?.state).toBe('partial');
    expect(partial?.seq).toBe(5);
    expect(partial?.id).toBe('ts-005');
    expect(partial?.text).toBe('컨테이너가 대신 만들어 주면 우리는 언어테이션');
    expect(partial?.source).toBe('tiro-share');
    // 도착 시각은 flush 를 부른 시각입니다.
    expect(partial?.arrivedAt).toBe(toLocalIso(new Date('2026-09-02T10:32:01+09:00')));
    // 공유 페이지에는 녹음 중 문단 시각이 없으므로 spokenAt 은 아예 붙이지 않습니다.
    expect(partial && 'spokenAt' in partial).toBe(false);
    // 확정 세그먼트와 같은 자리(onSegment)로도 나갑니다.
    expect(segments).toHaveLength(5);
    expect(segments[4]).toEqual(partial);
    // 확정으로 센 것은 아직 4개입니다.
    expect(handle.emittedCount).toBe(4);

    handle.stop();
  });

  it('같은 문단이 나중에 확정되면 같은 id·순번으로 final 이 나옵니다', () => {
    document.body.innerHTML = recordingHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const segments: TranscriptSegment[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: (segment) => segments.push(segment),
    });
    clock.advance(1_000);
    handle.flush();
    expect(segments).toHaveLength(5);

    clock.advance(2_000);
    finalizeLastAndAppend('그래서 생성자 주입 방식으로');
    handle.scanNow();

    expect(segments).toHaveLength(6);
    expect(segments[5]?.state).toBe('final');
    expect(segments[5]?.id).toBe('ts-005');
    expect(segments[5]?.seq).toBe(5);
    expect(segments[5]?.text).toBe('컨테이너가 대신 만들어 주면 우리는 언어테이션');

    // 다음 문단은 새 순번을 받습니다. flush 가 번호를 태우지 않습니다.
    clock.advance(2_000);
    finalizeLastAndAppend('컨테이너가 관리하는 객체를 빈이라고 부릅니다.');
    handle.scanNow();
    expect(segments[6]?.id).toBe('ts-006');
    expect(segments[6]?.seq).toBe(6);

    handle.stop();
  });

  it('글자가 그대로면 다시 내지 않고, 자랐으면 같은 id 로 다시 냅니다', () => {
    document.body.innerHTML = recordingHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const segments: TranscriptSegment[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: (segment) => segments.push(segment),
    });
    handle.flush();
    expect(segments).toHaveLength(5);

    // 글자가 그대로입니다.
    clock.advance(500);
    expect(handle.flush()).toEqual([]);
    expect(segments).toHaveLength(5);

    // 글자가 자랐습니다.
    clock.advance(500);
    const all = paragraphs();
    const growing = all[all.length - 1];
    if (growing) growing.textContent = '컨테이너가 대신 만들어 주면 우리는 언어테이션 하나만';
    const again = handle.flush();

    expect(again).toHaveLength(1);
    expect(again[0]?.id).toBe('ts-005');
    expect(again[0]?.seq).toBe(5);
    expect(again[0]?.text).toBe('컨테이너가 대신 만들어 주면 우리는 언어테이션 하나만');

    handle.stop();
  });

  it('flush 하기 직전에 확정된 문단은 final 로 먼저 나갑니다', () => {
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

    // DOM 만 바꾸고 scanNow 를 부르지 않은 채 곧바로 flush 합니다.
    clock.advance(1_000);
    finalizeLastAndAppend('그래서 생성자 주입 방식으로');
    const flushed = handle.flush();

    expect(segments.map((s) => s.state)).toEqual([
      'final',
      'final',
      'final',
      'final',
      'final',
      'partial',
    ]);
    expect(flushed).toHaveLength(1);
    expect(flushed[0]?.text).toBe('그래서 생성자 주입 방식으로');

    handle.stop();
  });

  it('이미 확정된 문단만 있으면 flush 가 아무것도 내지 않습니다', () => {
    document.body.innerHTML = recordingHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const segments: TranscriptSegment[] = [];
    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: (segment) => segments.push(segment),
    });

    // 마지막 문단까지 확정 표시를 답니다(녹음이 끝난 모양).
    const all = paragraphs();
    all[all.length - 1]?.setAttribute(
      'class',
      'whitespace-pre-wrap font-medium text-tds-fg-subtle leading-7',
    );
    handle.scanNow();
    expect(segments).toHaveLength(5);

    expect(handle.flush()).toEqual([]);
    expect(segments).toHaveLength(5);

    handle.stop();
  });

  it('문단을 하나도 못 잡으면 flush 도 빈 배열입니다', () => {
    document.body.innerHTML = brokenHtml;
    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      onSegment: () => {},
    });

    expect(handle.flush()).toEqual([]);

    handle.stop();
  });

  it('stop() 뒤에 flush() 를 불러도 아무것도 나가지 않습니다', () => {
    document.body.innerHTML = recordingHtml;
    const segments: TranscriptSegment[] = [];
    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      onSegment: (segment) => segments.push(segment),
    });
    expect(segments).toHaveLength(4);

    handle.stop();
    expect(handle.flush()).toEqual([]);
    expect(segments).toHaveLength(4);
  });

  it('flush 로 낸 partial 세그먼트도 contracts 스키마를 통과합니다', () => {
    document.body.innerHTML = recordingHtml;
    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: fakeClock('2026-09-02T10:32:00+09:00').now,
      onSegment: () => {},
    });
    const flushed = handle.flush();
    handle.stop();

    expect(flushed).toHaveLength(1);
    const validate = createValidator<TranscriptSegment>('transcript-segment');
    for (const segment of flushed) {
      const ok = validate(segment);
      expect(formatErrors(validate.errors)).toEqual([]);
      expect(ok).toBe(true);
    }
  });
});

describe('startShareObserver — 판별 근거 등급 전이', () => {
  it('정상(class)으로 시작하면 아무 경보도 내지 않습니다', () => {
    document.body.innerHTML = recordingHtml;
    const signals: HintDegradedSignal[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: fakeClock('2026-09-02T10:32:00+09:00').now,
      onSegment: () => {},
      onHintDegraded: (signal) => signals.push(signal),
    });

    expect(signals).toHaveLength(0);

    handle.stop();
  });

  it('클래스 힌트가 사라지면 전이 한 번만 알리고, 이어지는 문단에는 다시 알리지 않습니다', () => {
    document.body.innerHTML = recordingHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const signals: HintDegradedSignal[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: () => {},
      onHintDegraded: (signal) => signals.push(signal),
    });
    expect(signals).toHaveLength(0);

    // 다음 배포에서 font-* 힌트가 통째로 사라진 모양으로 갈아 끼웁니다.
    clock.advance(1_000);
    document.body.innerHTML = noHintsHtml;
    handle.scanNow();

    expect(signals).toHaveLength(1);
    expect(signals[0]?.stateSource).toBe('structure');
    expect(signals[0]?.previousStateSource).toBe('class');
    expect(signals[0]?.degraded).toBe(true);
    expect(signals[0]?.at).toBe(toLocalIso(new Date('2026-09-02T10:32:01+09:00')));
    // 등급이 떨어진 순간에는 그때의 DOM 모양 요약이 함께 실립니다(개수·클래스 이름만).
    expect(signals[0]?.shape).toBe(domShapeLine(document.body));
    expect(signals[0]?.shape).toContain('그릇 main');

    // 같은 등급으로 문단이 계속 쌓여도 추가 경보는 없습니다.
    clock.advance(1_000);
    appendParagraph('whitespace-pre-wrap leading-7', '힌트 없는 문단이 하나 더 붙습니다.');
    handle.scanNow();
    appendParagraph('whitespace-pre-wrap leading-7', '또 하나 더 붙습니다.');
    handle.scanNow();
    expect(signals).toHaveLength(1);

    handle.stop();
  });

  it('힌트가 돌아오면 복귀도 한 번 알립니다', () => {
    document.body.innerHTML = noHintsHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const signals: HintDegradedSignal[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: () => {},
      onHintDegraded: (signal) => signals.push(signal),
    });

    // 처음부터 낮은 등급이면 첫 훑기에서 한 번 알립니다.
    expect(signals).toHaveLength(1);
    expect(signals[0]?.stateSource).toBe('structure');
    expect(signals[0]?.previousStateSource).toBeNull();

    clock.advance(1_000);
    document.body.innerHTML = recordingHtml;
    handle.scanNow();

    expect(signals).toHaveLength(2);
    expect(signals[1]?.stateSource).toBe('class');
    expect(signals[1]?.previousStateSource).toBe('structure');
    expect(signals[1]?.degraded).toBe(false);
    // 회복은 고칠 것이 없으므로 DOM 모양을 재지 않습니다.
    expect(signals[1]?.shape).toBeUndefined();

    handle.stop();
  });

  it('한 쪽 힌트만 남은 약한 경보(class-partial)도 전이로 알립니다', () => {
    document.body.innerHTML = recordingHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const signals: HintDegradedSignal[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      onSegment: () => {},
      onHintDegraded: (signal) => signals.push(signal),
    });
    expect(signals).toHaveLength(0);

    clock.advance(1_000);
    document.body.innerHTML = markerDriftHtml;
    handle.scanNow();

    expect(signals).toHaveLength(1);
    expect(signals[0]?.stateSource).toBe('class-partial');
    expect(signals[0]?.degraded).toBe(true);

    handle.stop();
  });

  it('문단을 하나도 못 잡은 구간은 등급 전이로 세지 않습니다', () => {
    document.body.innerHTML = noHintsHtml;
    const clock = fakeClock('2026-09-02T10:32:00+09:00');
    const signals: HintDegradedSignal[] = [];

    const handle = startShareObserver({
      root: document.body,
      periodId: PERIOD_ID,
      now: clock.now,
      selectorBrokenGraceMs: 0,
      onSegment: () => {},
      onHintDegraded: (signal) => signals.push(signal),
    });
    expect(signals).toHaveLength(1);

    // 선택자가 깨졌다가 같은 등급으로 돌아옵니다. 없던 전이를 지어내면 안 됩니다.
    clock.advance(1_000);
    document.body.innerHTML = brokenHtml;
    handle.scanNow();
    expect(signals).toHaveLength(1);

    clock.advance(1_000);
    document.body.innerHTML = noHintsHtml;
    handle.scanNow();
    expect(signals).toHaveLength(1);

    handle.stop();
  });
});

describe('스냅샷 재생 시나리오 (e2e 대신)', () => {
  it('확정 → 진행 → 약한 경보 → flush → 선택자 깨짐이 순서대로 나옵니다', async () => {
    // 실제 Tiro 사이트에는 접속하지 않습니다. 저장소가 들고 있는 합성 스냅샷을 happy-dom 에
    // 넣고 MutationObserver 로 자라게 만드는 것이 이 단위의 e2e 입니다.
    document.body.innerHTML = recordingHtml;
    // 오프셋 없는 ISO 는 로컬 시각으로 읽힙니다. periodId 의 날짜가 시간대에 흔들리지 않게 합니다.
    const clock = fakeClock('2026-09-02T10:32:00');
    const segments: TranscriptSegment[] = [];
    const partials: TiroPartial[] = [];
    const degraded: HintDegradedSignal[] = [];
    const broken: SelectorBrokenSignal[] = [];

    const connector = createShareConnector({
      root: document.body,
      periodNumber: 3,
      now: clock.now,
      selectorBrokenGraceMs: 0,
    });
    connector.onSegment((segment) => segments.push(segment));
    connector.onPartial((partial) => partials.push(partial));
    connector.onHintDegraded((signal) => degraded.push(signal));
    connector.onSelectorBroken((signal) => broken.push(signal));

    // 1) 붙자마자 이미 쌓여 있던 확정 문단 4개 + 진행 중 1개.
    connector.start();
    expect(segments.map((s) => s.state)).toEqual(['final', 'final', 'final', 'final']);
    expect(partials).toHaveLength(1);
    expect(degraded).toHaveLength(0);
    expect(broken).toHaveLength(0);

    // 2) DOM 이 바뀌면 scanNow 를 손으로 부르지 않아도 관찰기가 따라옵니다.
    clock.advance(2_000);
    finalizeLastAndAppend('그래서 생성자 주입 방식으로');
    await flush();
    expect(segments).toHaveLength(5);
    expect(segments[4]?.seq).toBe(5);

    // 3) 클래스 힌트가 사라진 배포로 갈아탑니다 → 약한 경보 한 번.
    clock.advance(2_000);
    const all = paragraphs();
    for (const element of all) element.setAttribute('class', 'whitespace-pre-wrap leading-7');
    await flush();
    expect(degraded).toHaveLength(1);
    expect(degraded[0]?.stateSource).toBe('structure');

    // 4) 교시가 끝났습니다. 아직 확정 안 된 마지막 문단을 partial 로 건집니다.
    clock.advance(2_000);
    const flushed = connector.flush();
    expect(flushed).toHaveLength(1);
    expect(flushed[0]?.state).toBe('partial');
    expect(flushed[0]?.periodId).toBe('2026-09-02-p3');
    expect(flushed[0]?.text).toBe('그래서 생성자 주입 방식으로');

    // 5) 그 뒤 페이지 구조가 통째로 바뀌면 깨짐 신호가 한 번 납니다.
    clock.advance(2_000);
    document.body.innerHTML = brokenHtml;
    await flush();
    expect(broken).toHaveLength(1);
    expect(broken[0]?.lastMatchedSelector).toBe('main div.whitespace-pre-wrap');

    // 6) 나온 세그먼트는 모두 계약을 통과합니다(final 5건 + partial 1건).
    const validate = createValidator<TranscriptSegment>('transcript-segment');
    expect(segments).toHaveLength(6);
    for (const segment of segments) {
      const ok = validate(segment);
      expect(formatErrors(validate.errors)).toEqual([]);
      expect(ok).toBe(true);
    }
    // 순번은 1부터 빠짐없이 늘어나고 id 는 문단마다 하나씩입니다.
    expect(segments.map((s) => s.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(segments.map((s) => s.id)).size).toBe(6);

    connector.stop();
  });
});
