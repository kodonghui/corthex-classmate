import { chromium, expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
test('study controls: actual renderer, export success/error, name changes and narrow layout', async () => {
  const extension = path.join(root, 'apps/browser-extension/.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', { channel:'chromium', viewport:{width:380,height:1050}, args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const panel = await context.newPage();
    const pageErrors: string[] = []; panel.on('pageerror',e=>pageErrors.push(e.message));
    await panel.addInitScript(() => {
      chrome.runtime.connect = (() => ({ postMessage() {}, disconnect() {}, name:'isolated-test',
        onMessage:{addListener() {},removeListener() {}}, onDisconnect:{addListener() {},removeListener() {}} })) as unknown as typeof chrome.runtime.connect;
      chrome.runtime.sendMessage = (async (m: { action?: string; title?: string }) => {
        if (m.action === 'list') return {ok:true,data:{sessions:[{sessionId:'2026-09-08-p1',title:'04~06_Spring_framework'}],blogRoot:'C:/Users/Student/Documents/Classmate-Blog'}};
        sessionStorage.setItem('last-study-action', m.action ?? '');
        if (m.title === 'CON') return {ok:false,reason:'invalid-name'};
        if (m.action === 'rename' || m.action === 'create') {
          await chrome.storage.local.set({'classmate.subject':m.title ?? '수업'});
          return {ok:true,data:{}};
        }
        return {ok:true,data:{path:'C:/Users/Student/Documents/Classmate-Blog/04~06_Spring_framework'}};
      }) as unknown as typeof chrome.runtime.sendMessage;
    });
    await panel.goto(`chrome-extension://${id}/sidepanel.html`);
    await panel.waitForFunction(()=>window.classmateReplay?.live);
    await panel.getByRole('button',{name:'설정',exact:true}).click();
    await expect(panel.getByLabel('학습 묶음 이름')).toBeVisible();
    await expect(panel.getByLabel('기록 슬롯')).toHaveCount(0);
    await panel.getByLabel('학습 묶음 이름').fill('CON');
    await panel.getByRole('button',{name:'현재 이름 변경'}).click();
    await expect(panel.getByRole('status')).toContainText('사용할 수 없어요');
    await panel.getByLabel('학습 묶음 이름').fill('04~06_Spring_framework');
    await panel.getByRole('button',{name:'블로그 자료 저장',exact:true}).click();
    await expect(panel.getByRole('status')).toContainText('자료를 저장했어요');
    for (const width of [320,380,790]) {
      await panel.setViewportSize({width,height:1050});
      expect(await panel.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await panel.setViewportSize({width:380,height:1050});
    await panel.getByRole('button',{name:'현재 이름 변경'}).click();
    await panel.waitForFunction(()=>window.classmateReplay?.live);
    await expect(panel.getByRole('button',{name:'설정',exact:true})).toBeVisible();
    await panel.getByRole('button',{name:'설정',exact:true}).click();
    await expect(panel.getByLabel('학습 묶음 이름')).toHaveValue('04~06_Spring_framework');
    expect(await panel.evaluate(()=>sessionStorage.getItem('last-study-action'))).toBe('rename');
    await panel.getByRole('button',{name:'블로그 자료 저장',exact:true}).click();
    await expect(panel.getByRole('status')).toContainText('자료를 저장했어요');
    await panel.screenshot({path:path.join(root,'docs/screenshots/study-bundles.png')});
    await panel.getByRole('button',{name:'학습 마침 · 자료 저장'}).click();
    await expect(panel.getByRole('status')).toContainText('영상/Tiro는 직접 정지');
    expect(pageErrors).toEqual([]);
  } finally { await context.close(); }
});
