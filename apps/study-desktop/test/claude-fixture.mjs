// Fake `claude` CLI for tests: speaks the print-mode stream-json shape, never contacts a model.
import {createInterface} from 'node:readline';
const args=process.argv.slice(2);
const flag=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const line=o=>process.stdout.write(JSON.stringify(o)+'\n');
if(args[0]==='auth'&&args[1]==='status'){line({loggedIn:process.env.CLASSMATE_FIXTURE_LOGGED_OUT?false:true,authMethod:'claude.ai'});process.exit(0);}
const model=process.env.CLASSMATE_FIXTURE_MODEL??flag('--model');
const tools=flag('--tools')?flag('--tools').split(','):[];
const rl=createInterface({input:process.stdin});rl.on('line',async raw=>{
  const message=JSON.parse(raw).message;
  const text=message.content.filter(c=>c.type==='text').map(c=>c.text).join('');
  const images=message.content.filter(c=>c.type==='image'&&c.source?.type==='base64').length;
  line({type:'system',subtype:'init',model,tools:[...tools,...(process.env.CLASSMATE_FIXTURE_EXTRA_TOOL?['Bash']:[])],mcp_servers:[],permissionMode:flag('--permission-mode')});
  if(process.env.CLASSMATE_FIXTURE_HANG){setInterval(()=>{},1000);return;} // stays alive until the parent kills it
  line({type:'stream_event',event:{type:'message_start',message:{model}}});
  for(const [index,[name,trigger]] of [['WebSearch','검색'],['WebFetch','본문']].entries()){
    if(!tools.includes(name)||!text.includes(trigger))continue;
    const id=`toolu_${index+1}`;
    const tool={type:'tool_use',id,name};
    line({type:'stream_event',event:{type:'content_block_start',index:0,content_block:tool}});
    line({type:'assistant',message:{content:[tool]}});
    line({type:'user',message:{content:[{type:'tool_result',tool_use_id:id,content:'fixture result'}]}});
    line({type:'stream_event',event:{type:'message_start',message:{model}}});
  }
  const answer=JSON.stringify({text,images,tools,safe:args.includes('--safe-mode'),persist:!args.includes('--no-session-persistence'),prompts:flag('--permission-prompts'),system:(flag('--system-prompt')??'').slice(0,12),apiKey:process.env.ANTHROPIC_API_KEY??null});
  for(const piece of [answer.slice(0,10),answer.slice(10)])line({type:'stream_event',event:{type:'content_block_delta',index:0,delta:{type:'text_delta',text:piece}}});
  line({type:'assistant',message:{model,content:[{type:'text',text:answer}]}});
  line({type:'result',subtype:process.env.CLASSMATE_FIXTURE_FAIL?'error_during_execution':'success',is_error:!!process.env.CLASSMATE_FIXTURE_FAIL,result:answer,num_turns:1});
  rl.close();
});
