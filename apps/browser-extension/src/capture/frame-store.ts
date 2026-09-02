/**
 * 변화가 감지된 프레임만 담아 두는 통입니다.
 *
 * 왜 통이 필요한가:
 *   한 교시는 60분입니다. 그 동안 화면이 바뀔 때마다 WebP 한 장이 쌓이는데, 서비스
 *   워커·Offscreen 문서 메모리는 무한하지 않습니다. 그래서 (1) 교시 길이(기본 60분),
 *   (2) 바이트 합계, (3) 장 수 세 가지 상한을 두고 넘치면 **오래된 것부터** 버립니다.
 *   버린 장 수는 세어 두었다가 화면 하단 SourceFooter 에 알릴 수 있게 합니다.
 *
 * 계약과의 관계 (packages/contracts/schemas/screen-frame.schema.json):
 *   스키마는 `id · periodId · capturedAt · path · width · height · hash · changedFromPrev
 *   · source` 아홉 칸만 허용합니다(`additionalProperties: false`). 그런데 캡처 파이프라인은
 *   "이 장이 몇 바이트인지"를 알아야 상한을 지킬 수 있습니다. 그래서 통 안에서는
 *   `bytes · mime` 두 칸을 더 들고 다니고, 계약으로 내보낼 때 `toScreenFrame` 이
 *   아홉 칸만 남깁니다. 바이트는 파일로 저장되므로 계약에는 `path` 만 남으면 됩니다.
 *
 *   모양을 손으로 베끼지 않습니다. `@classmate/contracts` 의 `ScreenFrame` 을 그대로
 *   **타입으로만** 들여와서 씁니다(`import type`). 값을 들여오면 Ajv 가 확장 번들에 섞여
 *   MV3 의 콘텐츠 보안 정책에 걸립니다. 스키마가 바뀌면 여기 타입도 같이 깨져서
 *   `pnpm --filter @classmate/browser-extension typecheck` 가 먼저 알려 줍니다.
 *
 * 프레임 id 는 이렇게 생겼습니다.
 *
 *   sf-p3-103210-001
 *   │  │  │      └─ 이 캡처 세션에서 몇 번째 장인지 (세 자리, 1000장을 넘으면 네 자리)
 *   │  │  └──────── 캡처를 시작한 시각 시분초 (UTC)  ← 같은 교시에서 다시 켠 것을 가름
 *   │  └─────────── 교시 조각 (periodId 의 `p3`)
 *   └────────────── 계약이 요구하는 머리글자
 *
 *   교시와 시작 시각을 붙이는 까닭은 호스트가 교시마다 `frames.id` 를 기본 키로 두고
 *   같은 id 를 `duplicate-frame` 으로 거절하기 때문입니다. 예전처럼 `sf-001` 부터 다시
 *   붙이면 같은 교시에서 캡처를 껐다 켠 순간부터 모든 장이 거절됩니다.
 */

import { assertPeriodId, assertScreenFrameId } from './host-messages';

import type { ScreenFrame } from '@classmate/contracts';

/** 이 프레임이 어디에서 왔는지. 계약의 `source` 칸에서 그대로 끌어옵니다. */
export type ScreenFrameSource = ScreenFrame['source'];

/**
 * 계약 정본 그대로입니다. 예전 이름을 쓰던 자리를 위해 남겨 둔 별칭이고,
 * 새 코드에서는 `ScreenFrame` 을 직접 쓰면 됩니다.
 */
export type ScreenFrameRecord = ScreenFrame;

/** 통 안에서 들고 다니는 모양. 계약 아홉 칸 + 통이 필요한 두 칸입니다. */
export type CapturedFrame = ScreenFrame & {
  /** WebP 로 인코딩한 결과의 바이트 수입니다. 바이트 상한을 지키는 데 씁니다. */
  bytes: number;
  mime: 'image/webp';
};

/** 통에 넣을 때 주는 값. id 와 path 는 통이 붙입니다. */
export interface FrameInput {
  capturedAt: Date | string | number;
  /** 소문자 16진 dHash 입니다. dhash.ts 의 toHex 결과를 그대로 넣습니다. */
  hash: string;
  bytes: number;
  width: number;
  height: number;
  changedFromPrev?: boolean;
}

export interface FrameStoreOptions {
  /** 교시 세션 식별자. 보기 `2026-09-02-p3`. */
  periodId: string;
  source?: ScreenFrameSource;
  /** 가장 오래된 장과 가장 새 장의 시각 차 상한. 기본 60분(한 교시). */
  maxDurationMs?: number;
  /** 바이트 합계 상한. 기본 48MiB. */
  maxBytes?: number;
  /** 장 수 상한. 기본 3600장(1fps 로 60분). */
  maxFrames?: number;
  /**
   * 이 캡처 세션이 시작한 시각입니다. id 가운데 여섯 자리(`103210`)가 여기서 나옵니다.
   * 기본값은 통을 만드는 지금입니다. 시험에서는 고정된 값을 넣어 id 를 확정합니다.
   */
  startedAt?: Date | string | number;
}

export interface FrameStoreStats {
  frames: number;
  totalBytes: number;
  droppedFrames: number;
  droppedBytes: number;
  oldestCapturedAt: string | null;
  newestCapturedAt: string | null;
}

/** 한 교시 = 60분. 불변 원칙 §4-4 의 "핵심 장면만" 을 지키는 기본 상한입니다. */
export const DEFAULT_MAX_DURATION_MS = 60 * 60 * 1000;

/** 기본 바이트 상한 48MiB. 1280폭 WebP 한 장이 대략 수십 KiB 이라 수백 장이 들어갑니다. */
export const DEFAULT_MAX_BYTES = 48 * 1024 * 1024;

/** 기본 장 수 상한. 1fps 로 60분을 전부 담아도 넘지 않는 수입니다. */
export const DEFAULT_MAX_FRAMES = 3600;

function toIsoString(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('프레임 시각이 올바르지 않아요');
  }
  return date.toISOString();
}

/**
 * 교시 식별자에서 교시 조각만 뽑습니다. `2026-09-02-p3` → `p3`.
 *
 * 계약 모양이 `YYYY-MM-DD-p<번호>` 라 마지막 `-` 뒤가 곧 교시 조각입니다. 모양이 다르면
 * `assertPeriodId` 가 먼저 막으므로 여기서는 뽑기만 합니다.
 */
export function periodSegment(periodId: string): string {
  assertPeriodId(periodId);
  return periodId.slice(periodId.lastIndexOf('-') + 1);
}

/**
 * 시각을 `시분초` 여섯 자리로 적습니다. `10:32:10` → `103210`.
 *
 * **UTC 기준**입니다. 시계를 어느 시간대에 맞춰 두었든 같은 순간이면 같은 글자가 나와야
 * 시험이 기계마다 흔들리지 않기 때문입니다(프레임의 `capturedAt` 도 UTC 로 적습니다).
 */
export function compactUtcTime(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('캡처 시작 시각이 올바르지 않아요');
  }
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${hours}${minutes}${seconds}`;
}

/**
 * id 앞에 붙일 글자를 만듭니다. `2026-09-02-p3` + `10:32:10` → `sf-p3-103210-`.
 *
 * 왜 교시와 시작 시각을 함께 넣는가:
 *   호스트는 교시마다 `frames.id` 를 기본 키로 둡니다
 *   (`apps/native-host/src/store/frames.rs` 의 `duplicate-frame` 거절). 예전처럼 `sf-001`
 *   부터 다시 붙이면, 같은 교시에서 캡처를 껐다 켠 순간부터 모든 장이 "이미 있는 id" 로
 *   거절됩니다. 교시 조각은 어느 교시의 장인지 눈으로 보이게 하고, 시작 시각 여섯 자리는
 *   같은 교시 안의 재시작을 갈라 줍니다.
 *
 * 한계: 가르는 단위가 **1초**입니다. 같은 교시에서 같은 초에 두 번 시작하면 겹칩니다.
 * 캡처 시작은 사람 손짓(`tabCapture` 가 요구합니다) 뒤에만 되므로 실제로는 닿지 않습니다.
 */
export function frameIdPrefix(periodId: string, startedAt: Date | string | number): string {
  return `sf-${periodSegment(periodId)}-${compactUtcTime(startedAt)}-`;
}

interface Entry {
  frame: CapturedFrame;
  atMs: number;
}

export class FrameStore {
  readonly periodId: string;
  readonly source: ScreenFrameSource;
  readonly maxDurationMs: number;
  readonly maxBytes: number;
  readonly maxFrames: number;
  /** id 앞에 붙는 글자입니다. 보기 `sf-p3-103210-`. 교시와 캡처 시작 시각이 들어 있습니다. */
  readonly idPrefix: string;

  private entries: Entry[] = [];
  private nextSequence = 1;
  private bytes = 0;
  private dropped = 0;
  private droppedBytesTotal = 0;

  constructor(options: FrameStoreOptions) {
    // 교시 이름은 호스트와 **같은 규칙**으로 먼저 봅니다. 호스트가 거절할 이름을 여기서
    // 막아, 한 시간 모은 장을 통째로 버리는 일이 없게 합니다.
    assertPeriodId(options.periodId);

    this.periodId = options.periodId;
    this.source = options.source ?? 'meet-tab';
    this.maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.maxFrames = options.maxFrames ?? DEFAULT_MAX_FRAMES;
    this.idPrefix = frameIdPrefix(this.periodId, options.startedAt ?? new Date());

    if (this.maxDurationMs <= 0 || this.maxBytes <= 0 || this.maxFrames <= 0) {
      throw new RangeError('상한은 0 보다 커야 해요');
    }

    // 첫 id 를 미리 만들어 봅니다. 규칙에 안 맞으면(보기: 교시 번호가 지나치게 길어 61글자를
    // 넘음) 프레임을 담기 시작한 뒤가 아니라 **지금** 막힙니다.
    this.idFor(this.nextSequence);
  }

  /** 지금 들고 있는 장 수입니다. */
  get size(): number {
    return this.entries.length;
  }

  /** 지금 들고 있는 바이트 합계입니다. */
  get totalBytes(): number {
    return this.bytes;
  }

  /** 상한 때문에 버린 장 수입니다. */
  get droppedFrames(): number {
    return this.dropped;
  }

  /**
   * 프레임 한 장을 넣고, 상한을 넘으면 오래된 것부터 버립니다.
   * 새로 만든 장을 돌려줍니다(id·path 가 붙은 모양).
   */
  add(input: FrameInput): CapturedFrame {
    if (!Number.isFinite(input.bytes) || input.bytes < 0) {
      throw new RangeError('프레임 바이트 수가 올바르지 않아요');
    }
    if (!/^[0-9a-f]+$/.test(input.hash)) {
      throw new RangeError('해시는 소문자 16진 문자열이어야 해요');
    }

    const capturedAt = toIsoString(input.capturedAt);
    const id = this.idFor(this.nextSequence);
    this.nextSequence += 1;

    const frame: CapturedFrame = {
      id,
      periodId: this.periodId,
      capturedAt,
      path: `frames/${id}.webp`,
      width: input.width,
      height: input.height,
      hash: input.hash,
      changedFromPrev: input.changedFromPrev ?? true,
      source: this.source,
      bytes: input.bytes,
      mime: 'image/webp',
    };

    this.entries.push({ frame, atMs: Date.parse(capturedAt) });
    this.bytes += input.bytes;
    this.evict();
    return frame;
  }

  /**
   * 순번 하나로 id 를 만듭니다. `sf-p3-103210-001` 모양입니다.
   * 만든 값은 곧바로 호스트와 **같은 규칙**으로 확인합니다(계약 `^sf-[A-Za-z0-9_-]{1,60}$`).
   */
  private idFor(sequence: number): string {
    const id = `${this.idPrefix}${String(sequence).padStart(3, '0')}`;
    assertScreenFrameId(id);
    return id;
  }

  /** 오래된 것부터 버려 세 상한을 모두 지키게 만듭니다. 마지막 한 장은 남깁니다. */
  private evict(): void {
    while (this.entries.length > 1 && this.overLimit()) {
      const removed = this.entries.shift();
      if (!removed) break;
      this.bytes -= removed.frame.bytes;
      this.dropped += 1;
      this.droppedBytesTotal += removed.frame.bytes;
    }
  }

  private overLimit(): boolean {
    if (this.entries.length > this.maxFrames) return true;
    if (this.bytes > this.maxBytes) return true;

    const oldest = this.entries[0];
    const newest = this.entries[this.entries.length - 1];
    if (!oldest || !newest) return false;
    return newest.atMs - oldest.atMs > this.maxDurationMs;
  }

  /** 오래된 순서로 지금 들고 있는 장 전부입니다. */
  list(): CapturedFrame[] {
    return this.entries.map((entry) => entry.frame);
  }

  /** 가장 최근 장입니다. 없으면 null 입니다. */
  latest(): CapturedFrame | null {
    return this.entries[this.entries.length - 1]?.frame ?? null;
  }

  stats(): FrameStoreStats {
    return {
      frames: this.entries.length,
      totalBytes: this.bytes,
      droppedFrames: this.dropped,
      droppedBytes: this.droppedBytesTotal,
      oldestCapturedAt: this.entries[0]?.frame.capturedAt ?? null,
      newestCapturedAt: this.latest()?.capturedAt ?? null,
    };
  }

  /** 계약(ScreenFrame)으로 내보냅니다. bytes·mime 두 칸은 여기서 떨어집니다. */
  toScreenFrames(): ScreenFrame[] {
    return this.entries.map((entry) => toScreenFrame(entry.frame));
  }

  /** 교시가 끝나면 통을 비웁니다. id 번호는 이어서 갑니다. */
  clear(): void {
    this.entries = [];
    this.bytes = 0;
  }
}

/** 통 안의 모양에서 계약 아홉 칸만 남깁니다. */
export function toScreenFrame(frame: CapturedFrame): ScreenFrame {
  return {
    id: frame.id,
    periodId: frame.periodId,
    capturedAt: frame.capturedAt,
    path: frame.path,
    width: frame.width,
    height: frame.height,
    hash: frame.hash,
    changedFromPrev: frame.changedFromPrev,
    source: frame.source,
  };
}
