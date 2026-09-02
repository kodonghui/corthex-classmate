import { describe, expect, it } from 'vitest';
import { openCaptureSession, releaseCaptureResources } from './session-setup';
import type { CaptureSessionSteps } from './session-setup';

/** 멈춘 횟수를 세는 가짜 트랙입니다. 진짜 `MediaStreamTrack` 자리에 들어갑니다. */
class FakeTrack {
  stops = 0;

  stop(): void {
    this.stops += 1;
  }
}

/** 트랙 두 개를 든 가짜 스트림입니다. */
class FakeStream {
  readonly tracks = [new FakeTrack(), new FakeTrack()];

  getTracks(): FakeTrack[] {
    return this.tracks;
  }

  /** 트랙이 하나라도 살아 있으면 참입니다. */
  get anyAlive(): boolean {
    return this.tracks.some((track) => track.stops === 0);
  }
}

/** 문서에서 떼어진 횟수를 세는 가짜 `<video>` 입니다. */
class FakeVideo {
  srcObject: unknown = 'stream';
  removes = 0;

  remove(): void {
    this.removes += 1;
  }
}

interface Prepared {
  label: string;
}

type Steps = CaptureSessionSteps<Prepared, FakeStream, FakeVideo, string>;

/**
 * 시험용 단계 묶음입니다. 바꾸고 싶은 단계만 덮어씁니다.
 * 각 단계가 실제로 몇 번 불렸는지도 함께 셉니다.
 */
function makeSteps(overrides: Partial<Steps> = {}): {
  steps: Steps;
  stream: FakeStream;
  video: FakeVideo;
  calls: Record<keyof Steps, number>;
} {
  const stream = new FakeStream();
  const video = new FakeVideo();
  const calls: Record<keyof Steps, number> = {
    prepare: 0,
    openStream: 0,
    createVideo: 0,
    startVideo: 0,
    buildSession: 0,
  };

  const base: Steps = {
    prepare: () => {
      calls.prepare += 1;
      return { label: '준비됨' };
    },
    openStream: async () => {
      calls.openStream += 1;
      return stream;
    },
    createVideo: () => {
      calls.createVideo += 1;
      return video;
    },
    startVideo: () => {
      calls.startVideo += 1;
    },
    buildSession: (prepared) => {
      calls.buildSession += 1;
      return `세션(${prepared.label})`;
    },
  };

  return { steps: { ...base, ...overrides }, stream, video, calls };
}

describe('openCaptureSession 성공 길', () => {
  it('다섯 단계를 순서대로 밟고 세션을 돌려줍니다 · 아무것도 정리하지 않습니다', async () => {
    const { steps, stream, video, calls } = makeSteps();

    expect(await openCaptureSession(steps)).toBe('세션(준비됨)');
    expect(calls).toEqual({
      prepare: 1,
      openStream: 1,
      createVideo: 1,
      startVideo: 1,
      buildSession: 1,
    });
    expect(stream.anyAlive).toBe(true);
    expect(video.removes).toBe(0);
  });
});

describe('openCaptureSession 실패 길', () => {
  it('준비 단계가 던지면 스트림을 아예 열지 않습니다', async () => {
    // 이것이 이번 수정의 핵심입니다. 설정 범위 검사·통 만들기를 스트림보다 **먼저** 하면
    // 실패했을 때 되돌릴 자원 자체가 생기지 않습니다.
    const { steps, stream, video, calls } = makeSteps({
      prepare: () => {
        throw new RangeError('임계값은 0 이상 64 이하의 숫자여야 해요');
      },
    });

    await expect(openCaptureSession(steps)).rejects.toThrow(RangeError);

    expect(calls.openStream).toBe(0);
    expect(calls.createVideo).toBe(0);
    expect(stream.anyAlive).toBe(true); // 연 적이 없으니 멈출 것도 없습니다.
    expect(video.removes).toBe(0);
  });

  it('`<video>` 를 만들다 던지면 트랙만 멈춥니다', async () => {
    const { steps, stream, video } = makeSteps({
      createVideo: () => {
        throw new Error('video 를 만들지 못했어요');
      },
    });

    await expect(openCaptureSession(steps)).rejects.toThrow('video 를 만들지 못했어요');

    expect(stream.tracks.map((track) => track.stops)).toEqual([1, 1]);
    expect(video.removes).toBe(0); // 아직 만들어지지 않은 요소입니다.
  });

  it('재생이 거절되면 트랙을 멈추고 `<video>` 를 문서에서 뗍니다', async () => {
    const { steps, stream, video } = makeSteps({
      startVideo: async () => {
        throw new Error('재생이 거절됐어요');
      },
    });

    await expect(openCaptureSession(steps)).rejects.toThrow('재생이 거절됐어요');

    expect(stream.tracks.map((track) => track.stops)).toEqual([1, 1]);
    expect(video.removes).toBe(1);
    expect(video.srcObject).toBeNull();
  });

  it('마지막 조립이 던져도 트랙과 `<video>` 를 모두 정리하고 오류를 그대로 올립니다', async () => {
    const { steps, stream, video } = makeSteps({
      buildSession: () => {
        throw new RangeError('교시 식별자는 2026-09-02-p3 모양이어야 해요');
      },
    });

    await expect(openCaptureSession(steps)).rejects.toThrow(RangeError);

    expect(stream.tracks.map((track) => track.stops)).toEqual([1, 1]);
    expect(video.removes).toBe(1);
  });

  it('시작이 여러 번 실패해도 살아남는 트랙이 쌓이지 않습니다', async () => {
    // 예전 구멍은 실패할 때마다 트랙과 <video> 가 한 벌씩 남는 것이었습니다.
    const opened: FakeStream[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { steps, stream } = makeSteps({
        startVideo: () => {
          throw new Error('재생이 거절됐어요');
        },
      });
      opened.push(stream);
      await expect(openCaptureSession(steps)).rejects.toThrow();
    }

    expect(opened.filter((stream) => stream.anyAlive)).toEqual([]);
  });
});

describe('releaseCaptureResources', () => {
  it('트랙 하나가 던져도 나머지와 `<video>` 를 마저 정리합니다', () => {
    const good = new FakeTrack();
    const angry = {
      stop(): void {
        throw new Error('이미 멈춘 트랙이에요');
      },
    };
    const video = new FakeVideo();

    expect(() => releaseCaptureResources({ getTracks: () => [angry, good] }, video)).not.toThrow();

    expect(good.stops).toBe(1);
    expect(video.removes).toBe(1);
  });

  it('없는 자원을 넣어도 조용히 넘어갑니다', () => {
    expect(() => releaseCaptureResources(null, null)).not.toThrow();
  });
});
