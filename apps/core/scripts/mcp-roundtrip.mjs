// Real stdio + SQLite + GDI roundtrip. Synthetic isolated data, no Tiro/network/daemon.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const require = createRequire(join(root, 'packages/contracts/package.json'));
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const ajv = new Ajv({ strict: false, allErrors: true }); addFormats(ajv);
for (const name of ['common','core-paragraph','core-frame','core-moment','core-qa-entry','core-tools']) {
  ajv.addSchema(JSON.parse(await readFile(join(root, `packages/contracts/schemas/${name}.schema.json`),'utf8')));
}
const exe = process.argv[2] ? resolve(process.argv[2]) : join(root,'apps/core/target/debug/classmate-core.exe');
const dir = await mkdtemp(join(tmpdir(),'cmcore-rpc-'));
await writeFile(join(dir,'config.json'),JSON.stringify({capture:{max_edge:16},timeline:{enabled:false}}));
const validators = Object.fromEntries(['MomentLatest','MomentCapture','MomentGet','TranscriptRecent','SessionLog','SessionSummary','CoreStatus'].map(name=>[
  name,ajv.compile({$ref:`https://schemas.corthex.dev/classmate/core-tools.schema.json#/definitions/${name}Output`})
]));

async function connect() {
  const child=spawn(exe,['mcp','--no-daemon'],{env:{...process.env,CLASSMATE_CORE_DIR:dir},windowsHide:true,stdio:['pipe','pipe','pipe']});
  const pending=new Map(); let serial=0; let failure;
  child.stderr.on('data',()=>{}); // Never print arbitrary child output.
  child.on('error',()=>{failure=new Error('MCP process could not start');for(const p of pending.values()) p.reject(failure);});
  const closed = new Promise(resolve=>child.on('close',code=>{for(const p of pending.values()) p.reject(new Error('MCP process closed'));resolve(code);}));
  createInterface({input:child.stdout}).on('line',line=>{
    try {const msg=JSON.parse(line); const p=pending.get(msg.id);if(!p) throw new Error('unsolicited response');pending.delete(msg.id);clearTimeout(p.timer);p.resolve(msg);}
    catch {failure=new Error('Invalid JSON-RPC stdout'); for(const p of pending.values()) p.reject(failure); child.kill();}
  });
  const request=(method,params={})=>new Promise((resolve,reject)=>{
    if(failure) return reject(failure);
    const id=++serial;
    const timer=setTimeout(()=>{pending.delete(id);child.kill();reject(new Error('MCP request timed out'));},15000);
    pending.set(id,{resolve,reject,timer});
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
  });
  await request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'roundtrip',version:'1'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  return {request,async close(){child.stdin.end();assert.equal(await closed,0);if(failure)throw failure;}};
}
function verify(result,type) {
  assert.equal(result.isError,false);
  assert.ok(validators[type](result.structuredContent),JSON.stringify(validators[type].errors));
  assert.deepEqual(JSON.parse(result.content[0].text),result.structuredContent);
  return result.structuredContent;
}
let conn=await connect();
try {
  const listed=await conn.request('tools/list');assert.equal(listed.result.tools.length,7);
  const db=new DatabaseSync(join(dir,'core.sqlite'));
  const now=Date.now();const from=new Date(now-20000).toISOString(),to=new Date(now-1000).toISOString();
  db.prepare('INSERT INTO paragraphs(uuid,bundle_id,note_guid,text,time_from,time_to,time_from_ms,time_to_ms,locked,fetched_at) VALUES (?,1,?,?,?,?,?,?,1,?)').run('11111111-1111-4111-8111-111111111111','synthetic-note','의존성 주입 설명',from,to,now-20000,now-1000,to);db.close();
  const call=async(name,args,type)=>{const msg=await conn.request('tools/call',{name,arguments:args});return {data:verify(msg.result,type),content:msg.result.content};};
  assert.equal((await call('moment_latest',{},'MomentLatest')).data.found,false);
  assert.equal((await call('transcript_recent',{},'TranscriptRecent')).data.paragraphs.length,1);
  const captured=await call('moment_capture',{paragraph_uuid:'11111111-1111-4111-8111-111111111111'},'MomentCapture');
  assert.equal(captured.content[1].type,'image');assert.ok(Buffer.from(captured.content[1].data,'base64').length>0);
  const latest=await call('moment_latest',{},'MomentLatest');assert.equal(latest.data.moment.id,captured.data.moment_id);
  const got=await call('moment_get',{moment_id:captured.data.moment_id},'MomentGet');assert.deepEqual(got.content[1],captured.content[1]);
  await call('session_log',{question:'주입이 뭐예요?',answer:'필요한 객체를 건네주는 것입니다.',kind:'explain',moment_id:captured.data.moment_id},'SessionLog');
  assert.equal((await call('session_summary',{},'SessionSummary')).data.recentQa.length,1);
  assert.equal((await call('core_status',{},'CoreStatus')).data.counts.qa,1);
  const bad=await conn.request('tools/call',{name:'moment_capture',arguments:{paragraph_uuid:'missing'}});assert.equal(bad.result.isError,true);
  const invalid=await conn.request('tools/call',{name:'transcript_recent',arguments:{window_sec:0}});assert.equal(invalid.error.code,-32602);
  await conn.close(); conn=await connect();
  const persisted=await conn.request('tools/call',{name:'session_summary',arguments:{}});assert.equal(verify(persisted.result,'SessionSummary').counts.qa,1);
  console.log('PASS: 7 MCP tools, JSON Schema outputs, image content, invalid inputs, SQLite restart recovery; isolated fixture only.');
} finally { await conn.close(); }
