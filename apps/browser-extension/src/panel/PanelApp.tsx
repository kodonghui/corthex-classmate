// 사이드패널 앱 — 재생기(ReplayStore)를 구독해 듣는 중 / 자세히 두 화면 중 하나를 그립니다.
//
//   ReplayStore ──subscribe──▶ PanelApp ──▶ listeningView / detailView ──▶ ListeningScreen / DetailScreen
//        ▲                                                                        │
//        └────────────── 손짓(catchTerm · chip · openDetail · back …) ◀───────────┘
//
// 1초 시계(autoClock)와 Alt+S(`e.code === "KeyS"`, 한글 IME 에서도 같음) 는 여기서만 듣습니다.

import { useEffect, useSyncExternalStore } from "react";

import { detailView, listeningView } from "./lesson-view";
import { installReplayHandle } from "./replay-handle";
import type { ReplayStore } from "./replay-store";
import { DetailScreen } from "./screens/DetailScreen";
import { ListeningScreen } from "./screens/ListeningScreen";

export interface PanelAppProps {
  readonly store: ReplayStore;
  /** true 면 1초마다 시계를 밉니다. E2E 는 false 로 열고 체크포인트로 조종합니다. */
  readonly autoClock: boolean;
}

export function PanelApp({ store, autoClock }: PanelAppProps): React.JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  useEffect(() => {
    if (!autoClock) return undefined;
    const id = setInterval(() => store.tick(), 1_000);
    return () => clearInterval(id);
  }, [store, autoClock]);

  useEffect(() => installReplayHandle(store), [store]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!event.altKey || event.code !== "KeyS" || store.getState().screen !== "home") return;
      event.preventDefault();
      const last = store.lines().at(-1);
      if (last !== undefined) store.catchSentence(last.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  const lines = store.lines(state.now);
  const detail = state.screen === "detail" ? detailView(store.bundle, state, lines) : null;

  return (
    <div
      className="cm-panel"
      data-screen-label={detail === null ? "듣는 중" : "자세히"}
      data-tutor-state={state.machine.state}
      data-note={state.machine.note}
    >
      {detail === null ? (
        <ListeningScreen
          view={listeningView(store.bundle, state, lines)}
          onTerm={(lineId, segmentIndex, word) => store.catchTerm(lineId, segmentIndex, word)}
          onSentence={(lineId) => store.catchSentence(lineId)}
          onGuess={(guessId) => store.chooseGuess(guessId)}
          onChip={(chipId) => store.chip(chipId)}
          onDetail={() => store.openDetail()}
          onExpand={() => store.expand()}
        />
      ) : (
        <DetailScreen view={detail} onBack={() => store.back()} onFollowUp={(id) => store.followUp(id)} />
      )}
    </div>
  );
}
