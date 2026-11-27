import {useState} from 'react';
import {AnswerBody} from './AnswerBody';
import type {Bridge} from './bridge';
import {type Cards, type Confidence} from './localLearning';

const certainty = {unknown: '모름', some: '조금', sure: '확실'};
const errorText = (error: unknown) => error instanceof Error ? error.message : '다시 시도해 주세요.';

function Certainty({label, value, onChange}: {label: string; value?: Confidence; onChange: (v: Confidence) => void}) {
  return <label>{label} 확신도
    <select value={value ?? ''} onChange={event => onChange(event.target.value as Confidence)}>
      <option value="" disabled>확신도 고르기</option>
      {Object.entries(certainty).map(([id, text]) => <option key={id} value={id}>{text}</option>)}
    </select>
  </label>;
}

export function CardsPanel({request, initial, onClose}: {request: NonNullable<Bridge['cards']>; initial: Cards; onClose: () => void}) {
  const [state, setState] = useState(initial);
  const [text, setText] = useState('');
  const [confidence, setConfidence] = useState<Confidence>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const card = state.card;
  async function act(action: string, data?: object) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await request(action, {id: card?.id, ...data});
      if (action === 'close') {onClose(); return;}
      setState(next);
      if (action === 'grade') {setText(''); setConfidence(undefined);}
    } catch (error) {setError(errorText(error));}
    finally {setBusy(false);}
  }
  return <section className="learning-panel" aria-label="오늘의 카드">
    <header><h1>오늘의 카드</h1><button disabled={busy} onClick={() => void act('close')}>수업으로 돌아가기</button></header>
    {state.nextDue && <p role="status">방금 푼 카드의 다음 확인 날짜 · {state.nextDue}</p>}
    {card ? <article className="learning-fields">
      <p>남은 카드 {state.count}장</p>
      <h2>{card.front}</h2>
      {card.response ? <>
        <p>내 답 · {card.response.text}</p>
        <h3>카드 답</h3><AnswerBody text={card.back ?? ''}/>
        {card.paragraph && <details><summary>수업 문장 보기</summary><p>{card.paragraph.text}</p>
          {card.answer && <><strong>{card.answer.question}</strong><AnswerBody text={card.answer.answer}/></>}
        </details>}
        <div className="actions">
          <button disabled={busy} onClick={() => void act('grade', {result: 'right'})}>맞음</button>
          <button disabled={busy} onClick={() => void act('grade', {result: 'wrong'})}>틀림</button>
        </div>
      </> : <>
        <label>내 답<textarea rows={4} maxLength={4000} value={text} onChange={event => setText(event.target.value)}/></label>
        <Certainty label="카드" value={confidence} onChange={setConfidence}/>
        <button disabled={busy || !text.trim() || !confidence} className="primary" onClick={() => void act('answer', {text, confidence})}>답과 확신도 제출</button>
      </>}
    </article> : <p>오늘 풀 카드를 모두 마쳤어요.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
