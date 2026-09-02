import { useEffect, useMemo, useState } from 'react';

import type { LiveHandle } from '../../src/live/attach';
import { attachLive } from '../../src/live/attach';
import { GOLDEN_BUNDLE } from '../../src/panel/golden-bundle';
import { PanelApp } from '../../src/panel/PanelApp';
import type { AskPort } from '../../src/panel/ports';
import { ReplayStore } from '../../src/panel/replay-store';
import type { Settings } from '../../src/panel/settings-store';
import { detectSettingsStorage, readSettings } from '../../src/panel/settings-store';
import { makePeriodId } from '../../src/tiro/period';

/**
 * 사이드패널의 뿌리. 데이터 소스는 주소의 `?replay=` 로 고릅니다.
 *
 * ```text
 *   sidepanel.html                 → 라이브   ReplayStore.live(..) + attachLive(.., chrome.runtime)
 *   sidepanel.html?replay=auto     → fixture  new ReplayStore(GOLDEN_BUNDLE) · 1초 시계
 *   sidepanel.html?replay=manual   → fixture  시계 멈춤 · window.classmateReplay 로 장면 조종(E2E)
 * ```
 *
 * 라이브 모드의 조립 순서(왜 이 순서인가):
 *
 * ```text
 *   readSettings(chrome.storage.local)  ── 교시 번호 · 주제 · 제공자 · 자동 접기
 *            │
 *            ▼
 *   ReplayStore.live({ periodId, startMs, subject, env, askPort })
 *            │            ▲
 *            │            └─ askPort 는 아직 없는 손잡이로 **넘겨주기만** 합니다(아래 openLive)
 *            ▼
 *   attachLive({ inbox: store, outbox: store }, chrome.runtime) ──▶ LiveHandle { ask, reconnect, detach }
 *            │
 *            ▼
 *   <PanelApp store autoClock onReconnect={live.reconnect} />
 * ```
 *
 * 교시 id 는 서비스 워커와 **같은 함수**(`makePeriodId`)와 같은 저장 키(`classmate.periodNumber`)로
 * 만듭니다. 패널이 만드는 사건·질문 id(`ev-<periodId>-x…` · `q-<periodId>-x…`)가 서비스 워커의
 * 교시 로그와 같은 교시를 가리키게 하려는 것입니다(고정 계약 (라)).
 */

export type ReplayMode = 'auto' | 'manual' | 'live';

/**
 * 주소의 `?replay=` 를 읽습니다. 없으면 라이브, `manual` 이면 멈춘 fixture,
 * 그 밖의 값이면 1초 시계로 흐르는 fixture 입니다.
 */
export function replayModeFromSearch(search: string): ReplayMode {
  const value = new URLSearchParams(search).get('replay');
  if (value === null) return 'live';
  return value === 'manual' ? 'manual' : 'auto';
}

interface LiveSetup {
  readonly store: ReplayStore;
  readonly live: LiveHandle;
}

/**
 * 설정으로 라이브 스토어와 서비스 워커 연결을 엽니다.
 *
 * 스토어는 `askPort` 를 받아야 하고, `attachLive` 는 스토어(`inbox`·`outbox`)를 받아야 해서
 * 서로를 먼저 요구합니다. 그래서 스토어에는 "나중에 생길 손잡이로 넘겨주는" 얇은 `AskPort` 를
 * 주고, 손잡이가 생기면 그리로 흘립니다. 스토어가 `ask` 를 부르는 때는 사람이 낱말·문장을
 * 붙잡은 뒤라서, 그 사이에 손잡이는 이미 있습니다.
 */
export function openLive(
  settings: Settings,
  runtime: Parameters<typeof attachLive>[1],
  startMs = Date.now(),
): LiveSetup {
  let handle: LiveHandle | null = null;
  const forward: AskPort = {
    ask(request) {
      handle?.ask.ask(request);
    },
  };
  const store = ReplayStore.live({
    periodId: makePeriodId(new Date(startMs), settings.periodNumber),
    startMs,
    subject: settings.subject,
    env: { provider: settings.provider, autoFold: settings.autoFold },
    askPort: forward,
  });
  handle = attachLive({ inbox: store, outbox: store }, runtime);
  return { store, live: handle };
}

function FixtureApp({ mode }: { readonly mode: 'auto' | 'manual' }): React.JSX.Element {
  const store = useMemo(() => new ReplayStore(GOLDEN_BUNDLE), []);
  return <PanelApp store={store} autoClock={mode === 'auto'} />;
}

function LiveApp(): React.JSX.Element | null {
  const [setup, setSetup] = useState<LiveSetup | null>(null);

  useEffect(() => {
    let alive = true;
    let opened: LiveSetup | null = null;
    // 설정은 비동기로 읽습니다(chrome.storage.local). 그 수십 ms 동안은 빈 화면입니다.
    void readSettings(detectSettingsStorage()).then((settings) => {
      if (!alive) return;
      opened = openLive(settings, chrome.runtime);
      setSetup(opened);
    });
    return () => {
      alive = false;
      opened?.live.detach();
    };
  }, []);

  if (setup === null) return null;
  return (
    <PanelApp
      store={setup.store}
      autoClock
      onReconnect={(connector) => setup.live.reconnect(connector)}
    />
  );
}

export function App(): React.JSX.Element {
  const mode = useMemo(() => replayModeFromSearch(window.location.search), []);
  return mode === 'live' ? <LiveApp /> : <FixtureApp mode={mode} />;
}
