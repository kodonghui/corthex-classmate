export const defaults={transcript:19,answer:18,height:75};
export type Preferences=typeof defaults;
const key='classmate.study.preferences.v1';
export function readPreferences():Preferences {
  try {const p=JSON.parse(localStorage.getItem(key)??'{}');return {
    transcript:clamp(p.transcript,defaults.transcript,14,28),answer:clamp(p.answer,defaults.answer,14,28),height:clamp(p.height,defaults.height,30,90)
  };}catch{return {...defaults};}
}
function clamp(n:unknown,fallback:number,min:number,max:number){return typeof n==='number'&&Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
export function savePreferences(p:Preferences){try{localStorage.setItem(key,JSON.stringify(p));return true;}catch{return false;}}
