import { describe, expect, it } from 'vitest';

import type { SessionEvent, TranscriptSegment } from '@classmate/contracts';
import type { LiveInboundMessage } from '../live/messages';
import { LIVE_EVENT, LIVE_SEGMENT } from '../live/messages';
import { PeriodLog } from './period-log';

const PERIOD = '2026-09-02-p3';

function segment(seq: number): TranscriptSegment {
  return {
    id: `ts-p3-${String(seq).padStart(3, '0')}`,
    periodId: PERIOD,
    seq,
    text: `${seq}번째 문장입니다`,
    state: 'final',
    arrivedAt: '2026-09-02T10:31:40+09:00',
    source: 'tiro-share',
  };
}

function segmentMessage(seq: number): LiveInboundMessage {
  return { type: LIVE_SEGMENT, segment: segment(seq) };
}

function eventMessage(id: string): LiveInboundMessage {
  const event: SessionEvent = {
    id,
    periodId: PERIOD,
    at: '2026-09-02T10:31:40+09:00',
    type: 'panel.opened',
    payload: {},
  };
  return { type: LIVE_EVENT, event };
}

describe('PeriodLog', () => {
  it('담은 순서 그대로 되풀이합니다', () => {
    const log = new PeriodLog();
    log.reset(PERIOD);
    log.append(segmentMessage(1));
    log.append(eventMessage('ev-1'));
    log.append(segmentMessage(2));

    expect(log.replay().map((message) => message.type)).toEqual([
      LIVE_SEGMENT,
      LIVE_EVENT,
      LIVE_SEGMENT,
    ]);
  });

  it('세그먼트 **본문**을 그대로 들고 있습니다 (요약본이 아닙니다)', () => {
    const log = new PeriodLog();
    log.reset(PERIOD);
    log.append(segmentMessage(7));

    const [first] = log.replay();
    expect(first?.type).toBe(LIVE_SEGMENT);
    if (first?.type === LIVE_SEGMENT) {
      expect(first.segment.text).toBe('7번째 문장입니다');
      expect(first.segment.id).toBe('ts-p3-007');
    }
  });

  it('상한을 넘으면 오래된 것부터 버립니다', () => {
    const log = new PeriodLog(3);
    log.reset(PERIOD);
    for (let seq = 1; seq <= 5; seq += 1) log.append(segmentMessage(seq));

    const seqs = log.replay().map((message) => (message.type === LIVE_SEGMENT ? message.segment.seq : -1));
    expect(seqs).toEqual([3, 4, 5]);
    expect(log.size).toBe(3);
  });

  it('기본 상한은 고정 계약의 500건입니다', () => {
    expect(new PeriodLog().limit).toBe(500);
  });

  it('교시가 바뀌면 앞 교시 기록을 버립니다', () => {
    const log = new PeriodLog();
    log.reset(PERIOD);
    log.append(segmentMessage(1));
    log.reset('2026-09-02-p4');

    expect(log.replay()).toEqual([]);
    expect(log.periodId).toBe('2026-09-02-p4');
  });

  it('같은 교시로 다시 부르면 기록을 지우지 않습니다', () => {
    const log = new PeriodLog();
    log.reset(PERIOD);
    log.append(segmentMessage(1));
    log.reset(PERIOD);

    expect(log.size).toBe(1);
  });

  it('저장소를 오갔다 와도 되풀이할 내용이 같습니다 (서비스 워커가 내려갔다 뜨는 경우)', () => {
    const before = new PeriodLog();
    before.reset(PERIOD);
    before.append(segmentMessage(1));
    before.append(eventMessage('ev-1'));

    // 저장소는 JSON 으로 오갑니다. 되돌아온 값이 같은지 봅니다.
    const roundTripped: unknown = JSON.parse(JSON.stringify(before.snapshot()));

    const after = new PeriodLog();
    expect(after.restore(roundTripped)).toBe(true);
    expect(after.periodId).toBe(PERIOD);
    expect(after.replay()).toEqual(before.replay());
  });

  it('상한 몫보다 큰 눈뭉치를 되살리면 최근 것만 남깁니다', () => {
    const log = new PeriodLog(2);
    const restored = log.restore({
      periodId: PERIOD,
      entries: [segmentMessage(1), segmentMessage(2), segmentMessage(3)],
    });
    expect(restored).toBe(true);
    expect(log.size).toBe(2);
  });

  it('상한 눈뭉치가 상했으면 던지지 않고 false 로 답합니다', () => {
    const log = new PeriodLog();
    expect(log.restore(null)).toBe(false);
    expect(log.restore({ periodId: 3, entries: [] })).toBe(false);
    expect(log.restore({ periodId: PERIOD, entries: 'nope' })).toBe(false);
    expect(log.size).toBe(0);
  });

  it('상한은 1 이상이어야 합니다', () => {
    expect(() => new PeriodLog(0)).toThrow(RangeError);
  });
});
