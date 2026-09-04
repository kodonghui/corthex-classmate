import { describe, expect, it } from 'vitest';

import {
  releaseIdentityFromManifest,
  releaseIdentityFromRuntime,
} from './release-identity';

describe('설치된 확장 빌드 식별자', () => {
  it('같은 숫자판의 유효한 version_name을 우선합니다', () => {
    expect(
      releaseIdentityFromManifest({ version: '0.0.3', version_name: '0.0.3+gabcdef12345' }),
    ).toBe('0.0.3+gabcdef12345');
    expect(
      releaseIdentityFromManifest({ version: '0.0.3', version_name: '0.0.3+gabcdef1.dirty' }),
    ).toBe('0.0.3+gabcdef1.dirty');
  });

  it('표시판이 없거나 다른 숫자판·깨진 형식이면 유효한 version으로 되돌립니다', () => {
    expect(releaseIdentityFromManifest({ version: '0.0.3' })).toBe('0.0.3');
    expect(
      releaseIdentityFromManifest({ version: '0.0.3', version_name: '0.0.2+gabcdef1' }),
    ).toBe('0.0.3');
    expect(
      releaseIdentityFromManifest({ version: '0.0.3', version_name: '<img onerror=private>' }),
    ).toBe('0.0.3');
  });

  it('숫자판 자체가 없거나 Chrome 규칙을 어기면 표시하지 않습니다', () => {
    for (const manifest of [null, [], {}, { version: '0.0.0' }, { version: '0.0.3-beta' }]) {
      expect(releaseIdentityFromManifest(manifest)).toBeNull();
    }
  });

  it('runtime이 없거나 실패해도 오류·manifest의 다른 필드를 밖으로 내보내지 않습니다', () => {
    expect(releaseIdentityFromRuntime(undefined)).toBeNull();
    expect(
      releaseIdentityFromRuntime({
        getManifest: () => {
          throw new Error('C:\\Users\\private\\extension');
        },
      }),
    ).toBeNull();
    expect(
      releaseIdentityFromRuntime({
        getManifest: () => ({
          version: '0.0.3',
          name: 'PRIVATE_NAME',
          homepage_url: 'file:///C:/Users/private',
        }),
      }),
    ).toBe('0.0.3');
  });
});
