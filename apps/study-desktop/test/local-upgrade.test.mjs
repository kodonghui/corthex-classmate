import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateSelection} from '../selection.mjs';
import {Screens} from '../screens.mjs';
import {startStudy} from '../server.mjs';
const paragraphs=['첫 번째 설명','두 번째 설명','세 번째 설명'].map((text,i)=>({uuid:'p'+i,text,timeFrom:`2026-09-14T01:0${i}:00Z`,timeTo:'2026-09-14T01:03:00Z'}));
const parts=paragraphs.slice(0,2).map(p=>({uuid:p.uuid,start:0,end:p.text.length,text:p.text}));
test('range selection rejects stale, non-contiguous, wrong anchor and cross-session evidence',()=>{
 const s={paragraphs};assert.equal(validateSelection(s,parts,'p1').length,2);
 assert.throws(()=>validateSelection(s,parts,'p0'));assert.throws(()=>validateSelection({paragraphs:[]},parts,'p1'));
 assert.throws(()=>validateSelection(s,[parts[0],{...parts[1],uuid:'p2'}],'p2'));
 assert.throws(()=>validateSelection(s,[{...parts[0],text:'다른 원문'}],'p0'));
 assert.throws(()=>validateSelection(s,[{...parts[0],start:-1}],'p0'));
});
test('screen capabilities expire, reject old bindings, and isolate persisted question images',async()=>{
 let now=1000;const dir=await mkdtemp(join(tmpdir(),'classmate-screen-'));const s=new Screens(dir,()=>now);await s.init();
 assert.equal(s.authorized('가'.repeat(64)),false);assert.equal(s.authorized(s.key),true);
 const {binding}=s.start('fixture');s.receive({binding,jpeg:'data:image/jpeg;base64,/9j/AA=='});const cap=s.capture('study-1');
 await s.retain(cap.screen_id,'study-1');await assert.rejects(s.get(cap.screen_id,'study-2'));
 now+=11000;assert.equal(s.status().connected,false);assert.throws(()=>s.capture('study-1'));
 s.start('next');assert.throws(()=>s.receive({binding,jpeg:'data:image/jpeg;base64,/9j/AA=='}));
 const restored=new Screens(dir);await restored.init();assert.equal((await restored.get(cap.screen_id,'study-1')).title,'fixture');assert.equal(restored.key,s.key);
});
test('HTTP acceptance freezes range and screen, emits answer, and denies general web access to screen routes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'classmate-http-'));let input,finish;let id=0;
 const source={bundleName:'fixture',paragraphs:structuredClone(paragraphs),recentQa:[],status:{daemon:'alive',tiroState:'connected'}};
 const core={connect:async()=>{},close(){},call:async(name)=>({structuredContent:name==='study_refresh'?source:{id:++id}})};
 const tutor={connect:async()=>({loggedIn:true}),answer:async(i,delta)=>{input=i;delta('시험 답변');await new Promise(r=>finish=r);return '시험 답변';},close(){}};
 const app=await startStudy({root:fileURLToPath(new URL('../../../',import.meta.url)),profile:dir,coreOverride:core,tutorOverride:tutor});
 const req=async(path,body,extra={})=>fetch(app.origin+path,{method:body===undefined?'GET':'POST',headers:{'x-classmate-key':app.token,...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
 try{
  const state=await(await req('/api/study')).json();const pair=JSON.parse(Buffer.from((await(await req('/api/screen-pair')).json()).code,'base64'));
  const ext={'origin':'chrome-extension://'+'a'.repeat(32),'x-classmate-screen-key':pair.key};
  assert.equal((await req('/api/screen/start',{}, {'origin':'https://example.com'})).status,403);
  const {binding}=await(await req('/api/screen/start',{title:'fixture'},ext)).json();
  assert.equal((await req('/api/screen/frame',{binding,jpeg:'data:image/jpeg;base64,/9j/AA=='},ext)).status,200);
  assert.equal((await req('/api/image',{jpeg:'data:image/svg+xml;base64,AAAA',study_id:state.studyId})).status,400);
  assert.equal((await req('/api/image',{jpeg:'data:image/jpeg;base64,/9j/AA==',study_id:state.studyId,paragraph_uuid:'missing'})).status,400);
  assert.equal((await req('/api/image',{jpeg:'data:image/jpeg;base64,/9j/AA==',study_id:state.studyId},{origin:'https://example.com'})).status,403);
  const pasted=await(await req('/api/image',{jpeg:'data:image/jpeg;base64,/9j/AA==',study_id:state.studyId})).json();assert.ok(pasted.screen_id);assert.equal(pasted.title,'직접 붙인 스크린샷');
  const image=await(await req('/api/capture',{study_id:state.studyId,paragraph_uuid:'p1'})).json();
  const post=await req('/api/question',{id:'request-test-0001',study_id:state.studyId,paragraph_uuid:'p1',selection:parts,screen_id:image.screen_id,pasted_image_id:pasted.screen_id,question:'연결 설명'});assert.equal(post.status,202);
  for(let i=0;i<100&&!finish;i++)await new Promise(r=>setTimeout(r,10));assert.ok(finish);assert.equal(input.filter(i=>i.type==='image').length,2);
  assert.equal(JSON.parse(input[0].text).referenceData.selectedRange.length,2);
  assert.equal((await req('/api/question',{id:'request-test-0002',question:'동시 질문'})).status,202);
  assert.equal((await(await req('/api/job/request-test-0002')).json()).state,'queued');
  await req('/api/cancel',{id:'request-test-0002'});assert.equal((await(await req('/api/job/request-test-0002')).json()).state,'cancelled');
  finish();for(let i=0;i<100;i++){const job=await(await req('/api/job/request-test-0001')).json();if(job.state==='done')break;await new Promise(r=>setTimeout(r,10));}
  const result=await(await req('/api/study')).json();assert.equal(result.recentQa[0].selection.length,2);assert.equal(result.recentQa[0].screenId,image.screen_id);assert.equal(result.recentQa[0].pastedImageId,pasted.screen_id);
  const disk=new Screens(dir);await disk.init();assert.ok((await disk.get(pasted.screen_id,state.studyId)).image);await assert.rejects(disk.get(pasted.screen_id,'another-study'));
  for(const [suffix,options,count]of [['inherit',{},2],['exclude',{exclude_screen:true},1],['remove-paste',{pasted_image_id:null},1]]){
    input=undefined;finish=undefined;
    assert.equal((await req('/api/question',{id:'followup-test-'+suffix,study_id:state.studyId,paragraph_uuid:'p1',followup_id:result.recentQa[0].id,question:'이어서 설명',...options})).status,202);
    for(let i=0;i<100&&!finish;i++)await new Promise(r=>setTimeout(r,10));assert.ok(finish);assert.equal(input.filter(i=>i.type==='image').length,count);
    finish();for(let i=0;i<100;i++){if((await(await req('/api/job/followup-test-'+suffix)).json()).state==='done')break;await new Promise(r=>setTimeout(r,10));}
  }
  assert.equal((await req('/api/question',{id:'bad-attachment-0001',question:'invalid',pasted_image_id:{id:'bad'}})).status,400);
 }finally{finish?.();await app.close();}
});
test('queued requests run FIFO with frozen evidence and continue after failure',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'classmate-queue-'));const calls=[];const releases=[];let saved=0;
 const source={bundleName:'queue fixture',paragraphs:structuredClone(paragraphs),recentQa:[],status:{daemon:'alive',tiroState:'connected'}};
 const core={connect:async()=>{},close(){},call:async name=>({structuredContent:name==='study_refresh'?source:{id:++saved}})};
 const tutor={connect:async()=>({loggedIn:true}),close(){},answer:async input=>{const request=JSON.parse(input[0].text);calls.push(request);await new Promise(r=>releases.push(r));if(request.question==='first')throw Error('fixture failure');return request.question+' answer';}};
 const app=await startStudy({root:fileURLToPath(new URL('../../../',import.meta.url)),profile:dir,coreOverride:core,tutorOverride:tutor});
 const req=async(path,data)=>{const r=await fetch(app.origin+'/api/'+path,{method:data?'POST':'GET',headers:{'x-classmate-key':app.token,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});assert.ok(r.ok);return r.json();};
 const until=async condition=>{for(let i=0;i<200;i++){if(await condition())return;await new Promise(r=>setTimeout(r,10));}assert.fail('queue timed out');};
 try{const state=await req('study');for(const [i,question]of ['first','second','third'].entries())await req('question',{id:'queue-request-'+i,question,study_id:state.studyId,paragraph_uuid:'p1'});
 await until(()=>calls.length===1);assert.equal((await req('job/queue-request-2')).queuePosition,2);
 source.paragraphs[1].text='changed after acceptance';releases.shift()();await until(()=>calls.length===2);assert.equal(calls[1].referenceData.selected.text,paragraphs[1].text);
 releases.shift()();await until(()=>calls.length===3);releases.shift()();await until(async()=>(await req('job/queue-request-2')).state==='done');assert.deepEqual(calls.map(c=>c.question),['first','second','third']);assert.equal((await req('job/queue-request-0')).state,'error');
 }finally{for(const release of releases)release();await app.close();}
});

test('multi-photo questions preserve order and saved follow-ups and reject foreign or oversized lists',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'classmate-photo-list-'));
 const source={bundleName:'사진 시험',paragraphs:structuredClone(paragraphs),recentQa:[],status:{daemon:'alive',tiroState:'connected'}};
 let saved=0;
 const core={connect:async()=>{},close(){},call:async name=>({structuredContent:name==='study_refresh'?source:{id:++saved}})};
 const deliveries=[];
 const tutor={connect:async()=>({loggedIn:true}),close(){},answer:async(input,_delta,_signal,web,mode)=>{
   deliveries.push({input,mode});
   if(mode==='fetch'){
     web({id:'fixture-read',kind:'fetch',state:'searching'});
     web({id:'fixture-read',kind:'fetch',state:'complete'});
   }
   return '사진 확인';
 }};
 const app=await startStudy({root:fileURLToPath(new URL('../../../',import.meta.url)),profile:dir,coreOverride:core,tutorOverride:tutor});
 const req=(path,body)=>fetch(app.origin+'/api/'+path,{method:body?'POST':'GET',headers:{'x-classmate-key':app.token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const read=async(path,body)=>{const response=await req(path,body);assert.ok(response.ok);return response.json();};
 const submit=async(options)=>{
   const id=randomUUID();
   assert.equal((await req('question',{id,question:'사진을 확인해 주세요',...options})).status,202);
   for(let i=0;i<100;i++){
     const job=await read('job/'+id);
     if(job.state==='done')return job;
     assert.notEqual(job.state,'error');
     await new Promise(resolve=>setTimeout(resolve,10));
   }
   assert.fail('photo question was not saved');
 };
 try{
   const {studyId}=await read('study');
   const jpegs=['/9j/AA==','/9j/AQ==','/9j/Ag=='].map(value=>'data:image/jpeg;base64,'+value);
   const ids=[];
   for(const jpeg of jpegs)ids.push((await read('image',{study_id:studyId,paragraph_uuid:'p1',jpeg})).screen_id);
   const ordered=[ids[2],ids[0],ids[1]];
   const first=await submit({study_id:studyId,paragraph_uuid:'p1',pasted_image_ids:ordered,search_mode:'fetch'});
   assert.equal(first.photoCount,3);
   assert.equal(deliveries[0].mode,'fetch');
   assert.deepEqual(deliveries[0].input.slice(1).map(item=>item.url),[jpegs[2],jpegs[0],jpegs[1]]);
   assert.deepEqual(JSON.parse(deliveries[0].input[0].text).imageOrder,['첨부 사진 1','첨부 사진 2','첨부 사진 3']);
   const stored=(await read('study')).recentQa.find(answer=>answer.id===first.savedId);
   assert.deepEqual(stored.pastedImageIds,ordered);
   await submit({study_id:studyId,paragraph_uuid:'p1',followup_id:stored.id,pasted_image_ids:[ids[1],ids[2]],search_mode:'off'});
   assert.equal(deliveries[1].mode,'off');
   assert.deepEqual(deliveries[1].input.slice(1).map(item=>item.url),[jpegs[1],jpegs[2]]);
   await submit({study_id:studyId,paragraph_uuid:'p1',followup_id:stored.id,pasted_image_ids:[]});
   assert.equal(deliveries[2].input.length,1);
   await submit({study_id:studyId,paragraph_uuid:'p1',followup_id:stored.id});
   assert.deepEqual(deliveries[3].input.slice(1).map(item=>item.url),[jpegs[2],jpegs[0],jpegs[1]]);
   for(const invalid of [[ids[0],ids[0]],Array.from({length:9},()=>randomUUID())]){
     assert.equal((await req('question',{id:randomUUID(),question:'invalid',study_id:studyId,pasted_image_ids:invalid})).status,400);
   }
   const other=await read('studies',{name:'다른 세션'});
   assert.equal((await req('question',{id:randomUUID(),question:'다른 수업 사진',study_id:other.studyId,pasted_image_ids:[ids[0]]})).status,400);
   assert.equal(deliveries.length,4);
 }finally{await app.close();}
});
