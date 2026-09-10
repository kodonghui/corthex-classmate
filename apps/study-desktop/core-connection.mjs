import {Rpc} from './rpc.mjs';

// Reconnect only transport reads. Never replay a capture or session_log after an
// uncertain response: that could duplicate a user's saved data.
export class CoreConnection {
  constructor(executable,{coreDir,rpcFactory=(...args)=>new Rpc(...args)}={}){
    this.executable=executable;this.coreDir=coreDir;this.rpcFactory=rpcFactory;this.closed=false;this.nextAttempt=0;
  }
  async connect(){
    if(this.closed)throw new Error('자료 연결이 종료되었습니다.');
    if(this.connecting)return this.connecting;
    if(this.rpc&&!this.rpc.closed)return;
    if(Date.now()<this.nextAttempt)throw new Error('자료 연결을 복구하고 있어요.');
    this.nextAttempt=Date.now()+3000;
    this.connecting=(async()=>{
      const rpc=this.rpcFactory(this.executable,['mcp',this.coreDir?'--desktop-no-daemon':'--owned-daemon'],{env:{...process.env,...(this.coreDir?{CLASSMATE_CORE_DIR:this.coreDir}:{})}});
      this.rpc=rpc;
      try{await rpc.request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'classmate-study',version:'0.3.0-preview'}});rpc.notify('notifications/initialized');}
      catch(e){rpc.close();throw e;}
    })().finally(()=>{this.connecting=undefined;});
    return this.connecting;
  }
  async call(name,args={}){
    await this.connect();
    let r;
    try{r=await this.rpc.request('tools/call',{name,arguments:args},10000);}
    catch(e){if(['study_refresh','core_status','moment_get'].includes(name))this.rpc.close();throw e;}
    if(r.isError)throw new Error('학습 자료 요청을 처리하지 못했어요.');return r;
  }
  close(){this.closed=true;this.rpc?.close();}
  async ingestShare(sourceId,paragraphs){
    await this.connect();
    for(let i=0;i<paragraphs.length;i+=10)await this.rpc.request('classmate/ingestShare',{source_id:sourceId,paragraphs:paragraphs.slice(i,i+10).map(p=>({uuid:p.uuid,text:p.text,observed_from:p.timeFrom,observed_to:p.timeTo}))},10000);
  }
}
