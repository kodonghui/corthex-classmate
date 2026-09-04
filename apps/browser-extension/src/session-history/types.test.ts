import { createValidator } from '@classmate/contracts';
import activityExample from '@classmate/contracts/schemas/examples/activity-card.1.json';
import activitySetExample from '@classmate/contracts/schemas/examples/activity-set-v2.1.json';
import assetExample from '@classmate/contracts/schemas/examples/asset-ref.1.json';
import materialExample from '@classmate/contracts/schemas/examples/material-ref.1.json';
import bundleExample from '@classmate/contracts/schemas/examples/session-bundle-v2.1.json';
import { describe, expect, it } from 'vitest';

import {
  activitySetsEqual,
  isActivitySetV2,
  isSafeRelativeAssetPath,
  isSafeSessionId,
  isSessionBundleV2,
  isSessionSummaryV2,
} from './types';
import type { ActivitySetV2 } from './types';

const SUMMARY = {
  sessionId: '2026-09-04-p1',
  legacyPeriodId: '2026-09-04-p1',
  profile: 'class',
  title: '스프링 AOP',
  startedAt: '2026-09-04T09:00:00+09:00',
  lastAt: '2026-09-04T09:50:00+09:00',
  eventCount: 20,
  transcriptCount: 8,
  questionCount: 2,
  answerCount: 2,
  frameCount: 1,
} as const;

describe('과거 세션 V2 경계', () => {
  it('완성 활동은 정본처럼 정확히 다섯 슬롯의 고정 순서만 받습니다', () => {
    const canonical = createValidator('activity-set-v2');
    const fourCards = activitySetExample.slice(0, 4);
    const wrongOrder = [
      activitySetExample[1],
      activitySetExample[0],
      ...activitySetExample.slice(2),
    ];
    const extraField = activitySetExample.map((activity, index) =>
      index === 0 ? { ...activity, privatePath: 'C:\\private\\answer.txt' } : activity,
    );

    for (const candidate of [activitySetExample, fourCards, wrongOrder, extraField]) {
      expect(isActivitySetV2(candidate)).toBe(canonical(candidate));
    }
    expect(isActivitySetV2(activitySetExample)).toBe(true);
    expect(isActivitySetV2(fourCards)).toBe(false);
    expect(isActivitySetV2(wrongOrder)).toBe(false);
    expect(isActivitySetV2(extraField)).toBe(false);

    const changed = activitySetExample.map((activity, index) =>
      index === 0 ? { ...activity, prompt: '다른 저장 요청입니다.' } : activity,
    );
    expect(
      activitySetsEqual(
        activitySetExample as unknown as ActivitySetV2,
        structuredClone(activitySetExample) as unknown as ActivitySetV2,
      ),
    ).toBe(true);
    expect(
      activitySetsEqual(
        activitySetExample as unknown as ActivitySetV2,
        changed as unknown as ActivitySetV2,
      ),
    ).toBe(false);
  });

  it('정본 SessionBundleV2 예시와 모든 선택 필드 예시를 Ajv와 같이 받습니다', () => {
    const canonical = createValidator('session-bundle-v2');
    const withOptionalShapes = {
      ...bundleExample,
      sources: [materialExample],
      activities: [activityExample],
      artifacts: [assetExample],
      moments: bundleExample.moments.map((moment) =>
        moment.type === 'transcript'
          ? {
              ...moment,
              transcript: {
                ...moment.transcript,
                speaker: '강사',
                words: [{ text: '핵심', startMs: 0, endMs: 420, confidence: 0.95 }],
              },
            }
          : moment.type === 'response' && moment.response !== undefined
            ? {
                ...moment,
                response: {
                  ...moment.response,
                  warnings: ['공식 근거를 한 번 더 확인하세요.'],
                  verification: materialExample.verification,
                  sections: moment.response.sections.map((section) => ({
                    ...section,
                    evidenceRefIds: ['moment-transcript-001'],
                  })),
                },
              }
            : moment,
      ),
    };

    expect(canonical(withOptionalShapes)).toBe(true);
    expect(isSessionBundleV2(withOptionalShapes)).toBe(true);
  });

  it('호스트의 정상 요약과 번들을 받습니다', () => {
    expect(isSessionSummaryV2(SUMMARY)).toBe(true);
    expect(
      isSessionBundleV2({
        schemaVersion: '2',
        sessionId: SUMMARY.sessionId,
        legacyPeriodId: SUMMARY.legacyPeriodId,
        profile: 'class',
        title: SUMMARY.title,
        startedAt: SUMMARY.startedAt,
        sources: [],
        moments: [
          {
            id: 'ev-1',
            at: '2026-09-04T09:00:05+09:00',
            type: 'transcript',
            materialRefIds: ['source-1'],
            assetRefIds: [],
            text: '프록시는 원본 앞에서 요청을 받습니다.',
            transcript: { segmentId: 'segment-1', revision: 1, isFinal: true },
          },
          {
            id: 'ev-2',
            at: '2026-09-04T09:00:06+09:00',
            type: 'response',
            materialRefIds: ['source-1'],
            assetRefIds: [],
            response: {
              id: 'response-1',
              questionId: 'question-1',
              createdAt: '2026-09-04T09:00:06+09:00',
              conclusion: '공통 로직을 분리합니다.',
              evidenceRefIds: ['ev-1'],
              sections: [],
              providerId: 'synthetic-test',
              status: 'completed',
            },
          },
        ],
        activities: [],
        artifacts: [
          {
            id: 'asset-1',
            kind: 'image',
            mediaType: 'image/jpeg',
            path: 'frames/sf-1.jpg',
            logicalPath: 'frames/sf-1.webp',
          },
        ],
        summary: SUMMARY,
      }),
    ).toBe(true);
  });

  it('세션 식별자의 구분자와 상위 폴더 이동을 막습니다', () => {
    expect(isSafeSessionId('2026-09-04-p1')).toBe(true);
    expect(isSafeSessionId('../private')).toBe(false);
    expect(isSafeSessionId('C:\\Users\\name')).toBe(false);
    expect(isSafeSessionId('CON.txt')).toBe(false);
    expect(isSafeSessionId('%252e%252e%252fprivate')).toBe(false);
  });

  it('자산은 실제 확장자의 상대경로만 받고 로컬 절대경로를 거절합니다', () => {
    expect(isSafeRelativeAssetPath('frames/sf-1.jpg')).toBe(true);
    expect(isSafeRelativeAssetPath('frames/../secrets.txt')).toBe(false);
    expect(isSafeRelativeAssetPath('C:\\Users\\name\\frame.jpg')).toBe(false);
    expect(isSafeRelativeAssetPath('frames/file:secret.jpg')).toBe(false);
    expect(isSafeRelativeAssetPath('frames/%252e%252e%252fsecrets.txt')).toBe(false);

    expect(
      isSessionBundleV2({
        schemaVersion: '2',
        sessionId: SUMMARY.sessionId,
        profile: 'class',
        startedAt: SUMMARY.startedAt,
        sources: [],
        moments: [],
        activities: [],
        artifacts: [
          { id: 'asset-1', kind: 'image', mediaType: 'image/jpeg', path: 'C:\\private\\frame.jpg' },
        ],
      }),
    ).toBe(false);
  });

  it('음수 개수와 다른 스키마 버전을 받지 않습니다', () => {
    expect(isSessionSummaryV2({ ...SUMMARY, questionCount: -1 })).toBe(false);
    expect(
      isSessionBundleV2({
        schemaVersion: 2,
        sessionId: SUMMARY.sessionId,
        profile: 'class',
        startedAt: SUMMARY.startedAt,
        sources: [],
        moments: [],
        activities: [],
        artifacts: [],
      }),
    ).toBe(false);
  });

  it('날짜·교시·중복 참조와 모르는 필드를 정본처럼 거절합니다', () => {
    expect(isSessionSummaryV2({ ...SUMMARY, startedAt: '2026-02-30T09:00:00+09:00' })).toBe(false);
    expect(isSessionSummaryV2({ ...SUMMARY, legacyPeriodId: 'period-one' })).toBe(false);
    expect(isSessionSummaryV2({ ...SUMMARY, privatePath: 'C:\\Users\\learner' })).toBe(false);

    expect(isSessionBundleV2({ ...bundleExample, startedAt: '어제 오후' })).toBe(false);
    expect(isSessionBundleV2({ ...bundleExample, debug: true })).toBe(false);
    expect(
      isSessionBundleV2({
        ...bundleExample,
        moments: bundleExample.moments.map((moment) =>
          moment.type === 'question'
            ? { ...moment, materialRefIds: ['same', 'same'] }
            : moment,
        ),
      }),
    ).toBe(false);
  });

  it('reviewer 재현처럼 객체이기만 한 source와 activity를 받지 않습니다', () => {
    expect(
      isSessionBundleV2({
        ...bundleExample,
        sources: [{ privatePath: 'C:\\Users\\learner\\secret.txt' }],
        activities: [{ debug: 'looks like an object' }],
      }),
    ).toBe(false);
  });

  it('자료 verification의 enum·날짜·URI·추가 필드를 모두 검사합니다', () => {
    const source = materialExample;
    const bundleWith = (nextSource: unknown) => ({ ...bundleExample, sources: [nextSource] });

    expect(isSessionBundleV2(bundleWith({ ...source, kind: 'video' }))).toBe(false);
    expect(isSessionBundleV2(bundleWith({ ...source, adapterId: '' }))).toBe(false);
    expect(
      isSessionBundleV2(
        bundleWith({
          ...source,
          verification: { ...source.verification, effectiveDate: '2026-02-30' },
        }),
      ),
    ).toBe(false);
    expect(
      isSessionBundleV2(
        bundleWith({
          ...source,
          verification: { ...source.verification, verificationStatus: 'probably-current' },
        }),
      ),
    ).toBe(false);
    expect(
      isSessionBundleV2(
        bundleWith({
          ...source,
          verification: { ...source.verification, sourceUrl: 'not a uri' },
        }),
      ),
    ).toBe(false);
    expect(isSessionBundleV2(bundleWith({ ...source, unknown: true }))).toBe(false);
    expect(
      isSessionBundleV2(
        bundleWith({ ...source, verification: { ...source.verification, localPath: '/home/user' } }),
      ),
    ).toBe(false);
    for (const sourceUrl of ['foo:', 'C:\\private', 'https://example.com/%ZZ', 'http://example.com/[']) {
      expect(
        isSessionBundleV2(bundleWith({ ...source, verification: { sourceUrl } })),
        sourceUrl,
      ).toBe(false);
    }
  });

  it('정본이 허용하고 Date.parse도 해석하는 ISO 표기 변형을 받습니다', () => {
    expect(isSessionSummaryV2({ ...SUMMARY, startedAt: '2026-09-04t00:00:00z' })).toBe(true);
    expect(isSessionSummaryV2({ ...SUMMARY, startedAt: '2026-09-04 09:00:00+0900' })).toBe(true);
    expect(isSessionSummaryV2({ ...SUMMARY, startedAt: '2026-09-04T09:00:00+09' })).toBe(false);
  });

  it('활동과 시도의 필수값·enum·정수 범위를 검사합니다', () => {
    const bundleWith = (activity: unknown) => ({ ...bundleExample, activities: [activity] });
    expect(isSessionBundleV2(bundleWith(activityExample))).toBe(true);
    expect(isSessionBundleV2(bundleWith({ ...activityExample, slot: 'WATCH' }))).toBe(false);
    expect(isSessionBundleV2(bundleWith({ ...activityExample, kind: 'essay' }))).toBe(false);
    expect(isSessionBundleV2(bundleWith({ ...activityExample, evidenceRefIds: [] }))).toBe(false);
    expect(isSessionBundleV2(bundleWith({ ...activityExample, answer: undefined }))).toBe(false);
    expect(isSessionBundleV2(bundleWith({ ...activityExample, extra: true }))).toBe(false);

    const attempt = activityExample.attempts[0];
    expect(
      isSessionBundleV2(
        bundleWith({ ...activityExample, attempts: [{ ...attempt, confidence: 6 }] }),
      ),
    ).toBe(false);
    expect(
      isSessionBundleV2(
        bundleWith({ ...activityExample, attempts: [{ ...attempt, hintLevel: -1 }] }),
      ),
    ).toBe(false);
    expect(
      isSessionBundleV2(
        bundleWith({ ...activityExample, attempts: [{ ...attempt, startedAt: '2026-99-99' }] }),
      ),
    ).toBe(false);
    expect(
      isSessionBundleV2(
        bundleWith({ ...activityExample, attempts: [{ ...attempt, filesystemPath: '/tmp/a' }] }),
      ),
    ).toBe(false);
  });

  it('전사·응답·자산의 선택 필드도 타입·범위·추가 필드를 검사합니다', () => {
    const transcriptBroken = bundleExample.moments.map((moment) =>
      moment.type === 'transcript'
        ? { ...moment, transcript: { ...moment.transcript, confidence: 1.01 } }
        : moment,
    );
    expect(isSessionBundleV2({ ...bundleExample, moments: transcriptBroken })).toBe(false);

    const wordBroken = bundleExample.moments.map((moment) =>
      moment.type === 'transcript'
        ? {
            ...moment,
            transcript: {
              ...moment.transcript,
              words: [{ text: '핵심', startMs: 0.5, endMs: 1 }],
            },
          }
        : moment,
    );
    expect(isSessionBundleV2({ ...bundleExample, moments: wordBroken })).toBe(false);

    const responseBroken = bundleExample.moments.map((moment) =>
      moment.type === 'response'
        ? { ...moment, response: { ...moment.response, createdAt: 'today', secret: 'token' } }
        : moment,
    );
    expect(isSessionBundleV2({ ...bundleExample, moments: responseBroken })).toBe(false);
    expect(isSessionBundleV2({ ...bundleExample, artifacts: [{ ...assetExample, mediaType: 'jpeg' }] })).toBe(
      false,
    );
    expect(isSessionBundleV2({ ...bundleExample, artifacts: [{ ...assetExample, extra: true }] })).toBe(
      false,
    );
    expect(
      isSessionBundleV2({
        ...bundleExample,
        artifacts: [{ ...assetExample, logicalPath: 'C:\\private\\logical.webp' }],
      }),
    ).toBe(false);
  });
});
