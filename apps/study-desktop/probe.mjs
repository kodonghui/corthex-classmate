// Explicit, opt-in real inference. Synthetic text only; no study database or screenshots.
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Tutor,MODEL,EFFORT} from './tutor.mjs';
import {ClaudeTutor,CLAUDE_MODEL,CLAUDE_EFFORT} from './claude-tutor.mjs';
if(!process.argv.includes('--real-ai'))throw new Error('Real inference requires --real-ai');
const entry=process.argv[process.argv.indexOf('--entry')+1];
const provider=process.argv.includes('--provider')?process.argv[process.argv.indexOf('--provider')+1]:'codex';
const searchMode=process.argv.includes('--search')?process.argv[process.argv.indexOf('--search')+1]:'off';
const cwd=await mkdtemp(join(tmpdir(),'classmate-tutor-probe-'));
const tutor=provider==='claude'?new ClaudeTutor(entry,cwd):new Tutor(entry,cwd);let text='';let first;let searches=0;
const [model,effort]=provider==='claude'?[CLAUDE_MODEL,CLAUDE_EFFORT]:[MODEL,EFFORT];
try{
 const account=await tutor.connect();console.log(JSON.stringify({stage:'account',...account}));
 const start=Date.now();
 // Search mode 'required' needs a question that only public web material can answer; still synthetic, never lesson data.
 const question=searchMode==='required'?'시험용 질문입니다. 기억으로 답하지 말고 제공된 공개 웹 검색을 실제로 한 번 호출해, Anthropic 공식 문서의 Claude Code CLI 참조 페이지 제목과 전체 URL 을 Markdown 링크로 알려 주세요. 그런 다음 사용자와 서버 둘만 나오는 짧은 Mermaid sequenceDiagram 하나를 붙여 주세요. 개인 자료는 없습니다.':'시험용 질문입니다. REST API 요청과 응답을 중학생에게 설명하듯 두 문장으로 설명하고, 사용자와 서버 둘만 나오는 짧은 Mermaid sequenceDiagram 하나를 붙여 주세요. 다른 자료나 도구는 필요 없습니다.';
 const result=await tutor.answer([{type:'text',text:question}],delta=>{text+=delta;if(!first){first=Date.now();console.log(JSON.stringify({stage:'first-token',milliseconds:first-start}));}},undefined,event=>{if(event.state==='searching')searches++;},searchMode);
 console.log(JSON.stringify({stage:'complete',provider,model,effort,searchMode,searches,milliseconds:Date.now()-start,characters:(result||text).length,sequence:(result||text).includes('sequenceDiagram')}));
 if(!(result||text).includes('sequenceDiagram')||searchMode==='required'&&!searches)process.exitCode=1;
}catch(e){console.log(JSON.stringify({stage:'failed',error:e.message}));process.exitCode=1;}finally{tutor.close();}
