import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {startStudy} from './server.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {chromium}=createRequire(join(root,'packages/study-panel/package.json'))('playwright');
const dir=await mkdtemp(join(tmpdir(),'classmate-delivery-'));
await writeFile(join(dir,'config.json'),JSON.stringify({timeline:{enabled:false}}));
let app;let closed=false;let browser;let db;
const tutor={async connect(){return {loggedIn:true};},close(){}};
try{
 app=await startStudy({root,profile:join(dir,'profile'),coreDir:dir,coreExecutable:process.env.CLASSMATE_TEST_CORE_EXE,tutorOverride:tutor,onIdle:()=>{closed=true;app.close();}});
 db=new DatabaseSync(join(dir,'core.sqlite'));browser=await chromium.launch({headless:true});const page=await browser.newPage();const second=await browser.newPage();
 await page.goto(app.url);await second.goto(app.url);await page.getByRole('heading',{name:'전사 연결 복구 중',exact:true}).waitFor();
 const time=new Date().toISOString();const started=Date.now();
 db.prepare('INSERT INTO paragraphs(uuid,bundle_id,note_guid,text,time_from,time_to,time_from_ms,time_to_ms,locked,fetched_at) VALUES (?,1,?,?,?,?,?,?,0,?)').run('live','fixture','실시간 전사 시작',time,time,started,started,time);
 await page.locator('.cm-tf__ln').filter({hasText:'실시간 전사 시작'}).waitFor();const firstMs=Date.now()-started;
 const update=Date.now();db.prepare('UPDATE paragraphs SET text=?,fetched_at=? WHERE uuid=?').run('실시간 전사 시작 그리고 같은 문장 갱신',new Date().toISOString(),'live');
 await page.locator('.cm-tf__ln').filter({hasText:'같은 문장 갱신'}).waitFor();const updateMs=Date.now()-update;
 assert.ok(firstMs<2500&&updateMs<2500);
 await page.close({runBeforeUnload:true});await new Promise(r=>setTimeout(r,1200));assert.equal(closed,false);
 await second.close({runBeforeUnload:true});const closeAt=Date.now();while(!closed&&Date.now()-closeAt<12000)await new Promise(r=>setTimeout(r,200));assert.equal(closed,true);
 console.log(JSON.stringify({pass:true,firstMs,updateMs,closedAfterMs:Date.now()-closeAt,checks:['Core-to-visible-new-text','same-paragraph-visible-update','one-window-close-keeps-collecting','last-window-close-stops-service'],audioToTextLatency:'not measured'}));
}finally{await browser?.close();db?.close();app?.close();}
