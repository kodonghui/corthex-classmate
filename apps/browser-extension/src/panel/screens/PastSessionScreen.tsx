import { PanelHeader } from '@classmate/ui-base';

import type { SessionBundleV2 } from '../../session-history/types';
import { isReviewableActivitySetV2 } from '../activity-review';
import type { PastSessionDetailView } from '../../session-history/view';

export type ReviewPreparationState =
  | { readonly status: 'idle' }
  | { readonly status: 'saving' }
  | { readonly status: 'error'; readonly message: string };

export type PastSessionScreenState =
  | { readonly status: 'loading'; readonly title: string }
  | { readonly status: 'error'; readonly title: string; readonly message: string }
  | {
      readonly status: 'ready';
      readonly view: PastSessionDetailView;
      readonly bundle: SessionBundleV2;
      readonly review: ReviewPreparationState;
    };

export interface PastSessionScreenProps {
  readonly state: PastSessionScreenState;
  readonly onBack: () => void;
  readonly onRetry: () => void;
  readonly onStartReview: () => void;
}

const REVIEW_STEPS = ['떠올리기', '설명하기', '살펴보기', '적용하기', '바꿔보기'] as const;

export function PastSessionScreen({
  state,
  onBack,
  onRetry,
  onStartReview,
}: PastSessionScreenProps): React.JSX.Element {
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

  const { view, bundle, review } = state;
  const completeSet = isReviewableActivitySetV2(bundle.activities);
  const completed = completeSet
    ? bundle.activities.filter((card) => card.attempts.at(-1)?.revealedAt !== undefined).length
    : 0;
  const malformed = bundle.activities.length > 0 && !completeSet;
  return (
    <div className="cm-screen">
      <PanelHeader onBack={onBack} strong title={view.title} subtitle={view.subtitle} />
      <div className="cm-screen__body cm-session-detail">
        <section
          className="cm-session-review"
          aria-busy={review.status === 'saving'}
          aria-labelledby="cm-session-review-title"
        >
          <div className="cm-session-review__heading">
            <div>
              <h2 id="cm-session-review-title">5단계 복습</h2>
              <p>{completeSet ? `${completed}/5 단계 저장됨` : '아직 만들지 않았어요'}</p>
            </div>
            <span>{completeSet ? `${completed}/5` : '준비 전'}</span>
          </div>
          <ol aria-label="5단계 복습 상태">
            {REVIEW_STEPS.map((label, index) => (
              <li
                key={label}
                data-complete={
                  completeSet && bundle.activities[index]?.attempts.at(-1)?.revealedAt !== undefined
                    ? 'true'
                    : 'false'
                }
              >
                <span aria-hidden="true">{index + 1}</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          {malformed ? (
            <p className="cm-session-review__error" role="alert">
              복습 준비가 아직 끝나지 않아 열 수 없어요. 로컬 기록을 다시 불러와 주세요.
            </p>
          ) : (
            <button
              type="button"
              disabled={review.status === 'saving'}
              onClick={onStartReview}
            >
              {review.status === 'saving'
                ? '복습을 로컬에 저장하는 중…'
                : completeSet
                  ? completed === 0
                    ? '복습 시작'
                    : completed === 5
                      ? '복습 다시 보기'
                      : '복습 이어하기'
                  : '5단계 복습 만들기'}
            </button>
          )}
          {review.status === 'error' ? (
            <p className="cm-session-review__error" role="alert">{review.message}</p>
          ) : null}
        </section>
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
