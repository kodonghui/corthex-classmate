import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {CoreConnection} from './core-connection.mjs';
import {WindowLease} from './window-lease.mjs';
import {Tutor,MODEL,EFFORT} from './tutor.mjs';
import {Studies} from './studies.mjs';
import {ShareReader,canonicalShareUrl} from './share-source.mjs';

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
export async function startStudy({root,entry,profile,port=0,coreDir,tutorOverride,onIdle,coreExecutable,shareReaderFactory}){
  await mkdir(profile,{recursive:true});
  let preferences={transcript:19,answer:18,height:75};let preferenceWrites=Promise.resolve();
  try{const p=JSON.parse(await readFile(join(profile,'reading-preferences.json'),'utf8'));if(validPreferences(p))preferences=p;}catch{}
  const core=new CoreConnection(coreExecutable??join(root,'apps/core/target/release/classmate-core.exe'),{coreDir});
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
  const snapshot=async(id)=>{try{await refresh();}catch{if(!source)throw new Error('자료 연결을 복구하고 있어요.');}syncShare();const result=studies.snapshot(source,id);return {...result,recording:{...result.recording,...(result.studyId===studies.active&&result.recording.mode==='share'?reader.state:{state:result.recording.mode==='share'?'history':result.recording.mode==='none'?'unlinked':'api'})},delivery:{lastCheckedAt,lastChangedAt,refreshError}};};
  const tutor=tutorOverride??new Tutor(entry,profile);
  let account={loggedIn:false,model:MODEL,effort:EFFORT};let aiError='';
  try{account=await tutor.connect();}catch{aiError='AI 연결을 시작하지 못했어요. Codex 로그인과 설치 상태를 확인해 주세요.';}
  const token=randomBytes(32).toString('hex');const jobs=new Map();let busy=false;let origin;
  const html=await readFile(join(root,'packages/study-panel/dist/index.html'));
  const json=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const run=async(job,request)=>{
    try{
      const current=await snapshot(request.study_id);
      const context=selectContext(current,request.paragraph_uuid);
      const input=[];let cap;
      if(request.moment_id){const m=await call('moment_get',{moment_id:request.moment_id});
        if(m.structuredContent.found&&m.structuredContent.moment.paragraphUuid===request.paragraph_uuid){
          cap={moment_id:request.moment_id,captured_at:m.structuredContent.moment.createdAt};
          const img=m.content?.find(c=>c.type==='image');if(img)input.push({type:'image',url:`data:${img.mimeType};base64,${img.data}`});
        }
      }
      input.unshift({type:'text',text:JSON.stringify({question:request.question,referenceData:context,screen:cap??'화면 없음. 전사만 보고 설명하세요.'})});
      if(job.cancelled)throw new Error('답변을 중지했어요.');
      const final=await tutor.answer(input,delta=>{job.answer+=delta;job.state='streaming';},job.abort.signal);
      if(job.cancelled)throw new Error('답변을 중지했어요.');
      if(final)job.answer=final;
      if(!job.answer.trim())throw new Error('AI가 답변을 반환하지 않았어요.');
      try{const saved=(await call('session_log',{...(request.paragraph_uuid?{paragraph_uuid:request.paragraph_uuid}:{}),...(cap?{moment_id:cap.moment_id}:{}),question:request.question,answer:job.answer,kind:'explain'})).structuredContent;job.savedId=saved.id;
        studies.save(request.study_id,{id:saved.id,question:request.question,answer:job.answer,paragraphUuid:request.paragraph_uuid,momentId:cap?.moment_id,askedAt:new Date().toISOString()});job.state='done';}
      catch{job.state='unsaved';job.error='답변은 완성했지만 저장하지 못했어요. 창을 닫기 전에 답변을 복사해 주세요.';}
    }catch(e){job.state=job.cancelled?'cancelled':'error';job.error=e.message;}
    finally{busy=false;job.finishedAt=Date.now();}
  };
  const server=createServer(async(req,res)=>{
    try{
      if(req.headers.host!==new URL(origin).host)return json(res,403,{error:'잘못된 접속 주소입니다.'});
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
      if(req.method==='GET'&&req.url==='/api/status')return json(res,200,{...account,aiError});
      if(req.method==='GET'&&req.url==='/api/preferences')return json(res,200,preferences);
      if(req.method==='GET'&&new URL(req.url,origin).pathname==='/api/study')return json(res,200,await snapshot(new URL(req.url,origin).searchParams.get('id')||undefined));
      if(req.method==='GET'&&req.url?.startsWith('/api/job/')){const job=jobs.get(req.url.slice(9));if(!job)return json(res,404,{error:'답변을 찾지 못했어요.'});const {abort,...safe}=job;return json(res,200,safe);}
      if(req.method!=='POST')return json(res,404,{error:'알 수 없는 요청입니다.'});
      if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON만 허용합니다.'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>24000)return json(res,413,{error:'질문이 너무 깁니다. 8,000자 이내로 나눠 주세요.'});}
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
      if(req.url==='/api/preferences'){
        if(!validPreferences(data))return json(res,400,{error:'글씨 크기와 영역 높이를 확인해 주세요.'});
        preferences={transcript:data.transcript,answer:data.answer,height:data.height};const serialized=JSON.stringify(preferences);
        preferenceWrites=preferenceWrites.catch(()=>{}).then(()=>writeFile(join(profile,'reading-preferences.json'),serialized,{mode:0o600}));await preferenceWrites;
        return json(res,200,{ok:true});
      }
      if(req.url==='/api/capture'){
        if(typeof data.paragraph_uuid!=='string'||data.paragraph_uuid.length>100)return json(res,400,{error:'문장을 선택해 주세요.'});
        const r=(await call('moment_capture',{paragraph_uuid:data.paragraph_uuid})).structuredContent;
        return json(res,200,{moment_id:r.moment_id,captured_at:r.captured_at});
      }
      if(req.url==='/api/cancel'){const job=jobs.get(data.id);if(job&&['preparing','streaming'].includes(job.state)){job.cancelled=true;job.abort.abort();}return json(res,200,{ok:true});}
      if(req.url==='/api/question'){
        if(!account.loggedIn||aiError)return json(res,503,{error:aiError||'먼저 Codex에서 ChatGPT 계정에 로그인해 주세요.'});
        if(typeof data.id!=='string'||!/^[-a-zA-Z0-9]{10,64}$/.test(data.id)||typeof data.question!=='string'||!data.question.trim()||data.question.length>8000||data.paragraph_uuid!==undefined&&(typeof data.paragraph_uuid!=='string'||data.paragraph_uuid.length>100)||data.moment_id!==undefined&&(typeof data.moment_id!=='string'||data.moment_id.length>100))return json(res,400,{error:'질문을 입력해 주세요. 질문은 최대 8,000자입니다.'});
        await refresh();data.study_id??=studies.active;
        if(!studies.list().some(s=>s.id===data.study_id&&!s.deletedAt))return json(res,400,{error:'세션 기록을 다시 선택해 주세요.'});
        if(jobs.has(data.id))return json(res,200,{id:data.id});
        if(busy)return json(res,409,{error:'먼저 진행 중인 답변을 마치거나 중지해 주세요.'});
        for(const [id,j]of jobs)if(j.finishedAt&&Date.now()-j.finishedAt>3600000)jobs.delete(id);
        const job={id:data.id,paragraphUuid:data.paragraph_uuid,question:data.question,answer:'',state:'preparing',abort:new AbortController()};jobs.set(data.id,job);busy=true;
        json(res,202,{id:data.id});void run(job,data);return;
      }
      return json(res,404,{error:'알 수 없는 요청입니다.'});
    }catch{return json(res,500,{error:'연결 요청을 처리하지 못했어요. Classmate를 다시 열어 주세요.'});}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  origin=`http://127.0.0.1:${server.address().port}`;
  let closing;
  return {url:`${origin}/#classmate=${token}`,origin,token,account,close(){if(stopping)return closing;stopping=true;clearTimeout(refreshTimer);server.closeAllConnections();server.close();core.close();tutor.close();closing=Promise.allSettled([reader.close(),refreshing]).finally(()=>studies.close());return closing;}};
}

export function validPreferences(p){return p&&typeof p==='object'&&[['transcript',14,28],['answer',14,28],['height',30,90]].every(([key,min,max])=>Number.isFinite(p[key])&&p[key]>=min&&p[key]<=max);}
