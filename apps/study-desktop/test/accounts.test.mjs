import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SubscriptionAccounts} from '../accounts.mjs';
import {subscriptionEnv,SUBSCRIPTION_ENV_KEYS,openSubscriptionBrowser,claudeSubscriptionLogin} from '../subscription-login.mjs';
import {Tutor} from '../tutor.mjs';
import {ClaudeTutor} from '../claude-tutor.mjs';
import {startStudy,PROVIDERS} from '../server.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const fakeTutor=()=>{
  let loggedIn=false,finish;const tutor={connectCount:0,checkCount:0,loginCount:0,closed:false,
    async connect(){tutor.connectCount++;return {loggedIn};},async account(){tutor.checkCount++;return {loggedIn};},
    login({signal}){tutor.loginCount++;return new Promise((resolve,reject)=>{finish=()=>{loggedIn=true;resolve();};signal.addEventListener('abort',()=>reject(new Error('upstream-secret')),{once:true});});},
    setLoggedIn(value){loggedIn=value;},finishLogin(){finish();},close(){tutor.closed=true;}};return tutor;
};

test('subscription login is deduplicated, refreshes live status, and never selects another provider',async()=>{
  const codex=fakeTutor(),claude=fakeTutor();let now=1000;
  const connections=new SubscriptionAccounts({codex,claude},PROVIDERS,{now:()=>now});await connections.initialize();
  try{
    connections.login('claude');connections.login('claude');await tick();
    assert.equal(claude.loginCount,1);assert.equal(connections.status('codex').provider,'codex');assert.equal(connections.status('codex').providers.find(p=>p.id==='claude').loginState,'waiting');
    claude.finishLogin();await connections.logins.get('claude').done;
    assert.equal(connections.rows.claude.loggedIn,true);assert.equal(connections.rows.claude.loginState,'idle');
    const before=claude.checkCount;await connections.refresh();assert.equal(claude.checkCount,before);
    claude.setLoggedIn(false);now+=31000;await Promise.all([connections.refresh(),connections.refresh()]);
    assert.equal(connections.rows.claude.loggedIn,false);assert.equal(claude.checkCount,before+1);
  }finally{connections.close();}
});

test('cancel, failure and timeout release the managed login without exposing upstream details',async()=>{
  const tutor=fakeTutor();const connections=new SubscriptionAccounts({codex:tutor},PROVIDERS,{timeoutMs:15});await connections.initialize();
  try{
    connections.login('codex');await tick();const cancelled=connections.logins.get('codex');connections.cancel('codex');await cancelled.done;
    assert.equal(connections.rows.codex.loginState,'idle');assert.match(connections.rows.codex.loginError,/취소/);
    connections.login('codex');await tick();const timed=connections.logins.get('codex');await new Promise(resolve=>setTimeout(resolve,25));await timed.done;
    assert.equal(connections.rows.codex.loginState,'error');assert.match(connections.rows.codex.loginError,/시간/);assert.doesNotMatch(JSON.stringify(connections.status('codex')),/upstream-secret/);
    tutor.login=async()=>{throw new Error('private account material');};connections.login('codex');await connections.logins.get('codex').done;
    assert.doesNotMatch(JSON.stringify(connections.status('codex')),/private account/);
  }finally{connections.close();}
});

test('only the app-managed environment loses API/token overrides and official browser URLs are constrained',async()=>{
  const source={PATH:'preserved',...Object.fromEntries(SUBSCRIPTION_ENV_KEYS.map(key=>[key,'synthetic-secret']))};const env=subscriptionEnv(source);
  assert.equal(env.PATH,'preserved');for(const key of SUBSCRIPTION_ENV_KEYS){assert.equal(env[key],undefined);assert.equal(source[key],'synthetic-secret');}
  for(const value of ['http://auth.openai.com/','https://evil.example/','https://auth.openai.com.evil.example/','https://user@auth.openai.com/','https://auth.openai.com:9999/'])assert.throws(()=>openSubscriptionBrowser(value));
  let launch;const operation=openSubscriptionBrowser('https://auth.openai.com/oauth/authorize?state=synthetic',{spawnProcess:(exe,args,options)=>{launch={exe,args,options};const child=new EventEmitter();setImmediate(()=>child.emit('exit',0));return child;}});await operation;
  assert.equal(launch.exe,'powershell.exe');assert.equal(launch.options.windowsHide,true);assert.match(Buffer.from(launch.args.at(-1),'base64').toString('utf16le'),/Start-Process/);
});

test('Claude uses the original visible subscription login command and cancels only its reported process',async()=>{
  const launches=[];const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();const abort=new AbortController();
  const operation=claudeSubscriptionLogin("C:/User's/claude.exe",'C:/profile',{signal:abort.signal,spawnProcess:(exe,args,options)=>{launches.push({exe,args,options});return launches.length===1?child:new EventEmitter();}});
  child.stdout.write('ignored credential-like output\nCLASSMATE_LOGIN_PID:4321\n');
  abort.abort();await assert.rejects(operation,/취소/);
  const script=Buffer.from(launches[0].args.at(-1),'base64').toString('utf16le');assert.match(script,/auth','login','--claudeai/);assert.match(script,/-WindowStyle Normal/);assert.match(script,/User''s/);
  assert.match(Buffer.from(launches[1].args.at(-1),'base64').toString('utf16le'),/Stop-Process -Id 4321 /);
  child.emit('exit',1);child.stdout.end();child.stderr.end();
});

test('GPT uses managed ChatGPT OAuth and cleans up completion/cancel listeners',async()=>{
  const tutor=new Tutor('unused','unused');const rpc=new EventEmitter();const requests=[];
  rpc.request=async(method,params)=>{requests.push({method,params});return method==='account/login/start'?{loginId:'fixture-login',authUrl:'https://auth.openai.com/oauth/authorize'}:{};};
  tutor.rpc=rpc;tutor.connect=async()=>({loggedIn:false});
  await tutor.login({signal:new AbortController().signal,openBrowser:async()=>rpc.emit('notification','account/login/completed',{loginId:'fixture-login',success:true})});
  assert.deepEqual(requests[0],{method:'account/login/start',params:{type:'chatgpt'}});assert.equal(rpc.listenerCount('notification'),0);
  const abort=new AbortController();const pending=tutor.login({signal:abort.signal,openBrowser:async()=>abort.abort()});await assert.rejects(pending,/취소/);
  assert.ok(requests.some(r=>r.method==='account/login/cancel'&&r.params.loginId==='fixture-login'));assert.equal(rpc.listenerCount('disconnected'),0);
});

test('account HTTP routes enforce capabilities/provider IDs and restore subscriptions without restarting',async()=>{
  const root=fileURLToPath(new URL('../../../',import.meta.url));const profile=await mkdtemp(join(tmpdir(),'classmate-accounts-'));const codex=fakeTutor(),claude=fakeTutor();
  const core={connect:async()=>{},close(){},call:async()=>({structuredContent:{bundleName:'fixture',paragraphs:[],recentQa:[],status:{daemon:'alive',tiroState:'connected'}}})};
  const app=await startStudy({root,profile,coreOverride:core,tutorOverride:codex,claudeOverride:claude});
  const post=(path,provider,authorized=true)=>fetch(app.origin+path,{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{'x-classmate-key':app.token}:{})},body:JSON.stringify({provider})});
  try{
    assert.equal((await post('/api/account/login','claude',false)).status,401);
    assert.equal((await post('/api/account/login','toString')).status,400);
    assert.equal((await post('/api/account/login',{toString:'claude'})).status,400);
    assert.equal((await post('/api/account/login','claude')).status,202);
    assert.equal((await post('/api/account/login','claude')).status,202);assert.equal(claude.loginCount,1);
    claude.finishLogin();for(let i=0;i<10;i++){const result=await(await post('/api/account/check','claude')).json();if(result.providers.find(p=>p.id==='claude').loggedIn)break;await tick();}
    const ready=await(await post('/api/account/check','claude')).json();assert.equal(ready.provider,'codex');assert.equal(ready.providers.find(p=>p.id==='claude').loggedIn,true);
    assert.doesNotMatch(JSON.stringify(ready),/authUrl|access_token|refresh_token|synthetic-secret/);
    const cross=await fetch(app.origin+'/api/account/login',{method:'POST',headers:{'Content-Type':'application/json','x-classmate-key':app.token,Origin:'https://example.com'},body:JSON.stringify({provider:'claude'})});assert.equal(cross.status,403);
  }finally{await app.close();}
});

test('an API-only Claude account cannot enable subscription questions',async()=>{
  const tutor=new ClaudeTutor('unused','unused');let authMethod='api_key';
  tutor.spawn=()=>{const child=new EventEmitter();child.stdout=new PassThrough();setImmediate(()=>{child.stdout.end(JSON.stringify({loggedIn:true,authMethod}));child.emit('exit',0);});return child;};
  assert.equal((await tutor.account()).loggedIn,false);authMethod='claude.ai';assert.equal((await tutor.account()).loggedIn,true);
});

test('login cannot interrupt running or queued questions and pending login blocks new questions',async()=>{
  const root=fileURLToPath(new URL('../../../',import.meta.url));const profile=await mkdtemp(join(tmpdir(),'classmate-accounts-busy-'));const codex=fakeTutor(),claude=fakeTutor();codex.setLoggedIn(true);claude.setLoggedIn(true);
  codex.answer=async(_input,_delta,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('stopped')),{once:true}));
  const core={connect:async()=>{},close(){},call:async()=>({structuredContent:{bundleName:'fixture',paragraphs:[],recentQa:[],status:{daemon:'alive',tiroState:'connected'}}})};
  const app=await startStudy({root,profile,coreOverride:core,tutorOverride:codex,claudeOverride:claude});
  const post=(path,body)=>fetch(app.origin+path,{method:'POST',headers:{'Content-Type':'application/json','x-classmate-key':app.token},body:JSON.stringify(body)});
  try{
    assert.equal((await post('/api/question',{id:'fixture-auth-job-0001',question:'합성 질문'})).status,202);
    assert.equal((await post('/api/account/login',{provider:'codex'})).status,409);
    await post('/api/provider',{provider:'claude'});assert.equal((await post('/api/question',{id:'fixture-auth-job-0002',question:'합성 대기 질문'})).status,202);
    assert.equal((await post('/api/account/login',{provider:'claude'})).status,409);
    await post('/api/cancel',{id:'fixture-auth-job-0002'});assert.equal((await post('/api/account/login',{provider:'claude'})).status,202);
    assert.equal((await post('/api/question',{id:'fixture-auth-job-0003',question:'로그인 중 질문'})).status,409);
    await post('/api/cancel',{id:'fixture-auth-job-0001'});await tick();
  }finally{await app.close();}
});
