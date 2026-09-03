/**
 * 서비스 워커의 **순수 라우터**입니다. 들어온 말 하나를 보고 어디로 보낼지만 정합니다.
 *
 * `chrome` 전역을 직접 만지지 않습니다. 호스트·설정·커넥터 조종은 전부 주입받은 얼굴로
 * 하고, 패널은 `postMessage` 하나만 가진 포트로 봅니다. 그래서 이 파일은 표 하나로
 * 시험할 수 있습니다(입력 메시지 → 호스트로 나간 봉투 · 패널로 나간 사건).
 * 실제 `chrome` 배선은 `entrypoints/background.ts` 가 합니다.
 *
 * ```text
 *   content script ─ tiro.segment ─┐
 *   offscreen ───── capture.stats ─┤
 *                                  ├─▶ Router ─┬─▶ 호스트 봉투(event.append · tutor.ask · tutor.retry)
 *   사이드패널 ─── panel.event ────┤            ├─▶ 열려 있는 패널들(live.event · live.segment · …)
 *              ─── panel.ask ──────┤            └─▶ 교시 로그(닫았다 열면 되풀이)
 *              ─── classmate.reconnect ┘
 *   호스트 ────── tutor.event ─────┘
 * ```
 *
 * ## 들어온 말 → 나가는 것 (고정 계약 (라))
 *
 * | 들어온 말 | 호스트로 | 패널로 |
 * |---|---|---|
 * | `tiro.segment` | `event.append` `transcript.segment {segmentId, seq, state, segment}` | 같은 사건 + `live.segment` |
 * | `tiro.partial` | — | `live.segment` (`state: "partial"`) |
 * | `tiro.hint_degraded` (degraded) | `connector.status {tiro-share, paused, reason}` | 같은 사건 |
 * | `tiro.hint_degraded` (회복) | `connector.status {tiro-share, connected}` | 같은 사건 |
 * | `tiro.selector_broken` | `connector.status {tiro-share, paused, reason}` | 같은 사건 |
 * | `capture.stats` | `connector.status {meet-tab, …}` (바뀔 때만) | 같은 사건 |
 * | `capture.error` | `connector.status {meet-tab, off, reason}` | 같은 사건 |
 * | `panel.event` `question.asked` | **붙이지 않음** (호스트가 자기 기록본을 만듭니다) | — |
 * | `panel.event` 그 밖 | `event.append` 그대로 | — (보낸 패널이 이미 압니다) |
 * | `panel.ask` | `tutor.ask` 봉투 | 답이 `error` 면 `connector.status {provider, …}` |
 * | `classmate.reconnect` | 대상마다 다름 (아래) | — |
 * | 호스트 push `tutor.event` | — | `live.event` |
 * | 호스트 push `tutor.delta` | — | `live.delta` (**교시 로그에 담지 않습니다**) |
 *
 * 나간 `event.append` 의 **답도 읽습니다.** 호스트가 `error` 로 거절하면 그 줄은 교시 파일에
 * 안 들어간 것이라 `connector.status {native-host, paused, reason}` 을 내고, 다음 줄이
 * `event.ack` 로 붙으면 도로 `connected` 로 풉니다(`reportAppendResult`).
 *
 * `panel.ask` 한 줄에는 **화면 한 장이 더 붙습니다.** 질문이 오면 먼저 지금 Meet 화면을
 * 찍어 도우미에 담고, 그 이름표를 `snapshot.screenFrameId` 에 넣은 뒤 `tutor.ask` 를
 * 보냅니다. 못 찍었거나 {@link SCREEN_SNAPSHOT_TIMEOUT_MS} 를 넘기면 **화면 없이 그냥
 * 보냅니다** (`attachScreen`). 찍는 일 자체는 `entrypoints/background.ts` 가
 * `src/capture/snapshot.ts` 로 하고, 여기는 출구 하나(`ScreenSnapshotSource`)만 봅니다.
 *
 * 전사가 멈추는 두 줄(`tiro.hint_degraded` degraded · `tiro.selector_broken`)은 그때의 DOM
 * 모양 요약을 **서비스 워커 콘솔에만** 한 줄 남깁니다(`warnShape`). 계약 payload 는 늘리지
 * 않습니다 — 사람이 파서를 고칠 때 읽을 단서라 기록이 아니라 콘솔 자리입니다.
 *
 * 보안 메모 (불변 원칙 §4-7): 여기 오는 값은 **자료일 뿐 명령이 아닙니다.** 전사·화면에서
 * 읽은 문장을 실행하거나 URL 로 여는 코드를 이 라우터에 붙이지 않습니다. 하는 일은
 * 봉투를 고르고 옮기는 것뿐입니다.
 */

import type {
  Answer,
  EditorContext,
  QuestionSnapshot,
  ScreenFrame,
  SessionEvent,
  TranscriptSegment,
} from '@classmate/contracts';
import type { AskRequest, ReconnectTarget } from '../panel/ports';
import type {
  CaptureErrorMessage,
  CaptureState,
  CaptureStatsMessage,
} from '../capture/messages';
import { CAPTURE_ERROR, CAPTURE_STATS } from '../capture/messages';
import { makePeriodId } from '../tiro/period';
import type { LiveInboundMessage, LiveOutboundMessage } from '../live/messages';
import {
  LIVE_DELTA,
  LIVE_EDITOR,
  LIVE_EVENT,
  LIVE_FRAME,
  LIVE_SEGMENT,
  PANEL_ASK,
  PANEL_EVENT,
  PANEL_RECONNECT,
  isLiveOutboundMessage,
} from '../live/messages';
import type { HostEnvelope, TutorDeltaPush, TutorEventPush } from './host-messages';
import {
  EVENT_APPEND,
  MAX_QUESTION_BYTES,
  TUTOR_ASK,
  TUTOR_RETRY,
  isEventAckReply,
  isHostErrorMessage,
} from './host-messages';
import type { HostSendResult } from './host-client';
import type { TiroMessage } from './tiro-messages';
import { TIRO_MESSAGE_TYPES, isTiroMessage } from './tiro-messages';
import type { EventIdFactory } from './ids';
import { toKstIso } from './ids';
import type { PeriodLog } from './period-log';
import type { ClassmateSettings, SettingsSource } from './settings';

/** 패널 포트에서 우리가 쓰는 부분만입니다. `chrome.runtime.Port` 가 이 모양을 만족합니다. */
export interface PanelPortLike {
  postMessage(message: LiveInboundMessage): void;
}

/** 라우터가 호스트에게 부탁할 때 쓰는 얼굴입니다. `NativeHostClient` 가 이 모양입니다. */
export interface HostGateway {
  send(envelope: HostEnvelope): Promise<HostSendResult>;
  reconnectNow(): void;
}

/**
 * 질문을 붙잡은 순간의 **화면 한 장**을 구해 오는 자리입니다.
 *
 * 라우터는 `chrome` 을 모릅니다. 실제로 찍고 도우미에 담는 일은
 * `entrypoints/background.ts` 가 `src/capture/snapshot.ts` 로 합니다.
 *
 * @returns 도우미가 파일로 남긴 프레임의 이름표. 못 찍었거나 못 담았으면 `null`.
 *          **던지지 않습니다** — 화면 한 장 때문에 질문이 막히면 안 됩니다.
 */
export interface ScreenSnapshotSource {
  capture(periodId: string): Promise<string | null>;
}

/**
 * 질문에 붙일 화면을 기다려 주는 시간의 상한입니다.
 *
 * 왜 상한을 두는가: 학습자는 질문을 보내 놓고 답을 **기다리고 있습니다.** 화면 찍기는
 * `captureVisibleTab` 한 번 + base64 + 로컬 도우미 왕복이라 보통 200~400ms 안에 끝나지만,
 * 탭이 막 바뀌었거나 도우미가 굼뜨면 몇 초씩 늘어질 수 있습니다. 그때는 **화면을 포기하고
 * 질문을 먼저 보냅니다.** 답이 늦어지는 것이 화면이 없는 것보다 나쁩니다.
 *
 * 1500ms 인 근거: 사람은 1초 안쪽의 멈춤은 "반응했다" 로 느끼고 2초를 넘으면 "멈췄다" 로
 * 느낍니다. 흔한 경우(400ms)의 세 배 남짓을 주되 2초 벽은 넘지 않는 자리로 잡았습니다.
 */
export const SCREEN_SNAPSHOT_TIMEOUT_MS = 1500;

/** 커넥터를 다시 세우는 손잡이입니다. 실제 구현은 `entrypoints/background.ts` 가 넣습니다. */
export interface ConnectorControls {
  /** 공유 페이지 content script 에 `tiro.stop` 을 보낸 뒤 `tiro.start` 로 다시 시작시킵니다. */
  restartTiro(): void;
  /** 캡처를 멈췄다 다시 시작합니다. 탭을 못 찾으면 조용히 넘어갑니다. */
  restartCapture(): void;
}

export interface RouterOptions {
  host: HostGateway;
  settings: SettingsSource;
  controls: ConnectorControls;
  log: PeriodLog;
  ids: EventIdFactory;
  /**
   * 질문을 붙잡은 순간 화면 한 장을 구해 오는 자리입니다. 넣지 않으면 화면 없이 보냅니다
   * (1·2라운드 시험은 넣지 않습니다).
   */
  screen?: ScreenSnapshotSource;
  /** 화면 한 장을 기다려 주는 시간의 상한입니다. 기본 {@link SCREEN_SNAPSHOT_TIMEOUT_MS}. */
  screenTimeoutMs?: number;
  /** 지금 시각입니다. 시험은 고정된 시계를 넣습니다. */
  now?: () => Date;
  /** 사람이 읽을 한 줄입니다. 기본은 `console.warn`. */
  warn?: (message: string) => void;
  /**
   * 전사가 멈췄을 때 그 순간 공유 페이지 DOM 이 어떤 모양이었는지 남깁니다.
   *
   * **서비스 워커 콘솔에만** 남습니다. 계약 사건(`connector.status`)의 payload 는 그대로
   * 두고(`reason` 문자열 하나뿐입니다) 사람이 파서를 고칠 때 읽을 단서만 따로 흘립니다.
   * 요약에는 개수와 클래스 이름만 들어 있습니다(`src/tiro/share-parser.ts`).
   */
  warnShape?: (reason: string, shape: string) => void;
  /** 열려 있는 패널 수가 바뀔 때 부릅니다. 30분 알람을 켜고 끄는 자리입니다. */
  onPanelCountChange?: (count: number) => void;
  /**
   * 교시가 끝났을 때 부릅니다. 앞 교시의 보류 프레임을 버리는 자리입니다.
   *
   * 왜 필요한가: 프레임 통(`NativeHostFrameSink`)은 도우미가 꺼져 있는 동안 봉투를 들고
   * 있습니다. 교시가 끝난 뒤에 도우미가 돌아오면 그 봉투들이 **앞 교시의 `periodId`** 로
   * 새 교시에 흘러들어, 호스트가 거절하면 새 교시의 화면 커넥터가 호박색이 됩니다.
   */
  onPeriodEnd?: (periodId: string) => void;
}

/** 새로고침 중복을 거르려고 기억해 두는 전사 조각 수의 상한입니다. */
export const MAX_SEEN_SEGMENTS = 2000;

/** 자료가 하나도 봉인되지 않은 스냅숏입니다. 계약상 `snapshot` 은 빠질 수 없습니다. */
export function emptySnapshot(): QuestionSnapshot {
  return {
    transcriptSegmentIds: [],
    ages: { transcriptSec: null, screenSec: null, editorSec: null },
  };
}

/**
 * UTF-8 로 `maxBytes` 를 넘지 않게 자릅니다. **글자 한가운데를 자르지 않습니다.**
 *
 * 호스트는 4096바이트를 넘는 질문을 `question-too-long` 으로 거절합니다. 거절당해 질문이
 * 통째로 사라지는 것보다, 앞부분이라도 튜터에게 가는 편이 낫다고 보고 여기서 자릅니다.
 * 자른 사실은 부르는 쪽이 `text.length !== clamped.length` 로 압니다.
 *
 * **서로게이트 쌍 한가운데도 자르지 않습니다.** 자바스크립트 문자열은 UTF-16 코드 유닛
 * 배열이라 이모지 하나가 두 칸(`0xD83D 0xDE00`)입니다. 앞 칸만 남기면 JSON 에 `\ud83d` 라는
 * 짝 없는 서로게이트로 실리고, 호스트의 `serde_json` 이 봉투 전체를 거절합니다.
 */
export function clampUtf8(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= maxBytes) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (encoder.encode(text.slice(0, mid)).length <= maxBytes) low = mid;
    else high = mid - 1;
  }
  // 마지막 칸이 짝의 앞쪽(high surrogate)이면 뒤쪽 짝이 잘려 나간 것이므로 함께 뺍니다.
  const last = low > 0 ? text.charCodeAt(low - 1) : 0;
  if (last >= 0xd800 && last <= 0xdbff) low -= 1;
  return text.slice(0, low);
}

/** 캡처 상태를 계약 `connector.status` 의 상태 낱말로 옮깁니다. */
export function captureStateToConnector(state: CaptureState): {
  state: 'connected' | 'paused' | 'off';
  reason?: string;
} {
  switch (state) {
    case 'capturing':
      return { state: 'connected' };
    case 'starting':
      return { state: 'paused', reason: 'starting' };
    case 'error':
      return { state: 'off', reason: 'capture-error' };
    case 'stopped':
      return { state: 'off', reason: 'stopped' };
    case 'idle':
      return { state: 'off', reason: 'idle' };
  }
}

interface ConnectorSnapshot {
  state: 'connected' | 'paused' | 'off';
  reason: string | undefined;
}

/**
 * 서비스 워커가 내려갔다 다시 떠도 잃지 않아야 하는 라우터 상태입니다.
 *
 * MV3 서비스 워커는 30초를 놀면 내려갑니다. 이것을 `chrome.storage.session` 에 옮겨 적어
 * 두지 않으면 다시 뜬 워커가 `currentPeriodId === null` 을 보고 같은 교시에 `period.started`
 * 를 한 번 더 붙이고, 교시 끝의 `period.ended {questionCount, frameCount}` 가 마지막
 * 세대 몫만 셉니다.
 *
 * 전사 조각 기억(`seenSegments`)은 담지 않습니다. 최대 2,000줄의 본문이라 담는 값이
 * 커지고, 잃어도 같은 문단이 한 번 더 기록될 뿐입니다.
 */
export interface RouterSnapshot {
  periodId: string | null;
  frameCount: number;
  questionIds: string[];
  pendingQuestionId: string | null;
  connectors: [ReconnectTarget, ConnectorSnapshot][];
  /** 이번 교시의 `period.started` 그대로입니다. 되살린 워커가 다시 만들지 않게 합니다. */
  periodStarted: SessionEvent | null;
}

export class Router {
  private readonly host: HostGateway;
  private readonly settings: SettingsSource;
  private readonly controls: ConnectorControls;
  private readonly log: PeriodLog;
  private readonly ids: EventIdFactory;
  private readonly screen: ScreenSnapshotSource | null;
  private readonly screenTimeoutMs: number;
  private readonly now: () => Date;
  private readonly warn: (message: string) => void;
  private readonly warnShape: (reason: string, shape: string) => void;
  private readonly onPanelCountChange: (count: number) => void;
  private readonly onPeriodEnd: (periodId: string) => void;

  private readonly panels = new Set<PanelPortLike>();
  private readonly connectors = new Map<ReconnectTarget, ConnectorSnapshot>();
  /** 이번 교시에 붙잡은 질문들입니다. 패널과 호스트가 같은 질문을 알려도 한 번만 셉니다. */
  private readonly questionIds = new Set<string>();
  /**
   * 이번 교시에 본 전사 조각입니다. `조각 id → "<상태>\u0000<본문>"`.
   *
   * **공유 페이지를 새로고침하면 커넥터가 새로 태어나 `seq` 가 1부터 다시 셉니다**
   * (`src/tiro/share-observer.ts` 의 `defaultMakeId` 가 `ts-001` 부터 짓습니다). 그러면 이미
   * 본 문단이 같은 id·같은 본문으로 다시 옵니다. 서비스 워커는 사건마다 새 이름표를 짓기
   * 때문에(고정 계약 (라)) 그대로 붙이면 도우미의 `id` 중복 걸름에 걸리지 않고 같은 문단이
   * 두 줄이 됩니다. 그래서 **여기서** 거릅니다.
   *
   * 상태나 본문이 달라지면 거르지 않습니다. 같은 문단이 `partial` 로 한 번 나갔다가
   * `final` 로 확정되는 것은 새 사실이라 남겨야 합니다.
   */
  private readonly seenSegments = new Map<string, string>();

  private currentPeriodId: string | null = null;
  private provider: Answer['provider'] = 'claude';
  private frameCount = 0;
  /** 아직 답이 오지 않은 마지막 질문입니다. `classmate.reconnect {provider}` 가 이것을 씁니다. */
  private pendingQuestionId: string | null = null;
  /**
   * 이번 교시의 `period.started` 사건입니다.
   *
   * 교시 로그는 최근 500건만 들고 있어서, 화면이 자주 바뀌면 이 사건이 맨 앞에서 밀려납니다.
   * 그러면 패널을 닫았다 열 때 되풀이에 교시가 없어 과목명·교시 번호가 기본값으로 그려집니다.
   * 그래서 **사건 그대로** 들고 있다가 새 패널에 한 번 더 보냅니다. 스토어는 `event.id` 로
   * 같은 사건을 거르므로(`ReplayStore.pushEvent`) 로그에 아직 남아 있어도 두 번 그리지 않습니다.
   */
  private periodStartedEvent: SessionEvent | null = null;
  /** 진행 중인 `ensurePeriod` 하나입니다. 겹쳐 부르면 이것을 함께 기다립니다. */
  private ensuring: Promise<string> | null = null;
  /**
   * `event.append` 의 결말을 지금 알리는 중입니다.
   *
   * 알림 자체가 `connector.status` 사건 하나를 또 `event.append` 로 붙이기 때문에, 그것마저
   * 거절되면 같은 자리로 되돌아옵니다. 까닭이 매번 다르면 `setConnector` 의 "바뀔 때만" 걸름도
   * 못 막으므로 한 겹으로 잘라 둡니다. 안쪽 거절은 콘솔 한 줄로만 남깁니다.
   */
  private reportingAppend = false;

  constructor(options: RouterOptions) {
    this.host = options.host;
    this.settings = options.settings;
    this.controls = options.controls;
    this.log = options.log;
    this.ids = options.ids;
    this.screen = options.screen ?? null;
    this.screenTimeoutMs = options.screenTimeoutMs ?? SCREEN_SNAPSHOT_TIMEOUT_MS;
    this.now = options.now ?? (() => new Date());
    this.warn = options.warn ?? ((message) => console.warn(`[classmate] ${message}`));
    this.warnShape =
      options.warnShape ??
      ((reason, shape) => console.warn('[classmate] tiro selector shape', reason, shape));
    this.onPanelCountChange = options.onPanelCountChange ?? (() => {});
    this.onPeriodEnd = options.onPeriodEnd ?? (() => {});
  }

  /** 지금 교시입니다. 아직 시작하지 않았으면 null 입니다. */
  get periodId(): string | null {
    return this.currentPeriodId;
  }

  /** 지금 열려 있는 사이드패널 수입니다. */
  get panelCount(): number {
    return this.panels.size;
  }

  // ── 교시 ─────────────────────────────────────────────────────────────────

  /**
   * 교시가 없으면 시작하고, 교시 번호가 바뀌었으면 앞 교시를 끝내고 새로 시작합니다.
   *
   * 교시 식별자는 **오늘 날짜 + 저장소의 교시 번호**로 정합니다(`2026-09-02-p3`).
   * 계약 `PeriodId` 의 정규식이 이 모양이고 호스트가 이 이름으로 세션 파일을 만듭니다.
   *
   * **겹쳐 불러도 한 번만 시작합니다.** 안쪽의 `settings.read()` 가 기다림이라, 잠금이 없으면
   * 워커가 뜬 직후 패널 연결과 `tiro.segment` 가 둘 다 `currentPeriodId === null` 을 보고
   * 각각 교시를 시작합니다. 그러면 `period.started` 가 두 번 나가고 뒤엣것이 질문·전사·
   * 커넥터 기억을 도로 지웁니다. 그래서 진행 중인 약속 하나를 물고 있다가 함께 기다립니다.
   */
  async ensurePeriod(): Promise<string> {
    const running = this.ensuring;
    if (running !== null) return running;

    const started = this.resolvePeriod();
    this.ensuring = started;
    try {
      return await started;
    } finally {
      if (this.ensuring === started) this.ensuring = null;
    }
  }

  private async resolvePeriod(): Promise<string> {
    const settings = await this.settings.read();
    this.provider = settings.provider;
    const periodId = makePeriodId(this.now(), settings.periodNumber);
    if (this.currentPeriodId === periodId) return periodId;

    if (this.currentPeriodId !== null) {
      await this.finishPeriod();
    }
    await this.beginPeriod(periodId, settings);
    return periodId;
  }

  /**
   * 교시를 끝냅니다. 패널이 30분 동안 닫혀 있었을 때 알람이 부릅니다.
   * 이미 끝났으면 아무 일도 하지 않습니다.
   */
  async endPeriod(): Promise<void> {
    if (this.currentPeriodId === null) return;
    await this.finishPeriod();
  }

  private async beginPeriod(periodId: string, settings: ClassmateSettings): Promise<void> {
    this.currentPeriodId = periodId;
    this.log.reset(periodId);
    this.questionIds.clear();
    this.seenSegments.clear();
    this.connectors.clear();
    this.frameCount = 0;
    this.pendingQuestionId = null;
    const started = this.makeEvent(periodId, 'period.started', {
      periodId,
      subject: settings.subject,
      index: settings.periodNumber,
    });
    this.periodStartedEvent = started;
    await this.publish(started, true);
  }

  private async finishPeriod(): Promise<void> {
    const periodId = this.currentPeriodId;
    if (periodId === null) return;
    this.currentPeriodId = null;
    this.periodStartedEvent = null;
    await this.publish(
      this.makeEvent(periodId, 'period.ended', {
        periodId,
        questionCount: this.questionIds.size,
        frameCount: this.frameCount,
      }),
      true,
    );
    this.onPeriodEnd(periodId);
  }

  // ── 워커가 내려갔다 다시 뜰 때 ───────────────────────────────────────────

  /** 저장소에 옮겨 적을 상태 한 벌입니다. */
  snapshot(): RouterSnapshot {
    return {
      periodId: this.currentPeriodId,
      frameCount: this.frameCount,
      questionIds: [...this.questionIds],
      pendingQuestionId: this.pendingQuestionId,
      connectors: [...this.connectors].map(([target, snapshot]) => [target, { ...snapshot }]),
      periodStarted: this.periodStartedEvent,
    };
  }

  /**
   * 저장소에서 읽은 상태를 되살립니다. **사건을 새로 내지 않습니다.**
   *
   * 되살린 뒤 `ensurePeriod` 가 같은 교시 식별자를 계산하면 그대로 돌려주므로
   * `period.started` 가 다시 나가지 않고, 교시 끝의 셈도 이어집니다. 값이 상했으면
   * 던지지 않고 false 만 돌려줍니다(복원 하나 때문에 워커가 멈추는 편이 더 나쁩니다).
   *
   * @returns 되살렸으면 true 입니다.
   */
  restore(value: unknown): boolean {
    if (!isRecord(value)) return false;
    const periodId = value['periodId'];
    if (typeof periodId !== 'string') return false;

    this.currentPeriodId = periodId;
    this.frameCount = typeof value['frameCount'] === 'number' ? value['frameCount'] : 0;
    this.pendingQuestionId =
      typeof value['pendingQuestionId'] === 'string' ? value['pendingQuestionId'] : null;

    this.questionIds.clear();
    const questionIds = value['questionIds'];
    if (Array.isArray(questionIds)) {
      for (const id of questionIds) {
        if (typeof id === 'string') this.questionIds.add(id);
      }
    }

    this.connectors.clear();
    const connectors = value['connectors'];
    if (Array.isArray(connectors)) {
      for (const pair of connectors) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const [target, snapshot] = pair as [unknown, unknown];
        if (typeof target !== 'string' || !isRecord(snapshot)) continue;
        const state = snapshot['state'];
        if (state !== 'connected' && state !== 'paused' && state !== 'off') continue;
        const reason = snapshot['reason'];
        this.connectors.set(target as ReconnectTarget, {
          state,
          reason: typeof reason === 'string' ? reason : undefined,
        });
      }
    }

    const started = value['periodStarted'];
    this.periodStartedEvent = isSessionEvent(started) ? started : null;
    return true;
  }

  // ── 패널 ─────────────────────────────────────────────────────────────────

  /**
   * 사이드패널이 붙었습니다.
   *
   * 세 가지를 이 순서로 합니다.
   *   (a) 교시가 없으면 시작합니다 (`period.started`).
   *   (b) 교시 로그를 **이 패널에만** 처음부터 되풀이합니다 → 닫았다 열어도 화면이 복원됩니다.
   *   (c) `panel.opened` 를 냅니다.
   *
   * (b) 가 (c) 보다 먼저인 것이 중요합니다. 순서가 바뀌면 `panel.opened` 가 로그 맨 앞에
   * 끼어들어 다음에 열 때 두 번 보입니다.
   */
  async openPanel(port: PanelPortLike): Promise<void> {
    const periodId = await this.ensurePeriod();
    this.panels.add(port);
    // 교시 로그가 500건을 넘겨 `period.started` 를 밀어냈어도 화면이 교시를 알게 합니다.
    // 로그에 아직 남아 있으면 같은 `id` 라 스토어가 뒤엣것을 거릅니다.
    const started = this.periodStartedEvent;
    if (started !== null) this.post(port, { type: LIVE_EVENT, event: started });
    for (const message of this.log.replay()) {
      this.post(port, message);
    }
    await this.publish(this.makeEvent(periodId, 'panel.opened', {}), true);
    this.onPanelCountChange(this.panels.size);
  }

  /** 사이드패널이 닫혔습니다. 서비스 워커와 도우미는 계속 기록합니다. */
  async closePanel(port: PanelPortLike): Promise<void> {
    if (!this.panels.delete(port)) return;
    this.onPanelCountChange(this.panels.size);
    const periodId = this.currentPeriodId;
    if (periodId === null) return;
    await this.publish(this.makeEvent(periodId, 'panel.closed', {}), true);
  }

  // ── 들어오는 말 ──────────────────────────────────────────────────────────

  /**
   * content script · offscreen 문서가 `chrome.runtime.sendMessage` 로 보낸 말입니다.
   *
   * @returns 이 라우터가 맡은 말이면 true 입니다. false 면 부르는 쪽이 계속 봅니다
   *          (`capture.start` · `capture.stop` · `capture.frame` 은 배선 쪽 몫입니다).
   */
  async handleRuntimeMessage(message: unknown): Promise<boolean> {
    if (isTiroMessage(message)) {
      await this.handleTiro(message);
      return true;
    }
    if (isCaptureStats(message)) {
      const mapped = captureStateToConnector(message.state);
      await this.setConnector('meet-tab', mapped.state, mapped.reason);
      return true;
    }
    if (isCaptureError(message)) {
      await this.setConnector('meet-tab', 'off', message.reason);
      return true;
    }
    return false;
  }

  /** 사이드패널이 포트로 보낸 말입니다. */
  async handlePanelMessage(message: unknown): Promise<boolean> {
    if (!isLiveOutboundMessage(message)) return false;
    const typed: LiveOutboundMessage = message;
    switch (typed.type) {
      case PANEL_EVENT:
        await this.handlePanelEvent(typed.event);
        return true;
      case PANEL_ASK:
        await this.handleAsk(typed.request);
        return true;
      case PANEL_RECONNECT:
        await this.handleReconnect(typed.connector);
        return true;
      default:
        return false;
    }
  }

  /**
   * 호스트가 스스로 민 사건입니다(`question.asked` 호스트 기록본 · `answer.*` ·
   * 제공자 `connector.status`). **호스트로 되돌려 붙이지 않습니다** — 이미 호스트 안에 있습니다.
   */
  async handleHostPush(push: TutorEventPush): Promise<void> {
    if (this.currentPeriodId !== null && push.periodId !== this.currentPeriodId) {
      // 교시가 막 바뀌었습니다. 앞 교시의 답을 새 교시 로그·화면에 섞으면 화면이 거짓말을
      // 합니다. 지난 교시를 보는 길은 도우미의 세션 파일이지 이 통로가 아닙니다.
      this.warn(
        `앞 교시의 호스트 사건이 늦게 왔어요 · 버립니다 · ${push.periodId} ≠ ${this.currentPeriodId}`,
      );
      return;
    }
    const event = push.event;
    if (event.type === 'question.asked') {
      const questionId = readString(event.payload, 'questionId');
      if (questionId !== null) this.questionIds.add(questionId);
    }
    if (
      event.type === 'answer.completed' ||
      event.type === 'answer.recovered' ||
      event.type === 'answer.failed'
    ) {
      const questionId = readString(event.payload, 'questionId');
      if (questionId !== null && questionId === this.pendingQuestionId) {
        this.pendingQuestionId = null;
      }
    }
    await this.publish(event, false);
  }

  /**
   * 호스트가 민 **조각**입니다(답이 만들어지는 동안 흐르는 것).
   *
   * ```text
   *   tutor.delta ──▶ 열려 있는 패널들 (live.delta)
   *               └─X 교시 로그 · 호스트 · 세션 저장소
   * ```
   *
   * 세 가지를 **하지 않습니다.**
   *   1. `event.append` 로 붙이지 않습니다 — 조각은 `SessionEvent` 가 아니고 계약의 `type`
   *      enum 에 자리가 없습니다. 정본은 뒤따르는 `answer.completed` 입니다.
   *   2. 교시 로그(`this.log`)에 담지 않습니다. 담으면 패널을 닫았다 열 때 이미 답이 온
   *      질문 자리에 옛 조각이 되풀이되어 다 쓴 답을 덮습니다.
   *   3. 지난 교시 것은 버립니다(`tutor.event` 와 같은 규칙).
   *
   * `async` 가 아닌 것도 뜻이 있습니다. 조각은 한 회차에 수십 건이 오는데, 호스트로 나가는
   * 부탁이 하나도 없어 기다릴 것이 없습니다.
   */
  handleHostDelta(push: TutorDeltaPush): void {
    if (this.currentPeriodId !== null && push.periodId !== this.currentPeriodId) return;
    this.broadcast(
      {
        type: LIVE_DELTA,
        delta: {
          questionId: push.questionId,
          seq: push.seq,
          chars: push.chars,
          ...(push.text === undefined ? {} : { text: push.text }),
        },
      },
      false,
    );
  }

  /** 도우미 연결 상태가 바뀌었습니다. */
  async handleHostStatus(state: 'connected' | 'off', reason?: string): Promise<void> {
    await this.setConnector('native-host', state, reason);
  }

  /** 프레임 한 장이 도우미에 들어갔습니다. `period.ended` 의 `frameCount` 가 이것을 셉니다. */
  noteFrameStored(): void {
    this.frameCount += 1;
  }

  /** 프레임 한 장이 거절됐습니다(크기 초과 · 저장 실패). 화면 커넥터를 호박색으로 둡니다. */
  async noteFrameRejected(reason: string): Promise<void> {
    await this.setConnector('meet-tab', 'paused', reason);
  }

  /**
   * 질문에 붙일 화면 한 장을 **못 얻었습니다.** 그 까닭을 화면 커넥터에 적습니다.
   *
   * 왜 필요한가: 2026-09-03 에는 하루 종일 화면이 0장이었는데 오류 기록도 0건이었습니다.
   * 찍는 자리가 조용히 `null` 만 냈기 때문입니다. 이제 까닭이 `connector.status` 로 흘러
   * 바닥줄의 `meet` 자리에 드러납니다.
   *
   * `no-meet-tab` 만 `off` 입니다 — 찍을 대상 자체가 없다는 뜻이라 "잠시 멈춤" 이 아닙니다.
   * 나머지는 다음 질문에 다시 될 수 있으므로 호박색(`paused`)입니다.
   *
   * 낱말은 `src/capture/snapshot.ts` 의 `SnapshotFailure` 다섯 가지입니다. 여기서는 문자열로
   * 받습니다 — 라우터가 캡처 파일을 알 필요가 없고, 계약 `connector.status.reason` 도
   * 문자열 한 칸이기 때문입니다.
   */
  async noteScreenMissing(reason: string): Promise<void> {
    await this.setConnector('meet-tab', reason === 'no-meet-tab' ? 'off' : 'paused', reason);
  }

  /** 질문에 붙일 화면 한 장이 도우미에 들어갔습니다. 화면 커넥터를 초록으로 되돌립니다. */
  async noteScreenCaptured(): Promise<void> {
    await this.setConnector('meet-tab', 'connected');
  }

  /** 화면 한 장을 패널에 흘립니다. 사건은 호스트가 만들므로 여기서는 자료만 보냅니다. */
  pushFrame(frame: ScreenFrame): void {
    this.broadcast({ type: LIVE_FRAME, frame }, true);
  }

  /**
   * 편집기 문맥을 패널에 흘립니다.
   *
   * IntelliJ MCP 연결은 이번 라운드에 배선되지 않았습니다(불변 원칙 §4-6 : 읽기 전용).
   * 붙는 자리를 미리 열어 두어, 다음 단위가 라우터를 고치지 않고 이 문 하나만 쓰게 합니다.
   */
  pushEditor(context: EditorContext): void {
    this.broadcast({ type: LIVE_EDITOR, context }, true);
  }

  // ── 갈래별 처리 ──────────────────────────────────────────────────────────

  private async handleTiro(message: TiroMessage): Promise<void> {
    const periodId = await this.ensurePeriod();

    switch (message.type) {
      case TIRO_MESSAGE_TYPES.segment: {
        const segment = message.segment;
        if (this.isDuplicateSegment(segment)) {
          // 공유 페이지 새로고침으로 같은 문단이 다시 왔습니다. 커넥터 상태만 되살립니다.
          await this.setConnector('tiro-share', 'connected');
          return;
        }
        if (segment.periodId !== periodId) {
          // 공유 페이지는 자기 교시 번호로 식별자를 만듭니다. 어긋나면 라우터 쪽을 정본으로
          // 삼습니다(호스트가 교시 폴더를 이 이름으로 만들기 때문입니다).
          this.warn(
            `전사 조각의 교시가 서비스 워커와 달라요 · 서비스 워커 것을 씁니다 · ${segment.periodId} → ${periodId}`,
          );
        }
        this.broadcast({ type: LIVE_SEGMENT, segment }, true);
        await this.publish(
          this.makeEvent(periodId, 'transcript.segment', {
            segmentId: segment.id,
            seq: segment.seq,
            state: segment.state,
            segment,
          }),
          true,
        );
        await this.setConnector('tiro-share', 'connected');
        return;
      }

      case TIRO_MESSAGE_TYPES.partial: {
        // 진행 중 문단은 **기록하지 않습니다.** 아직 순번도 신원도 정해지지 않았고,
        // 확정되면 `tiro.segment` 로 다시 옵니다. 화면에 지금 들리는 말을 보여 줄 뿐입니다.
        this.broadcast({ type: LIVE_SEGMENT, segment: toPartialSegment(message.partial, periodId) }, false);
        return;
      }

      case TIRO_MESSAGE_TYPES.hintDegraded: {
        const signal = message.signal;
        if (signal.degraded) {
          const reason = `hint-${signal.stateSource}`;
          this.noteShape(reason, signal.shape);
          await this.setConnector('tiro-share', 'paused', reason);
        } else {
          await this.setConnector('tiro-share', 'connected');
        }
        return;
      }

      case TIRO_MESSAGE_TYPES.selectorBroken: {
        this.noteShape('selector-broken', message.signal.shape);
        await this.setConnector('tiro-share', 'paused', 'selector-broken');
        return;
      }
    }
  }

  /**
   * 멈춤 이유와 그때의 DOM 모양을 **서비스 워커 콘솔에만** 남깁니다.
   *
   * 계약 사건에는 싣지 않습니다 — `connector.status` 의 payload 를 늘리지 않기로 했고,
   * 이 값은 세션 기록이 아니라 파서를 고치는 사람이 그 자리에서 읽을 단서이기 때문입니다.
   * 요약을 못 잰 신호(옛 content script)면 아무것도 하지 않습니다.
   */
  private noteShape(reason: string, shape: string | undefined): void {
    if (shape === undefined || shape.length === 0) return;
    this.warnShape(reason, shape);
  }

  /**
   * 이미 본 문단인지 봅니다. 처음 보는 것이면 **보았다고 적고** false 를 돌려줍니다.
   *
   * 상한을 둔 것은 교시가 아주 길어질 때를 위한 것입니다. 실측에서 60분 교시가 문단 60개
   * 남짓이라 2,000개면 넉넉하고, 넘치면 가장 오래된 것부터 잊습니다(그 문단이 다시 오면
   * 한 번 더 기록될 뿐 잃는 것은 없습니다).
   */
  private isDuplicateSegment(segment: TranscriptSegment): boolean {
    const fingerprint = `${segment.state}\u0000${segment.text}`;
    if (this.seenSegments.get(segment.id) === fingerprint) return true;
    // 다시 넣기 전에 지웁니다. `Map` 은 이미 있는 키를 덮어써도 **처음 넣은 자리**를 지키기
    // 때문에, 지우지 않으면 방금 자란 문단이 가장 오래된 것으로 몰려 먼저 잊힙니다.
    this.seenSegments.delete(segment.id);
    this.seenSegments.set(segment.id, fingerprint);
    while (this.seenSegments.size > MAX_SEEN_SEGMENTS) {
      const oldest = this.seenSegments.keys().next();
      if (oldest.done === true) break;
      this.seenSegments.delete(oldest.value);
    }
    return false;
  }

  private async handlePanelEvent(event: SessionEvent): Promise<void> {
    if (event.type === 'question.asked') {
      // 붙이지 않습니다. 호스트가 `tutor.ask` 를 받아 자기 기록본을 만들고 `tutor.event` 로
      // 되밀어 줍니다. 여기서 붙이면 같은 질문이 두 줄이 됩니다.
      const questionId = readString(event.payload, 'questionId');
      if (questionId !== null) this.questionIds.add(questionId);
      return;
    }
    await this.publish(event, true, { echo: false });
  }

  private async handleAsk(request: AskRequest): Promise<void> {
    const periodId = await this.ensurePeriod();
    this.questionIds.add(request.questionId);
    this.pendingQuestionId = request.questionId;

    const question = clampUtf8(request.question, MAX_QUESTION_BYTES);
    if (question.length !== request.question.length) {
      this.warn(`질문이 ${MAX_QUESTION_BYTES}바이트를 넘어 앞부분만 보냅니다`);
    }

    const snapshot = await this.attachScreen(periodId, request.snapshot ?? emptySnapshot());

    const envelope: HostEnvelope = {
      type: TUTOR_ASK,
      periodId,
      questionId: request.questionId,
      kind: request.kind,
      ...(request.word === undefined ? {} : { word: request.word }),
      ...(question.length === 0 ? {} : { question }),
      // 패널이 값을 실어 보내면 그것이 이기고, 낯선 값이면 설정의 기본값으로 되돌립니다.
      provider: request.provider === 'claude' || request.provider === 'codex' ? request.provider : this.provider,
      snapshot,
    };

    const result = await this.host.send(envelope);
    if (result.status === 'dropped') {
      // 도우미가 꺼져 있어 질문이 그 자리에서 버려졌습니다(`tutor.ask` 는 사람이 기다리는
      // 부탁이라 들고 있지 않습니다). 온라인일 때는 호스트 기록본이 정본이므로 붙이지
      // 않지만, 이때만은 붙여야 붙잡은 질문이 어디에도 남지 않는 일이 없습니다.
      // 패널로 되돌리지 않습니다(`echo:false`) — 물어본 패널은 이미 자기 사건을 압니다.
      await this.publish(
        this.makeEvent(periodId, 'question.asked', {
          questionId: request.questionId,
          kind: request.kind,
          ...(request.word === undefined ? {} : { word: request.word }),
          ...(question.length === 0 ? {} : { question }),
          provider: envelope.provider,
          snapshot: envelope.snapshot,
          hostOffline: true,
        }),
        true,
        { echo: false },
      );
    }
    await this.reportAskResult(result);
  }

  /**
   * 질문 스냅숏에 **지금 화면 한 장**을 붙입니다.
   *
   * ```text
   *   질문 도착
   *      │
   *      ├─▶ screen.capture(periodId) ──성공──▶ snapshot.screenFrameId = 받은 이름표
   *      │            │                          snapshot.ages.screenSec = 0 (방금 찍었습니다)
   *      │            └──실패 · 상한 초과──▶ 패널이 준 스냅숏 그대로 (화면 없이 나갑니다)
   *      │
   *      └─▶ tutor.ask 를 호스트로
   * ```
   *
   * 못 붙이는 길이 셋입니다. **셋 다 질문은 그대로 나갑니다.**
   *   1. 화면 출구가 없다 — 배선되지 않은 자리(시험·1라운드)입니다.
   *   2. `capture` 가 `null` 이거나 던졌다 — Meet 탭이 아니거나, 도우미가 꺼져 있어
   *      담기지 못했습니다.
   *   3. {@link SCREEN_SNAPSHOT_TIMEOUT_MS} 를 넘겼다 — 사람이 기다리고 있으므로 포기합니다.
   *
   * 패널이 이미 `screenFrameId` 를 채워 왔더라도 방금 찍은 장이 **이깁니다.** 질문을 누른
   * 순간의 화면이 더 정확하기 때문입니다. 반대로 못 찍었으면 패널이 준 것을 그대로 둡니다.
   */
  private async attachScreen(
    periodId: string,
    base: QuestionSnapshot,
  ): Promise<QuestionSnapshot> {
    const screenFrameId = await this.captureScreen(periodId);
    if (screenFrameId === null) return base;
    return {
      ...base,
      screenFrameId,
      ages: { ...base.ages, screenSec: 0 },
    };
  }

  /** 화면 한 장을 상한 시간 안에서만 기다립니다. 넘기면 `null` 입니다. */
  private async captureScreen(periodId: string): Promise<string | null> {
    const source = this.screen;
    if (source === null) return null;

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const capped = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), this.screenTimeoutMs);
      });
      return await Promise.race([
        // 출구가 던져도 질문은 나가야 합니다. 여기서 한 번 더 막아 둡니다.
        source.capture(periodId).catch((error: unknown) => {
          this.warn(
            `질문에 붙일 화면을 얻지 못했어요 · ${error instanceof Error ? error.message : '알 수 없는 까닭'}`,
          );
          return null;
        }),
        capped,
      ]);
    } finally {
      // 안 끄면 서비스 워커가 이 타이머 때문에 잠깐 더 깨어 있습니다.
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private async reportAskResult(result: HostSendResult): Promise<void> {
    if (result.status === 'replied') {
      const reply = result.message;
      if (isHostErrorMessage(reply)) {
        // 계약 (마): 이것만 "제공자가 아예 없다" 는 뜻이라 꺼짐으로 알립니다. 나머지
        // (`question-too-long` · `envelope-invalid` · `malformed-snapshot`)는 이 부탁 하나가
        // 잘못된 것이라 호박색입니다. `not-implemented` 는 고정 계약에서 사라졌습니다.
        const off = reply.reason === 'provider-unavailable';
        await this.setConnector('provider', off ? 'off' : 'paused', reply.reason);
        return;
      }
      await this.setConnector('provider', 'connected');
      return;
    }
    // 도우미가 꺼져 있으면 제공자에게 닿을 길 자체가 없습니다.
    await this.setConnector('provider', 'off', result.status === 'queued' ? 'host-offline' : result.reason);
  }

  private async handleReconnect(connector: ReconnectTarget): Promise<void> {
    switch (connector) {
      case 'native-host':
        this.host.reconnectNow();
        return;

      case 'tiro-share':
        this.controls.restartTiro();
        return;

      case 'meet-tab':
        this.controls.restartCapture();
        return;

      case 'provider': {
        const questionId = this.pendingQuestionId;
        if (questionId === null) {
          this.warn('다시 물어볼 질문이 없어요 · tutor.retry 를 보내지 않습니다');
          return;
        }
        const periodId = await this.ensurePeriod();
        const result = await this.host.send({ type: TUTOR_RETRY, periodId, questionId });
        await this.reportAskResult(result);
        return;
      }

      case 'intellij-mcp':
        // IntelliJ 연결은 이번 라운드에 배선되지 않았습니다(불변 원칙 §4-6: 읽기 전용).
        this.warn('IntelliJ 연결은 아직 배선되지 않았어요');
        return;
    }
  }

  // ── 공통 ─────────────────────────────────────────────────────────────────

  /**
   * 커넥터 상태를 알립니다. **바뀔 때만** 사건을 냅니다.
   *
   * `capture.stats` 는 1초마다 옵니다. 그대로 사건으로 만들면 60분 교시에 3,600줄이 쌓입니다.
   */
  private async setConnector(
    connector: ReconnectTarget,
    state: 'connected' | 'paused' | 'off',
    reason?: string,
  ): Promise<void> {
    // 교시를 **먼저** 세웁니다. 교시가 새로 시작되면 커넥터 기억이 지워지므로,
    // 순서가 반대이면 방금 적은 상태가 곧바로 지워져 같은 사건이 두 번 나갑니다.
    const periodId = this.currentPeriodId ?? (await this.ensurePeriod());

    const previous = this.connectors.get(connector);
    if (previous !== undefined && previous.state === state && previous.reason === reason) return;
    this.connectors.set(connector, { state, reason });

    await this.publish(
      this.makeEvent(periodId, 'connector.status', {
        connector,
        state,
        ...(reason === undefined ? {} : { reason }),
      }),
      true,
    );
  }

  private makeEvent(
    periodId: string,
    type: SessionEvent['type'],
    payload: Record<string, unknown>,
  ): SessionEvent {
    return { id: this.ids.next(periodId), periodId, at: toKstIso(this.now()), type, payload };
  }

  /**
   * 사건 하나를 로그에 담고 패널에 흘리고 필요하면 호스트에 붙입니다.
   *
   * `echo: false` 는 "패널에는 보내지 않는다" 입니다. 패널이 낸 사건을 그 패널에 되돌려
   * 보내면 스토어가 같은 사건을 두 번 받습니다.
   *
   * **로그에 담는 일은 `echo` 와 상관없이 합니다.** 둘을 묶어 두면 패널이 낸 사건
   * (`state.changed` 같은 것)이 교시 로그에 한 줄도 남지 않아, 패널을 닫았다 열면 사라집니다.
   */
  private async publish(
    event: SessionEvent,
    append: boolean,
    options: { echo?: boolean } = {},
  ): Promise<void> {
    const message: LiveInboundMessage = { type: LIVE_EVENT, event };
    this.log.append(message);
    if (options.echo !== false) {
      this.broadcast(message, false);
    }
    if (!append) return;
    const result = await this.host.send({ type: EVENT_APPEND, periodId: event.periodId, event });
    await this.reportAppendResult(event, result);
  }

  /**
   * 기록 한 줄이 도우미에 붙었는지 보고 커넥터로 알립니다.
   *
   * 내리는 커넥터는 **`native-host`, 상태는 `paused`** 입니다. 근거: 거절이 왔다는 것은
   * 도우미가 살아서 답을 했다는 뜻이라 `off`(연결이 끊김 · `handleHostStatus` 의 자리)가
   * 아니고, 그래도 이 줄은 교시 파일에 안 들어갔으니 `connected` 도 아닙니다. 부탁 하나가
   * 잘못됐을 때 호박색으로 두는 규칙은 프레임 거절(`noteFrameRejected`)과 제공자 거절
   * (`reportAskResult`)이 이미 쓰고 있습니다.
   *
   * 성공은 두 가지입니다 — `event.ack` 와, 같은 `id` 가 이미 있었다는 `duplicate: true`.
   * 뒤엣것도 성공입니다(고정 계약: 끊겼다 붙어 다시 보내는 것이 정상 경로). 성공이면
   * 호박색을 도로 풉니다. 그러지 않으면 거절 한 번에 바닥줄 경고가 교시 끝까지 남고,
   * 푸는 길이 멀쩡한 연결을 끊는 「다시 연결」밖에 없습니다.
   *
   * `queued`·`dropped` 는 보지 않습니다. 도우미가 꺼져 있을 때의 이야기이고 그 자리는
   * `handleHostStatus` 가 이미 `native-host` 로 알립니다.
   */
  private async reportAppendResult(event: SessionEvent, result: HostSendResult): Promise<void> {
    if (result.status !== 'replied') return;
    const reply = result.message;
    const rejected = isHostErrorMessage(reply);
    if (!rejected && !isEventAckReply(reply)) return;

    if (rejected) {
      // 호스트가 준 문자열은 자료일 뿐입니다(불변 원칙 §4-7). `reason` 만 씁니다 —
      // 자유 문장인 `message` 에는 경로가 섞일 수 있습니다(§4-2).
      this.warn(`기록 한 줄이 도우미에 안 붙었어요 · ${event.type} · ${reply.reason}`);
    }

    // 교시를 닫는 중(`finishPeriod` 가 `currentPeriodId` 를 이미 비웠음)이면 알리지 않습니다.
    // 여기서 `setConnector` 를 부르면 방금 닫은 교시를 `ensurePeriod` 가 다시 열고,
    // `resolvePeriod` 안에서 닫는 중이었다면 자기 약속을 기다려 멈춥니다.
    if (this.reportingAppend || event.periodId !== this.currentPeriodId) return;

    this.reportingAppend = true;
    try {
      if (rejected) {
        await this.setConnector('native-host', 'paused', reply.reason);
      } else {
        await this.setConnector('native-host', 'connected');
      }
    } finally {
      this.reportingAppend = false;
    }
  }

  /** 열려 있는 패널 전부에 보냅니다. `remember` 면 교시 로그에도 담습니다. */
  private broadcast(message: LiveInboundMessage, remember: boolean): void {
    if (remember) this.log.append(message);
    for (const port of this.panels) {
      this.post(port, message);
    }
  }

  /** 포트 하나에 보냅니다. 닫히는 중이면 던지므로 삼킵니다. */
  private post(port: PanelPortLike, message: LiveInboundMessage): void {
    try {
      port.postMessage(message);
    } catch {
      // 패널이 방금 닫혔습니다. onDisconnect 가 곧 옵니다.
      this.panels.delete(port);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 저장소에서 되살린 값이 사건 한 벌인지 봅니다(계약의 다섯 칸). */
function isSessionEvent(value: unknown): value is SessionEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value['id'] === 'string' &&
    typeof value['periodId'] === 'string' &&
    typeof value['at'] === 'string' &&
    typeof value['type'] === 'string' &&
    isRecord(value['payload'])
  );
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

function isCaptureStats(value: unknown): value is CaptureStatsMessage {
  return isRecord(value) && value['type'] === CAPTURE_STATS && typeof value['state'] === 'string';
}

function isCaptureError(value: unknown): value is CaptureErrorMessage {
  return isRecord(value) && value['type'] === CAPTURE_ERROR && typeof value['reason'] === 'string';
}

/**
 * 진행 중 문단을 화면에 보여 줄 세그먼트로 바꿉니다.
 *
 * 계약 `TranscriptSegment.state` 에 `partial` 자리가 있어서 새 타입을 만들지 않았습니다.
 * 식별자는 **문단 자리(index)로 고정**합니다. 글자가 바뀔 때마다 새 식별자를 주면 패널에
 * 같은 문단이 여러 줄로 쌓이기 때문입니다.
 *
 * 다만 **고정한다고 화면 줄이 갱신되는 것은 아직 아닙니다.** 지금 패널 스토어
 * (`src/panel/replay-store.ts` 의 `pushSegment`)는 이미 아는 id 를 갱신이 아니라 무시로
 * 처리해, 자란 글자와 확정본이 화면에 오르지 못합니다(알려진 결함 · 패널 단위에서 upsert 로
 * 고칩니다). 그리고 이 함수가 붙이는 `ts-<periodId>-partial-<index>` 는 관찰기가 확정 때
 * 쓰는 `ts-001` 계열과 **다른 이름**이라, 스토어가 upsert 로 바뀌어도 두 계열은 서로 다른
 * 줄로 남습니다. 한 문단을 한 줄로 모으는 일은 그 두 이름을 잇는 자리까지 손봐야 끝납니다.
 *
 * 이 세그먼트는 **호스트로 가지 않습니다** — 확정되면 `tiro.segment` 가 진짜 식별자로 옵니다.
 */
export function toPartialSegment(
  partial: { periodId: string; index: number; text: string; arrivedAt: string },
  periodId: string,
): TranscriptSegment {
  return {
    id: `ts-${periodId}-partial-${partial.index}`,
    periodId,
    seq: partial.index + 1,
    text: partial.text,
    state: 'partial',
    arrivedAt: partial.arrivedAt,
    source: 'tiro-share',
  };
}
