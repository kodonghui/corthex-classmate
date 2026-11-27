export const defaults={transcript:19,answer:18,height:75,width:45,layout:'rows' as 'rows'|'columns',fold:'none' as 'none'|'transcript'|'chat'};
export type Preferences={transcript:number;answer:number;height:number;width?:number;layout?:'rows'|'columns';fold?:'none'|'transcript'|'chat'};
const key='classmate.study.preferences.v1';
export function readPreferences():Preferences {
  try {return normalizePreferences(JSON.parse(localStorage.getItem(key)??'{}'));}catch{return normalizePreferences({});}
}
export function normalizePreferences(p:Partial<Preferences>):Preferences{return {
  transcript:clamp(p.transcript,defaults.transcript,14,28),answer:clamp(p.answer,defaults.answer,14,28),height:clamp(p.height,defaults.height,5,95),width:clamp(p.width,45,5,95),
  layout:p.layout==='rows'||p.layout==='columns'?p.layout:typeof window!=='undefined'&&window.innerWidth>=1000?'columns':'rows',fold:p.fold==='transcript'||p.fold==='chat'?p.fold:'none'
};}
function clamp(n:unknown,fallback:number,min:number,max:number){return typeof n==='number'&&Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
export function savePreferences(p:Preferences){try{localStorage.setItem(key,JSON.stringify(p));return true;}catch{return false;}}
