import { describe, expect, it } from 'vitest';

import type { SessionAreaLike } from './session-area';
import {
  LESSON_TAB_STORAGE_KEY,
  LessonTabSelection,
  forgetLessonTab,
  readLessonTab,
  rememberLessonTab,
} from './lesson-tab';

function memoryStore(initial: Record<string, unknown> = {}): {
  readonly area: SessionAreaLike;
  readonly values: Record<string, unknown>;
} {
  const values = { ...initial };
  return {
    values,
    area: {
      get: async (keys) => {
        const wanted = typeof keys === 'string' ? [keys] : keys;
        return Object.fromEntries(wanted.map((key) => [key, values[key]]));
      },
      set: async (items) => {
        Object.assign(values, items);
      },
    },
  };
}

describe('수업 화면 탭 저장', () => {
  it('주소와 제목 없이 탭·창·시각만 저장하고 다시 읽습니다', async () => {
    const store = memoryStore();
    const lessonTab = {
      tabId: 17,
      windowId: 3,
      at: 1_788_477_600_000,
      url: 'https://private.example/class',
      title: '비밀 수업',
    };

    expect(await rememberLessonTab(store.area, lessonTab)).toBe(true);
    expect(store.values[LESSON_TAB_STORAGE_KEY]).toEqual({
      tabId: 17,
      windowId: 3,
      at: 1_788_477_600_000,
    });
    expect(await readLessonTab(store.area)).toEqual({
      tabId: 17,
      windowId: 3,
      at: 1_788_477_600_000,
    });
  });

  it('storage.session 이 없으면 local 로 물러서지 않고 선택을 포기합니다', async () => {
    expect(await rememberLessonTab(null, { tabId: 17, windowId: 3, at: 1 })).toBe(false);
    expect(await readLessonTab(null)).toBeNull();
    expect(await forgetLessonTab(null)).toBe(false);
  });

  it.each([
    null,
    '17',
    { tabId: -1, windowId: 3, at: 1 },
    { tabId: 17.5, windowId: 3, at: 1 },
    { tabId: 17, windowId: '3', at: 1 },
    { tabId: 17, windowId: 3, at: Number.NaN },
    { tabId: 17, windowId: 3, at: -1 },
  ])('깨진 저장값 %j 은 수업 화면으로 쓰지 않습니다', async (value) => {
    const store = memoryStore({ [LESSON_TAB_STORAGE_KEY]: value });
    expect(await readLessonTab(store.area)).toBeNull();
  });

  it('잊은 뒤에는 다시 읽히지 않습니다', async () => {
    const store = memoryStore({
      [LESSON_TAB_STORAGE_KEY]: { tabId: 17, windowId: 3, at: 1 },
    });

    expect(await forgetLessonTab(store.area)).toBe(true);
    expect(store.values[LESSON_TAB_STORAGE_KEY]).toBeNull();
    expect(await readLessonTab(store.area)).toBeNull();
  });

  it('새로 저장하려는 값도 검사합니다', async () => {
    const store = memoryStore();
    await expect(
      rememberLessonTab(store.area, { tabId: -1, windowId: 3, at: 1 }),
    ).rejects.toThrow(RangeError);
  });
});

describe('수업 화면 탭 최신 선택', () => {
  it('느린 복원이 끝나도 그사이 사용자가 고른 탭을 덮지 않습니다', async () => {
    let finishRead: ((value: Record<string, unknown>) => void) | undefined;
    const read = new Promise<Record<string, unknown>>((resolve) => {
      finishRead = resolve;
    });
    const values: Record<string, unknown> = {};
    const area: SessionAreaLike = {
      get: () => read,
      set: async (items) => {
        Object.assign(values, items);
      },
    };
    const selection = new LessonTabSelection(area);
    const restoring = selection.snapshot();

    const saving = selection.choose({ tabId: 22, windowId: 4, at: 2 });
    finishRead?.({ [LESSON_TAB_STORAGE_KEY]: { tabId: 11, windowId: 3, at: 1 } });

    await saving;
    expect(await restoring).toEqual({
      lessonTab: { tabId: 22, windowId: 4, at: 2 },
      revision: 1,
    });
    expect(values[LESSON_TAB_STORAGE_KEY]).toEqual({ tabId: 22, windowId: 4, at: 2 });
  });

  it('옛 캡처의 지우기 요청은 더 최근에 고른 탭을 지우지 않습니다', async () => {
    const store = memoryStore();
    const selection = new LessonTabSelection(store.area);
    await selection.choose({ tabId: 11, windowId: 3, at: 1 });
    const oldRevision = selection.revision;
    await selection.choose({ tabId: 22, windowId: 4, at: 2 });

    expect(await selection.clearIfRevision(oldRevision)).toBe(false);
    expect(await selection.snapshot()).toEqual({
      lessonTab: { tabId: 22, windowId: 4, at: 2 },
      revision: 2,
    });
  });

  it('앞 저장이 늦게 끝나도 저장소의 최종값은 마지막 선택입니다', async () => {
    let releaseFirst: (() => void) | undefined;
    let firstStarted: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const started = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const values: Record<string, unknown> = {};
    let writes = 0;
    const area: SessionAreaLike = {
      get: async () => ({}),
      set: async (items) => {
        writes += 1;
        if (writes === 1) {
          firstStarted?.();
          await firstGate;
        }
        Object.assign(values, items);
      },
    };
    const selection = new LessonTabSelection(area);
    const first = selection.choose({ tabId: 11, windowId: 3, at: 1 });
    await started;
    const second = selection.choose({ tabId: 22, windowId: 4, at: 2 });
    releaseFirst?.();

    await Promise.all([first, second]);
    expect(values[LESSON_TAB_STORAGE_KEY]).toEqual({ tabId: 22, windowId: 4, at: 2 });
  });
});
