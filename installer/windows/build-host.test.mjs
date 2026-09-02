// build-host.mjs 시험입니다.
//
// 여기서는 **cargo 를 부르지 않습니다.** 자리 계산과 "무엇을 dist 로 옮길지" 만 봅니다.
//
// 실행: node --test installer/windows/build-host.test.mjs

import assert from 'node:assert/strict';
import { isAbsolute, join } from 'node:path';
import { describe, it } from 'node:test';

import { EXE_NAME } from './paths.mjs';
import {
  MANIFEST_PATH,
  collectArtifacts,
  defaultTargetDir,
  parseArgs,
  releaseCandidates,
  resolveTargetDir,
} from './build-host.mjs';

describe('빌드할 자리', () => {
  it('apps/native-host/Cargo.toml 을 절대 경로로 가리킨다', () => {
    assert.ok(isAbsolute(MANIFEST_PATH));
    assert.match(MANIFEST_PATH.replaceAll('\\', '/'), /apps\/native-host\/Cargo\.toml$/);
  });

  it('CARGO_TARGET_DIR 이 있으면 그 자리를 쓴다', () => {
    const chosen = resolveTargetDir({ CARGO_TARGET_DIR: 'C:/tmp/_target' });

    assert.ok(isAbsolute(chosen));
    assert.match(chosen.replaceAll('\\', '/'), /_target$/);
  });

  it('없으면 apps/native-host/target 이다', () => {
    assert.equal(resolveTargetDir({}), defaultTargetDir());
    assert.match(defaultTargetDir().replaceAll('\\', '/'), /apps\/native-host\/target$/);
  });

  it('릴리스 후보는 release 를 먼저 보고 타깃 폴더를 뒤에 본다', () => {
    const [first, second] = releaseCandidates('C:/t');

    assert.equal(first, join('C:/t', 'release', EXE_NAME));
    assert.equal(second, join('C:/t', 'x86_64-pc-windows-gnu', 'release', EXE_NAME));
  });
});

describe('dist 로 옮길 것 고르기', () => {
  it('실행 파일 하나만 있으면 그것만 옮긴다', () => {
    const picked = collectArtifacts([
      { name: 'classmate-host.exe', isFile: true },
      { name: 'classmate-host.d', isFile: true },
      { name: 'libclassmate_host.rlib', isFile: true },
      { name: 'deps', isFile: false },
      { name: '.fingerprint', isFile: false },
    ]);

    assert.deepEqual(picked, ['classmate-host.exe']);
  });

  it('cargo 가 놓은 dll 이 있으면 함께 옮긴다', () => {
    const picked = collectArtifacts([
      { name: 'classmate-host.exe', isFile: true },
      { name: 'some_runtime.dll', isFile: true },
    ]);

    assert.deepEqual(picked, ['classmate-host.exe', 'some_runtime.dll']);
  });

  it('빌드 부산물 폴더 이름이 dll 로 끝나도 폴더는 안 옮긴다', () => {
    const picked = collectArtifacts([
      { name: 'classmate-host.exe', isFile: true },
      { name: 'weird.dll', isFile: false },
    ]);

    assert.deepEqual(picked, ['classmate-host.exe']);
  });

  it('실행 파일이 없으면 빈 목록이다', () => {
    assert.deepEqual(collectArtifacts([{ name: 'build', isFile: false }]), []);
  });
});

describe('인자 읽기', () => {
  it('기본값은 빌드부터 한다', () => {
    assert.deepEqual(parseArgs([]), { skipBuild: false, help: false });
  });

  it('--skip-build 를 알아본다', () => {
    assert.equal(parseArgs(['--skip-build']).skipBuild, true);
  });

  it('모르는 인자는 오류로 세운다', () => {
    assert.throws(() => parseArgs(['--release']), /모르는 인자/);
  });
});
