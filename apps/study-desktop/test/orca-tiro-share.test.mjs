import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir, mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {parseShare} from '../orca-tiro-share.mjs';
import {Rpc} from '../rpc.mjs';

const shareId = 'synthetic-orca-tiro';
const shareUrl = 'https://tiro.ooo/s/'+shareId;
const now = Date.parse('2026-11-26T00:10:00Z');
const mcp = fileURLToPath(new URL('../orca-context-mcp.mjs',import.meta.url));
const preload = new URL('./orca-tiro-http-fixture.mjs',import.meta.url).href;

function html({page, note, next} = {}) {
  const sharedNote = {recordingEndAt:null, paragraphs:[
    {timeTo:'2026-11-26T00:01:00Z',transcript:{content:'stale'}},
    {timeTo:'00:09:59',transcript:{content:'unknown time basis'}},
    {timeTo:'2026-11-26T00:09:59Z',locked:true,transcript:{content:'locked'}},
    {timeTo:'2026-11-26T00:09:58Z',transcript:{content:'recent '+shareUrl}},
  ], liveParagraph:{transcript:'current words',translation:'hidden'}, ...note};
  const data = {page:'/s/[shareId]', query:{shareId}, props:{pageProps:{shareId,isLiveShare:true,sharedNote,...page}}, ...next};
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></html>`;
}

test('extracts only bounded original transcript text with verified source and age', () => {
  assert.deepEqual(parseShare(html(),shareId,now),{
    recent:[{text:'recent [Tiro share link]',transcribedAt:'2026-11-26T00:09:58.000Z'}],live:'current words',
  });
  assert.equal(parseShare(html({note:{liveParagraph:{transcript:{content:'x'.repeat(1100)}}}}),shareId,now).live.length,1000);
  assert.equal(parseShare(html({note:{liveParagraph:{transcript:{markup:'ignored'},sentenceSnapshot:'ignored'}}}),shareId,now).live,'');
  assert.equal(parseShare(html(),shareId,now+120_000).recent.length,0);
});

test('refuses wrong shares, password gates, dormant recordings and unrelated pages', () => {
  for (const fake of [html({page:{shareId:'another-fixture'}}),html({next:{query:{shareId:'another-fixture'}}}),
    html({page:{isLiveShare:false}}),html({page:{requiresPassword:true}}),html({note:{recordingEndAt:'ended'}}),
    html({note:{status:'dormant'}}),html({note:{archivedAt:'archived'}}),html({next:{page:'/another'}}),
    html()+'<input type="password">',html()+html()]) assert.throws(()=>parseShare(fake,shareId,now));
});

test('stdio routes valid direct selection without Local, rejects stale or unsafe input, and keeps fallback for absent selection',
  {timeout:20000},async () => {
    const local = await mkdtemp(join(tmpdir(),'orca-tiro-share-test-'));
    const folder = join(local,'CorthexClassmate');
    await mkdir(folder);
    const selection = join(folder,'orca-context-tiro.json');
    const put = config => writeFile(selection,JSON.stringify(config));
    async function query(fixture, use = call => call()) {
      const rpc = new Rpc(process.execPath,['--import',preload,mcp],{env:{...process.env,LOCALAPPDATA:local,CLASSMATE_SYNTHETIC_TIRO_CASE:fixture}});
      try {
        assert.deepEqual((await rpc.request('initialize',{protocolVersion:'2025-11-25'})).serverInfo,
          {name:'classmate-context',version:'1.2.0'});
        rpc.notify('notifications/initialized');
        assert.deepEqual((await rpc.request('tools/list')).tools.map(tool=>tool.name),['recent_tiro_transcript','capture_selected_window']);
        return await use(() => rpc.request('tools/call',{name:'recent_tiro_transcript',arguments:{}}));
      } finally {rpc.close();}
    }
    try {
      const [before,valid] = await query('valid',async call => {
        const absent = await call();
        await put({shareUrl});
        return [absent,await call()];
      });
      assert.equal(before.isError,true);
      assert.match(before.content[0].text,/실행 중인 Classmate/);
      assert.equal(valid.isError,undefined);
      assert.equal(valid.content[1].text,'SYNTHETIC saved text\n\nSYNTHETIC live text 1');
      assert.doesNotMatch(JSON.stringify(valid),/NEVER_EXPOSE|synthetic-orca|tiro\.ooo/);
      assert.equal((await query('rolling')).content[1].text,'SYNTHETIC live text 2');
      for (const fixture of ['stale','cached','redirect','oversize']) assert.equal((await query(fixture)).isError,true);
      for (const invalid of [`${shareUrl}?tracking=1`,`${shareUrl}\n`,`https://who@tiro.ooo/s/${shareId}`,
        `https://tiro.ooo.invalid/s/${shareId}`,`https://tiro.ooo/ko/s/${shareId}`,`${shareUrl}/`]) {
        await put({shareUrl:invalid});
        assert.match((await query('valid')).content[0].text,/로컬 설정/);
      }
      await put({shareUrl,extra:'x'.repeat(600)});
      assert.match((await query('valid')).content[0].text,/로컬 설정/);
    } finally {await rm(local,{recursive:true,force:true});}
  });

test('Windows private configuration writer uses stdin, rejects malformed inputs, and replaces atomically',
  {skip:process.platform!=='win32',timeout:15000},async () => {
    const local = await mkdtemp(join(tmpdir(),'orca-tiro-writer-test-'));
    const folder = join(local,'CorthexClassmate');
    const config = join(folder,'orca-context-tiro.json');
    const ps = join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
    const writer = fileURLToPath(new URL('../orca-tiro-select.ps1',import.meta.url));
    const run = input => spawnSync(ps,['-NoProfile','-NonInteractive','-File',writer],{
      input:input+'\n',env:{...process.env,LOCALAPPDATA:local},encoding:'utf8',windowsHide:true,timeout:6000,
    });
    try {
      const first = run(shareUrl);
      assert.equal(first.status,0,first.stderr);
      assert.doesNotMatch(first.stdout,/tiro\.ooo|synthetic-orca/);
      assert.deepEqual(JSON.parse(await readFile(config,'utf8')),{shareUrl});
      assert.equal(run(shareUrl+'?invalid').status,2);
      assert.deepEqual(JSON.parse(await readFile(config,'utf8')),{shareUrl});
      const replacement = shareUrl+'-alternate';
      const second = run(replacement);
      assert.equal(second.status,0,second.stderr);
      assert.deepEqual(JSON.parse(await readFile(config,'utf8')),{shareUrl:replacement});
      assert.deepEqual(await readdir(folder),['orca-context-tiro.json']);
      const verifyAcl = '$acl=Get-Acl -LiteralPath (Join-Path $env:LOCALAPPDATA "CorthexClassmate/orca-context-tiro.json"); '+
        'if (!$acl.AreAccessRulesProtected -or $acl.Access.Count -ne 1) {exit 1}';
      const permissions = spawnSync(ps,['-NoProfile','-NonInteractive','-Command',verifyAcl],{
        env:{...process.env,LOCALAPPDATA:local},windowsHide:true,timeout:5000,
      });
      assert.equal(permissions.status,0);
    } finally {await rm(local,{recursive:true,force:true});}
  });
