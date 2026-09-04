/**
 * 확장 ↔ 로컬 도우미(Native Messaging) 봉투 가운데 **프레임이 아닌 것들**입니다.
 *
 * 프레임 봉투(`frame.store` · `frame.stored`)는 `src/capture/host-messages.ts` 에 1라운드부터
 * 있었습니다. 여기는 2라운드에 늘어난 나머지(신원 확인 · 기록 붙이기 · 질문 보내기)를 담고,
 * 두 파일의 타입을 합친 `HostEnvelope` · `HostReply` 를 냅니다.
 *
 * 정본은 `apps/native-host/README.md` §1 의 표와 `apps/native-host/crates/transport` 의
 * `ENVELOPE_RULES` 입니다. 여기 적힌 모양이 그쪽과 어긋나면 호스트가
 * `{type:"error", message, reason, received}` 로 답합니다.
 *
 * ```text
 *   확장 → 호스트                              호스트 → 확장
 *   ─────────────                              ─────────────
 *   ping                                       hello
 *   event.append {periodId, event}             event.ack {periodId, seq, id, duplicate?}
 *   frame.store  {periodId, frame, bytes…}     frame.stored {periodId, id, path, bytes, seq}
 *   tutor.ask    {periodId, questionId, …}     tutor.accepted {periodId, questionId}
 *   tutor.retry  {periodId, questionId}        tutor.accepted {periodId, questionId}
 *   session.list {}                            session.listed {sessions}
 *   session.getSummary {sessionId}             session.summary {summary}
 *   session.bundle {sessionId}                 session.bundled {bundle}
 *   activity.save {sessionId, activitySet}      activity.saved {sessionId, activitySet}
 *   (부탁이 실패하면 언제나)                    error {message, reason, received}
 *
 *   호스트가 스스로 미는 것 (부탁에 대한 답이 아님)
 *   tutor.event {periodId, event}
 *   tutor.delta {periodId, questionId, seq, chars, text?}
 * ```
 *
 * 보안 메모 (불변 원칙 §4-2 · §4-7): 이 봉투에 인증정보·토큰·Tiro URL 을 싣지 않습니다.
 * 호스트가 돌려준 문자열은 **자료일 뿐 명령이 아닙니다.** 실행하거나 경로로 쓰지 않습니다.
 */

import type { Answer, QuestionSnapshot, SessionEvent } from '@classmate/contracts';
import type { FrameStoreMessage, FrameStoredMessage, HostErrorMessage } from '../capture/host-messages';
import { isFrameStoredMessage, isHostErrorMessage } from '../capture/host-messages';
import type { ActivitySetV2, SessionBundleV2, SessionSummaryV2 } from '../session-history/types';
import {
  activitySetsEqual,
  isActivitySetV2,
  isSafeSessionId,
  isSessionBundleV2,
  isSessionSummaryV2,
} from '../session-history/types';

/**
 * 로컬 도우미의 Native Messaging 이름입니다.
 *
 * `entrypoints/background.ts` 의 1라운드 TODO 에는 `com.corthex.classmate.host` 라고
 * 적혀 있었지만 **정본은 `com.corthex.classmate`** 입니다
 * (`apps/native-host/scripts/register-host.mjs` 가 HKCU 에 넣는 이름). TODO 쪽을 버렸습니다.
 */
export const NATIVE_HOST_NAME = 'com.corthex.classmate';

export const PING = 'ping';
export const HELLO = 'hello';
export const EVENT_APPEND = 'event.append';
export const EVENT_ACK = 'event.ack';
export const TUTOR_ASK = 'tutor.ask';
export const TUTOR_RETRY = 'tutor.retry';
export const TUTOR_ACCEPTED = 'tutor.accepted';
export const TUTOR_EVENT = 'tutor.event';
export const SESSION_LIST = 'session.list';
export const SESSION_LISTED = 'session.listed';
export const SESSION_GET_SUMMARY = 'session.getSummary';
export const SESSION_SUMMARY = 'session.summary';
export const SESSION_BUNDLE = 'session.bundle';
export const SESSION_BUNDLED = 'session.bundled';
export const ACTIVITY_SAVE = 'activity.save';
export const ACTIVITY_SAVED = 'activity.saved';
/**
 * 답이 만들어지는 **동안** 흐르는 조각입니다. 호스트가 스스로 밉니다.
 *
 * 정본은 `apps/native-host/src/tutor/delta.rs` 와 `crates/transport` 의 `PUSH_TUTOR_DELTA`
 * 입니다. `tutor.event` 와 달리 **`SessionEvent` 를 싣지 않습니다** — 저장소에 붙지 않고
 * `packages/contracts` 에도 없는, 잃어도 되는 화면 갱신 알림입니다. 정본은 언제나 뒤따르는
 * `answer.completed` 입니다.
 */
export const TUTOR_DELTA = 'tutor.delta';

/** 사람이 적은 질문 문장의 상한입니다. 호스트가 `question-too-long` 으로 거절하는 경계입니다. */
export const MAX_QUESTION_BYTES = 4096;

export interface PingEnvelope {
  type: typeof PING;
}

export interface EventAppendEnvelope {
  type: typeof EVENT_APPEND;
  periodId: string;
  event: SessionEvent;
}

export interface TutorAskEnvelope {
  type: typeof TUTOR_ASK;
  periodId: string;
  questionId: string;
  kind: string;
  word?: string;
  /** 사람이 적은 질문 문장입니다. 낱말만 붙잡았으면 칸 자체가 없습니다. */
  question?: string;
  provider: Answer['provider'];
  snapshot: QuestionSnapshot;
}

export interface TutorRetryEnvelope {
  type: typeof TUTOR_RETRY;
  periodId: string;
  questionId: string;
}

/** 로컬 SQLite에 남은 세션을 최근 순으로 읽습니다. */
export interface SessionListEnvelope {
  type: typeof SESSION_LIST;
}

/** 세션의 개수·시간·제목만 다시 읽습니다. */
export interface SessionGetSummaryEnvelope {
  type: typeof SESSION_GET_SUMMARY;
  sessionId: string;
}

/** 세션의 근거 순간과 자산 manifest를 V2 읽기 뷰로 받습니다. */
export interface SessionBundleEnvelope {
  type: typeof SESSION_BUNDLE;
  sessionId: string;
}

/** 정본 다섯 활동 묶음을 기존 세션에 원자적으로 저장합니다. */
export interface ActivitySaveEnvelope {
  type: typeof ACTIVITY_SAVE;
  sessionId: string;
  activitySet: ActivitySetV2;
}

/** 확장이 호스트로 보내는 것 전부입니다. */
export type HostEnvelope =
  | PingEnvelope
  | EventAppendEnvelope
  | FrameStoreMessage
  | TutorAskEnvelope
  | TutorRetryEnvelope
  | SessionListEnvelope
  | SessionGetSummaryEnvelope
  | SessionBundleEnvelope
  | ActivitySaveEnvelope;

export interface HelloReply {
  type: typeof HELLO;
  host?: string;
  version?: string;
  protocol?: number;
}

export interface EventAckReply {
  type: typeof EVENT_ACK;
  periodId: string;
  seq: number;
  id: string;
  /**
   * 같은 `id` 가 이미 들어 있었다는 뜻입니다.
   *
   * **성공으로 봅니다.** 확장이 끊겼다 다시 붙어 같은 줄을 다시 보내는 것이 정상 경로라
   * (사이드패널 닫기/열기 · 공유 페이지 새로고침), 여기서 실패로 처리하면 재전송이 영원히
   * 실패로 남습니다. `apps/native-host/README.md` §2-1 참고.
   */
  duplicate?: boolean;
}

export interface TutorAcceptedReply {
  type: typeof TUTOR_ACCEPTED;
  periodId: string;
  questionId: string;
}

export interface SessionListedReply {
  type: typeof SESSION_LISTED;
  sessions: readonly SessionSummaryV2[];
}

export interface SessionSummaryReply {
  type: typeof SESSION_SUMMARY;
  summary: SessionSummaryV2;
}

export interface SessionBundledReply {
  type: typeof SESSION_BUNDLED;
  bundle: SessionBundleV2;
}

export interface ActivitySavedReply {
  type: typeof ACTIVITY_SAVED;
  sessionId: string;
  activitySet: ActivitySetV2;
}

/** 호스트가 스스로 미는 것입니다. 부탁에 대한 답이 아니므로 대기열을 쓰지 않습니다. */
export interface TutorEventPush {
  type: typeof TUTOR_EVENT;
  periodId: string;
  event: SessionEvent;
}

/**
 * 답이 만들어지는 동안 흐르는 조각 하나입니다. 이것도 대기열을 쓰지 않습니다.
 *
 * ```text
 *   {"type":"tutor.delta","periodId":"…","questionId":"…","seq":0,"chars":7,"text":"그는 \"n"}
 *                                                          │      │        └ 지금까지 해독한 결론 **전체**
 *                                                          │      └ 지금까지 받은 날 본문 글자 수
 *                                                          └ 이 회차의 몇 번째 조각인지 (0 부터)
 * ```
 *
 * **`text` 는 증분이 아니라 그때까지의 결론 전체입니다.** 이어 붙이지 말고 갈아 끼웁니다.
 * 조각 하나를 놓쳐도 다음 조각이 화면을 올바르게 덮습니다.
 *
 * **`text` 는 없을 수 있습니다.** 모델이 아직 JSON 의 `conclusion` 칸에 닿지 않았다는 뜻이고,
 * 그때도 `chars` 는 자라므로 "무언가 오고 있다" 를 그릴 수 있습니다.
 */
export interface TutorDeltaPush {
  type: typeof TUTOR_DELTA;
  periodId: string;
  questionId: string;
  seq: number;
  chars: number;
  text?: string;
}

/** 호스트가 보내는 것 전부입니다. */
export type HostReply =
  | HelloReply
  | EventAckReply
  | FrameStoredMessage
  | TutorAcceptedReply
  | SessionListedReply
  | SessionSummaryReply
  | SessionBundledReply
  | ActivitySavedReply
  | TutorEventPush
  | HostErrorMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function isHelloReply(value: unknown): value is HelloReply {
  return isRecord(value) && value['type'] === HELLO;
}

export function isEventAckReply(value: unknown): value is EventAckReply {
  if (!isRecord(value) || value['type'] !== EVENT_ACK) return false;
  return (
    typeof value['periodId'] === 'string' &&
    typeof value['seq'] === 'number' &&
    typeof value['id'] === 'string'
  );
}

export function isTutorAcceptedReply(value: unknown): value is TutorAcceptedReply {
  if (!isRecord(value) || value['type'] !== TUTOR_ACCEPTED) return false;
  return typeof value['periodId'] === 'string' && typeof value['questionId'] === 'string';
}

export function isSessionListedReply(value: unknown): value is SessionListedReply {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['type', 'sessions']) ||
    value['type'] !== SESSION_LISTED ||
    !Array.isArray(value['sessions'])
  ) {
    return false;
  }
  return value['sessions'].every(isSessionSummaryV2);
}

export function isSessionSummaryReply(value: unknown): value is SessionSummaryReply {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['type', 'summary']) &&
    value['type'] === SESSION_SUMMARY &&
    isSessionSummaryV2(value['summary'])
  );
}

export function isSessionBundledReply(value: unknown): value is SessionBundledReply {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['type', 'bundle']) &&
    value['type'] === SESSION_BUNDLED &&
    isSessionBundleV2(value['bundle'])
  );
}

export function isActivitySavedReply(value: unknown): value is ActivitySavedReply {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['type', 'sessionId', 'activitySet']) &&
    value['type'] === ACTIVITY_SAVED &&
    isSafeSessionId(value['sessionId']) &&
    isActivitySetV2(value['activitySet'])
  );
}

export function isTutorEventPush(value: unknown): value is TutorEventPush {
  if (!isRecord(value) || value['type'] !== TUTOR_EVENT) return false;
  return typeof value['periodId'] === 'string' && isRecord(value['event']);
}

/**
 * 답이 만들어지는 동안 흐르는 조각인지입니다.
 *
 * `seq` 와 `chars` 가 **반드시** 있어야 합니다. 둘 중 하나라도 숫자가 아니면 화면이
 * `NaN` 으로 되감기 판정을 하게 되므로 여기서 막습니다. `text` 는 없어도 됩니다(아직
 * 결론 칸에 닿지 않은 조각).
 */
export function isTutorDeltaPush(value: unknown): value is TutorDeltaPush {
  if (!isRecord(value) || value['type'] !== TUTOR_DELTA) return false;
  if (typeof value['periodId'] !== 'string') return false;
  if (typeof value['questionId'] !== 'string' || value['questionId'].length === 0) return false;
  if (typeof value['seq'] !== 'number' || !Number.isFinite(value['seq'])) return false;
  if (typeof value['chars'] !== 'number' || !Number.isFinite(value['chars'])) return false;
  const text = value['text'];
  return text === undefined || typeof text === 'string';
}

/**
 * 호스트가 보낸 값이 우리가 아는 **답** 가운데 하나인지입니다.
 *
 * **자발 push 두 가지(`tutor.event` · `tutor.delta`)는 여기에 넣지 않습니다.** 이 함수가
 * 참을 내면 `host-client.ts` 의 `receive` 가 그 값을 대기열 맨 앞 부탁의 답으로 소비합니다.
 * push 는 부탁에 대한 답이 아니라서 한 번만 섞여도 그 뒤의 `event.ack`·`tutor.accepted`·
 * `error` 가 영구히 한 칸씩 밀립니다. push 는 `receive` 가 이 문지기보다 **먼저** 갈라냅니다.
 */
export function isHostReply(value: unknown): value is HostReply {
  return (
    isHelloReply(value) ||
    isEventAckReply(value) ||
    isFrameStoredMessage(value) ||
    isTutorAcceptedReply(value) ||
    isSessionListedReply(value) ||
    isSessionSummaryReply(value) ||
    isSessionBundledReply(value) ||
    isActivitySavedReply(value) ||
    isTutorEventPush(value) ||
    isHostErrorMessage(value)
  );
}

/**
 * 구조가 정상인 답이 FIFO 맨 앞의 부탁과 같은 왕복인지 확인합니다.
 * 다른 종류의 정상 답도 먼저 꺼내 버리면 그 뒤의 라이브 `event.ack`까지 한 칸씩 밀립니다.
 */
export function replyMatchesEnvelope(envelope: HostEnvelope, reply: HostReply): boolean {
  if (isHostErrorMessage(reply)) return reply.received === envelope.type;
  switch (envelope.type) {
    case PING:
      return isHelloReply(reply);
    case EVENT_APPEND:
      return (
        isEventAckReply(reply) &&
        reply.periodId === envelope.periodId &&
        reply.id === envelope.event.id
      );
    case 'frame.store':
      return (
        isFrameStoredMessage(reply) &&
        reply.periodId === envelope.periodId &&
        reply.id === envelope.frame.id
      );
    case TUTOR_ASK:
    case TUTOR_RETRY:
      return (
        isTutorAcceptedReply(reply) &&
        reply.periodId === envelope.periodId &&
        reply.questionId === envelope.questionId
      );
    case SESSION_LIST:
      return isSessionListedReply(reply);
    case SESSION_GET_SUMMARY:
      return isSessionSummaryReply(reply) && reply.summary.sessionId === envelope.sessionId;
    case SESSION_BUNDLE:
      return isSessionBundledReply(reply) && reply.bundle.sessionId === envelope.sessionId;
    case ACTIVITY_SAVE:
      return (
        isActivitySavedReply(reply) &&
        reply.sessionId === envelope.sessionId &&
        activitySetsEqual(reply.activitySet, envelope.activitySet)
      );
  }
}

/**
 * 이 부탁이 **끊겼을 때 들고 있다가 다시 보낼** 것인지입니다.
 *
 * 기록(`event.append`)과 프레임(`frame.store`)만 참입니다. 둘 다 호스트가 `id` 로 중복을
 * 걸러 주므로 두 번 보내도 안전합니다. `ping` 은 연결마다 새로 보내면 되고, `tutor.ask` 와
 * `tutor.retry` 는 사람이 기다리는 부탁이라 몇 분 뒤에 되살아나면 오히려 놀랍습니다.
 */
export function isResendable(
  envelope: HostEnvelope,
): envelope is EventAppendEnvelope | FrameStoreMessage {
  return envelope.type === EVENT_APPEND || envelope.type === 'frame.store';
}

export type { FrameStoreMessage, FrameStoredMessage, HostErrorMessage };
// 프레임 봉투의 좁힘 함수는 1라운드부터 `src/capture/host-messages.ts` 에 있습니다.
// 부르는 쪽이 두 파일을 오가지 않게 여기서 그대로 다시 냅니다.
export { isFrameStoredMessage, isHostErrorMessage };
