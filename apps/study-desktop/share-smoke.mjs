// Real browser DOM -> private Core RPC/SQLite -> actual study UI. Synthetic data only.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {DatabaseSync} from 'node:sqlite';
import {startStudy} from './server.mjs';
import {ShareReader} from './share-source.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));const dir=await mkdtemp(join(tmpdir(),'classmate-share-e2e-'));
await writeFile(join(dir,'config.json'),JSON.stringify({timeline:{enabled:false}}));
let app,browser,reader,sourcePage,db;let answerCalls=0;
const tutor={async connect(){return {loggedIn:true};},async answer(input,delta){answerCalls++;const text='공유 전사를 참고한 합성 답변입니다.';delta(text);return text;},close(){}};
try{
 app=await startStudy({root,profile:join(dir,'profile'),coreDir:dir,coreExecutable:process.env.CLASSMATE_TEST_CORE_EXE,tutorOverride:tutor,shareReaderFactory:options=>(reader=new ShareReader({...options,launch:()=>chromium.launch({headless:true}),navigate:async page=>{sourcePage=page;await page.setContent('<main><h1>합성 수업</h1><div class="whitespace-pre-wrap font-semibold">공유 전사 첫 문장</div></main>');}}))});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1050,height:960}});await page.goto(app.url);
 await page.getByRole('button',{name:'＋ 새 세션',exact:true}).click();await page.getByLabel('세션 이름',{exact:true}).fill('테스트 수업 A');await page.getByLabel('Tiro 공유 링크',{exact:true}).fill('https://tiro.ooo/s/fixture-not-real?utm_source=test');await page.getByRole('button',{name:'세션 시작',exact:true}).click();
 await page.locator('.cm-tf__ln').filter({hasText:'공유 전사 첫 문장'}).waitFor();
 const started=Date.now();await sourcePage.locator('.whitespace-pre-wrap').evaluate(e=>{e.textContent='공유 전사 첫 문장 계속 쓰는 중';});
 await page.locator('.cm-tf__ln').filter({hasText:'계속 쓰는 중'}).waitFor();const visibleMs=Date.now()-started;assert.ok(visibleMs<2000);
 assert.equal(await page.locator('.cm-tf__ln').count(),1);
 // Screen fixture is unavailable; the normal transcript-only question still saves.
 await page.route('**/api/capture',r=>r.fulfill({status:500,contentType:'application/json',body:'{"error":"fixture: no screen"}'}));
 await page.locator('.cm-tf__ln').filter({hasText:'계속 쓰는 중'}).click();await page.getByRole('button',{name:'쉽게 설명해줘',exact:true}).click();
 await page.locator('.answer-body').filter({hasText:'공유 전사를 참고한 합성 답변'}).waitFor();
 const get=async()=>{const r=await fetch(app.origin+'/api/study',{headers:{'x-classmate-key':app.token}});return r.json();};
 let snap;for(let i=0;i<40;i++){snap=await get();if(snap.recentQa.length)break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(snap.recentQa.length,1);assert.equal(answerCalls,1);assert.equal(snap.paragraphs[0].timeBasis,'observed');const firstId=snap.studyId;
 db=new DatabaseSync(join(dir,'core.sqlite'));assert.equal(db.prepare('SELECT COUNT(*) n FROM paragraphs WHERE uuid=?').get(snap.paragraphs[0].uuid).n,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM qa_log').get().n,1);
 assert.ok(!JSON.stringify(snap.paragraphs).includes('fixture-not-real'));
 await page.getByRole('button',{name:'＋ 새 세션',exact:true}).click();await page.getByLabel('세션 이름',{exact:true}).fill('테스트 수업 B');await page.getByRole('button',{name:'세션 시작',exact:true}).click();
 await page.getByRole('heading',{name:'녹음을 연결해 주세요',exact:true}).waitFor();assert.equal((await get()).paragraphs.length,0);
 await page.getByLabel('세션 선택',{exact:true}).selectOption(firstId);await page.locator('.answer-body').filter({hasText:'합성 답변'}).waitFor();
 await page.setViewportSize({width:430,height:850});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 console.log(JSON.stringify({pass:true,shareChangeToVisibleMs:visibleMs,checks:['URL-form','incremental-same-paragraph','Core-mirror','inline-QA-save','session-isolation','history-answer-preserved','430px-layout'],audioLatency:'not measured'}));
}finally{await browser?.close();await reader?.close();db?.close();app?.close();}
