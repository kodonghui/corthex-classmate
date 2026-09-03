/**
 * 프레임 통(`NativeHostFrameSink`)과 도우미 연결(`NativeHostClient`)을 잇는 **한 겹**입니다.
 *
 * ```text
 *   NativeHostFrameSink ──store(봉투)──▶ 이 파일 ──host.send(봉투, {resend:false})──▶ NativeHostClient
 *                        ◀─결말 셋──────           ◀─replied · queued · dropped────
 * ```
 *
 * **왜 `resend:false` 인가**: 프레임을 다시 보내는 일은 통이 이미 맡고 있습니다
 * (`flushWaiting` · 순서 지키기 · 상한 넘으면 오래된 것부터 버리기). 연결 쪽도 같은 봉투를
 * 들고 있으면 도우미가 돌아왔을 때 **두 곳이 각각** 보냅니다. 뒤엣것은 `duplicate-frame` 으로
 * 돌아와 `onRejected` 를 타고, 화면 커넥터가 멀쩡한데도 호박색이 됩니다. 그래서 들고 있는
 * 자리를 통 하나로 못 박습니다.
 *
 * 이 판단을 `entrypoints/background.ts` 에 두지 않는 이유는 그쪽이 vitest 대상이 아니기
 * 때문입니다. 배선은 그쪽, 판단은 여기입니다.
 */

import type { FrameStoreOutcome, FrameStorePort } from '../capture/frame-sink';
import type { FrameStoreMessage } from '../capture/host-messages';
import type { HostSendOptions, HostSendResult } from './host-client';
import { isFrameStoredMessage, isHostErrorMessage } from './host-messages';

/** 이 한 겹이 도우미에게 바라는 얼굴입니다. `NativeHostClient` 가 이 모양입니다. */
export interface FrameHostGateway {
  send(envelope: FrameStoreMessage, options?: HostSendOptions): Promise<HostSendResult>;
}

/** 봉투 하나의 결말을 통이 아는 세 낱말로 옮깁니다. */
export function toFrameStoreOutcome(result: HostSendResult): FrameStoreOutcome {
  if (result.status !== 'replied') {
    // `queued` 는 이제 오지 않습니다(`resend:false`). `dropped` 는 통로 문제라 통이 들고
    // 있다가 다시 보냅니다.
    return { kind: 'offline' };
  }
  const reply = result.message;
  if (isFrameStoredMessage(reply)) {
    return { kind: 'stored', bytes: reply.bytes, seq: reply.seq };
  }
  if (isHostErrorMessage(reply)) {
    return { kind: 'rejected', reason: reply.reason };
  }
  return { kind: 'rejected', reason: 'unexpected-reply' };
}

/** 통이 쓸 출구 하나를 만듭니다. */
export function createFrameStorePort(host: FrameHostGateway): FrameStorePort {
  return {
    async store(message: FrameStoreMessage): Promise<FrameStoreOutcome> {
      return toFrameStoreOutcome(await host.send(message, { resend: false }));
    },
  };
}
