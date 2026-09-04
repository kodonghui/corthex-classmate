/**
 * 패널의 과거 세션 읽기와 활동 저장 요청을 Native Host API에 잇습니다.
 * 실패 문구와 경로는 그대로 중계하지 않고 고정된 까닭만 돌려줍니다.
 */

import type { HostEnvelope } from './host-messages';
import {
  ACTIVITY_SAVE,
  SESSION_BUNDLE,
  SESSION_GET_SUMMARY,
  SESSION_LIST,
  isActivitySavedReply,
  isHostErrorMessage,
  isSessionBundledReply,
  isSessionListedReply,
  isSessionSummaryReply,
} from './host-messages';
import type { HostSendResult } from './host-client';
import {
  HISTORY_ACTIVITY_SAVE,
  HISTORY_ACTIVITY_SAVED,
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
import { activitySetsEqual } from '../session-history/types';

export interface SessionHistoryHostGateway {
  send(envelope: HostEnvelope): Promise<HostSendResult>;
}

function errorReply(
  requestType: SessionHistoryRequest['type'],
  reason: SessionHistoryErrorReason,
): SessionHistoryReply {
  return { type: HISTORY_SESSION_ERROR, requestType, reason };
}

function mapHostErrorReason(
  requestType: SessionHistoryRequest['type'],
  reason: string,
): SessionHistoryErrorReason {
  if (requestType === HISTORY_ACTIVITY_SAVE) {
    if (reason === 'unknown-activity-evidence') return 'unknown-activity-evidence';
    if (reason === 'malformed-activity-set') return 'malformed-activity-set';
    if (reason === 'session-not-found') return 'session-not-found';
    if (reason === 'invalid-session-id') return 'invalid-session-id';
    return 'invalid-response';
  }
  if (reason === 'invalid-session-id') return 'invalid-session-id';
  if (reason === 'session-not-found') return 'session-not-found';
  return 'read-failed';
}

/** 이미 런타임 경계를 통과한 요청 하나를 처리합니다. */
export async function handleSessionHistoryRequest(
  request: SessionHistoryRequest,
  host: SessionHistoryHostGateway,
): Promise<SessionHistoryReply> {
  let envelope: HostEnvelope;
  switch (request.type) {
    case HISTORY_SESSION_LIST:
      envelope = { type: SESSION_LIST };
      break;
    case HISTORY_SESSION_SUMMARY:
      envelope = { type: SESSION_GET_SUMMARY, sessionId: request.sessionId };
      break;
    case HISTORY_SESSION_BUNDLE:
      envelope = { type: SESSION_BUNDLE, sessionId: request.sessionId };
      break;
    case HISTORY_ACTIVITY_SAVE:
      envelope = {
        type: ACTIVITY_SAVE,
        sessionId: request.sessionId,
        activitySet: request.activitySet,
      };
      break;
  }

  const result = await host.send(envelope);
  if (result.status !== 'replied') {
    return errorReply(request.type, 'host-unavailable');
  }
  const reply = result.message;
  if (isHostErrorMessage(reply)) {
    if (reply.received !== envelope.type) return errorReply(request.type, 'invalid-response');
    return errorReply(request.type, mapHostErrorReason(request.type, reply.reason));
  }

  if (request.type === HISTORY_SESSION_LIST && isSessionListedReply(reply)) {
    return { type: HISTORY_SESSION_LISTED, sessions: reply.sessions };
  }
  if (
    request.type === HISTORY_SESSION_SUMMARY &&
    isSessionSummaryReply(reply) &&
    reply.summary.sessionId === request.sessionId
  ) {
    return { type: HISTORY_SESSION_SUMMARIZED, summary: reply.summary };
  }
  if (
    request.type === HISTORY_SESSION_BUNDLE &&
    isSessionBundledReply(reply) &&
    reply.bundle.sessionId === request.sessionId
  ) {
    return { type: HISTORY_SESSION_BUNDLED, bundle: reply.bundle };
  }
  if (
    request.type === HISTORY_ACTIVITY_SAVE &&
    isActivitySavedReply(reply) &&
    reply.sessionId === request.sessionId &&
    activitySetsEqual(reply.activitySet, request.activitySet)
  ) {
    return {
      type: HISTORY_ACTIVITY_SAVED,
      sessionId: reply.sessionId,
      activitySet: reply.activitySet,
    };
  }
  return errorReply(request.type, 'invalid-response');
}
