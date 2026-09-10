// Explicit, opt-in real inference. Synthetic text only; no study database or screenshots.
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Tutor,MODEL,EFFORT} from './tutor.mjs';
if(!process.argv.includes('--real-ai'))throw new Error('Real inference requires --real-ai');
const entry=process.argv[process.argv.indexOf('--entry')+1];
const cwd=await mkdtemp(join(tmpdir(),'classmate-tutor-probe-'));
const tutor=new Tutor(entry,cwd);let text='';let first;
try{
 const account=await tutor.connect();console.log(JSON.stringify({stage:'account',...account}));
 const start=Date.now();
 const result=await tutor.answer([{type:'text',text:'시험용 질문입니다. REST API 요청과 응답을 중학생에게 설명하듯 두 문장으로 설명하고, 사용자와 서버 둘만 나오는 짧은 Mermaid sequenceDiagram 하나를 붙여 주세요. 다른 자료나 도구는 필요 없습니다.'}],delta=>{text+=delta;if(!first){first=Date.now();console.log(JSON.stringify({stage:'first-token',milliseconds:first-start}));}});
 console.log(JSON.stringify({stage:'complete',model:MODEL,effort:EFFORT,milliseconds:Date.now()-start,characters:(result||text).length,sequence:(result||text).includes('sequenceDiagram')}));
 if(!(result||text).includes('sequenceDiagram'))process.exitCode=1;
}catch(e){console.log(JSON.stringify({stage:'failed',error:e.message}));process.exitCode=1;}finally{tutor.close();}
