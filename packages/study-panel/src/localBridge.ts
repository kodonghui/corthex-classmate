import type {Bridge,Host,LiveAnswer} from './bridge';

export function createLocalBridge(token:string):Bridge {
  const active=new Set<string>();let studyId:string|undefined;let closed=false;
  const windowId=crypto.randomUUID();let presenceTimer:ReturnType<typeof setInterval>|undefined;
  const presence=(open:boolean)=>fetch('/api/presence',{method:'POST',headers:{'x-classmate-key':token,'Content-Type':'application/json'},body:JSON.stringify({id:windowId,open}),keepalive:true}).catch(()=>{});
  const leaving=()=>{void presence(false);};
  const returning=()=>{void presence(true);};
  const windowConnection=new AbortController();
  const watchWindow=async()=>{
    while(!closed){try{const r=await fetch(`/api/window?id=${windowId}`,{headers:{'x-classmate-key':token},signal:windowConnection.signal});if(!r.ok)break;const stream=r.body?.getReader();if(!stream)break;while(!closed&&!(await stream.read()).done){/* Connection lifetime, no model or transcript data. */}}catch{}if(!closed)await new Promise(r=>setTimeout(r,1000));}
  };
  const request=async(path:string,data?:unknown)=>{
    const r=await fetch(`/api/${path}`,{method:data===undefined?'GET':'POST',headers:{'x-classmate-key':token,...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(35000)});
    const value=await r.json();if(!r.ok)throw new Error(value.error??'Classmate 연결 오류');return value;
  };
  // Status carries every provider with its own login state; the selected one decides canSend.
  const host=(s:{provider?:string;loggedIn:boolean;aiError?:string;loginHint?:string;providers?:{id:string;label:string;loggedIn:boolean;aiError?:string}[]}):Host=>({name:s.providers?.find(p=>p.id===s.provider)?.label??'GPT Terra · High',canSend:s.loggedIn&&!s.aiError,canExpand:false,provider:s.provider,providers:s.providers?.map(p=>({id:p.id,label:p.label,canSend:p.loggedIn&&!p.aiError,...(p.aiError?{error:p.aiError}:{})})),hint:s.aiError||s.loginHint});
  return {
    local:true,
    async connect(){await presence(true);void watchWindow();presenceTimer=setInterval(()=>void presence(true),20000);window.addEventListener('pagehide',leaving);window.addEventListener('pageshow',returning);const s=await request('status');return host(s);},
    async chooseProvider(id){return host(await request('provider',{provider:id}));},
    async refresh(){const id=studyId;const s=await request(`study${id?'?id='+encodeURIComponent(id):''}`);if(id!==studyId)return request(`study?id=${encodeURIComponent(studyId!)}`);studyId=s.studyId;return s;},
    async chooseStudy(id){const s=await request(`study?id=${encodeURIComponent(id)}`);studyId=s.studyId;return s;},
    async newStudy(name,url){const s=await request('studies',{name,url});studyId=s.studyId;return s;},
    async connectSource(id,url){const s=await request('studies/source',{id,url});studyId=s.studyId;return s;},
    async editStudy(id,action,name){const s=await request('studies/edit',{id,action,name});studyId=s.studyId;return s;},
    async screenPair(){return request('screen-pair');},
    async capture(uuid){return request('capture',{paragraph_uuid:uuid,study_id:studyId});},
    async send(text,progress,accepted){
      const data=JSON.parse(text.slice(text.indexOf('\n')+1));const id=crypto.randomUUID();active.add(id);
      try{await request('question',{...data,id,study_id:studyId});
      progress?.({id,paragraphUuid:data.paragraph_uuid,question:data.question,answer:'',state:'queued'});accepted?.();
      while(!closed){const job:LiveAnswer=await request(`job/${id}`);progress?.(job);
        if(['done','unsaved','error','cancelled'].includes(job.state)){if(job.state==='error')throw new Error(job.error);return;}
        await new Promise(resolve=>setTimeout(resolve,250));
      }}finally{active.delete(id);}
    },
    async cancel(id){const target=id??active.values().next().value;if(target)await request('cancel',{id:target});},
    async loadPreferences(){return request('preferences');},
    async storePreferences(p){await request('preferences',p);},
    async expand(){},
    async close(){closed=true;windowConnection.abort();clearInterval(presenceTimer);window.removeEventListener('pagehide',leaving);window.removeEventListener('pageshow',returning);await presence(false);},
  };
}
