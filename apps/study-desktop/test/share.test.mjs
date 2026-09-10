import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {canonicalShareUrl,mapShareRows} from '../share-source.mjs';
import {Studies} from '../studies.mjs';

test('only bounded public Tiro share URLs; strip tracking, reject credentials, local network and unrelated paths',()=>{
 assert.equal(canonicalShareUrl('https://tiro.ooo/ko/s/fixture-not-real?utm_source=copy#x'),'https://tiro.ooo/s/fixture-not-real');
 for(const value of ['http://tiro.ooo/s/fixture-not-real','https://tiro.ooo.evil.test/s/fixture-not-real','https://user:pass@tiro.ooo/s/fixture-not-real','https://127.0.0.1/s/fixture-not-real','https://tiro.ooo:8443/s/fixture-not-real','file:///C:/secret','https://tiro.ooo/login','https://tiro.ooo/s/fixture-not-real/extra'])assert.throws(()=>canonicalShareUrl(value));
});
test('share paragraph identity, progress and timestamps survive repeat observations',()=>{
 const a=mapShareRows('share-key',[{text:'앞',live:true}],[],'2026-09-11T01:00:00Z');
 const b=mapShareRows('share-key',[{text:'앞 뒤',live:true}],a,'2026-09-11T01:00:01Z');
 assert.equal(a[0].uuid,b[0].uuid);assert.equal(a[0].timeFrom,b[0].timeFrom);assert.notEqual(a[0].timeTo,b[0].timeTo);assert.equal(b[0].timeBasis,'observed');assert.equal(b[0].locked,false);
 assert.deepEqual(mapShareRows('share-key',[{text:'앞 뒤',live:true}],b,'2026-09-11T01:00:02Z'),b);
 assert.throws(()=>mapShareRows('share-key',[],b));
});
test('explicit sources isolate recordings from automatic API rows and preserve old answers across restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'classmate-share-test-'));let s=new Studies(dir);
 s.ingest({bundleName:'old',paragraphs:[],recentQa:[]});
 const a=s.create('영상 A',{mode:'none'});const source=s.connectShare(a,'https://tiro.ooo/s/fixture-not-real');
 const rows=s.prepareShare(source,{paragraphs:[{text:'공유 전사 A',live:true}]});s.saveShare(source,rows);s.save(a,{id:99,paragraphUuid:rows[0].uuid,question:'q',answer:'a'});
 const b=s.create('영상 B',{mode:'none'});s.connectShare(b,'https://tiro.ooo/s/fixture-two-not-real');
 const api={paragraphs:[{uuid:'api',text:'다른 계정 노트',timeFrom:'2026-09-11'}],recentQa:[]};s.ingest(api);
 assert.equal(s.snapshot(api,b).paragraphs.length,0);assert.equal(s.snapshot(api,a).paragraphs.length,1);assert.equal(s.snapshot(api,a).recentQa.length,1);
 assert.throws(()=>s.connectShare(a,'https://tiro.ooo/s/fixture-three-not-real'));
 s.close();s=new Studies(dir);assert.equal(s.source(a).url,'https://tiro.ooo/s/fixture-not-real');assert.equal(s.source(a).key,source.key);assert.equal(s.shareRows(a)[0].uuid,rows[0].uuid);s.close();
});
