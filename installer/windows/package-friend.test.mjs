import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { safeRelative, validateExtension } from './package-friend.mjs';
import { generatePublicKeyBase64, deriveExtensionId } from './extension-key.mjs';
import { buildManifest } from '../../apps/native-host/scripts/register-host.mjs';

test('packager rejects unsafe relative paths and missing extension identity', () => {
  for (const name of ['../secret', '/absolute', 'C:/secret', 'a/../../b', 'x\\secret', 'a//b', 'a:stream']) assert.equal(safeRelative(name), false, name);
  assert.equal(safeRelative('app/extension/assets/font-name.woff2'), true);
  assert.throws(() => validateExtension({ version: '0.0.6' }, '0.0.6'));
  const key = generatePublicKeyBase64();
  assert.equal(validateExtension({ version: '0.0.6', key, manifest_version: 3, permissions: ['nativeMessaging'], side_panel: { default_path: 'sidepanel.html' } }, '0.0.6'), deriveExtensionId(key));
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'classmate-friend-test-한글 공백-'));
  const key = generatePublicKeyBase64();
  const content = {
    'Setup.ps1': readFileSync(new URL('./portable/Setup.ps1', import.meta.url)),
    'Install.cmd': Buffer.from('@echo off\r\n'),
    'Guide.html': Buffer.from('<p>Test guide</p>'),
    'app/host/classmate-host.exe': Buffer.from('MZ-not-executed'),
    'app/extension/manifest.json': Buffer.from(JSON.stringify({ key, version: '0.0.6' })),
  };
  const release = { schema: 1, version: '0.0.6', bundleId: '0.0.6-beta1', extensionId: deriveExtensionId(key), files: [] };
  for (const [name, bytes] of Object.entries(content)) {
    mkdirSync(dirname(join(root, name)), { recursive: true }); writeFileSync(join(root, name), bytes);
    release.files.push({ path: name, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  writeFileSync(join(root, 'release.json'), JSON.stringify(release));
  const testRoot = join(root, 'isolated'); mkdirSync(testRoot);
  writeFileSync(join(testRoot, '.classmate-test-root'), 'isolated fixture');
  const claude = join(root, 'claude.exe'); writeFileSync(claude, 'must never execute');
  const run = (mode) => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'Setup.ps1'), '-Mode', mode, '-TestRoot', testRoot, '-ClaudePath', claude], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
  return { root, release, testRoot, claude, run };
}

test('Windows 5.1 validates and installs with a non-ASCII/spaced path without registration or CLI execution', { skip: process.platform !== 'win32' }, () => {
  const bench = fixture();
  const passed = bench.run('Validate'); assert.equal(passed.status, 0, passed.stdout + passed.stderr);
  const installed = bench.run('Install'); assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  assert.match(installed.stdout, /no registry\/environment writes/);
  const target = join(bench.testRoot, bench.release.bundleId);
  const hostPath = join(target, 'app/host/classmate-host.exe');
  const manifest = JSON.parse(readFileSync(join(target, 'com.corthex.classmate.json'), 'utf8'));
  assert.ok(isAbsolute(manifest.path), 'the native host path must be absolute');
  // The runner can expose TEMP through an 8.3 alias that PowerShell expands.
  const expectedManifest = buildManifest(bench.release.extensionId, realpathSync.native(hostPath));
  assert.deepEqual({ ...manifest, path: realpathSync.native(manifest.path) },
    { ...expectedManifest, description: 'Corthex Classmate local tutor' });
  assert.equal(existsSync(join(target, 'installation-state.json')), false);
  assert.equal(bench.run('Diagnose').status, 0);
  assert.equal(bench.run('Disconnect').status, 0);
  assert.equal(bench.run('Install').status, 1, 'must not overwrite existing installation');
  // Test outputs remain in a uniquely named temporary directory; never delete user paths.
});

test('tampered payload fails before installing', { skip: process.platform !== 'win32' }, () => {
  const bench = fixture(); writeFileSync(join(bench.root, 'app/host/classmate-host.exe'), 'changed');
  const result = bench.run('Install'); assert.equal(result.status, 1); assert.match(result.stdout, /Checksum mismatch/);
  assert.equal(existsSync(join(bench.testRoot, bench.release.bundleId)), false);
});

test('metadata traversal is rejected before writing any install file', { skip: process.platform !== 'win32' }, () => {
  const bench = fixture(); bench.release.files[0].path = '../outside';
  writeFileSync(join(bench.root, 'release.json'), JSON.stringify(bench.release));
  const result = bench.run('Install'); assert.equal(result.status, 1); assert.match(result.stdout, /Unsafe package path/);
  assert.equal(existsSync(join(bench.testRoot, bench.release.bundleId)), false);
});
