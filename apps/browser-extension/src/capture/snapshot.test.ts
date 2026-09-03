/**
 * 한 장 찍기(`captureVisibleTab` 갈래)의 시험입니다.
 *
 * 이 파일은 브라우저 없이 돕니다. `chrome` 을 주입식으로 받게 만들어 두었기 때문에
 * 가짜 탭 하나만 있으면 "Meet 이 아니면 안 찍는다" 같은 성질을 표로 확인할 수 있습니다.
 */

import { describe, expect, it } from 'vitest';

import { toBase64 } from './host-messages';
import type { SnapshotChromeLike, SnapshotFailure, SnapshotTabLike } from './snapshot';
import {
  MAX_SNAPSHOT_BYTES,
  MEET_URL_PATTERN,
  SNAPSHOT_JPEG_QUALITY,
  SNAPSHOT_QUALITY_LADDER,
  buildSnapshotFrame,
  captureMeetTab,
  contentFingerprint,
  decodeJpegDataUrl,
  isMeetUrl,
  pickMeetTab,
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

/** 표지는 제대로 놓고 **크기만 부풀린** 껍데기입니다. 봉투 상한 시험에 씁니다. */
function jpegDataUrlOfSize(total: number): string {
  const head = jpegBytes(1920, 1080);
  const bytes = new Uint8Array(Math.max(total, head.length));
  bytes.set(head, 0);
  return `data:image/jpeg;base64,${toBase64(bytes)}`;
}

interface FakeChrome extends SnapshotChromeLike {
  /** `captureVisibleTab` 이 받은 인자들입니다. 한 번도 안 불렸으면 빈 배열입니다. */
  readonly shots: { windowId: number; format: string; quality: number }[];
  /** `tabs.query` 가 받은 인자들입니다. 창을 가리지 않고 물었는지 봅니다. */
  readonly queries: { url: string }[];
}

interface FakeChromeOptions {
  /** 질의에 걸리는 탭들입니다. 기본은 Meet 탭 하나(7번 창의 활성 탭). */
  tabs?: readonly SnapshotTabLike[];
  /** `tabs.query` 가 던지게 합니다. */
  queryThrows?: boolean;
  /** `captureVisibleTab` 이 던지게 합니다. 숫자면 그 번째(1부터) 부름만 던집니다. */
  captureThrows?: boolean | number;
  dataUrl?: string;
  /** 품질마다 다른 그림을 돌려줍니다. 사다리 시험이 씁니다. */
  dataUrlFor?: (quality: number) => string;
}

/** 7번 창에서 앞에 있는 Meet 탭 하나입니다. */
function meetTab(over: Partial<SnapshotTabLike> = {}): SnapshotTabLike {
  return { url: MEET_URL, windowId: 7, active: true, ...over };
}

function fakeChrome(options: FakeChromeOptions = {}): FakeChrome {
  const shots: { windowId: number; format: string; quality: number }[] = [];
  const queries: { url: string }[] = [];
  const tabs = options.tabs ?? [meetTab()];

  return {
    shots,
    queries,
    tabs: {
      query: async (info) => {
        queries.push(info);
        if (options.queryThrows === true) throw new Error('탭을 읽지 못했어요');
        // 진짜 `chrome.tabs.query` 처럼 무늬에 맞는 것만 돌려줍니다.
        return tabs.filter((tab) => (tab.url ?? '').startsWith('https://meet.google.com/'));
      },
      captureVisibleTab: async (windowId, imageOptions) => {
        shots.push({ windowId, format: imageOptions.format, quality: imageOptions.quality });
        const throwsOn = options.captureThrows;
        if (throwsOn === true || (typeof throwsOn === 'number' && throwsOn === shots.length)) {
          throw new Error('activeTab 권한이 없어요');
        }
        if (options.dataUrlFor !== undefined) return options.dataUrlFor(imageOptions.quality);
        return options.dataUrl ?? jpegDataUrl(1280, 720);
      },
    },
  };
}

/** 못 찍은 까닭을 모으며 한 장 찍기를 돌립니다. */
async function capture(
  chromeLike: FakeChrome,
): Promise<{ shot: Awaited<ReturnType<typeof captureMeetTab>>; reasons: SnapshotFailure[]; warnings: string[] }> {
  const reasons: SnapshotFailure[] = [];
  const warnings: string[] = [];
  const shot = await captureMeetTab(chromeLike, {
    warn: (message) => warnings.push(message),
    onFail: (reason) => reasons.push(reason),
  });
  return { shot, reasons, warnings };
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

describe('pickMeetTab', () => {
  it('자기 창에서 앞에 있는 탭만 고릅니다', () => {
    const back = meetTab({ windowId: 3, active: false });
    const front = meetTab({ windowId: 9, active: true });

    expect(pickMeetTab([back, front])).toBe(front);
  });

  it('앞에 있는 것이 하나도 없으면 null 입니다', () => {
    expect(pickMeetTab([meetTab({ active: false }), meetTab({ windowId: 8, active: false })])).toBeNull();
  });

  it('`active` 칸이 아예 없으면 후보로 세지 않습니다', () => {
    // 모르는 것을 "앞에 있다" 로 보면 다른 화면이 찍히는 길이 열립니다.
    expect(pickMeetTab([{ url: MEET_URL, windowId: 7 }])).toBeNull();
  });

  it('여럿이면 가장 최근에 본 것입니다 (lastAccessed)', () => {
    const older = meetTab({ windowId: 3, lastAccessed: 1_000 });
    const newer = meetTab({ windowId: 9, lastAccessed: 2_000 });

    expect(pickMeetTab([older, newer])).toBe(newer);
    expect(pickMeetTab([newer, older])).toBe(newer);
  });

  it('lastAccessed 가 없는 크롬에서는 목록의 첫 번째입니다', () => {
    const first = meetTab({ windowId: 3 });
    const second = meetTab({ windowId: 9 });

    expect(pickMeetTab([first, second])).toBe(first);
  });

  it('창 번호가 없으면 찍을 창을 몰라 세지 않습니다', () => {
    expect(pickMeetTab([{ url: MEET_URL, active: true }])).toBeNull();
  });
});

describe('captureMeetTab', () => {
  it('창을 가리지 않고 Meet 주소 무늬로 찾습니다', async () => {
    const chromeLike = fakeChrome();

    await capture(chromeLike);

    // `active`·`currentWindow` 를 묻지 않습니다 — 서비스 워커에는 "지금 창" 이 없습니다.
    expect(chromeLike.queries).toEqual([{ url: MEET_URL_PATTERN }]);
  });

  it('Meet 탭이 다른 창에 있어도 찾아서 찍습니다', async () => {
    // 학습자 실제 배치: Tiro 창이 앞에 있고 Meet 은 다른 창에서 앞에 있습니다.
    const chromeLike = fakeChrome({
      tabs: [
        { url: 'https://tiro.example/share/abc', windowId: 1, active: true },
        meetTab({ windowId: 42, active: true }),
      ],
      dataUrl: jpegDataUrl(1920, 1080),
    });

    const { shot, reasons } = await capture(chromeLike);

    expect(shot?.width).toBe(1920);
    expect(reasons).toEqual([]);
    expect(chromeLike.shots).toEqual([
      { windowId: 42, format: 'jpeg', quality: SNAPSHOT_JPEG_QUALITY },
    ]);
  });

  it('Meet 탭이 하나도 없으면 no-meet-tab 으로 남기고 찍지 않습니다', async () => {
    const chromeLike = fakeChrome({
      tabs: [{ url: 'https://www.notion.so/secret', windowId: 7, active: true }],
    });

    const { shot, reasons } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['no-meet-tab']);
    // 셔터 자체를 누르지 않았습니다. 다른 사이트가 한 장도 남지 않는 자리입니다.
    expect(chromeLike.shots).toEqual([]);
  });

  it('Meet 이 그 창에서 뒤에 있으면 not-active 로 남기고 찍지 않습니다', async () => {
    // 찍으면 그 창에서 **앞에 있는 다른 화면**(은행·메신저)이 담깁니다.
    const chromeLike = fakeChrome({ tabs: [meetTab({ active: false })] });

    const { shot, reasons } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['not-active']);
    expect(chromeLike.shots).toEqual([]);
  });

  it('Meet 을 사칭하는 주소는 전부 거절합니다', async () => {
    const liars: SnapshotTabLike[] = [
      { url: 'https://evil.example/?next=https://meet.google.com/x', windowId: 1, active: true },
      { url: 'https://meet.google.com.evil.example/x', windowId: 2, active: true },
      { url: 'http://meet.google.com/x', windowId: 3, active: true },
    ];

    for (const tab of liars) {
      const chromeLike = fakeChrome({ tabs: [tab] });
      const { shot, reasons } = await capture(chromeLike);

      expect(shot).toBeNull();
      expect(reasons).toEqual(['no-meet-tab']);
      expect(chromeLike.shots).toEqual([]);
    }
  });

  it('탭 주소가 안 보이면(호스트 권한 없음) 찍지 않습니다', async () => {
    const chromeLike = fakeChrome({ tabs: [{ windowId: 7, active: true }] });

    const { shot, reasons } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['no-meet-tab']);
    expect(chromeLike.shots).toEqual([]);
  });

  it('탭을 읽다 실패해도 던지지 않고 no-meet-tab 입니다', async () => {
    const chromeLike = fakeChrome({ queryThrows: true });

    const { shot, reasons, warnings } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['no-meet-tab']);
    expect(warnings).toHaveLength(1);
  });

  it('찍다 실패해도 던지지 않고 capture-failed 입니다', async () => {
    const chromeLike = fakeChrome({ captureThrows: true });

    const { shot, reasons, warnings } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['capture-failed']);
    expect(warnings).toHaveLength(1);
  });

  it('JPEG dataURL 이 아니면 capture-failed 이고, 로그에 그림이 남지 않습니다', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const chromeLike = fakeChrome({ dataUrl: png });

    const { shot, reasons, warnings } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['capture-failed']);
    // 남은 한 줄에 그림 값이 통째로 들어 있으면 로그를 복사하는 순간 화면이 새어 나갑니다.
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).not.toContain('iVBORw0KGgo');
    expect(warnings[0]).toContain('글자');
  });

  it('크기를 못 읽는 그림이면 capture-failed 입니다', async () => {
    // 표지가 SOI 뿐이라 가로·세로를 적어 둔 자리가 없습니다.
    const broken = `data:image/jpeg;base64,${toBase64(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))}`;
    const chromeLike = fakeChrome({ dataUrl: broken });

    const { shot, reasons, warnings } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['capture-failed']);
    expect(warnings).toHaveLength(1);
  });

  // ── 봉투 상한 (HiDPI 함정) ──────────────────────────────────────────────

  it('너무 크면 품질을 낮춰 한 번 더 찍습니다', async () => {
    const [first, second] = SNAPSHOT_QUALITY_LADDER;
    const chromeLike = fakeChrome({
      dataUrlFor: (quality) =>
        quality === first ? jpegDataUrlOfSize(MAX_SNAPSHOT_BYTES + 1) : jpegDataUrl(1920, 1080),
    });

    const { shot, reasons } = await capture(chromeLike);

    expect(shot).not.toBeNull();
    expect(shot?.bytes.byteLength).toBeLessThanOrEqual(MAX_SNAPSHOT_BYTES);
    expect(reasons).toEqual([]);
    expect(chromeLike.shots.map((one) => one.quality)).toEqual([first, second]);
  });

  it('품질을 낮춰도 크면 too-large 로 남기고 포기합니다', async () => {
    const chromeLike = fakeChrome({ dataUrlFor: () => jpegDataUrlOfSize(MAX_SNAPSHOT_BYTES + 1) });

    const { shot, reasons, warnings } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['too-large']);
    // 사다리 칸 수만큼만 셔터를 누릅니다(초당 두 번 할당량).
    expect(chromeLike.shots).toHaveLength(SNAPSHOT_QUALITY_LADDER.length);
    // 남는 것은 숫자뿐입니다. base64 한 조각도 새어 나가면 안 됩니다.
    for (const line of warnings) {
      expect(line).not.toContain('data:image');
      expect(line).not.toContain('/9j/');
      expect(line.length).toBeLessThan(200);
    }
  });

  it('두 번째 셔터가 할당량에 걸려도 까닭은 too-large 입니다', async () => {
    // 첫 장이 이미 너무 컸으므로 "못 찍음" 이 아니라 "너무 큼" 이 사람이 고칠 거리입니다.
    const chromeLike = fakeChrome({
      captureThrows: 2,
      dataUrlFor: () => jpegDataUrlOfSize(MAX_SNAPSHOT_BYTES + 1),
    });

    const { shot, reasons } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['too-large']);
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
