// 기록 화면(디자인 상태 G) — 오늘 붙잡은 순간이 교시별로 쌓입니다. 줄만 있고 카드도 화살표도 없습니다.
// 정본: design-system/ui_kits/sidepanel/HistoryScreen.jsx · Classmate Side Panel.dc.html:78-99.
// 값은 전부 history-view 가 만들어 줍니다.

import { PanelHeader } from "@classmate/ui-base";
import { MomentRow, SourceFooter } from "@classmate/ui-classmate";

import type { HistoryView } from "../history-view";
import type { SessionLibraryView } from "../../session-history/view";

export interface HistoryScreenProps {
  readonly view: HistoryView;
  readonly onBack: () => void;
  /** 줄을 누르면 그 순간의 자세히 화면으로 갑니다. */
  readonly onOpen: (questionId: string) => void;
  /** 라이브 모드에서 Native Host가 읽은 과거 세션들입니다. fixture에서는 넣지 않습니다. */
  readonly library?: SessionLibraryView;
  readonly onOpenSession?: (sessionId: string, title: string) => void;
  readonly onReloadSessions?: () => void;
}

export function HistoryScreen({
  view,
  onBack,
  onOpen,
  library,
  onOpenSession,
  onReloadSessions,
}: HistoryScreenProps): React.JSX.Element {
  const subtitle = library?.status === "ready" ? `${view.subtitle} · 지난 ${library.rows.length}개` : view.subtitle;
  return (
    <div className="cm-screen">
      <PanelHeader onBack={onBack} strong title={view.title} subtitle={subtitle} />
      <div className="cm-screen__body cm-screen__body--flush">
        {view.groups.map((group) => (
          <section key={group.period} className="cm-group">
            <div className="cm-group__label">{group.period}</div>
            {group.rows.length === 0 ? (
              <p className="cm-group__empty">{view.emptyText}</p>
            ) : (
              <div className="cm-rows">
                {group.rows.map((row) => (
                  <MomentRow
                    key={row.questionId}
                    time={row.time}
                    term={row.term}
                    {...(row.title === null ? {} : { title: row.title })}
                    state={row.state}
                    onClick={() => onOpen(row.questionId)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
        {library === undefined ? null : (
          <section className="cm-group cm-session-library" aria-label="지난 세션">
            <div className="cm-group__label">지난 세션</div>
            {library.status === "loading" ? (
              <p className="cm-group__empty" role="status">로컬 기록을 불러오는 중이에요.</p>
            ) : library.status === "error" ? (
              <div className="cm-session-library__notice" role="alert">
                <p>{library.message}</p>
                <button type="button" onClick={onReloadSessions}>다시 불러오기</button>
              </div>
            ) : library.rows.length === 0 ? (
              <p className="cm-group__empty">아직 끝난 과거 세션이 없어요.</p>
            ) : (
              <div className="cm-session-rows">
                {library.rows.map((session) => (
                  <button
                    key={session.sessionId}
                    type="button"
                    className="cm-session-row"
                    onClick={() => onOpenSession?.(session.sessionId, session.title)}
                  >
                    <span className="cm-session-row__top">
                      <span className="cm-session-row__title">{session.title}</span>
                      <span className="cm-session-row__date">{session.date}</span>
                    </span>
                    <span className="cm-session-row__meta">
                      {session.current ? "현재 세션 저장본 · " : ""}{session.profile} · {session.counts}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        <p className="cm-foot-note">{view.footNote}</p>
      </div>
      <SourceFooter sources={[...view.sources]} />
    </div>
  );
}
