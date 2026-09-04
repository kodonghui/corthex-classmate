/** 과거 세션 계약을 사이드패널에 그릴 작은 읽기 모델로 바꿉니다. */

import { clockOfIso, dateTimeOfIso } from '../panel/clock';
import { sanitizeHistoryDisplayText, sanitizeHistoryDisplayTexts } from './sanitize';
import type { SessionBundleV2, SessionMomentV2, SessionProfileV2, SessionSummaryV2 } from './types';

export interface SessionListRowView {
  readonly sessionId: string;
  /** 지금 패널의 세션 id와 같아도 SQLite 전체 저장본은 재시작 전 기록을 품을 수 있습니다. */
  readonly current: boolean;
  readonly title: string;
  readonly date: string;
  readonly profile: string;
  readonly counts: string;
}

export type SessionLibraryView =
  | { readonly status: 'loading'; readonly rows: readonly [] }
  | { readonly status: 'error'; readonly rows: readonly []; readonly message: string }
  | { readonly status: 'ready'; readonly rows: readonly SessionListRowView[] };

export interface SessionMomentRowView {
  readonly id: string;
  readonly time: string;
  readonly type: SessionMomentV2['type'];
  readonly label: string;
  readonly body: string;
  readonly evidence: string;
  readonly sections: readonly { readonly id: string; readonly title: string; readonly content: string }[];
  readonly provider: string | null;
}

export interface PastSessionDetailView {
  readonly title: string;
  readonly subtitle: string;
  readonly counts: string;
  readonly moments: readonly SessionMomentRowView[];
  readonly warnings: readonly string[];
}

export function profileLabel(profile: SessionProfileV2): string {
  if (profile === 'exam') return '시험 학습';
  if (profile === 'meeting') return '회의';
  return '수업';
}

function fallbackTitle(profile: SessionProfileV2): string {
  if (profile === 'exam') return '저장된 시험 학습';
  if (profile === 'meeting') return '저장된 회의';
  return '저장된 수업';
}

/** 저장된 ISO 문자열을 패널의 공통 KST 축으로 옮겨 `YYYY.MM.DD HH:mm`까지 냅니다. */
export function compactDateTime(value: string | undefined): string {
  if (value === undefined) return '시간 정보 없음';
  try {
    return dateTimeOfIso(value);
  } catch {
    return '시간 정보 없음';
  }
}

function summaryCounts(summary: SessionSummaryV2): string {
  return `전사 ${summary.transcriptCount} · 질문 ${summary.questionCount} · 답 ${summary.answerCount} · 화면 ${summary.frameCount}`;
}

export function sessionLibraryView(
  sessions: readonly SessionSummaryV2[],
  currentPeriodId: string,
): SessionLibraryView {
  const rows = [...sessions]
    .sort((a, b) => {
      const aAt = Date.parse(a.lastAt ?? a.endedAt ?? a.startedAt ?? '');
      const bAt = Date.parse(b.lastAt ?? b.endedAt ?? b.startedAt ?? '');
      const aEpoch = Number.isNaN(aAt) ? Number.NEGATIVE_INFINITY : aAt;
      const bEpoch = Number.isNaN(bAt) ? Number.NEGATIVE_INFINITY : bAt;
      return bEpoch - aEpoch;
    })
    .map<SessionListRowView>((session) => ({
      sessionId: session.sessionId,
      current: session.sessionId === currentPeriodId || session.legacyPeriodId === currentPeriodId,
      title: session.title ?? fallbackTitle(session.profile),
      date: compactDateTime(session.startedAt ?? session.lastAt ?? session.endedAt),
      profile: profileLabel(session.profile),
      counts: summaryCounts(session),
    }));
  return { status: 'ready', rows };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nestedString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const found = value[key];
  return typeof found === 'string' && found.trim().length > 0 ? found : null;
}

function momentLabel(type: SessionMomentV2['type']): string {
  switch (type) {
    case 'transcript':
      return '전사';
    case 'visual':
      return '화면';
    case 'question':
      return '질문';
    case 'response':
      return '답변';
    case 'decision':
      return '결정';
    case 'action':
      return '할 일';
  }
}

function momentBody(moment: SessionMomentV2): string {
  if (typeof moment.text === 'string' && moment.text.trim().length > 0) {
    return moment.text;
  }
  if (moment.type === 'response') {
    const conclusion = nestedString(moment.response, 'conclusion');
    return conclusion === null
      ? '이전 기록에는 완성된 답변 본문이 없어요.'
      : conclusion;
  }
  if (moment.type === 'visual') {
    return `화면 근거 ${moment.assetRefIds.length}개가 연결되어 있어요.`;
  }
  return '이전 기록에는 읽을 본문이 없어요.';
}

function momentEvidence(moment: SessionMomentV2): string {
  const parts: string[] = [];
  if (moment.materialRefIds.length > 0) parts.push(`자료 ${moment.materialRefIds.length}`);
  if (moment.assetRefIds.length > 0) parts.push(`화면 ${moment.assetRefIds.length}`);
  return parts.length === 0 ? '연결된 근거 없음' : parts.join(' · ');
}

export function pastSessionDetailView(
  summary: SessionSummaryV2,
  bundle: SessionBundleV2,
): PastSessionDetailView {
  const rawTitle = summary.title ?? bundle.title ?? fallbackTitle(summary.profile);
  const responseWarnings = bundle.moments.flatMap((moment) => moment.response?.warnings ?? []);
  return {
    title: rawTitle,
    subtitle: `${compactDateTime(summary.startedAt ?? bundle.startedAt)} · ${profileLabel(summary.profile)}`,
    counts: summaryCounts(summary),
    moments: bundle.moments.map((moment) => ({
      id: moment.id,
      time: clockOfIso(moment.at).slice(0, 5),
      type: moment.type,
      label: momentLabel(moment.type),
      body: momentBody(moment),
      evidence: momentEvidence(moment),
      sections:
        moment.response?.sections.map((section) => ({
          id: section.id,
          title: section.title,
          content: section.content,
        })) ?? [],
      provider:
        moment.response === undefined
          ? null
          : sanitizeHistoryDisplayText(
              `${moment.response.providerId}${moment.response.model === undefined ? '' : ` · ${moment.response.model}`}`,
            ),
    })),
    warnings: sanitizeHistoryDisplayTexts([...(bundle.warnings ?? []), ...responseWarnings]),
  };
}

/**
 * 상세 화면은 한 번 읽은 bundle 스냅숏만 사용합니다. 별도 summary 요청과 섞으면 수업이
 * 기록되는 찰나에 개수와 순간 목록이 서로 다른 시점을 보여 줄 수 있습니다.
 */
export function pastSessionDetailViewFromBundle(bundle: SessionBundleV2): PastSessionDetailView {
  const summary: SessionSummaryV2 = bundle.summary ?? {
    sessionId: bundle.sessionId,
    ...(bundle.legacyPeriodId === undefined ? {} : { legacyPeriodId: bundle.legacyPeriodId }),
    profile: bundle.profile,
    ...(bundle.title === undefined ? {} : { title: bundle.title }),
    startedAt: bundle.startedAt,
    ...(bundle.endedAt === undefined ? {} : { endedAt: bundle.endedAt }),
    eventCount: bundle.moments.length,
    transcriptCount: bundle.moments.filter((moment) => moment.type === 'transcript').length,
    questionCount: bundle.moments.filter((moment) => moment.type === 'question').length,
    answerCount: bundle.moments.filter((moment) => moment.type === 'response').length,
    frameCount: bundle.moments.filter((moment) => moment.type === 'visual').length,
  };
  return pastSessionDetailView(summary, bundle);
}
