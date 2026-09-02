// install.mjs 시험입니다.
//
// 여기서는 **레지스트리를 절대 건드리지 않습니다.** dry-run 계획의 모양만 봅니다.
// `--apply` 갈래는 부르지 않습니다. 실제 등록은 사람이 확인하고 직접 돌립니다
// (`docs/first-class.md` 의 '대기' 항목).
//
// 실행: node --test installer/windows/install.test.mjs

import assert from 'node:assert/strict';
import { isAbsolute, join } from 'node:path';
import { describe, it } from 'node:test';

import { HOST_NAME, REGISTRY_KEY } from '../../apps/native-host/scripts/register-host.mjs';
import { distDir, distExePath, distManifestPath } from './paths.mjs';
import { parseArgs, planForDist, readKeyRecord, show } from './install.mjs';

/** 시험용 확장 id 입니다. a~p 소문자 32자입니다. */
const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

describe('등록 계획', () => {
  const plan = planForDist(EXTENSION_ID);

  it('실행 파일은 dist 안의 절대 경로다', () => {
    assert.ok(isAbsolute(plan.executable.path));
    assert.equal(plan.executable.path, distExePath);
    assert.match(plan.executable.path, /classmate-host\.exe$/);
  });

  it('매니페스트도 dist 안에 놓인다', () => {
    assert.equal(plan.manifestDir, distDir);
    assert.equal(plan.manifestPath, distManifestPath);
    assert.equal(plan.manifestPath, join(distDir, `${HOST_NAME}.json`));
  });

  it('확장 id 가 계획과 allowed_origins 양쪽에 그대로 실린다', () => {
    assert.equal(plan.extensionId, EXTENSION_ID);
    assert.deepEqual(plan.manifest.allowed_origins, [`chrome-extension://${EXTENSION_ID}/`]);
    assert.equal(plan.manifest.path, distExePath);
    assert.equal(plan.manifest.type, 'stdio');
  });

  it('레지스트리는 HKCU 아래 reg add 한 줄이다', () => {
    assert.equal(plan.registryKey, REGISTRY_KEY);
    assert.match(plan.registryKey, /^HKCU\\/);
    assert.deepEqual(plan.registryArgs, ['add', REGISTRY_KEY, '/ve', '/t', 'REG_SZ', '/d', distManifestPath, '/f']);
  });
});

describe('해제 계획', () => {
  const plan = planForDist(EXTENSION_ID, { remove: true });

  it('reg delete 이고 실행 파일을 보지 않는다', () => {
    assert.equal(plan.mode, 'remove');
    assert.deepEqual(plan.registryArgs, ['delete', REGISTRY_KEY, '/f']);
    assert.equal(plan.executable, null);
    assert.equal(plan.manifest, null);
  });
});

describe('키 파일 읽기', () => {
  it('없는 파일이면 무엇을 해야 하는지 알려 준다', () => {
    const result = readKeyRecord(join(distDir, '없는-파일.json'));

    assert.equal(result.ok, false);
    assert.match(result.reason, /extension-key\.mjs/);
  });
});

describe('인자 읽기', () => {
  it('기본값은 dry-run 이고 등록이다', () => {
    assert.deepEqual(parseArgs([]), { apply: false, remove: false, help: false });
  });

  it('--apply 와 --remove 를 알아본다', () => {
    assert.deepEqual(parseArgs(['--remove', '--apply']), { apply: true, remove: true, help: false });
  });

  it('모르는 인자는 오류로 세운다', () => {
    assert.throws(() => parseArgs(['--yes']), /모르는 인자/);
  });
});

describe('경로 보여 주기', () => {
  it('저장소 루트 기준 상대 경로에 슬래시 한 방향이다', () => {
    assert.equal(show(distExePath), 'installer/windows/dist/classmate-host.exe');
    assert.ok(!show(distManifestPath).includes('\\'));
  });
});
