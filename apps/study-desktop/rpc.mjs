import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {EventEmitter} from 'node:events';

/** JSONL transport. Child stderr, credentials and arbitrary upstream errors never become logs. */
export class Rpc extends EventEmitter {
  constructor(executable,args,options={}) {
    super(); this.serial=0; this.pending=new Map(); this.closed=false;
    this.child=spawn(executable,args,{...options,windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.child.stderr.on('data',()=>{});
    this.child.on('error',()=>this.fail());this.child.on('exit',()=>this.fail());
    this.child.stdin.on('error',()=>this.fail());
    createInterface({input:this.child.stdout}).on('line',line=>{
      let msg;try{msg=JSON.parse(line);}catch{return this.fail();}
      if(msg.method){
        // Tutors do not get command, file, connector, or escalation authority.
        if(msg.id!==undefined)this.child.stdin.write(JSON.stringify({id:msg.id,error:{code:-32601,message:'This study client does not allow tool execution or approvals.'}})+'\n');
        else this.emit('notification',msg.method,msg.params);
        return;
      }
      const p=this.pending.get(msg.id);if(!p)return;
      clearTimeout(p.timer);this.pending.delete(msg.id);
      msg.error?p.reject(new Error('자료 연결 요청이 거절되었습니다. 연결 점검이 필요합니다.')):p.resolve(msg.result);
    });
  }
  fail(){if(this.closed)return;this.closed=true;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('연결 프로그램이 종료되었습니다. Classmate를 다시 열어 주세요.'));}this.pending.clear();this.emit('disconnected');}
  request(method,params={},timeout=30000){return new Promise((resolve,reject)=>{
    if(this.closed)return reject(new Error('연결 프로그램이 실행 중이지 않습니다.'));
    const id=++this.serial;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('연결 응답 시간이 초과되었습니다.'));},timeout);
    this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
  });}
  notify(method,params={}){if(!this.closed)this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',method,params})+'\n');}
  close(){this.child.stdin.end();this.child.kill();this.fail();}
}
