import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {INSTRUCTIONS,tutorTurnInstructions} from './tutor.mjs';
import {claudeSubscriptionLogin,subscriptionEnv} from './subscription-login.mjs';

// Second tutor provider: the official Claude Code CLI with the user's own claude.ai login.
// Same answer(input,onDelta,signal,onSearch,searchMode) shape as the Codex Tutor, so the
// server queue does not care which one is selected.
export const CLAUDE_MODEL='claude-sonnet-5';
export const CLAUDE_EFFORT='xhigh';
// Fixed isolation for every question: no CLAUDE.md/skills/plugins/hooks/MCP, nobody answers
// permission prompts, nothing is saved as a resumable session, no Chrome bridge.
export const CLAUDE_ISOLATION=['--safe-mode','--strict-mcp-config','--no-session-persistence','--permission-mode','manual','--permission-prompts','none','--disable-slash-commands','--no-chrome'];
// The CLI must not fall back to API-key billing even if the shell happens to carry a key.
export const STRIPPED_ENV=['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN'];
const WEB_TOOLS=['WebSearch','WebFetch'];

export function claudeArgs(searchMode='auto',instructions=INSTRUCTIONS){
  const web=searchMode!=='off';
  return ['-p','--model',CLAUDE_MODEL,'--effort',CLAUDE_EFFORT,...CLAUDE_ISOLATION,
    '--tools',web?WEB_TOOLS.join(','):'',...(web?['--allowedTools',...WEB_TOOLS]:[]),
    '--max-turns',web?'8':'1','--system-prompt',instructions+'\n\n'+tutorTurnInstructions(searchMode),
    '--input-format','stream-json','--output-format','stream-json','--verbose','--include-partial-messages'];
}
// Codex-style input items become Anthropic content blocks; screens stay base64 data, never files.
export function toContentBlocks(input){
  return input.map(item=>{
    if(item.type==='text')return {type:'text',text:item.text};
    if(item.type==='image'){const m=/^data:([\w.+/-]+);base64,([A-Za-z0-9+/=]+)$/.exec(item.url??'');if(!m)throw new Error('첨부 화면 형식을 읽지 못했어요.');return {type:'image',source:{type:'base64',media_type:m[1],data:m[2]}};}
    throw new Error('지원하지 않는 질문 입력입니다.');
  });
}
const MODEL_ERROR='요청한 Sonnet 모델을 연결하지 못했습니다. 다른 모델로 자동 전환하지 않습니다.';

export class ClaudeTutor {
  constructor(executable,cwd,{prefixArgs=[]}={}){this.executable=executable;this.cwd=cwd;this.prefixArgs=prefixArgs;this.current=null;}
  spawn(args,stdin){
    const env=subscriptionEnv();
    const child=spawn(this.executable,[...this.prefixArgs,...args],{cwd:this.cwd,env,windowsHide:true,stdio:[stdin?'pipe':'ignore','pipe','pipe']});
    child.stderr.on('data',()=>{}); // Never logged: may carry account or upstream detail.
    return child;
  }
  async connect(){if(!this.executable)throw new Error('Claude 실행 파일을 찾지 못했어요.');return this.account();}
  login({signal}){return claudeSubscriptionLogin(this.executable,this.cwd,{signal});}
  account(){
    return new Promise((resolve,reject)=>{
      let child;try{child=this.spawn(['auth','status'],false);}catch(e){return reject(e);}
      let out='';child.stdout.on('data',d=>{out+=d;});
      const timer=setTimeout(()=>{child.kill();reject(new Error('Claude 로그인 확인이 응답하지 않습니다.'));},20000);
      child.on('error',e=>{clearTimeout(timer);reject(e);});
      child.on('exit',()=>{clearTimeout(timer);let s;try{s=JSON.parse(out);}catch{s={};}resolve({loggedIn:s.loggedIn===true&&s.authMethod==='claude.ai',model:CLAUDE_MODEL,effort:CLAUDE_EFFORT});});
    });
  }
  async answer(input,onDelta,signal,onSearch,searchMode='auto',instructions=INSTRUCTIONS){
    if(this.current)throw new Error('먼저 진행 중인 답변을 마치거나 중지해 주세요.');
    if(signal?.aborted)throw new Error('답변을 중지했어요.');
    const blocks=toContentBlocks(input);
    let resolve,reject;const done=new Promise((ok,no)=>{resolve=ok;reject=no;});
    const child=this.spawn(claudeArgs(searchMode,instructions),true);
    const cur={child,finalText:'',settled:false};this.current=cur;
    const settle=(fn,value)=>{if(cur.settled)return;cur.settled=true;clearTimeout(cur.timer);if(this.current===cur)this.current=null;fn(value);};
    const stop=message=>{child.kill();settle(reject,new Error(message));};
    cur.timer=setTimeout(()=>stop('답변이 너무 오래 걸려 중지했습니다. 질문은 남겨 두었어요.'),180000);
    const abort=()=>stop('답변을 중지했어요.');signal?.addEventListener('abort',abort,{once:true});
    child.on('error',()=>settle(reject,new Error('Claude 연결을 시작하지 못했어요. Claude Code 설치 상태를 확인해 주세요.')));
    // 'close' fires after stdout is drained, so a result line written just before exit still counts.
    child.on('close',code=>settle(reject,new Error(code===0?'AI가 답변을 반환하지 않았어요.':'답변 생성이 끝나지 못했습니다. Claude 로그인과 사용 한도를 확인해 주세요.')));
    child.stdin.on('error',()=>{});
    const allowedTools=searchMode==='off'?[]:WEB_TOOLS;
    const webCalls=new Map();
    const reportTool=block=>{
      if(block?.type!=='tool_use'||!block.id||!allowedTools.includes(block.name)||webCalls.has(block.id))return;
      const kind=block.name==='WebFetch'?'fetch':'search';
      webCalls.set(block.id,kind);
      onSearch?.({id:block.id,kind,state:'searching'});
    };
    createInterface({input:child.stdout}).on('line',line=>{
      let m;try{m=JSON.parse(line);}catch{return;}
      if(m.type==='system'&&m.subtype==='init'){
        if(m.model!==CLAUDE_MODEL)return stop(MODEL_ERROR);
        // Compare the session's tools with the selected web mode.
        if((m.tools??[]).some(t=>!allowedTools.includes(t))||(m.mcp_servers??[]).length)return stop('튜터에 허용되지 않은 도구가 붙어 있어 중단했습니다.');
        return;
      }
      if(m.type==='stream_event'){
        const e=m.event??{};
        if(e.type==='message_start'&&e.message?.model&&e.message.model!==CLAUDE_MODEL)return stop(MODEL_ERROR);
        if(e.type==='content_block_start')reportTool(e.content_block);
        if(e.type==='content_block_delta'&&e.delta?.type==='text_delta'&&!m.parent_tool_use_id)onDelta(e.delta.text??'');
        return;
      }
      const content=Array.isArray(m.message?.content)?m.message.content:[];
      if(m.type==='user')for(const block of content){
        const kind=webCalls.get(block.tool_use_id);
        if(block.type==='tool_result'&&kind){
          webCalls.delete(block.tool_use_id);
          onSearch?.({id:block.tool_use_id,kind,state:'complete'});
        }
      }
      if(m.type==='assistant'){
        for(const block of content)reportTool(block);
        const text=content.filter(c=>c.type==='text').map(c=>c.text).join('');
        if(text)cur.finalText=text;
      }
      if(m.type==='result'){
        if(m.is_error||m.subtype!=='success')return settle(reject,new Error(m.subtype==='error_max_turns'?'웹 자료를 확인하다 답변을 마치지 못했어요. 웹 도구 설정을 바꿔 다시 물어봐 주세요.':'답변 생성이 끝나지 못했습니다. Claude 로그인과 사용 한도를 확인해 주세요.'));
        settle(resolve,typeof m.result==='string'&&m.result?m.result:cur.finalText);
      }
    });
    child.stdin.end(JSON.stringify({type:'user',message:{role:'user',content:blocks}})+'\n');
    try{return await done;}finally{signal?.removeEventListener('abort',abort);}
  }
  async cancel(){this.current?.child.kill();}
  close(){this.current?.child.kill();}
}
