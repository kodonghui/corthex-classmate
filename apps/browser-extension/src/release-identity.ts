/**
 * 지금 실행 중인 확장의 사람이 읽는 빌드 식별자만 꺼냅니다.
 *
 * 이름·URL·설치 경로 같은 다른 manifest 값은 읽지 않고, 오류도 로그로 남기지 않습니다.
 * 플랫폼 접근은 sidepanel App 한 곳에서 이 함수를 부르는 것으로 끝냅니다.
 */

export interface ReleaseManifestRuntime {
  readonly getManifest: () => unknown;
}

const CHROME_VERSION_PART = /^(0|[1-9][0-9]*)$/u;
const BUILD_COMMIT = /^[0-9a-f]{7,12}(?:\.dirty)?$/u;

function chromeVersion(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parts = value.split('.');
  if (
    parts.length < 1 ||
    parts.length > 4 ||
    !parts.every((part) => CHROME_VERSION_PART.test(part) && Number(part) <= 65_535) ||
    !parts.some((part) => Number(part) !== 0)
  ) {
    return null;
  }
  return value;
}

function manifestRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** 유효한 우리 `version_name`을 우선하고, 없거나 깨졌으면 숫자 `version`으로 되돌립니다. */
export function releaseIdentityFromManifest(manifest: unknown): string | null {
  const record = manifestRecord(manifest);
  if (record === null) return null;
  const version = chromeVersion(record['version']);
  if (version === null) return null;

  const versionName = record['version_name'];
  if (typeof versionName !== 'string' || !versionName.startsWith(`${version}+g`)) return version;
  const build = versionName.slice(version.length + 2);
  return BUILD_COMMIT.test(build) ? versionName : version;
}

/** 시험에서는 작은 가짜 runtime을 주입하고, 실제 앱에서는 `chrome.runtime`만 건넵니다. */
export function releaseIdentityFromRuntime(runtime: ReleaseManifestRuntime | undefined): string | null {
  if (runtime === undefined) return null;
  try {
    return releaseIdentityFromManifest(runtime.getManifest());
  } catch {
    return null;
  }
}

/** Node 단위시험처럼 Chrome 전역이 없는 곳에서도 조용히 `null`을 돌려줍니다. */
export function detectInstalledReleaseIdentity(): string | null {
  if (typeof chrome === 'undefined') return null;
  return releaseIdentityFromRuntime(chrome.runtime);
}
