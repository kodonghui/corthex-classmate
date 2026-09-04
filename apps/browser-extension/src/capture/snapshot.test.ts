/**
 * 한 장 찍기(`captureVisibleTab` 갈래)의 시험입니다.
 *
 * 이 파일은 브라우저 없이 돕니다. `chrome` 을 주입식으로 받게 만들어 두었기 때문에
 * 가짜 탭 하나만 있으면 "고른 탭이 뒤에 있으면 안 찍는다" 같은 성질을 확인할 수 있습니다.
 */

import { describe, expect, it } from 'vitest';

import type { LessonTab } from '../background/lesson-tab';
import { toBase64 } from './host-messages';
import type { SnapshotChromeLike, SnapshotFailure, SnapshotTabLike } from './snapshot';
import {
  MAX_SNAPSHOT_BYTES,
  SNAPSHOT_JPEG_QUALITY,
  SNAPSHOT_QUALITY_LADDER,
  buildSnapshotFrame,
  captureLessonTab,
  contentFingerprint,
  decodeJpegDataUrl,
  readJpegSize,
} from './snapshot';

const PERIOD = '2026-09-02-p3';

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
  /** `tabs.get` 이 받은 수업 탭 id 입니다. */
  readonly gets: number[];
}

interface FakeChromeOptions {
  /** 고른 탭의 현재 상태입니다. 기본은 7번 창의 활성 탭입니다. */
  tab?: SnapshotTabLike;
  /** `tabs.get` 이 던지게 합니다(탭이 닫힌 경우). */
  getThrows?: boolean;
  /** `captureVisibleTab` 이 던지게 합니다. 숫자면 그 번째(1부터) 부름만 던집니다. */
  captureThrows?: boolean | number;
  /** 셔터가 던질 오류 문구입니다. */
  captureError?: string;
  dataUrl?: string;
  /** 품질마다 다른 그림을 돌려줍니다. 사다리 시험이 씁니다. */
  dataUrlFor?: (quality: number) => string;
}

function selectedTab(over: Partial<LessonTab> = {}): LessonTab {
  return { tabId: 17, windowId: 7, at: 1_788_477_600_000, ...over };
}

function fakeChrome(options: FakeChromeOptions = {}): FakeChrome {
  const shots: { windowId: number; format: string; quality: number }[] = [];
  const gets: number[] = [];

  return {
    shots,
    gets,
    tabs: {
      get: async (tabId) => {
        gets.push(tabId);
        if (options.getThrows === true) throw new Error('No tab with id');
        return options.tab ?? { windowId: 7, active: true };
      },
      captureVisibleTab: async (windowId, imageOptions) => {
        shots.push({ windowId, format: imageOptions.format, quality: imageOptions.quality });
        const throwsOn = options.captureThrows;
        if (throwsOn === true || (typeof throwsOn === 'number' && throwsOn === shots.length)) {
          throw new Error(options.captureError ?? '화면 장치를 쓸 수 없어요');
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
  lessonTab: LessonTab | null = selectedTab(),
): Promise<{ shot: Awaited<ReturnType<typeof captureLessonTab>>; reasons: SnapshotFailure[]; warnings: string[] }> {
  const reasons: SnapshotFailure[] = [];
  const warnings: string[] = [];
  const shot = await captureLessonTab(chromeLike, lessonTab, {
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

// ── captureLessonTab ──────────────────────────────────────────────────────

describe('captureLessonTab', () => {
  it('고른 탭이 없으면 no-lesson-tab 이고 Chrome 을 부르지 않습니다', async () => {
    const chromeLike = fakeChrome();

    const { shot, reasons } = await capture(chromeLike, null);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['no-lesson-tab']);
    expect(chromeLike.gets).toEqual([]);
    expect(chromeLike.shots).toEqual([]);
  });

  it('고른 탭이 닫혔으면 no-lesson-tab 이고 주소를 로그에 남기지 않습니다', async () => {
    const chromeLike = fakeChrome({ getThrows: true });

    const { shot, reasons, warnings } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['no-lesson-tab']);
    expect(chromeLike.gets).toEqual([17]);
    expect(chromeLike.shots).toEqual([]);
    expect(warnings).toEqual(['고른 수업 화면 탭이 닫혔어요']);
  });

  it('고른 탭의 현재 창을 읽어 그 창에서 찍습니다', async () => {
    const chromeLike = fakeChrome({
      tab: { windowId: 42, active: true },
      dataUrl: jpegDataUrl(1920, 1080),
    });

    const { shot, reasons } = await capture(chromeLike, selectedTab({ windowId: 7 }));

    expect(shot?.width).toBe(1920);
    expect(reasons).toEqual([]);
    expect(chromeLike.gets).toEqual([17]);
    expect(chromeLike.shots).toEqual([
      { windowId: 42, format: 'jpeg', quality: SNAPSHOT_JPEG_QUALITY },
    ]);
  });

  it('탭 주소를 읽지 않고 tabId·windowId·active 상태만 쓸 때 찍습니다', async () => {
    const tab = {
      windowId: 7,
      active: true,
      get url(): never {
        throw new Error('주소에 접근하면 안 됩니다');
      },
    };
    const chromeLike = fakeChrome({ tab });

    const { shot, reasons } = await capture(chromeLike);

    expect(shot?.width).toBe(1280);
    expect(reasons).toEqual([]);
    expect(chromeLike.shots).toHaveLength(1);
  });

  it('고른 탭이 그 창에서 뒤에 있으면 not-active 로 남기고 찍지 않습니다', async () => {
    const chromeLike = fakeChrome({ tab: { windowId: 7, active: false } });

    const { shot, reasons } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['not-active']);
    expect(chromeLike.shots).toEqual([]);
  });

  it('현재 창 번호를 읽지 못해도 not-active 로 남기고 찍지 않습니다', async () => {
    const chromeLike = fakeChrome({ tab: { active: true } });

    const { shot, reasons } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['not-active']);
    expect(chromeLike.shots).toEqual([]);
  });

  it('activeTab 권한 오류는 no-permission 이고 오류 원문을 로그에 복사하지 않습니다', async () => {
    const secret = 'Either the <all_urls> or activeTab permission is required for https://private.example';
    const chromeLike = fakeChrome({ captureThrows: true, captureError: secret });

    const { shot, reasons, warnings } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['no-permission']);
    expect(warnings).toEqual(['수업 화면 탭을 찍을 임시 권한이 없어요']);
    expect(warnings.join(' ')).not.toContain('private.example');
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

  it('두 번째 셔터 자체가 실패하면 아직 크기를 모르므로 capture-failed 입니다', async () => {
    const chromeLike = fakeChrome({
      captureThrows: 2,
      dataUrlFor: () => jpegDataUrlOfSize(MAX_SNAPSHOT_BYTES + 1),
    });

    const { shot, reasons } = await capture(chromeLike);

    expect(shot).toBeNull();
    expect(reasons).toEqual(['capture-failed']);
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
