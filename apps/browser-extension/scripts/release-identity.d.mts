export const VERSION_NAME_ENV: 'CLASSMATE_EXTENSION_VERSION_NAME';

export function assertChromeVersion(value: unknown): string;
export function makeVersionName(input: {
  readonly version: unknown;
  readonly commit: unknown;
  readonly dirty: unknown;
}): string;
export function assertVersionName(version: unknown, value: unknown): string;
export function dirtyFromPorcelain(value: unknown): boolean;

export interface ManifestReleaseIdentity {
  readonly version?: unknown;
  readonly versionName?: unknown;
}

export function releaseIdentityVerdict(input: {
  readonly expectedVersion: unknown;
  readonly expectedVersionName: unknown;
  readonly dev: ManifestReleaseIdentity | null | undefined;
  readonly store: ManifestReleaseIdentity | null | undefined;
}): { readonly code: 0 | 1; readonly lines: readonly string[] };
