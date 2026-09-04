import { defineBackground } from '#imports';
import type { ScreenFrame } from '@classmate/contracts';
import {
  CAPTURE_ERROR,
  CAPTURE_FRAME,
  CAPTURE_START,
  CAPTURE_STATS,
  CAPTURE_STOP,
  CAPTURE_STREAM,
  isCaptureMessage,
} from '../src/capture/messages';
import type { CaptureStartMessage, CaptureStreamMessage } from '../src/capture/messages';
import { toScreenFrame } from '../src/capture/frame-store';
import { NativeHostFrameSink } from '../src/capture/frame-sink';
import { fromBase64 } from '../src/capture/host-messages';
import type { CaptureFrameMessage } from '../src/capture/messages';
import type { SnapshotChromeLike, SnapshotFailure } from '../src/capture/snapshot';
import { buildSnapshotFrame, captureLessonTab } from '../src/capture/snapshot';

import { EventIdFactory, makeWorkerToken } from '../src/background/ids';
import { createFrameStorePort } from '../src/background/frame-port';
import { NativeHostClient } from '../src/background/host-client';
import type { NativePortLike } from '../src/background/host-client';
import { NATIVE_HOST_NAME } from '../src/background/host-messages';
import { handleSessionHistoryRequest } from '../src/background/session-history';
import { LessonTabSelection } from '../src/background/lesson-tab';
import { PeriodLog } from '../src/background/period-log';
import { Router } from '../src/background/router';
import type { PanelPortLike, ScreenSnapshotSource } from '../src/background/router';
import { pickSessionArea } from '../src/background/session-area';
import type { StorageNamespaceLike } from '../src/background/session-area';
import { createStorageSettings, PERIOD_NUMBER_STORAGE_KEY } from '../src/background/settings';
import {
  TIRO_START_REQUEST,
  TIRO_STOP_REQUEST,
  isTiroMessage,
} from '../src/background/tiro-messages';
import { PANEL_PORT_NAME } from '../src/live/messages';
import {
  HISTORY_ACTIVITY_SAVE,
  HISTORY_SESSION_ERROR,
  isSessionHistoryRequest,
} from '../src/session-history/messages';

/** Offscreen 문서의 상대 URL. WXT 가 entrypoints/offscreen/index.html 을 여기로 냅니다. */
const OFFSCREEN_URL = 'offscreen.html';

/** Offscreen 문서를 왜 여느냐는 설명. Chrome 이 사용자에게 보여 줄 수 있는 문구입니다. */
const OFFSCREEN_JUSTIFICATION = '수업 화면 변화 감지';

/** 서비스 워커가 살아 있게 두드리는 알람입니다. 최소 주기가 1분입니다. */
const KEEPALIVE_ALARM = 'classmate.keepalive';

/** 패널이 닫힌 채 이만큼 지나면 교시를 끝냅니다. */
const PERIOD_IDLE_ALARM = 'classmate.periodIdle';
const PERIOD_IDLE_MINUTES = 30;

/** 교시 로그를 서비스 워커가 내려갔다 떠도 잃지 않게 담아 두는 자리입니다. */
const PERIOD_LOG_KEY = 'classmate.periodLog';

/** 라우터 상태(교시 식별자·질문 수·화면 장 수·커넥터)를 같은 이유로 담아 두는 자리입니다. */
const ROUTER_STATE_KEY = 'classmate.routerState';

// 백그라운드(MV3 서비스 워커).
// WXT 규칙상 실행 코드는 반드시 defineBackground 의 콜백 안에만 둡니다.
// 모듈 최상단 코드는 빌드 시 Node 에서 그대로 실행되어 버립니다.
//
// 이 파일은 **배선만** 합니다. 판단은 전부 `src/background/**` 에 있습니다.
// `entrypoints/**` 는 vitest 대상이 아니라서, 여기에 판단을 두면 시험할 수 없습니다.
//
//   chrome.runtime.onConnect   ─▶ Router.openPanel / closePanel / handlePanelMessage
//   chrome.runtime.onMessage   ─▶ Router.handleRuntimeMessage  (tiro.* · capture.stats · capture.error)
//                               └▶ 이 파일                      (capture.start · stop · frame)
//   chrome.runtime.connectNative ─▶ NativeHostClient ─▶ Router.handleHostPush / handleHostStatus
//   chrome.alarms              ─▶ keepalive · 교시 30분 종료
export default defineBackground(() => {
  // 아이콘 클릭을 Chrome 기본 토글에 넘기지 않습니다. 아래 `chrome.action.onClicked` 한 곳에서
  // (1) activeTab 권한을 받고 (2) 수업 탭을 기억하고 (3) 패널을 엽니다.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error: unknown) => {
      console.error('[classmate] 사이드패널 동작을 설정하지 못했어요', error);
    });

  chrome.runtime.onInstalled.addListener(() => {
    console.log('[classmate] 확장이 설치됐어요 · 아이콘을 누르면 사이드패널이 열려요');
  });

  // ── 부품 조립 ────────────────────────────────────────────────────────────

  const log = new PeriodLog();
  const ids = new EventIdFactory(makeWorkerToken());
  const sessionArea = pickSessionArea(chrome.storage as unknown as StorageNamespaceLike);

  // 같은 서비스 워커 안에서는 메모리 값을 먼저 쓰고, 워커가 다시 뜬 때에만 세션 저장소에서
  // 되살립니다. 세대 번호와 직렬 쓰기가 늦은 옛 작업이 새 선택을 덮거나 지우지 않게 합니다.
  const lessonTabs = new LessonTabSelection(sessionArea);

  async function currentLessonTab() {
    return (await lessonTabs.snapshot()).lessonTab;
  }

  /** 패널의 「다시 연결」이 고를, 가장 최근 Chrome 창의 앞 탭입니다. 권한은 주지 못합니다. */
  async function selectActiveLessonTab(): Promise<'selected' | 'missing' | 'superseded'> {
    const before = await lessonTabs.snapshot();
    let tab: chrome.tabs.Tab | undefined;
    try {
      [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    } catch (error: unknown) {
      if (lessonTabs.revision !== before.revision) return 'superseded';
      throw error;
    }
    if (lessonTabs.revision !== before.revision) return 'superseded';
    if (tab?.id === undefined || tab.windowId === undefined) {
      const cleared = await lessonTabs.clearIfRevision(before.revision).catch(() => true);
      if (!cleared || lessonTabs.revision !== before.revision + 1) return 'superseded';
      return 'missing';
    }
    // 저장소 실패는 현재 워커의 메모리 선택을 무효로 만들지 않습니다.
    await lessonTabs.choose({ tabId: tab.id, windowId: tab.windowId, at: Date.now() }).catch(() => {});
    return 'selected';
  }

  /**
   * 로컬 도우미 연결입니다.
   *
   * 도우미가 등록돼 있지 않은 PC 에서는 `connectNative` 가 포트를 주고 곧바로 끊습니다.
   * 그것은 **정상 상태**이고, 클라이언트가 1·2·4…≤30초 백오프로 조용히 다시 붙습니다
   * (`console.error` 를 쓰지 않는 이유입니다).
   */
  const host = new NativeHostClient({
    connect: () => {
      const port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
      // `chrome.runtime.lastError` 를 읽지 않으면 Chrome 이 끊길 때마다 콘솔에
      // "Unchecked runtime.lastError" 를 찍습니다. 도우미가 등록되지 않은 PC 에서는 그것이
      // 30초마다 쌓여 진짜 오류를 묻습니다. 읽기만 하고 아무 데도 쓰지 않습니다.
      port.onDisconnect.addListener(() => {
        void chrome.runtime.lastError;
      });
      return port as unknown as NativePortLike;
    },
    onStatus: (state, reason) => {
      void router.handleHostStatus(state, reason);
      if (state === 'connected') {
        void frameSink.flushWaiting();
      }
    },
    onPush: (push) => {
      void router.handleHostPush(push);
    },
    onDelta: (delta) => {
      // 답이 만들어지는 동안 흐르는 조각입니다. 저장소에 붙이지 않고 패널로만 흘립니다
      // (`Router.handleHostDelta` 의 주석 참고). 기다릴 것이 없어 `void` 도 없습니다.
      router.handleHostDelta(delta);
    },
  });

  /**
   * 감지된 프레임이 가는 곳입니다.
   *
   * 1라운드의 `MemoryFrameSink` 자리를 그대로 이어받았습니다. 위쪽 코드(파이프라인·offscreen)는
   * 한 줄도 바뀌지 않았습니다 — 두 통이 같은 `FrameSink` 를 지키기 때문입니다.
   * 1 MiB 크기 판정은 여전히 이 통이 안에서 합니다(불변 원칙 §4-1: 로컬 도우미로만 나갑니다).
   *
   * 결말을 옮기는 판단은 `src/background/frame-port.ts` 에 있습니다(여기는 vitest 밖입니다).
   */
  const framePort = createFrameStorePort(host);

  const frameSink = new NativeHostFrameSink(framePort, {
    onStored: () => {
      router.noteFrameStored();
    },
    onRejected: (reason) => {
      void router.noteFrameRejected(reason);
    },
  });

  // ── 질문에 붙일 화면 한 장 ──────────────────────────────────────────────
  //
  // `src/capture/snapshot.ts` 는 `chrome` 을 주입받습니다. 여기서 **필요한 두 함수만**
  // 감싸 넘깁니다. 전역을 통째로 넘기지 않는 까닭은 그 파일이 무엇을 만질 수 있는지가
  // 이 몇 줄로 눈에 보이게 하기 위해서입니다.
  const snapshotChrome: SnapshotChromeLike = {
    tabs: {
      get: (tabId) => chrome.tabs.get(tabId),
      captureVisibleTab: (windowId, options) => chrome.tabs.captureVisibleTab(windowId, options),
    },
  };

  /**
   * 질문에 붙이려고 찍은 장의 순번입니다. 이 서비스 워커가 사는 동안만 셉니다.
   *
   * 워커가 내려갔다 뜨면 1부터 다시 세는데, 식별자 가운데에 **찍은 시각 시분초**가 함께
   * 들어가므로(`sf-p3-ask-103210-001`) 같은 초에 워커가 두 번 뜨지 않는 한 겹치지 않습니다.
   */
  let askFrameSequence = 0;

  /**
   * 질문 한 건에 붙일 화면 한 장을 찍어 도우미에 담고 이름표를 돌려줍니다.
   *
   * ```text
   *   captureLessonTab ──null──▶ null              (수업 탭이 없거나 못 찍었습니다)
   *        │
   *   buildSnapshotFrame ──throw──▶ null           (교시 이름표가 계약 모양이 아닙니다)
   *        │
   *   frameSink.storeAndReport ──false──▶ null     (도우미가 꺼져 있거나 거절했습니다)
   *        │
   *        └─true──▶ router.pushFrame → 이름표 반환
   * ```
   *
   * 여기서 **던지지 않습니다.** 라우터에도 막는 겹이 한 번 더 있지만, 화면 한 장이
   * 질문을 막는 길을 두 곳 다 닫아 둡니다.
   */
  const screen: ScreenSnapshotSource = {
    capture: async (periodId: string): Promise<string | null> => {
      // 못 얻은 까닭을 라우터로 넘겨 바닥줄의 `meet` 자리에 드러나게 합니다. 넘어가는 것은
      // **낱말 하나**뿐입니다 — dataURL·화면 내용·탭 주소는 어디에도 싣지 않습니다.
      let failure: SnapshotFailure | null = null;
      const selected = await lessonTabs.snapshot();
      const shot = await captureLessonTab(snapshotChrome, selected.lessonTab, {
        onFail: (reason) => {
          failure = reason;
        },
      });
      if (shot === null) {
        if (failure === 'no-lesson-tab' && selected.lessonTab !== null) {
          void lessonTabs.clearIfRevision(selected.revision).catch(() => {
            // 세션 저장소가 실패해도 같은 세대의 메모리 선택은 이미 비웠습니다.
          });
        }
        void router.noteScreenMissing(failure ?? 'capture-failed');
        return null;
      }

      askFrameSequence += 1;
      let frame: ScreenFrame;
      try {
        frame = buildSnapshotFrame({
          periodId,
          capturedAt: new Date(),
          sequence: askFrameSequence,
          snapshot: shot,
        });
      } catch (error: unknown) {
        console.warn(
          '[classmate] 질문에 붙일 화면의 이름표를 짓지 못했어요',
          error instanceof Error ? error.message : String(error),
        );
        void router.noteScreenMissing('capture-failed');
        return null;
      }

      // 담긴 것이 확인된 장만 질문이 가리킵니다. 폴백 대기열에 들어간 장은 아직 파일이
      // 없어서, 가리키면 튜터가 없는 그림을 찾습니다.
      const stored = await frameSink.storeAndReport(frame, shot.bytes);
      if (!stored) {
        // 찍기는 했는데 도우미가 파일로 남기지 못했습니다(꺼져 있거나 거절).
        void router.noteScreenMissing('host-offline');
        return null;
      }

      // 패널이 "지금 무엇이 보이는지" 를 그릴 수 있게 화면도 흘려 줍니다.
      router.pushFrame(frame);
      void router.noteScreenCaptured();
      return frame.id;
    },
  };

  const router = new Router({
    host,
    screen,
    settings: createStorageSettings({
      get: (keys: string[]) => chrome.storage.local.get(keys),
    }),
    controls: {
      restartTiro: () => {
        void restartTiroShare();
      },
      reselectLessonTab: () => {
        // 패널 안 클릭은 `activeTab` 권한을 새로 주지 못합니다. 지금 앞 탭을 후보로만 다시
        // 잡고, 권한이 없으면 다음 붙잡기에서 아이콘 클릭 방법을 정확히 안내합니다.
        void selectActiveLessonTab()
          .then((result) => {
            if (result === 'missing') void router.noteScreenMissing('no-lesson-tab');
          })
          .catch(() => {
            void router.noteScreenMissing('capture-failed');
          });
      },
    },
    log,
    ids,
    onPanelCountChange: (count) => {
      void syncPeriodIdleAlarm(count);
    },
    onPeriodEnd: () => {
      // 앞 교시의 보류 프레임을 버립니다. 그대로 두면 도우미가 돌아왔을 때 옛 `periodId` 로
      // 새 교시에 흘러들고, 호스트가 거절하면 새 교시의 화면 커넥터가 호박색이 됩니다.
      frameSink.clear();
    },
  });

  // ── 교시 로그·라우터 상태 되살리기 ──────────────────────────────────────
  //
  // MV3 서비스 워커는 30초를 놀면 내려갑니다. 다시 뜬 워커가 이것을 읽지 않으면 사이드패널을
  // 다시 열었을 때 화면이 백지가 되고(Gate D 「사이드패널 닫기 → 열기」), 같은 교시에
  // `period.started` 가 한 번 더 붙습니다.
  //
  // 자리는 `storage.session` **하나뿐** 입니다. 없다고 `storage.local` 로 물러서면 전사 본문이
  // 디스크에 남아 불변 원칙 §4-1 과 어긋납니다(`src/background/session-area.ts`).

  let logSaveTimer: number | null = null;
  let logRestored = false;

  const restoreLog =
    sessionArea === null
      ? Promise.resolve().then(() => {
          console.warn('[classmate] storage.session 이 없어 복원을 건너뜁니다');
          logRestored = true;
        })
      : sessionArea
          .get([PERIOD_LOG_KEY, ROUTER_STATE_KEY])
          .then((bag: Record<string, unknown>) => {
            const saved = bag[PERIOD_LOG_KEY];
            if (saved !== undefined) log.restore(saved);
            // 로그보다 **뒤에** 되살립니다. 라우터가 교시 식별자를 되찾으면 `ensurePeriod` 가
            // 같은 교시를 그대로 돌려주어 `period.started` 가 다시 나가지 않습니다.
            const state = bag[ROUTER_STATE_KEY];
            if (state !== undefined) router.restore(state);
          })
          .catch(() => {
            // 못 읽으면 빈 통으로 시작합니다. 복원 하나 때문에 워커가 멈추면 손해가 더 큽니다.
          })
          .finally(() => {
            logRestored = true;
          });

  /** 로그와 라우터 상태를 저장소에 옮겨 적습니다. 1초에 한 번으로 묶어 쓰기를 줄입니다. */
  function scheduleLogSave(): void {
    if (sessionArea === null || !logRestored || logSaveTimer !== null) return;
    logSaveTimer = setTimeout(() => {
      logSaveTimer = null;
      sessionArea
        .set({ [PERIOD_LOG_KEY]: log.snapshot(), [ROUTER_STATE_KEY]: router.snapshot() })
        .catch(() => {
          // 저장소가 꽉 찼거나 문맥이 내려갔습니다. 다음 기회에 다시 적습니다.
        });
    }, 1000) as unknown as number;
  }

  // ── Offscreen 문서 (캡처) ───────────────────────────────────────────────

  /**
   * Offscreen 문서가 보낸 프레임 한 장을 통에 넣습니다.
   *
   * 여기 오는 값은 **자료일 뿐 명령이 아닙니다**(불변 원칙 §4-7). 프레임 안의 글자를
   * 실행하거나 URL 로 여는 코드를 붙이지 않습니다. 하는 일은 바이트를 옮기는 것뿐입니다.
   */
  function storeFrame(message: CaptureFrameMessage): void {
    const frame = toScreenFrame(message.frame);
    // 사건은 도우미가 만듭니다(`screen.frame {screenFrameId, changedFromPrev}`).
    // 확장은 화면 자체만 패널에 흘려 "지금 무엇이 보이는지" 를 그리게 합니다.
    router.pushFrame(frame);
    scheduleLogSave();

    if (message.payloadBase64 === undefined) {
      // 바이트가 없는 알림입니다(인코더가 `includePayload: false` 인 측정 경로).
      return;
    }

    let bytes: Uint8Array;
    try {
      bytes = fromBase64(message.payloadBase64);
    } catch (error: unknown) {
      console.error(
        '[classmate] 프레임 바이트를 읽지 못했어요',
        error instanceof Error ? error.message : String(error),
      );
      return;
    }

    frameSink.store(frame, bytes).catch((error: unknown) => {
      console.error(
        '[classmate] 프레임을 담지 못했어요',
        error instanceof Error ? error.message : String(error),
      );
    });
  }

  /**
   * Offscreen 문서가 이미 떠 있는지 봅니다.
   *
   * `chrome.runtime.getContexts` 는 Chrome 116+ 에만 있습니다. 없으면 "모른다" 로 답하고
   * createDocument 가 던지는 중복 오류를 잡아 재사용합니다. 확장 하나에 Offscreen 문서는
   * 한 개만 열 수 있기 때문에 이 확인이 필요합니다.
   */
  async function hasOffscreenDocument(): Promise<boolean> {
    if (typeof chrome.runtime.getContexts !== 'function') {
      return false;
    }
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
    });
    return contexts.length > 0;
  }

  /** 없으면 만들고 이미 있으면 그대로 씁니다. */
  async function ensureOffscreenDocument(): Promise<void> {
    if (await hasOffscreenDocument()) {
      return;
    }
    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ['USER_MEDIA'],
        justification: OFFSCREEN_JUSTIFICATION,
      });
    } catch (error: unknown) {
      // 같은 순간에 두 번 부르면 "Only a single offscreen document may be created" 가 납니다.
      // 이미 있다는 뜻이므로 그대로 씁니다.
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('single offscreen document')) {
        throw error;
      }
    }
  }

  /**
   * 캡처를 시작합니다.
   *
   * `chrome.tabCapture.getMediaStreamId` 는 **사용자 제스처**(확장 아이콘·패널 버튼)
   * 뒤에만 성공합니다. 그래서 사이드패널이 저절로 시작할 수 없고, 첫 교시 온보딩에
   * 클릭 한 번이 들어갑니다(master-prompt §3-6 "다음 교시 시작 30초 이내").
   */
  async function startCapture(message: CaptureStartMessage): Promise<void> {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId });
    await ensureOffscreenDocument();
    // 새 교시가 시작되면 앞 교시의 바이트는 들고 있지 않습니다.
    frameSink.clear();

    // 임계값과 간격은 여기서 손대지 않고 **그대로** 넘깁니다. 빈자리 채우기와 범위 확인은
    // Offscreen 문서가 `resolveCaptureSettings` 한 곳에서 합니다(규칙을 두 곳에 두지 않습니다).
    // `exactOptionalPropertyTypes` 라서 undefined 를 넣는 대신 없으면 칸 자체를 뺍니다.
    const handoff: CaptureStreamMessage = {
      type: CAPTURE_STREAM,
      streamId,
      periodId: message.periodId,
      ...(message.threshold === undefined ? {} : { threshold: message.threshold }),
      ...(message.sampleIntervalMs === undefined
        ? {}
        : { sampleIntervalMs: message.sampleIntervalMs }),
    };
    await chrome.runtime.sendMessage(handoff);
  }

  /**
   * 지금 교시 식별자입니다. 라우터가 저장소의 교시 번호와 오늘 날짜로 정합니다.
   * 계약 모양은 `2026-09-02-p3` 입니다(`packages/contracts/schemas/common.schema.json`).
   */
  async function currentPeriodId(): Promise<string> {
    return router.ensurePeriod();
  }

  /** 캡처를 멈추고 Offscreen 문서를 닫습니다. */
  async function stopCapture(): Promise<void> {
    if (!(await hasOffscreenDocument())) {
      return;
    }
    try {
      await chrome.runtime.sendMessage({ type: CAPTURE_STOP });
    } finally {
      await chrome.offscreen.closeDocument().catch(() => {
        // 이미 닫혔으면 그만입니다.
      });
    }
  }

  // ── Tiro 공유 페이지 ────────────────────────────────────────────────────

  /**
   * 마지막으로 전사를 보내 온 탭입니다.
   *
   * 왜 기억해 두는가: **`chrome.runtime.sendMessage` 는 content script 에 닿지 않습니다.**
   * 확장 안의 다른 문서(Offscreen · 사이드패널)에만 배달되고, content script 에 말하려면
   * `chrome.tabs.sendMessage(tabId, …)` 로 탭을 찍어야 합니다. 탭을 찾으려고
   * `chrome.tabs.query({url})` 를 쓰면 `tabs` 권한이 더 필요하므로, 대신 **우리에게 말을 걸어
   * 온 탭**을 적어 두었다가 그 탭에만 되말합니다. 권한이 늘지 않고, 우리 content script 가
   * 실제로 살아 있는 탭이라는 것도 이미 증명된 자리입니다.
   */
  let lastTiroTabId: number | null = null;

  /**
   * 공유 페이지 content script 를 다시 세웁니다.
   *
   * 멈추고(`tiro.stop`) 곧바로 시작합니다(`tiro.start`). 멈출 때 진행 중 문단이 partial
   * 세그먼트로 한 번 나오므로, 마지막 한 문단이 버려지지 않습니다.
   * 공유 페이지가 열려 있지 않으면 받는 쪽이 없어 조용히 떨어집니다 — 정상입니다.
   */
  async function restartTiroShare(): Promise<void> {
    const tabId = lastTiroTabId;
    if (tabId === null) {
      console.warn('[classmate] 전사를 보내 온 탭을 몰라요 · 공유 페이지를 열어 주세요');
      return;
    }
    await sendToTiroTab(tabId, { type: TIRO_STOP_REQUEST });
    await sendToTiroTab(tabId, { type: TIRO_START_REQUEST });
  }

  async function sendToTiroTab(tabId: number, message: { type: string }): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, message);
    } catch {
      // 탭이 닫혔거나 다른 주소로 옮겨 갔습니다. 받는 쪽이 없으면 이렇게 떨어집니다.
    }
  }

  // ── 사이드패널 포트 ─────────────────────────────────────────────────────

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== PANEL_PORT_NAME) return;

    const panel: PanelPortLike = { postMessage: (message) => port.postMessage(message) };

    // `.catch` 가 없으면 처리되지 않은 약속 거부가 되어 **질문 하나가 조용히 사라집니다.**
    // 무엇이 실패했는지 한 줄이라도 남겨야 손 시험에서 찾을 수 있습니다.
    port.onMessage.addListener((message: unknown) => {
      void router
        .handlePanelMessage(message)
        .then(scheduleLogSave)
        .catch((error: unknown) => {
          console.warn(
            '[classmate] 패널이 보낸 말을 처리하지 못했어요',
            error instanceof Error ? error.message : String(error),
          );
        });
    });
    port.onDisconnect.addListener(() => {
      void router
        .closePanel(panel)
        .then(scheduleLogSave)
        .catch(() => {
          // 패널이 닫히는 길입니다. 여기서 더 할 일은 없습니다.
        });
    });

    // 저장소에서 로그를 되살린 **뒤에** 되풀이해야 닫았다 연 화면이 복원됩니다. 수업 탭 선택이
    // 없다면 마지막으로 본 Chrome 창의 앞 탭을 후보로만 기록합니다. 이 길은 `activeTab` 권한을
    // 만들지 못하므로 실제 촬영 전에는 영상 탭에서 아이콘을 한 번 눌러야 합니다.
    void Promise.all([restoreLog, currentLessonTab()])
      .then(async ([, selected]) => {
        if (selected === null) {
          await selectActiveLessonTab().catch(() => {
            // 탭 후보를 못 골라도 패널과 질문·전사는 정상적으로 열어야 합니다.
          });
        }
        await router.openPanel(panel);
      })
      .then(scheduleLogSave)
      .catch((error: unknown) => {
        console.warn(
          '[classmate] 사이드패널을 열지 못했어요',
          error instanceof Error ? error.message : String(error),
        );
      });
  });

  // ── 알람 ────────────────────────────────────────────────────────────────

  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 1 });

  /** 패널이 닫혀 있는 동안만 30분 알람을 걸어 둡니다. */
  async function syncPeriodIdleAlarm(panelCount: number): Promise<void> {
    if (panelCount > 0) {
      await chrome.alarms.clear(PERIOD_IDLE_ALARM);
      return;
    }
    chrome.alarms.create(PERIOD_IDLE_ALARM, { delayInMinutes: PERIOD_IDLE_MINUTES });
  }

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === KEEPALIVE_ALARM) {
      // 두드리는 것만으로 서비스 워커가 깨어납니다. 할 일은 없습니다.
      return;
    }
    if (alarm.name === PERIOD_IDLE_ALARM) {
      if (router.panelCount > 0) return;
      void router
        .endPeriod()
        .then(scheduleLogSave)
        .catch(() => {
          // 교시를 끝내지 못해도 다음 교시 시작이 앞 교시를 정리합니다.
        });
    }
  });

  // 교시 번호가 바뀌면 앞 교시를 끝내고 새 교시를 시작합니다.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!(PERIOD_NUMBER_STORAGE_KEY in changes)) return;
    void restoreLog
      .then(() => router.ensurePeriod())
      .then(scheduleLogSave)
      .catch(() => {
        // 교시를 바꾸지 못해도 다음 부름이 다시 봅니다.
      });
  });

  // ── 수업 화면 선택 + 패널 열기 ─────────────────────────────────────────
  //
  // 이 클릭 한 번이 두 가지를 함께 증명합니다.
  //   1. 학습자가 **이 탭**을 수업 화면으로 골랐습니다.
  //   2. Chrome 이 이 탭에 `activeTab` 임시 권한을 줬습니다.
  //
  // `sidePanel.open` 은 사용자 동작 안에서만 허용되므로 약속을 기다리기 전에 바로 부릅니다.
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id !== undefined) {
      void lessonTabs.choose({ tabId: tab.id, windowId: tab.windowId, at: Date.now() }).catch(() => {
        // 저장소가 잠깐 실패해도 같은 워커의 메모리 선택과 activeTab 권한은 살아 있습니다.
      });
    }
    void chrome.sidePanel.open({ windowId: tab.windowId }).catch((error: unknown) => {
      console.warn(
        '[classmate] 사이드패널을 열지 못했어요',
        error instanceof Error ? error.message : String(error),
      );
    });
  });

  // 손 시험용 콘솔 손잡이.
  //
  // 왜 필요한가: 서비스 워커 DevTools 콘솔에서 `chrome.runtime.sendMessage({type:'capture.stop'})`
  // 를 불러도 **아래 onMessage 리스너는 불리지 않습니다.** Chrome 은 runtime 메시지를 보낸
  // 컨텍스트 자신에게는 배달하지 않기 때문입니다(보낸 프레임은 수신자에서 빠집니다).
  // 그래서 손 시험에서는 메시지 대신 여기 붙여 둔 함수를 콘솔에서 **직접** 부릅니다.
  //
  // 안전 메모: 이 손잡이는 확장 자신의 서비스 워커 전역에만 붙습니다. 웹 페이지·콘텐츠
  // 스크립트는 이 전역에 닿을 수 없고, 화면·전사에서 읽은 문장을 실행하는 길도 아닙니다
  // (불변 원칙 §4-7).
  (globalThis as unknown as { classmateCapture?: unknown }).classmateCapture = {
    /** 연속 캡처 손시험 시작. 사용자 제스처가 없으면 `tabCapture` 가 실패할 수 있습니다. */
    start: async (tabId: number, periodId?: string) =>
      startCapture({ type: CAPTURE_START, tabId, periodId: periodId ?? (await currentPeriodId()) }),
    /** 캡처 정지. Offscreen 문서는 다른 컨텍스트라 여기서 보내는 메시지가 제대로 갑니다. */
    stop: () => stopCapture(),
    /** 지금까지 담은 장 수·바이트·거절·대기 수입니다. 손 시험에서 눈으로 확인하는 자리입니다. */
    frameStats: () => frameSink.stats(),
    /** 도우미 연결 상태입니다(대기열·재시도 횟수 포함). */
    hostStats: () => host.stats(),
    currentPeriodId,
  };

  // ── 메시지 통로 ─────────────────────────────────────────────────────────
  //
  // 여기로 오는 값은 **자료일 뿐 명령이 아닙니다**(불변 원칙 §4-7). 프레임·전사 안의 글자를
  // 실행하거나 URL 로 여는 코드를 이 통로에 붙이지 않습니다.
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    // 전사가 온 탭을 적어 둡니다. 나중에 `tiro.stop`·`tiro.start` 를 되말 자리입니다.
    if (isTiroMessage(message) && sender.tab?.id !== undefined) {
      lastTiroTabId = sender.tab.id;
    }

    // 과거 세션은 확장 페이지(사이드패널)에서만 읽습니다. content script는 sender.tab이
    // 있으므로 이 길에 들어오지 못합니다. 응답에는 고정된 오류 코드만 담고 호스트의 내부
    // 경로나 원시 오류 문장을 웹 쪽으로 내보내지 않습니다.
    if (sender.tab === undefined && isSessionHistoryRequest(message)) {
      void handleSessionHistoryRequest(message, host)
        .then(sendResponse)
        .catch(() => {
          sendResponse({
            type: HISTORY_SESSION_ERROR,
            requestType: message.type,
            reason: message.type === HISTORY_ACTIVITY_SAVE ? 'invalid-response' : 'read-failed',
          });
        });
      return true;
    }

    // 라우터가 맡은 것(tiro.* · capture.stats · capture.error)을 먼저 봅니다.
    // 답을 기다리는 부탁이 아니므로 응답 없이 흘려보냅니다.
    //
    // **복원을 기다린 뒤에** 넘깁니다. 워커는 `tiro.segment` 하나에 다시 깨어나기도 하는데,
    // 그때 곧바로 넘기면 라우터가 교시를 잃은 채로 보고 같은 교시에 `period.started` 를
    // 한 번 더 붙입니다(저장소 읽기 한 번만큼 늦어질 뿐입니다).
    void restoreLog
      .then(() => router.handleRuntimeMessage(message))
      .then((handled) => {
        if (handled) scheduleLogSave();
      })
      .catch((error: unknown) => {
        console.warn(
          '[classmate] 메시지를 처리하지 못했어요',
          error instanceof Error ? error.message : String(error),
        );
      });

    if (!isCaptureMessage(message)) {
      return false;
    }

    if (message.type === CAPTURE_START) {
      startCapture(message)
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : '탭 화면을 열지 못했어요';
          console.error('[classmate] 화면 캡처를 시작하지 못했어요', reason);
          sendResponse({ ok: false, reason });
        });
      return true; // 비동기로 답하겠다는 뜻입니다.
    }

    if (message.type === CAPTURE_STOP) {
      stopCapture()
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : '캡처를 멈추지 못했어요';
          sendResponse({ ok: false, reason });
        });
      return true;
    }

    if (message.type === CAPTURE_FRAME) {
      storeFrame(message);
      return false;
    }

    if (message.type === CAPTURE_STATS) {
      // loop.skippedWhileBusy 가 0 보다 크면 한 회차가 간격보다 오래 걸려 다음 회차를
      // 건너뛴 것입니다. 샘플링 간격을 늘릴지 판단하는 근거가 됩니다.
      // 상태를 사이드패널에 알리는 일은 위 `router.handleRuntimeMessage` 가 맡았습니다.
      console.log('[classmate] 캡처 상태', message.state, message.stats, message.loop);
      return false;
    }

    if (message.type === CAPTURE_ERROR) {
      console.warn('[classmate] 캡처 오류', message.reason);
      return false;
    }

    return false;
  });

  // 마지막으로 도우미에 붙습니다. 등록돼 있지 않으면 조용히 백오프로 다시 붙습니다.
  host.start();
});
