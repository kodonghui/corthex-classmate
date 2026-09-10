// CLI-level setup/doctor regression. Temporary settings only; never supplies a real key.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const exe = process.argv[2] ? resolve(process.argv[2]) : join(root,'apps/core/target/debug/classmate-core.exe');
const dir = mkdtempSync(join(tmpdir(),'cmcore-setup-'));
const data = join(dir,'not-created');
function run(args, input = '') {
  const result = spawnSync(exe,args,{encoding:'utf8',input,timeout:15_000,windowsHide:true,env:{...process.env,CLASSMATE_CORE_DIR:data}});
  assert.equal(result.error, undefined, 'CLI failed to execute or timed out');
  assert.ok(!result.stderr.includes(dir), 'error leaked an absolute path');
  return result;
}

let result = run(['doctor','--json']);
assert.equal(result.status,0);
const diagnostic = JSON.parse(result.stdout);
assert.equal(diagnostic.database,'absent');
assert.equal(diagnostic.dataDirectory,'absent');
assert.ok(!existsSync(data),'doctor unexpectedly created storage');
assert.ok(!result.stdout.includes(dir),'diagnostic leaked an absolute path');
const fakeSecret = 'synthetic-secret-must-never-echo';
result = run(['setup'],fakeSecret+'\n');
assert.equal(result.status,1,'redirected hidden input should be refused');
assert.ok(!result.stdout.includes(fakeSecret) && !result.stderr.includes(fakeSecret));
assert.ok(!existsSync(data));
assert.equal(run(['setup','--capture']).status,1);

const config = join(dir,'claude_desktop_config.json');
const original = JSON.stringify({preferences:{keep:true},mcpServers:{existing:{command:'keep-me'}}});
writeFileSync(config,original);
assert.equal(run(['setup','--claude-desktop','--config-file',config]).status,0);
let next = JSON.parse(readFileSync(config,'utf8'));
assert.equal(next.preferences.keep,true);
assert.equal(next.mcpServers.existing.command,'keep-me');
assert.equal(next.mcpServers.classmate.command,exe);
assert.deepEqual(next.mcpServers.classmate.args,['mcp']);
const backups = readdirSync(dir).filter(name=>name.endsWith('.bak'));
assert.equal(backups.length,1);
assert.equal(readFileSync(join(dir,backups[0]),'utf8'),original);
assert.equal(run(['setup','--claude-desktop','--config-file',config]).status,0);
assert.equal(readdirSync(dir).filter(name=>name.endsWith('.bak')).length,1);
writeFileSync(config,'broken json');
assert.equal(run(['setup','--claude-desktop','--config-file',config]).status,1);
assert.equal(readFileSync(config,'utf8'),'broken json');
assert.equal(run(['doctor','--unexpected']).status,1);
console.log('PASS: CLI doctor is read-only, redirected key input refused, Desktop merge/backups/idempotency/invalid-config preservation; temporary files only.');
