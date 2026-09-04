import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertChromeVersion,
  assertVersionName,
  dirtyFromPorcelain,
  makeVersionName,
  releaseIdentityVerdict,
  VERSION_NAME_ENV,
} from './release-identity.mjs';

describe('확장 릴리스 식별자', () => {
  it('Chrome 숫자 version과 공개 환경 변수 이름을 고정한다', () => {
    assert.equal(assertChromeVersion('0.0.3'), '0.0.3');
    assert.equal(assertChromeVersion('1.2.3.65535'), '1.2.3.65535');
    assert.equal(VERSION_NAME_ENV, 'CLASSMATE_EXTENSION_VERSION_NAME');
    for (const bad of ['0.0.0', '0.0.3-beta', '1.2.3.65536', '01.2.3', '', null]) {
      assert.throws(() => assertChromeVersion(bad));
    }
  });

  it('commit과 dirty 여부만으로 추적 가능한 version_name을 만든다', () => {
    assert.equal(
      makeVersionName({ version: '0.0.3', commit: 'd0c8d5677646', dirty: false }),
      '0.0.3+gd0c8d5677646',
    );
    assert.equal(
      makeVersionName({ version: '0.0.3', commit: 'd0c8d5677646', dirty: true }),
      '0.0.3+gd0c8d5677646.dirty',
    );
    assert.throws(() => makeVersionName({ version: '0.0.3', commit: 'main', dirty: false }));
    assert.throws(() => makeVersionName({ version: '0.0.3', commit: 'ABCDEF12', dirty: false }));
  });

  it('환경에서 받은 version_name도 정본 version과 형식을 함께 검사한다', () => {
    assert.equal(assertVersionName('0.0.3', '0.0.3+gabcdef12'), '0.0.3+gabcdef12');
    assert.equal(assertVersionName('0.0.3', '0.0.3+gabcdef12.dirty'), '0.0.3+gabcdef12.dirty');
    assert.throws(() => assertVersionName('0.0.3', '0.0.2+gabcdef12'));
    assert.throws(() => assertVersionName('0.0.3', 'release-local'));
  });

  it('porcelain 본문을 노출하지 않고 빈 상태만 dirty로 바꾼다', () => {
    assert.equal(dirtyFromPorcelain(''), false);
    assert.equal(dirtyFromPorcelain('  \r\n'), false);
    assert.equal(dirtyFromPorcelain('?? private-name.txt\n'), true);
  });
});

describe('dev/store ZIP 릴리스 판정', () => {
  const expectedVersion = '0.0.3';
  const expectedVersionName = '0.0.3+gabcdef12';
  const good = { version: expectedVersion, versionName: expectedVersionName };

  it('package·dev·store 두 칸이 모두 같을 때만 통과한다', () => {
    assert.deepEqual(releaseIdentityVerdict({ expectedVersion, expectedVersionName, dev: good, store: good }), {
      code: 0,
      lines: [`확인       version=${expectedVersion} · version_name=${expectedVersionName}`],
    });
  });

  it('dev 또는 store version이 package 정본과 다르면 실패한다', () => {
    const dev = releaseIdentityVerdict({
      expectedVersion,
      expectedVersionName,
      dev: { ...good, version: '0.0.2' },
      store: good,
    });
    const store = releaseIdentityVerdict({
      expectedVersion,
      expectedVersionName,
      dev: good,
      store: { ...good, version: '0.0.2' },
    });
    assert.equal(dev.code, 1);
    assert.ok(dev.lines.some((line) => line.includes('dev zip version=0.0.2')));
    assert.equal(store.code, 1);
    assert.ok(store.lines.some((line) => line.includes('store zip version=0.0.2')));
  });

  it('dev 또는 store version_name이 기대 빌드와 다르거나 없으면 실패한다', () => {
    const dev = releaseIdentityVerdict({
      expectedVersion,
      expectedVersionName,
      dev: { ...good, versionName: '0.0.3+g12345678' },
      store: good,
    });
    const store = releaseIdentityVerdict({
      expectedVersion,
      expectedVersionName,
      dev: good,
      store: { version: expectedVersion },
    });
    assert.equal(dev.code, 1);
    assert.ok(dev.lines.some((line) => line.includes('dev zip version_name=')));
    assert.equal(store.code, 1);
    assert.ok(store.lines.some((line) => line.includes('store zip version_name=(없음)')));
  });
});
