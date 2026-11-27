import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {CoreConnection} from './core-connection.mjs';
import {WindowLease} from './window-lease.mjs';
import {Tutor,MODEL,EFFORT} from './tutor.mjs';
import {ClaudeTutor,CLAUDE_MODEL,CLAUDE_EFFORT} from './claude-tutor.mjs';
import {Studies} from './studies.mjs';
import {ShareReader,canonicalShareUrl} from './share-source.mjs';
import {Screens} from './screens.mjs';
import {validateSelection} from './selection.mjs';

// Two tutors with the user's own logins. The selection is a profile preference; each queued job binds the provider chosen at acceptance.
export const PROVIDERS={
  codex:{label:'GPT Terra · High',model:MODEL,effort:EFFORT,loginHint:'먼저 Codex에서 ChatGPT 계정에 로그인해 주세요.',startError:'AI 연결을 시작하지 못했어요. Codex 로그인과 설치 상태를 확인해 주세요.'},
  claude:{label:'Claude Sonnet 5 · xhigh',model:CLAUDE_MODEL,effort:CLAUDE_EFFORT,loginHint:'먼저 Claude Code에서 claude.ai 계정에 로그인해 주세요.',startError:'Claude 연결을 시작하지 못했어요. Claude Code 설치와 로그인 상태를 확인해 주세요.'}};
export const DEFAULT_PROVIDER='codex';
export function selectContext(snapshot,id){
  if(!id)return {recentLesson:snapshot.paragraphs.slice(-3).map(p=>({text:p.text.slice(0,12000),timeFrom:p.timeFrom,timeTo:p.timeTo,timeBasis:p.timeBasis??'source',timingNote:p.timeBasis==='observed'?'수신 시각입니다. 발화 시각이나 영상 위치가 아닙니다.':undefined})),previous:snapshot.recentQa.filter(q=>!q.paragraphUuid).slice(-8).map(q=>({question:q.question,answer:q.answer.slice(0,9000)}))};
  const index=snapshot.paragraphs.findIndex(p=>p.uuid===id);
  if(index<0)throw new Error('현재 학습 자료에서 선택한 문장을 찾지 못했어요.');
  const paragraph=p=>({text:p.text.slice(0,12000),timeFrom:p.timeFrom,timeTo:p.timeTo,timeBasis:p.timeBasis??'source',timingNote:p.timeBasis==='observed'?'공유 화면에서 읽은 시각입니다. 실제 발화 시각이나 영상 재생 위치가 아닙니다.':undefined});
  const qa=q=>({question:q.question,answer:q.answer.slice(0,9000)});
  return {selected:paragraph(snapshot.paragraphs[index]),nearby:snapshot.paragraphs.slice(Math.max(0,index-2),index+2).map(paragraph),
    previous:snapshot.recentQa.filter(q=>q.paragraphUuid===id).slice(-6).map(qa),
    otherRecentQuestions:snapshot.recentQa.filter(q=>q.paragraphUuid!==id).slice(-2).map(qa)};
}
export async function startStudy({root,entry,claudeEntry,profile,port=0,coreDir,tutorOverride,claudeOverride,onIdle,coreExecutable,shareReaderFactory,coreOverride}){
  await mkdir(profile,{recursive:true});
  const screens=new Screens(profile);await screens.init();
  let preferences={transcript:19,answer:18,height:75};let preferenceWrites=Promise.resolve();
  try{const p=JSON.parse(await readFile(join(profile,'reading-preferences.json'),'utf8'));if(validPreferences(p))preferences=p;}catch{}
  const core=coreOverride??new CoreConnection(coreExecutable??join(root,'apps/core/target/release/classmate-core.exe'),{coreDir});
  await core.connect().catch(()=>{}); // UI can still open and retry after a startup failure.
  const call=(name,args={})=>core.call(name,args);
  const studies=new Studies(profile);let source;let refreshing;let lastChangedAt;let lastCheckedAt;let refreshError=false;
  const shareOptions={onSnapshot:async(link,data)=>{
    if(stopping||studies.active!==link.id||studies.source()?.key!==link.key)return;
    const before=studies.shareRows(link.id);const rows=studies.prepareShare(link,data);
    const changed=rows.filter((p,i)=>!before[i]||JSON.stringify(before[i])!==JSON.stringify(p));
    if(changed.length){await core.ingestShare(link.key,changed);if(!stopping&&studies.saveShare(link,rows))lastChangedAt=new Date().toISOString();}
  }};
  const reader=shareReaderFactory?shareReaderFactory(shareOptions):new ShareReader(shareOptions);
  let shareTarget;
  const syncShare=()=>{const target=studies.source();const key=target?.mode==='share'?target.key:undefined;if(key===shareTarget)return;shareTarget=key;void(key?reader.connect(target):reader.close());};
  const refresh=()=>refreshing??(refreshing=(async()=>{try{const next=(await call('study_refresh')).structuredContent;const changed=studies.ingest(next);source=next;lastCheckedAt=new Date().toISOString();if(changed)lastChangedAt=lastCheckedAt;refreshError=false;}catch(e){refreshError=true;throw e;}finally{refreshing=undefined;}})());
  // Continue collecting into the current study while an older study is being read.
  let stopping=false;let refreshTimer;
  const lease=new WindowLease();
  const tick=async()=>{if(onIdle&&lease.expired()){onIdle();return;}try{await refresh();syncShare();}catch{}finally{if(!stopping)refreshTimer=setTimeout(tick,500);}};
  // First read happens on the first UI request; the interval also works without a window.
  refreshTimer=setTimeout(tick,1000);
  const snapshot=async(id)=>{try{await refresh();}catch{if(!source)throw new Error('자료 연결을 복구하고 있어요.');}syncShare();const result=studies.snapshot(source,id);return {...result,screen:screens.status(),recording:{...result.recording,...(result.studyId===studies.active&&result.recording.mode==='share'?reader.state:{state:result.recording.mode==='share'?'history':result.recording.mode==='none'?'unlinked':'api'})},delivery:{lastCheckedAt,lastChangedAt,refreshError}};};
  const tutors={codex:tutorOverride??(entry?new Tutor(entry,profile):undefined),claude:claudeOverride??(claudeEntry?new ClaudeTutor(claudeEntry,profile):undefined)};
  const accounts={};
  await Promise.all(Object.entries(PROVIDERS).map(async([key,meta])=>{
    let account={loggedIn:false};let aiError='';
    if(!tutors[key])aiError=meta.startError;else try{account=await tutors[key].connect();}catch{aiError=meta.startError;}
    accounts[key]={id:key,label:meta.label,loggedIn:account.loggedIn===true,model:account.model??meta.model,effort:account.effort??meta.effort,aiError,loginHint:meta.loginHint};
  }));
  let provider=DEFAULT_PROVIDER;let providerWrites=Promise.resolve();
  try{const p=JSON.parse(await readFile(join(profile,'tutor-provider.json'),'utf8'));if(PROVIDERS[p?.provider])provider=p.provider;}catch{}
  const status=()=>({...accounts[provider],provider,providers:Object.values(accounts).map(({loginHint,...a})=>a)});
  const token=randomBytes(32).toString('hex');const jobs=new Map();let busy=false;let origin;const queue=[];
  const publicJob=j=>{const {abort,...safe}=j;return {...safe,providerLabel:PROVIDERS[j.provider]?.label,queuePosition:j.state==='queued'?queue.findIndex(x=>x.job===j)+1:0};};
  const pump=()=>{if(busy||stopping)return;const next=queue.shift();if(!next)return;busy=true;next.job.state='preparing';void run(next.job,next.request);};
  const html=await readFile(join(root,'packages/study-panel/dist/index.html'));
  const json=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const run=async(job,request)=>{
    try{
      const context=request.contextSnapshot??selectContext(await snapshot(request.study_id),request.paragraph_uuid);
      const input=[];let cap;
      if(request.moment_id){const m=await call('moment_get',{moment_id:request.moment_id});
        if(m.structuredContent.found&&m.structuredContent.moment.paragraphUuid===request.paragraph_uuid){
          cap={moment_id:request.moment_id,captured_at:m.structuredContent.moment.createdAt};
          const img=m.content?.find(c=>c.type==='image');if(img)input.push({type:'image',url:`data:${img.mimeType};base64,${img.data}`});
        }
      }
      if(request.screen_id){const image=await screens.get(request.screen_id,request.study_id);input.push({type:'image',url:image.image});cap={screen_id:request.screen_id,captured_at:image.captured_at,title:image.title};}
      input.unshift({type:'text',text:JSON.stringify({question:request.question,referenceData:context,screen:cap??'화면 없음. 전사만 보고 설명하세요.'})});
      if(job.cancelled)throw new Error('답변을 중지했어요.');
      const final=await tutors[job.provider].answer(input,delta=>{job.answer+=delta;job.state='streaming';},job.abort.signal,event=>{job.searchState=event.state;},request.search_mode??'auto');
      if(job.cancelled)throw new Error('답변을 중지했어요.');
      if(final)job.answer=final;
      if(!job.answer.trim())throw new Error('AI가 답변을 반환하지 않았어요.');
      try{const saved=(await call('session_log',{...(request.paragraph_uuid?{paragraph_uuid:request.paragraph_uuid}:{}),...(cap?{moment_id:cap.moment_id}:{}),question:request.question,answer:job.answer,kind:'explain'})).structuredContent;job.savedId=saved.id;
        studies.save(request.study_id,{id:saved.id,question:request.question,answer:job.answer,paragraphUuid:request.paragraph_uuid,selection:request.selection,screenId:request.screen_id,screen:cap,momentId:cap?.moment_id,askedAt:new Date().toISOString()});job.state='done';}
      catch{job.state='unsaved';job.error='답변은 완성했지만 저장하지 못했어요. 창을 닫기 전에 답변을 복사해 주세요.';}
    }catch(e){job.state=job.cancelled?'cancelled':'error';job.error=e.message;}
    finally{busy=false;job.finishedAt=Date.now();pump();}
  };
  const server=createServer(async(req,res)=>{
    try{
      if(req.headers.host!==new URL(origin).host)return json(res,403,{error:'잘못된 접속 주소입니다.'});
      if(req.url?.startsWith('/api/screen/')){
        const extensionOrigin=req.headers.origin;
        if(typeof extensionOrigin!=='string'||!/^chrome-extension:\/\/[a-p]{32}$/.test(extensionOrigin))return json(res,403,{error:'화면 확장 연결만 허용합니다.'});
        res.setHeader('Access-Control-Allow-Origin',extensionOrigin);res.setHeader('Vary','Origin');
        if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','content-type,x-classmate-screen-key');return res.writeHead(204).end();}
        if(req.method!=='POST'||!screens.authorized(req.headers['x-classmate-screen-key']))return json(res,403,{error:'화면 연결 코드가 다릅니다.'});
        if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON만 허용합니다.'});
        let body='';for await(const chunk of req){body+=chunk;if(body.length>1600000)return json(res,413,{error:'화면이 너무 큽니다.'});}
        try{const data=JSON.parse(body);if(req.url==='/api/screen/start')return json(res,200,screens.start(data.title));if(req.url==='/api/screen/frame')return json(res,200,screens.receive(data));if(req.url==='/api/screen/stop')return json(res,200,screens.stop(data.binding));}catch(e){return json(res,400,{error:e.message});}
        return json(res,404,{error:'화면 연결 요청을 확인해 주세요.'});
      }
      if(req.headers.origin&&req.headers.origin!==origin)return json(res,403,{error:'다른 사이트에서의 요청은 허용하지 않습니다.'});
      if(req.method==='GET'&&req.url==='/'){
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src data:; connect-src 'self'; font-src data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"});return res.end(html);
      }
      if(req.headers['x-classmate-key']!==token)return json(res,401,{error:'바탕화면의 Classmate 바로가기로 다시 열어 주세요.'});
      if(req.method==='GET'&&new URL(req.url,origin).pathname==='/api/window'){
        const id=new URL(req.url,origin).searchParams.get('id');if(!id||!/^[-a-zA-Z0-9]{10,64}$/.test(id))return json(res,400,{error:'창 연결을 확인해 주세요.'});
        lease.touch(id,true);res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});res.flushHeaders();res.write(': connected\n\n');
        const heartbeat=setInterval(()=>{lease.touch(id,true);res.write(': alive\n\n');},15000);
        res.once('close',()=>{clearInterval(heartbeat);lease.touch(id,false);});return;
      }
      if(req.method==='GET'&&req.url==='/api/status')return json(res,200,status());
      if(req.method==='GET'&&req.url==='/api/screen-pair')return json(res,200,{code:Buffer.from(JSON.stringify({origin,key:screens.key})).toString('base64'),extensionPath:join(root,'apps/study-desktop/screen-extension')});
      if(req.method==='GET'&&req.url==='/api/preferences')return json(res,200,preferences);
      if(req.method==='GET'&&new URL(req.url,origin).pathname==='/api/study'){const s=await snapshot(new URL(req.url,origin).searchParams.get('id')||undefined);return json(res,200,{...s,jobs:[...jobs.values()].filter(j=>j.studyId===s.studyId).map(publicJob)});}
      if(req.method==='GET'&&req.url?.startsWith('/api/job/')){const job=jobs.get(req.url.slice(9));if(!job)return json(res,404,{error:'답변을 찾지 못했어요.'});return json(res,200,publicJob(job));}
      if(req.method!=='POST')return json(res,404,{error:'알 수 없는 요청입니다.'});
      if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON만 허용합니다.'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>180000)return json(res,413,{error:'질문이 너무 깁니다. 8,000자 이내로 나눠 주세요.'});}
      let data;try{data=JSON.parse(body);}catch{return json(res,400,{error:'요청을 읽지 못했어요.'});}
      if(req.url==='/api/presence'){
        if(typeof data.id!=='string'||!/^[-a-zA-Z0-9]{10,64}$/.test(data.id)||typeof data.open!=='boolean')return json(res,400,{error:'창 연결을 확인해 주세요.'});
        lease.touch(data.id,data.open);return json(res,200,{ok:true});
      }
      if(req.url==='/api/studies/edit'){
        if(busy)return json(res,409,{error:'답변이 끝나거나 중지한 뒤 세션을 변경해 주세요.'});
        if(typeof data.id!=='string'||!['rename','trash','restore'].includes(data.action))return json(res,400,{error:'세션와 작업을 확인해 주세요.'});
        await refresh();let id;try{id=studies.edit(data.id,data.action,data.name);}catch(e){return json(res,400,{error:e.message});}
        return json(res,200,await snapshot(id));
      }
      if(req.url==='/api/studies'){
        if(busy)return json(res,409,{error:'답변이 끝나거나 중지한 뒤 새 세션을 시작해 주세요.'});
        if(typeof data.name!=='string'||!data.name.trim()||data.name.trim().length>100)return json(res,400,{error:'세션 이름은 1~100자로 입력해 주세요.'});
        let url;try{if(data.url)url=canonicalShareUrl(data.url);}catch(e){return json(res,400,{error:e.message});}
        await refresh();const id=studies.create(data.name,{mode:'none'});if(url)studies.connectShare(id,url);return json(res,201,await snapshot(id));
      }
      if(req.url==='/api/studies/source'){
        if(busy)return json(res,409,{error:'답변이 끝나거나 중지한 뒤 녹음을 연결해 주세요.'});
        try{studies.connectShare(data.id,data.url);}catch(e){return json(res,400,{error:e.message});}
        shareTarget=undefined;return json(res,200,await snapshot(data.id));
      }
      if(req.url==='/api/provider'){
        if(!PROVIDERS[data.provider])return json(res,400,{error:'대화 상대를 확인해 주세요.'});
        provider=data.provider;const serialized=JSON.stringify({provider});
        providerWrites=providerWrites.catch(()=>{}).then(()=>writeFile(join(profile,'tutor-provider.json'),serialized,{mode:0o600}));await providerWrites;
        return json(res,200,status());
      }
      if(req.url==='/api/preferences'){
        if(!validPreferences(data))return json(res,400,{error:'글씨 크기와 영역 높이를 확인해 주세요.'});
        preferences={transcript:data.transcript,answer:data.answer,height:data.height,...(data.width!==undefined?{width:data.width}:{}),...(data.layout?{layout:data.layout}:{}),...(data.fold?{fold:data.fold}:{})};const serialized=JSON.stringify(preferences);
        preferenceWrites=preferenceWrites.catch(()=>{}).then(()=>writeFile(join(profile,'reading-preferences.json'),serialized,{mode:0o600}));await preferenceWrites;
        return json(res,200,{ok:true});
      }
      if(req.url==='/api/capture'){
        if(data.paragraph_uuid!==undefined&&(typeof data.paragraph_uuid!=='string'||data.paragraph_uuid.length>100))return json(res,400,{error:'선택한 문단을 확인해 주세요.'});
        try{const state=await snapshot(data.study_id);if(data.paragraph_uuid&&!state.paragraphs.some(p=>p.uuid===data.paragraph_uuid))throw Error('현재 세션의 문단이 아닙니다.');return json(res,200,screens.capture(state.studyId,data.paragraph_uuid));}catch(e){return json(res,400,{error:e.message});}
      }
      if(req.url==='/api/cancel'){const job=jobs.get(data.id);if(job&&['queued','preparing','streaming'].includes(job.state)){job.cancelled=true;job.abort.abort();if(job.state==='queued'){const index=queue.findIndex(x=>x.job===job);if(index>=0)queue.splice(index,1);job.state='cancelled';job.finishedAt=Date.now();}}return json(res,200,{ok:true});}
      if(req.url==='/api/question'){
        if(!accounts[provider].loggedIn||accounts[provider].aiError)return json(res,503,{error:accounts[provider].aiError||accounts[provider].loginHint});
        if(typeof data.id!=='string'||!/^[-a-zA-Z0-9]{10,64}$/.test(data.id)||typeof data.question!=='string'||!data.question.trim()||data.question.length>8000||data.paragraph_uuid!==undefined&&(typeof data.paragraph_uuid!=='string'||data.paragraph_uuid.length>100)||data.moment_id!==undefined&&(typeof data.moment_id!=='string'||data.moment_id.length>100))return json(res,400,{error:'질문을 입력해 주세요. 질문은 최대 8,000자입니다.'});
        if(data.search_mode!==undefined&&!['auto','off','required'].includes(data.search_mode))return json(res,400,{error:'검색 설정을 확인해 주세요.'});
        await refresh();data.study_id??=studies.active;
        if(!studies.list().some(s=>s.id===data.study_id&&!s.deletedAt))return json(res,400,{error:'세션 기록을 다시 선택해 주세요.'});
        if(jobs.has(data.id))return json(res,200,{id:data.id});
        if(queue.length>=20)return json(res,409,{error:'대기 질문이 20개입니다. 잠시 후 다시 보내 주세요.'});
        try{const current=await snapshot(data.study_id);if(data.followup_id!==undefined){const previous=current.recentQa.find(q=>q.id===data.followup_id&&q.paragraphUuid===data.paragraph_uuid);if(!previous)throw Error('이 세션의 이전 답변을 찾지 못했습니다.');data.selection=previous.selection;data.screen_id=previous.screenId;data.moment_id=previous.momentId;}else data.selection=validateSelection(current,data.selection,data.paragraph_uuid);data.contextSnapshot=selectContext(current,data.paragraph_uuid);if(data.selection)data.contextSnapshot.selectedRange=data.selection;}catch(e){return json(res,400,{error:e.message});}
        for(const [id,j]of jobs)if(j.finishedAt&&Date.now()-j.finishedAt>3600000)jobs.delete(id);
        if(data.screen_id){try{await screens.retain(data.screen_id,data.study_id);}catch(e){return json(res,400,{error:e.message});}}
        if(jobs.has(data.id))return json(res,200,{id:data.id});
        if(queue.length>=20)return json(res,409,{error:'대기 질문이 20개입니다. 잠시 후 다시 보내 주세요.'});
        const job={id:data.id,studyId:data.study_id,paragraphUuid:data.paragraph_uuid,question:data.question,answer:'',state:'queued',provider,abort:new AbortController()};jobs.set(data.id,job);queue.push({job,request:structuredClone(data)});
        json(res,202,{id:data.id});pump();return;
      }
      return json(res,404,{error:'알 수 없는 요청입니다.'});
    }catch{return json(res,500,{error:'연결 요청을 처리하지 못했어요. Classmate를 다시 열어 주세요.'});}
  });
  let preferred=port;if(!preferred){try{const n=Number(await readFile(join(profile,'listen-port'),'utf8'));if(Number.isInteger(n)&&n>1024&&n<65536)preferred=n;}catch{}}
  const listen=n=>new Promise((resolve,reject)=>{const failed=e=>{server.off('listening',ready);reject(e);};const ready=()=>{server.off('error',failed);resolve();};server.once('error',failed);server.once('listening',ready);server.listen(n,'127.0.0.1');});
  try{await listen(preferred);}catch(e){if(!port&&preferred&&e.code==='EADDRINUSE')await listen(0);else throw e;}
  await writeFile(join(profile,'listen-port'),String(server.address().port),{mode:0o600});
  origin=`http://127.0.0.1:${server.address().port}`;
  let closing;
  return {url:`${origin}/#classmate=${token}`,origin,token,account:status(),close(){if(stopping)return closing;stopping=true;clearTimeout(refreshTimer);server.closeAllConnections();server.close();core.close();for(const t of Object.values(tutors))t?.close();closing=Promise.allSettled([reader.close(),refreshing]).finally(()=>studies.close());return closing;}};
}

export function validPreferences(p){return p&&typeof p==='object'&&[['transcript',14,28],['answer',14,28],['height',5,95]].every(([key,min,max])=>Number.isFinite(p[key])&&p[key]>=min&&p[key]<=max)&&(p.width===undefined||Number.isFinite(p.width)&&p.width>=5&&p.width<=95)&&(p.layout===undefined||['rows','columns'].includes(p.layout))&&(p.fold===undefined||['none','transcript','chat'].includes(p.fold));}
