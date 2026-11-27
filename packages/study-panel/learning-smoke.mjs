import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../../',import.meta.url));
const load = name => import(pathToFileURL(join(root,'apps/study-desktop',name)));
const [{startStudy},{Studies},{Review},{WindowScenes}] = await Promise.all(
  ['server.mjs','studies.mjs','review.mjs','window-scenes.mjs'].map(load));
const profile = await mkdtemp(join(tmpdir(),'classmate-learning-smoke-'));
const channel = process.env.CLASSMATE_UI_BROWSER || undefined;
const browser = await chromium.launch({headless:true,channel});
const context = await browser.newContext({viewport:{width:1000,height:900}});
await context.route('**/*',route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror',error => errors.push(error.message));
await page.addInitScript(() => {
  globalThis.displayRequests = 0;
  if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{
    value: async () => {globalThis.displayRequests++; throw Error('unexpected display picker');},
  });
});

const time = '2026-11-26T01:00:00Z';
const transcript = '합성 수업 전사 · 리스트의 두 번째 값을 찾습니다.';
const paragraph = {uuid:randomUUID(),text:transcript,timeFrom:time,timeTo:time,locked:true};
const lesson = {bundleName:'합성 이전 세션',paragraphs:[paragraph],recentQa:[],status:{daemon:'alive',tiroState:'connected'}};
const core = {
  async connect(){},
  close(){},
  async call(name){return {structuredContent:name==='study_refresh'?lesson:{id:2}};},
};
const oldAnswer = '**기존 답변 첫 문장** [[수업#1]] [[장면]]\n\n기존 상세 문단입니다. [[보탬]]\n\n1. 기존 목록 설명 [[수업#1]]\n2. 기존 확인 문장 [[확인]]\n\n인라인 코드 `[[확인]]` 보존\n\n```text\n[[보탬]]\n```';
const partialAnswer = '**새 답변 첫 문장** [[보';
const newAnswer = partialAnswer+'탬]]\n\n새 상세 문단입니다. [[장면]] [[확인]]\n\n- 새 목록 설명 [[수업#1]]';
let finishStream;
const streamCanFinish = new Promise(resolve=>{finishStream=resolve;});
const sent = [];
const tutor = {
  async connect(){return {loggedIn:true};},
  close(){},
  async answer(input,delta,_signal,_web,_mode,instructions){
    assert.doesNotMatch(instructions,/\[\[(?:수업#|장면|보탬|확인)/);
    assert.match(instructions,/list-cells/);
    sent.push(input);
    delta(partialAnswer);
    await streamCanFinish;
    delta(newAnswer.slice(partialAnswer.length));
    return newAnswer;
  },
};

let app;
const request = (path,data) => fetch(app.origin+'/api/'+path,{
  method:data===undefined?'GET':'POST',
  headers:{'x-classmate-key':app.token,'Content-Type':'application/json'},
  body:data===undefined?undefined:JSON.stringify(data),
});
const json = async (path,data) => {
  const response = await request(path,data);
  assert.equal(response.ok,true,path);
  return response.json();
};
const removedControls = [
  /3분\s*회상/,
  /^수업 화면 (?:끄기|보기|고르기|공유 중지)$/,
  /^자세히(?: 전개| 접기)?$/,
];
const assertAbsent = async () => {
  for(const name of removedControls) assert.equal(await page.getByRole('button',{name}).count(),0,String(name));
  assert.equal(await page.getByRole('heading',{name:'3분 회상'}).count(),0);
  assert.equal(await page.locator('.answer-grounding').count(),0);
  const prose = await page.locator('.answer-body').evaluateAll(bodies=>bodies.map(body=>{
    const clone=body.cloneNode(true);
    clone.querySelectorAll('code').forEach(code=>code.remove());
    return clone.textContent;
  }));
  for(const text of prose)assert.doesNotMatch(text,/수업에서 나온 말|AI가 보탠 말|\[\[(?:수업#\d+|장면|보탬|확인)\]\]/);
  assert.equal(await page.evaluate(() => globalThis.displayRequests),0);
};

try {
  const images = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const paint = canvas.getContext('2d');
    paint.fillStyle = '#067';
    paint.fillRect(0,0,16,16);
    return {jpeg:canvas.toDataURL('image/jpeg'),webp:canvas.toDataURL('image/webp')};
  });
  assert.match(images.webp,/^data:image\/webp;base64,/);
  const sceneId = randomUUID();
  const preferences = {transcript:22,answer:20,height:68,width:42,layout:'columns',fold:'none'};
  const settingsPath = join(profile,'reading-preferences.json');
  await writeFile(settingsPath,JSON.stringify(preferences));
  const seeded = new Studies(profile);
  seeded.ingest(lesson);
  new Review(seeded).init();
  new WindowScenes(profile,seeded);
  const id = seeded.active;
  const draft = JSON.stringify({state:'draft',answers:{core:'이전 회상 초안'}});
  seeded.db.exec('CREATE TABLE review_recalls (study_id TEXT PRIMARY KEY, data TEXT NOT NULL)');
  seeded.db.prepare('INSERT INTO review_recalls VALUES(?,?)').run(id,draft);
  const card = {id:'existing-card',front:'저장된 카드 질문',back:'저장된 카드 정답',streak:0};
  seeded.db.prepare('INSERT INTO review_cards VALUES(?,?,?,?,?)').run(card.id,id,'2000-01-01',0,JSON.stringify(card));
  seeded.db.prepare('INSERT INTO window_scenes VALUES(?,?,?)').run(sceneId,id,time);
  seeded.save(id,{id:1,askedAt:time,question:'기존 합성 질문',answer:oldAnswer,
    references:[paragraph.uuid],screenId:sceneId,screen:{captured_at:time},
    sent:{question:'기존 합성 질문',referenceData:{recentLesson:[{number:1,text:transcript}],previous:[{question:'보낸 이전 질문',answer:'보낸 이전 답변 [[보탬]] [[확인]]'}]},imageOrder:['수업 화면']}});
  seeded.close();
  await mkdir(join(profile,'lesson-scenes'));
  const sceneFile = join(profile,'lesson-scenes',sceneId+'.webp');
  const scene = Buffer.from(images.webp.split(',')[1],'base64');
  await writeFile(sceneFile,scene);

  app = await startStudy({root,profile,coreOverride:core,tutorOverride:tutor});
  await page.goto(app.url);
  const existing = page.getByTestId('answer-1');
  await existing.getByText('기존 상세 문단입니다.',{exact:false}).waitFor();
  await existing.getByText('기존 목록 설명',{exact:true}).waitFor();
  await existing.locator('.answer-body strong').getByText('기존 답변 첫 문장',{exact:true}).waitFor();
  assert.equal(await existing.locator('p code').textContent(),'[[확인]]');
  assert.equal(await existing.locator('pre code').textContent(),'[[보탬]]');
  assert.equal(await existing.getByText('확인 필요',{exact:true}).count(),0);
  await page.getByText(transcript,{exact:true}).waitFor();
  await page.getByLabel('수업 화면 포함').waitFor();
  await assertAbsent();

  await existing.getByText('AI에게 보낸 것',{exact:true}).click();
  const archivedImage = existing.getByRole('img',{name:'수업 화면',exact:true});
  await archivedImage.waitFor();
  await existing.getByText('보낸 이전 답변',{exact:true}).waitFor();
  await assertAbsent();
  await archivedImage.evaluate(image => image.decode());
  assert.equal(await archivedImage.getAttribute('src'),images.webp);
  assert.deepEqual(await json('preferences'),preferences);
  assert.equal((await request('review/recall',{studyId:id,action:'start'})).status,404);
  assert.equal((await request('window-scene',{studyId:id,webp:images.webp})).status,404);
  assert.equal((await json('study')).screen.connected,false);

  await page.getByRole('button',{name:'문단 ? 표시',exact:true}).click();
  await page.getByRole('button',{name:'문단 ? 표시 지우기'}).waitFor();
  assert.equal(sent.length,0);
  const {code} = await json('screen-pair');
  const {key} = JSON.parse(Buffer.from(code,'base64').toString());
  const extension = (path,data) => fetch(app.origin+'/api/screen/'+path,{
    method:'POST',
    headers:{'Content-Type':'application/json',Origin:'chrome-extension://'+'a'.repeat(32),'x-classmate-screen-key':key},
    body:JSON.stringify(data),
  });
  const started = await extension('start',{title:'합성 Chrome 수업 탭'});
  assert.equal(started.status,200);
  const {binding} = await started.json();
  const frame = {binding,jpeg:images.jpeg};
  assert.equal((await extension('frame',frame)).status,200);
  await page.getByText('수업 화면 연결됨',{exact:true}).waitFor();
  await assertAbsent();
  assert.equal((await extension('stop',{binding})).status,200);
  assert.equal((await extension('frame',frame)).status,400);
  await page.getByText('수업 화면 없음',{exact:true}).waitFor();
  await assertAbsent();

  await page.getByRole('button',{name:'오늘의 카드 1장'}).click();
  await page.getByRole('heading',{name:'오늘의 카드'}).waitFor();
  assert.deepEqual((await json('study')).paragraphs,[]);
  await page.getByRole('button',{name:'수업으로 돌아가기'}).click();
  await page.getByText(transcript,{exact:true}).waitFor();

  await page.getByRole('textbox',{name:'대화 질문'}).fill('새 합성 질문');
  await page.getByRole('button',{name:'대화 보내기'}).click();
  const liveAnswer = page.getByRole('article',{name:'생성 중인 답변'});
  await liveAnswer.getByText('새 답변 첫 문장',{exact:true}).waitFor();
  assert.doesNotMatch(await liveAnswer.locator('.answer-body').textContent(),/\[\[보/);
  await assertAbsent();
  finishStream();
  const fresh = page.getByTestId('answer-2');
  await fresh.getByText('새 상세 문단입니다.',{exact:true}).waitFor();
  await fresh.getByText('새 목록 설명',{exact:true}).waitFor();
  await assertAbsent();
  await fresh.getByText('AI에게 보낸 것',{exact:true}).click();
  await fresh.getByText('전사 #1',{exact:true}).waitFor();
  assert.equal(sent.length,1);
  assert.equal(sent[0].length,1);
  assert.equal((await json('study')).recentQa[0].answer,oldAnswer);
  assert.deepEqual(errors,[]);
  await context.close();
  await app.close();
  app = undefined;

  const persisted = new Studies(profile);
  try {
    assert.equal(persisted.db.prepare('SELECT data FROM review_recalls WHERE study_id=?').get(id).data,draft);
    assert.equal(persisted.answer(id,1).answer,oldAnswer);
    assert.equal(persisted.answer(id,2).answer,newAnswer);
    assert.equal(persisted.answer(id,2).answerFormat,undefined);
    assert.deepEqual(persisted.snapshot(lesson).paragraphs,[paragraph]);
    assert.deepEqual(persisted.db.prepare('SELECT data FROM review_cards WHERE id=?').get(card.id).data,JSON.stringify(card));
  } finally {persisted.close();}
  assert.deepEqual(await readFile(sceneFile),scene);
  assert.equal(await readFile(settingsPath,'utf8'),JSON.stringify(preferences));
  console.log('PASS: built study panel in isolated Edge profile. All answer grounding badges are absent from archived, streaming and new answers. Markdown and literal code remain. Full prose, transcript, archive, marks, cards and settings remain. Chrome screen start/stop endpoints work, with zero picker calls and page errors.');
} finally {
  finishStream();
  await browser.close();
  await app?.close();
}
