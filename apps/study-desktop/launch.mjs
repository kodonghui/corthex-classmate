import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile,open,unlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startStudy} from './server.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const profile=join(process.env.LOCALAPPDATA,'CorthexClassmate','study-desktop');
await mkdir(profile,{recursive:true});
const descriptor=join(profile,'running.json');const lockPath=join(profile,'launch.lock');
function openWindow(url,onExit){
  const edge=[join(process.env['ProgramFiles(x86)']??'','Microsoft/Edge/Application/msedge.exe'),join(process.env.ProgramFiles??'','Microsoft/Edge/Application/msedge.exe')].find(existsSync);
  if(!edge)throw new Error('Microsoft Edge가 필요합니다. Windows에서 Edge를 설치한 뒤 다시 실행하세요.');
  // Edge study window stays separate from the Chrome lecture capture target.
  const started=Date.now();
  const child=spawn(edge,[`--app=${url}`,`--user-data-dir=${join(profile,'browser')}`,'--no-first-run','--disable-background-mode','--window-size=1050,960'],{detached:true,stdio:'ignore'});
  // A dedicated browser profile lets the last app window own the collector lifetime.
  // An immediate exit can mean Edge forwarded to an existing instance; leases handle that.
  child.once('exit',()=>{if(Date.now()-started>3000)onExit?.();});child.unref();
}
async function reuse(){
  try{const s=JSON.parse(await readFile(descriptor,'utf8'));
    if(!/^http:\/\/127\.0\.0\.1:\d+\/$/.test(s.origin)||!/^[a-f0-9]{64}$/.test(s.token))return false;
    const r=await fetch(`${s.origin}api/status`,{headers:{'x-classmate-key':s.token},signal:AbortSignal.timeout(1500)});
    if(r.ok){openWindow(`${s.origin}#classmate=${s.token}`);return true;}
  }catch{}return false;
}
if(await reuse())process.exit(0);
let lock;
try{lock=await open(lockPath,'wx');await lock.writeFile(String(process.pid));}
catch{
  // Another double-click may still be starting the process. Never spawn duplicates immediately.
  for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,500));if(await reuse())process.exit(0);}
  const pid=Number(await readFile(lockPath,'utf8').catch(()=>''));let live=false;
  if(Number.isInteger(pid)&&pid>0)try{process.kill(pid,0);live=true;}catch{}
  if(live)throw new Error('Classmate가 실행 중입니다. 잠시 후 다시 열어 주세요.');
  await unlink(lockPath).catch(()=>{});lock=await open(lockPath,'wx');await lock.writeFile(String(process.pid));
}
try{
  const entry=[join(process.env.APPDATA??'','npm/node_modules/@openai/codex/bin/codex.js'),join(dirname(process.execPath),'node_modules/@openai/codex/bin/codex.js')].find(existsSync);
  if(!entry)throw new Error('Codex 실행 파일을 찾지 못했어요. Codex CLI를 설치하고 로그인해 주세요.');
  let app;let closing=false;
  const close=async()=>{if(closing)return;closing=true;await app?.close();await lock.close();await unlink(lockPath).catch(()=>{});await unlink(descriptor).catch(()=>{});setTimeout(()=>process.exit(0),1000);};
  app=await startStudy({root,entry,profile,onIdle:()=>void close()});
  await writeFile(descriptor,JSON.stringify({origin:app.origin+'/',token:app.token,pid:process.pid}),{mode:0o600});
  openWindow(app.url,()=>void close());
  process.on('SIGINT',close);process.on('SIGTERM',close);
}catch(e){await lock.close();await unlink(lockPath).catch(()=>{});throw e;}
