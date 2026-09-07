#!/usr/bin/env node
// Developer-side packager. Recipients need only Windows PowerShell, not Node.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync, mkdtempSync, renameSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { deriveExtensionId } from './extension-key.mjs';
import { HOST_NAME, buildManifest } from '../../apps/native-host/scripts/register-host.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const slash = (value) => value.split(sep).join('/');
export function safeRelative(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9_@./+ -]+$/.test(name)
    && !name.startsWith('/') && !name.split('/').some((part) => part === '.' || part === '..' || part === '');
}
export function validateExtension(manifest, expectedVersion) {
  if (manifest.version !== expectedVersion || !manifest.key || manifest.manifest_version !== 3) throw new Error('Wrong extension version/key/manifest');
  if (!manifest.permissions?.includes('nativeMessaging') || !manifest.side_panel?.default_path) throw new Error('Missing extension integration');
  return deriveExtensionId(manifest.key);
}
function filesAt(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (lstatSync(path).isSymbolicLink()) throw new Error('Linked payload is not allowed');
    const name = prefix + entry.name;
    if (entry.isDirectory()) return filesAt(path, name + '/');
    if (!entry.isFile() || !safeRelative(name)) throw new Error('Unsafe payload entry');
    return [name];
  });
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 30 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.error?.message || result.stdout}`);
  return result.stdout;
}
function put(stage, name, bytes) {
  if (!safeRelative(name)) throw new Error('Unsafe output');
  const path = join(stage, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}
function licenseFiles(folder, depth = 0) {
  if (depth > 2) return [];
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];
    const path = join(folder, entry.name);
    if (entry.isFile() && /^(licen[cs]e|copying|notice|ofl)([._-]|$)/i.test(entry.name)) return [path];
    if (entry.isDirectory() && /^(dist|docs?|licenses?|legal)$/i.test(entry.name)) return licenseFiles(path, depth + 1);
    return [];
  });
}
function collectLicenses(stage) {
  const inventory = [];
  const append = (ecosystem, name, version, license, folder) => {
    let found = licenseFiles(folder);
    if (!found.length && name.startsWith('@wxt-dev/') && license === 'MIT') found = licenseFiles(join(root, 'installer/windows/third-party/wxt'));
    if (!found.length) throw new Error(`License text missing: ${name}@${version}`);
    const slug = `${ecosystem}-${name.replace(/[^a-zA-Z0-9.-]/g, '-')}-${version}`;
    found.forEach((file, i) => put(stage, `licenses/${slug}/${i}-${file.split(/[\\/]/).at(-1)}`, readFileSync(file)));
    inventory.push({ ecosystem, name, version, license });
  };
  const npm = JSON.parse(run('cmd.exe', ['/d', '/s', '/c', 'pnpm licenses list --prod --json']));
  for (const group of Object.values(npm)) for (const pkg of group) {
    for (let i = 0; i < pkg.paths.length; i++) {
      const record = JSON.parse(readFileSync(join(pkg.paths[i], 'package.json'), 'utf8'));
      append('npm', record.name, record.version, record.license ?? pkg.license, pkg.paths[i]);
    }
  }
  // WXT runtime helpers can be inlined even though WXT itself is a build dependency.
  for (const entry of readdirSync(join(root, 'node_modules/.pnpm')).filter((name) => name.startsWith('@wxt-dev+browser@') || name.startsWith('@wxt-dev+storage@'))) {
    const name = entry.startsWith('@wxt-dev+browser@') ? 'browser' : 'storage';
    const folder = join(root, 'node_modules/.pnpm', entry, 'node_modules/@wxt-dev', name);
    const pkg = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
    append('npm', pkg.name, pkg.version, pkg.license, folder);
  }
  // storage inlines dequal and depends on superlock; neither is in the app's prod manifest.
  for (const name of ['dequal', 'superlock']) {
    const entries = readdirSync(join(root, 'node_modules/.pnpm')).filter((entry) => entry.startsWith(name + '@'));
    if (!entries.length) throw new Error(`Missing runtime notice source: ${name}`);
    for (const entry of entries) {
      const folder = join(root, 'node_modules/.pnpm', entry, 'node_modules', name);
      const pkg = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
      append('npm', pkg.name, pkg.version, pkg.license, folder);
    }
  }
  const cargo = JSON.parse(run('cargo', ['metadata', '--locked', '--offline', '--format-version', '1', '--manifest-path', 'apps/native-host/Cargo.toml']));
  for (const pkg of cargo.packages.filter((item) => item.source !== null)) append('cargo', pkg.name, pkg.version, pkg.license, dirname(pkg.manifest_path));
  const sysroot = run('rustc', ['--print', 'sysroot']).trim();
  const rustDocs = join(sysroot, 'share/doc/rust');
  for (const file of ['COPYRIGHT-library.html', 'COPYRIGHT.html']) if (existsSync(join(rustDocs, file))) put(stage, 'licenses/rust/' + file, readFileSync(join(rustDocs, file)));
  for (const file of readdirSync(join(rustDocs, 'licenses')).filter((name) => name.endsWith('.txt'))) put(stage, 'licenses/rust/licenses/' + file, readFileSync(join(rustDocs, 'licenses', file)));
  put(stage, 'licenses/inventory.json', JSON.stringify(inventory, null, 2) + '\n');
  return inventory.length;
}

export function main() {
  if (process.platform !== 'win32') throw new Error('Build this Windows beta on Windows.');
  const version = JSON.parse(readFileSync(join(root, 'apps/browser-extension/package.json'), 'utf8')).version;
  const bundleId = version;
  const extension = join(root, 'apps/browser-extension/.output/chrome-mv3');
  const manifest = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8'));
  const extensionId = validateExtension(manifest, version);
  const host = join(root, 'apps/native-host/target/release/classmate-host.exe');
  if (!existsSync(host) || readFileSync(host).subarray(0, 2).toString() !== 'MZ') throw new Error('Build the Windows release host first.');
  const dist = join(root, 'installer/windows/dist');
  mkdirSync(dist, { recursive: true });
  const name = `Corthex-Classmate-${bundleId}-windows-x64`;
  const finalStage = join(dist, name);
  if (existsSync(finalStage) || existsSync(finalStage + '.zip')) throw new Error('Output already exists; preserve it and choose a new beta version.');
  const stage = join(mkdtempSync(join(dist, 'friend-staging-')), name);
  mkdirSync(stage);
  for (const name of filesAt(extension)) {
    if (!/\.(json|html|js|css|woff2?|png|svg|ico)$/.test(name) || /(^|\/)(private|sessions|screenshots)(\/|$)/i.test(name)) throw new Error('Unexpected extension payload');
    put(stage, 'app/extension/' + name, readFileSync(join(extension, name)));
  }
  put(stage, 'app/host/classmate-host.exe', readFileSync(host));
  put(stage, 'README.md', readFileSync(join(root, 'README.md')));
  for (const name of ['classroom-0.1.0.png', 'manual-extension-0.1.0.png', 'manual-settings-0.1.0.png', 'manual-diagram-0.1.0.png']) {
    put(stage, `docs/screenshots/${name}`, readFileSync(join(root, 'docs/screenshots', name)));
  }
  for (const name of ['Setup.ps1', 'Install.cmd', 'Diagnose.cmd', 'Disconnect.cmd', 'Guide.html', 'README-KO.md']) {
    let content = readFileSync(join(root, 'installer/windows/portable', name), 'utf8');
    if (name.endsWith('.cmd')) content = content.replace(/\r?\n/g, '\r\n');
    put(stage, name, content);
  }
  const licenses = collectLicenses(stage);
  const files = filesAt(stage).map((path) => ({ path, sha256: sha(readFileSync(join(stage, path))) }));
  const record = { schema: 1, version, bundleId, extensionId, extensionBuild: manifest.version_name,
    hostSha256: sha(readFileSync(host)), providers: ['claude'], platforms: ['windows-x64'],
    files };
  put(stage, 'release.json', JSON.stringify(record, null, 2) + '\n');
  // The PowerShell manifest contract is checked against the existing JS canonical builder in tests.
  if (buildManifest(extensionId, host).name !== HOST_NAME) throw new Error('Native host contract changed');
  run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(stage, 'Setup.ps1'), '-Mode', 'Validate']);
  run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:CM_PACKAGE_STAGE, $env:CM_PACKAGE_ZIP, [IO.Compression.CompressionLevel]::Optimal, $true)"],
    { env: { ...process.env, CM_PACKAGE_STAGE: stage, CM_PACKAGE_ZIP: stage + '.zip' } });
  const zipHash = sha(readFileSync(stage + '.zip'));
  renameSync(stage + '.zip', finalStage + '.zip');
  renameSync(stage, finalStage);
  writeFileSync(finalStage + '.zip.sha256', `${zipHash}  ${name}.zip\n`, 'utf8');
  console.log(JSON.stringify({ package: finalStage + '.zip', sha256: zipHash, files: files.length, licenses, version, extensionId }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
