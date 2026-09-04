import { PanelHeader } from '@classmate/ui-base';
import {
  beginAttempt,
  openNextHint,
  revealAttemptAnswer,
  submitAttempt,
  type ActivityCard,
  type ActivitySetV2,
  type PendingActivityAttempt,
} from '@classmate/learning-engine';
import { useEffect, useRef, useState } from 'react';

export type ActivitySaveOutcome =
  | { readonly status: 'ok'; readonly value: ActivitySetV2 }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'stale' };

export interface ActivityScreenProps {
  readonly title: string;
  readonly activities: ActivitySetV2;
  readonly onBack: () => void;
  readonly onSave: (activities: ActivitySetV2) => Promise<ActivitySaveOutcome>;
  /** 테스트가 시도 시각을 고정할 수 있게 둔 좁은 주입점입니다. */
  readonly now?: () => string;
}

interface AttemptDraft {
  readonly cardId: string;
  readonly pending: PendingActivityAttempt;
  readonly response: string;
  readonly confidence: number;
}

const SLOT_COPY = {
  RECALL: { step: '1', label: '떠올리기', description: '자료를 가리고 먼저 기억에서 꺼냅니다.' },
  EXPLAIN: { step: '2', label: '설명하기', description: '원인과 조건을 자기 말로 연결합니다.' },
  INSPECT: { step: '3', label: '살펴보기', description: '헷갈리는 경계와 빈칸을 직접 찾습니다.' },
  APPLY: { step: '4', label: '적용하기', description: '같은 구조를 작은 예에 적용합니다.' },
  TRANSFER: { step: '5', label: '바꿔보기', description: '조건을 바꾼 새 상황으로 옮겨 봅니다.' },
} as const;

function defaultNow(): string {
  return new Date().toISOString();
}

function startedAtFor(card: ActivityCard, now: () => string): string {
  const candidate = now();
  const previous = card.attempts.at(-1)?.submittedAt;
  if (previous !== undefined && Date.parse(candidate) < Date.parse(previous)) return previous;
  return candidate;
}

function newDraft(card: ActivityCard, now: () => string): AttemptDraft {
  return {
    cardId: card.id,
    pending: beginAttempt(card, startedAtFor(card, now)),
    response: '',
    confidence: 3,
  };
}

function replaceActivity(
  activities: ActivitySetV2,
  index: number,
  card: ActivityCard,
): ActivitySetV2 {
  const previous = activities[index];
  if (previous === undefined || previous.id !== card.id || previous.slot !== card.slot) {
    throw new Error('현재 활동과 저장하려는 활동이 일치하지 않습니다.');
  }
  const next = [...activities];
  next[index] = card;
  return next as ActivitySetV2;
}

export function ActivityScreen({
  title,
  activities,
  onBack,
  onSave,
  now = defaultNow,
}: ActivityScreenProps): React.JSX.Element {
  const [savedActivities, setSavedActivities] = useState<ActivitySetV2 | null>(null);
  const cards = savedActivities ?? activities;
  const firstIncomplete = cards.findIndex((card) => card.attempts.at(-1)?.revealedAt === undefined);
  const [index, setIndex] = useState(firstIncomplete < 0 ? 0 : firstIncomplete);
  const card = cards[index]!;
  const [draft, setDraft] = useState<AttemptDraft>(() => newDraft(card, now));
  const [retaking, setRetaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const saveInFlight = useRef(false);
  const cardTitle = useRef<HTMLHeadingElement>(null);
  const answerTitle = useRef<HTMLHeadingElement>(null);
  const focusCardAfterMove = useRef(false);
  const focusAnswerAfterSave = useRef(false);

  useEffect(
    () => () => {
      requestGeneration.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!focusCardAfterMove.current) return;
    focusCardAfterMove.current = false;
    cardTitle.current?.focus();
  }, [index]);

  useEffect(() => {
    if (!focusAnswerAfterSave.current) return;
    focusAnswerAfterSave.current = false;
    answerTitle.current?.focus();
  }, [savedActivities]);

  const latest = card.attempts.at(-1);
  const revealed = latest?.revealedAt !== undefined && !retaking;
  const copy = SLOT_COPY[card.slot];

  const moveTo = (nextIndex: number): void => {
    if (saving || nextIndex < 0 || nextIndex >= cards.length) return;
    requestGeneration.current += 1;
    const nextCard = cards[nextIndex]!;
    focusCardAfterMove.current = true;
    setIndex(nextIndex);
    setDraft(newDraft(nextCard, now));
    setRetaking(false);
    setError(null);
  };

  const openHint = (): void => {
    if (saving || revealed) return;
    try {
      setDraft((current) => ({
        ...current,
        pending: openNextHint(card, current.pending),
      }));
      setError(null);
    } catch {
      setError('더 열 수 있는 힌트가 없습니다.');
    }
  };

  const submit = async (): Promise<void> => {
    if (saveInFlight.current || saving || revealed) return;
    const request = requestGeneration.current + 1;
    requestGeneration.current = request;
    setError(null);

    let candidate: ActivitySetV2;
    try {
      const submittedAt = startedAtFor(card, now);
      const submitted = submitAttempt(card, draft.pending, {
        response: draft.response,
        confidence: draft.confidence,
        submittedAt,
      });
      const revealedCard = revealAttemptAnswer(
        submitted,
        draft.pending.id,
        startedAtFor(submitted, now),
      );
      candidate = replaceActivity(cards, index, revealedCard);
    } catch {
      setError('답을 적고 확신도를 고른 뒤 다시 제출해 주세요.');
      return;
    }

    // candidate에는 모범 답 공개 시각이 들어 있습니다. 이 값은 저장 ACK 전에는 React state에
    // 넣지 않습니다. 실패하면 아래 지역 변수와 함께 사라지고, 작성 중인 draft는 그대로 남습니다.
    saveInFlight.current = true;
    setSaving(true);
    try {
      const result = await onSave(candidate);
      if (requestGeneration.current !== request) return;
      if (result.status === 'stale') {
        saveInFlight.current = false;
        setSaving(false);
        return;
      }
      if (result.status === 'error') {
        saveInFlight.current = false;
        setError(result.message);
        setSaving(false);
        return;
      }
      focusAnswerAfterSave.current = true;
      setSavedActivities(result.value);
      setRetaking(false);
      saveInFlight.current = false;
      setSaving(false);
    } catch {
      if (requestGeneration.current !== request) return;
      saveInFlight.current = false;
      setError('복습 기록을 로컬에 저장하지 못했어요. 작성한 답은 남겨 두었습니다.');
      setSaving(false);
    }
  };

  return (
    <div className="cm-screen">
      <PanelHeader
        onBack={() => {
          if (saving) return;
          requestGeneration.current += 1;
          onBack();
        }}
        strong
        title={`${copy.step}/5 · ${copy.label}`}
        subtitle={title}
      />
      <div className="cm-screen__body cm-activity">
        <ol className="cm-activity__steps" aria-label="5단계 복습 진행">
          {cards.map((item, stepIndex) => {
            const complete = item.attempts.at(-1)?.revealedAt !== undefined;
            return (
              <li
                key={item.slot}
                aria-current={stepIndex === index ? 'step' : undefined}
                data-complete={complete ? 'true' : 'false'}
              >
                <span aria-hidden="true">{stepIndex + 1}</span>
                <span className="cm-sr-only">{SLOT_COPY[item.slot].label}</span>
              </li>
            );
          })}
        </ol>

        <section className="cm-activity__card" aria-labelledby="cm-activity-title">
          <div className="cm-activity__eyebrow">
            <span>{card.kind === 'simulation' ? '상황 연습' : card.kind === 'worked-example' ? '예제 연습' : '질문'}</span>
            <span>{card.slot}</span>
          </div>
          <h2 id="cm-activity-title" ref={cardTitle} tabIndex={-1}>{copy.label}</h2>
          <p className="cm-activity__description">{copy.description}</p>
          <p className="cm-activity__prompt">{card.prompt}</p>
          {card.variation === undefined ? null : (
            <p className="cm-activity__variation"><strong>한 번 더 생각하기</strong>{card.variation}</p>
          )}
        </section>

        {revealed && latest !== undefined ? (
          <section className="cm-activity__result" aria-live="polite">
            <h2>저장된 시도</h2>
            <dl>
              <div><dt>내 답</dt><dd>{latest.response}</dd></div>
              <div><dt>확신도</dt><dd>{latest.confidence}/5</dd></div>
              <div><dt>사용한 힌트</dt><dd>{latest.hintLevel}단계</dd></div>
            </dl>
            {latest.hintLevel > 0 ? (
              <div className="cm-activity__used-hints">
                <h3>내가 본 힌트</h3>
                <ol>
                  {card.hints.slice(0, latest.hintLevel).map((hint, hintIndex) => (
                    <li key={`used-hint-${hintIndex}`}>{hint}</li>
                  ))}
                </ol>
              </div>
            ) : null}
            <div className="cm-activity__answer">
              <h3 ref={answerTitle} tabIndex={-1}>근거로 확인하기</h3>
              <p>{card.answer}</p>
            </div>
            <p className="cm-activity__next-stage">
              <strong>다음 단계</strong>
              자기 수정 · 근거 기반 피드백 · 다음 복습 시각은 후속 기능에서 이 자리에 저장됩니다.
            </p>
            <button
              className="cm-activity__secondary"
              type="button"
              disabled={saving}
              onClick={() => {
                requestGeneration.current += 1;
                setDraft(newDraft(card, now));
                setRetaking(true);
                setError(null);
              }}
            >
              다시 풀기
            </button>
          </section>
        ) : (
          <section
            className="cm-activity__attempt"
            aria-busy={saving}
            aria-label={`${copy.label} 답 작성`}
          >
            {saving ? <p className="cm-sr-only" role="status">복습 기록을 로컬에 저장하는 중입니다.</p> : null}
            {draft.pending.hintLevel > 0 ? (
              <div className="cm-activity__hints" aria-live="polite">
                <h2>열어 본 힌트</h2>
                <ol>
                  {card.hints.slice(0, draft.pending.hintLevel).map((hint, hintIndex) => (
                    <li key={`hint-${hintIndex}`}>{hint}</li>
                  ))}
                </ol>
              </div>
            ) : null}
            <button
              className="cm-activity__hint"
              type="button"
              aria-expanded={draft.pending.hintLevel > 0}
              disabled={saving || draft.pending.hintLevel >= card.hints.length}
              onClick={openHint}
            >
              {draft.pending.hintLevel >= card.hints.length
                ? '힌트를 모두 봤어요'
                : `힌트 ${draft.pending.hintLevel + 1}단계 열기`}
            </button>

            <label className="cm-activity__label" htmlFor={`activity-response-${card.slot}`}>내 답</label>
            <textarea
              id={`activity-response-${card.slot}`}
              aria-describedby={error === null ? undefined : `activity-error-${card.slot}`}
              value={draft.response}
              disabled={saving}
              rows={6}
              placeholder="자료를 보지 말고 먼저 내 말로 적어 보세요."
              onChange={(event) => setDraft((current) => ({ ...current, response: event.target.value }))}
            />

            <fieldset className="cm-activity__confidence" disabled={saving}>
              <legend>지금 답에 얼마나 확신하나요?</legend>
              <div>
                {[1, 2, 3, 4, 5].map((value) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name={`confidence-${card.id}`}
                      value={value}
                      checked={draft.confidence === value}
                      onChange={() => setDraft((current) => ({ ...current, confidence: value }))}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {error === null ? null : (
              <p id={`activity-error-${card.slot}`} className="cm-activity__error" role="alert">{error}</p>
            )}
            <button
              className="cm-activity__primary"
              type="button"
              disabled={saving || draft.response.trim().length === 0}
              onClick={() => void submit()}
            >
              {saving ? '로컬에 저장하는 중…' : '내 답 저장하고 근거 보기'}
            </button>
          </section>
        )}

        <nav className="cm-activity__nav" aria-label="복습 단계 이동">
          <button type="button" disabled={saving || index === 0} onClick={() => moveTo(index - 1)}>이전 단계</button>
          <span>{index + 1} / 5</span>
          <button type="button" disabled={saving || index === cards.length - 1} onClick={() => moveTo(index + 1)}>다음 단계</button>
        </nav>
      </div>
    </div>
  );
}
