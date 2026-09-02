/**
 * Tiro 전사 커넥터 입구.
 *
 * 두 갈래를 같은 인터페이스(`TiroConnector`)로 내놓습니다.
 *  - `createShareConnector` : 공유 페이지 DOM 을 읽는 2순위 경로. **지금 기본값**이고 동작합니다.
 *  - `createApiConnector`   : 공식 MCP `get_note_transcript` 를 쓰는 1순위 경로. 아직 스텁입니다.
 *
 * Gate A 판정(docs/spikes/gate-a-tiro.md): 2순위가 부분 합격이라 기본 커넥터로 씁니다.
 * 1순위가 합격하면 기본값을 바꾸고 `docs/DECISIONS.md` 에 적습니다.
 */
import { startShareObserver } from './share-observer';
import type { ShareObserverHandle } from './share-observer';
import type {
  SelectorBrokenSignal,
  TiroConnector,
  TiroPartial,
  TranscriptSegment,
  Unsubscribe,
} from './types';

export type * from './types';
export * from './share-parser';
export * from './share-observer';

/**
 * 공유 페이지 호스트입니다.
 *
 * 실측 경로 모양은 `tiro.ooo/<로케일>/s/<공유 id>` 입니다(docs/master-prompt.md §2-3).
 * **특정 공유 id 와 비밀번호는 코드에 넣지 않습니다** — 호스트와 경로 모양만 둡니다.
 */
export const TIRO_SHARE_HOST = 'tiro.ooo';

/** content script 가 붙을 곳입니다. 실제 활성화 여부는 `isSharePageUrl` 이 다시 거릅니다. */
export const TIRO_SHARE_MATCHES = ['https://tiro.ooo/*'] as const;

/**
 * 이 주소가 Tiro 공유 페이지인지입니다.
 *
 * 경로 조각에 `s` 가 있고 그 뒤에 조각이 하나 더 있으면 공유 페이지로 봅니다
 * (`/ko/s/<id>` · `/s/<id>` 둘 다). 로그인·설정 같은 다른 페이지에서는 붙지 않습니다.
 */
export function isSharePageUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.hostname !== TIRO_SHARE_HOST) return false;

  const parts = url.pathname.split('/').filter((part) => part.length > 0);
  const shareAt = parts.indexOf('s');
  return shareAt !== -1 && parts.length > shareAt + 1;
}

/**
 * 오늘 날짜와 교시 번호로 `PeriodId` 를 만듭니다. 보기 `2026-09-02-p3`.
 *
 * 기준은 **로컬 날짜**입니다. 수업이 도는 시간대가 곧 사용자의 시간대이기 때문입니다.
 */
export function makePeriodId(at: Date, periodNumber: number): string {
  if (!Number.isInteger(periodNumber) || periodNumber < 1) {
    throw new RangeError('교시 번호는 1 이상의 정수여야 해요');
  }
  const year = String(at.getFullYear()).padStart(4, '0');
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}-p${periodNumber}`;
}

/** 리스너 묶음 하나를 다루는 작은 도우미입니다. */
function listenerSet<T>() {
  const listeners = new Set<(value: T) => void>();
  return {
    add(listener: (value: T) => void): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      listeners.clear();
    },
    emit(value: T) {
      for (const listener of listeners) listener(value);
    },
  };
}

export interface ShareConnectorOptions {
  root: Element | Document;
  periodId: string;
  now?: () => Date;
  makeId?: (seq: number) => string;
  selectorBrokenGraceMs?: number;
}

/**
 * 공유 페이지 커넥터를 만듭니다. 만들기만 하고 `start()` 를 부를 때까지 아무것도 하지 않습니다.
 */
export function createShareConnector(options: ShareConnectorOptions): TiroConnector {
  const segments = listenerSet<TranscriptSegment>();
  const partials = listenerSet<TiroPartial>();
  const broken = listenerSet<SelectorBrokenSignal>();

  let handle: ShareObserverHandle | null = null;

  return {
    kind: 'tiro-share',
    implemented: true,
    start() {
      if (handle) return;
      handle = startShareObserver({
        root: options.root,
        periodId: options.periodId,
        onSegment: (segment) => segments.emit(segment),
        onPartial: (partial) => partials.emit(partial),
        onSelectorBroken: (signal) => broken.emit(signal),
        ...(options.now ? { now: options.now } : {}),
        ...(options.makeId ? { makeId: options.makeId } : {}),
        ...(options.selectorBrokenGraceMs !== undefined
          ? { selectorBrokenGraceMs: options.selectorBrokenGraceMs }
          : {}),
      });
    },
    stop() {
      handle?.stop();
      handle = null;
      segments.clear();
      partials.clear();
      broken.clear();
    },
    onSegment: (listener) => segments.add(listener),
    onPartial: (listener) => partials.add(listener),
    onSelectorBroken: (listener) => broken.add(listener),
  };
}

/** 1순위(MCP) 커넥터가 아직 못 하는 이유입니다. 화면에 그대로 쓸 수 있는 문구입니다. */
export const API_CONNECTOR_BLOCKED_REASON =
  'Tiro MCP 인증이 아직 없어요 · 공유 페이지로 듣고 있어요';

/**
 * 1순위(공식 API/MCP) 커넥터 **스텁**입니다.
 *
 * 왜 비어 있나: Gate A 의 (a) 측정이 BLOCKED 입니다. `get_note_transcript` 가 **녹음 중에도**
 * 문단을 돌려주는지 아직 사람이 인증(`/mcp` → tiro → Authenticate)하고 재어 보지 않았습니다.
 * 재어 보기 전에 구현하면 무엇을 폴링할지·지연이 얼마인지 모르는 채로 코드를 쌓게 됩니다.
 *
 * 승인·측정이 끝나면 여기를 채우고 `docs/DECISIONS.md` 에 "Tiro 기본 커넥터 = ?" 를 적습니다.
 */
export function createApiConnector(): TiroConnector {
  const noop: Unsubscribe = () => {};
  return {
    kind: 'tiro-api',
    implemented: false,
    start() {
      throw new Error(`Tiro API 커넥터는 아직 구현되지 않았어요 · ${API_CONNECTOR_BLOCKED_REASON}`);
    },
    stop() {
      // 시작한 적이 없으니 멈출 것도 없습니다.
    },
    onSegment: () => noop,
    onPartial: () => noop,
    onSelectorBroken: () => noop,
  };
}
