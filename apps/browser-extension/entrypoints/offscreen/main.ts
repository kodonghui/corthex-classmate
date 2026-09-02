/**
 * Offscreen 문서 — 탭 화면을 1초에 한 번 들여다보고 "바뀐 장면" 만 남깁니다.
 *
 * 왜 이 문서가 필요한가:
 *   MV3 서비스 워커에는 DOM 이 없어서 `getUserMedia` 도 `<video>` 도 `canvas` 도 못 씁니다.
 *   Chrome 은 그럴 때 쓰라고 Offscreen Document(109+)를 줍니다. background 가 이 문서를
 *   만들고, `chrome.tabCapture.getMediaStreamId` 로 받은 streamId 를 넘겨 주면 여기서
 *   스트림을 열어 프레임을 샘플링합니다.
 *
 *   background(서비스 워커) ──capture.stream(streamId)──▶ 이 문서
 *   이 문서 ──capture.frame / capture.stats / capture.error──▶ background
 *
 * 지키는 규칙:
 *   - 오디오는 열지 않습니다(`audio: false`). 소리는 Tiro 가 맡습니다.
 *   - MediaRecorder 를 쓰지 않습니다. 영상 파일을 만들지 않습니다(불변 원칙 §4-4).
 *   - 화면에서 읽은 내용을 명령으로 실행하지 않습니다(불변 원칙 §4-7). 여기서 하는 일은
 *     픽셀을 세는 것뿐입니다.
 */

import { CapturePipeline } from '../../src/capture/pipeline';
import { FrameStore } from '../../src/capture/frame-store';
import { SamplingLoop } from '../../src/capture/sampling-loop';
import { OffscreenWebpEncoder, TARGET_WIDTH } from '../../src/capture/webp-encoder';
import { toBase64 } from '../../src/capture/host-messages';
import { capturingRunState, reduceCaptureRun } from '../../src/capture/capture-run-state';
import { openCaptureSession, releaseCaptureResources } from '../../src/capture/session-setup';
import {
  CAPTURE_ERROR,
  CAPTURE_FRAME,
  CAPTURE_STATS,
  CAPTURE_STOP,
  CAPTURE_STREAM,
  isCaptureMessage,
  resolveCaptureSettings,
} from '../../src/capture/messages';
import type {
  CaptureFrameMessage,
  CaptureStatsMessage,
  CaptureStreamMessage,
} from '../../src/capture/messages';
import type { CaptureRunState } from '../../src/capture/capture-run-state';
import type { CapturedFrame } from '../../src/capture/frame-store';
import type { EncodedFrame } from '../../src/capture/pipeline';

interface Session {
  /**
   * 이 세션의 신원표입니다. 켤 때마다 새 번호를 답니다.
   *
   * 트랙의 `ended` 처럼 **나중에 불리는 리스너** 는 자기를 만든 세션을 붙들고 있습니다.
   * 캡처를 껐다 켜면 지나간 세션의 리스너가 뒤늦게 깨어나는데, 그때 이 번호를 지금 세션과
   * 견주지 않으면 **지금 돌고 있는 캡처** 를 멈춰 버립니다.
   */
  token: number;
  stream: MediaStream;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  pipeline: CapturePipeline;
  store: FrameStore;
  /** 1fps 회차를 잡는 유일한 곳입니다. 겹침은 이 루프가 막습니다. */
  loop: SamplingLoop;
}

let session: Session | null = null;
let run: CaptureRunState = { state: 'idle', consecutiveErrors: 0 };
let nextSessionToken = 1;

function report(message: unknown): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // background 가 잠들어 있으면 이 한 번은 버립니다. 다음 프레임에서 다시 알립니다.
  });
}

/** 캡처를 아예 시작하지 못했을 때입니다. 회차 실패는 아래 `handleSampleResult` 가 맡습니다. */
function fail(reason: string): void {
  run = { state: 'error', consecutiveErrors: run.consecutiveErrors + 1 };
  console.error('[classmate] 화면 캡처가 멈췄어요', reason);
  report({ type: CAPTURE_ERROR, reason });
}

/**
 * streamId 로 탭 스트림을 엽니다.
 * `chromeMediaSource: 'tab'` 은 표준 제약이 아니라 Chrome 확장 전용이라 표준 타입에
 * 들어 있지 않습니다. 그래서 캐스팅 한 번이 필요합니다.
 */
async function openTabStream(streamId: string): Promise<MediaStream> {
  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
  } as unknown as MediaStreamConstraints;

  return navigator.mediaDevices.getUserMedia(constraints);
}

function stopSession(): void {
  if (!session) return;

  session.loop.stop();
  releaseCaptureResources(session.stream, session.video);
  session = null;
}

/**
 * 통에 들어간 장 한 개를 background 로 보냅니다.
 *
 * WebP 바이트를 base64 로 실어 보냅니다. 실제 저장은 로컬 도우미가 하는데, 도우미에 붙는
 * `chrome.runtime.connectNative` 는 서비스 워커에만 있어 여기서는 부를 수 없기 때문입니다.
 * 1 MiB 크기 판정은 background 의 `FrameSink` 안에서 `buildFrameStore` 가 합니다.
 */
function reportFrame(frame: CapturedFrame, encoded: EncodedFrame): void {
  const message: CaptureFrameMessage = {
    type: CAPTURE_FRAME,
    frame,
    ...(encoded.payload === undefined ? {} : { payloadBase64: toBase64(encoded.payload) }),
  };
  report(message);
}

function sendStats(current: Session): void {
  const storeStats = current.store.stats();
  const message: CaptureStatsMessage = {
    type: CAPTURE_STATS,
    state: run.state,
    stats: current.pipeline.stats(),
    loop: current.loop.stats(),
    frames: storeStats.frames,
    totalBytes: storeStats.totalBytes,
    droppedFrames: storeStats.droppedFrames,
  };
  report(message);
}

/** 회차 한 번을 돕니다. 통에 장이 들어갔으면 참을 돌려줍니다. */
async function sampleOnce(current: Session): Promise<boolean> {
  const { video, canvas, context, pipeline } = current;
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return false; // 아직 첫 프레임이 안 왔습니다.
  }

  // 폭 1280 을 넘지 않게 줄여서 그립니다. 여기서 이미 줄여 두면 해시도 인코딩도
  // 같은 크기를 봅니다(불변 원칙 §4-4 의 "폭 1280·품질 80").
  const scale = video.videoWidth > TARGET_WIDTH ? TARGET_WIDTH / video.videoWidth : 1;
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.drawImage(video, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);

  const result = await pipeline.offer(
    { width: imageData.width, height: imageData.height, data: imageData.data },
    Date.now(),
  );

  // 장 한 개를 보내는 일은 파이프라인의 onFrame(= reportFrame)이 이미 했습니다.
  // 숫자를 덧붙여 알릴지는 부르는 쪽(runOneSample)이 정합니다.
  return result.status === 'stored';
}

/**
 * 회차 하나를 돌고 그 결과로 상태를 갈아탑니다.
 *
 * 규칙은 `capture-run-state.ts` 한 곳에 있습니다. 여기서는 그 답대로 움직이기만 합니다.
 * 성공하면 `error` 로 굳어 있던 상태가 `capturing` 으로 돌아옵니다.
 */
async function runOneSample(current: Session): Promise<void> {
  const stored = await sampleOnce(current);

  const decision = reduceCaptureRun(run, 'sample-ok');
  const recovered = decision.next.state !== run.state;
  run = decision.next;

  // 장이 들어갔거나, 오류에서 회복해 상태가 바뀌었을 때만 알립니다. 아무 일도 없던
  // 회차까지 1초마다 알리면 서비스 워커를 공연히 깨우게 됩니다.
  if (stored || recovered) {
    sendStats(current);
  }
}

/**
 * 회차 하나가 던졌을 때입니다.
 *
 * 루프는 설계대로 멈추지 않고 다음 회차를 계속 잡습니다. 그래서 여기서 **연속 실패 예산**을
 * 셉니다. 예산을 다 쓰면(기본 5회 연속) 마지막 오류를 알리고 세션을 접습니다. 그 사이에
 * 한 번이라도 성공하면 위 `runOneSample` 이 셈을 0 으로 되돌립니다.
 */
function handleSampleError(current: Session, error: unknown): void {
  const reason = error instanceof Error ? error.message : '프레임 하나를 처리하지 못했어요';

  const decision = reduceCaptureRun(run, 'sample-error');
  run = decision.next;

  if (decision.reportError) {
    console.error('[classmate] 회차 하나를 처리하지 못했어요', reason);
    report({ type: CAPTURE_ERROR, reason });
  }

  if (decision.stopSession && session?.token === current.token) {
    console.error('[classmate] 연속 실패가 이어져 캡처를 접어요', run.consecutiveErrors);
    stopSession();
  }

  sendStats(current);
}

/**
 * 캡처 세션 하나를 엽니다.
 *
 * 순서와 정리는 `session-setup.ts` 의 `openCaptureSession` 이 지킵니다. 요점은 두 가지입니다.
 *   - **던질 수 있는 검사(설정 범위 · 교시 이름 · canvas 문맥)를 스트림보다 먼저** 합니다.
 *     그래야 실패했을 때 되돌릴 자원이 아예 없습니다.
 *   - 스트림을 연 뒤 실패하면 `openCaptureSession` 이 그 자리에서 트랙을 멈추고 `<video>` 를
 *     문서에서 뗍니다. 바깥 `stopSession()` 에 맡기지 않는 까닭은, 그 함수가 보는 `session`
 *     변수는 아래 맨 끝에서야 채워지기 때문입니다.
 */
async function startCapture(message: CaptureStreamMessage): Promise<void> {
  stopSession();
  run = { state: 'starting', consecutiveErrors: 0 };

  const current = await openCaptureSession({
    prepare: () => {
      // 임계값과 간격은 `capture.start` → background → 여기까지 실려 옵니다. 빈자리는 여기서
      // 기본값으로 채우고, 범위 밖 값은 RangeError 로 막습니다(messages.ts 의 규칙 한 벌).
      const settings = resolveCaptureSettings(message);
      // 교시 이름이 계약 모양이 아니면 여기서 막힙니다(host-messages.ts 의 규칙 한 벌).
      const store = new FrameStore({ periodId: message.periodId, source: 'meet-tab' });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        throw new Error('canvas 2d 문맥을 열지 못했어요');
      }

      return { settings, store, canvas, context };
    },

    openStream: () => openTabStream(message.streamId),

    createVideo: (stream: MediaStream) => {
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.srcObject = stream;
      document.body.append(video);
      return video;
    },

    // 재생 시작은 거절될 수 있습니다. 거절되면 위에서 만든 `<video>` 까지 정리됩니다.
    startVideo: (video: HTMLVideoElement) => video.play(),

    buildSession: (prepared, stream: MediaStream, video: HTMLVideoElement): Session => {
      const { settings, store, canvas, context } = prepared;

      const pipeline = new CapturePipeline({
        store,
        // 바이트를 background 로 넘겨야 하므로 실제 WebP 바이트를 받습니다.
        encoder: new OffscreenWebpEncoder({ includePayload: true }),
        threshold: settings.threshold,
        onFrame: reportFrame,
      });

      // 회차를 잡는 곳은 이 루프 하나뿐입니다(검증자 지적 2·3).
      //   - 앞 회차가 끝나야 다음 회차를 예약하므로 인코더 인스턴스를 두 회차가 같이 만지지 않습니다.
      //   - 파이프라인에는 간격 필터가 없으므로 타이머 지터로 회차가 통째로 버려지지 않습니다.
      // `built` 를 자기 초기화식 안의 콜백에서 가리키는데, 이 콜백은 루프가 처음 회차를
      // 돌릴 때(= 객체가 다 만들어진 뒤) 비로소 불립니다.
      const built: Session = {
        token: nextSessionToken,
        stream,
        video,
        canvas,
        context,
        pipeline,
        store,
        loop: new SamplingLoop({
          intervalMs: settings.sampleIntervalMs,
          task: () => runOneSample(built),
          onError: (error: unknown) => handleSampleError(built, error),
        }),
      };
      nextSessionToken += 1;
      return built;
    },
  });

  // 사람이 탭 공유를 끄면 트랙이 끝납니다. 그때도 조용히 정리합니다.
  const [track] = current.stream.getVideoTracks();
  track?.addEventListener('ended', () => {
    // 지나간 세션의 리스너가 뒤늦게 깨어날 수 있습니다. 신원표가 다르면 지금 돌고 있는
    // 캡처를 건드리지 않고 그냥 물러납니다.
    if (session?.token !== current.token) return;

    run = { state: 'stopped', consecutiveErrors: 0 };
    stopSession();
    sendStats(current);
  });

  current.loop.start();

  session = current;
  run = capturingRunState();
  sendStats(current);
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isCaptureMessage(message)) {
    return false;
  }

  if (message.type === CAPTURE_STREAM) {
    void startCapture(message).catch((error: unknown) => {
      // 여는 도중에 연 자원(트랙·<video>)은 `openCaptureSession` 이 이미 되돌렸습니다.
      // 여기 `stopSession()` 은 혹시 앞 세션이 남아 있을 때를 위한 마무리일 뿐입니다.
      stopSession();
      fail(error instanceof Error ? error.message : '탭 화면을 열지 못했어요');
    });
    return false;
  }

  if (message.type === CAPTURE_STOP) {
    run = { state: 'stopped', consecutiveErrors: 0 };
    const closing = session;
    stopSession();
    if (closing) {
      sendStats(closing);
    }
    return false;
  }

  return false;
});

console.log('[classmate] Offscreen 문서가 준비됐어요 · streamId 를 기다립니다');
