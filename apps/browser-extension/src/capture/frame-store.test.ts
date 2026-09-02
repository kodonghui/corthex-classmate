import { describe, expect, it } from 'vitest';
import { createValidator, formatErrors } from '@classmate/contracts';
import type { ScreenFrame } from '@classmate/contracts';
import {
  compactUtcTime,
  DEFAULT_MAX_DURATION_MS,
  frameIdPrefix,
  FrameStore,
  periodSegment,
  toScreenFrame,
} from './frame-store';
import { SCREEN_FRAME_ID_PATTERN } from './host-messages';

const PERIOD = '2026-09-02-p3';
const BASE_MS = Date.parse('2026-09-02T10:00:00.000Z');

/** 시작 시각을 고정해 두면 id 가운데 여섯 자리가 `100000` 으로 확정됩니다. */
const ID_PREFIX = 'sf-p3-100000-';

function store(overrides: Partial<ConstructorParameters<typeof FrameStore>[0]> = {}): FrameStore {
  return new FrameStore({ periodId: PERIOD, startedAt: BASE_MS, ...overrides });
}

describe('FrameStore.add', () => {
  it('id 는 교시·시작 시각·순번을 이어 붙이고 path 를 만들어 줍니다', () => {
    const frames = store();
    const first = frames.add({
      capturedAt: BASE_MS,
      hash: '0f1e2d3c4b5a6978',
      bytes: 1024,
      width: 1280,
      height: 720,
    });

    expect(first.id).toBe(`${ID_PREFIX}001`);
    expect(first.path).toBe(`frames/${ID_PREFIX}001.webp`);
    expect(first.periodId).toBe(PERIOD);
    expect(first.source).toBe('meet-tab');
    expect(first.mime).toBe('image/webp');
    expect(first.capturedAt).toBe('2026-09-02T10:00:00.000Z');

    const second = frames.add({
      capturedAt: BASE_MS + 1000,
      hash: 'ffffffffffffffff',
      bytes: 2048,
      width: 1280,
      height: 720,
    });
    expect(second.id).toBe(`${ID_PREFIX}002`);
    expect(frames.totalBytes).toBe(3072);
  });

  it('계약으로 내보내면 bytes 와 mime 두 칸이 떨어집니다', () => {
    const frames = store();
    const frame = frames.add({
      capturedAt: BASE_MS,
      hash: 'abcdef0123456789',
      bytes: 999,
      width: 1280,
      height: 720,
    });

    const record = toScreenFrame(frame);
    expect(Object.keys(record).sort()).toEqual([
      'capturedAt',
      'changedFromPrev',
      'hash',
      'height',
      'id',
      'path',
      'periodId',
      'source',
      'width',
    ]);
    expect(record).not.toHaveProperty('bytes');
    expect(frames.toScreenFrames()).toHaveLength(1);
  });

  it('계약 정본 screen-frame.schema.json 의 검증기를 통과합니다', () => {
    // 여기서만 값 import(createValidator)를 씁니다. 제품 코드(src/**·entrypoints/**)는
    // `import type` 만 씁니다. 값으로 들여오면 Ajv 가 확장 번들에 섞여 MV3 의 콘텐츠
    // 보안 정책에 걸립니다.
    const validate = createValidator<ScreenFrame>('screen-frame');
    const frames = store();

    frames.add({
      capturedAt: BASE_MS,
      hash: 'abcdef0123456789',
      bytes: 12_345,
      width: 1280,
      height: 720,
    });
    frames.add({
      capturedAt: BASE_MS + 1000,
      hash: 'ffffffffffffffff',
      bytes: 2048,
      width: 640,
      height: 360,
      changedFromPrev: false,
    });

    const records = frames.toScreenFrames();
    expect(records).toHaveLength(2);
    for (const record of records) {
      expect(validate(record), formatErrors(validate.errors).join(' · ')).toBe(true);
    }
  });

  it('통 안의 모양(bytes·mime 포함)은 계약이 거절합니다 · additionalProperties false', () => {
    const validate = createValidator<ScreenFrame>('screen-frame');
    const frames = store();
    const captured = frames.add({
      capturedAt: BASE_MS,
      hash: 'abcdef0123456789',
      bytes: 12_345,
      width: 1280,
      height: 720,
    });

    // 통 모양 그대로는 계약에 안 맞고, toScreenFrame 을 거친 것만 맞습니다.
    expect(validate(captured)).toBe(false);
    expect(validate(toScreenFrame(captured))).toBe(true);
  });

  it('해시와 바이트 수가 올바르지 않으면 RangeError 로 막습니다', () => {
    const frames = store();
    expect(() =>
      frames.add({ capturedAt: BASE_MS, hash: 'NOT-HEX', bytes: 1, width: 1, height: 1 }),
    ).toThrow(RangeError);
    expect(() =>
      frames.add({ capturedAt: BASE_MS, hash: 'abcd1234', bytes: -1, width: 1, height: 1 }),
    ).toThrow(RangeError);
    expect(() =>
      frames.add({ capturedAt: '날짜 아님', hash: 'abcd1234', bytes: 1, width: 1, height: 1 }),
    ).toThrow(RangeError);
  });

  it('교시 식별자가 없으면 통을 만들지 못합니다', () => {
    expect(() => new FrameStore({ periodId: '' })).toThrow(RangeError);
    expect(() => new FrameStore({ periodId: PERIOD, maxBytes: 0 })).toThrow(RangeError);
  });
});

describe('프레임 id 는 교시와 캡처 시작 시각을 담습니다', () => {
  it('periodSegment 는 교시 조각만 뽑습니다', () => {
    expect(periodSegment('2026-09-02-p3')).toBe('p3');
    expect(periodSegment('2026-09-02-p12')).toBe('p12');
    expect(periodSegment('2026-12-31-p1')).toBe('p1');
  });

  it('periodSegment 는 계약 모양이 아닌 이름을 RangeError 로 막습니다', () => {
    // 호스트의 `is_contract_period_id` 와 같은 규칙입니다. 여기서 막지 않으면 한 시간 모은
    // 장이 호스트에서 통째로 거절됩니다.
    for (const bad of ['p3', '2026-09-02', '2026-09-02-p0', '2026-9-2-p3', '2026-09-02-p3/x']) {
      expect(() => periodSegment(bad), bad).toThrow(RangeError);
    }
  });

  it('compactUtcTime 은 시분초 여섯 자리를 UTC 로 적습니다', () => {
    expect(compactUtcTime(Date.parse('2026-09-02T10:32:10.000Z'))).toBe('103210');
    expect(compactUtcTime(Date.parse('2026-09-02T00:00:00.000Z'))).toBe('000000');
    expect(compactUtcTime(new Date('2026-09-02T23:59:59.999Z'))).toBe('235959');
    expect(() => compactUtcTime('시각 아님')).toThrow(RangeError);
  });

  it('만들어진 id 는 계약 정규식 ^sf-[A-Za-z0-9_-]{1,60}$ 를 통과합니다', () => {
    const frames = store();
    for (let i = 0; i < 3; i += 1) {
      const frame = frames.add({
        capturedAt: BASE_MS + i * 1000,
        hash: 'abcdef0123456789',
        bytes: 10,
        width: 1280,
        height: 720,
      });
      expect(SCREEN_FRAME_ID_PATTERN.test(frame.id), frame.id).toBe(true);
      expect(frame.path).toBe(`frames/${frame.id}.webp`);
    }
  });

  it('같은 교시에서 캡처를 다시 켜면 앞 세션과 id 가 겹치지 않습니다', () => {
    // 예전에는 통을 새로 만들 때마다 sf-001 부터 다시 붙어, 호스트가 같은 교시의 재시작분을
    // duplicate-frame 으로 전량 거절했습니다.
    const input = {
      capturedAt: BASE_MS,
      hash: 'abcdef0123456789',
      bytes: 10,
      width: 1280,
      height: 720,
    };

    const first = new FrameStore({ periodId: PERIOD, startedAt: BASE_MS });
    const second = new FrameStore({ periodId: PERIOD, startedAt: BASE_MS + 90_000 });

    const firstId = first.add(input).id;
    const secondId = second.add(input).id;

    expect(firstId).toBe('sf-p3-100000-001');
    expect(secondId).toBe('sf-p3-100130-001');
    expect(firstId).not.toBe(secondId);
  });

  it('교시가 다르면 id 도 다릅니다', () => {
    expect(frameIdPrefix('2026-09-02-p3', BASE_MS)).toBe('sf-p3-100000-');
    expect(frameIdPrefix('2026-09-02-p4', BASE_MS)).toBe('sf-p4-100000-');
  });

  it('id 가 61글자를 넘길 교시 번호는 통을 만들 때 바로 막습니다', () => {
    // 장을 담기 시작한 뒤가 아니라 지금 막혀야 합니다. 계약 정규식은 sf- 뒤 60글자까지입니다.
    const absurd = `2026-09-02-p${'9'.repeat(60)}`;
    expect(() => new FrameStore({ periodId: absurd, startedAt: BASE_MS })).toThrow(RangeError);
  });

  it('1000번째 장은 네 자리로 이어지고 규칙도 그대로 지킵니다', () => {
    const frames = store({ maxFrames: 2 });
    let last = '';
    for (let i = 0; i < 1000; i += 1) {
      last = frames.add({
        capturedAt: BASE_MS + i,
        hash: 'abcdef0123456789',
        bytes: 1,
        width: 8,
        height: 8,
      }).id;
    }
    expect(last).toBe(`${ID_PREFIX}1000`);
    expect(SCREEN_FRAME_ID_PATTERN.test(last)).toBe(true);
  });
});

describe('FrameStore 상한', () => {
  it('바이트 상한을 넘으면 오래된 것부터 버립니다', () => {
    const frames = store({ maxBytes: 3000 });
    for (let i = 0; i < 5; i += 1) {
      frames.add({
        capturedAt: BASE_MS + i * 1000,
        hash: 'abcdef0123456789',
        bytes: 1000,
        width: 1280,
        height: 720,
      });
    }

    expect(frames.size).toBe(3);
    expect(frames.totalBytes).toBe(3000);
    expect(frames.droppedFrames).toBe(2);
    expect(frames.list()[0]?.id).toBe(`${ID_PREFIX}003`);
    expect(frames.latest()?.id).toBe(`${ID_PREFIX}005`);
  });

  it('장 수 상한을 넘으면 오래된 것부터 버립니다', () => {
    const frames = store({ maxFrames: 2 });
    for (let i = 0; i < 4; i += 1) {
      frames.add({
        capturedAt: BASE_MS + i * 1000,
        hash: 'abcdef0123456789',
        bytes: 10,
        width: 1280,
        height: 720,
      });
    }
    expect(frames.list().map((frame) => frame.id)).toEqual([`${ID_PREFIX}003`, `${ID_PREFIX}004`]);
  });

  it('교시 60분을 넘긴 장은 버립니다', () => {
    const frames = store();
    expect(frames.maxDurationMs).toBe(DEFAULT_MAX_DURATION_MS);

    frames.add({
      capturedAt: BASE_MS,
      hash: 'abcdef0123456789',
      bytes: 10,
      width: 1280,
      height: 720,
    });
    frames.add({
      capturedAt: BASE_MS + 30 * 60 * 1000,
      hash: 'abcdef0123456789',
      bytes: 10,
      width: 1280,
      height: 720,
    });
    expect(frames.size).toBe(2);

    // 첫 장에서 60분 1초가 지난 장이 들어오면 첫 장이 밀려납니다.
    frames.add({
      capturedAt: BASE_MS + 60 * 60 * 1000 + 1000,
      hash: 'abcdef0123456789',
      bytes: 10,
      width: 1280,
      height: 720,
    });
    expect(frames.list().map((frame) => frame.id)).toEqual([`${ID_PREFIX}002`, `${ID_PREFIX}003`]);
    expect(frames.droppedFrames).toBe(1);
  });

  it('상한이 아무리 좁아도 마지막 한 장은 남깁니다', () => {
    const frames = store({ maxBytes: 1 });
    frames.add({
      capturedAt: BASE_MS,
      hash: 'abcdef0123456789',
      bytes: 5000,
      width: 1280,
      height: 720,
    });
    expect(frames.size).toBe(1);
    expect(frames.latest()?.id).toBe(`${ID_PREFIX}001`);
  });

  it('stats 는 지금 몇 장·몇 바이트·몇 장 버렸는지 알려 줍니다', () => {
    const frames = store({ maxFrames: 2 });
    for (let i = 0; i < 3; i += 1) {
      frames.add({
        capturedAt: BASE_MS + i * 1000,
        hash: 'abcdef0123456789',
        bytes: 100,
        width: 1280,
        height: 720,
      });
    }

    expect(frames.stats()).toEqual({
      frames: 2,
      totalBytes: 200,
      droppedFrames: 1,
      droppedBytes: 100,
      oldestCapturedAt: '2026-09-02T10:00:01.000Z',
      newestCapturedAt: '2026-09-02T10:00:02.000Z',
    });
  });

  it('clear 는 통을 비우되 id 번호는 이어서 갑니다', () => {
    const frames = store();
    frames.add({
      capturedAt: BASE_MS,
      hash: 'abcdef0123456789',
      bytes: 10,
      width: 1280,
      height: 720,
    });
    frames.clear();
    expect(frames.size).toBe(0);
    expect(frames.totalBytes).toBe(0);

    const next = frames.add({
      capturedAt: BASE_MS + 1000,
      hash: 'abcdef0123456789',
      bytes: 10,
      width: 1280,
      height: 720,
    });
    expect(next.id).toBe(`${ID_PREFIX}002`);
  });
});
