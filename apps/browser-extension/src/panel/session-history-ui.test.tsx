// @vitest-environment happy-dom

import type { ActivitySetV2, SessionBundleV2, SessionSummaryV2 } from '@classmate/contracts';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { SessionHistoryClient } from '../session-history/client';
import type { SessionHistoryResult } from '../session-history/client';
import { GOLDEN_BUNDLE } from './golden-bundle';
import { PanelApp } from './PanelApp';
import { ReplayStore } from './replay-store';
import { createMemorySettingsStorage } from './settings-store';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(node: React.ReactNode): void {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(node));
}

afterEach(() => {
  if (root !== null) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function buttonNamed(text: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find(
    (button) => (button.textContent ?? '').includes(text) || button.getAttribute('aria-label') === text,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`"${text}" 단추를 찾지 못했어요`);
  return found;
}

function click(button: HTMLButtonElement): void {
  act(() => button.click());
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value) {
      if (resolvePromise === undefined) throw new Error('아직 준비되지 않은 promise예요');
      resolvePromise(value);
    },
  };
}

const SUMMARY: SessionSummaryV2 = {
  sessionId: 'session-2026-09-03-p8',
  legacyPeriodId: '2026-09-03-p8',
  profile: 'class',
  title: '지난 AOP 수업',
  startedAt: '2026-09-03T16:00:00+09:00',
  endedAt: '2026-09-03T16:50:00+09:00',
  lastAt: '2026-09-03T16:50:00+09:00',
  eventCount: 18,
  transcriptCount: 8,
  questionCount: 2,
  answerCount: 2,
  frameCount: 1,
};

const BUNDLE: SessionBundleV2 = {
  schemaVersion: '2',
  sessionId: SUMMARY.sessionId,
  legacyPeriodId: '2026-09-03-p8',
  profile: 'class',
  title: '지난 AOP 수업',
  startedAt: '2026-09-03T16:00:00+09:00',
  endedAt: '2026-09-03T16:50:00+09:00',
  summary: SUMMARY,
  sources: [
    { id: 'source-transcript', kind: 'transcript', adapterId: 'synthetic-test' },
    { id: 'source-visual', kind: 'visual', adapterId: 'synthetic-test', assetId: 'asset-frame' },
  ],
  moments: [
    {
      id: 'moment-transcript',
      type: 'transcript',
      at: '2026-09-03T16:01:00+09:00',
      materialRefIds: ['source-transcript'],
      assetRefIds: [],
      text: '프록시는 원본 객체 앞에서 요청을 받습니다.',
      transcript: { segmentId: 'segment-1', revision: 1, isFinal: true },
    },
    {
      id: 'moment-question',
      type: 'question',
      at: '2026-09-03T16:02:00+09:00',
      materialRefIds: ['source-transcript', 'source-visual'],
      assetRefIds: ['asset-frame'],
      text: '왜 프록시가 필요한가요?',
    },
    {
      id: 'moment-response',
      type: 'response',
      at: '2026-09-03T16:02:05+09:00',
      materialRefIds: ['source-transcript', 'source-visual'],
      assetRefIds: ['asset-frame'],
      response: {
        id: 'response-1',
        questionId: 'moment-question',
        createdAt: '2026-09-03T16:02:05+09:00',
        conclusion: '공통 로직을 원본과 분리하려고 씁니다.',
        evidenceRefIds: ['moment-transcript', 'asset-frame'],
        sections: [
          {
            id: 'section-1',
            title: '왜 필요한가',
            content: '횡단 관심사를 여러 원본 메서드에 반복하지 않게 합니다.',
          },
        ],
        providerId: 'synthetic-test',
        model: 'fixture',
        status: 'completed',
      },
    },
  ],
  activities: [],
  artifacts: [
    {
      id: 'asset-frame',
      kind: 'image',
      mediaType: 'image/jpeg',
      path: 'frames/synthetic-frame.jpg',
      logicalPath: 'frames/synthetic-frame.webp',
    },
  ],
};

function client(calls: string[]): SessionHistoryClient {
  return {
    list: async () => {
      calls.push('list');
      return { status: 'ok', value: [SUMMARY] };
    },
    getSummary: async (sessionId) => {
      calls.push(`summary:${sessionId}`);
      return { status: 'ok', value: SUMMARY };
    },
    getBundle: async (sessionId) => {
      calls.push(`bundle:${sessionId}`);
      return { status: 'ok', value: BUNDLE };
    },
  };
}

describe('PanelApp 과거 세션 라이브러리', () => {
  it('현재 기록을 보존하면서 Native Host의 과거 목록·요약·상세를 엽니다', async () => {
    const calls: string[] = [];
    const store = new ReplayStore(GOLDEN_BUNDLE);
    store.goto('answer');
    mount(
      <PanelApp
        store={store}
        autoClock={false}
        settings={createMemorySettingsStorage()}
        sessionHistory={client(calls)}
      />,
    );
    await flush();

    click(buttonNamed('기록'));
    await flush();

    // fixture에서 실제로 붙잡은 현재 순간과 호스트의 과거 세션이 한 화면에 함께 있습니다.
    expect(document.body.textContent).toContain('자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요');
    expect(document.body.textContent).toContain('지난 AOP 수업');
    expect(document.body.textContent).toContain('전사 8 · 질문 2 · 답 2 · 화면 1');
    expect(calls).toEqual(['list']);

    click(buttonNamed('지난 AOP 수업'));
    await flush();

    expect(calls).toEqual(['list', `bundle:${SUMMARY.sessionId}`]);
    expect(document.body.textContent).toContain('프록시는 원본 객체 앞에서 요청을 받습니다.');
    expect(document.body.textContent).toContain('왜 프록시가 필요한가요?');
    expect(document.body.textContent).toContain('공통 로직을 원본과 분리하려고 씁니다.');
    expect(document.body.textContent).toContain('횡단 관심사를 여러 원본 메서드에 반복하지 않게 합니다.');
    // 실제 자산은 호스트/보고서에서 다루며, 사이드패널은 로컬 경로를 노출하지 않습니다.
    expect(document.body.textContent).not.toContain('frames/synthetic-frame');

    click(buttonNamed('뒤로'));
    expect(document.body.textContent).toContain('지난 AOP 수업');
    expect(document.body.textContent).toContain('자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요');
  });

  it('호스트가 꺼져도 현재 기록은 남고 지난 세션 자리만 연결 안내를 보입니다', async () => {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    store.goto('answer');
    const unavailable: SessionHistoryClient = {
      list: async () => ({ status: 'error', reason: 'host-unavailable' }),
      getSummary: async () => ({ status: 'error', reason: 'host-unavailable' }),
      getBundle: async () => ({ status: 'error', reason: 'host-unavailable' }),
    };
    mount(
      <PanelApp
        store={store}
        autoClock={false}
        settings={createMemorySettingsStorage()}
        sessionHistory={unavailable}
      />,
    );
    await flush();
    click(buttonNamed('기록'));
    await flush();

    expect(document.body.textContent).toContain('자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요');
    expect(document.body.textContent).toContain('로컬 도우미에 연결되면 지난 기록을 불러올 수 있어요.');
    expect(buttonNamed('다시 불러오기')).not.toBeNull();
  });

  it('상세 읽기 오류에서 같은 세션을 다시 시도해 성공 화면으로 바꿉니다', async () => {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    let bundleCalls = 0;
    const retrying: SessionHistoryClient = {
      list: async () => ({ status: 'ok', value: [SUMMARY] }),
      getSummary: async () => ({ status: 'ok', value: SUMMARY }),
      getBundle: async () => {
        bundleCalls += 1;
        return bundleCalls === 1
          ? { status: 'error', reason: 'read-failed' }
          : { status: 'ok', value: BUNDLE };
      },
    };
    mount(
      <PanelApp
        store={store}
        autoClock={false}
        settings={createMemorySettingsStorage()}
        sessionHistory={retrying}
      />,
    );
    await flush();
    click(buttonNamed('기록'));
    await flush();
    click(buttonNamed('지난 AOP 수업'));
    await flush();

    expect(document.body.textContent).toContain('로컬 기록을 읽지 못했어요.');
    click(buttonNamed('다시 시도'));
    await flush();

    expect(bundleCalls).toBe(2);
    expect(document.body.textContent).toContain('프록시는 원본 객체 앞에서 요청을 받습니다.');
  });

  it('상세에서 뒤로 간 뒤 다시 연 새 요청을 늦은 옛 결과가 덮지 못합니다', async () => {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    const firstBundle = deferred<SessionHistoryResult<SessionBundleV2>>();
    let bundleCalls = 0;
    const staleAware: SessionHistoryClient = {
      list: async () => ({ status: 'ok', value: [SUMMARY] }),
      getSummary: async () => ({ status: 'ok', value: SUMMARY }),
      getBundle: async () => {
        bundleCalls += 1;
        return bundleCalls === 1 ? firstBundle.promise : { status: 'ok', value: BUNDLE };
      },
    };
    mount(
      <PanelApp
        store={store}
        autoClock={false}
        settings={createMemorySettingsStorage()}
        sessionHistory={staleAware}
      />,
    );
    await flush();
    click(buttonNamed('기록'));
    await flush();
    click(buttonNamed('지난 AOP 수업'));
    await flush();
    expect(document.body.textContent).toContain('불러오고 있어요.');

    click(buttonNamed('뒤로'));
    click(buttonNamed('지난 AOP 수업'));
    await flush();
    expect(document.body.textContent).toContain('프록시는 원본 객체 앞에서 요청을 받습니다.');

    firstBundle.resolve({
      status: 'ok',
      value: {
        ...BUNDLE,
        title: '늦게 온 옛 요청',
        summary: { ...SUMMARY, title: '늦게 온 옛 요청' },
        moments: [{ ...BUNDLE.moments[0]!, text: '늦은 응답이 화면을 덮었습니다.' }],
      },
    });
    await flush();

    expect(document.body.textContent).toContain('지난 AOP 수업');
    expect(document.body.textContent).not.toContain('늦게 온 옛 요청');
    expect(document.body.textContent).not.toContain('늦은 응답이 화면을 덮었습니다.');
  });

  it('생성된 다섯 활동은 SQLite 저장 ACK 뒤에만 복습 화면으로 채택합니다', async () => {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    const saving = deferred<SessionHistoryResult<ActivitySetV2>>();
    let requested: ActivitySetV2 | undefined;
    const history: SessionHistoryClient = {
      ...client([]),
      saveActivities: async (_sessionId, activities) => {
        requested = activities;
        return saving.promise;
      },
    };
    mount(
      <PanelApp
        store={store}
        autoClock={false}
        settings={createMemorySettingsStorage()}
        sessionHistory={history}
      />,
    );
    await flush();
    click(buttonNamed('기록'));
    await flush();
    click(buttonNamed('지난 AOP 수업'));
    await flush();
    click(buttonNamed('5단계 복습 만들기'));
    await flush();

    expect(requested).toHaveLength(5);
    expect(document.body.textContent).toContain('복습을 로컬에 저장하는 중');
    expect(document.body.textContent).not.toContain(requested![0].prompt);
    expect(document.body.innerHTML).not.toContain(requested![0].answer);

    saving.resolve({ status: 'ok', value: requested! });
    await flush();
    expect(document.body.textContent).toContain(requested![0].prompt);
    // 카드 자체가 저장돼도 첫 시도 전에는 모범 답을 DOM에 넣지 않습니다.
    expect(document.body.innerHTML).not.toContain(requested![0].answer);
  });

  it('읽기 전용 설치판과 1~4개 중간 묶음은 생성하거나 덮어쓰지 않습니다', async () => {
    const store = new ReplayStore(GOLDEN_BUNDLE);
    mount(
      <PanelApp
        store={store}
        autoClock={false}
        settings={createMemorySettingsStorage()}
        sessionHistory={client([])}
      />,
    );
    await flush();
    click(buttonNamed('기록'));
    await flush();
    click(buttonNamed('지난 AOP 수업'));
    await flush();
    click(buttonNamed('5단계 복습 만들기'));
    expect(document.body.textContent).toContain('현재 설치판은 복습 저장 기능이 없습니다.');

    act(() => root?.unmount());
    root = null;
    host?.remove();
    host = null;

    let saveCalls = 0;
    const partial = {
      ...BUNDLE,
      activities: [
        {
          id: 'partial-recall',
          slot: 'RECALL' as const,
          kind: 'question' as const,
          prompt: '중간 저장',
          evidenceRefIds: ['moment-transcript'],
          hints: [],
          answer: '덮어쓰면 안 됨',
          attempts: [],
        },
      ],
    };
    const partialClient: SessionHistoryClient = {
      list: async () => ({ status: 'ok', value: [SUMMARY] }),
      getSummary: async () => ({ status: 'ok', value: SUMMARY }),
      getBundle: async () => ({ status: 'ok', value: partial }),
      saveActivities: async (_sessionId, activities) => {
        saveCalls += 1;
        return { status: 'ok', value: activities };
      },
    };
    mount(
      <PanelApp
        store={new ReplayStore(GOLDEN_BUNDLE)}
        autoClock={false}
        settings={createMemorySettingsStorage()}
        sessionHistory={partialClient}
      />,
    );
    await flush();
    click(buttonNamed('기록'));
    await flush();
    click(buttonNamed('지난 AOP 수업'));
    await flush();
    expect(document.body.textContent).toContain('복습 준비가 아직 끝나지 않아 열 수 없어요.');
    expect(saveCalls).toBe(0);
    expect([...document.querySelectorAll('button')].some((button) => button.textContent?.includes('복습 만들기'))).toBe(false);
  });

  it('실제 근거가 없는 빈 세션에서는 활동을 지어내거나 저장하지 않습니다', async () => {
    let saveCalls = 0;
    const emptyBundle: SessionBundleV2 = {
      ...BUNDLE,
      sources: [],
      moments: [],
      activities: [],
      artifacts: [],
    };
    const history: SessionHistoryClient = {
      list: async () => ({ status: 'ok', value: [SUMMARY] }),
      getSummary: async () => ({ status: 'ok', value: SUMMARY }),
      getBundle: async () => ({ status: 'ok', value: emptyBundle }),
      saveActivities: async (_sessionId, activities) => {
        saveCalls += 1;
        return { status: 'ok', value: activities };
      },
    };
    mount(
      <PanelApp
        store={new ReplayStore(GOLDEN_BUNDLE)}
        autoClock={false}
        settings={createMemorySettingsStorage()}
        sessionHistory={history}
      />,
    );
    await flush();
    click(buttonNamed('기록'));
    await flush();
    click(buttonNamed('지난 AOP 수업'));
    await flush();
    click(buttonNamed('5단계 복습 만들기'));
    expect(document.body.textContent).toContain('이 기록에는 5단계 복습을 만들 실제 근거가 없습니다.');
    expect(saveCalls).toBe(0);
  });

  it('A 세션의 늦은 생성 ACK가 뒤에 연 B 세션이나 그 DOM을 덮지 못합니다', async () => {
    const summaryB: SessionSummaryV2 = {
      ...SUMMARY,
      sessionId: 'session-2026-09-04-p1',
      legacyPeriodId: '2026-09-04-p1',
      title: 'B 세션',
      startedAt: '2026-09-04T16:00:00+09:00',
      lastAt: '2026-09-04T16:50:00+09:00',
    };
    const bundleB: SessionBundleV2 = {
      ...BUNDLE,
      sessionId: summaryB.sessionId,
      legacyPeriodId: '2026-09-04-p1',
      title: 'B 세션',
      startedAt: '2026-09-04T16:00:00+09:00',
      summary: summaryB,
      moments: [{ ...BUNDLE.moments[0]!, id: 'moment-b', text: 'B 세션 전사만 보여야 합니다.' }],
    };
    const delayedA = deferred<SessionHistoryResult<ActivitySetV2>>();
    let activitiesA: ActivitySetV2 | undefined;
    const history: SessionHistoryClient = {
      list: async () => ({ status: 'ok', value: [summaryB, SUMMARY] }),
      getSummary: async (sessionId) => ({
        status: 'ok',
        value: sessionId === SUMMARY.sessionId ? SUMMARY : summaryB,
      }),
      getBundle: async (sessionId) => ({
        status: 'ok',
        value: sessionId === SUMMARY.sessionId ? BUNDLE : bundleB,
      }),
      saveActivities: async (_sessionId, activities) => {
        activitiesA = activities;
        return delayedA.promise;
      },
    };
    mount(
      <PanelApp
        store={new ReplayStore(GOLDEN_BUNDLE)}
        autoClock={false}
        settings={createMemorySettingsStorage()}
        sessionHistory={history}
      />,
    );
    await flush();
    click(buttonNamed('기록'));
    await flush();
    click(buttonNamed('지난 AOP 수업'));
    await flush();
    click(buttonNamed('5단계 복습 만들기'));
    await flush();
    click(buttonNamed('뒤로'));
    click(buttonNamed('B 세션'));
    await flush();
    expect(document.body.textContent).toContain('B 세션 전사만 보여야 합니다.');

    delayedA.resolve({ status: 'ok', value: activitiesA! });
    await flush();
    expect(document.body.textContent).toContain('B 세션 전사만 보여야 합니다.');
    expect(document.body.textContent).not.toContain(activitiesA![0].prompt);
  });
});
