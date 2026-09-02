/**
 * Tiro 공유 페이지 주소 판별.
 *
 * 왜 파일을 따로 두나: 이 판별을 두 곳이 씁니다 — `index.ts`(커넥터를 어디에 붙일지)와
 * `lifecycle.ts`(주소가 바뀌었을 때 시작할지 멈출지). `index.ts` 에 두면
 * `lifecycle.ts` → `index.ts` → `lifecycle.ts` 로 도는 순환 import 가 생기므로,
 * 주소 지식만 여기 모아 두고 양쪽이 이 파일을 봅니다.
 *
 * 밖으로는 `index.ts` 가 그대로 다시 내보내므로 부르는 쪽의 import 경로는 바뀌지 않습니다.
 */

/**
 * 공유 페이지 호스트입니다.
 *
 * 실측 경로 모양은 `tiro.ooo/<로케일>/s/<공유 id>` 입니다(docs/master-prompt.md §2-3).
 * **특정 공유 id 와 비밀번호는 코드에 넣지 않습니다** — 호스트와 경로 모양만 둡니다.
 */
export const TIRO_SHARE_HOST = 'tiro.ooo';

/** content script 가 붙을 곳입니다. 실제 활성화 여부는 `isSharePageUrl` 이 다시 거릅니다. */
export const TIRO_SHARE_MATCHES = ['https://tiro.ooo/*'] as const;

/**
 * 이 주소가 Tiro 공유 페이지인지입니다.
 *
 * 경로 조각에 `s` 가 있고 그 뒤에 조각이 하나 더 있으면 공유 페이지로 봅니다
 * (`/ko/s/<id>` · `/s/<id>` 둘 다). 로그인·설정 같은 다른 페이지에서는 붙지 않습니다.
 */
export function isSharePageUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.hostname !== TIRO_SHARE_HOST) return false;

  const parts = url.pathname.split('/').filter((part) => part.length > 0);
  const shareAt = parts.indexOf('s');
  return shareAt !== -1 && parts.length > shareAt + 1;
}
