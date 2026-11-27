const hostName = 'com.corthex.classmate.meet';
const tabBindingKey = 'authorizedMeet';
let connector, changeEpoch = 0, selectedTabId, captureBusy = false;

async function fingerprint(value) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://meet.google.com' || url.username || url.password ||
        !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(url.pathname)) return undefined;
    const meeting = url.pathname.replace(/\/$/,'');
    const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(meeting));
    return Array.from(new Uint8Array(digest),byte => byte.toString(16).padStart(2,'0')).join('');
  } catch { return undefined; }
}

async function tabState(binding) {
  let tab;
  try { tab = await chrome.tabs.get(binding.tabId); }
  catch { return 'missing'; }
  if (tab.incognito || tab.discarded || tab.pendingUrl || tab.status !== 'complete') return 'unavailable';
  if (!tab.url) return 'reauthorize';
  if (await fingerprint(tab.url) !== binding.meeting) return 'selection-changed';
  try {
    const window = await chrome.windows.get(tab.windowId);
    if (window.state === 'minimized') return 'minimized';
  } catch { return 'missing'; }
  return 'ok';
}

async function capture(meeting) {
  const binding = (await chrome.storage.session.get(tabBindingKey))[tabBindingKey];
  if (!binding) return {status:'reauthorize'};
  if (meeting !== binding.meeting) return {status:'selection-changed'};
  const epoch = changeEpoch;
  const ready = await tabState(binding);
  if (ready !== 'ok') return {status:ready};
  if (epoch !== changeEpoch) return {status:'selection-changed'};
  const contexts = await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']});
  if (!contexts.length) await chrome.offscreen.createDocument({url:'frame.html',reasons:['USER_MEDIA'],
    justification:'Take one fresh image of the explicitly authorized Meet tab only when Classmate requests it.'});
  if (epoch !== changeEpoch) return {status:'selection-changed'};
  let streamId;
  try { streamId = await chrome.tabCapture.getMediaStreamId({targetTabId:binding.tabId}); }
  catch { return {status:'reauthorize'}; }
  if (epoch !== changeEpoch) return {status:'selection-changed'};
  const result = await chrome.runtime.sendMessage({target:'meet-frame',streamId});
  const after = await tabState(binding);
  if (epoch !== changeEpoch) return {status:'selection-changed'};
  if (after !== 'ok') return {status:after};
  return result?.status === 'ok' ? {status:'ok',data:result.data} : {status:'unavailable'};
}

chrome.tabs.onUpdated.addListener((tabId,change) => {
  if (tabId === selectedTabId && (change.url || change.status === 'loading' || change.discarded)) changeEpoch++;
});
chrome.tabs.onRemoved.addListener(tabId => { if (tabId === selectedTabId) changeEpoch++; });
chrome.tabs.onReplaced.addListener((_added, removed) => { if (removed === selectedTabId) changeEpoch++; });

function connect(profileId) {
  if (connector) return connector;
  const port = chrome.runtime.connectNative(hostName);
  connector = port;
  port.onDisconnect.addListener(() => {
    if (connector === port) {
      connector = undefined;
      void chrome.action.setBadgeText({text:'ERR'}).catch(()=>{});
    }
  });
  port.onMessage.addListener(message => {
    if (message?.type === 'selection-saved' || message?.type === 'selection-failed') {
      void chrome.action.setBadgeText({text:message.type==='selection-saved'?'MEET':'ERR'});
      return;
    }
    if (message?.type !== 'capture') return;
    if (captureBusy) { port.postMessage({type:'result',id:message.id,status:'busy'}); return; }
    captureBusy = true;
    void capture(message.meeting).catch(() => ({status:'unavailable'})).then(result => {
      if (connector === port) port.postMessage({type:'result',id:message.id,...result});
    }).catch(() => {}).finally(() => { captureBusy = false; });
  });
  port.postMessage({type:'hello',profileId});
  return port;
}

async function resumeConnector() {
  const {profileId} = await chrome.storage.local.get('profileId');
  const binding = (await chrome.storage.session.get(tabBindingKey))[tabBindingKey];
  if (binding) selectedTabId = binding.tabId;
  if (profileId) connect(profileId);
}
chrome.runtime.onStartup.addListener(() => { void resumeConnector().catch(()=>{}); });
void resumeConnector().catch(()=>{});

chrome.action.onClicked.addListener(tab => {
  void (async () => {
    const meeting = await fingerprint(tab.url);
    if (!meeting || tab.incognito || !Number.isInteger(tab.id) || tab.status !== 'complete' || tab.pendingUrl) {
      await chrome.action.setBadgeText({text:'ERR'});
      return;
    }
    let {profileId} = await chrome.storage.local.get('profileId');
    if (!profileId) {
      profileId = crypto.randomUUID().replaceAll('-','');
      await chrome.storage.local.set({profileId});
    }
    changeEpoch++;
    selectedTabId = tab.id;
    await chrome.storage.session.set({[tabBindingKey]:{tabId:tab.id,meeting}});
    connect(profileId).postMessage({type:'select',meeting});
  })().catch(()=>chrome.action.setBadgeText({text:'ERR'}).catch(()=>{}));
});
