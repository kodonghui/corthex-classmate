/**
 * 확장 ↔ 로컬 도우미(Native Messaging) 사이에 오갈 프레임 봉투의 모양입니다.
 *
 * 왜 여기까지만 만드는가:
 *   실제 `chrome.runtime.connectNative` 연결은 2라운드 일입니다. 1라운드에서는
 *   **말의 모양(TS 타입) · 경로 계산 · 1 MiB 크기 가드** 세 가지만 못 박아 둡니다.
 *   그래야 확장 쪽(단위 6)과 호스트 쪽(단위 7)이 같은 문장을 놓고 따로 만들 수 있습니다.
 *
 *   확장 → 호스트   frame.store    { periodId, frame(ScreenFrame 9칸), bytesBase64 }
 *   호스트 → 확장   frame.stored   { periodId, id, path, bytes, seq }
 *   실패            error          { message, reason, received }   ← 프로세스는 계속 삽니다
 *
 * 지키는 경계 (Gate D 결정):
 *   - `id` 는 `^sf-[A-Za-z0-9_-]{1,60}$` 만 허용합니다.
 *   - `path` 는 **확장이 보낸 문자열을 쓰지 않고 `id` 에서 다시 계산합니다.** 호스트도 같은
 *     계산을 해서 대조하므로, 확장이 준 문자열이 파일 경로가 되는 길이 없습니다.
 *   - 봉투 전체가 1 MiB 를 넘으면 **보내지 않고 건너뜁니다.** Chrome 의 Native Messaging
 *     본문 상한이 1 MiB 라(apps/native-host/src/protocol.rs 의 `MAX_MESSAGE_BYTES`) 넘겨
 *     보내면 연결이 끊깁니다. 건너뛴 장은 통계에 세어 두었다가 화면에 알립니다.
 *
 * 보안 메모 (불변 원칙 §4-7): 이 봉투에 담기는 값은 **자료일 뿐 명령이 아닙니다.**
 * 프레임 안의 글자를 읽어 실행하거나 URL 로 여는 코드를 이 통로에 붙이지 않습니다.
 */

import type { ScreenFrame } from '@classmate/contracts';

export const FRAME_STORE = 'frame.store';
export const FRAME_STORED = 'frame.stored';
export const HOST_ERROR = 'error';

/**
 * 봉투 하나의 바이트 상한입니다. `apps/native-host/src/protocol.rs` 의
 * `MAX_MESSAGE_BYTES = 1024 * 1024` 와 같은 값이어야 합니다.
 */
export const MAX_MESSAGE_BYTES = 1_048_576;

/** 프레임 식별자 규칙입니다. 계약 (가)에 적힌 그대로입니다. */
export const SCREEN_FRAME_ID_PATTERN = /^sf-[A-Za-z0-9_-]{1,60}$/;

/**
 * 교시 식별자 규칙입니다. 호스트의 `is_contract_period_id`
 * (`apps/native-host/src/store/frames.rs`)와 **같은 규칙** 이어야 합니다.
 * 호스트는 이 이름으로 교시 폴더를 만들기 때문에 모양이 어긋나면 프레임이 통째로 거절됩니다.
 */
export const PERIOD_ID_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-p[1-9][0-9]*$/;

/** 교시 폴더 안에서 프레임이 들어가는 하위 폴더 이름입니다. */
export const FRAME_DIRECTORY = 'frames';

/** 확장 → 호스트. 프레임 한 장을 저장해 달라는 부탁입니다. */
export interface FrameStoreMessage {
  type: typeof FRAME_STORE;
  periodId: string;
  /** 계약 정본 아홉 칸 그대로입니다. `path` 는 아래 `framePathFor` 가 계산한 값입니다. */
  frame: ScreenFrame;
  /** WebP 바이트를 base64 로 적은 것입니다. */
  bytesBase64: string;
}

/** 호스트 → 확장. 저장이 끝났다는 답입니다. */
export interface FrameStoredMessage {
  type: typeof FRAME_STORED;
  periodId: string;
  id: string;
  path: string;
  bytes: number;
  /**
   * 이 교시 **기록(events)** 에서 이 프레임이 붙은 순번입니다.
   *
   * "몇 번째 프레임인지" 가 **아닙니다.** 호스트는 프레임뿐 아니라 전사 같은 다른 기록도
   * 같은 표에 이어 붙이고(`apps/native-host/src/store/mod.rs` 의 `events` 표는
   * `seq INTEGER PRIMARY KEY AUTOINCREMENT`), 그 표의 번호를 그대로 돌려줍니다. 그래서
   * 첫 프레임의 `seq` 가 10 일 수 있습니다. 장 수를 알고 싶으면 확장이 따로 세야 합니다.
   */
  seq: number;
}

/** 호스트 → 확장. 한 부탁이 실패했다는 답입니다. 프로세스는 계속 삽니다. */
export interface HostErrorMessage {
  type: typeof HOST_ERROR;
  message: string;
  /** 사람이 읽을 짧은 이유. 토큰·URL·비밀값을 담지 않습니다(불변 원칙 §4-2). */
  reason: string;
  /** 어떤 부탁을 처리하다 실패했는지입니다. 보기 `frame.store`. */
  received: string;
}

export type HostMessage = FrameStoreMessage | FrameStoredMessage | HostErrorMessage;

/** 봉투를 만들지 못한 까닭입니다. 지금은 크기 하나뿐입니다. */
export type FrameStoreSkipReason = 'too-large';

export type BuildFrameStoreResult =
  | {
      skipped: false;
      message: FrameStoreMessage;
      /** 직렬화한 봉투의 UTF-8 바이트 수입니다. */
      envelopeBytes: number;
    }
  | {
      skipped: true;
      reason: FrameStoreSkipReason;
      envelopeBytes: number;
    };

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** 글자 → 6비트 값. 없는 글자는 -1 입니다. */
const BASE64_REVERSE = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    table[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

function base64Char(sixBits: number): string {
  return BASE64_ALPHABET[sixBits] ?? '';
}

/**
 * 바이트 배열을 base64 문자열로 적습니다.
 *
 * `btoa` 를 쓰지 않는 이유: Node 에서는 유산(legacy) API 로 표시돼 있고, 큰 배열을
 * `String.fromCharCode(...bytes)` 로 넘기면 인자 수 한계에 걸립니다. 여기서는 세 바이트씩
 * 네 글자로 바꾸는 규칙을 그대로 적어 두 환경(Node 시험 · MV3 확장)에서 같게 돕니다.
 */
export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];

    parts.push(base64Char(b0 >> 2));
    parts.push(base64Char(((b0 & 0b11) << 4) | ((b1 ?? 0) >> 4)));
    parts.push(b1 === undefined ? '=' : base64Char(((b1 & 0b1111) << 2) | ((b2 ?? 0) >> 6)));
    parts.push(b2 === undefined ? '=' : base64Char(b2 & 0b111111));
  }
  return parts.join('');
}

/** base64 문자열을 바이트 배열로 되돌립니다. 모양이 틀리면 RangeError 로 막습니다. */
export function fromBase64(text: string): Uint8Array {
  if (text.length % 4 !== 0) {
    throw new RangeError('base64 길이는 4의 배수여야 해요');
  }
  if (text.length === 0) {
    return new Uint8Array(0);
  }

  let padding = 0;
  if (text.endsWith('==')) padding = 2;
  else if (text.endsWith('=')) padding = 1;

  const out = new Uint8Array((text.length / 4) * 3 - padding);
  let outIndex = 0;

  for (let i = 0; i < text.length; i += 4) {
    const values = [0, 0, 0, 0];
    let padded = false;
    for (let k = 0; k < 4; k += 1) {
      const code = text.charCodeAt(i + k);
      if (code === 61 /* '=' */) {
        // 채움 글자는 마지막 묶음의 셋째·넷째 자리에만 올 수 있습니다.
        if (i + 4 < text.length || k < 2) {
          throw new RangeError('base64 채움 글자 자리가 올바르지 않아요');
        }
        padded = true;
        values[k] = 0;
        continue;
      }
      if (padded) {
        // 채움 글자 뒤에 다시 글자가 오면 모양이 깨진 것입니다.
        throw new RangeError('base64 채움 글자 뒤에 글자가 더 있어요');
      }
      const value = code < 128 ? (BASE64_REVERSE[code] ?? -1) : -1;
      if (value < 0) {
        throw new RangeError('base64 에 쓸 수 없는 글자가 있어요');
      }
      values[k] = value;
    }

    const [v0 = 0, v1 = 0, v2 = 0, v3 = 0] = values;
    if (outIndex < out.length) out[outIndex] = (v0 << 2) | (v1 >> 4);
    outIndex += 1;
    if (outIndex < out.length) out[outIndex] = ((v1 & 0b1111) << 4) | (v2 >> 2);
    outIndex += 1;
    if (outIndex < out.length) out[outIndex] = ((v2 & 0b11) << 6) | v3;
    outIndex += 1;
  }

  return out;
}

/** 프레임 식별자가 계약 (가)의 규칙에 맞는지 봅니다. 아니면 RangeError 로 막습니다. */
export function assertScreenFrameId(id: string): void {
  if (!SCREEN_FRAME_ID_PATTERN.test(id)) {
    throw new RangeError('프레임 식별자는 sf- 로 시작하는 61글자 이하의 이름이어야 해요');
  }
}

/**
 * 교시 식별자가 계약 모양(`2026-09-02-p3`)인지 봅니다. 아니면 RangeError 로 막습니다.
 * 호스트가 거절할 값을 확장 안에서 먼저 막아, 프레임을 한 시간 모아 두었다가 통째로
 * 버리는 일이 없게 합니다.
 */
export function assertPeriodId(periodId: string): void {
  if (!PERIOD_ID_PATTERN.test(periodId)) {
    throw new RangeError('교시 식별자는 2026-09-02-p3 모양이어야 해요');
  }
}

/**
 * 프레임 파일의 상대 경로를 **식별자에서 계산합니다.**
 * 확장이 보낸 `path` 문자열을 그대로 쓰지 않는 것이 Gate D 결정의 핵심입니다.
 */
export function framePathFor(id: string): string {
  assertScreenFrameId(id);
  return `${FRAME_DIRECTORY}/${id}.webp`;
}

/** 문자열을 UTF-8 로 적었을 때의 바이트 수입니다. 봉투 크기를 재는 데 씁니다. */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * 바이트 `n` 개를 base64 로 적으면 몇 글자가 되는지입니다.
 *
 * 규칙이 "3바이트 → 4글자, 모자라면 `=` 로 채움" 이라 실제로 만들어 보지 않아도 셀 수
 * 있습니다. base64 글자는 전부 ASCII 라 **글자 수 = UTF-8 바이트 수** 이기도 합니다.
 * 봉투 크기를 재려고 606 KiB 짜리 문자열을 한 번 더 만드는 일을 이 산술이 없앱니다.
 */
export function base64Length(byteCount: number): number {
  return 4 * Math.ceil(byteCount / 3);
}

/**
 * 계약 `ScreenFrame` 아홉 칸만 골라 담습니다.
 *
 * 왜 펼치지(`...frame`) 않는가: 통 안의 모양(`CapturedFrame`)에는 `bytes · mime` 두 칸이
 * 더 있고, 앞으로 칸이 더 붙을 수도 있습니다. 펼쳐 담으면 그 여분이 봉투에 실려 호스트의
 * `additionalProperties: false` 검증에 걸립니다. 그래서 아홉 칸을 손으로 골라 담습니다.
 */
function pickScreenFrame(frame: ScreenFrame, path: string): ScreenFrame {
  return {
    id: frame.id,
    periodId: frame.periodId,
    capturedAt: frame.capturedAt,
    path,
    width: frame.width,
    height: frame.height,
    hash: frame.hash,
    changedFromPrev: frame.changedFromPrev,
    source: frame.source,
  };
}

/**
 * `frame.store` 봉투 하나를 만듭니다.
 *
 * - `frame` 칸에는 계약 아홉 칸만 담습니다. 여분 칸은 여기서 떨어집니다.
 * - `path` 는 `frame.path` 를 믿지 않고 `frame.id` 에서 다시 계산합니다.
 * - 직렬화한 봉투가 `MAX_MESSAGE_BYTES` 를 **넘으면** 만들지 않고 건너뜁니다.
 *   상한과 정확히 같은 크기는 보냅니다(호스트도 `>` 로 판정합니다).
 *
 * 크기는 **base64 를 만들기 전에** 잽니다. 고정 부분(base64 를 뺀 봉투)만 직렬화하고
 * 거기에 `base64Length(bytes.length)` 를 더하면 값이 정확히 같습니다. 그래서 상한을 넘는
 * 장은 큰 문자열을 한 번도 만들지 않고 건너뜁니다.
 */
export function buildFrameStore(frame: ScreenFrame, bytes: Uint8Array): BuildFrameStoreResult {
  const path = framePathFor(frame.id);

  // `bytesBase64` 를 빈 문자열로 둔 봉투입니다. 뒤에서 채워도 칸 순서가 그대로라
  // 직렬화 결과는 "이 문자열 + base64 글자들" 과 정확히 같습니다.
  const skeleton: FrameStoreMessage = {
    type: FRAME_STORE,
    periodId: frame.periodId,
    frame: pickScreenFrame(frame, path),
    bytesBase64: '',
  };

  const envelopeBytes = utf8ByteLength(JSON.stringify(skeleton)) + base64Length(bytes.length);
  if (envelopeBytes > MAX_MESSAGE_BYTES) {
    return { skipped: true, reason: 'too-large', envelopeBytes };
  }

  return {
    skipped: false,
    message: { ...skeleton, bytesBase64: toBase64(bytes) },
    envelopeBytes,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 호스트가 보낸 값이 `frame.stored` 인지 좁혀 줍니다. */
export function isFrameStoredMessage(value: unknown): value is FrameStoredMessage {
  if (!isRecord(value) || value['type'] !== FRAME_STORED) return false;
  return (
    typeof value['periodId'] === 'string' &&
    typeof value['id'] === 'string' &&
    typeof value['path'] === 'string' &&
    typeof value['bytes'] === 'number' &&
    typeof value['seq'] === 'number'
  );
}

/** 호스트가 보낸 값이 오류 답인지 좁혀 줍니다. */
export function isHostErrorMessage(value: unknown): value is HostErrorMessage {
  if (!isRecord(value) || value['type'] !== HOST_ERROR) return false;
  return (
    typeof value['message'] === 'string' &&
    typeof value['reason'] === 'string' &&
    typeof value['received'] === 'string'
  );
}
