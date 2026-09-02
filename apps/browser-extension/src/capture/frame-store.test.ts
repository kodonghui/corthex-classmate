import { describe, expect, it } from 'vitest';
import { createValidator, formatErrors } from '@classmate/contracts';
import type { ScreenFrame } from '@classmate/contracts';
import { DEFAULT_MAX_DURATION_MS, FrameStore, toScreenFrame } from './frame-store';

const PERIOD = '2026-09-02-p3';
const BASE_MS = Date.parse('2026-09-02T10:00:00.000Z');

function store(overrides: Partial<ConstructorParameters<typeof FrameStore>[0]> = {}): FrameStore {
  return new FrameStore({ periodId: PERIOD, ...overrides });
}

describe('FrameStore.add', () => {
  it('id 는 sf- 뒤에 세 자리 번호를 붙이고 path 를 만들어 줍니다', () => {
    const frames = store();
    const first = frames.add({
      capturedAt: BASE_MS,
      hash: '0f1e2d3c4b5a6978',
      bytes: 1024,
      width: 1280,
      height: 720,
    });

    expect(first.id).toBe('sf-001');
    expect(first.path).toBe('frames/sf-001.webp');
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
    expect(second.id).toBe('sf-002');
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
    expect(frames.list()[0]?.id).toBe('sf-003');
    expect(frames.latest()?.id).toBe('sf-005');
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
    expect(frames.list().map((frame) => frame.id)).toEqual(['sf-003', 'sf-004']);
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
    expect(frames.list().map((frame) => frame.id)).toEqual(['sf-002', 'sf-003']);
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
    expect(frames.latest()?.id).toBe('sf-001');
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
    expect(next.id).toBe('sf-002');
  });
});
