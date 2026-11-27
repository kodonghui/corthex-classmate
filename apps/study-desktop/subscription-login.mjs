import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';

export const SUBSCRIPTION_ENV_KEYS=['OPENAI_API_KEY','CODEX_API_KEY','CODEX_ACCESS_TOKEN','ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','CLAUDE_CODE_OAUTH_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY'];
export function subscriptionEnv(source=process.env){const env={...source};for(const key of SUBSCRIPTION_ENV_KEYS)delete env[key];return env;}
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const encoded=script=>['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')];

export function openSubscriptionBrowser(value,{spawnProcess=spawn}={}){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!['auth.openai.com','chatgpt.com','chat.openai.com'].includes(url.hostname))throw new Error('공식 로그인 주소를 확인하지 못했어요. 다시 연결해 주세요.');
  return new Promise((resolve,reject)=>{
    const child=spawnProcess('powershell.exe',encoded(`$ErrorActionPreference='Stop'; Start-Process -FilePath ${quote(url.href)}`),{windowsHide:true,stdio:'ignore',env:subscriptionEnv()});
    child.once('error',()=>reject(new Error('로그인 창을 열지 못했어요. 다시 시도해 주세요.')));
    child.once('exit',code=>code===0?resolve():reject(new Error('로그인 창을 열지 못했어요. 다시 시도해 주세요.')));
  });
}

// Only the official CLI owns the browser callback and credentials. A visible terminal
// also leaves its manual code prompt usable when a browser cannot redirect back.
export function claudeSubscriptionLogin(executable,cwd,{signal,spawnProcess=spawn}={}){
  return new Promise((resolve,reject)=>{
    if(signal?.aborted)return reject(new Error('로그인이 취소되었습니다.'));
    const script=`$ErrorActionPreference='Stop'; $loginProcess=Start-Process -FilePath ${quote(executable)} -ArgumentList @('auth','login','--claudeai') -WorkingDirectory ${quote(cwd)} -WindowStyle Normal -PassThru; $null=$loginProcess.Handle; [Console]::Out.WriteLine('CLASSMATE_LOGIN_PID:'+$loginProcess.Id); $loginProcess.WaitForExit(); exit $loginProcess.ExitCode`;
    const child=spawnProcess('powershell.exe',encoded(script),{windowsHide:true,env:subscriptionEnv(),stdio:['ignore','pipe','pipe']});
    let loginPid;let aborted=false;let settled=false;
    child.stderr.on('data',()=>{});
    const stopLogin=()=>{if(!Number.isSafeInteger(loginPid)||loginPid<=0)return;const stop=spawnProcess('powershell.exe',encoded(`Stop-Process -Id ${loginPid} -ErrorAction SilentlyContinue`),{windowsHide:true,stdio:'ignore'});stop.on('error',()=>{});};
    const finish=(error)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);error?reject(error):resolve();};
    const abort=()=>{aborted=true;stopLogin();finish(new Error('로그인이 취소되었습니다.'));};
    createInterface({input:child.stdout}).on('line',line=>{const match=/^CLASSMATE_LOGIN_PID:(\d+)$/.exec(line);if(match){loginPid=Number(match[1]);if(aborted)stopLogin();}});
    signal?.addEventListener('abort',abort,{once:true});
    child.once('error',()=>finish(new Error('Claude 로그인 창을 열지 못했어요. 설치 상태를 확인해 주세요.')));
    child.once('exit',code=>finish(code===0&&!aborted?undefined:new Error('Claude 로그인을 완료하지 못했어요. 다시 연결해 주세요.')));
    if(signal?.aborted)abort();
  });
}
