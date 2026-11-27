import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startStudy} from '../../apps/study-desktop/server.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const profile=await mkdtemp(join(tmpdir(),'classmate-account-ui-'));
let loggedIn=false,finishLogin,loginStarts=0;
const claude={connect:async()=>({loggedIn}),account:async()=>({loggedIn}),close(){},login:({signal})=>{loginStarts++;return new Promise((resolve,reject)=>{finishLogin=()=>{loggedIn=true;resolve();};signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true});});}};
const codex={connect:async()=>({loggedIn:true}),account:async()=>({loggedIn:true}),close(){},login:async()=>{}};
const core={connect:async()=>{},close(){},call:async()=>({structuredContent:{bundleName:'연결 기능 검증용 가상 수업',paragraphs:[{uuid:'fixture',text:'이 문장은 연결 검사에 사용하는 합성 자료입니다.',timeFrom:'2026-11-05T03:00:00Z',timeTo:'2026-11-05T03:01:00Z'}],recentQa:[{id:1,question:'주소 표시 검사',answer:'자료 주소 https://example.com/guide',askedAt:'2026-11-05T03:00:00Z'}],status:{daemon:'alive',tiroState:'connected'}}})};
const app=await startStudy({root,profile,coreOverride:core,tutorOverride:codex,claudeOverride:claude});
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
const headers={'Content-Type':'application/json','x-classmate-key':app.token};
try{
  await page.goto(app.url);await page.locator('#free-question').waitFor();await page.getByRole('button',{name:'AI 연결',exact:true}).click();
  const measurements=[];
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    const measurement=await page.locator('.account-connections').evaluate(section=>{
      const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
      const background=element=>{for(let node=element;node;node=node.parentElement){const color=getComputedStyle(node).backgroundColor;if(color!=='transparent'&&color!=='rgba(0, 0, 0, 0)')return color;}return 'rgb(255, 255, 255)';};
      const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      const buttons=[...section.querySelectorAll('button:not(:disabled)')];
      const textNodes=[...section.querySelectorAll('strong,span,p,button:not(:disabled)')].filter(el=>el.textContent.trim());
      return {width:innerWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth,sectionOverflow:section.scrollWidth>section.clientWidth,wordBreak:getComputedStyle(section).wordBreak,minTarget:Math.min(...buttons.flatMap(el=>{const b=el.getBoundingClientRect();return[b.width,b.height];})),minTextContrast:Math.min(...textNodes.map(el=>contrast(getComputedStyle(el).color,background(el)))),minControlBorderContrast:Math.min(...buttons.map(el=>contrast(getComputedStyle(el).borderTopColor,background(el))))};
    });
    assert.equal(measurement.pageOverflow,false);assert.equal(measurement.sectionOverflow,false);assert.equal(measurement.wordBreak,'keep-all');assert.ok(measurement.minTarget>=24);assert.ok(measurement.minTextContrast>=4.5);assert.ok(measurement.minControlBorderContrast>=3);measurements.push(measurement);
    if(width===390||width===1440)await page.screenshot({path:join(profile,`accounts-${width}.png`),fullPage:true});
  }
  await page.setViewportSize({width:1000,height:900});const input=page.getByRole('textbox',{name:'대화 질문'});await input.fill('로그인 전후에 보존할 합성 초안');
  await page.getByRole('group',{name:'Claude 구독 연결'}).getByRole('button',{name:'Claude 연결',exact:true}).click();await page.getByText('공식 로그인 창에서 완료해 주세요',{exact:true}).waitFor();assert.equal(loginStarts,1);finishLogin();
  await page.getByRole('group',{name:'Claude 구독 연결'}).getByText('구독 연결됨',{exact:true}).waitFor();assert.equal(await input.inputValue(),'로그인 전후에 보존할 합성 초안');
  const after=await(await fetch(app.origin+'/api/status',{headers})).json();assert.equal(after.provider,'codex','connecting Claude must not retarget GPT');
  await fetch(app.origin+'/api/provider',{method:'POST',headers,body:JSON.stringify({provider:'claude'})});await page.waitForFunction(()=>document.querySelector('button[aria-label="대화 보내기"]').disabled===false);
  await page.getByRole('button',{name:'AI 연결',exact:true}).click();loggedIn=false;await fetch(app.origin+'/api/account/check',{method:'POST',headers,body:JSON.stringify({provider:'claude'})});
  await page.getByRole('group',{name:'Claude 구독 연결'}).getByRole('button',{name:'Claude 연결',exact:true}).waitFor();assert.equal(await input.inputValue(),'로그인 전후에 보존할 합성 초안');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(JSON.stringify({passed:['two provider controls','subscription login completion','no provider switch','draft preserved','disconnect automatically opens recovery','existing URL answer renders'],measurements,screenshots:[join(profile,'accounts-390.png'),join(profile,'accounts-1440.png')]}));
}catch(error){console.log(JSON.stringify({error:error.message.replace(/https?:\/\/[^\s)]+/g,'[local resource]').replace(/[a-f0-9]{64}/gi,'[redacted]')}));process.exitCode=1;}
finally{await browser.close();await app.close();}
