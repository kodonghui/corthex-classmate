import {useEffect, useState} from 'react';
import {AnswerBody} from './AnswerBody';
import type {Bridge} from './bridge';
import type {SentMaterial as Materials} from './localLearning';

export function SentMaterial({request, studyId, answerId}: {request: NonNullable<Bridge['sentMaterial']>; studyId: string; answerId: number}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Materials>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let active = true;
    setValue(undefined);
    setError('');
    void request(studyId, answerId).then(data => {if (active) setValue(data);}).catch(error => {
      if (active) setError(error instanceof Error ? error.message : '보낸 자료를 읽지 못했어요.');
    });
    return () => { active = false; };
  }, [open, request, studyId, answerId]);
  const context = value?.referenceData;
  return <details className="sent-material" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>AI에게 보낸 것</summary>
    {open && (value && context ? <>
      <p><strong>질문</strong> {value.question}</p>
      {(context.nearby ?? context.recentLesson ?? []).map(p => <p key={p.number}><strong>전사 #{p.number}</strong> {p.text}
        {p.timingNote && <small> {p.timingNote}</small>}
      </p>)}
      {context.selectedRange?.map(p => <p key={p.uuid}><strong>선택한 범위</strong> {p.text}</p>)}
      {[...context.previous, ...(context.otherRecentQuestions ?? [])].map((q, i) => <section key={i}><strong>이전 질문 · {q.question}</strong><AnswerBody text={q.answer}/></section>)}
      {value.images.map((image, i) => <figure key={i}><figcaption>{image.label}</figcaption>
        {image.image ? <img src={image.image} alt={image.label}/> : <p>저장된 이미지를 열 수 없어요.</p>}
      </figure>)}
      {!value.images.length && <p>보낸 이미지 없음</p>}
    </> : <p role={error ? 'alert' : 'status'}>{error || '보낸 자료를 불러오는 중…'}</p>)}
  </details>;
}
