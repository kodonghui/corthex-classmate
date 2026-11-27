import {test} from 'node:test';
import assert from 'node:assert/strict';
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
  const image=await(await req('/api/capture',{study_id:state.studyId,paragraph_uuid:'p1'})).json();
  const post=await req('/api/question',{id:'request-test-0001',study_id:state.studyId,paragraph_uuid:'p1',selection:parts,screen_id:image.screen_id,question:'연결 설명'});assert.equal(post.status,202);
  for(let i=0;i<100&&!finish;i++)await new Promise(r=>setTimeout(r,10));assert.ok(finish);assert.equal(input.filter(i=>i.type==='image').length,1);
  assert.equal(JSON.parse(input[0].text).referenceData.selectedRange.length,2);
  assert.equal((await req('/api/question',{id:'request-test-0002',question:'동시 질문'})).status,202);
  assert.equal((await(await req('/api/job/request-test-0002')).json()).state,'queued');
  await req('/api/cancel',{id:'request-test-0002'});assert.equal((await(await req('/api/job/request-test-0002')).json()).state,'cancelled');
  finish();for(let i=0;i<100;i++){const job=await(await req('/api/job/request-test-0001')).json();if(job.state==='done')break;await new Promise(r=>setTimeout(r,10));}
  const result=await(await req('/api/study')).json();assert.equal(result.recentQa[0].selection.length,2);assert.equal(result.recentQa[0].screenId,image.screen_id);
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
