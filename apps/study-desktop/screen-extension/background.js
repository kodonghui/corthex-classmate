let current;
async function stop(){current??=(await chrome.storage.session.get('current')).current;if(current){const c=current;current=undefined;await chrome.storage.session.remove('current');await fetch(c.pair.origin+'/api/screen/stop',{method:'POST',headers:{'Content-Type':'application/json','x-classmate-screen-key':c.pair.key},body:JSON.stringify({binding:c.binding})}).catch(()=>{});}await chrome.runtime.sendMessage({target:'offscreen',type:'stop'}).catch(()=>{});}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{if(sender.id!==chrome.runtime.id||m.target==='offscreen')return;void(async()=>{
  if(m.type==='stop'||m.type==='ended'){await stop();return {ok:true};}
  if(m.type!=='start')return {ok:false};
  await stop();if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(m.pair?.origin??'')||!/^[a-f0-9]{64}$/.test(m.pair?.key??''))throw Error('잘못된 연결 코드');
  const streamId=await chrome.tabCapture.getMediaStreamId({targetTabId:m.tabId});
  if(!(await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})).length)await chrome.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA'],justification:'사용자가 연결한 수업 탭의 정지 화면을 이 PC의 Classmate에 전달'});
  const response=await fetch(m.pair.origin+'/api/screen/start',{method:'POST',headers:{'Content-Type':'application/json','x-classmate-screen-key':m.pair.key},body:JSON.stringify({title:m.title})});if(!response.ok)throw Error('Classmate를 열고 설정의 연결 코드를 다시 확인해 주세요.');
  const {binding}=await response.json();current={pair:m.pair,binding,tabId:m.tabId};await chrome.storage.session.set({current});const r=await chrome.runtime.sendMessage({target:'offscreen',type:'start',streamId,...current});if(!r?.ok){await stop();throw Error('탭 화면을 시작하지 못했습니다.');}return {ok:true};
})().then(reply,e=>reply({ok:false,error:e.message}));return true;});
chrome.tabs.onRemoved.addListener(async id=>{current??=(await chrome.storage.session.get('current')).current;if(id===current?.tabId)await stop();});
chrome.tabs.onUpdated.addListener(async (id,change)=>{current??=(await chrome.storage.session.get('current')).current;if(id===current?.tabId&&(change.status==='loading'||change.url))void stop();});
