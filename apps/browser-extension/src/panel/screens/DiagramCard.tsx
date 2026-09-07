import type { AnswerDiagram } from "@classmate/contracts";
import DOMPurify from "dompurify";
import { useEffect, useId, useRef, useState } from "react";
import { DIAGRAM_KINDS, diagramSource, validDiagram } from "../diagrams";

let renderer: Promise<typeof import("mermaid")["default"]> | undefined;
function getRenderer() {
  renderer ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", suppressErrorRendering: true,
      maxTextSize: 50000, maxEdges: 24, theme: "base", htmlLabels: false,
      themeVariables: { fontFamily: "system-ui, sans-serif", fontSize: "16px", primaryColor: "#ecf5f2",
        primaryTextColor: "#163d37", primaryBorderColor: "#8eb9ad", lineColor: "#526e68", secondaryColor: "#f4f0e8" },
      flowchart: { htmlLabels: false, useMaxWidth: true, curve: "linear" },
    });
    return mermaid;
  });
  return renderer;
}

/** Text remains usable on render failure; stored JSON is the canonical reusable artifact. */
export function DiagramCard({ diagram }: { readonly diagram: AnswerDiagram }): React.JSX.Element {
  const key = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const modal = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const graphic = !["timeline", "comparison"].includes(diagram.kind);
  const valid = validDiagram(diagram);
  useEffect(() => {
    let stale = false;
    setSvg(""); setFailed(false);
    if (!graphic || !valid) return;
    getRenderer().then((mermaid) => mermaid.render(`diagram${key}`, diagramSource(diagram))).then(({ svg: output }) => {
      if (!stale) setSvg(DOMPurify.sanitize(output, { USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ["foreignObject", "a", "image", "script"], FORBID_ATTR: ["href", "xlink:href"] }));
    }).catch(() => { if (!stale) setFailed(true); });
    return () => { stale = true; };
  }, [diagram, graphic, key, valid]);
  const content = graphic ? (
    failed || !valid ? <p role="status">그림을 그리지 못했어요. 아래 글 설명은 그대로 읽을 수 있어요.</p>
      : svg ? <div className="cm-diagram__svg" role="img" aria-label={`${diagram.title}. ${diagram.summary}`}
        dangerouslySetInnerHTML={{ __html: svg }} /> : <p role="status">그림을 정리하고 있어요…</p>
  ) : diagram.kind === "comparison" ? <table className="cm-diagram__table">
    <caption>{diagram.title}</caption><thead><tr><th scope="col">항목</th><th scope="col">설명 · 비교 기준</th></tr></thead>
    <tbody>{diagram.nodes.map((node) => <tr key={node.id}><th scope="row">{node.label}</th><td>{node.detail || "설명 없음"}</td></tr>)}</tbody>
  </table> : <ol className="cm-diagram__timeline">{diagram.nodes.map((node) => <li key={node.id}>
    <strong>{node.label}</strong><p>{node.detail}</p></li>)}</ol>;
  return <figure className="cm-diagram">
    <figcaption><span className="cm-diagram__kind">{DIAGRAM_KINDS.find((item) => item.kind === diagram.kind)?.label}</span>
      <strong>{diagram.title}</strong><button type="button" ref={trigger} onClick={() => { setScale(1); setOpen(true); modal.current?.showModal(); }}>크게 보기</button></figcaption>
    <div className="cm-diagram__preview">{open ? <p>확대 창에서 보고 있어요.</p> : content}</div>
    <p className="cm-diagram__summary">{diagram.summary}</p>
    {graphic ? <details className="cm-diagram__text"><summary>그림을 글로 읽기</summary><ul>{diagram.nodes.map((node) =>
      <li key={node.id}><strong>{node.label}</strong>{node.detail ? ` — ${node.detail}` : ""}</li>)}</ul>
      <ol>{diagram.edges.map((edge, i) => <li key={i}>{diagram.nodes.find((n) => n.id === edge.from)?.label} → {diagram.nodes.find((n) => n.id === edge.to)?.label}{edge.label ? `: ${edge.label}` : ""}</li>)}</ol></details> : null}
    <dialog className="cm-diagram__modal" ref={modal} aria-label={diagram.title} onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <header><strong>{diagram.title}</strong><button type="button" onClick={() => modal.current?.close()}>닫기 · Esc</button></header>
      <div className="cm-diagram__zoom"><button type="button" disabled={scale <= 0.5} onClick={() => setScale((n) => n - 0.25)}>축소</button>
        <output>{Math.round(scale * 100)}%</output><button type="button" disabled={scale >= 3} onClick={() => setScale((n) => n + 0.25)}>확대</button>
        <button type="button" onClick={() => { setScale(1); canvas.current?.scrollTo({ left: 0, top: 0 }); }}>맞춤</button></div>
      <div className="cm-diagram__canvas" ref={canvas} tabIndex={0} aria-label="그림 보기 · 확대하면 가로로 이동할 수 있어요">
        <div className="cm-diagram__surface" style={{ width: `${scale * 100}%` }}>{open ? content : null}</div>
      </div>
      <p>{diagram.summary}</p>
    </dialog>
  </figure>;
}
