import { describe, expect, it } from 'vitest';

import type { SessionAreaLike } from './session-area';
import {
  LESSON_TAB_STORAGE_KEY,
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
