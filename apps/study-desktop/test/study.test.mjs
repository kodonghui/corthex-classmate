import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Rpc} from '../rpc.mjs';
import {selectContext,validPreferences} from '../server.mjs';
import {MODEL,EFFORT,DISABLED_FEATURES} from '../tutor.mjs';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Studies} from '../studies.mjs';
import {WindowLease} from '../window-lease.mjs';
import {CoreConnection} from '../core-connection.mjs';

test('JSON-RPC initialized notification is versioned and timeout does not swallow errors',async()=>{
 const rpc=new Rpc(process.execPath,[fileURLToPath(new URL('./rpc-fixture.mjs',import.meta.url))]);
 try{rpc.notify('notifications/initialized');assert.equal((await rpc.request('check')).initialized,true);await assert.rejects(rpc.request('silence',{},10));assert.equal((await rpc.request('check')).initialized,true);}finally{rpc.close();}
});
test('context preserves selected paragraph, nearby lesson and same-thread followups, with bounds',()=>{
 const paragraphs=Array.from({length:8},(_,i)=>({uuid:String(i),text:String(i).repeat(13000),timeFrom:'start',timeTo:'end'}));
 const recentQa=Array.from({length:12},(_,i)=>({paragraphUuid:i%2?'4':'5',question:`q${i}`,answer:'answer'}));
 const c=selectContext({paragraphs,recentQa},'4');
 assert.equal(c.selected.text.length,12000);assert.deepEqual(c.nearby.map(p=>p.text[0]),['2','3','4','5']);assert.equal(c.previous.length,6);assert.equal(c.otherRecentQuestions.length,2);
 assert.throws(()=>selectContext({paragraphs,recentQa},'missing'));
});
test('preferences and fixed tutor configuration cannot grant execution or switch models',()=>{
 assert.equal(validPreferences({transcript:19,answer:18,height:82}),true);
 assert.equal(validPreferences({transcript:'19',answer:18,height:82}),false);
 assert.equal(validPreferences({transcript:999,answer:18,height:82}),false);
 assert.equal(MODEL,'gpt-5.6-terra');assert.equal(EFFORT,'high');
 for(const feature of ['shell_tool','unified_exec','apply_patch_freeform','apps','plugins','computer_use'])assert.ok(DISABLED_FEATURES.includes(feature));
});

test('study boundaries retain old paragraphs, isolate chat and survive a restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'classmate-index-test-'));let s=new Studies(dir);
 const p=(uuid,text)=>({uuid,text,timeFrom:'2026-09-11T00:00:00Z',timeTo:'2026-09-11T00:01:00Z'});
 const source={bundleName:'Spring 01~03',paragraphs:[p('old','첫 수업')],recentQa:[{id:1,question:'이전 질문',answer:'이전 답'}]};
 assert.equal(s.ingest(source),1);const first=s.active;assert.equal(s.ingest(source),0);
 const second=s.create('Spring 04~06');assert.equal(s.snapshot(source,second).paragraphs.length,0);
 source.paragraphs=[p('old','첫 수업 수정'),p('new','다음 수업')];s.ingest(source);
 assert.deepEqual(s.snapshot(source,first).paragraphs.map(p=>p.text),['첫 수업 수정']);
 assert.deepEqual(s.snapshot(source,second).paragraphs.map(p=>p.uuid),['new']);
 s.save(second,{id:2,question:'자유 질문',answer:'새 답'});
 assert.deepEqual(s.snapshot(source,first).recentQa.map(q=>q.id),[1]);
 s.close();s=new Studies(dir);
 assert.equal(s.active,second);assert.equal(s.list().length,2);
 assert.deepEqual(s.snapshot(source,second).recentQa.map(q=>q.id),[2]);
 const context=selectContext(s.snapshot(source,second));assert.equal(context.previous[0].question,'자유 질문');assert.equal(context.recentLesson.length,1);
 s.edit(second,'rename','정리한 Spring');assert.equal(s.snapshot(source,second).bundleName,'정리한 Spring');
 const replacement=s.edit(second,'trash');assert.notEqual(replacement,second);assert.equal(s.snapshot(source,replacement).paragraphs.length,0);
 assert.throws(()=>s.snapshot(source,second));assert.ok(s.list().find(x=>x.id===second).deletedAt);
 s.close();s=new Studies(dir);s.edit(second,'restore');assert.equal(s.snapshot(source,second).recentQa[0].answer,'새 답');assert.equal(s.active,replacement);
 assert.throws(()=>s.edit(second,'rename',' '));assert.throws(()=>s.edit('missing','trash'));assert.throws(()=>s.create('   '));assert.throws(()=>s.snapshot(source,'missing'));s.close();
});

test('API locked is a paywall flag, never a reason to copy a paragraph into a new session',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'classmate-live-index-'));const s=new Studies(dir);
 const source={bundleName:'one',recentQa:[],paragraphs:[{uuid:'live',text:'앞부분',locked:false,timeFrom:'2026-09-01'}]};
 s.ingest(source);const old=s.active;const next=s.create('two');
 assert.equal(s.ingest(source),0);assert.equal(s.snapshot(source).paragraphs.length,0);
 source.paragraphs[0].text+=' 뒷부분';s.ingest(source);
 assert.equal(s.snapshot(source,next).paragraphs.length,0);
 assert.equal(s.snapshot(source,old).paragraphs.length,1);
 source.paragraphs[0].locked=true;s.ingest(source);s.create('three');source.paragraphs[0].text+=' 오타수정';s.ingest(source);
 assert.equal(s.snapshot(source).paragraphs.length,0);
 source.paragraphs.push({uuid:'placeholder',text:'',locked:false,timeFrom:'2026-09-02'});s.ingest(source);
 assert.equal(s.snapshot(source).paragraphs.length,0);source.paragraphs[1].text='처음 도착한 글';s.ingest(source);
 assert.equal(s.snapshot(source).paragraphs.length,1);s.close();
});

test('window leases tolerate reload/background tabs but stop after the last close',()=>{
 let time=0;const lease=new WindowLease(()=>time);assert.equal(lease.expired(),false);
 lease.touch('first');lease.touch('second');lease.touch('first',false);time=9000;assert.equal(lease.expired(),false);
 lease.touch('second',false);time+=7000;assert.equal(lease.expired(),false);
 lease.touch('reloaded');time+=70000;assert.equal(lease.expired(),false);
 lease.touch('reloaded',false);time+=8000;assert.equal(lease.expired(),true);
});

test('previously hidden old Core rows do not become new-session transcript on a reorder',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'classmate-old-arrival-'));const s=new Studies(dir);
 const source={bundleName:'first',recentQa:[],paragraphs:[],paragraphReceivedAt:{}};
 s.ingest(source);s.create('new');source.paragraphs=[{uuid:'previously-hidden',text:'older lesson',timeFrom:'2026-09-01',locked:false}];source.paragraphReceivedAt['previously-hidden']='2026-01-01T00:00:00Z';
 s.ingest(source);assert.equal(s.snapshot(source).paragraphs.length,0);
 source.paragraphReceivedAt['previously-hidden']=new Date().toISOString();source.paragraphs[0].text+=' newly received update';
 s.ingest(source);assert.equal(s.snapshot(source).paragraphs.length,1);s.close();
});

test('Core bridge reconnects after exit without replaying uncertain writes',async()=>{
 const instances=[];const c=new CoreConnection('fixture',{rpcFactory:()=>{const r={closed:false,requests:[],async request(method){this.requests.push(method);if(this.closed)throw new Error('gone');return {structuredContent:{}};},notify(){},close(){this.closed=true;}};instances.push(r);return r;}});
 await c.call('study_refresh');assert.equal(instances.length,1);instances[0].closed=true;
 await assert.rejects(c.call('study_refresh'));c.nextAttempt=0;await c.call('study_refresh');assert.equal(instances.length,2);
 instances[1].request=async()=>{throw new Error('uncertain');};
 await assert.rejects(c.call('session_log'));assert.equal(instances.length,2);assert.equal(instances[1].closed,false);
 await assert.rejects(c.call('study_refresh'));assert.equal(instances[1].closed,true);c.close();await assert.rejects(c.call('study_refresh'));
});

test('one-time delivery boundary repair preserves old imports in another history without changing active session',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'classmate-boundary-repair-'));const s=new Studies(dir);
 const source={bundleName:'first',recentQa:[],paragraphs:[]};s.ingest(source);const active=s.create('current');
 source.paragraphs=[{uuid:'old',text:'보존할 과거 기록',timeFrom:'2026-01-01',locked:true}];s.ingest(source);s.save(active,{id:1,paragraphUuid:'old',question:'q',answer:'a'});
 source.paragraphReceivedAt={old:'2026-01-01T00:00:00Z'};s.ingest(source);
 assert.equal(s.active,active);assert.equal(s.snapshot(source).paragraphs.length,0);
 const recovered=s.list().find(x=>x.name==='이전 기록');assert.equal(s.snapshot(source,recovered.id).paragraphs[0].text,'보존할 과거 기록');assert.equal(s.snapshot(source,recovered.id).recentQa[0].answer,'a');
 const count=s.list().length;s.ingest(source);assert.equal(s.list().length,count);s.close();
});
