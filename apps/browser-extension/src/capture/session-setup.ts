/**
 * 캡처 세션을 여는 **순서**와, 여는 도중 실패했을 때의 **정리**를 담은 파일입니다.
 *
 * 왜 따로 뺐는가:
 *   Offscreen 문서(`entrypoints/offscreen/main.ts`)는 vitest 가 보지 않는 자리라
 *   시험을 붙일 수 없습니다. 그런데 "어떤 순서로 열고, 중간에 실패하면 무엇을 되돌리나" 는
 *   가장 틀리기 쉬운 판단입니다. 실제로 예전 순서는 이런 구멍이 있었습니다.
 *
 *     예전                                   지금
 *     ① 탭 스트림을 연다                     ① 설정 검사 · 통 만들기   ← 실패해도 연 자원이 없음
 *     ② <video> 를 붙인다                    ② 탭 스트림을 연다
 *     ③ 설정을 검사한다  ← 여기서 던지면      ③ <video> 를 붙인다      ┐ 여기부터는 실패하면
 *     ④ 통을 만든다        ①②가 살아남음     ④ 나머지를 조립한다      ┘ 연 자원을 직접 되돌림
 *
 *   ③ 에서 던지면 세션 변수에는 아직 아무것도 대입되지 않아, 바깥의 `stopSession()` 은
 *   "지금 세션 없음" 으로 보고 아무 일도 하지 않았습니다. 그 결과 탭 캡처 트랙이 살아 있고
 *   `<video>` 가 문서에 남았습니다. 시작이 여러 번 실패하면 그만큼 쌓였습니다.
 *
 * 브라우저 API 를 직접 부르지 않습니다. 필요한 동작을 밖에서 넣어 주므로 Node(Vitest)에서
 * 가짜 스트림·가짜 `<video>` 로 "실패하면 정말 정리하는가" 를 확인할 수 있습니다.
 */

/** 정리할 때 트랙을 멈출 수 있으면 됩니다. 진짜 `MediaStream` 도 이 모양을 지킵니다. */
export interface StoppableStream {
  getTracks(): { stop(): void }[];
}

/** 정리할 때 화면에서 뗄 수 있으면 됩니다. 진짜 `HTMLVideoElement` 도 이 모양을 지킵니다. */
export interface RemovableVideo {
  srcObject: unknown;
  remove(): void;
}

/**
 * 열어 둔 자원을 되돌립니다. **던지지 않습니다.**
 *
 * 정리는 대개 이미 실패한 길 위에서 불립니다. 여기서 또 던지면 원래 실패 이유가 가려지므로,
 * 한 조각이 실패해도 나머지 조각을 계속 정리합니다.
 */
export function releaseCaptureResources(
  stream: StoppableStream | null,
  video: RemovableVideo | null,
): void {
  if (stream) {
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // 이미 멈춘 트랙입니다. 그대로 다음 트랙으로 갑니다.
      }
    }
  }

  if (video) {
    try {
      video.srcObject = null;
      video.remove();
    } catch {
      // 이미 문서에서 빠진 요소입니다.
    }
  }
}

/**
 * 세션 하나를 여는 네 단계입니다. 각 단계가 하는 일은 부르는 쪽이 넣습니다.
 *
 * 단계를 이렇게 쪼갠 이유는 **되돌릴 것이 언제 생기는지** 를 분명히 하기 위해서입니다.
 * `prepare` 까지는 되돌릴 것이 없고, `openStream` 부터는 있습니다.
 */
export interface CaptureSessionSteps<
  TPrepared,
  TStream extends StoppableStream,
  TVideo extends RemovableVideo,
  TSession,
> {
  /**
   * (1) 스트림을 열기 **전에** 끝내는 준비입니다. 설정 범위 검사와 통 만들기가 여기 옵니다.
   * 여기서 던지면 아직 연 자원이 없으므로 정리할 것도 없습니다.
   */
  prepare(): TPrepared | Promise<TPrepared>;
  /** (2) 탭 스트림을 엽니다. 여기부터 되돌릴 자원이 생깁니다. */
  openStream(): Promise<TStream>;
  /** (3) 스트림을 담을 `<video>` 를 만들어 문서에 붙입니다. 아직 재생 전입니다. */
  createVideo(stream: TStream): TVideo;
  /** (4) 재생을 시작해 첫 프레임을 기다립니다. 거절될 수 있어 따로 두었습니다. */
  startVideo(video: TVideo): void | Promise<void>;
  /** (5) 나머지 부품을 붙여 세션 하나를 완성합니다. */
  buildSession(prepared: TPrepared, stream: TStream, video: TVideo): TSession | Promise<TSession>;
}

/**
 * 위 단계를 순서대로 밟고, 스트림을 연 뒤 어느 단계에서 던지든 **연 자원을 직접 정리한 뒤**
 * 그 오류를 그대로 다시 던집니다.
 *
 * 정리를 바깥의 `stopSession()` 에 맡기지 않는 것이 핵심입니다. 바깥은 세션 변수가 채워진
 * 뒤에야 정리할 수 있는데, 여기서 실패하면 세션 변수는 끝내 채워지지 않기 때문입니다.
 */
export async function openCaptureSession<
  TPrepared,
  TStream extends StoppableStream,
  TVideo extends RemovableVideo,
  TSession,
>(steps: CaptureSessionSteps<TPrepared, TStream, TVideo, TSession>): Promise<TSession> {
  const prepared = await steps.prepare();

  const stream = await steps.openStream();
  let video: TVideo | null = null;
  try {
    video = steps.createVideo(stream);
    await steps.startVideo(video);
    return await steps.buildSession(prepared, stream, video);
  } catch (error: unknown) {
    releaseCaptureResources(stream, video);
    throw error;
  }
}
