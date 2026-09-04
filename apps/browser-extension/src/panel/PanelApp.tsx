// 사이드패널 앱 — 재생기(ReplayStore)를 구독해 네 화면 중 하나를 그립니다.
//
//   ReplayStore ──subscribe──▶ PanelApp ──▶ listeningView / detailView ──▶ ListeningScreen / DetailScreen
//        ▲                        │                                                    │
//        │                        ├──▶ historyView  ──▶ HistoryScreen                  │
//        │                        └──▶ settings     ──▶ SettingsScreen                 │
//        └────────────── 손짓(catchTerm · chip · openDetail · back …) ◀────────────────┘
//
// 화면 축이 둘입니다.
//   - 스토어의 `screen`("home" | "detail") — 수업 흐름. 단위 1b 가 가진 축이라 여기서 바꾸지 않습니다.
//   - 이 컴포넌트의 `overlay`("none" | "history" | "settings") — 수업 흐름 위에 잠깐 얹는 화면.
//     기록·설정은 상태기계와 상관없이 아무 때나 열고 닫을 수 있어야 해서 React 상태로 둡니다.
//
// 1초 시계(autoClock)와 Alt+S(`e.code === "KeyS"`, 한글 IME 에서도 같음) 는 여기서만 듣습니다.

import type { SessionEvent } from "@classmate/contracts";
import {
  generateFiveActivities,
  type ActivitySetV2,
} from "@classmate/learning-engine";
import { formatIso } from "@classmate/tutor-core";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { historyView } from "./history-view";
import { detailView, detailViewFor, listeningAskParent, listeningView } from "./lesson-view";
import type { ReconnectTarget } from "./ports";
import { installReplayHandle } from "./replay-handle";
import type { ReplayStore } from "./replay-store";
import { DetailScreen } from "./screens/DetailScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ListeningScreen } from "./screens/ListeningScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { PastSessionScreen } from "./screens/PastSessionScreen";
import type { PastSessionScreenState } from "./screens/PastSessionScreen";
import { ActivityScreen } from "./screens/ActivityScreen";
import type { ActivitySaveOutcome } from "./screens/ActivityScreen";
import type { SessionHistoryClient } from "../session-history/client";
import { sessionHistoryErrorText } from "../session-history/client";
import type { SessionLibraryView } from "../session-history/view";
import { pastSessionDetailViewFromBundle, sessionLibraryView } from "../session-history/view";
import type { SessionSummaryV2 } from "../session-history/types";
import { isReviewableActivitySetV2 } from "./activity-review";
import type { Settings, SettingsStorage } from "./settings-store";
import {
  DEFAULT_SETTINGS,
  detectSettingsStorage,
  mergeLoadedSettings,
  readSettings,
  writeSetting,
} from "./settings-store";

/** 수업 흐름 위에 얹는 화면입니다. */
type Overlay = "none" | "history" | "settings";

/**
 * 재생 모드(`?replay=manual`)에서만 창에 붙는 손잡이입니다.
 *
 * 왜 있나: 골든 fixture 의 `connector.status` 세 줄은 전부 `connected` 라, 연결 문제 화면(H-1)을
 * fixture 사건만으로는 세울 수 없습니다. 정본 디자인도 이 상태를 시연 Tweaks(`tiroDown`)로
 * 켜고 끕니다(`Classmate Side Panel.dc.html:131`). 그 자리를 옮긴 것이고, 넣는 값은 지어낸 글이
 * 아니라 계약 `connector.status` 의 `connector`·`state` 두 칸뿐입니다.
 * 실제 커넥터가 붙는 2라운드에는 service worker 가 같은 사건을 보내므로 이 손잡이는 사라집니다.
 */
declare global {
  interface Window {
    classmateConnector?: (connector: string, state: string) => void;
  }
}

export interface PanelAppProps {
  readonly store: ReplayStore;
  /** true 면 1초마다 시계를 밉니다. E2E 는 false 로 열고 체크포인트로 조종합니다. */
  readonly autoClock: boolean;
  /** 설정 보관소입니다. 없으면 `chrome.storage.local` 을 찾고, 그것도 없으면 메모리를 씁니다. */
  readonly settings?: SettingsStorage;
  /** 바닥줄 "다시 연결" 을 눌렀을 때입니다. 실제 배선은 service worker 쪽(단위 2)이 합니다. */
  readonly onReconnect?: (connector: ReconnectTarget) => void;
  /** 설정의 "오늘 기록 지우기" 를 확인했을 때입니다. */
  readonly onClearToday?: () => void;
  /** Native Host의 과거 세션 읽기 전용 API입니다. fixture에는 넣지 않습니다. */
  readonly sessionHistory?: SessionHistoryClient;
  /** 현재 실행 중인 manifest에서 읽은 표시용 빌드 식별자입니다. */
  readonly releaseIdentity?: string | null;
}

type SessionListState =
  | { readonly status: "idle" | "loading" }
  | { readonly status: "ready"; readonly sessions: readonly SessionSummaryV2[] }
  | { readonly status: "error"; readonly message: string };

interface PastSessionTarget {
  readonly sessionId: string;
  readonly title: string;
}

export function PanelApp({
  store,
  autoClock,
  settings: settingsStorage,
  onReconnect,
  onClearToday,
  sessionHistory,
  releaseIdentity,
}: PanelAppProps): React.JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [overlay, setOverlay] = useState<Overlay>("none");
  /** 기록에서 연 지난 순간입니다. null 이면 기록 목록을 그립니다. */
  const [openedMoment, setOpenedMoment] = useState<string | null>(null);
  const [sessionList, setSessionList] = useState<SessionListState>({ status: "idle" });
  const [openedPast, setOpenedPast] = useState<PastSessionScreenState | null>(null);
  const [openedPastTarget, setOpenedPastTarget] = useState<PastSessionTarget | null>(null);
  const [activityReviewSessionId, setActivityReviewSessionId] = useState<string | null>(null);
  const sessionRequest = useRef(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // `chrome` 전역은 여기서 처음 만집니다. 모듈 최상위에서 만지면 vitest(env node)가 깨집니다.
  const storage = useMemo(() => settingsStorage ?? detectSettingsStorage(), [settingsStorage]);

  useEffect(() => {
    let alive = true;
    void readSettings(storage).then((values) => {
      // 읽는 사이에 사용자가 누른 값을 옛 값으로 되돌리지 않습니다(`mergeLoadedSettings`).
      if (alive) setSettings((previous) => mergeLoadedSettings(previous, values));
    });
    return () => {
      alive = false;
    };
  }, [storage]);

  const changeSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]): void => {
      const next: Settings = { ...settings, [key]: value };
      setSettings(next);
      void writeSetting(storage, key, value);
      // 수업 중에 바로 듣는 설정은 둘뿐입니다. 나머지(교시·주제)는 스토어를 만들 때 박히므로
      // 패널을 다시 열어야 바뀝니다 — 설정 화면이 그 한 줄을 적어 둡니다.
      if (next.provider !== settings.provider || next.autoFold !== settings.autoFold) {
        store.updateEnv({ provider: next.provider, autoFold: next.autoFold });
      }
    },
    [settings, storage, store],
  );

  useEffect(() => {
    if (!autoClock) return undefined;
    const id = setInterval(() => store.tick(), 1_000);
    return () => clearInterval(id);
  }, [store, autoClock]);

  useEffect(() => installReplayHandle(store), [store]);

  useEffect(() => {
    if (autoClock) return undefined;
    let seq = 0;
    const set = (connector: string, connectorState: string): void => {
      seq += 1;
      const event: SessionEvent = {
        id: `ev-knob-${String(seq).padStart(3, "0")}`,
        periodId: store.bundle.periodId,
        at: formatIso(store.getState().now),
        type: "connector.status",
        payload: { connector, state: connectorState },
      };
      store.pushEvent(event);
    };
    window.classmateConnector = set;
    return () => {
      if (window.classmateConnector === set) delete window.classmateConnector;
    };
  }, [store, autoClock]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!event.altKey || event.code !== "KeyS") return;
      // 기록·설정을 얹어 둔 동안에는 전사가 보이지 않으므로 붙잡지 않습니다.
      if (overlay !== "none" || !settings.altS || store.getState().screen !== "home") return;
      event.preventDefault();
      const last = store.lines().at(-1);
      if (last !== undefined) store.catchSentence(last.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, overlay, settings.altS]);

  const goLesson = useCallback((): void => {
    sessionRequest.current += 1;
    setOverlay("none");
    setOpenedMoment(null);
    setOpenedPast(null);
    setOpenedPastTarget(null);
    setActivityReviewSessionId(null);
  }, []);

  useEffect(() => {
    // 라이브에서 클라이언트 배선이 교체되면 옛 클라이언트의 늦은 결과를 새 화면에 쓰지 않습니다.
    sessionRequest.current += 1;
    setSessionList({ status: "idle" });
    setOpenedPast(null);
    setOpenedPastTarget(null);
    setActivityReviewSessionId(null);
  }, [sessionHistory]);

  const loadPastSessions = useCallback((): void => {
    if (sessionHistory === undefined) return;
    const request = sessionRequest.current + 1;
    sessionRequest.current = request;
    setSessionList({ status: "loading" });
    void sessionHistory.list().then((result) => {
      if (sessionRequest.current !== request) return;
      if (result.status === "error") {
        setSessionList({ status: "error", message: sessionHistoryErrorText(result.reason) });
        return;
      }
      setSessionList({ status: "ready", sessions: result.value });
    }).catch(() => {
      if (sessionRequest.current !== request) return;
      setSessionList({ status: "error", message: sessionHistoryErrorText("read-failed") });
    });
  }, [sessionHistory]);

  useEffect(() => {
    if (overlay !== "history" || sessionHistory === undefined || sessionList.status !== "idle") return;
    loadPastSessions();
  }, [loadPastSessions, overlay, sessionHistory, sessionList.status]);

  const loadPastSession = useCallback(
    (sessionId: string, title: string): void => {
      if (sessionHistory === undefined) return;
      const request = sessionRequest.current + 1;
      sessionRequest.current = request;
      setOpenedPast({ status: "loading", title });
      void sessionHistory.getBundle(sessionId)
        .then((bundle) => {
          if (sessionRequest.current !== request) return;
          if (bundle.status === "error") {
            setOpenedPast({ status: "error", title, message: sessionHistoryErrorText(bundle.reason) });
            return;
          }
          setOpenedPast({
            status: "ready",
            view: pastSessionDetailViewFromBundle(bundle.value),
            bundle: bundle.value,
            review: { status: "idle" },
          });
        })
        .catch(() => {
          if (sessionRequest.current !== request) return;
          setOpenedPast({ status: "error", title, message: sessionHistoryErrorText("read-failed") });
        });
    },
    [sessionHistory],
  );

  const openPastSession = useCallback(
    (sessionId: string, title: string): void => {
      setOpenedPastTarget({ sessionId, title });
      setActivityReviewSessionId(null);
      loadPastSession(sessionId, title);
    },
    [loadPastSession],
  );

  const retryPastSession = useCallback((): void => {
    if (openedPastTarget === null) return;
    loadPastSession(openedPastTarget.sessionId, openedPastTarget.title);
  }, [loadPastSession, openedPastTarget]);

  const persistPastActivities = useCallback(
    async (sessionId: string, activities: ActivitySetV2): Promise<ActivitySaveOutcome> => {
      if (sessionHistory?.saveActivities === undefined) {
        return { status: "error", message: "현재 설치판은 복습 저장 기능이 없습니다." };
      }

      const request = sessionRequest.current + 1;
      sessionRequest.current = request;
      try {
        const result = await sessionHistory.saveActivities(sessionId, activities);
        if (sessionRequest.current !== request) return { status: "stale" };
        if (result.status === "error") {
          return { status: "error", message: sessionHistoryErrorText(result.reason) };
        }
        if (!isReviewableActivitySetV2(result.value)) {
          return { status: "error", message: "저장된 복습 형식이 완전하지 않아 열지 않았어요." };
        }

        setOpenedPast((current) => {
          if (current?.status !== "ready" || current.bundle.sessionId !== sessionId) return current;
          return {
            ...current,
            bundle: { ...current.bundle, activities: result.value },
            review: { status: "idle" },
          };
        });
        return { status: "ok", value: result.value };
      } catch {
        if (sessionRequest.current !== request) return { status: "stale" };
        return {
          status: "error",
          message: "복습 기록을 로컬에 저장하지 못했어요. 작성한 답은 남겨 두었습니다.",
        };
      }
    },
    [sessionHistory],
  );

  const startPastReview = useCallback((): void => {
    if (openedPast?.status !== "ready") return;
    const { bundle } = openedPast;
    if (isReviewableActivitySetV2(bundle.activities)) {
      setActivityReviewSessionId(bundle.sessionId);
      return;
    }
    if (bundle.activities.length > 0) {
      setOpenedPast((current) =>
        current?.status === "ready"
          ? {
              ...current,
              review: {
                status: "error",
                message: "복습 준비가 아직 끝나지 않아 열 수 없어요.",
              },
            }
          : current,
      );
      return;
    }
    if (sessionHistory?.saveActivities === undefined) {
      setOpenedPast((current) =>
        current?.status === "ready"
          ? {
              ...current,
              review: { status: "error", message: "현재 설치판은 복습 저장 기능이 없습니다." },
            }
          : current,
      );
      return;
    }

    let generated: ActivitySetV2;
    try {
      generated = generateFiveActivities(bundle);
    } catch {
      setOpenedPast((current) =>
        current?.status === "ready"
          ? {
              ...current,
              review: {
                status: "error",
                message: "이 기록에는 5단계 복습을 만들 실제 근거가 없습니다.",
              },
            }
          : current,
      );
      return;
    }

    // 생성된 카드에는 모범 답이 들어 있으므로, 이 시점에는 openedPast state에 넣지 않습니다.
    // Native Host가 SQLite 저장을 확인해 준 뒤에만 persistPastActivities가 새 번들을 채택합니다.
    setOpenedPast((current) =>
      current?.status === "ready" ? { ...current, review: { status: "saving" } } : current,
    );
    void persistPastActivities(bundle.sessionId, generated).then((result) => {
      if (result.status === "stale") return;
      if (result.status === "error") {
        setOpenedPast((current) =>
          current?.status === "ready" && current.bundle.sessionId === bundle.sessionId
            ? { ...current, review: { status: "error", message: result.message } }
            : current,
        );
        return;
      }
      setActivityReviewSessionId(bundle.sessionId);
    });
  }, [openedPast, persistPastActivities, sessionHistory]);

  const library: SessionLibraryView | undefined =
    sessionHistory === undefined
      ? undefined
      : sessionList.status === "ready"
        ? sessionLibraryView(sessionList.sessions, store.bundle.periodId)
        : sessionList.status === "error"
          ? { status: "error", rows: [], message: sessionList.message }
          : { status: "loading", rows: [] };

  const lines = store.lines(state.now);
  const opened =
    overlay === "history" && openedPast === null && openedMoment !== null
      ? detailViewFor(store.bundle, state, lines, openedMoment)
      : null;
  const detail = overlay === "none" && state.screen === "detail" ? detailView(store.bundle, state, lines) : null;

  const label =
    overlay === "settings"
      ? "설정"
      : openedPast !== null || opened !== null || detail !== null
        ? "자세히"
        : overlay === "history"
          ? "기록"
          : "듣는 중";

  return (
    <div
      className="cm-panel"
      data-screen-label={label}
      data-tutor-state={state.machine.state}
      data-note={state.machine.note}
    >
      {overlay === "settings" ? (
        <SettingsScreen
          values={settings}
          count={state.moments.length}
          releaseIdentity={releaseIdentity}
          onBack={goLesson}
          onChange={changeSetting}
          onClearToday={() => {
            onClearToday?.();
            goLesson();
          }}
        />
      ) : overlay === "history" ? (
        openedPast?.status === "ready" &&
        activityReviewSessionId === openedPast.bundle.sessionId &&
        isReviewableActivitySetV2(openedPast.bundle.activities) ? (
          <ActivityScreen
            key={openedPast.bundle.sessionId}
            title={openedPast.view.title}
            activities={openedPast.bundle.activities}
            onSave={(activities) => persistPastActivities(openedPast.bundle.sessionId, activities)}
            onBack={() => {
              sessionRequest.current += 1;
              setActivityReviewSessionId(null);
            }}
          />
        ) : openedPast !== null ? (
          <PastSessionScreen
            state={openedPast}
            onRetry={retryPastSession}
            onStartReview={startPastReview}
            onBack={() => {
              sessionRequest.current += 1;
              setOpenedPast(null);
              setOpenedPastTarget(null);
              setActivityReviewSessionId(null);
            }}
          />
        ) : opened === null ? (
          <HistoryScreen
            view={historyView(store.bundle, state)}
            onBack={goLesson}
            onOpen={(questionId) => setOpenedMoment(questionId)}
            {...(library === undefined
              ? {}
              : {
                  library,
                  onOpenSession: openPastSession,
                  onReloadSessions: loadPastSessions,
                })}
          />
        ) : (
          // 기록에서 연 자세히는 "수업으로 돌아가기" 도 헤더 뒤로도 듣는 중으로 갑니다(정본 dc.html 의 goHome).
          <DetailScreen
            view={opened}
            onBack={goLesson}
            onFollowUp={(id) => store.followUp(opened.questionId, id)}
            onAsk={(text) => store.askTyped(opened.questionId, text)}
          />
        )
      ) : detail !== null ? (
        <DetailScreen
          view={detail}
          onBack={() => store.back()}
          onFollowUp={(id) => store.followUp(detail.questionId, id)}
          onAsk={(text) => store.askTyped(detail.questionId, text)}
        />
      ) : (
        <ListeningScreen
          view={listeningView(store.bundle, state, lines, store.isLive)}
          onTerm={(lineId, segmentIndex, word) => store.catchTerm(lineId, segmentIndex, word)}
          onSentence={(lineId) => store.catchSentence(lineId)}
          onGuess={(guessId) => store.chooseGuess(guessId)}
          onChip={(chipId) => store.chip(chipId)}
          onDetail={() => store.openDetail()}
          onExpand={() => store.expand()}
          onSettings={() => setOverlay("settings")}
          onHistory={() => {
            sessionRequest.current += 1;
            setOpenedMoment(null);
            setOpenedPast(null);
            setOpenedPastTarget(null);
            setActivityReviewSessionId(null);
            if (sessionHistory !== undefined) setSessionList({ status: "idle" });
            setOverlay("history");
          }}
          onReconnect={(connector) => onReconnect?.(connector)}
          // 듣다가 바로 물은 것은 스토어의 자유 질문 갈래(kind "free")로 그대로 나갑니다.
          // 매달 답이 없으므로 교시 한 칸(`listeningAskParent`)에 모읍니다.
          onAsk={(text) => store.askTyped(listeningAskParent(store.bundle), text)}
        />
      )}
    </div>
  );
}
