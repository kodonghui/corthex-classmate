/**
 * 세션 사용 목적의 브라우저 확장 정본입니다.
 *
 * 설정 화면과 서비스 워커가 이 파일의 같은 키·같은 정규화 함수를 씁니다. 저장소에 예전 값이나
 * 깨진 값이 있어도 기존 수업 사용자는 그대로 `class` 프로필로 이어집니다.
 */

import type { SessionProfileV2 } from '@classmate/contracts';

export const SESSION_PROFILE_STORAGE_KEY = 'classmate.profile';
export const DEFAULT_SESSION_PROFILE: SessionProfileV2 = 'class';

/** 저장소의 날것을 계약의 세 프로필 중 하나로 좁힙니다. */
export function normalizeSessionProfile(value: unknown): SessionProfileV2 {
  return value === 'exam' || value === 'meeting' || value === 'class'
    ? value
    : DEFAULT_SESSION_PROFILE;
}

export interface SessionProfileCopy {
  readonly label: string;
  readonly slot: (index: number) => string;
  readonly captureScreen: string;
  readonly screenMissingTitle: string;
  readonly screenNotSelected: string;
  readonly returnToSession: string;
  readonly nowPrefix: string;
  readonly historyFootNote: string;
  readonly transcriptPausedDescription: string;
  readonly screenSection: string;
  readonly saidSection: string;
  readonly includesEditor: boolean;
}

const PROFILE_COPY: Readonly<Record<SessionProfileV2, SessionProfileCopy>> = {
  class: {
    label: '수업',
    slot: (index) => `${index}교시`,
    captureScreen: '수업 화면',
    screenMissingTitle: '수업 화면을 못 찍고 있어요.',
    screenNotSelected: '수업 화면 탭을 아직 안 골랐어요. 영상 탭에서 확장 아이콘을 눌러 주세요.',
    returnToSession: '수업으로 돌아가기',
    nowPrefix: '선생님은 지금',
    historyFootNote: '붙잡은 순간은 수업이 끝나도 남아요. 지우기는 설정에서.',
    transcriptPausedDescription: '화면과 코드는 계속 기록하고 있어요.',
    screenSection: '선생님 화면 코드',
    saidSection: '선생님이 말한 부분',
    includesEditor: true,
  },
  exam: {
    label: '시험 공부',
    slot: (index) => `시험 공부 · ${index}번 슬롯`,
    captureScreen: '강의 화면',
    screenMissingTitle: '강의 화면을 못 찍고 있어요.',
    screenNotSelected: '강의 화면 탭을 아직 안 골랐어요. 영상 탭에서 확장 아이콘을 눌러 주세요.',
    returnToSession: '세션으로 돌아가기',
    nowPrefix: '강의에서는 지금',
    historyFootNote: '붙잡은 순간은 공부 세션이 끝나도 남아요. 지우기는 설정에서.',
    transcriptPausedDescription: '연결된 화면 자료는 계속 기록하고 있어요.',
    screenSection: '강의 화면에서 확인한 부분',
    saidSection: '강의에서 말한 부분',
    includesEditor: false,
  },
  meeting: {
    label: '회의',
    slot: (index) => `회의 · ${index}번 슬롯`,
    captureScreen: '공유 화면',
    screenMissingTitle: '공유 화면을 못 찍고 있어요.',
    screenNotSelected: '공유 화면 탭을 아직 안 골랐어요. 회의 탭에서 확장 아이콘을 눌러 주세요.',
    returnToSession: '세션으로 돌아가기',
    nowPrefix: '회의에서는 지금',
    historyFootNote: '붙잡은 순간은 회의가 끝나도 남아요. 지우기는 설정에서.',
    transcriptPausedDescription: '연결된 화면 자료는 계속 기록하고 있어요.',
    screenSection: '공유 화면에서 확인한 부분',
    saidSection: '회의에서 말한 부분',
    includesEditor: false,
  },
};

/** 화면 문구가 저장소의 깨진 값까지 방어하도록 이 경계에서도 정규화합니다. */
export function sessionProfileCopy(profile: unknown): SessionProfileCopy {
  return PROFILE_COPY[normalizeSessionProfile(profile)];
}
