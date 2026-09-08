import { chromium, expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
test('official connection: login polling, reconnect, explicit answer test, failures and narrow layout', async()=>{
  const extension=path.join(root,'apps/browser-extension/.output/chrome-mv3');
  const context=await chromium.launchPersistentContext('',{channel:'chromium',viewport:{width:380,height:1050},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try {
    const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
    const panel=await context.newPage(); const errors:string[]=[]; panel.on('pageerror', e=>errors.push(e.message));
    await panel.addInitScript(()=>{
      let logged=false; let fail=false;
      const calls:string[]=[];
      (window as unknown as {mockConnection:{calls:string[];fail:()=>void}}).mockConnection={calls,fail:()=>{fail=true;}};
      chrome.runtime.connect=(()=>({postMessage(){},disconnect(){},onMessage:{addListener(){},removeListener(){}},onDisconnect:{addListener(){},removeListener(){}}})) as unknown as typeof chrome.runtime.connect;
      chrome.runtime.sendMessage=(async(m:{type:string})=>{calls.push(m.type); return {state:'connected'};}) as unknown as typeof chrome.runtime.sendMessage;
      chrome.runtime.connectNative=(()=>{
        let listener:(m:unknown)=>void=()=>{}; let closed=false;
        return {disconnect(){closed=true;},onMessage:{addListener(f:(m:unknown)=>void){listener=f;}},onDisconnect:{addListener(){}},postMessage(m:{type:string;action?:string;confirmed?:boolean}){
          calls.push(m.action??m.type);
          let state=logged?'ready':'login-required';
          if(m.action==='login'){state='login-opened'; logged=true;}
          if(m.action==='test'){if(!m.confirmed)throw Error('unconfirmed cost');state=fail?'test-failed':'answer-ready';}
          queueMicrotask(()=>{if(!closed)listener({type:'provider.status',state,cliVersion:'2.1.252',setupSupported:true});});
        }};
      }) as unknown as typeof chrome.runtime.connectNative;
    });
    await panel.goto(`chrome-extension://${new URL(worker.url()).host}/sidepanel.html`);
    await expect(panel.getByText('Claude Code 로그인이 필요해요',{exact:true})).toBeVisible();
    await panel.getByRole('button',{name:'Claude Code 연결하기',exact:true}).click();
    await expect(panel.getByRole('button',{name:'자동 확인 중단'})).toBeVisible();
    await expect(panel.getByText('로그인 확인과 수업 재연결을 마쳤어요.',{exact:false})).toBeVisible({timeout:10000});
    const calls=()=>panel.evaluate(()=>(window as unknown as {mockConnection:{calls:string[]}}).mockConnection.calls);
    expect((await calls()).filter(x=>x==='login')).toHaveLength(1);
    expect((await calls()).filter(x=>x==='test')).toHaveLength(0);
    await panel.getByRole('button',{name:'답변 테스트 · 소량 사용',exact:true}).click();
    await expect(panel.getByText('답변 테스트 성공 · 공부할 준비가 됐어요',{exact:true})).toBeVisible();
    for(const width of [320,380,790]){await panel.setViewportSize({width,height:1050});expect(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
    await panel.setViewportSize({width:380,height:1050});
    await panel.screenshot({path:path.join(root,'docs/screenshots/connection-0.1.4.png')});
    await panel.evaluate(()=>(window as unknown as {mockConnection:{fail:()=>void}}).mockConnection.fail());
    await panel.getByRole('button',{name:'답변 테스트 · 소량 사용',exact:true}).click();
    await expect(panel.getByText('로그인했지만 답변 테스트에 실패했어요',{exact:true})).toBeVisible();
    await panel.getByText('해결 방법 보기',{exact:true}).click();
    await expect(panel.getByText('로그인 확인과 답변 성공은 다릅니다.',{exact:false})).toBeVisible();
    expect(errors).toEqual([]);
  } finally {await context.close();}
});
