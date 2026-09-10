import React, {useEffect,useRef,useState} from 'react';
import {TranscriptFlow} from '@classmate/ui-classmate';
import {AnswerBody} from './AnswerBody';
import {defaults,readPreferences,savePreferences,type Preferences} from './preferences';
import {questionMessage,type Bridge,type Capture,type Paragraph,type Qa,type Snapshot,type LiveAnswer} from './bridge';

const clock=(s:string)=>new Date(s).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
type Draft={text:string; capture?:Capture; capturing:boolean; sent?:number; error?:string};
export function StudyPanel({bridge,pollMs=3000}:{bridge:Bridge;pollMs?:number}) {
  const [host,setHost]=useState<{name:string;canSend:boolean;canExpand:boolean}>();
  const [status,setStatus]=useState<Snapshot>();
  const [paragraphs,setParagraphs]=useState<Paragraph[]>([]);
  const [qa,setQa]=useState<Qa[]>([]);
  const [selected,setSelected]=useState<string>();
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const [error,setError]=useState('');
  const [following,setFollowing]=useState(true);
  const [collapsed,setCollapsed]=useState<Record<number,boolean>>({});
  const [pending,setPending]=useState(false);
  const [live,setLive]=useState<LiveAnswer>();
  const [help,setHelp]=useState(false);
  const [settings,setSettings]=useState(false);
  const [preferences,setPreferences]=useState(readPreferences);
  const [settingsNotice,setSettingsNotice]=useState('');
  const [chatText,setChatText]=useState('');
  const [chatError,setChatError]=useState('');
  const [newStudyOpen,setNewStudyOpen]=useState(false);
  const [studyName,setStudyName]=useState('');
  const [switching,setSwitching]=useState(false);
  const [studyMenu,setStudyMenu]=useState(false);
  const [studyAction,setStudyAction]=useState<'rename'|'trash'>();
  const [trashOpen,setTrashOpen]=useState(false);
  const [actionNotice,setActionNotice]=useState('');
  const preferencesRef=useRef(preferences);
  const preferenceRevision=useRef(0);
  const panes=useRef<HTMLDivElement>(null);
  const studyId=useRef<string|undefined>(undefined);
  const chatViewport=useRef<HTMLDivElement>(null);
  const chatInput=useRef<HTMLTextAreaElement>(null);
  const chatFollowing=useRef(true);
  const [newWords,setNewWords]=useState(0);
  const updatePreferences=(p:Preferences)=>{preferencesRef.current=p;setPreferences(p);const revision=++preferenceRevision.current;const localSaved=savePreferences(p);setSettingsNotice(bridge.storePreferences?'설정 저장 중…':localSaved?'설정 저장됨':'이번 창에만 적용됨');if(bridge.storePreferences)void bridge.storePreferences(p).then(()=>{if(revision===preferenceRevision.current)setSettingsNotice('설정 저장됨');}).catch(()=>{if(revision===preferenceRevision.current)setSettingsNotice('설정 저장 실패 · 이번 창에만 적용됨');});};
  const resizePanes=(clientY:number)=>{const box=panes.current?.getBoundingClientRect();if(!box)return;const height=Math.round(Math.max(30,Math.min(90,(clientY-box.top-15)/Math.max(1,box.height-48)*100)));const p={...preferencesRef.current,height};preferencesRef.current=p;setPreferences(p);};
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
        studyId.current=s.studyId;setStatus(s);setError('');
        setParagraphs(old=>{const map=new Map(old.map(p=>[p.uuid,p])); for(const p of s.paragraphs)map.set(p.uuid,p);return [...map.values()].sort((a,b)=>a.timeFrom.localeCompare(b.timeFrom));});
        setQa(old=>{const map=new Map(old.map(q=>[q.id,q]));for(const q of s.recentQa)map.set(q.id,q);return [...map.values()].sort((a,b)=>a.id-b.id);});
      } catch {if(alive.current)setError('전사 연결이 잠시 끊겼어요. 이전 내용은 유지하며 자동으로 다시 연결합니다.');}
      finally {if(alive.current)timer=setTimeout(refresh,pollMs);}
    };
    bridge.connect().then(h=>{if(alive.current){setHost(h);void refresh();if(bridge.loadPreferences)void bridge.loadPreferences().then(p=>{if(alive.current&&preferenceRevision.current===0){preferencesRef.current=p;setPreferences(p);setSettingsNotice('설정 저장됨');}}).catch(()=>setSettingsNotice('저장된 설정을 불러오지 못함'));}}).catch(()=>{if(alive.current)setError(bridge.local?'Classmate 창 연결을 시작하지 못했어요. 바탕화면의 Classmate를 다시 열어 주세요.':'학습 패널을 연결하지 못했어요. 이 창을 파일로 열지 말고 Classmate가 연결된 AI 대화에서 열어 주세요.');});
    return()=>{alive.current=false;clearTimeout(timer);void bridge.close();};
  },[bridge,pollMs]);
  useEffect(()=>{if(follow.current&&viewport.current)viewport.current.scrollTop=viewport.current.scrollHeight;},[paragraphs,qa]);
  const previousParagraphs=useRef<Paragraph[]>([]);
  useEffect(()=>{const old=previousParagraphs.current;if(!follow.current)setNewWords(n=>n+paragraphs.filter(p=>!old.some(o=>o.uuid===p.uuid&&o.text===p.text)).length);previousParagraphs.current=paragraphs;},[paragraphs]);
  useEffect(()=>{if(chatFollowing.current&&chatViewport.current)chatViewport.current.scrollTop=chatViewport.current.scrollHeight;},[qa,live]);
  const changeStudy=async(name?:string,id?:string,action?:'rename'|'trash'|'restore')=>{
    if(pending||switching)return;setSwitching(true);
    try{const s=action?await bridge.editStudy!(id!,action,name):name!==undefined?await bridge.newStudy!(name):await bridge.chooseStudy!(id!);const same=studyId.current===s.studyId;studyId.current=s.studyId;setStatus(s);setParagraphs(s.paragraphs);setQa(s.recentQa);if(!same){setSelected(undefined);setDrafts({});setLive(undefined);setChatText('');setChatError('');setCollapsed({});captures.current.clear();follow.current=true;setFollowing(true);setNewWords(0);}setNewStudyOpen(false);setStudyMenu(false);setStudyAction(undefined);setStudyName('');setError('');previousParagraphs.current=s.paragraphs;setActionNotice(action==='trash'?'휴지통으로 이동했습니다. 세션 메뉴에서 복원할 수 있습니다.':action==='restore'?'세션을 복원했습니다.':action==='rename'?'이름을 변경했습니다.':'');}
    catch(e){setError(e instanceof Error?e.message:'세션을 열지 못했어요. 다시 시도해 주세요.');}
    finally{setSwitching(false);}
  };
  const select=(id:string,reuseMoment?:string)=>{
    if(selected===id){setSelected(undefined);return;}
    setSelected(id);follow.current=false;setFollowing(false);
    patch(id,{capturing:true,error:undefined,sent:undefined});
    const capture=reuseMoment?Promise.resolve({moment_id:reuseMoment,captured_at:'기존 답변에 연결된 화면: 실제 촬영 시각은 moment 자료에서 확인'}):bridge.capture(id);captures.current.set(id,capture);
    capture.then(c=>{if(alive.current&&captures.current.get(id)===capture)patch(id,{capture:c,capturing:false});}).catch(()=>{if(alive.current&&captures.current.get(id)===capture)patch(id,{capture:undefined,capturing:false,error:'화면을 잡지 못했어요. 전사만으로 질문할 수 있어요.'});});
  };
  const send=async(p:Paragraph,question:string)=>{
    if(submitting.current||!host?.canSend||!question.trim())return;
    submitting.current=true;setPending(true);patch(p.uuid,{text:question,error:undefined});
    try {
      let cap=drafts[p.uuid]?.capture;
      try {cap=await captures.current.get(p.uuid);} catch {/* visible transcript-only fallback */}
      await bridge.send(questionMessage(p,question,cap),a=>{if(alive.current)setLive(a);});
      patch(p.uuid,{sent:Date.now(),text:''});
    } catch(e) {patch(p.uuid,{error:bridge.local&&e instanceof Error?e.message:'질문을 전송하지 못했어요. 입력은 남겨 두었습니다. 연결 상태를 확인한 뒤 다시 눌러 주세요.'});}
    finally{submitting.current=false;if(alive.current)setPending(false);}
  };
  const sendChat=async()=>{
    if(submitting.current||!host?.canSend||!chatText.trim())return;
    submitting.current=true;setPending(true);setChatError('');const question=chatText;
    try{await bridge.send(questionMessage(undefined,question),a=>{if(alive.current)setLive(a);});setChatText(current=>current===question?'':current);}
    catch(e){setChatError(e instanceof Error?e.message:'질문을 보내지 못했어요. 입력은 남겨 두었습니다.');}
    finally{submitting.current=false;if(alive.current)setPending(false);}
  };
  const answers=(p:Paragraph)=>qa.filter(q=>q.paragraphUuid===p.uuid);
  const answerCard=(q:Qa)=><article className="answer" key={q.id} data-testid={`answer-${q.id}`}>
    <header><span className="question-label">내 질문</span><strong>{q.question}</strong><button aria-expanded={!collapsed[q.id]} onClick={()=>setCollapsed(c=>({...c,[q.id]:!c[q.id]}))}>{collapsed[q.id]?'펼치기':'접기'}</button></header>
    {!collapsed[q.id]&&<><AnswerBody text={q.answer}/><small>AI 설명 · {clock(q.askedAt)} · 기기에 저장됨</small><button className="followup" onClick={()=>q.paragraphUuid?select(q.paragraphUuid,q.momentId):chatInput.current?.focus()}>이 설명에 이어 묻기</button></>}
  </article>;
  const inline=(id:string)=>{
    const p=paragraphs.find(p=>p.uuid===id)!;const d=drafts[id];const saved=answers(p);
    const waiting=d?.sent&&!saved.some(q=>Date.parse(q.askedAt)>=d.sent!);
    return <>{saved.map(answerCard)}{live?.paragraphUuid===id&&!saved.some(q=>q.id===live.savedId)&&<article className="answer live-answer" aria-label="생성 중인 답변"><header><span className="question-label">내 질문</span><strong>{live.question}</strong>{pending&&<button onClick={()=>void bridge.cancel?.().catch(()=>patch(id,{error:'중지를 요청하지 못했어요. 다시 눌러 주세요.'}))}>답변 중지</button>}</header>{live.state==='streaming'?<div className="answer-body">{live.answer}</div>:<AnswerBody text={live.answer}/>}<small role="status">{live.error??(live.state==='done'?'답변 저장 완료':live.state==='preparing'?'선택한 수업 자료를 읽고 있어요…':live.state==='cancelled'?'답변을 중지했어요.':'답변을 쓰고 있어요…')}</small></article>}{selected===id&&<section className="composer" aria-label="선택한 문장에 질문">
      <header><strong>이 문장에서 무엇이 궁금하세요?</strong><button onClick={()=>setSelected(undefined)} aria-label="문장 선택 취소">취소 · Esc</button></header>
      <div className="source-hint">{d?.capturing?'선택 순간의 화면을 잡고 있어요…':d?.capture?'선택한 문장 + 연결된 화면 + 앞 대화를 참고해요. 예전 문장과 현재 화면은 다를 수 있어요.':'선택한 문장을 참고해요 · 화면 없음'}</div>
      <div className="chips">{['쉽게 설명해줘','왜 필요한 거야?','예시로 보여줘','시퀀스 그림으로 설명해줘'].map(q=><button key={q} disabled={pending||!host?.canSend} onClick={()=>void send(p,q)}>{q}</button>)}</div>
      <form onSubmit={e=>{e.preventDefault();void send(p,d?.text??'');}}><label className="sr-only" htmlFor={`q-${id}`}>추가 질문</label><textarea id={`q-${id}`} rows={2} placeholder="내 말로 질문해도 돼요" value={d?.text??''} onChange={e=>patch(id,{text:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send(p,d?.text??'');}}}/><button className="primary" disabled={pending||!host?.canSend||!d?.text.trim()}>{pending?'전송 중…':'질문 보내기'}</button></form>
      {d?.error&&<p className="notice" role="alert">{d.error}</p>}
      {waiting&&!bridge.local&&<p className="notice" role="status">질문을 AI 대화로 보냈어요. 답변은 채팅에 나오며, 저장되면 여기에도 표시됩니다. {Date.now()-d.sent!>60000?'오래 기다렸다면 AI 채팅의 승인·오류·중지 상태를 확인해 주세요. 자동으로 재전송하지 않습니다.':''}</p>}
    </section>}</>;
  };
  return <main className="study-workspace" style={{'--transcript-size':`${preferences.transcript}px`,'--answer-size':`${preferences.answer}px`,'--study-height':`${preferences.height}vh`,'--top-fr':`${preferences.height}fr`,'--bottom-fr':`${100-preferences.height}fr`} as React.CSSProperties} onKeyDown={e=>{if(e.key==='Escape'){setSelected(undefined);setNewStudyOpen(false);setStudyMenu(false);setStudyAction(undefined);setTrashOpen(false);}}}>
    <header className="masthead"><div><span className="eyebrow">CLASSMATE</span><h1>{status?.bundleName??'수업을 함께 이해해요'}</h1></div><div className="actions">{host?.canExpand&&<button onClick={()=>void bridge.expand().catch(()=>setError('이 앱에서는 크게 보기를 열지 못했어요.'))}>크게 보기</button>}<button aria-expanded={help} onClick={()=>setHelp(!help)}>사용 방법</button></div></header>
    {bridge.newStudy&&<nav className="study-navigation" aria-label="세션 기록"><label><span className="sr-only">세션 선택</span><select aria-label="세션 선택" value={status?.studyId??''} disabled={pending||switching} onChange={e=>void changeStudy(undefined,e.target.value)}>{!status?.studies?.length&&<option value="">기록 불러오는 중</option>}{status?.studies?.filter(s=>!s.deletedAt).map(s=><option key={s.id} value={s.id}>{s.name}{s.id===status.activeStudyId?' · 수집 중':''}</option>)}</select></label><button disabled={pending||switching} onClick={()=>{setNewStudyOpen(!newStudyOpen);setStudyAction(undefined);setStudyMenu(false);}}>＋ 새 세션</button>{bridge.editStudy&&<div className="study-menu"><button aria-label="세션 관리" aria-expanded={studyMenu} disabled={pending||switching} onClick={()=>setStudyMenu(!studyMenu)}>⋯</button>{studyMenu&&<div className="study-menu-items"><button onClick={()=>{setStudyName(status?.bundleName??'');setStudyAction('rename');setStudyMenu(false);setNewStudyOpen(false);}}>이름 변경</button><button className="danger-text" onClick={()=>{setStudyAction('trash');setStudyMenu(false);setNewStudyOpen(false);}}>삭제</button><button onClick={()=>{setTrashOpen(!trashOpen);setStudyMenu(false);}}>휴지통</button></div>}</div>}{status?.studyId!==status?.activeStudyId&&<span className="collecting-target">수집 중: {status?.studies?.find(s=>s.id===status.activeStudyId)?.name??'다른 세션'}<button disabled={pending||switching} onClick={()=>void changeStudy(undefined,status?.activeStudyId)}>해당 세션 열기</button></span>}</nav>}
    {studyAction==='rename'&&<form className="new-study" aria-label="세션 이름 변경" onSubmit={e=>{e.preventDefault();void changeStudy(studyName,status?.studyId,'rename');}}><label htmlFor="rename-study">세션 이름</label><input id="rename-study" autoFocus maxLength={100} value={studyName} onChange={e=>setStudyName(e.target.value)}/><div><button type="button" onClick={()=>setStudyAction(undefined)}>취소</button><button className="primary" disabled={switching||!studyName.trim()}>변경 저장</button></div></form>}
    {studyAction==='trash'&&<section className="study-confirm" role="region" aria-label="세션 삭제 확인"><strong>‘{status?.bundleName}’을 삭제할까요?</strong><p>휴지통으로 이동하며 전사와 대화는 복원할 수 있습니다. Tiro 원본은 삭제하지 않습니다.{status?.studyId===status?.activeStudyId?' 현재 수집 중인 세션이므로 이후 전사를 담을 빈 세션이 만들어집니다.':''}</p><div><button onClick={()=>setStudyAction(undefined)}>취소</button><button className="danger-text" disabled={switching} onClick={()=>void changeStudy(undefined,status?.studyId,'trash')}>휴지통으로 이동</button></div></section>}
    {trashOpen&&<section className="study-trash" aria-label="휴지통"><header><h2>휴지통</h2><button aria-label="휴지통 닫기" onClick={()=>setTrashOpen(false)}>닫기</button></header>{status?.studies?.some(s=>s.deletedAt)?status.studies.filter(s=>s.deletedAt).map(s=><div key={s.id}><span>{s.name}</span><button disabled={pending||switching} onClick={()=>void changeStudy(undefined,s.id,'restore')}>복원</button></div>):<p>삭제한 세션이 없습니다.</p>}</section>}
    {actionNotice&&<div className="action-notice" role="status">{actionNotice}<button aria-label="알림 닫기" onClick={()=>setActionNotice('')}>×</button></div>}
    {newStudyOpen&&<form className="new-study" aria-label="새 세션 만들기" onSubmit={e=>{e.preventDefault();void changeStudy(studyName);}}><label htmlFor="study-name">어떤 세션을 시작할까요?</label><input id="study-name" autoFocus maxLength={100} placeholder="예: Spring 04~06" value={studyName} onChange={e=>setStudyName(e.target.value)}/><p>기존 기록은 그대로 둡니다. 시작한 뒤 새로 도착하는 문장부터 이 세션에 모아요. Tiro 녹음은 별도로 켜 주세요.</p><div><button type="button" onClick={()=>setNewStudyOpen(false)}>취소</button><button className="primary" disabled={switching||!studyName.trim()}>세션 시작</button></div></form>}
    <div className="connection" role="status"><span>{status?.status.daemon==='stale'?'자료 수집 연결이 끊겼어요':status?.status.tiroState==='connected'?(status.status.noteRecording?'● 전사 연결됨':'저장된 녹음'):'전사 연결 확인 중'}</span><button aria-expanded={settings} onClick={()=>setSettings(!settings)}>화면 설정</button><span>대화 상대 · {host?.name??'연결 중'}</span></div>
    {settings&&<section className="display-settings" aria-label="화면 설정"><strong>화면 설정</strong>{([['transcript','전사 글씨',14,28],['answer','답변 글씨',14,28],['height','전사 영역 비율',30,90]] as const).map(([key,label,min,max])=><label key={key}>{label}<input aria-label={label} type="range" min={min} max={max} value={preferences[key]} onChange={e=>updatePreferences({...preferences,[key]:Number(e.target.value)})}/><output>{preferences[key]}{key==='height'?'%':'px'}</output></label>)}<button onClick={()=>updatePreferences({...defaults})}>기본값 복원</button><p>자동으로 이 PC에 저장됩니다. 영역 사이 구분선을 드래그해도 비율을 바꿀 수 있습니다.</p></section>}
    {help&&<aside className="help"><strong>녹음 켜기 → 문장 누르기 → 바로 질문</strong><p>Tiro에서 녹음을 시작하고 영상을 보세요. 아래 문장을 누르면 그 자리에 질문창이 열립니다. Alt+S나 폴더 선택은 필요 없어요. {bridge.local?'답변도 그 문장 아래에 바로 쌓입니다. 옆 채팅으로 이동할 필요가 없어요.':'저장된 답은 문장 아래에도 보입니다.'}</p><p>로컬 보관 / 선택한 AI 제공자로 전송될 수 있음 / Corthex 서버 기본 전송 없음</p><p>‘취소’는 문장 선택을 해제합니다. {bridge.local?'생성 중인 답변의 ‘답변 중지’를 누르면 생성을 멈춥니다.':'이미 보낸 답변은 현재 AI 앱에서 중지하세요.'} 전사는 Tiro가 문단을 확정한 뒤 도착하므로 말소리와 동시에 한 글자씩 나타나는 방식은 아닙니다.</p></aside>}
    {error&&<p className="notice" role="alert">{error}</p>}
    {host&&!host.canSend&&<p className="notice" role="alert">{bridge.local?'GPT 연결을 준비하지 못했어요. Codex의 ChatGPT 로그인과 사용 한도를 확인한 뒤 Classmate를 다시 열어 주세요.':'이 AI 앱은 패널에서 질문 보내기를 지원하지 않아요. 현재 AI 채팅에 직접 질문하거나 MCP Apps 메시지 전송을 지원하는 앱에서 여세요.'}</p>}
    <div className="section-label"><h2>수업 전사</h2><span>문장을 선택해 질문하기</span></div>
    <div className="reading-panes" ref={panes}>
    <div className="transcript-scroll" ref={viewport} tabIndex={0} aria-label="수업 전사와 문장별 대화" onScroll={()=>{const e=viewport.current!;const yes=e.scrollHeight-e.clientHeight-e.scrollTop<45&&!selected;follow.current=yes;setFollowing(yes);}}>
      {!paragraphs.length?<section className="empty"><h2>전사 대기 중</h2><p>Tiro에서 녹음을 시작하면 전사가 표시됩니다.</p><p>휴대폰에서 녹음해도 연결된 Tiro 계정으로 불러올 수 있습니다.</p></section>:<TranscriptFlow lines={paragraphs.map(p=>({id:p.uuid,time:clock(p.timeFrom),segments:[{text:p.text}]}))} onSentence={select} renderAfter={inline} showTimes/>}
    </div>
    <div className="transcript-status"><span>{status?.status.daemon==='stale'?'연결 확인 필요':status?.status.noteRecording?'● 실시간':'녹음 기록'}{!following?' · 자동 스크롤 일시정지':''}</span>{!following&&newWords>0&&<button onClick={()=>{setSelected(undefined);follow.current=true;setFollowing(true);setNewWords(0);viewport.current?.scrollTo({top:viewport.current.scrollHeight});}}>맨 아래로 ↓</button>}<span title="음성 인식 지연 시간이 아니라, Classmate가 자료를 확인한 시각입니다.">{status?.delivery?.lastCheckedAt?`${clock(status.delivery.lastCheckedAt)} 자료 확인`:''}</span></div>
    <div className="pane-divider" role="separator" aria-label="전사와 대화 크기 조절" aria-orientation="horizontal" aria-valuemin={30} aria-valuemax={90} aria-valuenow={preferences.height} tabIndex={0} title="드래그로 크기 조절 · 방향키로 미세 조절 · 두 번 클릭하면 기본 비율" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))resizePanes(e.clientY);}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){e.currentTarget.releasePointerCapture(e.pointerId);updatePreferences(preferencesRef.current);}}} onPointerCancel={()=>updatePreferences(preferencesRef.current)} onDoubleClick={()=>updatePreferences({...preferences,height:defaults.height})} onKeyDown={e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const height=e.key==='Home'?30:e.key==='End'?90:Math.max(30,Math.min(90,preferences.height+(e.key==='ArrowUp'?-2:2)));updatePreferences({...preferences,height});}}}><span/></div>
    <section className="chat-dock" aria-label="자유 대화">
      <header className="chat-heading"><h2>대화</h2><span>수업을 보며 편하게 물어보세요</span></header>
      <div className="chat-history" ref={chatViewport} role="region" aria-label="대화 내용" onScroll={()=>{const e=chatViewport.current!;chatFollowing.current=e.scrollHeight-e.scrollTop-e.clientHeight<50;}}>
        {qa.filter(q=>!q.paragraphUuid).map(answerCard)}
        {!qa.some(q=>!q.paragraphUuid)&&!live?.question&&<p className="chat-empty">“지금 배운 내용을 정리해줘”처럼 질문해 보세요.</p>}
        {live&&!live.paragraphUuid&&!qa.some(q=>q.id===live.savedId)&&<article className="answer live-answer"><header><span className="question-label">내 질문</span><strong>{live.question}</strong></header>{live.state==='streaming'?<div className="answer-body">{live.answer}</div>:<AnswerBody text={live.answer}/>}<small role="status">{live.error??(live.state==='preparing'?'답변을 준비하고 있어요…':live.state==='done'?'저장됨':'답변을 쓰고 있어요…')}</small></article>}
      </div>
      <form className="chat-input" onSubmit={e=>{e.preventDefault();chatFollowing.current=true;void sendChat();}}><label className="sr-only" htmlFor="free-question">대화 질문</label><textarea ref={chatInput} id="free-question" rows={2} maxLength={8000} placeholder="궁금한 걸 물어보세요" value={chatText} onChange={e=>setChatText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();chatFollowing.current=true;void sendChat();}}}/>{pending?<button type="button" aria-label="생성 중지" onClick={()=>void bridge.cancel?.().catch(()=>setChatError('중지를 요청하지 못했어요.'))}>■ 중지</button>:<button className="primary" aria-label="대화 보내기" disabled={!host?.canSend||!chatText.trim()}>↑</button>}</form>
      {chatError&&<p role="alert" className="notice">{chatError}</p>}
    </section>
    </div>
    <div className="preferences-status" role="status">{settingsNotice}</div>
  </main>;
}
