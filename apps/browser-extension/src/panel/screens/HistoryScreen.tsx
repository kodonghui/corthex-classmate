// 기록 화면(디자인 상태 G) — 오늘 붙잡은 순간이 교시별로 쌓입니다. 줄만 있고 카드도 화살표도 없습니다.
// 정본: design-system/ui_kits/sidepanel/HistoryScreen.jsx · Classmate Side Panel.dc.html:78-99.
// 값은 전부 history-view 가 만들어 줍니다.

import { PanelHeader } from "@classmate/ui-base";
import { MomentRow, SourceFooter } from "@classmate/ui-classmate";

import type { HistoryView } from "../history-view";

export interface HistoryScreenProps {
  readonly view: HistoryView;
  readonly onBack: () => void;
  /** 줄을 누르면 그 순간의 자세히 화면으로 갑니다. */
  readonly onOpen: (questionId: string) => void;
}

export function HistoryScreen({ view, onBack, onOpen }: HistoryScreenProps): React.JSX.Element {
  return (
    <div className="cm-screen">
      <PanelHeader onBack={onBack} strong title={view.title} subtitle={view.subtitle} />
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
        <p className="cm-foot-note">{view.footNote}</p>
      </div>
      <SourceFooter sources={[...view.sources]} />
    </div>
  );
}
