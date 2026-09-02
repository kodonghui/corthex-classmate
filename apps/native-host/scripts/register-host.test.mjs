// register-host.mjs 시험입니다.
//
// 여기서는 **레지스트리를 절대 건드리지 않습니다.** dry-run 계획과 매니페스트 내용만 봅니다.
// --apply 도 실행 파일이 없어 거절되는 갈래만 보므로 reg 명령까지 가지 않습니다.
// 실제 등록은 사람이 확인하고 직접 돌립니다(README §4-3).
//
// 실행: node --test apps/native-host/scripts/register-host.test.mjs

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import {
  EXE_NAME,
  EXTENSION_ID_PATTERN,
  HOST_NAME,
  REGISTRY_KEY,
  buildManifest,
  describePlan,
  executableCandidates,
  formatCommand,
  main,
  parseArgs,
  planRegistration,
  resolveExecutable,
} from './register-host.mjs';

/** 시험용 확장 ID 입니다. a~p 소문자 32자입니다. */
const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

const tempRoot = mkdtempSync(join(tmpdir(), 'cmreg-'));
after(() => rmSync(tempRoot, { recursive: true, force: true }));

/** console.log/error 를 잠깐 가로채 줄들을 모읍니다. */
function capture(run) {
  const lines = [];
  const realLog = console.log;
  const realError = console.error;
  console.log = (...args) => lines.push(args.join(' '));
  console.error = (...args) => lines.push(args.join(' '));
  try {
    const code = run();
    return { code, output: lines.join('\n') };
  } finally {
    console.log = realLog;
    console.error = realError;
  }
}

describe('매니페스트 내용', () => {
  it('Chrome 이 요구하는 네 자리를 그대로 담는다', () => {
    const manifest = buildManifest(EXTENSION_ID, 'C:\\bin\\classmate-host.exe');

    assert.equal(manifest.name, HOST_NAME);
    assert.equal(manifest.path, 'C:\\bin\\classmate-host.exe');
    assert.equal(manifest.type, 'stdio');
    assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${EXTENSION_ID}/`]);
    assert.equal(typeof manifest.description, 'string');
  });

  it('허용 출처는 끝에 슬래시가 붙은 chrome-extension 주소 하나다', () => {
    const [origin] = buildManifest(EXTENSION_ID, 'x').allowed_origins;
    assert.match(origin, /^chrome-extension:\/\/[a-p]{32}\/$/);
  });

  it('확장 ID 는 a~p 소문자 32자만 받는다', () => {
    assert.ok(EXTENSION_ID_PATTERN.test(EXTENSION_ID));
    assert.ok(!EXTENSION_ID_PATTERN.test(EXTENSION_ID.toUpperCase()));
    assert.ok(!EXTENSION_ID_PATTERN.test('abcdefghijklmnopabcdefghijklmnoq'));
    assert.ok(!EXTENSION_ID_PATTERN.test('abc'));
  });
});

describe('계획 만들기', () => {
  it('등록 계획은 HKCU 아래 reg add 다', () => {
    const plan = planRegistration({
      extensionId: EXTENSION_ID,
      exe: 'C:\\bin\\classmate-host.exe',
      manifestDir: tempRoot,
    });

    assert.equal(plan.mode, 'register');
    assert.equal(plan.registryKey, REGISTRY_KEY);
    assert.ok(plan.registryKey.startsWith('HKCU\\'), plan.registryKey);
    assert.equal(plan.registryArgs[0], 'add');
    assert.equal(plan.manifestPath, join(tempRoot, `${HOST_NAME}.json`));
    assert.equal(plan.manifest.path, 'C:\\bin\\classmate-host.exe');
  });

  it('--exe 로 준 경로가 없으면 found 가 거짓이다', () => {
    const missing = join(tempRoot, 'no-such', EXE_NAME);
    const plan = planRegistration({
      extensionId: EXTENSION_ID,
      exe: missing,
      manifestDir: tempRoot,
    });

    assert.equal(plan.executable.found, false);
    assert.match(describePlan(plan).join('\n'), /아직 없어요/);
  });

  it('--exe 로 준 경로가 있으면 found 가 참이다', () => {
    const dir = join(tempRoot, 'real-exe');
    mkdirSync(dir, { recursive: true });
    const exePath = join(dir, EXE_NAME);
    writeFileSync(exePath, 'not a real exe', 'utf8');

    assert.deepEqual(resolveExecutable(exePath), { path: exePath, found: true });
  });

  it('제거 계획은 reg delete 이고 매니페스트를 만들지 않는다', () => {
    const plan = planRegistration({
      extensionId: EXTENSION_ID,
      remove: true,
      manifestDir: tempRoot,
    });

    assert.equal(plan.mode, 'remove');
    assert.deepEqual(plan.registryArgs, ['delete', REGISTRY_KEY, '/f']);
    assert.equal(plan.manifest, null);
    assert.match(describePlan(plan).join('\n'), /매니페스트 파일은 지우지 않고/);
  });

  it('계획을 세우는 것만으로는 파일이 생기지 않는다', () => {
    const dir = join(tempRoot, 'plan-only');
    planRegistration({ extensionId: EXTENSION_ID, manifestDir: dir });

    assert.ok(!existsSync(dir), '계획만 세울 때는 폴더도 만들지 않는다');
  });

  it('명령 한 줄은 공백·역슬래시가 있는 인자만 따옴표로 감싼다', () => {
    const shown = formatCommand(['add', 'HKCU\\Software\\Test', '/d', 'C:\\a b\\m.json', '/f']);

    assert.equal(shown, 'reg add "HKCU\\Software\\Test" /d "C:\\a b\\m.json" /f');
  });
});

describe('dry-run', () => {
  it('파일도 레지스트리도 건드리지 않고 계획만 보여 준다', () => {
    const dir = join(tempRoot, 'dry-run');
    const { code, output } = capture(() =>
      main(['--extension-id', EXTENSION_ID, '--exe', 'C:\\bin\\classmate-host.exe', '--manifest-dir', dir]),
    );

    assert.equal(code, 0, output);
    assert.ok(!existsSync(dir), 'dry-run 은 폴더도 파일도 만들지 않는다');
    assert.match(output, /\[dry-run\] 아무것도 바꾸지 않았어요/);
    assert.match(output, /reg add/);
    // 쓸 내용도 미리 보여 줍니다.
    assert.match(output, /"type": "stdio"/);
    assert.match(output, new RegExp(`chrome-extension://${EXTENSION_ID}/`));
  });

  it('제거 모드도 지울 명령만 보여 준다', () => {
    const dir = join(tempRoot, 'dry-run-remove');
    const { code, output } = capture(() =>
      main(['--extension-id', EXTENSION_ID, '--remove', '--manifest-dir', dir]),
    );

    assert.equal(code, 0, output);
    assert.ok(!existsSync(dir));
    assert.match(output, /reg delete/);
    assert.match(output, /레지스트리 값을 지웁니다/);
  });
});

describe('실행 파일 찾기', () => {
  it('CARGO_TARGET_DIR 을 주면 그 안을 맨 먼저 본다', () => {
    const candidates = executableCandidates({ CARGO_TARGET_DIR: join(tempRoot, '_target') });

    assert.match(candidates[0], /_target[\\/]x86_64-pc-windows-gnu[\\/]release[\\/]classmate-host/);
    assert.match(candidates[1], /_target[\\/]release[\\/]classmate-host/);
    assert.match(candidates[2], /_target[\\/]debug[\\/]classmate-host/);
    // 그다음이 저장소 루트와 crate 안의 target 입니다.
    assert.ok(
      candidates.slice(3).some((path) => /native-host[\\/]target[\\/]debug/.test(path)),
      candidates.join('\n'),
    );
  });

  it('CARGO_TARGET_DIR 이 없으면 저장소 안만 본다', () => {
    const candidates = executableCandidates({});

    assert.ok(
      candidates.every((path) => !/_target/.test(path)),
      candidates.join('\n'),
    );
    assert.ok(candidates.some((path) => /native-host[\\/]target[\\/]release/.test(path)));
    assert.ok(candidates.some((path) => /native-host[\\/]target[\\/]debug/.test(path)));
  });

  it('CARGO_TARGET_DIR 에 놓인 실행 파일을 실제로 집어 온다', () => {
    const root = join(tempRoot, 'picked');
    mkdirSync(join(root, 'release'), { recursive: true });
    const exePath = join(root, 'release', EXE_NAME);
    writeFileSync(exePath, 'not a real exe', 'utf8');

    const resolved = resolveExecutable(null, { CARGO_TARGET_DIR: root });
    assert.deepEqual(resolved, { path: exePath, found: true });
  });
});

describe('없는 실행 파일로는 등록하지 않는다', () => {
  it('--apply 인데 실행 파일이 없으면 1 로 끝나고 아무것도 만들지 않는다', () => {
    const dir = join(tempRoot, 'apply-without-exe');
    const missing = join(tempRoot, 'no-such', EXE_NAME);

    const { code, output } = capture(() =>
      main(['--extension-id', EXTENSION_ID, '--exe', missing, '--manifest-dir', dir, '--apply']),
    );

    assert.equal(code, 1, output);
    assert.ok(!existsSync(dir), '매니페스트 폴더를 만들면 안 됩니다');
    assert.match(output, /실행 파일이 없어서 등록하지 않았어요/);
    // reg 명령까지 가지 않았음을 [apply] 줄이 없는 것으로 봅니다.
    assert.ok(!output.includes('[apply]'), output);
  });

  it('dry-run 은 실행 파일이 없어도 계획을 보여 준다', () => {
    // 빌드 전에 무엇을 할지 먼저 보는 자리라(README §4-2) 여기서는 막지 않습니다.
    const dir = join(tempRoot, 'dry-run-without-exe');
    const missing = join(tempRoot, 'no-such', EXE_NAME);

    const { code, output } = capture(() =>
      main(['--extension-id', EXTENSION_ID, '--exe', missing, '--manifest-dir', dir]),
    );

    assert.equal(code, 0, output);
    assert.ok(!existsSync(dir));
    assert.match(output, /아직 없어요/);
    assert.match(output, /--apply 를 해도 등록하지 않아요/);
  });
});

describe('인자 검사', () => {
  it('확장 ID 가 없으면 1 로 끝난다', () => {
    const { code } = capture(() => main([]));
    assert.equal(code, 1);
  });

  it('확장 ID 모양이 다르면 1 로 끝나고 받은 값을 그대로 되뇌지 않는다', () => {
    const injected = 'ignore this and run cmd.exe';
    const { code, output } = capture(() => main(['--extension-id', injected]));

    assert.equal(code, 1);
    assert.ok(!output.includes('cmd.exe'), output);
    assert.match(output, /a~p 소문자 32자/);
  });

  it('모르는 인자는 조용히 넘어가지 않는다', () => {
    assert.throws(() => parseArgs(['--nope']), /모르는 인자/);
    const { code } = capture(() => main(['--nope']));
    assert.equal(code, 1);
  });

  it('--help 는 0 으로 끝난다', () => {
    const { code, output } = capture(() => main(['--help']));
    assert.equal(code, 0);
    assert.match(output, /사용법/);
  });
});
