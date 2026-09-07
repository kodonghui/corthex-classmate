import { IconButton } from "@classmate/ui-base";
import { useRef, useState } from "react";
import { MAX_ASK_QUESTION_BYTES, utf8ByteLength } from "../ask-text";
import { DIAGRAM_KINDS, diagramRequest } from "../diagrams";

/** Draft ownership stays with the classroom, including when a selection is closed. */
export function QuestionComposer({ value, onChange, onSend, onCancel, label }: {
  value: string; onChange: (text: string) => void; onSend: (text: string) => void;
  onCancel?: () => void; label: string;
}): React.JSX.Element {
  const input = useRef<HTMLTextAreaElement>(null);
  const [kind, setKind] = useState("auto");
  const left = MAX_ASK_QUESTION_BYTES - utf8ByteLength(value);
  const ready = value.trim().length > 0 && left >= 0;
  const send = () => { if (ready) { onSend(value); onChange(""); } };
  return <div className="cm-study__composer" onKeyDown={(event) => {
    if (event.key === "Escape" && !event.nativeEvent.isComposing && onCancel) {
      event.preventDefault(); event.stopPropagation(); onCancel();
    }
  }}>
    <div className="cm-composer-context"><strong>{label}</strong>
      {onCancel ? <button type="button" onClick={onCancel}>취소 · Esc</button> : null}</div>
    <div className="cm-composer-field"><textarea ref={input} value={value} rows={2} aria-label={label}
      aria-invalid={left < 0} placeholder={label === "바로 묻기" ? "지금 궁금한 걸 적어 주세요" : "궁금한 점을 적어 주세요"}
      onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
          e.preventDefault(); send();
        }
      }} /><IconButton icon="arrow-up" label="보내기" disabled={!ready} onClick={send} /></div>
    <div className="cm-composer-tools"><label><span className="cm-sr-only">요청할 그림 종류</span>
      <select aria-label="그림 종류" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="auto">그림 · AI가 선택</option>{DIAGRAM_KINDS.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
      </select></label><button type="button" onClick={() => {
        onChange(`${value}${value.trim() ? "\n" : ""}${diagramRequest(kind)}`); input.current?.focus({ preventScroll: true });
      }}>그림 요청</button><span>Enter 전송 · Shift+Enter 줄바꿈</span></div>
    {left < 200 ? <p className="cm-composer-limit" role="status">{left >= 0 ? `${left}바이트 남았어요` : "질문이 길어요. 내용을 나눠서 보내 주세요."}</p> : null}
  </div>;
}
