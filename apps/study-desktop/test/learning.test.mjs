import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {test} from 'node:test';
import {Replay,replayRows} from '../replay.mjs';
import {Review} from '../review.mjs';
import {Studies} from '../studies.mjs';
import {WindowLease} from '../window-lease.mjs';

const source = {bundleName:'isolated',paragraphs:[],recentQa:[]};

test('Classmate 2 replay formats sort by input sequence and reject invalid data', () => {
  assert.deepEqual(replayRows([
    {text:'첫 문단',arrivedAt:'2026-11-25T23:59:58+09:00'},
    {text:'둘째 문단',arrivedAt:'2026-11-26T00:00:01+09:00'},
  ]).map(p=>p.offsetMs), [0,3000]);
  for (const input of [
    [],
    [{text:'bad',arrivedAt:'2026-02-30T12:30:00Z'}],
    [{text:'bad',offsetMs:5},{text:'too early',offsetMs:0}],
    [{text:'bad',offsetMs:86400001}],
    [{text:'bad',offsetMs:0},{text:'mixed format',arrivedAt:'2026-11-25T23:59:58+09:00'}],
  ]) assert.throws(()=>replayRows(input));
});

test('replay pauses, survives database reopen, resumes without duplicate paragraphs', async () => {
  const profile=await mkdtemp(join(tmpdir(),'classmate-replay-test-'));
  let studies=new Studies(profile);
  let replay=new Replay(studies);
  const id=replay.create('replay',[{text:'A',offsetMs:0},{text:'B',offsetMs:300},{text:'C',offsetMs:300}],1);
  try {
    replay.start(id);
    for(let i=0;i<50&&replay.status(id).replay.played===0;i++)await delay(5);
    replay.stop(id);
    assert.equal(replay.status(id).replay.played,1);
    assert.equal(replay.status(id).state,'replay_paused');
    studies.close();
    studies=new Studies(profile);
    replay=new Replay(studies);
    replay.start(id);
    for(let i=0;i<100&&replay.status(id).state!=='replay_done';i++)await delay(10);
    assert.equal(replay.status(id).state,'replay_done');
    assert.deepEqual(studies.snapshot(source,id).paragraphs.map(p=>p.text),['A','B','C']);
  } finally {replay.stop();studies.close();}
});

test('a mistaken Tiro source can be corrected only before the transcript has arrived', async () => {
  const profile=await mkdtemp(join(tmpdir(),'classmate-share-correction-'));
  const studies=new Studies(profile);
  try {
    const id=studies.create('link',{mode:'none'});
    const before=studies.connectShare(id,'https://tiro.ooo/s/fixture-local-one');
    const after=studies.connectShare(id,'https://tiro.ooo/s/fixture-local-two');
    assert.notEqual(before.key,after.key);
    assert.equal(studies.connectShare(id,'https://tiro.ooo/s/fixture-local-two').key,after.key);
    assert.equal(studies.saveShare(before,[{uuid:'late'}]),0);
    studies.saveShare(after,[{uuid:'first',text:'합성 전사',source:'tiro-share',timeFrom:'2026-11-26T07:00:00Z'}]);
    assert.throws(()=>studies.disconnectEmptyShare(id));
    assert.throws(()=>studies.connectShare(id,'https://tiro.ooo/s/fixture-local-three'));
    assert.equal(studies.snapshot(source,id).paragraphs[0].text,'합성 전사');
  } finally {studies.close();}
});

test('review cards enforce another window’s lease and schedule by local day', async () => {
  const profile=await mkdtemp(join(tmpdir(),'classmate-cards-test-'));
  const studies=new Studies(profile);
  let now=new Date(2026,10,26,23,59).getTime();
  const review=new Review(studies,()=>now);
  review.init();
  try {
    const id=studies.create('cards',{mode:'none'});
    studies.db.prepare('INSERT INTO review_cards VALUES(?,?,?,?,?)').run('card',id,'2026-11-26',0,JSON.stringify({
      id:'card',front:'합성 질문',back:'합성 정답',streak:0,
    }));
    const lease=new WindowLease(()=>now);
    lease.touch('win1');
    lease.touch('win2');
    assert.equal(review.cards('open','win1',{},lease).card.back,undefined);
    assert.throws(()=>review.cards('open','win2',{},lease));
    assert.throws(()=>review.cards('grade','win1',{id:'card',result:'right'},lease));
    assert.equal(review.cards('answer','win1',{id:'card',text:'내 답',confidence:'sure'},lease).card.back,'합성 정답');
    lease.touch('win1',false);
    assert.equal(review.cards('open','win2',{},lease).card.response.text,'내 답');
    assert.equal(review.cards('grade','win2',{id:'card',result:'right'},lease).nextDue,'2026-12-03');
    assert.equal(review.today().length,0);
    now=new Date(2026,11,3,0,1).getTime();
    assert.equal(review.today().length,1);
  } finally {studies.close();}
});
