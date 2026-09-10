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
