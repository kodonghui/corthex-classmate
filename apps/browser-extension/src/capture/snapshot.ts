/**
 * 학습자가 확장 아이콘을 눌러 고른 수업 화면 탭을 **한 장** 찍습니다.
 *
 * `captureVisibleTab(windowId)` 는 그 창에서 지금 앞에 있는 탭만 찍습니다. 그래서 주소나
 * 서비스 이름으로 탭을 추측하지 않고, 아이콘 클릭이라는 명시적 선택과 `activeTab` 임시
 * 권한을 함께 씁니다. Meet·Drive·LMS·로컬 개발 서버처럼 수업 영상이 어디에 있어도 같은
 * 흐름이고, `<all_urls>` 영구 권한은 받지 않습니다.
 *
 * ```text
 *   영상 탭에서 확장 아이콘 클릭
 *        │  activeTab 임시 권한 + {tabId, windowId, at} 세션 저장
 *        ▼
 *   captureLessonTab(chrome, lessonTab)
 *        ├─ 선택 없음/탭 닫힘 ─────────────▶ no-lesson-tab
 *        ├─ 그 창의 뒤 탭 ─────────────────▶ not-active
 *        ├─ activeTab 권한 없음 ────────────▶ no-permission
 *        └─ captureVisibleTab(그 창) ───────▶ JPEG 한 장
 * ```
 *
 * 이 파일은 무슨 실패든 `null` 로 돌려 질문을 막지 않습니다. dataURL·탭 주소·화면 내용은
 * 로그에 남기지 않고, 고정된 실패 낱말과 바이트 길이만 남깁니다. 그림 속 글자는 자료일 뿐
 * 명령이 아니며 실행하거나 URL 로 여는 코드를 붙이지 않습니다(불변 원칙 §4-7).
 */

import type { ScreenFrame } from '@classmate/contracts';
import type { LessonTab } from '../background/lesson-tab';
import { fromBase64, framePathFor } from './host-messages';
import { compactUtcTime, periodSegment } from './frame-store';

/**
 * JPEG 품질(0~100)입니다.
 *
 * 왜 JPEG 인가: `chrome.tabs.captureVisibleTab` 이 낼 수 있는 형식은 `jpeg` 와 `png`
 * 둘뿐이고, `quality` 는 `jpeg` 에만 듣습니다. 1920x1080 수업 화면을 PNG 로 뜨면 보통
 * 1~3 MiB 이라 Native Messaging 봉투 상한 1 MiB(`MAX_MESSAGE_BYTES`)를 그 자리에서
 * 넘겨 한 장도 못 들어갑니다.
 *
 * 왜 60 인가: base64 로 적으면 바이트가 4/3 배로 부풀어, 봉투 1 MiB 안에 들어가려면 원본이
 * 대략 780 KiB 아래여야 합니다. 슬라이드·에디터처럼 평평한 화면은 품질 60 에서 보통
 * 100~250 KiB 이라 여유가 넉넉하고, 코드 글자도 읽힙니다. 더 올리면 크기가 빨리 늘고
 * 더 내리면 작은 글자가 뭉갭니다.
 */
export const SNAPSHOT_JPEG_QUALITY = 60;

/**
 * 품질 사다리입니다. 앞엣것이 봉투 상한을 넘기면 다음 것으로 **한 번 더** 찍습니다.
 *
 * 왜 두 칸뿐인가: `chrome.tabs.captureVisibleTab` 은 **초당 두 번**까지만 부를 수 있습니다
 * (크롬의 `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND` 할당량). 세 번째를 부르면 그 자리에서
 * 거절당해, 크기를 줄이려던 일이 "아예 못 찍음" 으로 바뀝니다.
 *
 * 왜 사다리가 필요한가 (HiDPI 함정): `captureVisibleTab` 은 **물리 픽셀**로 찍습니다.
 * 1920x1080 창이 배율 2 화면에서는 3840x2160 으로 나와, 품질 60 JPEG 이 그대로
 * {@link MAX_SNAPSHOT_BYTES} 를 넘길 수 있습니다. 넘으면 봉투가 통째로 버려져 화면이
 * 한 장도 안 남습니다(2026-09-03 실측의 0장과 같은 결말).
 */
export const SNAPSHOT_QUALITY_LADDER: readonly number[] = [SNAPSHOT_JPEG_QUALITY, 30];

/**
 * 봉투에 실을 수 있는 **원본 바이트** 상한입니다.
 *
 * 호스트 봉투 상한은 1 MiB 입니다(`src/capture/host-messages.ts` 의 `MAX_MESSAGE_BYTES`).
 * 바이트를 base64 로 적으면 4/3 배로 부풀므로 원본은 대략 780 KiB 아래여야 하고, 봉투의
 * 나머지 칸(교시·프레임 아홉 칸)이 몇백 바이트를 더 먹습니다. 여유를 두고 700 KiB 로 잡습니다.
 *
 * 여기서 미리 거르는 까닭: 상한 판정은 `NativeHostFrameSink` 도 하지만, 그쪽은 이미 찍은
 * 뒤라 **다시 찍을 수 없습니다.** 줄일 기회가 있는 자리는 여기뿐입니다.
 */
export const MAX_SNAPSHOT_BYTES = 700 * 1024;

/**
 * 화면 한 장을 못 얻은 까닭입니다. **고정된 낱말**이라 로그를 세거나 화면에 옮길 수 있습니다.
 *
 * | 낱말 | 무슨 일 |
 * |---|---|
 * | `no-lesson-tab` | 아직 고른 탭이 없거나 고른 탭이 닫혔습니다 |
 * | `not-active` | 고른 탭이 자기 창에서 앞에 있지 않습니다 |
 * | `no-permission` | 그 탭에서 아이콘을 누르지 않아 `activeTab` 권한이 없습니다 |
 * | `capture-failed` | 셔터를 눌렀는데 그림이 안 나왔습니다(탭 이동·모양 깨짐) |
 * | `too-large` | 품질을 낮춰 다시 찍어도 봉투 상한을 넘습니다 |
 * | `host-offline` | 찍기는 했는데 로컬 도우미가 파일로 남기지 못했습니다 |
 *
 * `host-offline` 만 이 파일 밖(`entrypoints/background.ts`)에서 납니다. 낱말을 한 곳에 모아
 * 두려고 여기 함께 적습니다.
 */
export type SnapshotFailure =
  | 'no-lesson-tab'
  | 'not-active'
  | 'no-permission'
  | 'capture-failed'
  | 'too-large'
  | 'host-offline';

/** 찍은 화면 한 장입니다. 계약 모양으로 바꾸는 일은 `buildSnapshotFrame` 이 합니다. */
export interface ScreenSnapshot {
  /** JPEG 바이트입니다. base64 가 아니라 원본 바이트입니다. */
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** 우리가 탭에서 읽는 칸만입니다. `chrome.tabs.Tab` 이 이 모양을 만족합니다. */
export interface SnapshotTabLike {
  readonly windowId?: number | undefined;
  /** 자기 창에서 앞에 있는 탭인지입니다. `captureVisibleTab` 이 찍는 것이 이 탭입니다. */
  readonly active?: boolean | undefined;
}

/**
 * 이 파일이 `chrome` 에게 바라는 얼굴 전부입니다.
 *
 * `chrome` 전역을 직접 부르지 않는 까닭: 시험에서 가짜를 넣어 "고른 탭이 뒤에 있으면
 * 안 찍는다" 같은 성질을 확인할 수 있게 하기 위해서입니다. 실제 배선은
 * `entrypoints/background.ts` 가 `chrome.tabs` 를 이 모양으로 감싸 넘깁니다.
 */
export interface SnapshotChromeLike {
  tabs: {
    /** 고른 탭이 아직 열려 있고 자기 창에서 앞에 있는지 확인합니다. */
    get(tabId: number): Promise<SnapshotTabLike>;
    captureVisibleTab(
      windowId: number,
      options: { format: 'jpeg'; quality: number },
    ): Promise<string>;
  };
}

export interface CaptureLessonTabOptions {
  /**
   * 사람이 읽을 한 줄입니다. 기본은 `console.warn`.
   * **그림은 절대 넘기지 않습니다.** 까닭 낱말과 숫자만 넘어갑니다.
   */
  warn?: (message: string) => void;
  /**
   * 못 찍은 까닭을 고정 낱말 하나로 알립니다.
   *
   * 왜 `warn` 과 따로 두는가: `warn` 은 사람이 읽는 문장이라 말이 바뀝니다. 이 문은 세거나
   * 화면 바닥줄에 옮기는 자리라 **낱말이 고정**이어야 합니다. 여기에도 그림·주소는 넘어가지
   * 않습니다(불변 원칙 §4-2).
   */
  onFail?: (reason: SnapshotFailure) => void;
}

/** `data:image/jpeg;base64,` 로 시작해야 우리가 시킨 형식입니다. */
const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,';

/**
 * 사용자가 고른 수업 화면 탭을 확인하고 화면 한 장을 찍어 돌려줍니다.
 *
 * ```text
 *   lessonTab
 *        ├─ 없다 ─────────────────────────────────▶ null · onFail("no-lesson-tab")
 *        └─ tabs.get(tabId)
 *              ├─ 닫혔다 ─────────────────────────▶ null · onFail("no-lesson-tab")
 *              ├─ 자기 창에서 활성이 아니다 ──────▶ null · onFail("not-active")
 *              └─ 자기 창의 활성 탭이다
 *              ▼
 *           captureVisibleTab(windowId, {jpeg, 품질 60})
 *              │
 *              ├─ activeTab 권한이 없다 ───────────▶ null · onFail("no-permission")
 *              ├─ 그 밖 실패 · dataURL 오류 ───────▶ null · onFail("capture-failed")
 *              │
 *              ├─ 700 KiB 를 넘는다 ─▶ 품질 30 으로 한 번 더
 *              │                          └─ 그래도 넘는다 ─▶ null · onFail("too-large")
 *              │
 *              └─ 성공 ─▶ { bytes, width, height }
 * ```
 *
 * **자기 창에서 활성인 탭만 찍습니다.** `captureVisibleTab(windowId)` 가 찍는 것은 그 창에서
 * 앞에 있는 탭이라, 고른 탭이 뒤에 있으면 앞의 다른 화면이 담길 수 있기 때문입니다.
 *
 * @returns 찍었으면 한 장, 찍지 않았거나 실패했으면 `null`. **던지지 않습니다.**
 */
export async function captureLessonTab(
  chromeLike: SnapshotChromeLike,
  lessonTab: LessonTab | null,
  options: CaptureLessonTabOptions = {},
): Promise<ScreenSnapshot | null> {
  const warn = options.warn ?? ((message: string) => console.warn(`[classmate] ${message}`));
  const onFail = options.onFail ?? (() => {});
  const fail = (reason: SnapshotFailure): null => {
    onFail(reason);
    return null;
  };

  if (lessonTab === null) return fail('no-lesson-tab');

  let tab: SnapshotTabLike;
  try {
    tab = await chromeLike.tabs.get(lessonTab.tabId);
  } catch {
    // 닫힌 탭의 오류 원문에는 URL 이 섞일 수 있어 로그에 다시 적지 않습니다.
    warn('고른 수업 화면 탭이 닫혔어요');
    return fail('no-lesson-tab');
  }

  if (tab.active !== true) return fail('not-active');
  const windowId = tab.windowId;
  if (typeof windowId !== 'number') return fail('not-active');

  let tooLarge = false;
  for (const quality of SNAPSHOT_QUALITY_LADDER) {
    let dataUrl: string;
    try {
      dataUrl = await chromeLike.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality });
    } catch (error: unknown) {
      // Chrome 오류 원문에는 페이지 정보가 섞일 수 있어 다시 기록하지 않습니다. 판정에 필요한
      // `activeTab` 한 낱말만 보고, 사람에게는 고정 문장만 남깁니다.
      if (errorText(error).includes('activeTab')) {
        warn('수업 화면 탭을 찍을 임시 권한이 없어요');
        return fail('no-permission');
      }
      warn(`화면 한 장을 찍지 못했어요 · 품질 ${quality}`);
      return fail(tooLarge ? 'too-large' : 'capture-failed');
    }

    const shot = decodeJpegDataUrl(dataUrl, warn);
    if (shot === null) return fail('capture-failed');
    if (shot.bytes.byteLength <= MAX_SNAPSHOT_BYTES) return shot;

    // 배율이 높은 화면(HiDPI)에서 자주 걸립니다. 남기는 것은 숫자뿐입니다.
    tooLarge = true;
    warn(
      `화면 한 장이 너무 커요 · 품질 ${quality} · ${shot.bytes.byteLength}바이트 · 상한 ${MAX_SNAPSHOT_BYTES}바이트`,
    );
  }
  return fail('too-large');
}

/**
 * `data:image/jpeg;base64,…` 를 바이트와 크기로 바꿉니다.
 *
 * **`FileReader` 를 쓰지 않습니다.** 서비스 워커에는 `FileReader` 가 없습니다(DOM API 라
 * 문서가 있는 문맥에만 있습니다). `fetch(dataUrl).then(r => r.arrayBuffer())` 도 쓰지
 * 않습니다 — MV3 의 콘텐츠 보안 정책과 fetch 흉내 내기를 시험에 끌어들이게 됩니다.
 * 대신 이미 시험까지 되어 있는 순수 함수 `fromBase64` 로 직접 풉니다.
 */
export function decodeJpegDataUrl(
  dataUrl: string,
  warn: (message: string) => void,
): ScreenSnapshot | null {
  if (!dataUrl.startsWith(JPEG_DATA_URL_PREFIX)) {
    // 길이만 남깁니다. 값 자체를 남기면 화면이 로그에 박힙니다.
    warn(`화면 한 장의 모양이 JPEG dataURL 이 아니에요 · ${dataUrl.length}글자`);
    return null;
  }

  let bytes: Uint8Array;
  try {
    bytes = fromBase64(dataUrl.slice(JPEG_DATA_URL_PREFIX.length));
  } catch (error: unknown) {
    warn(`화면 한 장의 바이트를 풀지 못했어요 · ${errorText(error)}`);
    return null;
  }

  const size = readJpegSize(bytes);
  if (size === null) {
    warn(`화면 한 장에서 가로·세로를 읽지 못했어요 · ${bytes.byteLength}바이트`);
    return null;
  }

  return { bytes, width: size.width, height: size.height };
}

/**
 * SOF 표지에서 가로·세로를 읽는 표지 번호들입니다.
 *
 * `0xC4`(허프만 표) · `0xC8`(예약) · `0xCC`(산술부호 표)는 SOF 가 아니라서 뺍니다.
 */
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/**
 * JPEG 바이트에서 가로·세로를 읽습니다.
 *
 * 왜 직접 읽는가: 계약 `ScreenFrame` 은 `width` · `height` 를 1 이상의 정수로 **반드시**
 * 요구합니다. 서비스 워커에는 `Image` 도 `document` 도 없고, `createImageBitmap` 으로
 * 풀면 그림 한 장을 통째로 메모리에 펴는 값비싼 일이 됩니다. JPEG 은 머리쪽 표지 몇 개만
 * 읽으면 크기가 나오므로 그 몇 바이트만 읽습니다.
 *
 * ```text
 *   FF D8            SOI (그림 시작)
 *   FF E0 <길이> …   APP0 · 그 밖의 표지 (길이만큼 건너뜀)
 *   FF C0 <길이> P HH HH WW WW …   SOF0 ← 여기 네 바이트가 세로·가로
 *   FF DA …          SOS (여기부터는 압축된 그림 데이터)
 * ```
 *
 * 순서상 SOF 는 언제나 SOS 앞에 옵니다. SOS 를 먼저 만나면 크기를 못 읽은 것이므로
 * `null` 을 냅니다.
 *
 * @returns 읽었으면 `{width, height}`, 모양이 JPEG 이 아니거나 표지를 못 찾으면 `null`.
 */
export function readJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) {
      // 표지 앞에는 0xFF 만 옵니다. 아니면 한 칸 밀어 다시 봅니다.
      i += 1;
      continue;
    }
    const marker = bytes[i + 1] ?? 0;
    if (marker === 0xff) {
      // 0xFF 가 채움 바이트로 여러 개 붙을 수 있습니다.
      i += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      // 길이 칸이 없는 표지들(TEM · RST0~7 · SOI · EOI)입니다.
      i += 2;
      continue;
    }
    if (marker === 0xda) {
      // 압축 데이터가 시작됐습니다. 여기까지 SOF 를 못 봤으면 못 읽는 그림입니다.
      return null;
    }

    const length = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    if (length < 2) return null;

    if (SOF_MARKERS.has(marker)) {
      // 표지(2) + 길이(2) + 정밀도(1) 다음이 세로 두 바이트, 그 다음이 가로 두 바이트입니다.
      if (i + 8 >= bytes.length) return null;
      const height = ((bytes[i + 5] ?? 0) << 8) | (bytes[i + 6] ?? 0);
      const width = ((bytes[i + 7] ?? 0) << 8) | (bytes[i + 8] ?? 0);
      if (width < 1 || height < 1) return null;
      return { width, height };
    }

    i += 2 + length;
  }
  return null;
}

/**
 * 바이트 묶음의 지문 16글자입니다(FNV-1a 32비트 두 갈래).
 *
 * **이것은 `dhash.ts` 의 dHash 가 아닙니다.** dHash 는 그림을 9x8 회색조로 뭉개서 재기
 * 때문에 픽셀이 필요하고, 서비스 워커에는 그림을 펼 자리가 없습니다. 계약
 * `ScreenFrame.hash` 가 요구하는 것은 "소문자 16진 8~64글자" 이고 호스트는 이 칸으로
 * 중복을 가르지 않으므로(중복 판정은 `frames.id` 기본 키가 합니다), 한 장 찍기 길에서는
 * **바이트가 달라졌는지**만 알려 주는 내용 지문을 넣습니다.
 *
 * 연속 캡처 길(offscreen → `pipeline.ts`)은 그대로 진짜 dHash 를 씁니다. 두 길이 만드는
 * 값의 뜻이 다르므로, 나중에 둘을 섞어 견주지 않도록 여기 적어 둡니다.
 */
export function contentFingerprint(bytes: Uint8Array): string {
  const a = fnv1a32(bytes, 0x811c9dc5);
  const b = fnv1a32(bytes, 0xdeadbeef);
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

function fnv1a32(bytes: Uint8Array, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    hash = (hash ^ (bytes[i] ?? 0)) >>> 0;
    // FNV 소수 16777619 입니다. `Math.imul` 이라야 32비트 곱셈이 정확합니다.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export interface SnapshotFrameInput {
  /** 교시 세션 식별자. 보기 `2026-09-02-p3`. */
  readonly periodId: string;
  /** 찍은 시각입니다. id 가운데 여섯 자리와 `capturedAt` 이 여기서 나옵니다. */
  readonly capturedAt: Date;
  /** 이 서비스 워커가 찍은 몇 번째 질문용 장인지입니다. 1부터 셉니다. */
  readonly sequence: number;
  readonly snapshot: ScreenSnapshot;
}

/**
 * 찍은 한 장을 계약 `ScreenFrame` 아홉 칸으로 바꿉니다.
 *
 * 식별자 모양은 이렇습니다.
 *
 * ```text
 *   sf-p3-ask-103210-001
 *   │  │  │   │      └─ 이 워커가 찍은 질문용 장의 순번 (세 자리)
 *   │  │  │   └──────── 찍은 시각 시분초 (UTC)
 *   │  │  └──────────── 질문에 붙이려고 한 장 찍은 길이라는 표시
 *   │  └─────────────── 교시 조각 (periodId 의 `p3`)
 *   └────────────────── 계약이 요구하는 머리글자
 * ```
 *
 * 가운데 `ask` 를 넣는 까닭: 연속 캡처 길이 만드는 `sf-p3-103210-001` 과 **절대 겹치지
 * 않게** 하기 위해서입니다. 호스트는 교시마다 `frames.id` 를 기본 키로 두고 같은 id 를
 * `duplicate-frame` 으로 거절하므로, 두 길이 같은 초에 같은 순번을 쓰면 한쪽이 통째로
 * 거절됩니다.
 *
 * `path` 는 `frame.id` 에서 다시 계산합니다(Gate D 결정). 그래서 확장이 지은 문자열이
 * 파일 경로가 되는 길이 없습니다.
 *
 * **알아 둘 것 · 계약의 `path` 는 `.webp`, 디스크의 파일은 `.jpg` 입니다.** 계약이
 * `frames/<id>.webp` 한 가지라 여기서는 그대로 적고, 이 길이 담는 바이트는 JPEG 입니다.
 * 호스트가 **바이트의 매직 넘버로** 실제 파일 이름의 확장자를 골라 놓습니다
 * (`apps/native-host/src/store/frames.rs` 의 `frame_extension_for`).
 *
 * @throws 교시·프레임 식별자가 계약 모양이 아니면 `RangeError`. 부르는 쪽이 잡아 그 장만
 *         건너뜁니다.
 */
export function buildSnapshotFrame(input: SnapshotFrameInput): ScreenFrame {
  const id = `sf-${periodSegment(input.periodId)}-ask-${compactUtcTime(input.capturedAt)}-${String(
    input.sequence,
  ).padStart(3, '0')}`;

  return {
    id,
    periodId: input.periodId,
    capturedAt: input.capturedAt.toISOString(),
    path: framePathFor(id),
    width: input.snapshot.width,
    height: input.snapshot.height,
    hash: contentFingerprint(input.snapshot.bytes),
    // 한 장 찍기라 견줄 앞 장이 없습니다. 계약상 빠질 수 없는 칸이라 "새 장면" 으로 둡니다.
    changedFromPrev: true,
    // 계약과 fixtures 에 고정된 선 위의 낱말이라 유지합니다. 제품 뜻은 이제 "고른 수업 탭"입니다.
    source: 'meet-tab',
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 까닭';
}
