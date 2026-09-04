/**
 * 패널의 과거 세션 읽기 요청을 Native Host의 읽기 전용 API에 잇습니다.
 * 실패 문구와 경로는 그대로 중계하지 않고 고정된 까닭만 돌려줍니다.
 */

import type { HostEnvelope } from './host-messages';
import {
  SESSION_BUNDLE,
  SESSION_GET_SUMMARY,
  SESSION_LIST,
  isHostErrorMessage,
  isSessionBundledReply,
  isSessionListedReply,
  isSessionSummaryReply,
} from './host-messages';
import type { HostSendResult } from './host-client';
import {
  HISTORY_SESSION_BUNDLED,
  HISTORY_SESSION_BUNDLE,
  HISTORY_SESSION_ERROR,
  HISTORY_SESSION_LIST,
  HISTORY_SESSION_LISTED,
  HISTORY_SESSION_SUMMARIZED,
  HISTORY_SESSION_SUMMARY,
} from '../session-history/messages';
import type {
  SessionHistoryErrorReason,
  SessionHistoryReply,
  SessionHistoryRequest,
} from '../session-history/messages';

export interface SessionHistoryHostGateway {
  send(envelope: HostEnvelope): Promise<HostSendResult>;
}

function errorReply(
  requestType: SessionHistoryRequest['type'],
  reason: SessionHistoryErrorReason,
): SessionHistoryReply {
  return { type: HISTORY_SESSION_ERROR, requestType, reason };
}

function mapHostErrorReason(reason: string): SessionHistoryErrorReason {
  if (reason === 'invalid-session-id') return 'invalid-session-id';
  if (reason === 'session-not-found') return 'session-not-found';
  return 'read-failed';
}

/** 이미 런타임 경계를 통과한 요청 하나를 처리합니다. */
export async function handleSessionHistoryRequest(
  request: SessionHistoryRequest,
  host: SessionHistoryHostGateway,
): Promise<SessionHistoryReply> {
  const envelope: HostEnvelope =
    request.type === HISTORY_SESSION_LIST
      ? { type: SESSION_LIST }
      : request.type === HISTORY_SESSION_SUMMARY
        ? { type: SESSION_GET_SUMMARY, sessionId: request.sessionId }
        : { type: SESSION_BUNDLE, sessionId: request.sessionId };

  const result = await host.send(envelope);
  if (result.status !== 'replied') {
    return errorReply(request.type, 'host-unavailable');
  }
  const reply = result.message;
  if (isHostErrorMessage(reply)) {
    return errorReply(request.type, mapHostErrorReason(reply.reason));
  }

  if (request.type === HISTORY_SESSION_LIST && isSessionListedReply(reply)) {
    return { type: HISTORY_SESSION_LISTED, sessions: reply.sessions };
  }
  if (request.type === HISTORY_SESSION_SUMMARY && isSessionSummaryReply(reply)) {
    return { type: HISTORY_SESSION_SUMMARIZED, summary: reply.summary };
  }
  if (request.type === HISTORY_SESSION_BUNDLE && isSessionBundledReply(reply)) {
    return { type: HISTORY_SESSION_BUNDLED, bundle: reply.bundle };
  }
  return errorReply(request.type, 'invalid-response');
}
