import type {Bridge,LiveAnswer} from './bridge';

export function createLocalBridge(token:string):Bridge {
  let active:string|undefined;let studyId:string|undefined;let closed=false;
  const request=async(path:string,data?:unknown)=>{
    const r=await fetch(`/api/${path}`,{method:data===undefined?'GET':'POST',headers:{'x-classmate-key':token,...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(35000)});
    const value=await r.json();if(!r.ok)throw new Error(value.error??'Classmate 연결 오류');return value;
  };
  return {
    local:true,
    async connect(){const s=await request('status');return {name:'GPT Terra · High',canSend:s.loggedIn&&!s.aiError,canExpand:false};},
    async refresh(){const id=studyId;const s=await request(`study${id?'?id='+encodeURIComponent(id):''}`);if(id!==studyId)return request(`study?id=${encodeURIComponent(studyId!)}`);studyId=s.studyId;return s;},
    async chooseStudy(id){const s=await request(`study?id=${encodeURIComponent(id)}`);studyId=s.studyId;return s;},
    async newStudy(name){const s=await request('studies',{name});studyId=s.studyId;return s;},
    async editStudy(id,action,name){const s=await request('studies/edit',{id,action,name});studyId=s.studyId;return s;},
    async capture(uuid){return request('capture',{paragraph_uuid:uuid});},
    async send(text,progress){
      const data=JSON.parse(text.slice(text.indexOf('\n')+1));const id=crypto.randomUUID();active=id;
      await request('question',{...data,id,study_id:studyId});
      try{while(!closed){const job:LiveAnswer=await request(`job/${id}`);progress?.(job);
        if(['done','unsaved','error','cancelled'].includes(job.state)){if(job.state==='error')throw new Error(job.error);return;}
        await new Promise(resolve=>setTimeout(resolve,250));
      }}finally{active=undefined;}
    },
    async cancel(){if(active)await request('cancel',{id:active});},
    async loadPreferences(){return request('preferences');},
    async storePreferences(p){await request('preferences',p);},
    async expand(){},
    async close(){closed=true;},
  };
}
