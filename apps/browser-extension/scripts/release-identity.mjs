// Chrome 확장의 사람이 읽는 빌드 식별자를 만드는 순수 함수 모음입니다.
//
// 파일·Git·환경 변수를 직접 읽지 않습니다. 같은 입력에는 언제나 같은 결과만 돌려주므로
// WXT 설정과 Windows 패키저가 한 규칙을 공유하면서도 단위시험은 외부 상태 없이 돕니다.

/** WXT 설정에 검증된 version_name 을 건네는 환경 변수입니다. */
export const VERSION_NAME_ENV = 'CLASSMATE_EXTENSION_VERSION_NAME';

const COMMIT_PATTERN = /^[0-9a-f]{7,12}$/u;

/** Chrome manifest `version` 규칙(1~4개의 0..65535 정수)을 검사합니다. */
export function assertChromeVersion(value) {
  if (typeof value !== 'string') throw new Error('확장 package.json version 이 문자열이 아니에요.');

  const parts = value.split('.');
  const valid =
    parts.length >= 1 &&
    parts.length <= 4 &&
    parts.every((part) => /^(0|[1-9][0-9]*)$/u.test(part) && Number(part) <= 65_535) &&
    parts.some((part) => Number(part) !== 0);

  if (!valid) {
    throw new Error('확장 version 은 1~4개의 점 구분 정수(각 0..65535, 전부 0 아님)여야 해요.');
  }
  return value;
}

/** 짧은 Git commit 과 dirty 여부를 Chrome 표시용 `version_name` 으로 만듭니다. */
export function makeVersionName({ version, commit, dirty }) {
  const safeVersion = assertChromeVersion(version);
  if (typeof commit !== 'string' || !COMMIT_PATTERN.test(commit)) {
    throw new Error('빌드 commit 은 7~12자의 소문자 16진수여야 해요.');
  }
  if (typeof dirty !== 'boolean') throw new Error('dirty 표시는 boolean 이어야 해요.');

  return `${safeVersion}+g${commit}${dirty ? '.dirty' : ''}`;
}

/** 외부 환경에서 받은 `version_name` 이 우리가 만드는 형식과 정확히 같은지 검사합니다. */
export function assertVersionName(version, value) {
  const safeVersion = assertChromeVersion(version);
  if (typeof value !== 'string') throw new Error('확장 version_name 이 문자열이 아니에요.');

  const suffix = value.startsWith(`${safeVersion}+g`) ? value.slice(safeVersion.length + 2) : '';
  const commit = suffix.endsWith('.dirty') ? suffix.slice(0, -6) : suffix;
  const dirtySuffixIsValid = suffix === commit || suffix === `${commit}.dirty`;
  if (!dirtySuffixIsValid || !COMMIT_PATTERN.test(commit)) {
    throw new Error('확장 version_name 이 <version>+g<commit>[.dirty] 형식이 아니에요.');
  }
  return value;
}

/** Git porcelain 출력은 내용이 아니라 비어 있는지만 보고 dirty 로 바꿉니다. */
export function dirtyFromPorcelain(value) {
  if (typeof value !== 'string') throw new Error('Git 상태 출력이 문자열이 아니에요.');
  return value.trim().length > 0;
}

function shown(value) {
  return typeof value === 'string' && value.length > 0 ? value : '(없음)';
}

/** dev/store ZIP이 package 정본의 version과 version_name을 함께 담았는지 판정합니다. */
export function releaseIdentityVerdict({ expectedVersion, expectedVersionName, dev, store }) {
  const version = assertChromeVersion(expectedVersion);
  const versionName = assertVersionName(version, expectedVersionName);
  const lines = [];

  for (const [label, manifest] of [
    ['dev', dev],
    ['store', store],
  ]) {
    if (manifest?.version !== version) {
      lines.push(`실패       ${label} zip version=${shown(manifest?.version)} · package=${version}`);
    }
    if (manifest?.versionName !== versionName) {
      lines.push(`실패       ${label} zip version_name=${shown(manifest?.versionName)} · 기대=${versionName}`);
    }
  }

  if (lines.length > 0) return { code: 1, lines };
  return { code: 0, lines: [`확인       version=${version} · version_name=${versionName}`] };
}
