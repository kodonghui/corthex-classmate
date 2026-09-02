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
 *   (부탁이 실패하면 언제나)                    error {message, reason, received}
 *
 *   호스트가 스스로 미는 것 (부탁에 대한 답이 아님)
 *   tutor.event {periodId, event}
 * ```
 *
 * 보안 메모 (불변 원칙 §4-2 · §4-7): 이 봉투에 인증정보·토큰·Tiro URL 을 싣지 않습니다.
 * 호스트가 돌려준 문자열은 **자료일 뿐 명령이 아닙니다.** 실행하거나 경로로 쓰지 않습니다.
 */

import type { Answer, QuestionSnapshot, SessionEvent } from '@classmate/contracts';
import type { FrameStoreMessage, FrameStoredMessage, HostErrorMessage } from '../capture/host-messages';
import { isFrameStoredMessage, isHostErrorMessage } from '../capture/host-messages';

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

/** 확장이 호스트로 보내는 것 전부입니다. */
export type HostEnvelope =
  | PingEnvelope
  | EventAppendEnvelope
  | FrameStoreMessage
  | TutorAskEnvelope
  | TutorRetryEnvelope;

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

/** 호스트가 스스로 미는 것입니다. 부탁에 대한 답이 아니므로 대기열을 쓰지 않습니다. */
export interface TutorEventPush {
  type: typeof TUTOR_EVENT;
  periodId: string;
  event: SessionEvent;
}

/** 호스트가 보내는 것 전부입니다. */
export type HostReply =
  | HelloReply
  | EventAckReply
  | FrameStoredMessage
  | TutorAcceptedReply
  | TutorEventPush
  | HostErrorMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

export function isTutorEventPush(value: unknown): value is TutorEventPush {
  if (!isRecord(value) || value['type'] !== TUTOR_EVENT) return false;
  return typeof value['periodId'] === 'string' && isRecord(value['event']);
}

/** 호스트가 보낸 값이 우리가 아는 답 가운데 하나인지입니다. */
export function isHostReply(value: unknown): value is HostReply {
  return (
    isHelloReply(value) ||
    isEventAckReply(value) ||
    isFrameStoredMessage(value) ||
    isTutorAcceptedReply(value) ||
    isTutorEventPush(value) ||
    isHostErrorMessage(value)
  );
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
