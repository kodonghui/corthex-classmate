// Real Windows processes + isolated SQLite. No lecture capture or upstream requests.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {Rpc} from './rpc.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const exe=process.env.CLASSMATE_TEST_CORE_EXE??join(root,'apps/core/target/release/classmate-core.exe');
const dir=await mkdtemp(join(tmpdir(),'classmate-recovery-'));
await writeFile(join(dir,'config.json'),JSON.stringify({timeline:{enabled:false},hotkey:{modifiers:['Control','Alt','Shift'],key:'F24'}}));
let rpc;let db;const children=new Set();
const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const waitFor=async(fn,ms=10000)=>{const started=Date.now();while(Date.now()-started<ms){if(await fn())return Date.now()-started;await new Promise(r=>setTimeout(r,200));}throw new Error('Recovery condition timed out');};
async function start(){rpc=new Rpc(exe,['mcp','--owned-daemon'],{env:{...process.env,CLASSMATE_CORE_DIR:dir,CLASSMATE_TIRO_BASE_URL:'http://127.0.0.1:1/v1/external'}});await rpc.request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'isolated-recovery',version:'1'}});rpc.notify('notifications/initialized');}
const pid=()=>Number(db.prepare("SELECT value FROM status WHERE key='daemon.pid'").get()?.value);
try{
 await start();db=new DatabaseSync(join(dir,'core.sqlite'));await waitFor(()=>pid()>0);let first=pid();children.add(first);assert.ok(alive(first));
 process.kill(first);const recoveredMs=await waitFor(async()=>{await rpc.request('tools/call',{name:'core_status',arguments:{}});return pid()!==first&&alive(pid());},9000);
 const replacement=pid();children.add(replacement);rpc.close();await waitFor(()=>!alive(replacement),5000);
 // Reopen immediately: a leftover fresh heartbeat must not delay startup by 20s.
 await start();await waitFor(()=>pid()!==replacement&&alive(pid()),4000);const reopened=pid();children.add(reopened);
 // Kill only our bridge to exercise private-pipe EOF when graceful cleanup cannot run.
 rpc.child.kill();await waitFor(()=>!alive(reopened),6000);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM frames').get().n,0);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM paragraphs').get().n,0);
 console.log(JSON.stringify({pass:true,recoveredMs,checks:['owned-start','daemon-crash-restart','window-owner-close','immediate-reopen','bridge-crash-no-orphan','no-lecture-data']}));
}finally{rpc?.close();db?.close();for(const child of children)if(alive(child))process.kill(child);}
