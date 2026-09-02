import { useMemo } from 'react';

import { GOLDEN_BUNDLE } from '../../src/panel/golden-bundle';
import { PanelApp } from '../../src/panel/PanelApp';
import { ReplayStore } from '../../src/panel/replay-store';

// 사이드패널의 뿌리. 지금 데이터 소스는 골든 시나리오 fixture 재생기 하나입니다.
// 2라운드에 실제 커넥터(전사·화면·IntelliJ)와 세션 스토어가 붙으면 `ReplayStore.pushEvent` 가 그 입구입니다.

export type ReplayMode = 'auto' | 'manual';

/** 주소에 `?replay=manual` 이 있으면 시계를 스스로 밀지 않습니다(E2E 가 체크포인트로 조종). */
export function replayModeFromSearch(search: string): ReplayMode {
  return new URLSearchParams(search).get('replay') === 'manual' ? 'manual' : 'auto';
}

export function App() {
  const store = useMemo(() => new ReplayStore(GOLDEN_BUNDLE), []);
  const mode = replayModeFromSearch(window.location.search);
  return <PanelApp store={store} autoClock={mode === 'auto'} />;
}
