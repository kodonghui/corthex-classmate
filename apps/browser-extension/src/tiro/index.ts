/**
 * Tiro 전사 커넥터 입구.
 *
 * 세 갈래를 같은 인터페이스(`TiroConnector`)로 내놓습니다.
 *  - `createShareConnector` : 공유 페이지 DOM 을 읽는 2순위 경로. **지금 기본값**이고 동작합니다.
 *  - `createMcpConnector`   : 공식 MCP `get_note_transcript` 를 쓰는 1순위 경로. 아직 스텁입니다.
 *  - `createApiConnector`   : 공식 REST API 를 쓰는 1순위 경로. 아직 스텁입니다.
 *
 * Gate A 판정(docs/spikes/gate-a-tiro.md): 2순위가 부분 합격이라 기본 커넥터로 씁니다.
 * 1순위가 합격하면 기본값을 바꾸고 `docs/DECISIONS.md` 에 적습니다.
 */
import { resolvePeriodId } from './period';
import { startShareObserver } from './share-observer';
import type { ShareObserverHandle } from './share-observer';
import type {
  HintDegradedSignal,
  SelectorBrokenSignal,
  TiroConnector,
  TiroPartial,
  TranscriptSegment,
  Unsubscribe,
} from './types';

export type * from './types';
export * from './period';
export * from './share-parser';
export * from './share-observer';
export * from './lifecycle';

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
  /**
   * 교시 식별자입니다. 이미 만들어 둔 값이 있으면 이것을 넣습니다.
   *
   * 없으면 `periodNumber`(그것도 없으면 1)와 `now()` 의 날짜로 만듭니다.
   * 저장소는 여기서 읽지 않습니다 — 읽기가 비동기라 커넥터를 만드는 자리를 비동기로 물들입니다.
   * 부르는 쪽이 `readPeriodNumber()` 로 먼저 읽어 `periodNumber` 로 넣어 주세요.
   */
  periodId?: string | undefined;
  /** 교시 번호(1~8). `periodId` 가 없을 때만 봅니다. 범위 밖이면 1 로 되돌립니다. */
  periodNumber?: number | undefined;
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
  const degraded = listenerSet<HintDegradedSignal>();
  const broken = listenerSet<SelectorBrokenSignal>();

  // 교시 식별자는 **만들 때 한 번** 정합니다. start() 마다 다시 정하면 자정을 넘긴 교시가
  // 도중에 다른 식별자로 갈립니다.
  const periodId = resolvePeriodId({
    periodId: options.periodId,
    periodNumber: options.periodNumber,
    now: options.now,
  });

  let handle: ShareObserverHandle | null = null;

  return {
    kind: 'tiro-share',
    implemented: true,
    start() {
      if (handle) return;
      handle = startShareObserver({
        root: options.root,
        periodId,
        onSegment: (segment) => segments.emit(segment),
        onPartial: (partial) => partials.emit(partial),
        onHintDegraded: (signal) => degraded.emit(signal),
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
      degraded.clear();
      broken.clear();
    },
    flush() {
      // 시작한 적이 없으면 마무리할 것도 없습니다.
      return handle?.flush() ?? [];
    },
    onSegment: (listener) => segments.add(listener),
    onPartial: (listener) => partials.add(listener),
    onHintDegraded: (listener) => degraded.add(listener),
    onSelectorBroken: (listener) => broken.add(listener),
  };
}

/** 1순위(MCP) 커넥터가 아직 못 하는 이유입니다. 화면에 그대로 쓸 수 있는 문구입니다. */
export const API_CONNECTOR_BLOCKED_REASON =
  'Tiro MCP 인증이 아직 없어요 · 공유 페이지로 듣고 있어요';

/** 아직 채우지 않은 커넥터가 내는 기계용 표시입니다. 오류 메시지와 `name` 에 함께 들어갑니다. */
export const NOT_IMPLEMENTED_CODE = 'not-implemented';

/**
 * 아직 채우지 않은 커넥터가 `start()` 때 던지는 오류입니다.
 *
 * 왜 이벤트가 아니라 오류인가: 스텁은 리스너를 붙일 기회 자체를 주지 않습니다. `start()` 가
 * 조용히 아무것도 안 하고 돌아오면, 부르는 쪽은 전사가 오기를 영원히 기다립니다. 오류는
 * 그 자리에서 눈에 띄고 `NOT_IMPLEMENTED_CODE` 로 기계도 가릴 수 있습니다.
 * 사람에게 배너로 보여 주는 일은 background 가 `connector.status` 로 옮겨 실을 2라운드 몫입니다.
 */
export function notImplementedError(what: string, reason: string): Error {
  const error = new Error(`${what}는 아직 구현되지 않았어요 · ${NOT_IMPLEMENTED_CODE} · ${reason}`);
  error.name = 'TiroNotImplementedError';
  return error;
}

/** 아무것도 하지 않는 커넥터 하나를 찍어 냅니다. 두 스텁이 같은 틀을 씁니다. */
function createStubConnector(what: string, reason: string): TiroConnector {
  const noop: Unsubscribe = () => {};
  return {
    kind: 'tiro-api',
    implemented: false,
    start() {
      throw notImplementedError(what, reason);
    },
    stop() {
      // 시작한 적이 없으니 멈출 것도 없습니다.
    },
    flush() {
      // 모아 둔 문단이 없으니 마무리할 것도 없습니다. 여기서 던지면 교시 종료 정리가 끊깁니다.
      return [];
    },
    onSegment: () => noop,
    onPartial: () => noop,
    onHintDegraded: () => noop,
    onSelectorBroken: () => noop,
  };
}

/**
 * 1순위(공식 MCP `get_note_transcript`) 커넥터 **스텁**입니다.
 *
 * 왜 비어 있나: Gate A 의 (a) 측정이 BLOCKED 입니다. `get_note_transcript` 가 **녹음 중에도**
 * 문단을 돌려주는지 아직 사람이 인증(`/mcp` → tiro → Authenticate)하고 재어 보지 않았습니다.
 * 재어 보기 전에 구현하면 무엇을 폴링할지·지연이 얼마인지 모르는 채로 코드를 쌓게 됩니다.
 *
 * 자격증명은 인자로 받지 않습니다. 토큰을 인자에 두면 호출부·로그·스택 추적에 값이 남습니다
 * (불변 원칙 §4). MCP 인증은 Claude Code 쪽 `/mcp` 흐름이 들고 있고 코드가 만지지 않습니다.
 *
 * 승인·측정이 끝나면 여기를 채우고 `docs/DECISIONS.md` 에 "Tiro 기본 커넥터 = ?" 를 적습니다.
 */
export function createMcpConnector(): TiroConnector {
  return createStubConnector('Tiro MCP 커넥터', API_CONNECTOR_BLOCKED_REASON);
}

/**
 * 1순위(공식 REST API) 커넥터 **스텁**입니다.
 *
 * MCP 스텁과 나누어 두는 이유: 실어 나르는 길이 다릅니다(MCP 도구 호출 · HTTPS 요청).
 * 어느 쪽이 실시간인지 아직 모르므로 자리를 둘 다 비워 둡니다. 세그먼트의 `source` 는
 * 계약상 둘 다 `tiro-api` 입니다(`transcript-segment.schema.json` 의 열거가 고정입니다).
 *
 * 자격증명은 인자로 받지 않습니다. API 키가 필요해지면 native host 쪽이 들고,
 * 확장은 값을 보지 않습니다.
 */
export function createApiConnector(): TiroConnector {
  return createStubConnector('Tiro API 커넥터', API_CONNECTOR_BLOCKED_REASON);
}
