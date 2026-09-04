// package-extension.mjs 시험입니다.
//
// 여기서는 **pnpm 도 wxt 도 부르지 않습니다.** 순수 함수 둘만 봅니다.
//   - pickBuildZip   `.output` 목록에서 어느 zip 을 집을지
//   - readZipEntry   zip 바이트에서 manifest.json 한 개를 꺼내기
// zip 은 이 시험이 손으로 만들어 넣습니다(형식을 우리가 직접 읽으므로 형식 자체를 시험합니다).
//
// 실행: node --test installer/windows/package-extension.test.mjs

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deflateRawSync } from 'node:zlib';

import {
  KEY_ENV_NAME,
  ZIP_ARGS,
  pickBuildZip,
  pnpmSpawn,
  readZipEntry,
  zipKeyVerdict,
  zipReleaseVerdict,
} from './package-extension.mjs';

/**
 * 시험용 zip 한 개를 손으로 만듭니다.
 *
 * 구조는 package-extension.mjs 의 그림과 같습니다.
 *   [지역 헤더 30 + 이름 + 데이터] … [중앙 목록 46 + 이름] … [끝 기록 22]
 * CRC 는 0 으로 둡니다. 우리 읽개는 CRC 를 보지 않습니다(꺼내 읽기만 하고 검증은 Chrome 몫).
 */
function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const body = Buffer.from(entry.content, 'utf8');
    const method = entry.deflate ? 8 : 0;
    const stored = entry.deflate ? deflateRawSync(body) : body;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // 필요한 판
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0, 14); // crc32 — 읽개가 보지 않습니다
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra 없음

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, name, stored);
    centrals.push(central, name);
    offset += local.length + name.length + stored.length;
  }

  const localBytes = Buffer.concat(locals);
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(localBytes.length, 16);

  return Buffer.concat([localBytes, centralBytes, end]);
}

describe('zip 이름 고르기', () => {
  it('.output 에 zip 이 하나면 그것을 집는다', () => {
    const picked = pickBuildZip([
      { name: 'chrome-mv3', mtimeMs: 10 },
      { name: 'classmate-browser-extension-0.0.1-chrome.zip', mtimeMs: 20 },
    ]);

    assert.equal(picked, 'classmate-browser-extension-0.0.1-chrome.zip');
  });

  it('소스 zip 은 확장 알맹이가 아니라 뺀다', () => {
    const picked = pickBuildZip([
      { name: 'ext-0.0.1-sources.zip', mtimeMs: 99 },
      { name: 'ext-0.0.1-chrome.zip', mtimeMs: 20 },
    ]);

    assert.equal(picked, 'ext-0.0.1-chrome.zip');
  });

  it('여러 개면 가장 최근에 쓰인 것을 집는다', () => {
    const picked = pickBuildZip([
      { name: 'ext-0.0.1-chrome.zip', mtimeMs: 20 },
      { name: 'ext-0.0.2-chrome.zip', mtimeMs: 40 },
      { name: 'ext-0.0.0-chrome.zip', mtimeMs: 30 },
    ]);

    assert.equal(picked, 'ext-0.0.2-chrome.zip');
  });

  it('zip 이 없으면 오류로 세운다', () => {
    assert.throws(() => pickBuildZip([{ name: 'manifest.json', mtimeMs: 1 }]), /찾지 못했어요/);
  });
});

describe('zip 안 파일 꺼내기', () => {
  it('저장(압축 안 함) 항목을 그대로 읽는다', () => {
    const zip = makeZip([{ name: 'manifest.json', content: '{"name":"x"}' }]);

    assert.equal(readZipEntry(zip, 'manifest.json').toString('utf8'), '{"name":"x"}');
  });

  it('deflate 항목을 풀어서 읽는다', () => {
    const body = JSON.stringify({ name: 'Corthex Classmate', key: 'AAAB', version: '0.0.1' });
    const zip = makeZip([{ name: 'manifest.json', content: body, deflate: true }]);

    assert.deepEqual(JSON.parse(readZipEntry(zip, 'manifest.json').toString('utf8')).key, 'AAAB');
  });

  it('앞뒤에 다른 항목이 있어도 이름으로 찾는다', () => {
    const zip = makeZip([
      { name: 'background.js', content: 'console.log(1)' },
      { name: 'manifest.json', content: '{"version":"0.0.1"}', deflate: true },
      { name: 'sidepanel.html', content: '<html></html>' },
    ]);

    assert.equal(readZipEntry(zip, 'manifest.json').toString('utf8'), '{"version":"0.0.1"}');
  });

  it('없는 이름이면 null 이다', () => {
    const zip = makeZip([{ name: 'manifest.json', content: '{}' }]);

    assert.equal(readZipEntry(zip, 'key.pem'), null);
  });

  it('zip 이 아니면 오류로 세운다', () => {
    assert.throws(() => readZipEntry(Buffer.alloc(64), 'manifest.json'), /EOCD/);
  });
});

describe('묶는 자리의 약속', () => {
  it('환경 변수 이름은 고정 계약 (바) 의 이름 그대로다', () => {
    assert.equal(KEY_ENV_NAME, 'CLASSMATE_EXTENSION_KEY');
  });

  it('Windows 에서만 pnpm.cmd 를 shell 한 줄로 부른다', () => {
    // Node 24 는 .cmd 배치 파일을 shell 없이 띄우지 못합니다. 그 자리만 한 줄로 이어 붙입니다.
    assert.deepEqual(pnpmSpawn('win32'), {
      command: 'pnpm.cmd --filter @classmate/browser-extension zip',
      args: [],
      shell: true,
    });
    assert.deepEqual(pnpmSpawn('linux'), { command: 'pnpm', args: ZIP_ARGS, shell: false });
  });

  it('pnpm 에 넘기는 인자는 전부 상수다', () => {
    // 여기에 바깥에서 온 값이 끼어들면 프롬프트 주입 경계(§4-7)가 무너집니다.
    assert.deepEqual(ZIP_ARGS, ['--filter', '@classmate/browser-extension', 'zip']);
    assert.ok(ZIP_ARGS.every((arg) => typeof arg === 'string'));
  });
});

describe('두 zip 의 key 판정', () => {
  // 되돌리면(= dev 에 key 가 없어도 "참고" 만 찍고 0 으로 끝내면) 이 절이 무너집니다.

  it('dev 있음 · store 없음 이면 통과다', () => {
    const verdict = zipKeyVerdict({ devHasKey: true, storeHasKey: false });
    assert.equal(verdict.code, 0);
    assert.ok(verdict.lines.length > 0);
  });

  it('dev 에 key 가 없으면 실패로 센다', () => {
    const verdict = zipKeyVerdict({ devHasKey: false, storeHasKey: false });
    assert.equal(verdict.code, 1);
    assert.ok(verdict.lines.some((line) => line.includes('dev zip 에 key 가 없어요')));
    assert.ok(verdict.lines.some((line) => line.includes(KEY_ENV_NAME)));
  });

  it('store 에 key 가 새면 실패로 센다', () => {
    const verdict = zipKeyVerdict({ devHasKey: true, storeHasKey: true });
    assert.equal(verdict.code, 1);
    assert.ok(verdict.lines.some((line) => line.includes('store zip 에 key 가 들어갔어요')));
  });

  it('둘 다 어긋나면 두 이유를 모두 말한다', () => {
    const verdict = zipKeyVerdict({ devHasKey: false, storeHasKey: true });
    assert.equal(verdict.code, 1);
    assert.ok(verdict.lines.some((line) => line.includes('dev zip')));
    assert.ok(verdict.lines.some((line) => line.includes('store zip')));
  });
});

describe('두 zip 의 릴리스 식별 판정', () => {
  const expectedVersion = '0.0.3';
  const expectedVersionName = '0.0.3+gabcdef12';
  const good = { version: expectedVersion, versionName: expectedVersionName };

  it('dev/store가 package 숫자판과 표시판에 모두 맞으면 통과한다', () => {
    assert.equal(zipReleaseVerdict({ expectedVersion, expectedVersionName, dev: good, store: good }).code, 0);
  });

  it('dev/store 중 하나라도 package version과 다르면 실패한다', () => {
    assert.equal(
      zipReleaseVerdict({
        expectedVersion,
        expectedVersionName,
        dev: { ...good, version: '0.0.2' },
        store: good,
      }).code,
      1,
    );
    assert.equal(
      zipReleaseVerdict({
        expectedVersion,
        expectedVersionName,
        dev: good,
        store: { ...good, version: '0.0.2' },
      }).code,
      1,
    );
  });

  it('dev/store 중 하나라도 version_name이 다르거나 없으면 실패한다', () => {
    assert.equal(
      zipReleaseVerdict({
        expectedVersion,
        expectedVersionName,
        dev: { ...good, versionName: '0.0.3+g12345678' },
        store: good,
      }).code,
      1,
    );
    assert.equal(
      zipReleaseVerdict({
        expectedVersion,
        expectedVersionName,
        dev: good,
        store: { version: expectedVersion },
      }).code,
      1,
    );
  });
});
