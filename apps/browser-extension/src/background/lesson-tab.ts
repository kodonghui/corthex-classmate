/**
 * 학습자가 고른 「수업 화면 탭」을 브라우저 세션 동안 기억합니다.
 *
 * 확장 아이콘을 누른 탭은 `activeTab` 임시 권한을 얻습니다. 그 권한은 탭을 닫거나 다른
 * 사이트로 이동하면 사라지므로, 선택도 같은 수명의 `chrome.storage.session` 에만 둡니다.
 * `storage.local` 로 물러서지 않습니다 — 수업 탭 선택을 디스크에 오래 남길 이유가 없습니다.
 *
 * 이 파일은 Chrome 전역을 직접 읽지 않습니다. `{get, set}` 만 주입받아 서비스 워커 밖의
 * Vitest 에서 저장·복원·깨진 값 거절을 모두 확인할 수 있습니다.
 */

import type { SessionAreaLike } from './session-area';

/** `chrome.storage.session` 에 쓰는 유일한 키입니다. */
export const LESSON_TAB_STORAGE_KEY = 'classmate.lessonTab';

/** 사용자가 수업 화면으로 고른 탭의 최소 정보입니다. 주소와 제목은 보관하지 않습니다. */
export interface LessonTab {
  readonly tabId: number;
  readonly windowId: number;
  /** 선택한 시각의 Unix 밀리초입니다. 화면에 탭 주소나 제목 대신 이 숫자만 남깁니다. */
  readonly at: number;
}

/**
 * 수업 화면 탭을 기억합니다.
 *
 * @returns `storage.session` 이 없어 저장하지 못했으면 `false`, 저장했으면 `true`.
 */
export async function rememberLessonTab(
  store: SessionAreaLike | null,
  lessonTab: LessonTab,
): Promise<boolean> {
  if (!isLessonTab(lessonTab)) throw new RangeError('수업 화면 탭 값이 올바르지 않아요');
  if (store === null) return false;
  await store.set({
    [LESSON_TAB_STORAGE_KEY]: {
      tabId: lessonTab.tabId,
      windowId: lessonTab.windowId,
      at: lessonTab.at,
    } satisfies LessonTab,
  });
  return true;
}

/** 저장된 수업 화면 탭을 읽습니다. 오래되거나 깨진 값은 쓰지 않고 `null` 로 돌립니다. */
export async function readLessonTab(store: SessionAreaLike | null): Promise<LessonTab | null> {
  if (store === null) return null;
  const bag = await store.get(LESSON_TAB_STORAGE_KEY);
  const value = bag[LESSON_TAB_STORAGE_KEY];
  if (!isLessonTab(value)) return null;
  return { tabId: value.tabId, windowId: value.windowId, at: value.at };
}

/** 선택을 잊습니다. 주입 얼굴을 `{get, set}` 두 메서드로 유지하려고 `null` 을 씁니다. */
export async function forgetLessonTab(store: SessionAreaLike | null): Promise<boolean> {
  if (store === null) return false;
  await store.set({ [LESSON_TAB_STORAGE_KEY]: null });
  return true;
}

/** 저장소에서 온 `unknown` 을 주소 없는 안전한 세 칸으로 좁힙니다. */
function isLessonTab(value: unknown): value is LessonTab {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    isChromeId(candidate['tabId']) &&
    isChromeId(candidate['windowId']) &&
    typeof candidate['at'] === 'number' &&
    Number.isFinite(candidate['at']) &&
    candidate['at'] >= 0
  );
}

/** Chrome 탭·창 id 는 0 이상의 정수입니다. */
function isChromeId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
