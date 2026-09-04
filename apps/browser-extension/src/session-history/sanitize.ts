/** Native Host의 사람이 읽는 문자열에서 로컬 경로와 비밀 주소를 숨깁니다. */

/** 민감한 원문 대신 화면에 쓰는 고정 문구입니다. 원문의 일부도 이어 붙이지 않습니다. */
export const HIDDEN_SENSITIVE_HISTORY_TEXT = '민감한 정보가 포함된 기록 문구를 숨겼어요.';

const WINDOWS_DRIVE_PATH = /(?:^|[^A-Za-z0-9+.-])[A-Za-z]:[\\/]/u;
const WINDOWS_BACKSLASH_UNC_PATH = /(?:^|[^A-Za-z0-9])\\\\[^\\/\s]+[\\/][^\r\n]*/u;
const WINDOWS_FORWARD_UNC_PATH = /(?:^|[^A-Za-z0-9+./:-])\/\/[^/\s]+\/[^\r\n]*/u;
const WINDOWS_ROOTED_PATH = /(?:^|[^A-Za-z0-9])\\(?![\\\s])[^\\/\r\n]+[\\/][^\r\n]+/u;
const FILE_URI = /\bfile:\/\/[^\s]*/iu;
// URL의 `//`나 `example.test/path`는 건드리지 않되, Markdown 구두점이나 한국어 문장에
// 바로 붙은 `/home/...` 같은 절대 경로도 놓치지 않습니다.
const POSIX_ABSOLUTE_PATH =
  /(?:^|[^A-Za-z0-9+./-])\/(?![\/\s])(?:[^/\s"'<>]+\/)*[^/\s"'<>]+/u;
// lookahead로 모든 시작점을 훑습니다. 바깥 URL의 query 안에 Tiro URL이 중첩되어도
// 앞의 긴 URL 하나가 뒤의 시작점을 삼키지 않게 하기 위함입니다.
const URL_CANDIDATE = /(?=(https?:\/\/[^\s"'<>]+))/giu;
const MAX_PERCENT_DECODE_ROUNDS = 12;

function decodedText(text: string): string {
  // decodeURIComponent는 `%ZZ` 하나만 섞여도 정상 `%2F`까지 전부 포기합니다. 감지 전용
  // 문자열이므로 유효한 octet을 낱개로 풀어 경로 구분자와 URL 문법을 확실히 드러냅니다.
  return text.replace(/%([0-9A-Fa-f]{2})/gu, (_matched, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

function containsSensitiveUrl(text: string): boolean {
  URL_CANDIDATE.lastIndex = 0;
  for (const matched of text.matchAll(URL_CANDIDATE)) {
    const candidate = matched[1];
    if (candidate === undefined) continue;
    try {
      const url = new URL(candidate);
      if (url.username.length > 0 || url.password.length > 0) return true;
      const hostname = url.hostname.toLowerCase().replace(/\.$/u, '');
      if (hostname !== 'tiro.ooo' && hostname !== 'www.tiro.ooo') continue;
      const parts = decodedText(url.pathname).split('/').filter((part) => part.length > 0);
      const shareAt = parts.indexOf('s');
      if (shareAt !== -1 && parts.length > shareAt + 1) return true;
    } catch {
      // URL처럼 보였지만 해석할 수 없으면 다른 민감 모양 검사를 계속합니다.
    }
  }
  return false;
}

const EXACT_SECRET_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'secret',
  'client_secret',
  'password',
  'passwd',
  'pwd',
  'api_key',
  'apikey',
  'authorization',
  'auth',
  'credential',
  'credentials',
  'signature',
  'sig',
  'code',
  'jwt',
  'key',
]);

function isSecretQueryKey(rawKey: string): boolean {
  const key = decodedText(rawKey).toLowerCase().replaceAll('-', '_');
  if (EXACT_SECRET_QUERY_KEYS.has(key)) return true;
  if (/(?:^|_)(?:token|secret|password|passwd|pwd|api_key|auth|authorization|credential|signature|sig|jwt|key)$/u.test(key)) {
    return true;
  }
  return /^(?:access|refresh|share|session|client|api|auth|oauth)(?:token|secret|code|key)$/u.test(key);
}

function containsTokenQuery(text: string): boolean {
  for (const matched of text.matchAll(/[?&#]([^\s&#=]+)=/gu)) {
    const key = matched[1] ?? '';
    if (isSecretQueryKey(key)) return true;
  }
  return false;
}

function containsSensitiveMetadata(text: string): boolean {
  return (
    WINDOWS_DRIVE_PATH.test(text) ||
    WINDOWS_BACKSLASH_UNC_PATH.test(text) ||
    WINDOWS_FORWARD_UNC_PATH.test(text) ||
    WINDOWS_ROOTED_PATH.test(text) ||
    FILE_URI.test(text) ||
    POSIX_ABSOLUTE_PATH.test(text) ||
    containsSensitiveUrl(text) ||
    containsTokenQuery(text)
  );
}

/**
 * 문자열 하나에 민감한 모양이 하나라도 있으면 부분 가림 대신 문장 전체를 고정 문구로 바꿉니다.
 * 부분만 지우면 경로 조각·공유 id·query 값이 주변 문맥에 남을 수 있기 때문입니다.
 */
export function sanitizeHistoryDisplayText(text: string): string {
  // Native Messaging 한도에 가까운 한 줄을 반복 디코딩하지 않습니다. 화면에도 쓸모 없는
  // 크기이며, 안전 쪽으로 고정 문구를 택합니다.
  if (text.length > 16_384) return HIDDEN_SENSITIVE_HISTORY_TEXT;
  let candidate = text;
  for (let round = 0; round <= MAX_PERCENT_DECODE_ROUNDS; round += 1) {
    if (containsSensitiveMetadata(candidate)) return HIDDEN_SENSITIVE_HISTORY_TEXT;
    const decoded = decodedText(candidate);
    if (decoded === candidate) return text;
    if (round === MAX_PERCENT_DECODE_ROUNDS) {
      // 더 깊은 인코딩은 내용과 무관하게 숨깁니다. 무제한 디코딩으로 패널을 멈추게 하지 않습니다.
      return HIDDEN_SENSITIVE_HISTORY_TEXT;
    }
    candidate = decoded;
  }
  return HIDDEN_SENSITIVE_HISTORY_TEXT;
}

export function sanitizeHistoryDisplayTexts(values: readonly string[]): string[] {
  return values.map(sanitizeHistoryDisplayText);
}
