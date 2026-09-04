import { PanelHeader } from '@classmate/ui-base';

import type { PastSessionDetailView } from '../../session-history/view';

export type PastSessionScreenState =
  | { readonly status: 'loading'; readonly title: string }
  | { readonly status: 'error'; readonly title: string; readonly message: string }
  | { readonly status: 'ready'; readonly view: PastSessionDetailView };

export interface PastSessionScreenProps {
  readonly state: PastSessionScreenState;
  readonly onBack: () => void;
  readonly onRetry: () => void;
}

export function PastSessionScreen({ state, onBack, onRetry }: PastSessionScreenProps): React.JSX.Element {
  if (state.status === 'loading') {
    return (
      <div className="cm-screen">
        <PanelHeader onBack={onBack} strong title={state.title} subtitle="로컬 기록을 읽는 중" />
        <div className="cm-screen__body">
          <p className="cm-empty" role="status">세션의 전사·질문·답변을 불러오고 있어요.</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="cm-screen">
        <PanelHeader onBack={onBack} strong title={state.title} subtitle="기록을 열지 못했어요" />
        <div className="cm-screen__body">
          <div className="cm-session-detail__error" role="alert">
            <p>{state.message}</p>
            <button type="button" onClick={onRetry}>다시 시도</button>
          </div>
        </div>
      </div>
    );
  }

  const { view } = state;
  return (
    <div className="cm-screen">
      <PanelHeader onBack={onBack} strong title={view.title} subtitle={view.subtitle} />
      <div className="cm-screen__body cm-session-detail">
        <p className="cm-session-detail__counts">{view.counts}</p>
        {view.warnings.map((warning, index) => (
          <p key={`warning-${index}`} className="cm-session-detail__warning">{warning}</p>
        ))}
        {view.moments.length === 0 ? (
          <p className="cm-empty">이전 기록에 표시할 근거 순간이 없어요.</p>
        ) : (
          <ol className="cm-session-timeline" aria-label="세션 시간순 기록">
            {view.moments.map((moment, momentIndex) => (
              <li key={`moment-${momentIndex}`} className="cm-session-moment" data-moment-type={moment.type}>
                <div className="cm-session-moment__meta">
                  <span>{moment.time}</span>
                  <span>{moment.label}</span>
                </div>
                <p className="cm-session-moment__body">{moment.body}</p>
                {moment.sections.map((section, sectionIndex) => (
                  <section key={`section-${momentIndex}-${sectionIndex}`} className="cm-session-moment__section">
                    <h3>{section.title}</h3>
                    <p>{section.content}</p>
                  </section>
                ))}
                {moment.provider === null ? null : (
                  <p className="cm-session-moment__provider">답변 제공 · {moment.provider}</p>
                )}
                <p className="cm-session-moment__evidence">{moment.evidence}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
