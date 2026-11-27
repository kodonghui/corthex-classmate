import assert from 'node:assert/strict';
import {appendFile,cp,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const extensionId = 'ofochilajnihkbfhffpmnddcbjgeffli';
const origin = 'https://meet.google.com';
const meet = '/abc-defg-hij';
const different = '/xyz-uvwx-yza';
const painted = color => `<!doctype html><body style="margin:0;background:${color}"><div></div>
  <style>div{width:1px;height:1px;background:black;animation:move .25s infinite alternate}
  @keyframes move{to{transform:translateX(10px)}}</style></body>`;

test('isolated Chromium captures the authorized synthetic background tab, and refuses minimize, change and missing grant',
  {skip:process.platform!=='win32',timeout:30000},async () => {
    const scratch = await mkdtemp(join(tmpdir(),'classmate-meet-browser-'));
    const extension = join(scratch,'extension');
    const source = fileURLToPath(new URL('../orca-meet-extension/',import.meta.url));
    try {
      await cp(source,extension,{recursive:true});
      const manifestFile = join(extension,'manifest.json');
      const manifest = JSON.parse(await readFile(manifestFile,'utf8'));
      // Fixture host permission exposes only the routed synthetic pages; use a test-only capture grant below.
      manifest.host_permissions = [origin+'/*'];
      await writeFile(manifestFile,JSON.stringify(manifest));
      await appendFile(join(extension,'background.mjs'),`
        globalThis.fixture = {
          capture,
          async select(path) {
            const tab = (await chrome.tabs.query({})).find(tab=>tab.url?.endsWith(path));
            const meeting = await fingerprint(tab.url);
            selectedTabId = tab.id;
            await chrome.storage.session.set({authorizedMeet:{tabId:tab.id,meeting}});
            return {tabId:tab.id,windowId:tab.windowId,meeting};
          },
          async windowState(id,state) {
            await chrome.windows.update(id,{state});
            return (await chrome.windows.get(id)).state;
          },
        };
      `);
      for (const granted of [false,true]) {
        const context = await chromium.launchPersistentContext(join(scratch,String(granted)),{channel:'chromium',headless:true,
          args:['--disable-extensions-except='+extension,'--load-extension='+extension,
            '--disable-background-networking','--disable-component-update',...(granted?['--allowlisted-extension-id='+extensionId]:[])],
        });
        try {
          await context.route('**/*',route=>{
            const url = route.request().url();
            if (url===origin+meet || url===origin+different) return route.fulfill({status:200,contentType:'text/html',
              body:painted(url.endsWith(meet)?'#00c039':'#a000e0')});
            return route.abort();
          });
          const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
          const selected = context.pages()[0] ?? await context.newPage();
          await selected.goto(origin+meet);
          const target = await worker.evaluate(path=>globalThis.fixture.select(path),meet);
          const frame = () => worker.evaluate(meeting=>globalThis.fixture.capture(meeting),target.meeting);
          if (!granted) { assert.equal((await frame()).status,'reauthorize'); continue; }
          assert.equal((await frame()).status,'ok');
          const other = await context.newPage();
          await other.goto(origin+different);
          await other.bringToFront();
          const background = await frame();
          assert.equal(background.status,'ok');
          const pixel = await other.evaluate(async data=>{
            const image = new Image();
            image.src = 'data:image/jpeg;base64,'+data;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image,0,0);
            return [...ctx.getImageData(canvas.width>>1,canvas.height>>1,1,1).data];
          },background.data);
          assert.ok(pixel[1]>120 && pixel[0]<100 && pixel[2]<100);
          const state = value => worker.evaluate(([id,value])=>globalThis.fixture.windowState(id,value),[target.windowId,value]);
          assert.equal(await state('minimized'),'minimized');
          assert.equal((await frame()).status,'minimized');
          assert.equal(await state('normal'),'normal');
          assert.equal((await frame()).status,'ok');
          await selected.goto(origin+different);
          assert.equal((await frame()).status,'selection-changed');
        } finally {await context.close();}
      }
    } finally {await rm(scratch,{recursive:true,force:true});}
  });
