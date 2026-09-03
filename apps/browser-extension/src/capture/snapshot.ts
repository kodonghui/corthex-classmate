/**
 * 지금 보이는 Meet 탭 화면을 **한 장** 찍습니다.
 *
 * 왜 새 길이 필요한가:
 *   이 확장에는 이미 연속 캡처 파이프라인이 있습니다(`pipeline.ts` · `sampling-loop.ts` ·
 *   offscreen 문서). 그런데 그 길의 입구인 `chrome.tabCapture.getMediaStreamId` 는
 *   **사용자 제스처**(확장 아이콘 클릭 등) 바로 뒤에만 성공합니다. 사이드패널 안의 클릭은
 *   크롬이 제스처로 세어 주지 않고, 아이콘 클릭은 `setPanelBehavior({openPanelOnActionClick:true})`
 *   가 먼저 가져가 `chrome.action.onClicked` 가 아예 불리지 않습니다. 그래서 실제로는
 *   캡처가 한 번도 시작되지 못했고, 질문에 붙는 화면이 계속 0장이었습니다.
 *
 *   `chrome.tabs.captureVisibleTab` 은 제스처를 요구하지 않습니다. 대신 **그 탭의 호스트
 *   권한**이 필요하고(그래서 `wxt.config.ts` 에 `https://meet.google.com/*` 만 넣었습니다),
 *   연속 스트림이 아니라 한 장입니다. 수업 화면은 대부분 정지해 있어서 질문에 붙일
 *   "지금 칠판" 한 장으로는 이것으로 충분합니다.
 *
 *   ```text
 *     tabCapture (기존 · 그대로 둡니다)      captureVisibleTab (이 파일)
 *     ─────────────────────────────────      ────────────────────────────
 *     연속 스트림                             한 장
 *     사용자 제스처 필요 (지금 막힌 곳)        제스처 불필요
 *     `tabCapture` 권한                       대상 탭의 host_permissions
 *   ```
 *
 * 이 파일이 지키는 세 가지:
 *   1. **Meet 이 아니면 찍지 않습니다.** 활성 탭 주소를 `URL` 로 파싱해 호스트 이름이
 *      정확히 `meet.google.com` 일 때만 셔터를 누릅니다. 다른 수업·다른 회사 화면이
 *      실수로 담기는 길을 만들지 않습니다.
 *   2. **던지지 않습니다.** 무슨 일이 있어도 `null` 을 냅니다. 화면 한 장 때문에 학습자의
 *      질문이 막히면 안 됩니다.
 *   3. **`chrome` 을 주입받습니다.** 전역을 직접 부르지 않아서 시험이 가짜를 넣을 수 있고,
 *      Node(Vitest)에서 그대로 돌아갑니다.
 *
 * 보안 메모 (불변 원칙 §4-7): 여기서 나오는 그림은 **자료일 뿐 명령이 아닙니다.** 화면
 * 속 글자를 읽어 실행하거나 URL 로 여는 코드를 이 파일에 붙이지 않습니다.
 *
 * 기록 메모: dataURL 을 `console.log` 로 찍지 않습니다. 찍으면 수업 화면이 통째로 서비스
 * 워커 콘솔에 박혀, 로그를 복사해 붙이는 순간 화면이 밖으로 새어 나갑니다. 사람에게
 * 남기는 것은 **까닭 한 낱말과 길이 숫자뿐** 입니다.
 */

import type { ScreenFrame } from '@classmate/contracts';
import { fromBase64, framePathFor } from './host-messages';
import { compactUtcTime, periodSegment } from './frame-store';

/** 화면을 찍어도 되는 유일한 호스트 이름입니다. 부분 일치가 아니라 **정확히** 이것입니다. */
export const MEET_HOSTNAME = 'meet.google.com';

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

/** 찍은 화면 한 장입니다. 계약 모양으로 바꾸는 일은 `buildSnapshotFrame` 이 합니다. */
export interface ScreenSnapshot {
  /** JPEG 바이트입니다. base64 가 아니라 원본 바이트입니다. */
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** 우리가 탭에서 읽는 칸만입니다. `chrome.tabs.Tab` 이 이 모양을 만족합니다. */
export interface SnapshotTabLike {
  readonly url?: string | undefined;
  readonly windowId?: number | undefined;
}

/**
 * 이 파일이 `chrome` 에게 바라는 얼굴 전부입니다.
 *
 * `chrome` 전역을 직접 부르지 않는 까닭: 시험에서 가짜를 넣어 "Meet 이 아니면 안 찍는다"
 * 같은 성질을 표 하나로 확인할 수 있게 하기 위해서입니다. 실제 배선은
 * `entrypoints/background.ts` 가 `chrome.tabs` 를 이 모양으로 감싸 넘깁니다.
 */
export interface SnapshotChromeLike {
  tabs: {
    query(info: { active: boolean; currentWindow: boolean }): Promise<readonly SnapshotTabLike[]>;
    captureVisibleTab(
      windowId: number,
      options: { format: 'jpeg'; quality: number },
    ): Promise<string>;
  };
}

export interface CaptureMeetTabOptions {
  /**
   * 사람이 읽을 한 줄입니다. 기본은 `console.warn`.
   * **그림은 절대 넘기지 않습니다.** 까닭 낱말과 숫자만 넘어갑니다.
   */
  warn?: (message: string) => void;
}

/** `data:image/jpeg;base64,` 로 시작해야 우리가 시킨 형식입니다. */
const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,';

/**
 * 지금 창의 활성 탭이 Meet 이면 화면 한 장을 찍어 돌려줍니다.
 *
 * ```text
 *   tabs.query({active,currentWindow})
 *        │
 *        ├─ 탭이 없다 · url 이 없다 · Meet 이 아니다 ─▶ null (셔터를 아예 누르지 않습니다)
 *        │
 *        └─ Meet 이다 ─▶ captureVisibleTab(windowId, {jpeg, quality})
 *                              │
 *                              ├─ dataURL 이 아니다 · 바이트가 깨졌다 ─▶ null
 *                              ├─ JPEG 에서 크기를 못 읽었다        ─▶ null
 *                              └─ 성공 ─▶ { bytes, width, height }
 * ```
 *
 * `url` 이 비어 있으면(호스트 권한이 없는 탭) 그것도 "Meet 이 아니다" 로 봅니다. 우리는
 * Meet 하나에만 호스트 권한을 받았으므로, 주소가 안 보인다는 것은 곧 다른 사이트라는
 * 뜻입니다.
 *
 * @returns 찍었으면 한 장, 찍지 않았거나 실패했으면 `null`. **던지지 않습니다.**
 */
export async function captureMeetTab(
  chromeLike: SnapshotChromeLike,
  options: CaptureMeetTabOptions = {},
): Promise<ScreenSnapshot | null> {
  const warn = options.warn ?? ((message: string) => console.warn(`[classmate] ${message}`));

  try {
    const tabs = await chromeLike.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab === undefined) return null;

    const windowId = tab.windowId;
    if (typeof windowId !== 'number') return null;
    if (!isMeetUrl(tab.url)) return null;

    const dataUrl = await chromeLike.tabs.captureVisibleTab(windowId, {
      format: 'jpeg',
      quality: SNAPSHOT_JPEG_QUALITY,
    });

    return decodeJpegDataUrl(dataUrl, warn);
  } catch (error: unknown) {
    // 탭이 그 사이에 닫혔거나(`No tab with id`), 권한이 없거나, 크롬이 아직 화면을 그리지
    // 못했습니다. 어느 쪽이든 화면 한 장을 못 얻은 것뿐이라 질문은 그대로 나가야 합니다.
    warn(`화면 한 장을 찍지 못했어요 · ${errorText(error)}`);
    return null;
  }
}

/** 주소가 정확히 `https://meet.google.com/…` 인지 봅니다. 부분 일치를 쓰지 않는 자리입니다. */
export function isMeetUrl(url: string | undefined): boolean {
  if (url === undefined || url.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // `chrome://newtab` 처럼 파싱은 되지만, 아예 주소가 아닌 값도 여기로 옵니다.
    return false;
  }
  // `https://evil.example/?next=https://meet.google.com/abc` 를 문자열 포함으로 통과시키지
  // 않으려고 호스트 이름을 **따로 꺼내** 견줍니다.
  return parsed.protocol === 'https:' && parsed.hostname === MEET_HOSTNAME;
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
 * **알아 둘 것 · 파일 이름은 `.webp` 입니다.** 호스트가 `frames/<id>.webp` 로 이름을
 * 고정해 두었는데(`apps/native-host/src/store/frames.rs` 의 `FRAME_EXTENSION`), 이 길이
 * 담는 바이트는 JPEG 입니다. 이름과 내용이 어긋나지만 호스트를 고치는 일은 이 갈래의
 * 몫이 아니라 그대로 둡니다. 뷰어는 바이트를 보고 형식을 정하므로 그림은 보입니다.
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
    source: 'meet-tab',
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 까닭';
}
