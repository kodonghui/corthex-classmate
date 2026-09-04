/** 사이드패널 ↔ 서비스 워커 사이의 과거 세션 읽기 전용 프로토콜입니다. */

import type { SessionBundleV2, SessionSummaryV2 } from './types';
import { isSafeSessionId, isSessionBundleV2, isSessionSummaryV2 } from './types';

export const HISTORY_SESSION_LIST = 'classmate.session.list';
export const HISTORY_SESSION_SUMMARY = 'classmate.session.summary';
export const HISTORY_SESSION_BUNDLE = 'classmate.session.bundle';
export const HISTORY_SESSION_LISTED = 'classmate.session.listed';
export const HISTORY_SESSION_SUMMARIZED = 'classmate.session.summarized';
export const HISTORY_SESSION_BUNDLED = 'classmate.session.bundled';
export const HISTORY_SESSION_ERROR = 'classmate.session.error';

export interface HistorySessionListRequest {
  readonly type: typeof HISTORY_SESSION_LIST;
}

export interface HistorySessionSummaryRequest {
  readonly type: typeof HISTORY_SESSION_SUMMARY;
  readonly sessionId: string;
}

export interface HistorySessionBundleRequest {
  readonly type: typeof HISTORY_SESSION_BUNDLE;
  readonly sessionId: string;
}

export type SessionHistoryRequest =
  | HistorySessionListRequest
  | HistorySessionSummaryRequest
  | HistorySessionBundleRequest;

export interface HistorySessionListedReply {
  readonly type: typeof HISTORY_SESSION_LISTED;
  readonly sessions: readonly SessionSummaryV2[];
}

export interface HistorySessionSummarizedReply {
  readonly type: typeof HISTORY_SESSION_SUMMARIZED;
  readonly summary: SessionSummaryV2;
}

export interface HistorySessionBundledReply {
  readonly type: typeof HISTORY_SESSION_BUNDLED;
  readonly bundle: SessionBundleV2;
}

export type SessionHistoryErrorReason =
  | 'host-unavailable'
  | 'invalid-session-id'
  | 'session-not-found'
  | 'read-failed'
  | 'invalid-response';

export interface HistorySessionErrorReply {
  readonly type: typeof HISTORY_SESSION_ERROR;
  readonly requestType: SessionHistoryRequest['type'];
  readonly reason: SessionHistoryErrorReason;
}

export type SessionHistoryReply =
  | HistorySessionListedReply
  | HistorySessionSummarizedReply
  | HistorySessionBundledReply
  | HistorySessionErrorReply;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function isSessionHistoryRequest(value: unknown): value is SessionHistoryRequest {
  if (!isRecord(value)) return false;
  switch (value['type']) {
    case HISTORY_SESSION_LIST:
      return hasOnlyKeys(value, ['type']);
    case HISTORY_SESSION_SUMMARY:
    case HISTORY_SESSION_BUNDLE:
      return hasOnlyKeys(value, ['type', 'sessionId']) && isSafeSessionId(value['sessionId']);
    default:
      return false;
  }
}

function isSessionHistoryRequestType(value: unknown): value is SessionHistoryRequest['type'] {
  return (
    value === HISTORY_SESSION_LIST || value === HISTORY_SESSION_SUMMARY || value === HISTORY_SESSION_BUNDLE
  );
}

function isSessionHistoryErrorReason(value: unknown): value is SessionHistoryErrorReason {
  return (
    value === 'host-unavailable' ||
    value === 'invalid-session-id' ||
    value === 'session-not-found' ||
    value === 'read-failed' ||
    value === 'invalid-response'
  );
}

export function isSessionHistoryReply(value: unknown): value is SessionHistoryReply {
  if (!isRecord(value)) return false;
  switch (value['type']) {
    case HISTORY_SESSION_LISTED:
      return (
        hasOnlyKeys(value, ['type', 'sessions']) &&
        Array.isArray(value['sessions']) &&
        value['sessions'].every(isSessionSummaryV2)
      );
    case HISTORY_SESSION_SUMMARIZED:
      return hasOnlyKeys(value, ['type', 'summary']) && isSessionSummaryV2(value['summary']);
    case HISTORY_SESSION_BUNDLED:
      return hasOnlyKeys(value, ['type', 'bundle']) && isSessionBundleV2(value['bundle']);
    case HISTORY_SESSION_ERROR:
      return (
        hasOnlyKeys(value, ['type', 'requestType', 'reason']) &&
        isSessionHistoryRequestType(value['requestType']) &&
        isSessionHistoryErrorReason(value['reason'])
      );
    default:
      return false;
  }
}
