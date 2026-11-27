import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';

export class Screens {
  constructor(profile,now=()=>Date.now()){this.dir=join(profile,'question-screens');this.now=now;this.captures=new Map();}
  async init(){await mkdir(this.dir,{recursive:true});try{this.key=(await readFile(join(this.dir,'pair-key'),'utf8')).trim();}catch{this.key=randomBytes(32).toString('hex');await writeFile(join(this.dir,'pair-key'),this.key,{mode:0o600});}if(!/^[a-f0-9]{64}$/.test(this.key))throw Error('화면 연결 키를 읽지 못했습니다.');}
  authorized(key){return typeof key==='string'&&/^[a-f0-9]{64}$/.test(key)&&key.length===this.key.length&&timingSafeEqual(Buffer.from(key),Buffer.from(this.key));}
  start(title){this.binding=randomUUID();this.title=typeof title==='string'?title.slice(0,160):'Chrome 수업 탭';this.frame=undefined;return {binding:this.binding};}
  stop(binding){if(binding===this.binding){this.binding=undefined;this.frame=undefined;}return {ok:true};}
  receive(data){if(!this.binding||data.binding!==this.binding)throw Error('수업 탭을 다시 연결해 주세요.');if(typeof data.jpeg!=='string'||data.jpeg.length>1500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(data.jpeg))throw Error('화면 형식을 확인해 주세요.');const bytes=Buffer.from(data.jpeg.split(',')[1],'base64');if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('JPEG 화면이 아닙니다.');this.frame={image:data.jpeg,captured_at:new Date(this.now()).toISOString(),received:this.now()};return {ok:true};}
  status(){return {connected:!!this.frame&&!!this.binding&&this.now()-this.frame.received<10000,title:this.title??'',capturedAt:this.frame?.captured_at};}
  capture(studyId,paragraphUuid){if(!this.status().connected)throw Error('수업 화면이 연결되지 않았습니다. 설정에서 Chrome 수업 탭을 연결해 주세요.');for(const [id,c]of this.captures)if(this.now()-c.created>600000)this.captures.delete(id);if(this.captures.size>=100)throw Error('선택한 화면이 너무 많습니다. 잠시 후 다시 선택해 주세요.');const id=randomUUID(),c={...this.frame,screen_id:id,studyId,paragraphUuid,title:this.title,created:this.now()};this.captures.set(id,c);return {screen_id:id,captured_at:c.captured_at,preview:c.image,title:c.title};}
  async get(id,studyId){if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw Error('화면 참조가 잘못됐습니다.');let c=this.captures.get(id);if(!c){try{c=JSON.parse(await readFile(join(this.dir,id+'.json'),'utf8'));}catch{throw Error('선택한 화면이 만료되었습니다. 다시 선택해 주세요.');}}if(c.studyId!==studyId)throw Error('다른 세션의 화면은 사용할 수 없습니다.');return c;}
  async retain(id,studyId){const c=await this.get(id,studyId);await writeFile(join(this.dir,id+'.json'),JSON.stringify(c),{mode:0o600});return c;}
}
