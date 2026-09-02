// `window.classmateReplay` — E2E(Playwright)와 손 시험이 재생기를 조종하는 손잡이입니다.
//
// 사이드패널은 Chrome 의 브라우저 UI 라 Playwright 가 직접 열 수 없으므로 `chrome-extension://<id>/sidepanel.html`
// 을 일반 페이지로 열고, 이 손잡이로 체크포인트(`goto`)에 세운 뒤 스크린샷을 찍습니다.
// 2라운드에 실제 커넥터가 붙으면 개발 빌드에서만 붙이는 쪽으로 옮깁니다.

import type { Checkpoint, ReplayState, ReplayStore } from "./replay-store";
import { CHECKPOINTS } from "./replay-store";

export interface ReplayHandle {
  readonly checkpoints: readonly Checkpoint[];
  goto(checkpoint: Checkpoint): void;
  /** `2026-09-02T10:32:16+09:00` 같은 ISO 시각까지 시계를 밉니다. */
  advanceTo(iso: string): void;
  state(): ReplayState;
  catchTerm(lineId: string, segmentIndex: number, word: string): void;
  catchSentence(lineId: string): void;
  chooseGuess(guessId: string): void;
  chip(chipId: string): void;
  openDetail(): void;
  back(): void;
  expand(): void;
  followUp(followUpId: string): void;
}

declare global {
  interface Window {
    classmateReplay?: ReplayHandle;
  }
}

/** 손잡이를 창에 붙이고, 떼는 함수를 돌려줍니다. */
export function installReplayHandle(store: ReplayStore): () => void {
  const handle: ReplayHandle = {
    checkpoints: CHECKPOINTS,
    goto: (checkpoint) => store.goto(checkpoint),
    advanceTo: (iso) => store.advanceTo(iso),
    state: () => store.getState(),
    catchTerm: (lineId, segmentIndex, word) => store.catchTerm(lineId, segmentIndex, word),
    catchSentence: (lineId) => store.catchSentence(lineId),
    chooseGuess: (guessId) => store.chooseGuess(guessId),
    chip: (chipId) => store.chip(chipId),
    openDetail: () => store.openDetail(),
    back: () => store.back(),
    expand: () => store.expand(),
    followUp: (followUpId) => store.followUp(followUpId),
  };
  window.classmateReplay = handle;
  return () => {
    if (window.classmateReplay === handle) delete window.classmateReplay;
  };
}
