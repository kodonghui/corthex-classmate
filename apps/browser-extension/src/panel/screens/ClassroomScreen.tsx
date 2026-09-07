import { Evidence, IconButton, PanelHeader } from "@classmate/ui-base";
import { GuessList, SourceFooter, TranscriptFlow } from "@classmate/ui-classmate";
import { useEffect, useRef, useState } from "react";
import { MAX_ASK_QUESTION_BYTES, utf8ByteLength } from "../ask-text";
import { compactEvidence } from "../answer-presentation";
import { DIAGRAM_KINDS, diagramRequest } from "../diagrams";
import { useStickToBottom } from "../use-stick-to-bottom";
import { AnswerStream } from "./AnswerStream";
import { DetailScreen } from "./DetailScreen";
import { DiagramCard } from "./DiagramCard";
import type { ListeningScreenProps } from "./ListeningScreen";

const RATIO_KEY = "classmate.layout.chatRatio.v1";
const clamp = (n: number) => Math.min(0.8, Math.max(0.2, n));
function initialRatio(): number {
  try { const value = Number(localStorage.getItem(RATIO_KEY)); return value >= 0.2 && value <= 0.8 ? value : 0.4; }
  catch { return 0.4; }
}

/** 0.1.0: transcript and study conversation have independent reading positions. */
export function ClassroomScreen({ view, inlineDetails = [], activeQuestionId = null, onAskAt, onFollowUpAt,
  onTerm, onSentence, onGuess, onSettings, onHistory, onReconnect, onAsk }: ListeningScreenProps): React.JSX.Element {
  const [typed, setTyped] = useState("");
  const [target, setTarget] = useState<string | null>(activeQuestionId);
  const [diagramKind, setDiagramKind] = useState("auto");
  const [ratio, setRatio] = useState(initialRatio);
  const area = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const body = useStickToBottom<HTMLDivElement>();
  const signature = [...inlineDetails.map((d) => d.questionId), ...view.asks.map((a) => a.id)].join("|");
  const complete = [...inlineDetails.map((d) => `${d.questionId}:${d.loading}:${d.threads.filter((t) => !t.loading).length}`),
    ...view.asks.map((a) => `${a.id}:${a.loading}`)].join("|");
  const log = useStickToBottom<HTMLDivElement>({ pinOn: signature, preserveOn: complete });
  const selected = inlineDetails.find((d) => d.questionId === target);
  const choosing = view.choosing ?? (view.note.kind === "choosing" ? view.note : null);
  const quote = selected?.line?.segments.map((s) => s.text).join("");
  const left = MAX_ASK_QUESTION_BYTES - utf8ByteLength(typed);
  const ready = typed.trim().length > 0 && left >= 0;
  useEffect(() => { setTarget(activeQuestionId); }, [activeQuestionId]);
  useEffect(() => { try { localStorage.setItem(RATIO_KEY, String(ratio)); } catch { /* private storage unavailable */ } }, [ratio]);
  const ask = (text: string) => {
    if (selected && onAskAt) onAskAt(selected.questionId, text); else onAsk(text);
  };
  const send = () => { if (ready) { ask(typed); setTyped(""); } };
  const jumpTo = (id: string) => {
    setTarget(id);
    const entry = log.ref.current?.querySelector<HTMLElement>(`[data-question-id="${CSS.escape(id)}"]`);
    entry?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  const rows = [
    ...inlineDetails.map((detail, index) => ({ key: detail.questionId, time: detail.time, index, detail, ask: null })),
    ...view.asks.map((item, index) => ({ key: item.id, time: item.time, index: inlineDetails.length + index, detail: null, ask: item })),
  ].sort((a, b) => a.time.localeCompare(b.time) || a.index - b.index);
  const footerWarn = view.footer.warn;
  const { reconnect, ...warn } = footerWarn ?? {};
  return <div className="cm-screen cm-classroom">
    <PanelHeader status={view.header.status} title={view.header.title} subtitle={view.header.subtitle} time={view.header.time}
      actions={<><button className="cm-nav-records" type="button" onClick={onHistory}>기록</button><IconButton icon="settings-2" label="설정" size="sm" onClick={onSettings} /></>} />
    <div className="cm-classroom__workspace" ref={area}>
      <section className="cm-lecture" aria-label="선생님 전사">
        <header className="cm-zone-heading"><div><span className="cm-zone-number">01</span><h2>선생님 전사</h2></div>
          <span>{view.tiroPaused ? "전사 일시정지" : "문장이나 단어를 눌러 질문"}</span></header>
        {view.pinnedNow ? <p className="cm-lecture__now">{view.pinnedNow}</p> : null}
        <div className="cm-lecture__scroll" ref={body.ref}>
          {!view.lines.length ? <div className="cm-classroom__empty"><strong>수업을 기다리고 있어요</strong><p>Tiro 전사가 연결되면 이곳에 선생님 말씀이 나타나요.</p></div> : null}
          <TranscriptFlow lines={[...view.lines]} marked={[...view.marked]} showTimes
            {...(view.active === undefined ? {} : { active: view.active })}
            onTerm={(line, index, segment) => onTerm(line, index, segment.text)} onSentence={onSentence}
            renderAfter={(line) => {
              const linked = inlineDetails.filter((d) => d.line?.id === line);
              return linked.length ? <div className="cm-lecture__links">{linked.map((d) => <button type="button" key={d.questionId}
                onClick={() => jumpTo(d.questionId)}>{d.loading ? "답변 준비 중" : "대화 보기"} · {d.term} ↓</button>)}</div> : null;
            }} />
        </div>
        {body.hasNew ? <button className="cm-lecture__catch" type="button" onClick={body.toBottom}>현재 수업으로 돌아가기 ↓</button> : null}
      </section>
      <div className="cm-classroom__split" role="separator" aria-label="전사와 대화 높이 조절" aria-orientation="horizontal"
        aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(ratio * 100)} tabIndex={0}
        onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (!e.currentTarget.hasPointerCapture(e.pointerId) || !area.current) return;
          const box = area.current.getBoundingClientRect(); if (box.height > 0) setRatio(clamp((box.bottom - e.clientY) / box.height)); }}
        onPointerUp={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
        onKeyDown={(e) => { const delta = e.key === "ArrowUp" ? 0.05 : e.key === "ArrowDown" ? -0.05 : 0;
          if (delta) { e.preventDefault(); setRatio((n) => clamp(n + delta)); }
          if (e.key === "Home" || e.key === "End") { e.preventDefault(); setRatio(e.key === "Home" ? 0.2 : 0.8); } }}><span /></div>
      <section className="cm-study" aria-label="학습 대화" style={{ flexBasis: `${ratio * 100}%` }}>
        <header className="cm-zone-heading"><div><span className="cm-zone-number">02</span><h2>나의 공부 대화</h2></div>
          <div><button type="button" aria-pressed={ratio >= 0.7} onClick={() => setRatio(ratio >= 0.7 ? 0.4 : 0.7)}>{ratio >= 0.7 ? "수업도 함께" : "대화 넓게"}</button>
          <button type="button" onClick={() => { setTarget(null); input.current?.focus(); }}>새 질문</button></div></header>
        <div className="cm-study__scroll cm-chat__log" ref={log.ref}>
          {!rows.length && !choosing ? <div className="cm-classroom__empty"><strong>모르는 순간, 함께 풀어봐요</strong>
            <p>위에서 문장을 고르거나 아래에 질문하세요.<br />설명과 그림은 이곳에 차곡차곡 남아요.</p>
            <button type="button" onClick={() => onAsk("방금 내용을 처음 배우는 사람도 이해할 수 있게 설명해 주세요")}>방금 내용 쉽게 설명해 줘</button></div> : null}
          {rows.map((row) => <article className={`cm-study__thread${row.key === target ? " cm-study__thread--selected" : ""}`}
            key={row.key} data-question-id={row.key}>
            {row.detail ? <>
              <div className="cm-question"><span className="cm-question__label">내가 짚은 부분</span><time>{row.time}</time>
                <strong>{row.detail.term}</strong></div>
              {row.detail.line ? <details className="cm-source-quote"><summary>질문한 순간의 전사</summary><blockquote>{row.detail.line.segments.map((s) => s.text).join("")}</blockquote></details> : null}
              <DetailScreen inline hideComposer active={row.key === target} view={row.detail} onBack={() => {}}
                onAsk={(text) => { setTarget(row.key); onAskAt?.(row.key, text); }}
                onFollowUp={(id) => { setTarget(row.key); onFollowUpAt?.(row.key, id); }} />
              <button className="cm-context-select" type="button" onClick={() => { setTarget(row.key); input.current?.focus(); }}>이 대화에 이어 묻기</button>
            </> : row.ask ? <>
              <div className="cm-question"><span className="cm-question__label">내 질문</span><time>{row.time}</time><strong>{row.ask.question}</strong></div>
              {row.ask.loading ? <AnswerStream stream={row.ask.stream} idle="답을 만들고 있어요" />
                : row.ask.failure ? <div role="status" className="cm-reply__wait">{row.ask.failure}<button type="button" onClick={() => onAsk(row.ask!.question)}>다시 질문</button></div>
                : <div className="cm-study__answer"><strong className="cm-study__conclusion">{row.ask.conclusion}</strong>
                  <div className="cm-study__evidence">{compactEvidence(row.ask.evidence).map((e, i) => <Evidence key={i} {...e} />)}</div>
                  <div className="cm-reply__body">{row.ask.body}</div>
                  {row.ask.diagram ? <DiagramCard diagram={row.ask.diagram} /> : null}
                  <button className="cm-draw-request" type="button" onClick={() => onAsk(`앞선 설명 '${row.ask!.conclusion}'에 대해 ${diagramRequest()}`)}>그림으로 이해하기</button>
                  <div className="cm-study__suggestions">{["더 쉽게", "예시로", "왜 필요한가요?"].map((label, i) =>
                    <button type="button" key={label} onClick={() => { setTarget(null); onAsk(`앞선 질문 '${row.ask!.question}'의 설명 '${row.ask!.conclusion}'에 대해 ${["더 쉽게 설명해 주세요", "구체적인 예를 들어 주세요", "왜 필요한지 설명해 주세요"][i]!}`); }}>{label}</button>)}</div>
                </div>}
            </> : null}
          </article>)}
          {choosing ? <div className="cm-study__choosing"><strong>이 문장에서 어떤 부분이 궁금한가요?</strong>
            <blockquote>{view.lines.find((l) => l.id === choosing.lineId)?.segments.map((s) => s.text).join("")}</blockquote>
            <GuessList options={[...choosing.options]} {...(choosing.value === undefined ? {} : { value: choosing.value })} onChange={onGuess} /></div> : null}
        </div>
        <div className="cm-study__composer">
          {log.hasNew ? <button className="cm-chat__catch" type="button" onClick={log.toBottom}>새 답변으로 이동 ↓</button> : null}
          <div className="cm-composer-context"><span>{selected ? `이어서 질문 · ${selected.term}` : "새 질문 · 최근 수업 맥락"}</span>
            {selected ? <button type="button" aria-label="이 대화 선택 해제" onClick={() => setTarget(null)}>해제</button> : null}</div>
          {quote ? <div className="cm-composer-quote" title={quote}>{quote}</div> : null}
          <div className="cm-composer-field"><textarea ref={input} value={typed} rows={2} aria-label="바로 묻기" aria-invalid={left < 0}
            placeholder={selected ? "이 설명에서 더 궁금한 점을 적어 주세요" : "지금 궁금한 걸 적어 주세요"}
            onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) { e.preventDefault(); send(); }
            }} /><IconButton icon="arrow-up" label="보내기" disabled={!ready} onClick={send} /></div>
          <div className="cm-composer-tools"><label><span className="cm-sr-only">요청할 그림 종류</span><select aria-label="그림 종류" value={diagramKind} onChange={(e) => setDiagramKind(e.target.value)}>
            <option value="auto">그림 · AI가 선택</option>{DIAGRAM_KINDS.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}</select></label>
            <button type="button" onClick={() => { setTyped((value) => `${value}${value.trim() ? "\n" : ""}${diagramRequest(diagramKind)}`); input.current?.focus(); }}>그림 요청</button>
            <span>Enter 전송 · Shift+Enter 줄바꿈</span></div>
          {left < 200 ? <p className="cm-composer-limit" role="status">{left >= 0 ? `${left}바이트 남았어요` : "질문이 길어요. 내용을 나눠서 보내 주세요."}</p> : null}
        </div>
      </section>
    </div>
    <SourceFooter sources={[...view.footer.sources]} count={view.footer.count} onCount={onHistory}
      {...(footerWarn === null ? {} : { warn: { ...warn, ...(reconnect === undefined ? {} : { onAction: () => onReconnect(reconnect) }) } as NonNullable<React.ComponentProps<typeof SourceFooter>["warn"]> })} />
  </div>;
}
