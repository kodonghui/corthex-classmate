import { describe, expect, it } from 'vitest';

import type { SessionBundleV2, SessionSummaryV2 } from './types';
import { HIDDEN_SENSITIVE_HISTORY_TEXT } from './sanitize';
import {
  compactDateTime,
  pastSessionDetailView,
  pastSessionDetailViewFromBundle,
  sessionLibraryView,
} from './view';

const CURRENT = '2026-09-04-p2';
const OLD: SessionSummaryV2 = {
  sessionId: 'session-old',
  legacyPeriodId: '2026-09-04-p1',
  profile: 'class',
  title: 'AOP 수업',
  startedAt: '2026-09-04T09:00:00+09:00',
  lastAt: '2026-09-04T09:50:00+09:00',
  eventCount: 12,
  transcriptCount: 5,
  questionCount: 2,
  answerCount: 1,
  frameCount: 1,
};

describe('과거 세션 화면 값', () => {
  it('현재 세션도 재시작 전 SQLite 저장본을 열 수 있게 표시하고, 최근 세션부터 놓습니다', () => {
    const current: SessionSummaryV2 = {
      ...OLD,
      sessionId: CURRENT,
      legacyPeriodId: CURRENT,
      title: '지금 수업',
      lastAt: '2026-09-04T10:50:00+09:00',
    };
    const older: SessionSummaryV2 = {
      ...OLD,
      sessionId: 'session-older',
      legacyPeriodId: '2026-09-03-p8',
      title: '어제 수업',
      startedAt: '2026-09-03T16:00:00+09:00',
      lastAt: '2026-09-03T16:50:00+09:00',
    };

    const view = sessionLibraryView([older, current, OLD], CURRENT);
    expect(view.status).toBe('ready');
    expect(view.rows.map((row) => row.title)).toEqual(['지금 수업', 'AOP 수업', '어제 수업']);
    expect(view.rows[0]?.current).toBe(true);
    expect(view.rows[1]?.current).toBe(false);
    expect(view.rows[1]?.counts).toBe('전사 5 · 질문 2 · 답 1 · 화면 1');
  });

  it('문자열 순서가 아니라 Date.parse epoch로 정렬하고 Z·offset을 KST로 표시합니다', () => {
    const later: SessionSummaryV2 = {
      ...OLD,
      sessionId: 'actual-later',
      title: '실제로 나중',
      startedAt: '2026-09-04T23:30:00-10:00',
      lastAt: '2026-09-04T23:30:00-10:00',
    };
    const earlier: SessionSummaryV2 = {
      ...OLD,
      sessionId: 'actual-earlier',
      title: '실제로 먼저',
      startedAt: '2026-09-05T08:00:00+09:00',
      lastAt: '2026-09-05T08:00:00+09:00',
    };

    const view = sessionLibraryView([earlier, later], CURRENT);
    expect(view.rows.map((row) => row.title)).toEqual(['실제로 나중', '실제로 먼저']);
    expect(view.rows.map((row) => row.date)).toEqual(['2026.09.05 18:30', '2026.09.05 08:00']);
    expect(compactDateTime('2026-09-03T15:30:00Z')).toBe('2026.09.04 00:30');
  });

  it('전사·질문·응답·화면을 본문과 근거 개수로 읽고 파일 경로는 화면 값에 넣지 않습니다', () => {
    const bundle: SessionBundleV2 = {
      schemaVersion: '2',
      sessionId: OLD.sessionId,
      legacyPeriodId: '2026-09-04-p1',
      profile: 'class',
      title: 'AOP 수업',
      startedAt: '2026-09-04T09:00:00+09:00',
      sources: [],
      moments: [
        {
          id: 'm-transcript',
          type: 'transcript',
          at: '2026-09-04T09:01:00+09:00',
          materialRefIds: ['source-transcript'],
          assetRefIds: [],
          text: '프록시는 원본 앞에서 요청을 받습니다.',
          transcript: { segmentId: 'segment-1', revision: 1, isFinal: true },
        },
        {
          id: 'm-response',
          type: 'response',
          at: '2026-09-04T09:02:00+09:00',
          materialRefIds: ['source-transcript'],
          assetRefIds: ['asset-frame'],
          response: {
            id: 'response-1',
            questionId: 'm-question',
            createdAt: '2026-09-04T09:02:00+09:00',
            conclusion: '공통 로직을 한곳에 둡니다.',
            evidenceRefIds: ['m-transcript'],
            sections: [],
            providerId: 'synthetic-test',
            status: 'completed',
          },
        },
        {
          id: 'm-visual',
          type: 'visual',
          at: '2026-09-04T09:02:01+09:00',
          materialRefIds: [],
          assetRefIds: ['asset-frame'],
        },
      ],
      activities: [],
      artifacts: [
        {
          id: 'asset-frame',
          kind: 'image',
          mediaType: 'image/jpeg',
          path: 'frames/frame.jpg',
          logicalPath: 'frames/frame.webp',
        },
      ],
    };
    const view = pastSessionDetailView(OLD, bundle);
    expect(view.moments.map((moment) => moment.body)).toEqual([
      '프록시는 원본 앞에서 요청을 받습니다.',
      '공통 로직을 한곳에 둡니다.',
      '화면 근거 1개가 연결되어 있어요.',
    ]);
    expect(JSON.stringify(view)).not.toContain('frames/frame');
    expect(pastSessionDetailViewFromBundle(bundle).counts).toBe('전사 1 · 질문 0 · 답 1 · 화면 1');
  });

  it('학습 원문은 보존하고 운영 경고와 provider 메타데이터만 가립니다', () => {
    const localSummary: SessionSummaryV2 = {
      ...OLD,
      title: 'C:\\Users\\learner\\private-session',
      startedAt: '2026-09-03T15:30:00Z',
    };
    const unsafeBundle: SessionBundleV2 = {
      schemaVersion: '2',
      sessionId: OLD.sessionId,
      profile: 'class',
      startedAt: '2026-09-03T15:30:00Z',
      sources: [],
      moments: [
        {
          id: 'local-transcript',
          type: 'transcript',
          at: '2026-09-03T15:30:30Z',
          materialRefIds: [],
          assetRefIds: [],
          text: '강의 예제는 C:\\Users\\learner\\Main.java 입니다.',
          transcript: { segmentId: 'segment-local', revision: 1, isFinal: true },
        },
        {
          id: 'local-question',
          type: 'question',
          at: '2026-09-03T15:31:00Z',
          materialRefIds: [],
          assetRefIds: [],
          text: '원본은 /home/learner/private.txt 에 있어요.',
        },
        {
          id: 'local-response',
          type: 'response',
          at: '2026-09-03T16:31:00+01:00',
          materialRefIds: [],
          assetRefIds: [],
          response: {
            id: 'response-unsafe',
            questionId: 'local-question',
            createdAt: '2026-09-03T15:31:00Z',
            conclusion: '질문 예제의 ?access_token=placeholder 문자열을 그대로 설명합니다.',
            evidenceRefIds: ['local-question'],
            sections: [
              {
                id: 'unsafe-section',
                title: '\\\\classroom-pc\\private\\title',
                content: '/home/learner/app 경로와 ?access_token=placeholder를 비교합니다.',
              },
            ],
            providerId: 'file:///C:/private/provider.json',
            status: 'completed',
            warnings: ['D:/private/response.log'],
          },
        },
      ],
      activities: [],
      artifacts: [],
      warnings: ['bundle path=/opt/classmate/private.log'],
    };

    const view = pastSessionDetailView(localSummary, unsafeBundle);
    const serialized = JSON.stringify(view);
    expect(view.title).toBe('C:\\Users\\learner\\private-session');
    expect(sessionLibraryView([localSummary], CURRENT).rows[0]?.title).toBe(
      'C:\\Users\\learner\\private-session',
    );
    expect(view.subtitle).toBe('2026.09.04 00:30 · 수업');
    expect(view.moments.map((moment) => moment.time)).toEqual(['00:30', '00:31', '00:31']);
    expect(view.moments.map((moment) => moment.body)).toEqual([
      '강의 예제는 C:\\Users\\learner\\Main.java 입니다.',
      '원본은 /home/learner/private.txt 에 있어요.',
      '질문 예제의 ?access_token=placeholder 문자열을 그대로 설명합니다.',
    ]);
    expect(view.moments[2]?.sections).toEqual([
      {
        id: 'unsafe-section',
        title: '\\\\classroom-pc\\private\\title',
        content: '/home/learner/app 경로와 ?access_token=placeholder를 비교합니다.',
      },
    ]);
    expect(view.moments[2]?.provider).toBe(HIDDEN_SENSITIVE_HISTORY_TEXT);
    expect(view.warnings).toEqual([HIDDEN_SENSITIVE_HISTORY_TEXT, HIDDEN_SENSITIVE_HISTORY_TEXT]);
    expect(serialized).toContain('C:\\\\Users\\\\learner\\\\Main.java');
    expect(serialized).toContain('/home/learner/private.txt');
    expect(serialized).toContain('?access_token=placeholder');
    expect(serialized).not.toContain('file:///C:/private/provider.json');
    expect(serialized).not.toContain('D:/private/response.log');
    expect(serialized).not.toContain('/opt/classmate/private.log');
  });
});
