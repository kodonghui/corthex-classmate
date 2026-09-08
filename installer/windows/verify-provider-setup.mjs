// Manual integration verification. This compiles a fake CLI; never runs real authentication/AI.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeFrame, decodeFrames } from '../../apps/native-host/scripts/host-roundtrip.mjs';
const host=resolve(process.argv[2] ?? 'apps/native-host/target/debug/classmate-host.exe');
const folder=mkdtempSync(join(tmpdir(),'classmate-setup-fixture-'));
const cli=join(folder,'synthetic-login.exe');
const fixture=fileURLToPath(new URL('./fixtures/setup-cli.rs',import.meta.url));
const built=spawnSync('rustc',[fixture,'-o',cli],{encoding:'utf8',windowsHide:true,timeout:60000});
if(built.status!==0)throw Error('Synthetic fixture build failed: '+built.stderr);
const marker=join(folder,'completed');
const env={...process.env,CLASSMATE_CLAUDE_CLI:cli,CLASSMATE_DISABLE_CLI_DISCOVERY:'1',CLASSMATE_SETUP_FIXTURE:marker,CLASSMATE_DATA_DIR:join(folder,'sessions')};
function request(message){
  const result=spawnSync(host,[],{input:encodeFrame(message),env,timeout:40000,windowsHide:true});
  if(result.status!==0)throw Error('Synthetic host request failed');
  const {frames}=decodeFrames(result.stdout); return frames[0];
}
if(request({type:'provider.setup',action:'test'})?.state!=='setup-invalid-request')throw Error('Missing consent was accepted');
if(request({type:'provider.check'})?.state!=='login-required')throw Error('Expected logged-out fixture');
if(request({type:'provider.setup',action:'login',confirmed:true})?.state!=='login-opened')throw Error('Official launcher did not open synthetic executable');
const deadline=Date.now()+10000;
while(!existsSync(marker)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
if(request({type:'provider.check'})?.state!=='ready')throw Error('Login completion was not observed');
if(request({type:'provider.setup',action:'test',confirmed:true})?.state!=='answer-ready')throw Error('Synthetic answer test failed');
console.log(JSON.stringify({syntheticLauncher:true,loginCompletion:true,explicitAnswerTest:true,realAiRequests:0,realCredentialsRead:false,retainedTestDirectory:folder}));
