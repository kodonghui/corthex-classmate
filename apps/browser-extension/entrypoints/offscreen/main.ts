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
import { DEFAULT_SAMPLE_INTERVAL_MS, SamplingLoop } from '../../src/capture/sampling-loop';
import { OffscreenWebpEncoder, TARGET_WIDTH } from '../../src/capture/webp-encoder';
import {
  CAPTURE_ERROR,
  CAPTURE_FRAME,
  CAPTURE_STATS,
  CAPTURE_STOP,
  CAPTURE_STREAM,
  isCaptureMessage,
} from '../../src/capture/messages';
import type {
  CaptureState,
  CaptureStatsMessage,
  CaptureStreamMessage,
} from '../../src/capture/messages';

interface Session {
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
let state: CaptureState = 'idle';

function report(message: unknown): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // background 가 잠들어 있으면 이 한 번은 버립니다. 다음 프레임에서 다시 알립니다.
  });
}

function fail(reason: string): void {
  state = 'error';
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
  for (const track of session.stream.getTracks()) {
    track.stop();
  }
  session.video.srcObject = null;
  session.video.remove();
  session = null;
}

function sendStats(current: Session): void {
  const storeStats = current.store.stats();
  const message: CaptureStatsMessage = {
    type: CAPTURE_STATS,
    state,
    stats: current.pipeline.stats(),
    loop: current.loop.stats(),
    frames: storeStats.frames,
    totalBytes: storeStats.totalBytes,
    droppedFrames: storeStats.droppedFrames,
  };
  report(message);
}

async function sampleOnce(current: Session): Promise<void> {
  const { video, canvas, context, pipeline } = current;
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return; // 아직 첫 프레임이 안 왔습니다.
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

  if (result.status === 'stored' && result.frame) {
    // 바이트 자체는 아직 싣지 않습니다. Gate D(Native Messaging) 뒤에 로컬 도우미로 보냅니다.
    report({ type: CAPTURE_FRAME, frame: result.frame });
    sendStats(current);
  }
}

async function startCapture(message: CaptureStreamMessage): Promise<void> {
  stopSession();
  state = 'starting';

  const stream = await openTabStream(message.streamId);

  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.srcObject = stream;
  document.body.append(video);
  await video.play();

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error('canvas 2d 문맥을 열지 못했어요');
  }

  const store = new FrameStore({ periodId: message.periodId, source: 'meet-tab' });
  const pipeline = new CapturePipeline({
    store,
    encoder: new OffscreenWebpEncoder(),
    ...(message.threshold === undefined ? {} : { threshold: message.threshold }),
  });

  // 회차를 잡는 곳은 이 루프 하나뿐입니다(검증자 지적 2·3).
  //   - 앞 회차가 끝나야 다음 회차를 예약하므로 인코더 인스턴스를 두 회차가 같이 만지지 않습니다.
  //   - 파이프라인에는 간격 필터가 없으므로 타이머 지터로 회차가 통째로 버려지지 않습니다.
  // `current` 를 자기 초기화식 안의 콜백에서 가리키는데, 이 콜백은 루프가 처음 회차를
  // 돌릴 때(= 객체가 다 만들어진 뒤) 비로소 불립니다.
  const current: Session = {
    stream,
    video,
    canvas,
    context,
    pipeline,
    store,
    loop: new SamplingLoop({
      intervalMs: message.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS,
      task: () => sampleOnce(current),
      onError: (error: unknown) => {
        fail(error instanceof Error ? error.message : '프레임 하나를 처리하지 못했어요');
      },
    }),
  };

  // 사람이 탭 공유를 끄면 트랙이 끝납니다. 그때도 조용히 정리합니다.
  const [track] = stream.getVideoTracks();
  track?.addEventListener('ended', () => {
    state = 'stopped';
    stopSession();
    sendStats(current);
  });

  current.loop.start();

  session = current;
  state = 'capturing';
  sendStats(current);
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isCaptureMessage(message)) {
    return false;
  }

  if (message.type === CAPTURE_STREAM) {
    void startCapture(message).catch((error: unknown) => {
      stopSession();
      fail(error instanceof Error ? error.message : '탭 화면을 열지 못했어요');
    });
    return false;
  }

  if (message.type === CAPTURE_STOP) {
    state = 'stopped';
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
