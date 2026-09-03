/**
 * 한 장 찍기(`captureVisibleTab` 갈래)의 시험입니다.
 *
 * 이 파일은 브라우저 없이 돕니다. `chrome` 을 주입식으로 받게 만들어 두었기 때문에
 * 가짜 탭 하나만 있으면 "Meet 이 아니면 안 찍는다" 같은 성질을 표로 확인할 수 있습니다.
 */

import { describe, expect, it } from 'vitest';

import { toBase64 } from './host-messages';
import type { SnapshotChromeLike, SnapshotTabLike } from './snapshot';
import {
  SNAPSHOT_JPEG_QUALITY,
  buildSnapshotFrame,
  captureMeetTab,
  contentFingerprint,
  decodeJpegDataUrl,
  isMeetUrl,
  readJpegSize,
} from './snapshot';

const PERIOD = '2026-09-02-p3';
const MEET_URL = 'https://meet.google.com/abc-defg-hij';

/**
 * 시험용 JPEG 한 장입니다. **진짜 그림은 아니고 표지만 제대로 놓은 껍데기**입니다.
 *
 * ```text
 *   FF D8              SOI
 *   FF E0 00 04 00 00  APP0 (길이 4 = 길이 칸 2 + 내용 2)
 *   FF C0 00 11 …      SOF0 (정밀도 1 + 세로 2 + 가로 2 + 성분 10 = 15, 길이 17)
 *   FF D9              EOI
 *   <tail>             같은 크기라도 바이트가 다르게 만드는 꼬리
 * ```
 */
function jpegBytes(width: number, height: number, tail = 0): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
    tail & 0xff,
  ]);
}

function jpegDataUrl(width: number, height: number, tail = 0): string {
  return `data:image/jpeg;base64,${toBase64(jpegBytes(width, height, tail))}`;
}

interface FakeChrome extends SnapshotChromeLike {
  /** `captureVisibleTab` 이 받은 인자들입니다. 한 번도 안 불렸으면 빈 배열입니다. */
  readonly shots: { windowId: number; format: string; quality: number }[];
}

interface FakeChromeOptions {
  tab?: SnapshotTabLike | undefined;
  /** 활성 탭이 하나도 없게 합니다. */
  noTab?: boolean;
  dataUrl?: string;
  /** `tabs.query` 가 던지게 합니다. */
  queryThrows?: boolean;
  /** `captureVisibleTab` 이 던지게 합니다. */
  captureThrows?: boolean;
}

function fakeChrome(options: FakeChromeOptions = {}): FakeChrome {
  const shots: { windowId: number; format: string; quality: number }[] = [];
  const tab: SnapshotTabLike = options.tab ?? { url: MEET_URL, windowId: 7 };

  return {
    shots,
    tabs: {
      query: async () => {
        if (options.queryThrows === true) throw new Error('탭을 읽지 못했어요');
        return options.noTab === true ? [] : [tab];
      },
      captureVisibleTab: async (windowId, imageOptions) => {
        shots.push({ windowId, format: imageOptions.format, quality: imageOptions.quality });
        if (options.captureThrows === true) throw new Error('activeTab 권한이 없어요');
        return options.dataUrl ?? jpegDataUrl(1280, 720);
      },
    },
  };
}

// ── 순수 함수 ─────────────────────────────────────────────────────────────

describe('readJpegSize', () => {
  it('SOF 표지에서 가로·세로를 읽습니다', () => {
    expect(readJpegSize(jpegBytes(1920, 1080))).toEqual({ width: 1920, height: 1080 });
  });

  it('JPEG 이 아니면 null 입니다', () => {
    expect(readJpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(readJpegSize(new Uint8Array([]))).toBeNull();
  });

  it('SOF 를 만나기 전에 압축 데이터(SOS)가 시작되면 null 입니다', () => {
    // FF D8 SOI · FF DA SOS — 크기를 적어 둔 표지가 없는 그림입니다.
    expect(readJpegSize(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02]))).toBeNull();
  });

  it('가로나 세로가 0 이면 null 입니다 (계약은 1 이상만 받습니다)', () => {
    expect(readJpegSize(jpegBytes(0, 720))).toBeNull();
  });
});

describe('isMeetUrl', () => {
  const cases: [string | undefined, boolean][] = [
    ['https://meet.google.com/abc-defg-hij', true],
    ['https://meet.google.com/', true],
    // 주소가 아예 없는 탭(호스트 권한이 없어 url 이 비어 옵니다)
    [undefined, false],
    ['', false],
    // http 는 안 됩니다. host_permissions 도 https 만 적어 두었습니다.
    ['http://meet.google.com/abc', false],
    // 이름이 닮았을 뿐인 다른 호스트
    ['https://meet.google.com.evil.example/abc', false],
    ['https://notmeet.google.com/abc', false],
    // 문자열 포함으로 속이려는 주소 — 호스트 이름을 따로 꺼내 견주므로 걸리지 않습니다
    ['https://evil.example/?next=https://meet.google.com/abc', false],
    ['chrome://newtab', false],
    ['그냥 글자', false],
  ];

  it.each(cases)('%s → %s', (url, expected) => {
    expect(isMeetUrl(url)).toBe(expected);
  });
});

describe('contentFingerprint', () => {
  it('소문자 16진 16글자입니다 (계약 hash 칸이 요구하는 모양)', () => {
    expect(contentFingerprint(jpegBytes(1280, 720))).toMatch(/^[0-9a-f]{16}$/);
  });

  it('바이트가 달라지면 값도 달라집니다', () => {
    const a = contentFingerprint(jpegBytes(1280, 720, 1));
    const b = contentFingerprint(jpegBytes(1280, 720, 2));
    expect(a).not.toBe(b);
  });

  it('같은 바이트면 같은 값입니다', () => {
    expect(contentFingerprint(jpegBytes(1280, 720, 9))).toBe(
      contentFingerprint(jpegBytes(1280, 720, 9)),
    );
  });
});

describe('buildSnapshotFrame', () => {
  const snapshot = { bytes: jpegBytes(1280, 720, 3), width: 1280, height: 720 };

  it('계약 아홉 칸을 채웁니다', () => {
    const frame = buildSnapshotFrame({
      periodId: PERIOD,
      capturedAt: new Date('2026-09-02T10:32:10Z'),
      sequence: 1,
      snapshot,
    });

    expect(frame.id).toBe('sf-p3-ask-103210-001');
    expect(frame.periodId).toBe(PERIOD);
    expect(frame.capturedAt).toBe('2026-09-02T10:32:10.000Z');
    // path 는 확장이 지은 문자열이 아니라 id 에서 다시 계산한 값입니다(Gate D 결정).
    expect(frame.path).toBe('frames/sf-p3-ask-103210-001.webp');
    expect(frame.width).toBe(1280);
    expect(frame.height).toBe(720);
    expect(frame.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(frame.changedFromPrev).toBe(true);
    expect(frame.source).toBe('meet-tab');
  });

  it('연속 캡처 길이 짓는 이름표와 겹치지 않습니다', () => {
    const frame = buildSnapshotFrame({
      periodId: PERIOD,
      capturedAt: new Date('2026-09-02T10:32:10Z'),
      sequence: 1,
      snapshot,
    });
    // 파이프라인 쪽은 `sf-p3-103210-001` 입니다. 가운데 `ask` 가 두 길을 갈라 줍니다.
    expect(frame.id).not.toBe('sf-p3-103210-001');
    expect(frame.id).toContain('-ask-');
  });

  it('교시 이름표가 계약 모양이 아니면 던집니다 (부르는 쪽이 잡습니다)', () => {
    expect(() =>
      buildSnapshotFrame({
        periodId: '3교시',
        capturedAt: new Date('2026-09-02T10:32:10Z'),
        sequence: 1,
        snapshot,
      }),
    ).toThrow(RangeError);
  });
});

// ── captureMeetTab ────────────────────────────────────────────────────────

describe('captureMeetTab', () => {
  it('활성 탭이 Meet 이면 JPEG 한 장을 찍습니다', async () => {
    const chromeLike = fakeChrome({ dataUrl: jpegDataUrl(1920, 1080) });

    const shot = await captureMeetTab(chromeLike);

    expect(shot).not.toBeNull();
    expect(shot?.width).toBe(1920);
    expect(shot?.height).toBe(1080);
    expect(shot?.bytes.byteLength).toBeGreaterThan(0);
    expect(chromeLike.shots).toEqual([
      { windowId: 7, format: 'jpeg', quality: SNAPSHOT_JPEG_QUALITY },
    ]);
  });

  it('활성 탭이 Meet 이 아니면 **찍지 않고** null 입니다', async () => {
    const chromeLike = fakeChrome({ tab: { url: 'https://www.notion.so/secret', windowId: 7 } });

    expect(await captureMeetTab(chromeLike)).toBeNull();
    // 셔터 자체를 누르지 않았습니다. 다른 사이트가 한 장도 남지 않는 자리입니다.
    expect(chromeLike.shots).toEqual([]);
  });

  it('탭 주소가 안 보이면(호스트 권한 없음) 찍지 않습니다', async () => {
    const chromeLike = fakeChrome({ tab: { windowId: 7 } });

    expect(await captureMeetTab(chromeLike)).toBeNull();
    expect(chromeLike.shots).toEqual([]);
  });

  it('활성 탭이 아예 없으면 null 입니다', async () => {
    const chromeLike = fakeChrome({ noTab: true });

    expect(await captureMeetTab(chromeLike)).toBeNull();
    expect(chromeLike.shots).toEqual([]);
  });

  it('탭을 읽다 실패해도 던지지 않고 null 입니다', async () => {
    const warnings: string[] = [];
    const chromeLike = fakeChrome({ queryThrows: true });

    expect(await captureMeetTab(chromeLike, { warn: (m) => warnings.push(m) })).toBeNull();
    expect(warnings).toHaveLength(1);
  });

  it('찍다 실패해도 던지지 않고 null 입니다', async () => {
    const warnings: string[] = [];
    const chromeLike = fakeChrome({ captureThrows: true });

    expect(await captureMeetTab(chromeLike, { warn: (m) => warnings.push(m) })).toBeNull();
    expect(warnings).toHaveLength(1);
  });

  it('JPEG dataURL 이 아니면 null 이고, 로그에 그림이 남지 않습니다', async () => {
    const warnings: string[] = [];
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const chromeLike = fakeChrome({ dataUrl: png });

    expect(await captureMeetTab(chromeLike, { warn: (m) => warnings.push(m) })).toBeNull();
    // 남은 한 줄에 그림 값이 통째로 들어 있으면 로그를 복사하는 순간 화면이 새어 나갑니다.
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).not.toContain('iVBORw0KGgo');
    expect(warnings[0]).toContain('글자');
  });

  it('크기를 못 읽는 그림이면 null 입니다', async () => {
    const warnings: string[] = [];
    // 표지가 SOI 뿐이라 가로·세로를 적어 둔 자리가 없습니다.
    const broken = `data:image/jpeg;base64,${toBase64(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))}`;
    const chromeLike = fakeChrome({ dataUrl: broken });

    expect(await captureMeetTab(chromeLike, { warn: (m) => warnings.push(m) })).toBeNull();
    expect(warnings).toHaveLength(1);
  });
});

describe('decodeJpegDataUrl', () => {
  it('base64 가 깨져 있으면 null 입니다', () => {
    const warnings: string[] = [];
    // 길이가 4의 배수가 아니라 `fromBase64` 가 던집니다.
    const result = decodeJpegDataUrl('data:image/jpeg;base64,AAA', (m) => warnings.push(m));

    expect(result).toBeNull();
    expect(warnings).toHaveLength(1);
  });

  it('푼 바이트가 원본과 같습니다', () => {
    const bytes = jpegBytes(640, 480, 5);
    const result = decodeJpegDataUrl(`data:image/jpeg;base64,${toBase64(bytes)}`, () => {});

    expect(result).not.toBeNull();
    expect(Array.from(result?.bytes ?? [])).toEqual(Array.from(bytes));
  });
});
