import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {Rpc} from '../rpc.mjs';
import {requestMeetFrame} from '../orca-meet.mjs';

const installer = fileURLToPath(new URL('../orca-meet-install.ps1',import.meta.url));
const worker = new URL('../orca-meet-extension/background.mjs',import.meta.url);
const entry = fileURLToPath(new URL('../orca-context-mcp.mjs',import.meta.url));
const origin = 'chrome-extension://ofochilajnihkbfhffpmnddcbjgeffli/';
const meeting = 'https://meet.google.com/abc-defg-hij';
const image = Buffer.from([255,216,255,0,255,217]).toString('base64');
const signal = () => {
  const handlers = [];
  return {addListener:fn => handlers.push(fn), emit:(...args) => handlers.forEach(fn=>fn(...args))};
};

async function until(condition) {
  for (let tries=0;tries<100;tries++) {
    if (condition()) return;
    await delay(25);
  }
  throw new Error('Fixture did not reach expected state');
}

function fixture(exe, env, local) {
  const storage = data => ({async get(key){return {[key]:data[key]};},async set(update){Object.assign(data,update);}});
  const state = {tab:{id:31,url:meeting,status:'complete',windowId:11,active:true},window:'normal',
    badge:'',requests:[],frames:0,events:[],authorized:true};
  const click = signal(), updated = signal(), removed = signal(), replaced = signal(), startup = signal();
  let child, exit;
  function connectNative() {
    assert.ok(!child);
    child = spawn(exe,[origin],{env,windowsHide:true,stdio:['pipe','pipe','ignore']});
    exit = once(child,'exit');
    const onMessage=signal(), onDisconnect=signal();
    child.on('exit',()=>onDisconnect.emit());
    let buffer=Buffer.alloc(0);
    child.stdout.on('data',chunk=>{
      buffer=Buffer.concat([buffer,chunk]);
      while(buffer.length>=4&&buffer.length>=4+buffer.readUInt32LE()) {
        const limit=4+buffer.readUInt32LE();
        const message=JSON.parse(buffer.subarray(4,limit));
        buffer=buffer.subarray(limit);
        state.events.push(message.type);
        onMessage.emit(message);
      }
    });
    return {onMessage,onDisconnect,postMessage(message){
      const bytes=Buffer.from(JSON.stringify(message));
      const size=Buffer.alloc(4);
      size.writeUInt32LE(bytes.length);
      child.stdin.write(Buffer.concat([size,bytes]));
    }};
  }
  const chrome = {
    action:{onClicked:click,async setBadgeText({text}){state.badge=text;}},
    storage:{local:storage(local),session:storage({})},
    tabs:{onUpdated:updated,onRemoved:removed,onReplaced:replaced,async get(id){
      if (state.tab?.id!==id) throw new Error();
      return {...state.tab,url:state.authorized?state.tab.url:undefined};
    }},
    windows:{async get(){return {state:state.window};}},
    tabCapture:{async getMediaStreamId({targetTabId}) { state.requests.push(targetTabId); return 'fixture-only'; }},
    offscreen:{async createDocument(){}},
    runtime:{onStartup:startup,connectNative,async getContexts(){return [];},async sendMessage(){
      state.frames++;
      state.duringFrame?.();
      return {status:'ok',data:image};
    }},
  };
  return {chrome,state,click,updated,async close(){if(child){child.stdin.end(); await exit;}}};
}

test('persistent exact Meet binding through local launcher, native messaging and stdio MCP',
  {skip:process.platform!=='win32',timeout:25000},async () => {
    const local = await mkdtemp(join(tmpdir(),'classmate-meet-test-'));
    const env = {...process.env, LOCALAPPDATA:local};
    const saved = join(local,'CorthexClassmate','orca-context-window.json');
    const exe = join(local,'CorthexClassmate','orca-meet-host','ClassmateMeetHost.exe');
    let browser, rpc;
    const state = {};
    const startMcp = async () => {
      rpc = new Rpc(process.execPath,[entry],{env});
      assert.equal((await rpc.request('initialize',{protocolVersion:'2025-11-25'})).serverInfo.version,'1.2.0');
      rpc.notify('notifications/initialized');
    };
    const call = () => rpc.request('tools/call',{name:'capture_selected_window',arguments:{}});
    try {
      const built = spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',installer,'-StageOnly'],{
        env,windowsHide:true,encoding:'utf8',timeout:10000,
      });
      assert.equal(built.status,0,built.stderr);
      browser = fixture(exe,env,state);
      globalThis.chrome=browser.chrome;
      await import(worker.href+'?first');
      await startMcp();
      assert.equal((await call()).isError,true);
      browser.click.emit(browser.state.tab);
      await until(()=>browser.state.badge==='MEET');
      assert.equal(browser.state.frames,0);
      assert.deepEqual(browser.state.requests,[]);
      const binding = JSON.parse(await readFile(saved,'utf8'));
      assert.notEqual((await requestMeetFrame({...binding,control:'0'.repeat(64)})).status,'ok');
      assert.equal(browser.state.frames,0);
      await writeFile(saved,JSON.stringify({...binding,selectedAt:Date.now()-10_800_000}));
      browser.state.tab.active=false;
      const activeElsewhere = await call();
      assert.equal(activeElsewhere.content[0].data,image);
      assert.deepEqual(browser.state.requests,[31]);
      rpc.close();
      await startMcp();
      assert.equal((await call()).content[0].data,image);
      browser.state.window='minimized';
      assert.match((await call()).content[0].text,/최소화/);
      assert.equal(browser.state.frames,2);
      browser.state.window='normal';
      assert.equal((await call()).content[0].data,image);
      browser.state.tab.url='https://meet.google.com/xyz-uvwx-yza';
      assert.equal((await call()).isError,true);
      browser.state.tab.url='https://example.invalid/';
      assert.equal((await call()).isError,true);
      assert.equal(browser.state.frames,3);
      browser.state.tab.url=meeting;
      browser.state.duringFrame=()=>browser.updated.emit(31,{status:'loading'});
      assert.equal((await call()).isError,true);
      browser.state.duringFrame=undefined;
      browser.state.tab=undefined;
      assert.match((await call()).content[0].text,/닫혔습니다/);
      const prior=await readFile(saved,'utf8');
      await browser.close();
      browser=fixture(exe,env,{profileId:randomBytes(16).toString('hex')});
      globalThis.chrome=browser.chrome;
      await import(worker.href+'?other-profile');
      await until(()=>browser.state.events.includes('ready'));
      assert.match((await call()).content[0].text,/지정한 Chrome 프로필/);
      assert.equal(browser.state.frames,0);
      assert.equal(await readFile(saved,'utf8'),prior);
      await browser.close();
      browser=fixture(exe,env,state);
      globalThis.chrome=browser.chrome;
      await import(worker.href+'?restart');
      await until(()=>browser.state.events.includes('ready'));
      assert.match((await call()).content[0].text,/권한/);
      assert.equal(await readFile(saved,'utf8'),prior);
      browser.state.tab.id=52;
      browser.click.emit(browser.state.tab);
      await until(()=>browser.state.badge==='MEET');
      assert.equal(browser.state.frames,0);
      assert.equal((await call()).content[0].data,image);
      assert.deepEqual(browser.state.requests,[52]);
    } finally {rpc?.close();await browser?.close();delete globalThis.chrome;await rm(local,{recursive:true,force:true});}
  });
