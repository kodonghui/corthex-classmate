/**
 * 서비스 워커가 내려갔다 떠도 잃지 않을 것을 **어디에 적을지** 고릅니다.
 *
 * 답은 `chrome.storage.session` 하나뿐입니다. 이 자리는 브라우저를 닫으면 사라지고 디스크에
 * 적히지 않아 수업 데이터를 담기에 알맞습니다(불변 원칙 §4-1 「수업 데이터는 로컬 정본,
 * 디스크에 남기는 자리는 호스트 SQLite 뿐」).
 *
 * **`chrome.storage.local` 로 물러서지 않습니다.** 물러서면 전사 본문 500건이 조용히 디스크에
 * 남습니다. `session` 이 없는 자리(아주 오래된 Chrome)에서는 복원을 포기하는 편이 낫습니다.
 * 잃는 것은 "패널을 닫았다 열면 화면이 백지" 하나이고, 얻는 것은 원칙 하나입니다.
 */

/** 저장소 한 칸에서 우리가 쓰는 부분만입니다. `chrome.storage.session` 이 이 모양입니다. */
export interface SessionAreaLike {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

/** `chrome.storage` 에서 우리가 보는 부분만입니다. */
export interface StorageNamespaceLike {
  session?: SessionAreaLike | undefined;
  local?: SessionAreaLike | undefined;
}

/**
 * 옮겨 적을 자리를 고릅니다.
 *
 * @returns `session` 이 있으면 그것, 없으면 **null**(복원을 포기합니다).
 */
export function pickSessionArea(storage: StorageNamespaceLike | undefined): SessionAreaLike | null {
  return storage?.session ?? null;
}
