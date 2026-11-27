import React, {useEffect,useRef,useState} from 'react';
import {TranscriptFlow} from '@classmate/ui-classmate';
import {selectedTranscript,paragraphRange} from './selection';
import {AnswerBody} from './AnswerBody';
import {CardsPanel} from './ReviewPanel';
import {ReplayInput,type ReplayFile} from './ReplayInput';
import {SentMaterial} from './SentMaterial';
import {questionIntents,type Cards,type Intent} from './localLearning';
import {preparePastedImage} from './pastedImage';
import {MAX_PHOTOS,PhotoAttachments,type DraftPhoto} from './PhotoAttachments';
import {ResizableComposer} from './ResizableComposer';
import {AccountConnections} from './AccountConnections';
import {transcriptStatus} from './transcriptStatus';
import {defaults,readPreferences,savePreferences,normalizePreferences,type Preferences} from './preferences';
import {questionMessage,type Bridge,type Capture,type Host,type Paragraph,type Qa,type Snapshot,type LiveAnswer,type SelectionPart,type WebMode} from './bridge';

const clock=(s:string)=>new Date(s).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
const preciseClock=(s:string)=>new Date(s).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
type Draft={text:string; photos?:DraftPhoto[]; excludeScreen?:boolean; selection?:SelectionPart[]; followupId?:number; capture?:Capture; capturing:boolean; sent?:number; error?:string};
const noPhotos:DraftPhoto[]=[];
const storedPhotoIds=(answer?:Qa)=>answer?.pastedImageIds??(answer?.pastedImageId?[answer.pastedImageId]:[]);
function answerStatus(job:LiveAnswer){
  if(job.error)return job.error;
  if(job.state==='queued')return `답변 대기 중${job.queuePosition?` · ${job.queuePosition}번째`:''}`;
  if(job.state==='done')return '답변 저장 완료';
  if(job.state==='cancelled')return '취소됨';
  if(job.searchState==='searching'){
    if(job.webAction==='fetch')return '웹페이지 읽는 중…';
    if(job.webAction==='web')return '공개 웹 자료 확인 중…';
    return '공개 웹 자료 검색 중…';
  }
  return '답변 작성 중…';
}
export function StudyPanel({bridge,pollMs=3000}:{bridge:Bridge;pollMs?:number}) {
  const [host,setHost]=useState<Host>();
  const [accountsOpen,setAccountsOpen]=useState(false);
  const [accountBusy,setAccountBusy]=useState<string>();
  const [accountMessage,setAccountMessage]=useState('');
  const accountAction=async(id:string,action:'login'|'check'|'cancel')=>{
    const method=action==='login'?bridge.loginProvider:action==='check'?bridge.checkProvider:bridge.cancelLogin;if(!method)return;
    setAccountBusy(id);setAccountMessage('');
    try{const next=await method(id);if(alive.current){setHost(next);const account=next.providers?.find(p=>p.id===id);setAccountMessage(action==='login'?'공식 로그인 창에서 구독 계정을 선택해 주세요.':action==='cancel'?'로그인 취소를 요청했습니다.':account?.canSend?'구독 연결을 확인했습니다.':'연결되지 않았어요. 연결 버튼으로 구독 로그인을 진행해 주세요.');}}
    catch(error){if(alive.current)setAccountMessage(error instanceof Error?error.message:'연결을 확인하지 못했어요. 다시 시도해 주세요.');}
    finally{if(alive.current)setAccountBusy(undefined);}
  };
  const chooseProvider=(id:string)=>{if(!bridge.chooseProvider)return;setSettingsNotice('대화 상대 변경 중…');void bridge.chooseProvider(id).then(h=>{if(alive.current){setHost(h);setSettingsNotice(h.canSend?`대화 상대 · ${h.name}`:'이 대화 상대는 로그인이 필요해요.');}}).catch(()=>{if(alive.current)setSettingsNotice('대화 상대를 바꾸지 못했어요.');});};
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
  const [chatPhotos,setChatPhotos]=useState<DraftPhoto[]>(noPhotos);
  const [preparingPhotos,setPreparingPhotos]=useState(false);
  const photoPreparation=useRef<object|null>(null);
  const updatePhotos=(id:string|undefined,update:(photos:DraftPhoto[])=>DraftPhoto[])=>{
    if(id)setDrafts(old=>{
      const draft=old[id]??{text:'',capturing:false};
      return {...old,[id]:{...draft,photos:update(draft.photos??noPhotos)}};
    });
    else setChatPhotos(update);
  };
  const addPhotos=async(files:File[],id?:string)=>{
    if(!files.length||!bridge.uploadImage||photoPreparation.current||submitting.current||switching)return;
    const report=(message:string)=>id?patch(id,{error:message||undefined}):setChatError(message);
    const current=id?drafts[id]?.photos??noPhotos:chatPhotos;
    const available=MAX_PHOTOS-current.length;
    if(available<=0){report(`사진은 한 질문에 ${MAX_PHOTOS}장까지 첨부할 수 있어요.`);return;}
    const batch={};
    photoPreparation.current=batch;
    setPreparingPhotos(true);
    report('');
    const added:DraftPhoto[]=[];
    let imageError='';
    try{
      for(const file of files.slice(0,available)){
        try{added.push({id:crypto.randomUUID(),name:file.name,preview:await preparePastedImage(file)});}
        catch(error){imageError=error instanceof Error?error.message:'사진을 읽지 못했어요.';}
        if(!alive.current||photoPreparation.current!==batch)return;
      }
      if(added.length)updatePhotos(id,photos=>[...photos,...added].slice(0,MAX_PHOTOS));
      const limit=files.length>available?`사진은 한 질문에 ${MAX_PHOTOS}장까지 첨부할 수 있어요.`:'';
      report([imageError,limit].filter(Boolean).join(' '));
    }finally{
      if(photoPreparation.current===batch){photoPreparation.current=null;if(alive.current)setPreparingPhotos(false);}
    }
  };
  const pastePhotos=(event:React.ClipboardEvent<HTMLTextAreaElement>,id?:string)=>{
    if(!bridge.uploadImage)return;
    const fromItems=Array.from(event.clipboardData.items).flatMap(item=>{
      const file=item.kind==='file'&&item.type.startsWith('image/')?item.getAsFile():null;
      return file?[file]:[];
    });
    const files=fromItems.length?fromItems:Array.from(event.clipboardData.files).filter(file=>file.type.startsWith('image/'));
    if(!files.length)return;
    event.preventDefault();
    void addPhotos(files,id);
  };
  const uploadPhotos=async(photos:DraftPhoto[],uuid?:string)=>{
    const ids:string[]=[];
    for(const photo of photos){
      if(!photo.preview){ids.push(photo.id);continue;}
      const saved=await bridge.uploadImage?.(photo.preview,uuid);
      if(!saved?.screen_id)throw new Error('첨부 사진을 전송하지 못했어요. 다시 시도해 주세요.');
      ids.push(saved.screen_id);
    }
    return ids;
  };
  const chatRevision=useRef(0);
  const draftRevisions=useRef(new Map<string,number>());
  const [searchMode,setSearchMode]=useState<WebMode>('auto');
  const webOptions=()=> <label className="web-options">웹 도구<select aria-label="웹 도구" value={searchMode} onChange={event=>setSearchMode(event.target.value as WebMode)}>
    <option value="auto">필요할 때 사용</option>
    <option value="required">웹 검색해서 답변</option>
    <option value="fetch">링크 본문 읽기</option>
    <option value="off">사용 안 함</option>
  </select></label>;
  const attachments=(photos:DraftPhoto[],id?:string)=>bridge.uploadImage&&<PhotoAttachments photos={photos} disabled={sending||switching} preparing={preparingPhotos} onAdd={files=>void addPhotos(files,id)} onRemove={photoId=>updatePhotos(id,items=>items.filter(photo=>photo.id!==photoId))}>{webOptions()}</PhotoAttachments>;
  const [includeScreen,setIncludeScreen]=useState(true);
  const [pairInfo,setPairInfo]=useState<{code:string;extensionPath:string}>();
  const [chatScreen,setChatScreen]=useState<Capture>();
  const [chatError,setChatError]=useState('');
  const [newStudyOpen,setNewStudyOpen]=useState(false);
  const [studyName,setStudyName]=useState('');
  const [sourceUrl,setSourceUrl]=useState('');
  const [replayMode,setReplayMode]=useState(false);
  const [replayFile,setReplayFile]=useState<ReplayFile>();
  const [replaySpeed,setReplaySpeed]=useState(1);
  const [cardsPage,setCardsPage]=useState<Cards>();
  const [learningBusy,setLearningBusy]=useState(false);
  const [learningError,setLearningError]=useState('');
  const [markBusy,setMarkBusy]=useState<string>();
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
  useEffect(()=>{if(!panes.current||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(([entry])=>setPaneSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(panes.current);return()=>observer.disconnect();},[cardsPage,status?.review?.hidden]);
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
  useEffect(()=>{
    if(!bridge.accountStatus)return;let stopped=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{try{const next=await bridge.accountStatus!();if(!stopped)setHost(next);}catch{/* A transient check never removes the lesson or draft. */}finally{if(!stopped)timer=setTimeout(poll,2000);}};
    timer=setTimeout(poll,2000);return()=>{stopped=true;clearTimeout(timer);};
  },[bridge]);
  const captures=useRef(new Map<string,Promise<Capture>>());
  const patch=(id:string,p:Partial<Draft>)=>setDrafts(ds=>({...ds,[id]:{...(ds[id]??{text:'',capturing:false}),...p}}));
  useEffect(()=>{
    alive.current=true; let timer:ReturnType<typeof setTimeout>;
    const refresh=async()=>{
      try {
        const s=await bridge.refresh(); if(!alive.current)return;
        if(studyId.current&&s.studyId!==studyId.current)return;
        studyId.current=s.studyId;setStatus(s);setError('');if(s.jobs)setLives(s.jobs);
        if(s.review?.hidden){setParagraphs([]);setQa([]);return;}
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
    try{const s=action?await bridge.editStudy!(id!,action,name):name!==undefined?(replayMode&&replayFile?await bridge.newReplay!(name,replayFile.items,replaySpeed):await bridge.newStudy!(name,sourceUrl)):await bridge.chooseStudy!(id!);const same=studyId.current===s.studyId;studyId.current=s.studyId;setStatus(s);setParagraphs(s.paragraphs);setQa(s.recentQa);if(!same){freezeTranscript.current=false;setRangeCandidate([]);setRangeMode(false);setRangeStart(undefined);chatRevision.current++;setSelected(undefined);setDrafts({});setLives([]);setLiveCollapsed({});setChatText('');setChatPhotos(noPhotos);photoPreparation.current=null;setPreparingPhotos(false);setChatError('');setCollapsed({});captures.current.clear();follow.current=true;setFollowing(true);setNewWords(0);}setNewStudyOpen(false);setSourceOpen(false);setSourceUrl('');setReplayMode(false);setReplayFile(undefined);setReplaySpeed(1);setStudyMenu(false);setStudyAction(undefined);setStudyName('');setError('');previousParagraphs.current=s.paragraphs;setActionNotice(action==='trash'?'휴지통으로 이동했습니다. 세션 메뉴에서 복원할 수 있습니다.':action==='restore'?'세션을 복원했습니다.':action==='rename'?'이름을 변경했습니다.':'');}
    catch(e){setError(e instanceof Error?e.message:'세션을 열지 못했어요. 다시 시도해 주세요.');}
    finally{setSwitching(false);}
  };
  const connectRecording=async()=>{
    if(!status?.studyId||!bridge.connectSource||pending||switching)return;
    setSwitching(true);
    try{const s=await bridge.connectSource(status.studyId,sourceUrl.trim()||undefined);studyId.current=s.studyId;setStatus(s);setSourceOpen(false);setSourceUrl('');setError('');}
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
    if(selected===id&&!selection&&followupId===undefined){setSelected(undefined);freezeTranscript.current=false;return;}
    setSelected(id);freezeTranscript.current=true;follow.current=false;setFollowing(false);
    const previous=followupId===undefined?undefined:qa.find(q=>q.id===followupId);
    let photos=drafts[id]?.photos;
    if(previous){
      const localPhotos=photos?.filter(photo=>photo.preview)??noPhotos;
      const inherited=storedPhotoIds(previous).slice(0,MAX_PHOTOS-localPhotos.length).map(id=>({id}));
      photos=[...inherited,...localPhotos];
    }
    let capture:Promise<Capture>|undefined;
    if(previous){
      if(previous.screenId||previous.momentId)capture=Promise.resolve({
        screen_id:previous.screenId,moment_id:previous.momentId,
        captured_at:previous.screen?.captured_at??previous.askedAt,title:previous.screen?.title,
      });
    }else if(reuseMoment){
      capture=Promise.resolve({moment_id:reuseMoment,captured_at:'기존 답변의 수업 화면'});
    }else capture=bridge.capture(id);
    patch(id,{capture:undefined,capturing:!!capture,error:undefined,sent:undefined,selection,followupId,excludeScreen:false,photos});
    if(!capture){captures.current.delete(id);return;}
    captures.current.set(id,capture);
    capture.then(c=>{if(alive.current&&captures.current.get(id)===capture)patch(id,{capture:c,capturing:false});}).catch(()=>{if(alive.current&&captures.current.get(id)===capture)patch(id,{capture:undefined,capturing:false,error:'화면을 잡지 못했어요. 전사만으로 질문할 수 있어요.'});});
  };
  const send=async(p:Paragraph,question:string,intent?:Intent)=>{
    const draft=drafts[p.uuid];
    const photos=draft?.photos??noPhotos;
    if(photoPreparation.current||submitting.current||switching||!host?.canSend||(!question.trim()&&!photos.length))return;
    question=question.trim()||'첨부한 사진을 설명해 주세요.';
    submitting.current=true;setPending(true);patch(p.uuid,{text:question,error:undefined});
    const revision=draftRevisions.current.get(p.uuid)??0;let accepted=false;
    const clear=()=>{
      if(accepted)return;
      accepted=true;
      if(bridge.local){submitting.current=false;setPending(false);}
      updatePhotos(p.uuid,current=>current===photos?noPhotos:current);
      if((draftRevisions.current.get(p.uuid)??0)===revision)patch(p.uuid,{sent:Date.now(),text:''});
    };
    try {
      let cap=draft?.capture;
      const photoIds=photos.length?await uploadPhotos(photos,p.uuid):[];
      try {cap=(await captures.current.get(p.uuid))??cap;} catch {/* visible transcript-only fallback */}
      await bridge.send(questionMessage(p,question,cap,draft?.selection,{search_mode:searchMode,followup_id:draft?.followupId,pasted_image_ids:photoIds,exclude_screen:!!draft?.excludeScreen,intent}),a=>{if(alive.current)setLive(a);},clear);
      clear();
    } catch(e) {patch(p.uuid,{error:bridge.local&&e instanceof Error?e.message:'질문을 전송하지 못했어요. 입력은 남겨 두었습니다. 연결 상태를 확인한 뒤 다시 눌러 주세요.'});}
    finally{if(!accepted||!bridge.local){submitting.current=false;if(alive.current)setPending(false);}}
  };
  const sendChat=async()=>{
    if(photoPreparation.current||submitting.current||switching||!host?.canSend||(!chatText.trim()&&!chatPhotos.length))return;
    submitting.current=true;setPending(true);setChatError('');
    const photos=chatPhotos;
    const question=chatText.trim()||'첨부한 사진을 설명해 주세요.';
    const revision=chatRevision.current;let accepted=false;
    const clear=()=>{
      if(accepted)return;
      accepted=true;
      if(bridge.local){submitting.current=false;setPending(false);}
      setChatPhotos(current=>current===photos?noPhotos:current);
      if(chatRevision.current===revision)setChatText('');
    };
    try{
      let screen:Capture|undefined;
      if(includeScreen&&bridge.local&&status?.screen?.connected){
        screen=await bridge.capture().catch(()=>undefined);setChatScreen(screen);
      }
      const photoIds=photos.length?await uploadPhotos(photos):[];
      await bridge.send(questionMessage(undefined,question,screen,undefined,{search_mode:searchMode,pasted_image_ids:photoIds,exclude_screen:!includeScreen}),a=>{if(alive.current)setLive(a);},clear);
      clear();
    }
    catch(e){setChatError(e instanceof Error?e.message:'질문을 보내지 못했어요. 입력은 남겨 두었습니다.');}
    finally{if(!accepted||!bridge.local){submitting.current=false;if(alive.current)setPending(false);}}
  };
  const learningAction=async(action:()=>Promise<void>)=>{
    setLearningBusy(true);setLearningError('');
    try{await action();}catch(error){setLearningError(error instanceof Error?error.message:'다시 시도해 주세요.');}
    finally{setLearningBusy(false);}
  };
  const openCards=()=>void learningAction(async()=>{if(bridge.cards){const cards=await bridge.cards('open');setCardsPage(cards);}});
  const leaveLearning=()=>{
    setCardsPage(undefined);freezeTranscript.current=false;
    void learningAction(async()=>{const next=await bridge.refresh();if(next.studyId===studyId.current){setStatus(next);setParagraphs(next.paragraphs);setQa(next.recentQa);}});
  };
  const toggleMark=(id:string)=>{
    if(!status?.studyId||!bridge.toggleMark||markBusy)return;
    const study=status.studyId;
    const marked=!status.marks?.includes(id);
    setMarkBusy(id);setLearningError('');
    void bridge.toggleMark(study,id,marked).then(()=>{
      setStatus(old=>old?.studyId===study?{...old,marks:marked?[...(old.marks??[]).filter(x=>x!==id),id]:(old.marks??[]).filter(x=>x!==id)}:old);
    }).catch(error=>setLearningError(error instanceof Error?error.message:'표시를 저장하지 못했어요.')).finally(()=>setMarkBusy(undefined));
  };
  const answers=(p:Paragraph)=>qa.filter(q=>q.paragraphUuid===p.uuid);
  const foldSaved=(id:number)=>{setCollapsed(c=>({...c,[id]:true}));requestAnimationFrame(()=>document.querySelector(`[data-testid="answer-${id}"]`)?.scrollIntoView({block:"nearest"}));};
  const liveCard=(job:LiveAnswer)=><article className="answer live-answer" key={job.id} aria-label="생성 중인 답변"><header><span className="question-label">내 질문{job.photoCount?` · 사진 ${job.photoCount}장`:''}</span><strong>{job.question}</strong><button aria-expanded={!liveCollapsed[job.id]} onClick={()=>toggleLive(job.id)}>{liveCollapsed[job.id]?"펼치기":"접기"}</button>{["queued","preparing","streaming"].includes(job.state)&&<button onClick={()=>void bridge.cancel?.(job.id).catch(()=>setChatError("중지를 요청하지 못했어요."))}>{job.state==="queued"?"대기 취소":"답변 중지"}</button>}</header><small role="status">{answerStatus(job)}{job.providerLabel&&!job.error?` · ${job.providerLabel}`:""}</small>{!liveCollapsed[job.id]&&<><AnswerBody text={job.answer} streaming={job.state==="streaming"}/><footer className="answer-footer"><button onClick={()=>toggleLive(job.id)}>접기</button></footer></>}</article>;
  const answerCard=(q:Qa)=><article className="answer" key={q.id} data-testid={`answer-${q.id}`}>
    <header><span className="question-label">내 질문{storedPhotoIds(q).length?` · 사진 ${storedPhotoIds(q).length}장`:''}</span><strong>{q.question}</strong><button aria-expanded={!(collapsed[q.id]??liveCollapsed[lives.find(j=>j.savedId===q.id)?.id??''])} onClick={()=>setCollapsed(c=>({...c,[q.id]:!(c[q.id]??liveCollapsed[lives.find(j=>j.savedId===q.id)?.id??''])}))}>{(collapsed[q.id]??liveCollapsed[lives.find(j=>j.savedId===q.id)?.id??''])?'펼치기':'접기'}</button></header>
    {!(collapsed[q.id]??liveCollapsed[lives.find(j=>j.savedId===q.id)?.id??''])&&<>{q.selection&&<details className="selected-evidence"><summary>선택한 내용 · {q.selection.length}개 문단</summary>{q.selection.map(p=><p key={p.uuid}>{p.text}</p>)}</details>}<AnswerBody text={q.answer}/>{bridge.sentMaterial&&status?.studyId&&q.references&&<SentMaterial request={bridge.sentMaterial} studyId={status.studyId} answerId={q.id}/>}<small>AI 설명 · {clock(q.askedAt)} · 기기에 저장됨</small><footer className="answer-footer"><button className="followup" onClick={()=>q.paragraphUuid?select(q.paragraphUuid,q.momentId,q.selection,q.id):chatInput.current?.focus()}>이 설명에 이어 묻기</button><button onClick={()=>foldSaved(q.id)}>접기</button></footer></>}
  </article>;
  const inline=(id:string)=>{
    const p=paragraphs.find(p=>p.uuid===id)!;const d=drafts[id];const saved=answers(p);
    const waiting=d?.sent&&!saved.some(q=>Date.parse(q.askedAt)>=d.sent!);
    const marked=status?.marks?.includes(id)??false;
    const mark=bridge.toggleMark&&<div className="mark-row"><button aria-pressed={marked} aria-label={marked?'문단 ? 표시 지우기':'문단 ? 표시'} disabled={!!markBusy}
      onMouseDown={event=>event.preventDefault()} onClick={()=>toggleMark(id)}>?</button></div>;
    if(!saved.length&&!lives.some(j=>j.paragraphUuid===id)&&selected!==id)return mark;
    return <>{mark}{saved.map(answerCard)}{lives.filter(j=>j.paragraphUuid===id&&!saved.some(q=>q.id===j.savedId)).map(liveCard)}{selected===id&&<section className="composer" aria-label="선택한 문장에 질문">
      <header><strong>{d?.selection?`선택한 내용 · ${d.selection.length}개 문단`:"이 문장에서 무엇이 궁금하세요?"}</strong><button onClick={()=>{setSelected(undefined);freezeTranscript.current=false;}} aria-label="문장 선택 취소">취소 · Esc</button></header>
      {d?.selection&&<details className="selected-evidence"><summary>선택한 원문 확인</summary>{d.selection.map(p=><p key={p.uuid}>{p.text}</p>)}</details>}
      {d?.capture?.preview&&<details className="selected-evidence"><summary>첨부 화면 · {clock(d.capture.captured_at)} · {d.capture.title}</summary><img style={{maxWidth:'100%'}} src={d.capture.preview} alt="이번 질문에 첨부할 수업 화면"/><button onClick={()=>{patch(id,{capture:undefined,excludeScreen:true});captures.current.delete(id);}}>화면 제외</button></details>}
      {bridge.local&&d?.followupId!==undefined&&d.capture&&!d.capture.preview&&<div className="composer-tools"><span>이전 답변의 수업 화면</span><button onClick={()=>{patch(id,{capture:undefined,excludeScreen:true});captures.current.delete(id);}}>화면 제외</button></div>}
      <div className="source-hint">{d?.capturing?'선택 순간의 화면을 잡고 있어요…':d?.capture?'선택한 문장 + 연결된 화면 + 앞 대화를 참고해요. 예전 문장과 현재 화면은 다를 수 있어요.':'선택한 문장을 참고해요 · 화면 없음'}</div>
      <div className="chips">{bridge.local&&bridge.sentMaterial?Object.entries(questionIntents).map(([intent,{label,text}])=><button key={intent} disabled={sending||preparingPhotos||!host?.canSend}
        onClick={()=>void send(p,text,intent as Intent)}>{label}</button>):['쉽게 설명해줘','왜 필요한 거야?','예시로 보여줘','시퀀스 그림으로 설명해줘'].map(q=><button key={q} disabled={(!bridge.local&&pending)||sending||preparingPhotos||!host?.canSend} onClick={()=>void send(p,q)}>{q}</button>)}</div>
      {attachments(d?.photos??noPhotos,id)}
      <form onSubmit={e=>{e.preventDefault();void send(p,d?.text??'');}}><label className="sr-only" htmlFor={`q-${id}`}>추가 질문</label><textarea id={`q-${id}`} onPaste={e=>pastePhotos(e,id)} rows={2} placeholder="내 말로 질문해도 돼요" value={d?.text??''} onChange={e=>{draftRevisions.current.set(id,(draftRevisions.current.get(id)??0)+1);patch(id,{text:e.target.value});}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send(p,d?.text??'');}}}/><button className="primary" disabled={(!bridge.local&&pending)||sending||!host?.canSend||preparingPhotos||(!d?.text.trim()&&!d?.photos?.length)}>{sending?'전송 중…':pending?'대기열에 추가':'질문 보내기'}</button></form>
      {d?.error&&<p className="notice" role="alert">{d.error}</p>}
      {waiting&&!bridge.local&&<p className="notice" role="status">질문을 AI 대화로 보냈어요. 답변은 채팅에 나오며, 저장되면 여기에도 표시됩니다. {Date.now()-d.sent!>60000?'오래 기다렸다면 AI 채팅의 승인·오류·중지 상태를 확인해 주세요. 자동으로 재전송하지 않습니다.':''}</p>}
    </section>}</>;
  };
  if(cardsPage&&bridge.cards)return <main className="learning-workspace"><CardsPanel request={bridge.cards} initial={cardsPage} onClose={leaveLearning}/></main>;
  if(status?.review?.hidden)return <main className="learning-workspace"><section className="learning-panel">
    <h1>{status.bundleName}</h1><p>복습 중에는 전사와 답변을 가려요.</p>
    {learningError&&<p role="alert">{learningError}</p>}
  </section></main>;
  return <main className={`study-workspace layout-${preferences.layout??"rows"} fold-${preferences.fold??"none"}`} style={{'--left-fr':`${visibleRatio(preferences.width??45,true)}fr`,'--right-fr':`${100-visibleRatio(preferences.width??45,true)}fr`,'--transcript-size':`${preferences.transcript}px`,'--answer-size':`${preferences.answer}px`,'--study-height':`${preferences.height}vh`,'--top-fr':`${visibleRatio(preferences.height,false)}fr`,'--bottom-fr':`${100-visibleRatio(preferences.height,false)}fr`} as React.CSSProperties} onKeyDown={e=>{if(e.key==='Escape'){setSelected(undefined);freezeTranscript.current=false;setRangeCandidate([]);setRangeMode(false);setRangeStart(undefined);setNewStudyOpen(false);setStudyMenu(false);setStudyAction(undefined);setTrashOpen(false);}}}>
    <header className="masthead"><div><span className="eyebrow">CLASSMATE</span><h1>{status?.bundleName??'수업을 함께 이해해요'}</h1></div><div className="actions">{host?.canExpand&&<button onClick={()=>void bridge.expand().catch(()=>setError('이 앱에서는 크게 보기를 열지 못했어요.'))}>크게 보기</button>}<button aria-expanded={help} onClick={()=>setHelp(!help)}>사용 방법</button></div></header>
    {bridge.newStudy&&<nav className="study-navigation" aria-label="세션 기록"><label><span className="sr-only">세션 선택</span><select aria-label="세션 선택" value={status?.studyId??''} disabled={pending||switching} onChange={e=>void changeStudy(undefined,e.target.value)}>{!status?.studies?.length&&<option value="">기록 불러오는 중</option>}{status?.studies?.filter(s=>!s.deletedAt).map(s=><option key={s.id} value={s.id}>{s.name}{s.id===status.activeStudyId?' · 수집 중':''}</option>)}</select></label><button disabled={pending||switching} onClick={()=>{setNewStudyOpen(!newStudyOpen);setStudyAction(undefined);setStudyMenu(false);}}>＋ 새 세션</button>{bridge.editStudy&&<div className="study-menu"><button aria-label="세션 관리" aria-expanded={studyMenu} disabled={pending||switching} onClick={()=>setStudyMenu(!studyMenu)}>⋯</button>{studyMenu&&<div className="study-menu-items"><button onClick={()=>{setStudyName(status?.bundleName??'');setStudyAction('rename');setStudyMenu(false);setNewStudyOpen(false);}}>이름 변경</button><button className="danger-text" onClick={()=>{setStudyAction('trash');setStudyMenu(false);setNewStudyOpen(false);}}>삭제</button><button onClick={()=>{setTrashOpen(!trashOpen);setStudyMenu(false);}}>휴지통</button></div>}</div>}{status?.studyId!==status?.activeStudyId&&<span className="collecting-target">수집 중: {status?.studies?.find(s=>s.id===status.activeStudyId)?.name??'다른 세션'}<button disabled={pending||switching} onClick={()=>void changeStudy(undefined,status?.activeStudyId)}>해당 세션 열기</button></span>}</nav>}
    {status?.studyId&&(!!status.review?.cards||!!status.recording?.replay||!!learningError)&&<div className="learning-tools">
      {!!status.review?.cards&&<button disabled={learningBusy} className="primary" onClick={openCards}>오늘의 카드 {status.review.cards}장</button>}
      {status.recording?.replay&&<><span>{status.recording.replay.played}/{status.recording.replay.total}문단 · {status.recording.replay.speed}배</span>
        {status.recording.state!=='replay_done'&&<button disabled={learningBusy} onClick={()=>void learningAction(()=>bridge.controlReplay!(status.studyId!,status.recording?.state==='replay_playing'?'pause':'play'))}>{status.recording.state==='replay_playing'?'재생 일시정지':'재생 계속'}</button>}</>}
      {learningError&&<p role="alert">{learningError}</p>}
    </div>}
    {studyAction==='rename'&&<form className="new-study" aria-label="세션 이름 변경" onSubmit={e=>{e.preventDefault();void changeStudy(studyName,status?.studyId,'rename');}}><label htmlFor="rename-study">세션 이름</label><input id="rename-study" autoFocus maxLength={100} value={studyName} onChange={e=>setStudyName(e.target.value)}/><div><button type="button" onClick={()=>setStudyAction(undefined)}>취소</button><button className="primary" disabled={switching||!studyName.trim()}>변경 저장</button></div></form>}
    {studyAction==='trash'&&<section className="study-confirm" role="region" aria-label="세션 삭제 확인"><strong>‘{status?.bundleName}’을 삭제할까요?</strong><p>휴지통으로 이동하며 전사와 대화는 복원할 수 있습니다. Tiro 원본은 삭제하지 않습니다.{status?.studyId===status?.activeStudyId?' 현재 수집 중인 세션이므로 이후 전사를 담을 빈 세션이 만들어집니다.':''}</p><div><button onClick={()=>setStudyAction(undefined)}>취소</button><button className="danger-text" disabled={switching} onClick={()=>void changeStudy(undefined,status?.studyId,'trash')}>휴지통으로 이동</button></div></section>}
    {trashOpen&&<section className="study-trash" aria-label="휴지통"><header><h2>휴지통</h2><button aria-label="휴지통 닫기" onClick={()=>setTrashOpen(false)}>닫기</button></header>{status?.studies?.some(s=>s.deletedAt)?status.studies.filter(s=>s.deletedAt).map(s=><div key={s.id}><span>{s.name}</span><button disabled={pending||switching} onClick={()=>void changeStudy(undefined,s.id,'restore')}>복원</button></div>):<p>삭제한 세션이 없습니다.</p>}</section>}
    {actionNotice&&<div className="action-notice" role="status">{actionNotice}<button aria-label="알림 닫기" onClick={()=>setActionNotice('')}>×</button></div>}
    {newStudyOpen&&<form className="new-study" aria-label="새 세션 만들기" onSubmit={e=>{e.preventDefault();void changeStudy(studyName);}}><label htmlFor="study-name">세션 이름</label><input id="study-name" autoFocus maxLength={100} placeholder="예: Spring 04~06" value={studyName} onChange={e=>setStudyName(e.target.value)}/>{bridge.newReplay&&<label>자료<select aria-label="세션 자료" value={replayMode?'replay':'tiro'} onChange={e=>setReplayMode(e.target.value==='replay')}><option value="tiro">Tiro 공유 또는 대화</option><option value="replay">전사 파일 재생</option></select></label>}
      {replayMode?<ReplayInput value={replayFile} speed={replaySpeed} onFile={setReplayFile} onSpeed={setReplaySpeed}/>:<>
        <label htmlFor="new-tiro-url">Tiro 공유 링크</label><input id="new-tiro-url" type="password" maxLength={2048} placeholder="https://tiro.ooo/s/…" autoComplete="off" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}/><p>Tiro 녹음에서 공유 → 링크 복사 후 붙여 넣으세요. 해당 녹음에 보이는 전사와 이후 변경을 이 세션에 저장합니다. 링크 없이 시작하면 대화만 사용할 수 있습니다.</p>
      </>}<div><button type="button" onClick={()=>{setNewStudyOpen(false);setSourceUrl('');}}>취소</button><button className="primary" disabled={switching||!studyName.trim()||replayMode&&!replayFile}>세션 시작</button></div></form>}
    {bridge.connectSource&&!newStudyOpen&&status?.recording?.mode!=='replay'&&(settings||status?.recording?.mode==="none")&&<div className="recording-link"><span>{status?.recording?.title??(status?.recording?.mode==='share'?'Tiro 공유 녹음':status?.recording?.mode==='api'?'기존 API 연결':'연결된 녹음 없음')}</span><button disabled={pending||switching} onClick={()=>{setSourceUrl('');setSourceOpen(!sourceOpen);}}>{status?.recording?.mode==='share'?'녹음 연결 관리':'Tiro 링크 연결'}</button></div>}
    {sourceOpen&&<form className="new-study" aria-label="Tiro 녹음 연결" onSubmit={e=>{e.preventDefault();void connectRecording();}}><label htmlFor="tiro-url">Tiro 공유 링크</label><input id="tiro-url" type="password" autoFocus autoComplete="off" maxLength={2048} value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://tiro.ooo/s/…"/><p>한 세션에 녹음 하나를 연결합니다. 전사가 쌓인 뒤 다른 녹음을 연결하려면 ‘새 세션’으로 시작하세요. 다시 연결하면 이 세션의 수집을 재개합니다. 링크와 기록은 이 PC에만 저장됩니다.</p><div><button type="button" onClick={()=>setSourceOpen(false)}>취소</button>
      {bridge.disconnectSource&&status?.studyId&&status.recording?.mode==='share'&&!paragraphs.length&&<button type="button" disabled={learningBusy||switching} onClick={()=>void learningAction(async()=>{const s=await bridge.disconnectSource!(status.studyId!);setStatus(s);setSourceOpen(false);setSourceUrl('');})}>링크 없이 계속</button>}<button className="primary" disabled={switching||(!sourceUrl.trim()&&status?.recording?.mode!=='share')}>{!sourceUrl.trim()&&status?.recording?.mode==='share'?'저장된 녹음 다시 연결':'녹음 연결'}</button></div></form>}
    <div className="connection" role="status"><span>{transcriptStatus(status)}</span>{bridge.local&&<span>{status?.screen?.connected?'수업 화면 연결됨':'수업 화면 없음'}</span>}<button aria-expanded={settings} onClick={()=>setSettings(!settings)}>화면 설정</button><button aria-pressed={rangeMode} onClick={()=>{setRangeMode(!rangeMode);setRangeStart(undefined);setRangeCandidate([]);window.getSelection()?.removeAllRanges();freezeTranscript.current=!!selected;}}>{rangeMode?"문단 선택 취소":"문단 선택"}</button>{bridge.loginProvider&&<button aria-expanded={accountsOpen||!!host&&!host.canSend} onClick={()=>setAccountsOpen(!accountsOpen)}>AI 연결</button>}<span className="layout-tools"><button aria-pressed={preferences.layout==="columns"} onClick={()=>updatePreferences({...preferences,layout:"columns"})}>좌우</button><button aria-pressed={preferences.layout!=="columns"} onClick={()=>updatePreferences({...preferences,layout:"rows"})}>상하</button></span></div>
    {bridge.loginProvider&&host&&(accountsOpen||!host.canSend)&&<AccountConnections host={host} busy={accountBusy} message={accountMessage} onLogin={id=>void accountAction(id,'login')} onCheck={id=>void accountAction(id,'check')} onCancel={id=>void accountAction(id,'cancel')}/>}
    {settings&&<section className="display-settings" aria-label="화면 설정"><strong>화면 설정</strong>{webOptions()}{host?.providers&&bridge.chooseProvider?<label>대화 상대<select aria-label="대화 상대" value={host.provider} onChange={e=>chooseProvider(e.target.value)}>{host.providers.map(p=><option key={p.id} value={p.id}>{p.label}{p.canSend?"":" · 로그인 필요"}</option>)}</select></label>:<span>대화 상대 · {host?.name??"연결 중"}</span>}<button onClick={()=>setHelp(!help)}>사용 방법</button>{([['transcript','전사 글씨',14,28],['answer','답변 글씨',14,28],['height','상하 전사 비율',5,95]] as const).map(([key,label,min,max])=><label key={key}>{label}<input aria-label={label} type="range" min={min} max={max} value={preferences[key]} onChange={e=>updatePreferences({...preferences,[key]:Number(e.target.value)})}/><output>{preferences[key]}{key==='height'?'%':'px'}</output></label>)}<button onClick={()=>updatePreferences({...defaults})}>기본값 복원</button><p>자동으로 이 PC에 저장됩니다. 영역 사이 구분선을 드래그해도 비율을 바꿀 수 있습니다.</p></section>}
    {settings&&bridge.screenPair&&<section className="screen-settings"><strong>Chrome 수업 화면</strong><p>처음 한 번 아래 폴더를 Chrome 확장 관리의 ‘압축해제된 확장 프로그램 로드’로 등록하세요. 수업 탭에서 Local 확장 아이콘을 눌러 연결 코드를 넣습니다. 다른 개인 탭은 공유하지 않습니다. 공유를 끝낼 때는 Chrome 확장 아이콘에서 ‘연결 해제’를 누르세요.</p><button onClick={()=>void bridge.screenPair!().then(setPairInfo).catch(()=>setSettingsNotice('화면 연결 정보를 읽지 못했습니다.'))}>연결 정보 보기</button>{pairInfo&&<><p>확장 폴더</p><input readOnly aria-label="Local 화면 확장 폴더" value={pairInfo.extensionPath}/><p>연결 코드 · 외부에 공유하지 마세요</p><input readOnly aria-label="Local 화면 연결 코드" value={pairInfo.code}/><button onClick={()=>void navigator.clipboard.writeText(pairInfo.code).then(()=>setSettingsNotice('연결 코드 복사됨')).catch(()=>setSettingsNotice('코드 입력란을 선택해서 복사해 주세요.'))}>연결 코드 복사</button></>}</section>}
    {help&&<aside className="help"><strong>녹음 켜기 → 문장 누르기 → 바로 질문</strong><p>Tiro에서 녹음을 시작하고 영상을 보세요. 아래 문장을 누르면 그 자리에 질문창이 열립니다. Alt+S나 폴더 선택은 필요 없어요. {bridge.local?'답변도 그 문장 아래에 바로 쌓입니다. 옆 채팅으로 이동할 필요가 없어요.':'저장된 답은 문장 아래에도 보입니다.'}</p><p>로컬 보관 / 선택한 AI 제공자로 전송될 수 있음 / Corthex 서버 기본 전송 없음</p><p>‘취소’는 문장 선택을 해제합니다. {bridge.local?'생성 중인 답변의 ‘답변 중지’를 누르면 생성을 멈춥니다.':'이미 보낸 답변은 현재 AI 앱에서 중지하세요.'} 전사는 Tiro가 반환하는 대로 진행 중인 문장도 갱신합니다. 음성을 글로 바꾸는 시간은 별도로 걸릴 수 있습니다.</p></aside>}
    {error&&<p className="notice" role="alert">{error}</p>}
    {host&&!host.canSend&&<p className="notice" role="alert">{bridge.local?bridge.loginProvider?'선택한 AI가 연결되지 않았어요. 위의 ‘AI 구독 연결’에서 로그인하거나 연결을 확인해 주세요. 입력한 질문과 기존 기록은 그대로 유지됩니다.':`${host.hint??'AI 연결을 준비하지 못했어요.'} 로그인과 사용 한도를 확인한 뒤 Classmate를 다시 열거나, 화면 설정의 ‘대화 상대’에서 다른 AI를 고르세요.`:'이 AI 앱은 패널에서 질문 보내기를 지원하지 않아요. 현재 AI 채팅에 직접 질문하거나 MCP Apps 메시지 전송을 지원하는 앱에서 여세요.'}</p>}
    {rangeMode&&<div className="selection-actions" role="status">{rangeStart?"다른 문단을 누르면 그곳까지 범위가 바뀝니다. 선택 후 ‘이 내용 질문’을 누르세요.":"시작 문단을 누른 다음, 원하는 끝 문단을 누르세요. 사이 문단도 모두 포함됩니다."}</div>}
    {!!rangeCandidate.length&&<div className="selection-actions"><span>{rangeCandidate.length}개 문단 선택</span><button onMouseDown={e=>e.preventDefault()} onClick={()=>applyRange(rangeCandidate)}>이 내용 질문</button><button onClick={()=>{setRangeCandidate([]);setRangeStart(undefined);window.getSelection()?.removeAllRanges();freezeTranscript.current=!!selected;}}>선택 해제</button></div>}
    {lives.some(j=>j.state==="queued")&&<div className="queue-notice" role="status">대기 {lives.filter(j=>j.state==="queued").length}개 · 순서대로 답변합니다. 앱을 종료하면 남은 대기는 취소됩니다.</div>}
    <div className="reading-panes" ref={panes}>
    {preferences.fold&&preferences.fold!=="none"&&<button className={`pane-reopen reopen-${preferences.fold}`} onClick={()=>updatePreferences({...preferences,fold:"none"})}>{preferences.fold==="transcript"?"전사 열기":"대화 열기"}</button>}
    <section className="transcript-pane"><header className="transcript-heading"><h2>수업 전사</h2></header>
    <div className="transcript-scroll" ref={viewport} tabIndex={0} aria-label="수업 전사와 문장별 대화" onMouseDown={()=>{freezeTranscript.current=true;}} onMouseUp={inspectSelection} onKeyUp={inspectSelection} onScroll={()=>{const e=viewport.current!;const yes=e.scrollHeight-e.clientHeight-e.scrollTop<45&&!selected;follow.current=yes;setFollowing(yes);}}>
      {!paragraphs.length?<section className="empty"><h2>{status?.recording?.mode==='none'?'녹음을 연결해 주세요':['share','replay'].includes(status?.recording?.mode??'')?transcriptStatus(status):status?.status.daemon==='alive'&&!status?.delivery?.refreshError?'전사 대기 중':'전사 연결 복구 중'}</h2><p>{status?.recording?.mode==='none'?'위의 ‘Tiro 링크 연결’에 녹음 공유 링크를 붙여 넣으세요.':status?.recording?.mode==='share'?(status.recording.message??'공유 화면에 전사가 표시되면 여기에 반영됩니다. 휴대폰 녹음도 같은 방법으로 연결할 수 있습니다.'):status?.recording?.mode==='replay'?'파일 시각에 따라 전사가 표시됩니다.':'자료 연결을 확인하고 있습니다. 기존 기록은 보존됩니다.'}</p></section>:<TranscriptFlow lines={paragraphs.map(p=>({id:p.uuid,time:p.timeBasis==='observed'?`수신 ${clock(p.timeFrom)}`:clock(p.timeFrom),segments:[{text:p.text}]}))} selectedIds={rangeCandidate.length?rangeCandidate.map(p=>p.uuid):selected?(drafts[selected]?.selection?.map(p=>p.uuid)??[selected]):[]} onSentence={select} renderAfter={inline} showTimes/>}
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
      {attachments(chatPhotos)}
      <ResizableComposer><form className="chat-input" onSubmit={e=>{e.preventDefault();chatFollowing.current=true;void sendChat();}}><label className="sr-only" htmlFor="free-question">대화 질문</label><textarea ref={chatInput} id="free-question" onPaste={event=>pastePhotos(event)} rows={2} maxLength={8000} placeholder="궁금한 걸 물어보세요" value={chatText} onChange={e=>{chatRevision.current++;setChatText(e.target.value);}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();chatFollowing.current=true;void sendChat();}}}/>{pending&&!bridge.local?<button type="button" aria-label="생성 중지" onClick={()=>void bridge.cancel?.().catch(()=>setChatError('중지를 요청하지 못했어요.'))}>■ 중지</button>:<button className="primary" aria-label="대화 보내기" disabled={sending||!host?.canSend||preparingPhotos||(!chatText.trim()&&!chatPhotos.length)}>↑</button>}</form></ResizableComposer>
      {chatError&&<p role="alert" className="notice">{chatError}</p>}
    </section>
    </div>
    <div className="preferences-status" role="status">{settingsNotice}</div>
  </main>;
}
