import type {Paragraph,SelectionPart} from './bridge';

/** Only transcript text is admissible, never answer cards, controls or timestamps. */
export function selectedTranscript(root:HTMLElement,paragraphs:Paragraph[]):SelectionPart[] {
  const selection=root.ownerDocument.getSelection();
  if(!selection||selection.isCollapsed||selection.rangeCount!==1)return [];
  const range=selection.getRangeAt(0);
  const element=(n:Node)=>n.nodeType===Node.ELEMENT_NODE?n as Element:n.parentElement;
  const first=element(range.startContainer)?.closest<HTMLElement>('[data-transcript-text]');
  const last=element(range.endContainer)?.closest<HTMLElement>('[data-transcript-text]');
  if(!first||!last||!root.contains(first)||!root.contains(last))return [];
  const parts:SelectionPart[]=[];
  for(const el of root.querySelectorAll<HTMLElement>('[data-transcript-text]')){
    if(!range.intersectsNode(el))continue;
    const p=paragraphs.find(p=>p.uuid===el.dataset.transcriptText);if(!p)continue;
    const clip=range.cloneRange();const whole=el.ownerDocument.createRange();whole.selectNodeContents(el);
    if(clip.compareBoundaryPoints(Range.START_TO_START,whole)<0)clip.setStart(whole.startContainer,whole.startOffset);
    if(clip.compareBoundaryPoints(Range.END_TO_END,whole)>0)clip.setEnd(whole.endContainer,whole.endOffset);
    const prefix=whole.cloneRange();prefix.setEnd(clip.startContainer,clip.startOffset);
    const start=prefix.toString().length;const text=clip.toString();
    if(text.trim())parts.push({uuid:p.uuid,start,end:start+text.length,text});
  }
  return parts;
}

export function paragraphRange(paragraphs:Paragraph[],start:string,end:string):SelectionPart[]{
  const a=paragraphs.findIndex(p=>p.uuid===start),b=paragraphs.findIndex(p=>p.uuid===end);
  if(a<0||b<0)return [];
  return paragraphs.slice(Math.min(a,b),Math.max(a,b)+1).map(p=>({uuid:p.uuid,start:0,end:p.text.length,text:p.text}));
}
