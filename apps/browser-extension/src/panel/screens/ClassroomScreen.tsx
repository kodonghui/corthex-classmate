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

/** Questions stay below their sealed transcript paragraph; records are never moved or deleted. */
export function ClassroomScreen({ view, inlineDetails = [], activeQuestionId = null, onAskAt, onFollowUpAt,
  onTerm, onSentence, onGuess, onSettings, onHistory, onReconnect, onAsk }: ListeningScreenProps): React.JSX.Element {
  const [typed, setTyped] = useState("");
  const [target, setTarget] = useState<string | null>(activeQuestionId);
  const [diagramKind, setDiagramKind] = useState("auto");
  const input = useRef<HTMLTextAreaElement>(null);
  const complete = [...inlineDetails.map((d) => `${d.questionId}:${d.loading}:${d.threads.filter((t) => !t.loading).length}`),
    ...view.asks.map((a) => `${a.id}:${a.loading}`)].join("|");
  const body = useStickToBottom<HTMLDivElement>({ preserveOn: complete });
  const selected = inlineDetails.find((d) => d.questionId === target);
  const choosing = view.choosing ?? (view.note.kind === "choosing" ? view.note : null);
  const quote = selected?.line?.segments.map((s) => s.text).join("");
  const left = MAX_ASK_QUESTION_BYTES - utf8ByteLength(typed);
  const ready = typed.trim().length > 0 && left >= 0;
  useEffect(() => { setTarget(activeQuestionId); }, [activeQuestionId]);
  const ask = (text: string) => {
    if (selected && onAskAt) onAskAt(selected.questionId, text); else onAsk(text);
  };
  const send = () => { if (ready) { ask(typed); setTyped(""); } };
  const rows = [
    ...inlineDetails.map((detail, index) => ({ key: detail.questionId, time: detail.time, index, detail, ask: null })),
    ...view.asks.map((item, index) => ({ key: item.id, time: item.time, index: inlineDetails.length + index, detail: null, ask: item })),
  ].sort((a, b) => a.time.localeCompare(b.time) || a.index - b.index);
  const visible = new Set(view.lines.map((line) => line.id));
  const anchorOf = (row: (typeof rows)[number]) => row.detail?.line?.id
    ?? [...(row.ask?.sourceLineIds ?? [])].reverse().find((id) => visible.has(id));
  const unplaced = rows.filter((row) => !visible.has(anchorOf(row) ?? ""));
  const renderRow = (row: (typeof rows)[number]) => <article className={`cm-study__thread${row.key === target ? " cm-study__thread--selected" : ""}`}
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
          </article>;
  const footerWarn = view.footer.warn;
  const { reconnect, ...warn } = footerWarn ?? {};
  return <div className="cm-screen cm-classroom cm-classroom--inline">
    <PanelHeader status={view.header.status} title={view.header.title} subtitle={view.header.subtitle} time={view.header.time}
      actions={<><button className="cm-nav-records" type="button" onClick={onHistory}>기록</button><IconButton icon="settings-2" label="설정" size="sm" onClick={onSettings} /></>} />
    <div className="cm-classroom__workspace">
      <section className="cm-lecture" aria-label="선생님 전사와 질문 답변">
        <header className="cm-zone-heading"><div><span className="cm-zone-number">01</span><h2>수업 · 질문과 함께 읽기</h2></div>
          <span>{view.tiroPaused ? "전사 일시정지" : "문장이나 단어를 눌러 질문"}</span></header>
        {view.pinnedNow ? <p className="cm-lecture__now">{view.pinnedNow}</p> : null}
        <div className="cm-lecture__scroll" ref={body.ref}>
          {!view.lines.length ? <div className="cm-classroom__empty"><strong>수업을 기다리고 있어요</strong><p>Tiro 전사가 연결되면 이곳에 선생님 말씀이 나타나요.</p></div> : null}
          <TranscriptFlow lines={[...view.lines]} marked={[...view.marked]} showTimes
            {...(view.active === undefined ? {} : { active: view.active })}
            onTerm={(line, index, segment) => onTerm(line, index, segment.text)} onSentence={onSentence}
            renderAfter={(line) => {
              const linked = rows.filter((row) => anchorOf(row) === line);
              return linked.length ? <div className="cm-inline-conversation" data-source-line-id={line}
                aria-label="이 문장에 대한 질문과 답변">{linked.map(renderRow)}</div> : null;
            }} />
          {unplaced.length ? <section className="cm-inline-unplaced" aria-label="이전 자료에 대한 질문">
            <h3>이전 자료에 대한 질문</h3><p>해당 전사가 현재 화면에 없어도 질문과 답변은 남아 있어요.</p>
            {unplaced.map(renderRow)}</section> : null}
          {choosing ? <div className="cm-study__choosing"><strong>이 문장에서 어떤 부분이 궁금한가요?</strong>
            <blockquote>{view.lines.find((l) => l.id === choosing.lineId)?.segments.map((s) => s.text).join("")}</blockquote>
            <GuessList options={[...choosing.options]} {...(choosing.value === undefined ? {} : { value: choosing.value })} onChange={onGuess} /></div> : null}
        </div>
        {body.hasNew ? <button className="cm-lecture__catch" type="button" onClick={body.toBottom}>새 수업 · 답변으로 이동 ↓</button> : null}
      </section>
      <section className="cm-study cm-study--composer" aria-label="질문 작성">
        <div className="cm-study__composer">
          <div className="cm-composer-context"><span>{selected ? `이어서 질문 · ${selected.term}` : "새 질문 · 최근 수업 맥락"}</span>
            <button type="button" onClick={() => { setTarget(null); input.current?.focus(); }}>새 질문</button></div>
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
