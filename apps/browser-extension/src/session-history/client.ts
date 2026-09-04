/** 사이드패널에서 서비스 워커의 과거 세션 읽기 전용 다리를 부르는 클라이언트입니다. */

import {
  HISTORY_SESSION_BUNDLED,
  HISTORY_SESSION_BUNDLE,
  HISTORY_SESSION_ERROR,
  HISTORY_SESSION_LIST,
  HISTORY_SESSION_LISTED,
  HISTORY_SESSION_SUMMARIZED,
  HISTORY_SESSION_SUMMARY,
  isSessionHistoryReply,
} from './messages';
import type { SessionHistoryErrorReason, SessionHistoryRequest } from './messages';
import type { SessionBundleV2, SessionSummaryV2 } from './types';
import { isSafeSessionId } from './types';

export type SessionHistoryResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'error'; readonly reason: SessionHistoryErrorReason };

export interface SessionHistoryClient {
  list(): Promise<SessionHistoryResult<readonly SessionSummaryV2[]>>;
  getSummary(sessionId: string): Promise<SessionHistoryResult<SessionSummaryV2>>;
  getBundle(sessionId: string): Promise<SessionHistoryResult<SessionBundleV2>>;
}

export interface SessionHistoryRuntimeLike {
  sendMessage(message: unknown): Promise<unknown>;
}

export function sessionHistoryErrorText(reason: SessionHistoryErrorReason): string {
  switch (reason) {
    case 'host-unavailable':
      return '로컬 도우미에 연결되면 지난 기록을 불러올 수 있어요.';
    case 'invalid-session-id':
      return '이 기록의 식별자가 올바르지 않아 열지 않았어요.';
    case 'session-not-found':
      return '이 기록을 로컬 저장소에서 찾지 못했어요.';
    case 'read-failed':
      return '로컬 기록을 읽지 못했어요. 잠시 뒤 다시 시도해 주세요.';
    case 'invalid-response':
      return '로컬 도우미와 확장의 기록 형식이 서로 달라요. 둘을 함께 업데이트해 주세요.';
  }
}

export function createSessionHistoryClient(runtime: SessionHistoryRuntimeLike): SessionHistoryClient {
  async function call(request: SessionHistoryRequest): Promise<unknown> {
    try {
      return await runtime.sendMessage(request);
    } catch {
      return { type: HISTORY_SESSION_ERROR, requestType: request.type, reason: 'host-unavailable' };
    }
  }

  async function list(): Promise<SessionHistoryResult<readonly SessionSummaryV2[]>> {
    const reply = await call({ type: HISTORY_SESSION_LIST });
    if (!isSessionHistoryReply(reply)) return { status: 'error', reason: 'invalid-response' };
    if (reply.type === HISTORY_SESSION_ERROR) {
      return reply.requestType === HISTORY_SESSION_LIST
        ? { status: 'error', reason: reply.reason }
        : { status: 'error', reason: 'invalid-response' };
    }
    if (reply.type !== HISTORY_SESSION_LISTED) return { status: 'error', reason: 'invalid-response' };
    return { status: 'ok', value: reply.sessions };
  }

  async function getSummary(sessionId: string): Promise<SessionHistoryResult<SessionSummaryV2>> {
    if (!isSafeSessionId(sessionId)) return { status: 'error', reason: 'invalid-session-id' };
    const reply = await call({ type: HISTORY_SESSION_SUMMARY, sessionId });
    if (!isSessionHistoryReply(reply)) return { status: 'error', reason: 'invalid-response' };
    if (reply.type === HISTORY_SESSION_ERROR) {
      return reply.requestType === HISTORY_SESSION_SUMMARY
        ? { status: 'error', reason: reply.reason }
        : { status: 'error', reason: 'invalid-response' };
    }
    if (reply.type !== HISTORY_SESSION_SUMMARIZED || reply.summary.sessionId !== sessionId) {
      return { status: 'error', reason: 'invalid-response' };
    }
    return { status: 'ok', value: reply.summary };
  }

  async function getBundle(sessionId: string): Promise<SessionHistoryResult<SessionBundleV2>> {
    if (!isSafeSessionId(sessionId)) return { status: 'error', reason: 'invalid-session-id' };
    const reply = await call({ type: HISTORY_SESSION_BUNDLE, sessionId });
    if (!isSessionHistoryReply(reply)) return { status: 'error', reason: 'invalid-response' };
    if (reply.type === HISTORY_SESSION_ERROR) {
      return reply.requestType === HISTORY_SESSION_BUNDLE
        ? { status: 'error', reason: reply.reason }
        : { status: 'error', reason: 'invalid-response' };
    }
    if (reply.type !== HISTORY_SESSION_BUNDLED || reply.bundle.sessionId !== sessionId) {
      return { status: 'error', reason: 'invalid-response' };
    }
    return { status: 'ok', value: reply.bundle };
  }

  return { list, getSummary, getBundle };
}
