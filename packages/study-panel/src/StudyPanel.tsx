import React, {useEffect,useRef,useState} from 'react';
import {TranscriptFlow} from '@classmate/ui-classmate';
import {selectedTranscript,paragraphRange} from './selection';
import {AnswerBody} from './AnswerBody';
import {transcriptStatus} from './transcriptStatus';
import {defaults,readPreferences,savePreferences,normalizePreferences,type Preferences} from './preferences';
import {questionMessage,type Bridge,type Capture,type Paragraph,type Qa,type Snapshot,type LiveAnswer,type SelectionPart} from './bridge';

const clock=(s:string)=>new Date(s).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
const preciseClock=(s:string)=>new Date(s).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
type Draft={text:string; selection?:SelectionPart[]; followupId?:number; capture?:Capture; capturing:boolean; sent?:number; error?:string};
export function StudyPanel({bridge,pollMs=3000}:{bridge:Bridge;pollMs?:number}) {
  const [host,setHost]=useState<{name:string;canSend:boolean;canExpand:boolean}>();
  const [status,setStatus]=useState<Snapshot>();
  const [paragraphs,setParagraphs]=useState<Paragraph[]>([]);
  const [qa,setQa]=useState<Qa[]>([]);
  const [selected,setSelected]=useState<string>();
  const [rangeCandidate,setRangeCandidate]=useState<SelectionPart[]>([]);
  const [rangeMode,setRangeMode]=useState(false);
  const [rangeStart,setRangeStart]=useState<string>();
  const freezeTranscript=useRef(false);
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const [error,setError]=useState('');
  const [following,setFollowing]=useState(true);
  const [collapsed,setCollapsed]=useState<Record<number,boolean>>({});
  const [sending,setPending]=useState(false);
  const [lives,setLives]=useState<LiveAnswer[]>([]);
  const [liveCollapsed,setLiveCollapsed]=useState<Record<string,boolean>>({});
  const setLive=(a:LiveAnswer)=>setLives(old=>old.some(j=>j.id===a.id)?old.map(j=>j.id===a.id?a:j):[...old,a]);
  const pending=sending||lives.some(j=>['queued','preparing','streaming'].includes(j.state));
  const toggleLive=(id:string)=>setLiveCollapsed(old=>({...old,[id]:!old[id]}));
  const [help,setHelp]=useState(false);
  const [settings,setSettings]=useState(false);
  const [preferences,setPreferences]=useState(readPreferences);
  const [settingsNotice,setSettingsNotice]=useState('');
  const [chatText,setChatText]=useState('');
  const chatRevision=useRef(0);
  const draftRevisions=useRef(new Map<string,number>());
  const [searchMode,setSearchMode]=useState<'auto'|'off'|'required'>('auto');
  const [includeScreen,setIncludeScreen]=useState(true);
  const [pairInfo,setPairInfo]=useState<{code:string;extensionPath:string}>();
  const [chatScreen,setChatScreen]=useState<Capture>();
  const [chatError,setChatError]=useState('');
  const [newStudyOpen,setNewStudyOpen]=useState(false);
  const [studyName,setStudyName]=useState('');
  const [sourceUrl,setSourceUrl]=useState('');
  const [sourceOpen,setSourceOpen]=useState(false);
  const [switching,setSwitching]=useState(false);
  const [studyMenu,setStudyMenu]=useState(false);
  const [studyAction,setStudyAction]=useState<'rename'|'trash'>();
  const [trashOpen,setTrashOpen]=useState(false);
  const [actionNotice,setActionNotice]=useState('');
  const preferencesRef=useRef(preferences);
  const preferenceRevision=useRef(0);
  const panes=useRef<HTMLDivElement>(null);
  const [paneSize,setPaneSize]=useState({width:1000,height:600});
  useEffect(()=>{if(!panes.current||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(([entry])=>setPaneSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(panes.current);return()=>observer.disconnect();},[]);
  const minimumRatio=(columns:boolean)=>Math.min(45,(columns?280/Math.max(1,paneSize.width-24):150/Math.max(1,paneSize.height-54))*100);
  const visibleRatio=(ratio:number,columns:boolean)=>Math.max(minimumRatio(columns),Math.min(100-minimumRatio(columns),ratio));
  const studyId=useRef<string|undefined>(undefined);
  const chatViewport=useRef<HTMLDivElement>(null);
  const chatInput=useRef<HTMLTextAreaElement>(null);
  const chatFollowing=useRef(true);
  const [newWords,setNewWords]=useState(0);
  const updatePreferences=(p:Preferences)=>{preferencesRef.current=p;setPreferences(p);const revision=++preferenceRevision.current;const localSaved=savePreferences(p);setSettingsNotice(bridge.storePreferences?'설정 저장 중…':localSaved?'설정 저장됨':'이번 창에만 적용됨');if(bridge.storePreferences)void bridge.storePreferences(p).then(()=>{if(revision===preferenceRevision.current)setSettingsNotice('설정 저장됨');}).catch(()=>{if(revision===preferenceRevision.current)setSettingsNotice('설정 저장 실패 · 이번 창에만 적용됨');});};
  const resizePanes=(clientY:number,clientX:number)=>{const box=panes.current?.getBoundingClientRect();if(!box)return;const columns=preferencesRef.current.layout==='columns';const raw=(columns?(clientX-box.left)/Math.max(1,box.width):(clientY-box.top)/Math.max(1,box.height))*100;const edge=minimumRatio(columns)/2;const fold=raw<edge?'transcript':raw>100-edge?'chat':'none';const p={...preferencesRef.current,fold:fold as 'none'|'transcript'|'chat',...(fold==='none'?{[columns?'width':'height']:Math.round(visibleRatio(raw,columns))}:{})};preferencesRef.current=p;setPreferences(p);};
  const viewport=useRef<HTMLDivElement>(null);
  const follow=useRef(true);
  const submitting=useRef(false);
  const alive=useRef(true);
  const captures=useRef(new Map<string,Promise<Capture>>());
  const patch=(id:string,p:Partial<Draft>)=>setDrafts(ds=>({...ds,[id]:{...(ds[id]??{text:'',capturing:false}),...p}}));
  useEffect(()=>{
    alive.current=true; let timer:ReturnType<typeof setTimeout>;
    const refresh=async()=>{
      try {
        const s=await bridge.refresh(); if(!alive.current)return;
        if(studyId.current&&s.studyId!==studyId.current)return;
        studyId.current=s.studyId;setStatus(s);setError('');if(s.jobs)setLives(s.jobs);
        if(!freezeTranscript.current)setParagraphs(old=>{const map=new Map(old.map(p=>[p.uuid,p])); for(const p of s.paragraphs)map.set(p.uuid,p);return [...map.values()].sort((a,b)=>a.timeFrom.localeCompare(b.timeFrom)||(a.sourceIndex??0)-(b.sourceIndex??0));});
        setQa(old=>{const map=new Map(old.map(q=>[q.id,q]));for(const q of s.recentQa)map.set(q.id,q);return [...map.values()].sort((a,b)=>a.id-b.id);});
      } catch {if(alive.current)setError('전사 연결이 잠시 끊겼어요. 이전 내용은 유지하며 자동으로 다시 연결합니다.');}
      finally {if(alive.current)timer=setTimeout(refresh,pollMs);}
    };
    bridge.connect().then(h=>{if(alive.current){setHost(h);void refresh();if(bridge.loadPreferences)void bridge.loadPreferences().then(p=>{if(alive.current&&preferenceRevision.current===0){preferencesRef.current=normalizePreferences(p);setPreferences(preferencesRef.current);setSettingsNotice('설정 저장됨');}}).catch(()=>setSettingsNotice('저장된 설정을 불러오지 못함'));}}).catch(()=>{if(alive.current)setError(bridge.local?'Classmate 창 연결을 시작하지 못했어요. 바탕화면의 Classmate를 다시 열어 주세요.':'학습 패널을 연결하지 못했어요. 이 창을 파일로 열지 말고 Classmate가 연결된 AI 대화에서 열어 주세요.');});
    return()=>{alive.current=false;clearTimeout(timer);void bridge.close();};
  },[bridge,pollMs]);
  useEffect(()=>{if(follow.current&&viewport.current)viewport.current.scrollTop=viewport.current.scrollHeight;},[paragraphs,qa]);
  const previousParagraphs=useRef<Paragraph[]>([]);
  useEffect(()=>{const old=previousParagraphs.current;if(!follow.current)setNewWords(n=>n+paragraphs.filter(p=>!old.some(o=>o.uuid===p.uuid&&o.text===p.text)).length);previousParagraphs.current=paragraphs;},[paragraphs]);
  useEffect(()=>{if(chatFollowing.current&&chatViewport.current)chatViewport.current.scrollTop=chatViewport.current.scrollHeight;},[qa,lives]);
  const changeStudy=async(name?:string,id?:string,action?:'rename'|'trash'|'restore')=>{
    if(pending||switching)return;setSwitching(true);
    try{const s=action?await bridge.editStudy!(id!,action,name):name!==undefined?await bridge.newStudy!(name,sourceUrl):await bridge.chooseStudy!(id!);const same=studyId.current===s.studyId;studyId.current=s.studyId;setStatus(s);setParagraphs(s.paragraphs);setQa(s.recentQa);if(!same){freezeTranscript.current=false;setRangeCandidate([]);setRangeMode(false);setRangeStart(undefined);chatRevision.current++;setSelected(undefined);setDrafts({});setLives([]);setLiveCollapsed({});setChatText('');setChatError('');setCollapsed({});captures.current.clear();follow.current=true;setFollowing(true);setNewWords(0);}setNewStudyOpen(false);setSourceOpen(false);setSourceUrl('');setStudyMenu(false);setStudyAction(undefined);setStudyName('');setError('');previousParagraphs.current=s.paragraphs;setActionNotice(action==='trash'?'휴지통으로 이동했습니다. 세션 메뉴에서 복원할 수 있습니다.':action==='restore'?'세션을 복원했습니다.':action==='rename'?'이름을 변경했습니다.':'');}
    catch(e){setError(e instanceof Error?e.message:'세션을 열지 못했어요. 다시 시도해 주세요.');}
    finally{setSwitching(false);}
  };
  const connectRecording=async()=>{
    if(!status?.studyId||!bridge.connectSource||pending||switching)return;
    setSwitching(true);
    try{const s=await bridge.connectSource(status.studyId,sourceUrl);studyId.current=s.studyId;setStatus(s);setSourceOpen(false);setSourceUrl('');setError('');}
    catch(e){setError(e instanceof Error?e.message:'녹음 링크를 확인해 주세요.');}
    finally{setSwitching(false);}
  };
  const applyRange=(parts:SelectionPart[])=>{
    if(!parts.length)return;
    const id=parts[parts.length-1].uuid;
    setRangeMode(false);setRangeStart(undefined);setRangeCandidate([]);
    select(id,undefined,parts);
    window.getSelection()?.removeAllRanges();
  };
  const inspectSelection=()=>{
    if(rangeMode)return;
    const parts=viewport.current?selectedTranscript(viewport.current,paragraphs):[];
    setRangeCandidate(parts);
    freezeTranscript.current=!!parts.length||!!selected;
    if(parts.length){follow.current=false;setFollowing(false);}
  };
  const select=(id:string,reuseMoment?:string,selection?:SelectionPart[],followupId?:number)=>{
    if(!selection&&window.getSelection()?.toString().trim())return;
    if(rangeMode&&!selection){const start=rangeStart??id;setRangeStart(start);setRangeCandidate(paragraphRange(paragraphs,start,id));freezeTranscript.current=true;follow.current=false;setFollowing(false);return;}
    if(selected===id&&!selection){setSelected(undefined);freezeTranscript.current=false;return;}
    setSelected(id);freezeTranscript.current=true;follow.current=false;setFollowing(false);
    patch(id,{capturing:true,error:undefined,sent:undefined,selection,followupId});
    const capture=reuseMoment?Promise.resolve({moment_id:reuseMoment,captured_at:'기존 답변에 연결된 화면: 실제 촬영 시각은 moment 자료에서 확인'}):bridge.capture(id);captures.current.set(id,capture);
    capture.then(c=>{if(alive.current&&captures.current.get(id)===capture)patch(id,{capture:c,capturing:false});}).catch(()=>{if(alive.current&&captures.current.get(id)===capture)patch(id,{capture:undefined,capturing:false,error:'화면을 잡지 못했어요. 전사만으로 질문할 수 있어요.'});});
  };
  const send=async(p:Paragraph,question:string)=>{
    if(submitting.current||!host?.canSend||!question.trim())return;
    submitting.current=true;setPending(true);patch(p.uuid,{text:question,error:undefined});
    const revision=draftRevisions.current.get(p.uuid)??0;let accepted=false;
    const clear=()=>{if(accepted)return;accepted=true;if(bridge.local){submitting.current=false;setPending(false);}if((draftRevisions.current.get(p.uuid)??0)===revision)patch(p.uuid,{sent:Date.now(),text:''});};
    try {
      let cap=drafts[p.uuid]?.capture;
      try {cap=await captures.current.get(p.uuid);} catch {/* visible transcript-only fallback */}
      await bridge.send(questionMessage(p,question,cap,drafts[p.uuid]?.selection,{search_mode:searchMode,followup_id:drafts[p.uuid]?.followupId}),a=>{if(alive.current)setLive(a);},clear);
      clear();
    } catch(e) {patch(p.uuid,{error:bridge.local&&e instanceof Error?e.message:'질문을 전송하지 못했어요. 입력은 남겨 두었습니다. 연결 상태를 확인한 뒤 다시 눌러 주세요.'});}
    finally{if(!accepted||!bridge.local){submitting.current=false;if(alive.current)setPending(false);}}
  };
  const sendChat=async()=>{
    if(submitting.current||!host?.canSend||!chatText.trim())return;
    submitting.current=true;setPending(true);setChatError('');const question=chatText;
    const revision=chatRevision.current;let accepted=false;
    const clear=()=>{if(accepted)return;accepted=true;if(bridge.local){submitting.current=false;setPending(false);}if(chatRevision.current===revision)setChatText('');};
    try{let screen:Capture|undefined;if(includeScreen&&bridge.local&&status?.screen?.connected){screen=await bridge.capture();setChatScreen(screen);}await bridge.send(questionMessage(undefined,question,screen,undefined,{search_mode:searchMode}),a=>{if(alive.current)setLive(a);},clear);clear();}
    catch(e){setChatError(e instanceof Error?e.message:'질문을 보내지 못했어요. 입력은 남겨 두었습니다.');}
    finally{if(!accepted||!bridge.local){submitting.current=false;if(alive.current)setPending(false);}}
  };
  const answers=(p:Paragraph)=>qa.filter(q=>q.paragraphUuid===p.uuid);
  const foldSaved=(id:number)=>{setCollapsed(c=>({...c,[id]:true}));requestAnimationFrame(()=>document.querySelector(`[data-testid="answer-${id}"]`)?.scrollIntoView({block:"nearest"}));};
  const liveCard=(job:LiveAnswer)=><article className="answer live-answer" key={job.id} aria-label="생성 중인 답변"><header><span className="question-label">내 질문</span><strong>{job.question}</strong><button aria-expanded={!liveCollapsed[job.id]} onClick={()=>toggleLive(job.id)}>{liveCollapsed[job.id]?"펼치기":"접기"}</button>{["queued","preparing","streaming"].includes(job.state)&&<button onClick={()=>void bridge.cancel?.(job.id).catch(()=>setChatError("중지를 요청하지 못했어요."))}>{job.state==="queued"?"대기 취소":"답변 중지"}</button>}</header><small role="status">{job.error??(job.state==="queued"?`답변 대기 중${job.queuePosition?` · ${job.queuePosition}번째`:""}`:job.state==="done"?"답변 저장 완료":job.state==="cancelled"?"취소됨":job.searchState==="searching"?"공개 웹 자료 검색 중…":"답변 작성 중…")}</small>{!liveCollapsed[job.id]&&<>{job.state==="streaming"?<div className="answer-body">{job.answer}</div>:<AnswerBody text={job.answer}/>}<footer className="answer-footer"><button onClick={()=>toggleLive(job.id)}>접기</button></footer></>}</article>;
  const answerCard=(q:Qa)=><article className="answer" key={q.id} data-testid={`answer-${q.id}`}>
    <header><span className="question-label">내 질문</span><strong>{q.question}</strong><button aria-expanded={!(collapsed[q.id]??liveCollapsed[lives.find(j=>j.savedId===q.id)?.id??''])} onClick={()=>setCollapsed(c=>({...c,[q.id]:!(c[q.id]??liveCollapsed[lives.find(j=>j.savedId===q.id)?.id??''])}))}>{(collapsed[q.id]??liveCollapsed[lives.find(j=>j.savedId===q.id)?.id??''])?'펼치기':'접기'}</button></header>
    {!(collapsed[q.id]??liveCollapsed[lives.find(j=>j.savedId===q.id)?.id??''])&&<>{q.selection&&<details className="selected-evidence"><summary>선택한 내용 · {q.selection.length}개 문단</summary>{q.selection.map(p=><p key={p.uuid}>{p.text}</p>)}</details>}<AnswerBody text={q.answer}/><small>AI 설명 · {clock(q.askedAt)} · 기기에 저장됨</small><footer className="answer-footer"><button className="followup" onClick={()=>q.paragraphUuid?select(q.paragraphUuid,q.momentId,q.selection,q.id):chatInput.current?.focus()}>이 설명에 이어 묻기</button><button onClick={()=>foldSaved(q.id)}>접기</button></footer></>}
  </article>;
  const inline=(id:string)=>{
    const p=paragraphs.find(p=>p.uuid===id)!;const d=drafts[id];const saved=answers(p);
    const waiting=d?.sent&&!saved.some(q=>Date.parse(q.askedAt)>=d.sent!);
    if(!saved.length&&!lives.some(j=>j.paragraphUuid===id)&&selected!==id)return null;
    return <>{saved.map(answerCard)}{lives.filter(j=>j.paragraphUuid===id&&!saved.some(q=>q.id===j.savedId)).map(liveCard)}{selected===id&&<section className="composer" aria-label="선택한 문장에 질문">
      <header><strong>{d?.selection?`선택한 내용 · ${d.selection.length}개 문단`:"이 문장에서 무엇이 궁금하세요?"}</strong><button onClick={()=>{setSelected(undefined);freezeTranscript.current=false;}} aria-label="문장 선택 취소">취소 · Esc</button></header>
      {d?.selection&&<details className="selected-evidence"><summary>선택한 원문 확인</summary>{d.selection.map(p=><p key={p.uuid}>{p.text}</p>)}</details>}
      {d?.capture?.preview&&<details className="selected-evidence"><summary>첨부 화면 · {clock(d.capture.captured_at)} · {d.capture.title}</summary><img style={{maxWidth:'100%'}} src={d.capture.preview} alt="이번 질문에 첨부할 수업 화면"/><button onClick={()=>{patch(id,{capture:undefined});captures.current.delete(id);}}>화면 제외</button></details>}
      <div className="source-hint">{d?.capturing?'선택 순간의 화면을 잡고 있어요…':d?.capture?'선택한 문장 + 연결된 화면 + 앞 대화를 참고해요. 예전 문장과 현재 화면은 다를 수 있어요.':'선택한 문장을 참고해요 · 화면 없음'}</div>
      <div className="chips">{['쉽게 설명해줘','왜 필요한 거야?','예시로 보여줘','시퀀스 그림으로 설명해줘'].map(q=><button key={q} disabled={(!bridge.local&&pending)||sending||!host?.canSend} onClick={()=>void send(p,q)}>{q}</button>)}</div>
      <form onSubmit={e=>{e.preventDefault();void send(p,d?.text??'');}}><label className="sr-only" htmlFor={`q-${id}`}>추가 질문</label><textarea id={`q-${id}`} rows={2} placeholder="내 말로 질문해도 돼요" value={d?.text??''} onChange={e=>{draftRevisions.current.set(id,(draftRevisions.current.get(id)??0)+1);patch(id,{text:e.target.value});}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send(p,d?.text??'');}}}/><button className="primary" disabled={(!bridge.local&&pending)||sending||!host?.canSend||!d?.text.trim()}>{sending?'전송 중…':pending?'대기열에 추가':'질문 보내기'}</button></form>
      {d?.error&&<p className="notice" role="alert">{d.error}</p>}
      {waiting&&!bridge.local&&<p className="notice" role="status">질문을 AI 대화로 보냈어요. 답변은 채팅에 나오며, 저장되면 여기에도 표시됩니다. {Date.now()-d.sent!>60000?'오래 기다렸다면 AI 채팅의 승인·오류·중지 상태를 확인해 주세요. 자동으로 재전송하지 않습니다.':''}</p>}
    </section>}</>;
  };
  return <main className={`study-workspace layout-${preferences.layout??"rows"} fold-${preferences.fold??"none"}`} style={{'--left-fr':`${visibleRatio(preferences.width??45,true)}fr`,'--right-fr':`${100-visibleRatio(preferences.width??45,true)}fr`,'--transcript-size':`${preferences.transcript}px`,'--answer-size':`${preferences.answer}px`,'--study-height':`${preferences.height}vh`,'--top-fr':`${visibleRatio(preferences.height,false)}fr`,'--bottom-fr':`${100-visibleRatio(preferences.height,false)}fr`} as React.CSSProperties} onKeyDown={e=>{if(e.key==='Escape'){setSelected(undefined);freezeTranscript.current=false;setRangeCandidate([]);setRangeMode(false);setRangeStart(undefined);setNewStudyOpen(false);setStudyMenu(false);setStudyAction(undefined);setTrashOpen(false);}}}>
    <header className="masthead"><div><span className="eyebrow">CLASSMATE</span><h1>{status?.bundleName??'수업을 함께 이해해요'}</h1></div><div className="actions">{host?.canExpand&&<button onClick={()=>void bridge.expand().catch(()=>setError('이 앱에서는 크게 보기를 열지 못했어요.'))}>크게 보기</button>}<button aria-expanded={help} onClick={()=>setHelp(!help)}>사용 방법</button></div></header>
    {bridge.newStudy&&<nav className="study-navigation" aria-label="세션 기록"><label><span className="sr-only">세션 선택</span><select aria-label="세션 선택" value={status?.studyId??''} disabled={pending||switching} onChange={e=>void changeStudy(undefined,e.target.value)}>{!status?.studies?.length&&<option value="">기록 불러오는 중</option>}{status?.studies?.filter(s=>!s.deletedAt).map(s=><option key={s.id} value={s.id}>{s.name}{s.id===status.activeStudyId?' · 수집 중':''}</option>)}</select></label><button disabled={pending||switching} onClick={()=>{setNewStudyOpen(!newStudyOpen);setStudyAction(undefined);setStudyMenu(false);}}>＋ 새 세션</button>{bridge.editStudy&&<div className="study-menu"><button aria-label="세션 관리" aria-expanded={studyMenu} disabled={pending||switching} onClick={()=>setStudyMenu(!studyMenu)}>⋯</button>{studyMenu&&<div className="study-menu-items"><button onClick={()=>{setStudyName(status?.bundleName??'');setStudyAction('rename');setStudyMenu(false);setNewStudyOpen(false);}}>이름 변경</button><button className="danger-text" onClick={()=>{setStudyAction('trash');setStudyMenu(false);setNewStudyOpen(false);}}>삭제</button><button onClick={()=>{setTrashOpen(!trashOpen);setStudyMenu(false);}}>휴지통</button></div>}</div>}{status?.studyId!==status?.activeStudyId&&<span className="collecting-target">수집 중: {status?.studies?.find(s=>s.id===status.activeStudyId)?.name??'다른 세션'}<button disabled={pending||switching} onClick={()=>void changeStudy(undefined,status?.activeStudyId)}>해당 세션 열기</button></span>}</nav>}
    {studyAction==='rename'&&<form className="new-study" aria-label="세션 이름 변경" onSubmit={e=>{e.preventDefault();void changeStudy(studyName,status?.studyId,'rename');}}><label htmlFor="rename-study">세션 이름</label><input id="rename-study" autoFocus maxLength={100} value={studyName} onChange={e=>setStudyName(e.target.value)}/><div><button type="button" onClick={()=>setStudyAction(undefined)}>취소</button><button className="primary" disabled={switching||!studyName.trim()}>변경 저장</button></div></form>}
    {studyAction==='trash'&&<section className="study-confirm" role="region" aria-label="세션 삭제 확인"><strong>‘{status?.bundleName}’을 삭제할까요?</strong><p>휴지통으로 이동하며 전사와 대화는 복원할 수 있습니다. Tiro 원본은 삭제하지 않습니다.{status?.studyId===status?.activeStudyId?' 현재 수집 중인 세션이므로 이후 전사를 담을 빈 세션이 만들어집니다.':''}</p><div><button onClick={()=>setStudyAction(undefined)}>취소</button><button className="danger-text" disabled={switching} onClick={()=>void changeStudy(undefined,status?.studyId,'trash')}>휴지통으로 이동</button></div></section>}
    {trashOpen&&<section className="study-trash" aria-label="휴지통"><header><h2>휴지통</h2><button aria-label="휴지통 닫기" onClick={()=>setTrashOpen(false)}>닫기</button></header>{status?.studies?.some(s=>s.deletedAt)?status.studies.filter(s=>s.deletedAt).map(s=><div key={s.id}><span>{s.name}</span><button disabled={pending||switching} onClick={()=>void changeStudy(undefined,s.id,'restore')}>복원</button></div>):<p>삭제한 세션이 없습니다.</p>}</section>}
    {actionNotice&&<div className="action-notice" role="status">{actionNotice}<button aria-label="알림 닫기" onClick={()=>setActionNotice('')}>×</button></div>}
    {newStudyOpen&&<form className="new-study" aria-label="새 세션 만들기" onSubmit={e=>{e.preventDefault();void changeStudy(studyName);}}><label htmlFor="study-name">세션 이름</label><input id="study-name" autoFocus maxLength={100} placeholder="예: Spring 04~06" value={studyName} onChange={e=>setStudyName(e.target.value)}/><label htmlFor="new-tiro-url">Tiro 공유 링크</label><input id="new-tiro-url" type="url" maxLength={2048} placeholder="https://tiro.ooo/s/…" autoComplete="off" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}/><p>Tiro 녹음에서 공유 → 링크 복사 후 붙여 넣으세요. 해당 녹음에 보이는 전사와 이후 변경을 이 세션에 저장합니다. 링크 없이 시작하면 대화만 사용할 수 있습니다.</p><div><button type="button" onClick={()=>{setNewStudyOpen(false);setSourceUrl('');}}>취소</button><button className="primary" disabled={switching||!studyName.trim()}>세션 시작</button></div></form>}
    {bridge.connectSource&&!newStudyOpen&&(settings||status?.recording?.mode==="none")&&<div className="recording-link"><span>{status?.recording?.title??(status?.recording?.mode==='share'?'Tiro 공유 녹음':status?.recording?.mode==='api'?'기존 API 연결':'연결된 녹음 없음')}</span><button disabled={pending||switching} onClick={()=>{setSourceUrl(status?.recording?.url??'');setSourceOpen(!sourceOpen);}}>{status?.recording?.mode==='share'?'녹음 연결 관리':'Tiro 링크 연결'}</button></div>}
    {sourceOpen&&<form className="new-study" aria-label="Tiro 녹음 연결" onSubmit={e=>{e.preventDefault();void connectRecording();}}><label htmlFor="tiro-url">Tiro 공유 링크</label><input id="tiro-url" type="url" autoFocus autoComplete="off" maxLength={2048} value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://tiro.ooo/s/…"/><p>한 세션에 녹음 하나를 연결합니다. 다른 녹음은 ‘새 세션’으로 시작하세요. 다시 연결하면 이 세션의 수집을 재개합니다. 링크와 기록은 이 PC에만 저장됩니다.</p><div><button type="button" onClick={()=>setSourceOpen(false)}>취소</button><button className="primary" disabled={switching||!sourceUrl.trim()}>녹음 연결</button></div></form>}
    <div className="connection" role="status"><span>{transcriptStatus(status)}</span>{bridge.local&&<span>{status?.screen?.connected?'수업 화면 연결됨':'수업 화면 없음'}</span>}<button aria-expanded={settings} onClick={()=>setSettings(!settings)}>화면 설정</button><button aria-pressed={rangeMode} onClick={()=>{setRangeMode(!rangeMode);setRangeStart(undefined);setRangeCandidate([]);window.getSelection()?.removeAllRanges();freezeTranscript.current=!!selected;}}>{rangeMode?"문단 선택 취소":"문단 선택"}</button><span className="layout-tools"><button aria-pressed={preferences.layout==="columns"} onClick={()=>updatePreferences({...preferences,layout:"columns"})}>좌우</button><button aria-pressed={preferences.layout!=="columns"} onClick={()=>updatePreferences({...preferences,layout:"rows"})}>상하</button></span></div>
    {settings&&<section className="display-settings" aria-label="화면 설정"><strong>화면 설정</strong><label>웹 검색<select aria-label="웹 검색" value={searchMode} onChange={e=>setSearchMode(e.target.value as typeof searchMode)}><option value="auto">필요할 때 자동</option><option value="required">검색해서 답변</option><option value="off">사용 안 함</option></select></label><span>대화 상대 · {host?.name??"연결 중"}</span><button onClick={()=>setHelp(!help)}>사용 방법</button>{([['transcript','전사 글씨',14,28],['answer','답변 글씨',14,28],['height','상하 전사 비율',5,95]] as const).map(([key,label,min,max])=><label key={key}>{label}<input aria-label={label} type="range" min={min} max={max} value={preferences[key]} onChange={e=>updatePreferences({...preferences,[key]:Number(e.target.value)})}/><output>{preferences[key]}{key==='height'?'%':'px'}</output></label>)}<button onClick={()=>updatePreferences({...defaults})}>기본값 복원</button><p>자동으로 이 PC에 저장됩니다. 영역 사이 구분선을 드래그해도 비율을 바꿀 수 있습니다.</p></section>}
    {settings&&bridge.screenPair&&<section className="screen-settings"><strong>Chrome 수업 화면</strong><p>처음 한 번 아래 폴더를 Chrome 확장 관리의 ‘압축해제된 확장 프로그램 로드’로 등록하세요. 수업 탭에서 Local 확장 아이콘을 눌러 연결 코드를 넣습니다. 다른 개인 탭은 공유하지 않습니다.</p><button onClick={()=>void bridge.screenPair!().then(setPairInfo).catch(()=>setSettingsNotice('화면 연결 정보를 읽지 못했습니다.'))}>연결 정보 보기</button>{pairInfo&&<><p>확장 폴더</p><input readOnly aria-label="Local 화면 확장 폴더" value={pairInfo.extensionPath}/><p>연결 코드 · 외부에 공유하지 마세요</p><input readOnly aria-label="Local 화면 연결 코드" value={pairInfo.code}/><button onClick={()=>void navigator.clipboard.writeText(pairInfo.code).then(()=>setSettingsNotice('연결 코드 복사됨')).catch(()=>setSettingsNotice('코드 입력란을 선택해서 복사해 주세요.'))}>연결 코드 복사</button></>}</section>}
    {help&&<aside className="help"><strong>녹음 켜기 → 문장 누르기 → 바로 질문</strong><p>Tiro에서 녹음을 시작하고 영상을 보세요. 아래 문장을 누르면 그 자리에 질문창이 열립니다. Alt+S나 폴더 선택은 필요 없어요. {bridge.local?'답변도 그 문장 아래에 바로 쌓입니다. 옆 채팅으로 이동할 필요가 없어요.':'저장된 답은 문장 아래에도 보입니다.'}</p><p>로컬 보관 / 선택한 AI 제공자로 전송될 수 있음 / Corthex 서버 기본 전송 없음</p><p>‘취소’는 문장 선택을 해제합니다. {bridge.local?'생성 중인 답변의 ‘답변 중지’를 누르면 생성을 멈춥니다.':'이미 보낸 답변은 현재 AI 앱에서 중지하세요.'} 전사는 Tiro가 반환하는 대로 진행 중인 문장도 갱신합니다. 음성을 글로 바꾸는 시간은 별도로 걸릴 수 있습니다.</p></aside>}
    {error&&<p className="notice" role="alert">{error}</p>}
    {host&&!host.canSend&&<p className="notice" role="alert">{bridge.local?'GPT 연결을 준비하지 못했어요. Codex의 ChatGPT 로그인과 사용 한도를 확인한 뒤 Classmate를 다시 열어 주세요.':'이 AI 앱은 패널에서 질문 보내기를 지원하지 않아요. 현재 AI 채팅에 직접 질문하거나 MCP Apps 메시지 전송을 지원하는 앱에서 여세요.'}</p>}
    {rangeMode&&<div className="selection-actions" role="status">{rangeStart?"다른 문단을 누르면 그곳까지 범위가 바뀝니다. 선택 후 ‘이 내용 질문’을 누르세요.":"시작 문단을 누른 다음, 원하는 끝 문단을 누르세요. 사이 문단도 모두 포함됩니다."}</div>}
    {!!rangeCandidate.length&&<div className="selection-actions"><span>{rangeCandidate.length}개 문단 선택</span><button onMouseDown={e=>e.preventDefault()} onClick={()=>applyRange(rangeCandidate)}>이 내용 질문</button><button onClick={()=>{setRangeCandidate([]);setRangeStart(undefined);window.getSelection()?.removeAllRanges();freezeTranscript.current=!!selected;}}>선택 해제</button></div>}
    {lives.some(j=>j.state==="queued")&&<div className="queue-notice" role="status">대기 {lives.filter(j=>j.state==="queued").length}개 · 순서대로 답변합니다. 앱을 종료하면 남은 대기는 취소됩니다.</div>}
    <div className="reading-panes" ref={panes}>
    {preferences.fold&&preferences.fold!=="none"&&<button className={`pane-reopen reopen-${preferences.fold}`} onClick={()=>updatePreferences({...preferences,fold:"none"})}>{preferences.fold==="transcript"?"전사 열기":"대화 열기"}</button>}
    <section className="transcript-pane"><header className="transcript-heading"><h2>수업 전사</h2></header>
    <div className="transcript-scroll" ref={viewport} tabIndex={0} aria-label="수업 전사와 문장별 대화" onMouseDown={()=>{freezeTranscript.current=true;}} onMouseUp={inspectSelection} onKeyUp={inspectSelection} onScroll={()=>{const e=viewport.current!;const yes=e.scrollHeight-e.clientHeight-e.scrollTop<45&&!selected;follow.current=yes;setFollowing(yes);}}>
      {!paragraphs.length?<section className="empty"><h2>{status?.recording?.mode==='none'?'녹음을 연결해 주세요':status?.recording?.mode==='share'?transcriptStatus(status):status?.status.daemon==='alive'&&!status?.delivery?.refreshError?'전사 대기 중':'전사 연결 복구 중'}</h2><p>{status?.recording?.mode==='none'?'위의 ‘Tiro 링크 연결’에 녹음 공유 링크를 붙여 넣으세요.':status?.recording?.mode==='share'?(status.recording.message??'공유 화면에 전사가 표시되면 여기에 반영됩니다. 휴대폰 녹음도 같은 방법으로 연결할 수 있습니다.'):'자료 연결을 확인하고 있습니다. 기존 기록은 보존됩니다.'}</p></section>:<TranscriptFlow lines={paragraphs.map(p=>({id:p.uuid,time:p.timeBasis==='observed'?`수신 ${clock(p.timeFrom)}`:clock(p.timeFrom),segments:[{text:p.text}]}))} selectedIds={rangeCandidate.length?rangeCandidate.map(p=>p.uuid):selected?(drafts[selected]?.selection?.map(p=>p.uuid)??[selected]):[]} onSentence={select} renderAfter={inline} showTimes/>}
    </div>
    </section>
    <div className="transcript-status"><span>{transcriptStatus(status)}{!following?' · 자동 스크롤 일시정지':''}</span>{!following&&newWords>0&&<button onClick={()=>{setSelected(undefined);setRangeMode(false);setRangeStart(undefined);setRangeCandidate([]);freezeTranscript.current=false;follow.current=true;setFollowing(true);setNewWords(0);viewport.current?.scrollTo({top:viewport.current.scrollHeight});}}>맨 아래로 ↓</button>}<span title="공유 전사의 수신 시각은 실제 발화 시각과 다릅니다.">{status?.recording?.mode==='share'?(status.recording.lastCheckedAt?`공유 화면 확인 ${preciseClock(status.recording.lastCheckedAt)}`:''):status?.status.lastTiroSuccessAt?`Tiro 응답 ${preciseClock(status.status.lastTiroSuccessAt)}`:''}</span></div>
    <div className="pane-divider" role="separator" aria-label="전사와 대화 크기 조절" aria-orientation={preferences.layout==="columns"?"vertical":"horizontal"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={preferences.fold==="transcript"?0:preferences.fold==="chat"?100:preferences.layout==="columns"?(preferences.width??45):preferences.height} tabIndex={0} title="드래그로 크기 조절 · 방향키로 미세 조절 · 두 번 클릭하면 기본 비율" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))resizePanes(e.clientY,e.clientX);}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){e.currentTarget.releasePointerCapture(e.pointerId);updatePreferences(preferencesRef.current);}}} onPointerCancel={()=>updatePreferences(preferencesRef.current)} onDoubleClick={()=>updatePreferences({...preferences,height:50,width:50,fold:'none'})} onKeyDown={e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Enter'].includes(e.key)){e.preventDefault();const key=preferences.layout==='columns'?'width':'height';const ratio=preferences[key]??45;if(e.key==='Enter')updatePreferences({...preferences,fold:preferences.fold&&preferences.fold!=='none'?'none':'chat'});else if(e.key==='Home'||e.key==='End')updatePreferences({...preferences,fold:e.key==='Home'?'transcript':'chat'});else updatePreferences({...preferences,fold:'none',[key]:visibleRatio(ratio+(['ArrowUp','ArrowLeft'].includes(e.key)?-2:2),preferences.layout==='columns')});}}}><span/></div>
    <section className="chat-dock" aria-label="자유 대화">
      <header className="chat-heading"><h2>대화</h2><span>수업을 보며 편하게 물어보세요</span></header>
      <div className="chat-history" ref={chatViewport} role="region" aria-label="대화 내용" onScroll={()=>{const e=chatViewport.current!;chatFollowing.current=e.scrollHeight-e.scrollTop-e.clientHeight<50;}}>
        {qa.filter(q=>!q.paragraphUuid).map(answerCard)}
        {!qa.some(q=>!q.paragraphUuid)&&!lives.some(j=>!j.paragraphUuid)&&<p className="chat-empty">“지금 배운 내용을 정리해줘”처럼 질문해 보세요.</p>}
        {lives.filter(j=>!j.paragraphUuid&&!qa.some(q=>q.id===j.savedId)).map(liveCard)}
      </div>
      {bridge.local&&<div className="chat-screen-option"><label><input type="checkbox" checked={includeScreen} onChange={e=>setIncludeScreen(e.target.checked)}/> 수업 화면 포함</label><span>{status?.screen?.connected?status.screen.title:'화면 없음 · 전사로 질문'}</span>{chatScreen?.preview&&<details><summary>직전 첨부 화면</summary><img style={{maxWidth:'100%',maxHeight:180}} src={chatScreen.preview} alt="직전 대화에 첨부한 화면"/></details>}</div>}
      <form className="chat-input" onSubmit={e=>{e.preventDefault();chatFollowing.current=true;void sendChat();}}><label className="sr-only" htmlFor="free-question">대화 질문</label><textarea ref={chatInput} id="free-question" rows={2} maxLength={8000} placeholder="궁금한 걸 물어보세요" value={chatText} onChange={e=>{chatRevision.current++;setChatText(e.target.value);}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();chatFollowing.current=true;void sendChat();}}}/>{pending&&!bridge.local?<button type="button" aria-label="생성 중지" onClick={()=>void bridge.cancel?.().catch(()=>setChatError('중지를 요청하지 못했어요.'))}>■ 중지</button>:<button className="primary" aria-label="대화 보내기" disabled={sending||!host?.canSend||!chatText.trim()}>↑</button>}</form>
      {chatError&&<p role="alert" className="notice">{chatError}</p>}
    </section>
    </div>
    <div className="preferences-status" role="status">{settingsNotice}</div>
  </main>;
}
