// extension-key.mjs 시험입니다.
//
// 여기서는 **파일을 쓰지 않습니다.** 순수 함수(deriveExtensionId · buildKeyRecord)와
// 인자 읽기만 봅니다. 키는 이 시험 안에서 새로 만들어 쓰고 어디에도 남기지 않습니다.
//
// 실행: node --test installer/windows/extension-key.test.mjs

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { EXTENSION_ID_PATTERN } from '../../apps/native-host/scripts/register-host.mjs';
import {
  ID_ALPHABET,
  ID_SOURCE_BYTES,
  buildKeyRecord,
  deriveExtensionId,
  generatePublicKeyBase64,
  parseArgs,
} from './extension-key.mjs';
import { keyFilePath } from './paths.mjs';

// 이 시험 안에서만 쓰는 키 두 개입니다. 비밀키는 만들어지지 않습니다(공개키만 꺼냅니다).
const keyA = generatePublicKeyBase64();
const keyB = generatePublicKeyBase64();

describe('id 파생', () => {
  it('같은 키를 두 번 계산하면 같은 값이 나온다', () => {
    assert.equal(deriveExtensionId(keyA), deriveExtensionId(keyA));
  });

  it('다른 키는 다른 id 가 된다', () => {
    assert.notEqual(deriveExtensionId(keyA), deriveExtensionId(keyB));
  });

  it('register-host.mjs 의 EXTENSION_ID_PATTERN 을 통과한다', () => {
    for (const key of [keyA, keyB]) {
      const id = deriveExtensionId(key);
      assert.equal(id.length, 32);
      assert.ok(EXTENSION_ID_PATTERN.test(id), `${id} 가 a~p 32자가 아니에요`);
    }
  });

  it('sha256 앞 16바이트를 16진수로 적은 뒤 0-9a-f 를 a-p 로 옮긴 값이다', () => {
    // 스크립트와 따로, 규칙 그대로 손으로 한 번 더 계산해 대조합니다.
    const digest = createHash('sha256').update(Buffer.from(keyA, 'base64')).digest();
    const hex = digest.subarray(0, ID_SOURCE_BYTES).toString('hex');
    const byHand = [...hex].map((glyph) => ID_ALPHABET['0123456789abcdef'.indexOf(glyph)]).join('');

    assert.equal(deriveExtensionId(keyA), byHand);
  });

  it('알려진 벡터: 이 저장소의 키는 meldoohgnggckjahcchmfjnngpafcjon 이 된다', () => {
    // 벡터를 **글자 그대로** 박아 둡니다. 예전에는 기대값을 모듈의 ID_ALPHABET 으로 다시
    // 계산했는데, 그러면 알파벳을 바꿔도 시험이 함께 바뀌어 통과해 버려 아무것도 못 잡습니다.
    // 이 값은 `installer/windows/extension-key.json` 의 실측이고, dev zip 의 확장 id ·
    // 매니페스트 `allowed_origins` · 레지스트리 등록이 모두 이 32글자에 걸려 있습니다.
    const record = JSON.parse(readFileSync(keyFilePath, 'utf8'));
    const KNOWN_ID = 'meldoohgnggckjahcchmfjnngpafcjon';

    assert.equal(deriveExtensionId(record.key), KNOWN_ID);
    assert.equal(record.id, KNOWN_ID);
    assert.ok(EXTENSION_ID_PATTERN.test(KNOWN_ID));
  });

  it('규칙을 손으로 다시 밟아도 같은 값이 나온다', () => {
    // 위 벡터가 "왜" 그 값인지를 규칙으로 한 번 더 보입니다(위 시험을 대신하지는 않습니다).
    const fixed = Buffer.from('corthex-classmate-fixed-vector', 'utf8').toString('base64');
    const digest = createHash('sha256').update(Buffer.from(fixed, 'base64')).digest();
    const expected = [...digest.subarray(0, ID_SOURCE_BYTES).toString('hex')]
      .map((glyph) => ID_ALPHABET['0123456789abcdef'.indexOf(glyph)])
      .join('');

    assert.equal(deriveExtensionId(fixed), expected);
    assert.ok(EXTENSION_ID_PATTERN.test(expected));
  });

  it('빈 값이나 문자열이 아닌 값은 거절한다', () => {
    assert.throws(() => deriveExtensionId(''), /공개키/);
    assert.throws(() => deriveExtensionId(null), /공개키/);
    assert.throws(() => deriveExtensionId('!!!'), /0바이트/);
  });
});

describe('저장할 내용', () => {
  it('key · id · createdAt 세 칸만 담는다', () => {
    const record = buildKeyRecord(keyA, new Date('2026-09-03T00:00:00.000Z'));

    assert.deepEqual(Object.keys(record).sort(), ['createdAt', 'id', 'key']);
    assert.equal(record.key, keyA);
    assert.equal(record.id, deriveExtensionId(keyA));
    assert.equal(record.createdAt, '2026-09-03T00:00:00.000Z');
  });

  it('비밀키를 뜻하는 글자가 어디에도 없다', () => {
    const text = JSON.stringify(buildKeyRecord(keyA));

    assert.ok(!text.includes('PRIVATE'));
    assert.ok(!text.includes('privateKey'));
    assert.ok(!/BEGIN [A-Z ]*KEY/.test(text));
  });

  it('공개키는 DER SPKI 라 base64 로 되돌리면 30 30 으로 시작한다', () => {
    // SPKI 는 ASN.1 SEQUENCE 로 시작합니다(0x30). RSA-2048 이면 300 바이트 언저리입니다.
    const der = Buffer.from(keyA, 'base64');
    assert.equal(der[0], 0x30);
    assert.ok(der.length > 250 && der.length < 350, `DER 길이가 ${der.length} 예요`);
  });
});

describe('인자 읽기', () => {
  it('기본값은 덮어쓰지 않기다', () => {
    assert.deepEqual(parseArgs([]), { force: false, help: false });
  });

  it('--force 와 --help 를 알아본다', () => {
    assert.equal(parseArgs(['--force']).force, true);
    assert.equal(parseArgs(['-h']).help, true);
  });

  it('모르는 인자는 오류로 세운다', () => {
    assert.throws(() => parseArgs(['--overwrite']), /모르는 인자/);
  });
});
