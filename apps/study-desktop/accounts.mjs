import {openSubscriptionBrowser} from './subscription-login.mjs';

export class SubscriptionAccounts {
  constructor(tutors,metadata,{openBrowser=openSubscriptionBrowser,now=Date.now,timeoutMs=300000,isBusy=()=>false}={}){
    this.tutors=tutors;this.metadata=metadata;this.openBrowser=openBrowser;this.now=now;this.timeoutMs=timeoutMs;this.isBusy=isBusy;
    this.rows={};this.checks=new Map();this.logins=new Map();this.initialized=new Set();this.closed=false;
    for(const [id,meta]of Object.entries(metadata))this.rows[id]={id,label:meta.label,loggedIn:false,model:meta.model,effort:meta.effort,aiError:this.tutors[id]?'':meta.startError,loginHint:meta.loginHint,available:!!this.tutors[id],loginState:'idle',loginError:'',checkedAt:-Infinity};
  }
  async initialize(){await Promise.all(Object.keys(this.rows).map(id=>this.check(id,{force:true})));}
  async check(id,{force=false,afterLogin=false}={}){
    const row=this.rows[id];if(!row||this.closed||!this.tutors[id])return;
    if(this.checks.has(id))return this.checks.get(id);
    if(this.isBusy(id)||this.logins.has(id)&&!afterLogin||!force&&this.now()-row.checkedAt<30000)return;
    const task=(async()=>{
      try{
        const tutor=this.tutors[id];let account;
        if(!this.initialized.has(id)){account=await tutor.connect();this.initialized.add(id);}
        else try{account=await(tutor.account?tutor.account():tutor.connect());}catch{account=await tutor.connect();}
        row.loggedIn=account.loggedIn===true;row.aiError='';row.model=account.model??row.model;row.effort=account.effort??row.effort;
        if(row.loggedIn&&row.loginState==='error'){row.loginState='idle';row.loginError='';}
      }catch{row.loggedIn=false;row.aiError=this.metadata[id].startError;}
      finally{row.checkedAt=this.now();}
    })().finally(()=>this.checks.delete(id));this.checks.set(id,task);return task;
  }
  async refresh(){await Promise.all(Object.keys(this.rows).map(id=>this.check(id)));}
  status(provider){const clean=row=>{const {checkedAt,...publicRow}=row;return publicRow;};return {...clean(this.rows[provider]),provider,providers:Object.values(this.rows).map(clean)};}
  login(id){
    const row=this.rows[id];const tutor=this.tutors[id];
    if(this.logins.has(id))return;
    if(!tutor?.login)throw new Error('공식 로그인 프로그램을 찾지 못했어요. 설치 상태를 확인해 주세요.');
    const controller=new AbortController();const operation={controller};this.logins.set(id,operation);row.loginState='waiting';row.loginError='';
    const aborted=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true}));
    const timer=setTimeout(()=>{operation.timedOut=true;controller.abort();},this.timeoutMs);timer.unref?.();
    const task=Promise.resolve(this.checks.get(id)).then(()=>tutor.login({openBrowser:this.openBrowser,signal:controller.signal}));
    operation.done=Promise.race([task,aborted]).then(async()=>{
      await this.check(id,{force:true,afterLogin:true});
      if(!row.loggedIn)throw new Error('subscription required');
      if(this.logins.get(id)===operation){row.loginState='idle';row.loginError='';}
    }).catch(()=>{
      if(this.logins.get(id)!==operation)return;
      row.loginState=operation.cancelled?'idle':'error';
      row.loginError=operation.cancelled?'로그인을 취소했습니다.':operation.timedOut?'로그인 시간이 지났어요. 연결 버튼을 눌러 다시 시작해 주세요.':'구독 로그인을 완료하지 못했어요. 공식 로그인 창에서 계정을 확인한 뒤 다시 연결해 주세요.';
    }).finally(()=>{clearTimeout(timer);if(this.logins.get(id)===operation)this.logins.delete(id);});
  }
  cancel(id){const operation=this.logins.get(id);if(operation){operation.cancelled=true;operation.controller.abort();}}
  close(){this.closed=true;for(const id of this.logins.keys())this.cancel(id);}
}
