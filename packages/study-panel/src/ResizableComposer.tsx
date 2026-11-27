import React,{useEffect,useRef,useState} from 'react';

const storageKey='classmate.chat-input-height.v1';
const initialHeight=()=>{try{const n=Number(localStorage.getItem(storageKey));return Number.isFinite(n)&&n>=80?Math.min(700,n):90;}catch{return 90;}};

/** Upward-growing input, independent of the transcript/chat divider. */
export function ResizableComposer({children}:{children:React.ReactNode}){
  const root=useRef<HTMLDivElement>(null);
  const drag=useRef<{y:number;height:number}|undefined>(undefined);
  const [height,setHeight]=useState(initialHeight);
  const [limit,setLimit]=useState(500);
  const current=useRef(height);
  const clamp=(n:number)=>Math.max(80,Math.min(limit,n));
  const change=(n:number)=>{current.current=clamp(n);setHeight(current.current);};
  const save=()=>{try{localStorage.setItem(storageKey,String(current.current));}catch{/* Resizing still works when local storage is unavailable. */}};
  useEffect(()=>{
    const dock=root.current?.closest<HTMLElement>('.chat-dock');if(!dock)return;
    const measure=()=>setLimit(Math.max(80,Math.min(window.innerHeight*.55,dock.clientHeight-100)));
    measure();const observer=new ResizeObserver(measure);observer.observe(dock);window.addEventListener('resize',measure);
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
  },[]);
  return <div className="resizable-composer" ref={root} style={{height:clamp(height)}}>
    <div className="composer-grip" role="separator" aria-label="질문 입력칸 높이 조절" aria-controls="free-question" aria-orientation="horizontal" aria-valuemin={80} aria-valuemax={Math.round(limit)} aria-valuenow={Math.round(clamp(height))} tabIndex={0}
      title="위로 드래그하면 입력칸이 커집니다 · 두 번 클릭하면 기본 크기"
      onPointerDown={e=>{drag.current={y:e.clientY,height:root.current?.getBoundingClientRect().height??height};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}}
      onPointerMove={e=>{if(drag.current&&e.currentTarget.hasPointerCapture(e.pointerId))change(drag.current.height+drag.current.y-e.clientY);}}
      onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);drag.current=undefined;save();}}
      onPointerCancel={()=>{drag.current=undefined;save();}}
      onDoubleClick={()=>{change(90);save();}}
      onKeyDown={e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();change(e.key==='Home'?80:e.key==='End'?limit:clamp(height)+(e.key==='ArrowUp'?20:-20));save();}}><span/></div>
    {children}
  </div>;
}
