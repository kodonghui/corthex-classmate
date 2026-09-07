// Explicit release validation. No real AI requests, registry writes, or credential reads.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { encodeFrame, decodeFrames } from '../../apps/native-host/scripts/host-roundtrip.mjs';

const zip = resolve(process.argv[2] ?? '');
if (!/Corthex-Classmate-\d+\.\d+\.\d+-windows-x64\.zip$/.test(zip)) throw Error('Expected release ZIP');
const root = mkdtempSync(join(tmpdir(), 'classmate-release-verify-'));
function powershell(args) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args],
    { encoding: 'utf8', timeout: 60000, windowsHide: true, env: { ...process.env, CM_VERIFY_ZIP: zip, CM_VERIFY_ROOT: root } });
  if (r.status !== 0) throw Error(`Validation failed: ${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
powershell(['-Command', 'Expand-Archive -LiteralPath $env:CM_VERIFY_ZIP -DestinationPath $env:CM_VERIFY_ROOT']);
const unpacked = join(root, basename(zip, '.zip'));
const release = JSON.parse(readFileSync(join(unpacked, 'release.json'), 'utf8'));
powershell(['-File', join(unpacked, 'Setup.ps1'), '-Mode', 'Validate']);
const isolated = join(root, 'isolated'); mkdirSync(isolated);
writeFileSync(join(isolated, '.classmate-test-root'), 'release fixture only');
const fakeCli = join(root, 'claude.exe'); writeFileSync(fakeCli, 'Never execute this fixture');
const install = powershell(['-File', join(unpacked, 'Setup.ps1'), '-Mode', 'Install', '-TestRoot', isolated, '-ClaudePath', fakeCli]);
if (!install.includes('no registry/environment writes')) throw Error('Expected isolated installation');
const childEnv = { ...process.env, CLASSMATE_DATA_DIR: join(root, 'sessions'), CLASSMATE_DISABLE_CLI_DISCOVERY: '1' };
delete childEnv.CLASSMATE_CLAUDE_CLI;
const host = join(isolated, release.bundleId, 'app', 'host', 'classmate-host.exe');
const r = spawnSync(host, [], { input: Buffer.concat([encodeFrame({ type: 'ping' }), encodeFrame({ type: 'provider.check' })]),
  env: childEnv, timeout: 10000, windowsHide: true });
if (r.status !== 0) throw Error('Installed host did not exit normally');
const { frames, rest } = decodeFrames(r.stdout);
if (rest.length || frames[0]?.version !== release.version || frames[1]?.state !== 'cli-missing') throw Error('Installed host contract mismatch');
console.log(JSON.stringify({ version: release.version, extensionBuild: release.extensionBuild, files: release.files.length,
  sha256: createHash('sha256').update(readFileSync(zip)).digest('hex'), isolatedInstall: true,
  installedHostPing: true, missingCliDiagnostic: true, registryWrites: false, aiRequests: 0, retainedTestDirectory: root }, null, 2));
