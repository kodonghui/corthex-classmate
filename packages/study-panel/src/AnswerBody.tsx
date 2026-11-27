import React, {useEffect, useId, useState} from 'react';
import {marked, type Token, type Tokens} from 'marked';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';
import {normalizeDiagramSource} from './diagramSource';
import {ListFigure} from './ListFigure';

mermaid.initialize({startOnLoad:false, securityLevel:'strict', suppressErrorRendering:true,
  maxTextSize:20000, maxEdges:100, theme:'neutral', htmlLabels:false,
  fontFamily:'Segoe UI, Malgun Gothic, sans-serif',
  flowchart:{htmlLabels:false,useMaxWidth:true}, sequence:{useMaxWidth:true,wrap:true}});

// Only library-generated SVG is inserted, after an SVG-only sanitizer. Never run model HTML.
export function Diagram({source}:{source:string}) {
  const id='study'+useId().replace(/[^a-z0-9]/gi,'');
  const [svg,setSvg]=useState(''); const [failed,setFailed]=useState(false);
  const [zoom,setZoom]=useState(1);
  const viewBox=svg.match(/viewBox="[^"]*"/)?.[0].match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  const naturalWidth=viewBox?.[2]??720;
  useEffect(()=>{
    let active=true; setSvg('');setFailed(false);
    // Diagrams cannot override security settings or attach actions/URLs.
    if(source.length>20000 || /%%\{|^\s*---|^\s*(?:click|link|links)\s/im.test(source)) {setFailed(true);return;}
    mermaid.render(id,normalizeDiagramSource(source)).then(({svg})=>{
      if(active)setSvg(DOMPurify.sanitize(svg,{USE_PROFILES:{svg:true,svgFilters:true},
        FORBID_TAGS:['foreignObject','a','image','script'],FORBID_ATTR:['href','xlink:href']}));
    }).catch(()=>{if(active)setFailed(true);});
    return()=>{active=false;};
  },[source,id]);
  return <figure className="study-diagram">
    <figcaption><strong>{/^\s*sequenceDiagram/.test(source)?'순서대로 이해하기':'설명 그림'}</strong>
      <button onClick={()=>setZoom(z=>Math.max(.5,z-.25))} aria-label="그림 축소">−</button>
      <button onClick={()=>setZoom(1)}>맞춤</button>
      <button onClick={()=>setZoom(z=>Math.min(3,z+.25))} aria-label="그림 확대">+</button></figcaption>
    {failed?<p role="status">그림 문법을 읽지 못했어요. 글 설명은 그대로 남아 있어요.</p>:svg?
      <div className="diagram-scroll" tabIndex={0} aria-label="설명 그림 · 확대하면 좌우로 이동할 수 있어요">
        <div style={{width:`min(${zoom*100}%, ${naturalWidth*zoom}px)`,marginInline:'auto'}} role="img" aria-label="수업 설명 다이어그램" dangerouslySetInnerHTML={{__html:svg}}/>
      </div>:<p role="status">그림을 그리고 있어요…</p>}
    <details><summary>그림 원문 보기</summary><pre>{source}</pre></details>
  </figure>;
}

const legacyMarker = /\[\[(?:수업#\d+|장면|보탬|확인)\]\]/g;
const partialMarker = /\[\[(?:(?:수(?:업(?:#\d*)?)?|장(?:면)?|보(?:탬)?|확(?:인)?)\]?)?$/;

/** Markdown tokens → React, not arbitrary generated HTML. External media is never auto-loaded. */
export function AnswerBody({text,streaming=false}:{text:string;streaming?:boolean}) {
  const prose=(value:string)=>{
    const visible=value.replace(legacyMarker,'');
    return streaming?visible.replace(partialMarker,''):visible;
  };
  // Walk parsed child tokens: re-lexing a URL label would auto-link itself forever.
  const inline=(source:string|Token[]):React.ReactNode=>(typeof source==='string'?marked.Lexer.lexInline(source):source).map((t,i)=>{
      if(t.type==='strong')return <strong key={i}>{t.tokens?inline(t.tokens):prose(t.text)}</strong>;
      if(t.type==='em')return <em key={i}>{t.tokens?inline(t.tokens):prose(t.text)}</em>;
      if(t.type==='codespan')return <code key={i}>{t.text}</code>;
      if(t.type==='br')return <br key={i}/>;
      // Exact, attribute-free line breaks only; never interpret arbitrary model HTML.
      if(t.type==='html'&&/^<br\s*\/?\s*>$/i.test(t.raw.trim()))return <br key={i}/>;
      if(t.type==='del')return <del key={i}>{t.tokens?inline(t.tokens):prose(t.text)}</del>;
      if(t.type==='link')return <span key={i}>{t.tokens?inline(t.tokens):prose(t.text)} ({t.href})</span>;
      if(t.type==='image')return <span key={i}>[이미지: {prose(t.text)}]</span>;
      const value='text' in t?t.text:t.raw;
      return <React.Fragment key={i}>{typeof value==='string'?prose(value):value}</React.Fragment>;
    });
  return <div className="answer-body">{marked.lexer(text,{gfm:true}).map((t,i)=>{
    if(t.type==='space')return null;
    if(t.type==='code'){
      const lang=t.lang?.trim().toLowerCase();
      if(!streaming&&lang==='mermaid')return <Diagram key={i} source={t.text}/>;
      if(!streaming&&(lang==='list-cells'||lang==='json'&&/"template"\s*:\s*"list-cells"/.test(t.text)))return <ListFigure key={i} raw={t.text}/>;
      return <pre key={i}><code>{t.text}</code></pre>;
    }
    if(t.type==='heading')return <h3 key={i}>{inline(t.text)}</h3>;
    if(t.type==='list') {const list=t as Tokens.List;const Tag=list.ordered?'ol':'ul';return <Tag key={i}>{list.items.map((item,j)=><li key={j}>{inline(item.text)}</li>)}</Tag>;}
    if(t.type==='blockquote')return <blockquote key={i}>{inline(t.text)}</blockquote>;
    if(t.type==='table'){const table=t as Tokens.Table;return <div className="table-scroll" key={i}><table><thead><tr>{table.header.map((c,j)=><th key={j}>{inline(c.text)}</th>)}</tr></thead><tbody>{table.rows.map((r,j)=><tr key={j}>{r.map((c,k)=><td key={k}>{inline(c.text)}</td>)}</tr>)}</tbody></table></div>;}
    if(t.type==='hr')return <hr key={i}/>;
    const source='text' in t?t.text:t.raw;
    if(!prose(source).trim())return null;
    return <p key={i}>{inline(source)}</p>;
  })}</div>;
}
