/**
 * `chrome.storage.local` 에 든 세션 시작 설정을 **읽기만** 합니다.
 *
 * 값을 넣는 쪽은 설정 화면(단위 1a)입니다. 서비스 워커는 읽기만 하고, 값이 없거나 상했으면
 * 막지 않고 기본값으로 되돌립니다. 설정 한 칸 때문에 수업 기록이 통째로 멈추는 편이 더
 * 나쁘기 때문입니다(`src/tiro/period.ts` 의 `readPeriodNumber` 와 같은 태도입니다).
 *
 * | 키 | 뜻 | 기본값 |
 * |---|---|---|
 * | `classmate.periodNumber` | 지금 몇 교시인지 (1~8) | 1 |
 * | `classmate.profile` | 사용 목적 (`class | exam | meeting`) | `class` |
 * | `classmate.subject` | 과목 이름 | `"수업"` |
 * | `classmate.provider` | 어느 AI 에게 물을지 | `"claude"` |
 */

import type { Answer, SessionProfileV2 } from '@classmate/contracts';
import {
  DEFAULT_SESSION_PROFILE,
  normalizeSessionProfile,
  SESSION_PROFILE_STORAGE_KEY,
} from '../session-profile';
import { normalizePeriodNumber, PERIOD_NUMBER_STORAGE_KEY } from '../tiro/period';

export const SUBJECT_STORAGE_KEY = 'classmate.subject';
export const PROVIDER_STORAGE_KEY = 'classmate.provider';

export const DEFAULT_SUBJECT = '수업';
export const DEFAULT_PROVIDER: Answer['provider'] = 'claude';

/** 서비스 워커가 보는 설정 한 벌입니다. */
export interface ClassmateSettings {
  activeSessionId?: string;
  /** 새 `period.started`에 고정되는 사용 목적입니다. */
  profile: SessionProfileV2;
  /** 1~8. 교시 식별자를 만드는 데 씁니다. */
  periodNumber: number;
  /** `period.started` payload 의 `subject` 로 나갑니다. */
  subject: string;
  /** `tutor.ask` 봉투의 `provider` 기본값입니다. 패널이 값을 실어 보내면 그것이 이깁니다. */
  provider: Answer['provider'];
}

export const DEFAULT_SETTINGS: ClassmateSettings = {
  profile: DEFAULT_SESSION_PROFILE,
  periodNumber: 1,
  subject: DEFAULT_SUBJECT,
  provider: DEFAULT_PROVIDER,
};

/** 라우터가 보는 얼굴입니다. 시험은 이 모양만 흉내 내면 됩니다. */
export interface SettingsSource {
  read(): Promise<ClassmateSettings>;
}

/** `chrome.storage.local` 에서 우리가 쓰는 부분만 적었습니다. */
export interface StorageAreaLike {
  get(keys: string[]): Promise<Record<string, unknown>>;
}

function toProvider(value: unknown): Answer['provider'] {
  return value === 'codex' || value === 'claude' ? value : DEFAULT_PROVIDER;
}

function toSubject(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_SUBJECT;
  const trimmed = value.trim();
  return trimmed.length === 0 ? DEFAULT_SUBJECT : trimmed;
}

/** 값 하나짜리 묶음을 설정 한 벌로 고칩니다. 저장소 없이도 시험할 수 있게 따로 뒀습니다. */
export function normalizeSettings(bag: Record<string, unknown>): ClassmateSettings {
  return {
    ...(typeof bag['classmate.activeSessionId'] === 'string' && /^\d{4}-\d{2}-\d{2}-p[1-9]\d{0,18}$/.test(bag['classmate.activeSessionId']) ? { activeSessionId: bag['classmate.activeSessionId'] } : {}),
    profile: normalizeSessionProfile(bag[SESSION_PROFILE_STORAGE_KEY]),
    periodNumber: normalizePeriodNumber(bag[PERIOD_NUMBER_STORAGE_KEY]),
    subject: toSubject(bag[SUBJECT_STORAGE_KEY]),
    provider: toProvider(bag[PROVIDER_STORAGE_KEY]),
  };
}

/**
 * 저장소에서 읽는 설정 출처를 만듭니다.
 *
 * 읽기가 실패해도 던지지 않고 기본값을 돌려줍니다(확장 문맥이 방금 내려간 경우 등).
 */
export function createStorageSettings(area: StorageAreaLike): SettingsSource {
  return {
    async read(): Promise<ClassmateSettings> {
      try {
        const bag = await area.get([
          'classmate.activeSessionId',
          SESSION_PROFILE_STORAGE_KEY,
          PERIOD_NUMBER_STORAGE_KEY,
          SUBJECT_STORAGE_KEY,
          PROVIDER_STORAGE_KEY,
        ]);
        return normalizeSettings(bag ?? {});
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    },
  };
}

export { PERIOD_NUMBER_STORAGE_KEY, SESSION_PROFILE_STORAGE_KEY };
