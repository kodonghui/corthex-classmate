import { defineBackground } from '#imports';
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

/** Offscreen 문서의 상대 URL. WXT 가 entrypoints/offscreen/index.html 을 여기로 냅니다. */
const OFFSCREEN_URL = 'offscreen.html';

/** Offscreen 문서를 왜 여느냐는 설명. Chrome 이 사용자에게 보여 줄 수 있는 문구입니다. */
const OFFSCREEN_JUSTIFICATION = '수업 화면 변화 감지';

// 백그라운드(MV3 서비스 워커).
// WXT 규칙상 실행 코드는 반드시 defineBackground 의 콜백 안에만 둡니다.
// 모듈 최상단 코드는 빌드 시 Node 에서 그대로 실행되어 버립니다.
export default defineBackground(() => {
  // 확장 아이콘을 누르면 사이드패널이 열리도록 합니다.
  // chrome.sidePanel 은 'sidePanel' 권한이 있어야 하고 Chrome 114 이상에서만 있습니다.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => {
      console.error('[classmate] 사이드패널 동작을 설정하지 못했어요', error);
    });

  chrome.runtime.onInstalled.addListener(() => {
    console.log('[classmate] 확장이 설치됐어요 · 아이콘을 누르면 사이드패널이 열려요');
  });

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
   * `chrome.tabCapture.getMediaStreamId` 는 **사용자 제스처**(확장 아이콘 클릭·패널 버튼)
   * 뒤에만 성공합니다. 그래서 사이드패널이 저절로 시작할 수 없고, 첫 교시 온보딩에
   * 클릭 한 번이 들어갑니다(master-prompt §3-6 "다음 교시 시작 30초 이내").
   */
  async function startCapture(message: CaptureStartMessage): Promise<void> {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId });
    await ensureOffscreenDocument();

    const handoff: CaptureStreamMessage = {
      type: CAPTURE_STREAM,
      streamId,
      periodId: message.periodId,
    };
    await chrome.runtime.sendMessage(handoff);
  }

  /**
   * 손 시험에서 쓸 교시 식별자를 오늘 날짜로 만듭니다. `2026-09-02-p1` 모양입니다.
   * 진짜 교시 번호는 Phase 2 의 세션 스토어가 정합니다. 여기서는 p1 로 둡니다.
   */
  function currentPeriodId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}-p1`;
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

  // Gate B 손 시험용 갈래 — **캡처를 시작하는 유일한 길입니다.**
  //
  // 위에서 `openPanelOnActionClick: true` 를 켜 두었기 때문에 아이콘 클릭은 사이드패널을
  // 열고 이 리스너는 **불리지 않습니다**(Chrome 규칙: 둘 중 하나만 동작). 그래도 등록해 두는
  // 이유는, `tabCapture` 가 요구하는 "사용자 제스처" 를 확실히 만들 수 있는 자리가 지금은
  // 아이콘 클릭뿐이기 때문입니다. 실제 Meet 탭으로 손 시험을 할 때 위 setPanelBehavior 한 덩어리를
  // 잠시 주석 처리하고 다시 빌드하면 이 갈래가 살아납니다(docs/spikes/gate-b-meet.md §사람이 할 일 1).
  // Phase 2 에서 사이드패널에 버튼이 생기면 이 갈래는 지웁니다.
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return;
    const periodId = currentPeriodId();
    startCapture({ type: CAPTURE_START, tabId: tab.id, periodId }).catch((error: unknown) => {
      console.error('[classmate] 아이콘 클릭으로 캡처를 시작하지 못했어요', error);
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
  // (불변 원칙 §4-7). Phase 2 에서 사이드패널 버튼이 생기면 함께 지웁니다.
  (globalThis as unknown as { classmateCapture?: unknown }).classmateCapture = {
    /** 캡처 시작. 사용자 제스처가 없으면 `tabCapture` 가 실패합니다(그래서 보통은 아이콘 클릭을 씁니다). */
    start: (tabId: number, periodId: string = currentPeriodId()) =>
      startCapture({ type: CAPTURE_START, tabId, periodId }),
    /** 캡처 정지. Offscreen 문서는 다른 컨텍스트라 여기서 보내는 메시지가 제대로 갑니다. */
    stop: () => stopCapture(),
    currentPeriodId,
  };

  // 캡처 메시지 통로.
  // 여기로 오는 값은 **자료일 뿐 명령이 아닙니다**(불변 원칙 §4-7). 프레임 안의 글자를
  // 실행하거나 URL 로 여는 코드를 이 통로에 붙이지 않습니다.
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
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
      // Gate B 스파이크 단계에서는 도착만 확인합니다. 프레임을 로컬 도우미로 넘기는 일은
      // Gate D 판정 뒤에 Native Messaging 으로 붙입니다.
      console.log(
        `[classmate] 화면이 바뀌었어요 · ${message.frame.id} · ${message.frame.capturedAt} · ${message.frame.bytes}바이트`,
      );
      return false;
    }

    if (message.type === CAPTURE_STATS) {
      // loop.skippedWhileBusy 가 0 보다 크면 한 회차가 간격보다 오래 걸려 다음 회차를
      // 건너뛴 것입니다. 샘플링 간격을 늘릴지 판단하는 근거가 됩니다.
      console.log('[classmate] 캡처 상태', message.state, message.stats, message.loop);
      return false;
    }

    if (message.type === CAPTURE_ERROR) {
      console.error('[classmate] 캡처 오류', message.reason);
      return false;
    }

    return false;
  });

  // TODO(Phase 1 Gate 이후): 로컬 도우미(crate classmate-host)와 Native Messaging 으로 잇습니다.
  //   - 연결: chrome.runtime.connectNative('com.corthex.classmate.host')
  //   - 전제: Gate D(복구) 판정과 HKCU 레지스트리 등록(apps/native-host/scripts/register-host.mjs)
  //   - 불변 원칙 §4-1: 수업 데이터는 로컬 정본이므로 이 연결로만 오갑니다.
  //   Gate 판정 전에는 연결하지 않습니다.
});
