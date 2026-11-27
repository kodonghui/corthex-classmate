import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {Rpc} from '../rpc.mjs';
import {startStudy} from '../server.mjs';
import {OrcaTranscript} from '../orca-transcript.mjs';
import {canonicalShareUrl} from '../share-source.mjs';

const liveStatus = () => ({state:'connected', lastCheckedAt:new Date().toISOString()});
const fakeUrl = 'https://tiro.ooo/s/synthetic-only';
const appRoot = fileURLToPath(new URL('../../../', import.meta.url));
const mcpPath = fileURLToPath(new URL('../orca-context-mcp.mjs', import.meta.url));
const call = (rpc, name) => rpc.request('tools/call', {name, arguments:{}});

async function initialize(rpc) {
  const result = await rpc.request('initialize', {protocolVersion:'2025-11-25', capabilities:{}, clientInfo:{name:'local verifier',version:'1'}});
  assert.equal(result.protocolVersion, '2025-11-25');
  assert.equal(result.serverInfo.name, 'classmate-context');
  assert.deepEqual(result.capabilities, {tools:{}});
  rpc.notify('notifications/initialized');
  const {tools} = await rpc.request('tools/list');
  assert.deepEqual(tools.map(tool => tool.name), ['recent_tiro_transcript','capture_selected_window']);
  assert.equal(tools.every(tool => tool.inputSchema.additionalProperties === false), true);
}

test('the current source must match and be fresh, and initial history and unselected rows stay out', () => {
  const transcript = new OrcaTranscript();
  const source = {id:'one', key:'bound', mode:'share', url:fakeUrl};
  const time = '2026-11-26T00:00:00.000Z';
  const now = Date.parse(time);
  const reader = {source, state:{state:'connected', lastCheckedAt:time}, page:{url:()=>fakeUrl, isClosed:()=>false}};
  const rows = ['old history','last live'].map((text, index) => ({text, sourceIndex:index, timeTo:time, live:index===1}));
  transcript.observe([], rows);
  assert.deepEqual(transcript.read(source, reader, canonicalShareUrl, now), {status:'ok', paragraphs:[{text:'last live', observedAt:time}]});
  assert.equal(transcript.read(null, reader, canonicalShareUrl, now).status, 'no-selection');
  assert.equal(transcript.read({...source, key:'other'}, reader, canonicalShareUrl, now).status, 'unavailable');
  assert.equal(transcript.read(source, reader, canonicalShareUrl, now+5_001).status, 'unavailable');
  reader.page.url = () => 'https://tiro.ooo/s/unselected-fixture';
  assert.equal(transcript.read(source, reader, canonicalShareUrl, now).status, 'unavailable');
  reader.page.url = () => fakeUrl;
  reader.state.lastCheckedAt = new Date(now+120_001).toISOString();
  assert.equal(transcript.read(source, reader, canonicalShareUrl, now+120_001).status, 'no-recent-transcript');
  transcript.reset();
  transcript.observe([], [{...rows[1], live:false}]);
  reader.state.lastCheckedAt = time;
  assert.equal(transcript.read(source, reader, canonicalShareUrl, now).status, 'no-recent-transcript');
});

test('stdio MCP serves bounded synthetic current Tiro text via the authenticated loopback endpoint', {timeout:15000}, async () => {
  const localAppData = await mkdtemp(join(tmpdir(),'orca-context-transcript-'));
  const profile = join(localAppData,'CorthexClassmate','study-desktop');
  let push;
  const reader = {
    state:{state:'unlinked'},
    async connect(source) {this.source=source;this.state=liveStatus();this.page={url:()=>source.url,isClosed:()=>false};},
    async close() {},
  };
  const core = {async connect(){}, close(){}, async ingestShare(){}, async call(){
    return {structuredContent:{bundleName:'synthetic legacy',paragraphs:[],recentQa:[]}};
  }};
  const app = await startStudy({root:appRoot, profile, coreOverride:core,
    shareReaderFactory:({onSnapshot})=>{push=onSnapshot;return reader;}});
  const rpc = new Rpc(process.execPath,[mcpPath],{env:{...process.env, LOCALAPPDATA:localAppData}});
  try {
    await writeFile(join(profile,'running.json'), JSON.stringify({origin:app.origin+'/',token:app.token,pid:process.pid}));
    const headers = {'x-classmate-key':app.token, 'content-type':'application/json'};
    const route = app.origin+'/api/orca-context/transcript';
    assert.equal((await fetch(route)).status,401);
    assert.equal((await fetch(route,{method:'HEAD',headers})).status,204);
    assert.equal((await fetch(route,{headers:{...headers,origin:'https://outside.invalid'}})).status,403);
    await initialize(rpc);
    assert.equal((await call(rpc,'recent_tiro_transcript')).isError,true);
    assert.equal((await call(rpc,'capture_selected_window')).isError,true);
    await assert.rejects(rpc.request('tools/call',{name:'capture_selected_window',arguments:{window:'override'}}));
    const created = await fetch(app.origin+'/api/studies',{method:'POST',headers,body:JSON.stringify({name:'synthetic lesson',url:fakeUrl})});
    assert.equal(created.status,201);
    await push(reader.source,{paragraphs:[{text:'historical synthetic row', live:false},{text:'fresh synthetic row',live:true}]});
    const result = await call(rpc,'recent_tiro_transcript');
    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse(result.content[1].text).map(item=>item.text), ['fresh synthetic row']);
    assert.doesNotMatch(JSON.stringify(result), /historical|synthetic lesson|tiro\.ooo/);
    reader.page.isClosed = () => true;
    assert.equal((await call(rpc,'recent_tiro_transcript')).isError,true);
    const next = await fetch(app.origin+'/api/studies',{method:'POST',headers,body:JSON.stringify({name:'new unselected synthetic lesson'})});
    assert.equal(next.status,201);
    assert.equal((await call(rpc,'recent_tiro_transcript')).isError,true);
  } finally {rpc.close(); await app.close(); await rm(localAppData,{recursive:true,force:true});}
});

test('stdio returns exactly one fresh JPEG of the synthetic window and fails closed after mismatch or exit',
  {skip:process.platform!=='win32',timeout:40000}, async () => {
    const localAppData = await mkdtemp(join(tmpdir(),'orca-context-window-'));
    const profile = join(localAppData,'CorthexClassmate');
    await mkdir(profile);
    const selection = join(profile,'orca-context-window.json');
    const rpc = new Rpc(process.execPath,[mcpPath],{env:{...process.env, LOCALAPPDATA:localAppData}});
    const fixturePath = fileURLToPath(new URL('orca-window-fixture.ps1',import.meta.url));
    const powershell = join(process.env.WINDIR,'System32','WindowsPowerShell','v1.0','powershell.exe');
    const window = spawn(powershell,['-NoProfile','-NonInteractive','-File',fixturePath],{windowsHide:true,stdio:['ignore','pipe','inherit']});
    const fixture = createInterface({input:window.stdout});
    const exit = once(window,'exit');
    const saved = target => writeFile(selection,JSON.stringify(target));
    try {
      const [line] = await Promise.race([once(fixture,'line'), exit.then(()=>{throw Error('Synthetic window exited');})]);
      const target = JSON.parse(line);
      await initialize(rpc);
      await saved({...target,selectedAt:Date.now()-7_200_001});
      assert.equal((await call(rpc,'capture_selected_window')).isError,true);
      await saved({...target,titleHash:Buffer.alloc(32).toString('base64')});
      assert.equal((await call(rpc,'capture_selected_window')).isError,true);
      await saved(target);
      const result = await call(rpc,'capture_selected_window');
      assert.equal(result.isError, undefined, JSON.stringify(result.isError ? result : {}));
      assert.equal(result.content.length,1);
      assert.equal(result.content[0].type,'image');
      assert.equal(result.content[0].mimeType,'image/jpeg');
      const bytes = Buffer.from(result.content[0].data,'base64');
      assert.ok(bytes.length > 1000 && bytes.length <= 900000);
      assert.deepEqual([...bytes.subarray(0,3)],[255,216,255]);
      window.kill();
      await exit;
      assert.equal((await call(rpc,'capture_selected_window')).isError,true);
    } finally {fixture.close(); window.kill(); rpc.close(); await rm(localAppData,{recursive:true,force:true});}
  });
