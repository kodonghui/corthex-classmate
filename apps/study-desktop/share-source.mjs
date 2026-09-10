import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

// Only a Tiro share page may become a recording source. Never log the URL.
export function canonicalShareUrl(value){
  if(typeof value!=='string'||value.length>2048)throw new Error('Tiro의 공유 링크를 붙여 넣어 주세요.');
  let u;try{u=new URL(value.trim());}catch{throw new Error('https://tiro.ooo/s/로 시작하는 공유 링크를 입력해 주세요.');}
  const match=u.pathname.match(/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?s\/([a-zA-Z0-9_-]{8,100})\/?$/);
  if(u.protocol!=='https:'||u.hostname!=='tiro.ooo'||u.port||u.username||u.password||!match)throw new Error('Tiro 공유 링크만 연결할 수 있습니다. 녹음의 공유 메뉴에서 링크를 복사해 주세요.');
  return `https://tiro.ooo/s/${match[1]}`;
}

// Same public DOM family as the existing extension's share-parser.ts. No private
// API, cookies, credentials or audio are inspected. Only visible transcript text.
export function readShareDocument(){
  if([...document.querySelectorAll('input[type="password"]')].some(e=>e.getClientRects().length))return {title:'',paragraphs:[],state:'restricted'};
  const main=document.querySelector('main');
  if(!main)return {title:'',paragraphs:[],state:'loading'};
  if(main.querySelector('input[type="password"]'))return {title:'',paragraphs:[],state:'restricted'};
  const found=[...main.querySelectorAll('div.whitespace-pre-wrap')];
  const nodes=found.filter(e=>!found.some(child=>child!==e&&e.contains(child))&&e.getClientRects().length);
  const paragraphs=nodes.map(e=>({text:(e.textContent??'').trim(),live:e.classList.contains('font-semibold')})).filter(p=>p.text);
  return {title:main.querySelector('h1')?.textContent?.trim().slice(0,100)??'',paragraphs:paragraphs.slice(0,10000),state:paragraphs.length?'connected':'empty'};
}

export function mapShareRows(sourceId,rows,previous,now=new Date().toISOString()){
  if(rows.length<previous.length)throw new Error('공유 화면의 문단 구조가 달라졌습니다. 링크를 다시 연결해 주세요. 기존 기록은 보존됩니다.');
  return rows.map((row,index)=>{
    if(typeof row.text!=='string'||row.text.length>12000)throw new Error('공유 전사 문단을 읽지 못했습니다. Tiro에서 내용을 확인해 주세요.');
    const old=previous[index];
    return {uuid:old?.uuid??`share-${createHash('sha256').update(`${sourceId}:${index}`).digest('hex').slice(0,40)}`,
      noteGuid:sourceId,text:row.text,timeFrom:old?.timeFrom??now,timeTo:old?.text===row.text?old.timeTo:now,
      locked:false,source:'tiro-share',timeBasis:'observed',live:row.live===true,sourceIndex:index};
  });
}

export class ShareReader {
  constructor({onSnapshot,launch=()=>chromium.launch({channel:'msedge',headless:true}),read=readShareDocument,navigate=(page,url)=>page.goto(url,{waitUntil:'domcontentloaded',timeout:20000})}={}){
    this.onSnapshot=onSnapshot;this.launch=launch;this.read=read;this.navigate=navigate;this.generation=0;this.state={state:'unlinked'};
  }
  async connect(source){
    await this.close();const generation=++this.generation;this.source=source;this.state={state:'connecting'};
    try{
      const browser=await this.launch();if(generation!==this.generation){await browser.close();return;}
      this.browser=browser;this.context=await browser.newContext({acceptDownloads:false,permissions:[]});
      const page=await this.context.newPage();this.page=page;
      page.on('popup',p=>void p.close());
      // Reject navigation away from the configured share page; no automatic login.
      await page.route('**/*',route=>{
        const request=route.request();
        if(request.isNavigationRequest()&&request.frame()===page.mainFrame()){
          try{if(canonicalShareUrl(request.url())!==source.url)return route.abort();}catch{return route.abort();}
        }
        return route.continue();
      });
      const response=await this.navigate(page,source.url);
      if(response?.status&&response.status()>=400)throw new Error('Share page unavailable');
      if(generation!==this.generation)return;
      let lastApplied;
      const tick=async()=>{
        if(generation!==this.generation)return;
        try{
          const data=await page.evaluate(this.read);
          if(generation!==this.generation)return;
          this.state={state:data.state,title:data.title,lastCheckedAt:new Date().toISOString()};
          if(data.paragraphs.length){
            const fingerprint=JSON.stringify(data);
            if(fingerprint!==lastApplied){await this.onSnapshot(source,data);lastApplied=fingerprint;}
            this.state.state='connected';
          }
        }catch{
          this.state={...this.state,state:'error',message:'공유 전사 연결을 확인해 주세요. 기존 기록은 유지됩니다.'};
        }finally{if(generation===this.generation)this.timer=setTimeout(tick,200);}
      };
      void tick();
    }catch{if(generation===this.generation)this.state={state:'error',message:'공유 링크를 열지 못했습니다. Tiro에서 공유가 켜져 있는지 확인하고 다시 연결해 주세요.'};}
  }
  async close(){++this.generation;clearTimeout(this.timer);const b=this.browser;this.browser=undefined;this.page=undefined;this.source=undefined;await b?.close().catch(()=>{});this.state={state:'unlinked'};}
}
