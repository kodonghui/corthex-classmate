import { describe, expect, it } from 'vitest';

import { normalizeSettings as normalizePanelSettings, SETTINGS_KEYS } from '../panel/settings-store';
import {
  createStorageSettings,
  normalizeSettings,
  SESSION_PROFILE_STORAGE_KEY,
} from './settings';

describe('background 설정 · 세션 프로필', () => {
  it.each(['class', 'exam', 'meeting'] as const)('패널과 같은 %s 값을 정규화합니다', (profile) => {
    const raw = { [SESSION_PROFILE_STORAGE_KEY]: profile };
    expect(normalizeSettings(raw).profile).toBe(profile);
    expect(normalizePanelSettings(raw).profile).toBe(profile);
  });

  it.each([undefined, null, 'conference', 1, {}])('legacy/깨진 값 %j은 양쪽 모두 class입니다', (profile) => {
    const raw = profile === undefined ? {} : { [SESSION_PROFILE_STORAGE_KEY]: profile };
    expect(normalizeSettings(raw).profile).toBe('class');
    expect(normalizePanelSettings(raw).profile).toBe('class');
  });

  it('저장소에서 profile 키를 함께 읽고 실패하면 class 기본값을 돌려줍니다', async () => {
    const asked: string[][] = [];
    const source = createStorageSettings({
      get: (keys) => {
        asked.push(keys);
        return Promise.resolve({ [SESSION_PROFILE_STORAGE_KEY]: 'meeting' });
      },
    });

    await expect(source.read()).resolves.toMatchObject({ profile: 'meeting' });
    expect(asked[0]).toContain(SETTINGS_KEYS.profile);

    const failed = createStorageSettings({ get: () => Promise.reject(new Error('storage failed')) });
    await expect(failed.read()).resolves.toMatchObject({ profile: 'class' });
  });
});
