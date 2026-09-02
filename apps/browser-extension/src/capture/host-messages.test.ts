import { describe, expect, it } from 'vitest';
import { createValidator } from '@classmate/contracts';
import type { ScreenFrame } from '@classmate/contracts';
import {
  assertPeriodId,
  base64Length,
  buildFrameStore,
  framePathFor,
  fromBase64,
  isFrameStoredMessage,
  isHostErrorMessage,
  MAX_MESSAGE_BYTES,
  toBase64,
  utf8ByteLength,
} from './host-messages';

const PERIOD = '2026-09-02-p3';

function makeFrame(overrides: Partial<ScreenFrame> = {}): ScreenFrame {
  return {
    id: 'sf-p3-001',
    periodId: PERIOD,
    capturedAt: '2026-09-02T10:00:00.000Z',
    path: 'frames/sf-p3-001.webp',
    width: 1280,
    height: 720,
    hash: '0f1e2d3c4b5a6978',
    changedFromPrev: true,
    source: 'meet-tab',
    ...overrides,
  };
}

describe('base64', () => {
  it('길이 0~5 바이트를 채움 글자까지 맞춰 왕복합니다', () => {
    for (let length = 0; length <= 5; length += 1) {
      const bytes = Uint8Array.from({ length }, (_unused, index) => index * 37 + 1);
      const text = toBase64(bytes);
      expect(text.length % 4).toBe(0);
      expect(Array.from(fromBase64(text))).toEqual(Array.from(bytes));
    }
  });

  it('알려진 값과 정확히 같습니다', () => {
    // "Man" · "Ma" · "M" 은 base64 설명에 늘 나오는 표준 예입니다.
    expect(toBase64(new Uint8Array([77, 97, 110]))).toBe('TWFu');
    expect(toBase64(new Uint8Array([77, 97]))).toBe('TWE=');
    expect(toBase64(new Uint8Array([77]))).toBe('TQ==');
    expect(Array.from(fromBase64('TWFu'))).toEqual([77, 97, 110]);
    expect(Array.from(fromBase64('TWE='))).toEqual([77, 97]);
    expect(Array.from(fromBase64('TQ=='))).toEqual([77]);
  });

  it('0~255 를 모두 담은 배열도 그대로 돌아옵니다', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_unused, index) => index);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('모양이 깨진 문자열은 RangeError 로 막습니다', () => {
    expect(() => fromBase64('TWF')).toThrow(RangeError); // 4의 배수가 아님
    expect(() => fromBase64('TW!u')).toThrow(RangeError); // 쓸 수 없는 글자
    expect(() => fromBase64('T=Fu')).toThrow(RangeError); // 채움 글자 자리가 틀림
    expect(() => fromBase64('TQ==TWFu')).toThrow(RangeError); // 채움 글자 뒤에 글자가 더 있음
  });
});

describe('framePathFor', () => {
  it('경로를 식별자에서 계산합니다', () => {
    expect(framePathFor('sf-001')).toBe('frames/sf-001.webp');
    expect(framePathFor('sf-p3-001')).toBe('frames/sf-p3-001.webp');
    expect(framePathFor('sf-a_b-c')).toBe('frames/sf-a_b-c.webp');
  });

  it('규칙에 안 맞는 식별자는 RangeError 로 막습니다', () => {
    expect(() => framePathFor('001')).toThrow(RangeError); // sf- 로 시작하지 않음
    expect(() => framePathFor('sf-')).toThrow(RangeError); // 뒤가 비었음
    expect(() => framePathFor('sf-../../etc/passwd')).toThrow(RangeError); // 경로 탈출 시도
    expect(() => framePathFor('sf-001.webp')).toThrow(RangeError); // 점은 허용하지 않음
    expect(() => framePathFor(`sf-${'a'.repeat(61)}`)).toThrow(RangeError); // 너무 김
    expect(framePathFor(`sf-${'a'.repeat(60)}`)).toContain('frames/');
  });
});

describe('buildFrameStore', () => {
  it('계약 (가)의 봉투 모양 그대로 만듭니다', () => {
    const built = buildFrameStore(makeFrame(), new Uint8Array([1, 2, 3]));
    if (built.skipped) throw new Error('건너뛰면 안 되는 크기입니다');

    expect(built.message.type).toBe('frame.store');
    expect(built.message.periodId).toBe(PERIOD);
    expect(built.message.bytesBase64).toBe(toBase64(new Uint8Array([1, 2, 3])));
    expect(Object.keys(built.message).sort()).toEqual([
      'bytesBase64',
      'frame',
      'periodId',
      'type',
    ]);
  });

  it('frame 칸은 계약 아홉 칸 그대로여서 검증기를 통과합니다', () => {
    // 값 import(createValidator)는 시험에서만 씁니다. 제품 코드가 값으로 들여오면
    // Ajv 가 확장 번들에 섞여 MV3 콘텐츠 보안 정책에 걸립니다.
    const validate = createValidator<ScreenFrame>('screen-frame');
    const built = buildFrameStore(makeFrame(), new Uint8Array([9]));
    if (built.skipped) throw new Error('건너뛰면 안 되는 크기입니다');

    expect(validate(built.message.frame)).toBe(true);
  });

  it('path 는 확장이 준 문자열이 아니라 id 에서 다시 계산합니다', () => {
    // 확장이 엉뚱한 경로를 보내도 봉투에는 id 로 계산한 경로만 실립니다(Gate D 결정).
    const built = buildFrameStore(
      makeFrame({ path: '../../../secret/passwd' }),
      new Uint8Array([1]),
    );
    if (built.skipped) throw new Error('건너뛰면 안 되는 크기입니다');

    expect(built.message.frame.path).toBe('frames/sf-p3-001.webp');
  });

  it('식별자 형식이 틀리면 봉투를 만들지 않고 RangeError 로 막습니다', () => {
    expect(() => buildFrameStore(makeFrame({ id: 'frame-1' }), new Uint8Array([1]))).toThrow(
      RangeError,
    );
  });

  it('봉투가 정확히 1 MiB 면 보내고, 한 바이트라도 넘으면 건너뜁니다', () => {
    // 봉투 크기 = 고정 부분 + base64 길이입니다. base64 는 3바이트마다 4글자씩 늘어나므로
    // 고정 부분을 1바이트씩 움직여(hash 길이) 정확히 1 MiB 가 되는 지점을 찾습니다.
    let frame: ScreenFrame | null = null;
    let overhead = 0;
    for (let hashLength = 8; hashLength <= 64; hashLength += 1) {
      const candidate = makeFrame({ hash: 'a'.repeat(hashLength) });
      const empty = buildFrameStore(candidate, new Uint8Array(0));
      if (empty.skipped) continue;
      if ((MAX_MESSAGE_BYTES - empty.envelopeBytes) % 4 === 0) {
        frame = candidate;
        overhead = empty.envelopeBytes;
        break;
      }
    }
    expect(frame).not.toBeNull();
    if (!frame) return;

    const payloadLength = ((MAX_MESSAGE_BYTES - overhead) / 4) * 3;
    const exact = buildFrameStore(frame, new Uint8Array(payloadLength));
    expect(exact.envelopeBytes).toBe(MAX_MESSAGE_BYTES);
    expect(exact.skipped).toBe(false);

    const overByOne = buildFrameStore(frame, new Uint8Array(payloadLength + 1));
    expect(overByOne.skipped).toBe(true);
    if (!overByOne.skipped) return;
    expect(overByOne.reason).toBe('too-large');
    expect(overByOne.envelopeBytes).toBeGreaterThan(MAX_MESSAGE_BYTES);
  });

  it('envelopeBytes 는 직렬화한 봉투의 UTF-8 바이트 수와 같습니다', () => {
    // 크기는 base64 를 만들기 전에 산술로 냅니다(고정 부분 + base64 길이). 그래도 실제로
    // 직렬화한 값과 정확히 같아야 합니다. 길이가 4로 나누어떨어지는 경우와 아닌 경우를
    // 모두 봅니다(채움 글자 `=` 자리).
    for (const length of [0, 1, 2, 3, 5, 300]) {
      const built = buildFrameStore(makeFrame(), new Uint8Array(length));
      if (built.skipped) throw new Error('건너뛰면 안 되는 크기입니다');
      expect(built.envelopeBytes, `${length}바이트`).toBe(
        utf8ByteLength(JSON.stringify(built.message)),
      );
    }
  });

  it('교시 이름에 한글이 섞여도 UTF-8 바이트 수로 셉니다', () => {
    // 산술은 base64 부분에만 씁니다. 고정 부분은 여전히 진짜 UTF-8 길이를 재야 합니다.
    const built = buildFrameStore(makeFrame({ source: 'meet-tab' }), new Uint8Array([7, 7]));
    if (built.skipped) throw new Error('건너뛰면 안 되는 크기입니다');
    expect(built.envelopeBytes).toBe(utf8ByteLength(JSON.stringify(built.message)));
  });

  it('frame 칸에는 계약 아홉 칸만 담고 여분 칸은 떨어뜨립니다', () => {
    // 통 안의 모양(CapturedFrame)에는 bytes·mime 두 칸이 더 있습니다. 펼쳐 담으면 그 여분이
    // 봉투에 실려 호스트의 additionalProperties:false 검증에 걸립니다.
    const withExtras = {
      ...makeFrame(),
      bytes: 12_345,
      mime: 'image/webp',
      secretNote: '실려 나가면 안 되는 값',
    } as unknown as ScreenFrame;

    const built = buildFrameStore(withExtras, new Uint8Array([1]));
    if (built.skipped) throw new Error('건너뛰면 안 되는 크기입니다');

    expect(Object.keys(built.message.frame).sort()).toEqual([
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
    expect(built.message.frame).not.toHaveProperty('bytes');
    expect(built.message.frame).not.toHaveProperty('secretNote');

    const validate = createValidator<ScreenFrame>('screen-frame');
    expect(validate(built.message.frame)).toBe(true);
  });
});

describe('base64Length', () => {
  it('실제로 만들어 본 base64 문자열 길이와 같습니다', () => {
    for (let length = 0; length <= 40; length += 1) {
      const bytes = Uint8Array.from({ length }, (_unused, index) => index);
      expect(base64Length(length), `${length}바이트`).toBe(toBase64(bytes).length);
    }
  });
});

describe('assertPeriodId', () => {
  it('계약 모양이면 통과합니다', () => {
    expect(() => assertPeriodId('2026-09-02-p3')).not.toThrow();
    expect(() => assertPeriodId('2026-09-02-p12')).not.toThrow();
  });

  it('호스트가 거절할 이름을 여기서 먼저 막습니다', () => {
    // apps/native-host/src/store/frames.rs 의 is_contract_period_id 와 같은 규칙입니다.
    for (const bad of ['', 'p3', '2026-09-02', '2026-9-2-p3', '2026-09-02-p0', '../etc/passwd']) {
      expect(() => assertPeriodId(bad), bad).toThrow(RangeError);
    }
  });
});

describe('호스트가 보낸 답 판별', () => {
  it('frame.stored 를 알아봅니다', () => {
    expect(
      isFrameStoredMessage({
        type: 'frame.stored',
        periodId: PERIOD,
        id: 'sf-p3-001',
        path: 'frames/sf-p3-001.webp',
        bytes: 12_345,
        seq: 10,
      }),
    ).toBe(true);

    expect(isFrameStoredMessage({ type: 'frame.stored', periodId: PERIOD })).toBe(false);
    expect(isFrameStoredMessage({ type: 'frame.store' })).toBe(false);
    expect(isFrameStoredMessage(null)).toBe(false);
    expect(isFrameStoredMessage('frame.stored')).toBe(false);
  });

  it('error 를 알아봅니다', () => {
    expect(
      isHostErrorMessage({
        type: 'error',
        message: 'frame store failed',
        reason: 'disk full',
        received: 'frame.store',
      }),
    ).toBe(true);

    expect(isHostErrorMessage({ type: 'error', message: '실패' })).toBe(false);
    expect(isHostErrorMessage([])).toBe(false);
    expect(isHostErrorMessage(undefined)).toBe(false);
  });
});
