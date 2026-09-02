#!/usr/bin/env node
// 개발용 **고정 확장 id** 를 만드는 스크립트입니다.
//
// 왜 필요한가
// -----------
// Chrome 은 압축해제 확장을 불러올 때마다 그 폴더 경로로 id 를 짓습니다. 폴더를 옮기면 id 가
// 바뀌고, id 가 바뀌면 Native Messaging 매니페스트의 `allowed_origins` 가 어긋나 로컬 도우미가
// 붙지 않습니다. 매니페스트에 `key`(공개키 base64) 를 넣어 두면 Chrome 이 그 공개키에서 id 를
// 계산하므로 폴더를 옮겨도 id 가 그대로입니다. 그래서 공개키 한 개를 만들어 둡니다.
//
// 비밀키는 만들지도 남기지도 않습니다
// -----------------------------------
// `key` 는 **id 를 고정하는 이름표**일 뿐이고 서명에 쓰이지 않습니다. Chrome 이 확인하는 것은
// "이 매니페스트의 key 에서 계산한 id 가 이 확장의 id 인가" 뿐입니다. 서명이 필요한 자리는
// `.crx` 를 만들 때인데 우리는 압축해제 로드와 Web Store 업로드만 쓰므로 그 자리가 없습니다.
// 그래서 이 스크립트는 RSA 키쌍을 만들되 **공개키만 꺼내 쓰고 비밀키는 파일·로그·표준출력
// 어디에도 내보내지 않습니다.** 아래 generateKeyPairSync 호출이 privateKeyEncoding 을 주지
// 않는 것이 그 장치입니다 — 비밀키는 직렬화되지 않은 KeyObject 로만 잠깐 있다 사라집니다.
//
// id 파생 규칙 (Chrome 과 같은 규칙)
// ----------------------------------
//   ① 공개키를 DER SPKI 로 씁니다 (매니페스트의 key 는 이것의 base64 입니다)
//   ② sha256(DER) 의 **앞 16바이트** 를 16진수 32글자로 적습니다
//   ③ 각 글자 0~9a~f 를 a~p 로 옮깁니다 (0→a, 1→b, …, 9→j, a→k, …, f→p)
//
//   base64 key ── base64 디코드 ──▶ DER 바이트
//                                     │ sha256
//                                     ▼
//                            32바이트 해시 ── 앞 16바이트 ──▶ "3f0c…" (16진 32글자)
//                                                                │ 0-9a-f → a-p
//                                                                ▼
//                                                    "dpam…" (확장 id 32글자)
//
// 이 파일은 import 만으로는 아무 일도 하지 않습니다. 맨 아래 진입점 가드를 보세요.

import { createHash, generateKeyPairSync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { EXTENSION_ID_PATTERN } from '../../apps/native-host/scripts/register-host.mjs';
import { keyFilePath, repoRoot, toPosix } from './paths.mjs';

/** 확장 id 한 글자가 될 수 있는 글자들입니다. 16진수 한 자리를 이 순서로 옮깁니다. */
export const ID_ALPHABET = 'abcdefghijklmnop';

/** 만드는 키의 길이입니다. Chrome 확장이 쓰는 값과 같습니다. */
export const MODULUS_LENGTH = 2048;

/** id 를 만들 때 쓰는 해시 바이트 수입니다. sha256 32바이트 중 앞 16바이트만 씁니다. */
export const ID_SOURCE_BYTES = 16;

/**
 * base64 로 적힌 DER SPKI 공개키에서 확장 id 32글자를 계산합니다.
 *
 * 순수 함수입니다. 파일도 안 읽고 시각도 안 봅니다. 같은 값을 넣으면 늘 같은 값이 나옵니다.
 */
export function deriveExtensionId(keyBase64) {
  if (typeof keyBase64 !== 'string' || keyBase64.length === 0) {
    throw new Error('공개키 base64 문자열이 필요해요.');
  }

  const der = Buffer.from(keyBase64, 'base64');
  if (der.length === 0) {
    throw new Error('공개키 base64 를 디코드하니 0바이트예요.');
  }

  const digest = createHash('sha256').update(der).digest();
  let id = '';
  for (const byte of digest.subarray(0, ID_SOURCE_BYTES)) {
    // 한 바이트는 16진 두 글자입니다. 위 네 비트와 아래 네 비트를 따로 옮깁니다.
    id += ID_ALPHABET[byte >> 4];
    id += ID_ALPHABET[byte & 0x0f];
  }
  return id;
}

/**
 * RSA-2048 공개키 하나를 만들어 base64 DER SPKI 로 돌려줍니다.
 *
 * privateKeyEncoding 을 주지 않았으므로 비밀키는 직렬화되지 않습니다. 아래에서 쓰지도 않습니다.
 */
export function generatePublicKeyBase64() {
  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: MODULUS_LENGTH,
    publicKeyEncoding: { type: 'spki', format: 'der' },
  });
  return publicKey.toString('base64');
}

/** 파일에 적을 내용을 만듭니다. 저장하기 전에 id 가 형식에 맞는지 스스로 확인합니다. */
export function buildKeyRecord(keyBase64, now = new Date()) {
  const id = deriveExtensionId(keyBase64);
  if (!EXTENSION_ID_PATTERN.test(id)) {
    // 파생 규칙이 어긋나면 여기서 멈춥니다. 잘못된 id 로 레지스트리를 등록하면
    // Chrome 이 아무 말 없이 안 붙어 원인을 찾기 어렵기 때문입니다.
    throw new Error(`계산한 id 가 확장 id 형식이 아니에요(${id.length}자).`);
  }
  return { key: keyBase64, id, createdAt: now.toISOString() };
}

function printUsage() {
  console.log(`사용법
  node installer/windows/extension-key.mjs [--force]

하는 일
  RSA-2048 공개키 하나를 만들어 installer/windows/extension-key.json 에 남깁니다.
  담기는 것은 공개키 base64(key)와 거기서 계산한 확장 id(id), 만든 시각(createdAt) 셋뿐입니다.
  비밀키는 만들지도 남기지도 않습니다.

인자
  --force  이미 파일이 있어도 새 키로 덮어씁니다. id 가 바뀌므로 레지스트리 등록도 다시 해야 합니다.
  --help   이 도움말.`);
}

/** 인자를 읽습니다. 모르는 인자는 조용히 넘기지 않고 오류로 세웁니다. */
export function parseArgs(argv) {
  const parsed = { force: false, help: false };
  for (const arg of argv) {
    switch (arg) {
      case '--force':
        parsed.force = true;
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      default:
        throw new Error(`모르는 인자예요: ${arg}`);
    }
  }
  return parsed;
}

export function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    printUsage();
    return 1;
  }

  if (options.help) {
    printUsage();
    return 0;
  }

  const shown = toPosix(relative(repoRoot, keyFilePath));

  if (existsSync(keyFilePath) && !options.force) {
    // 덮어쓰면 id 가 바뀌고 이미 등록해 둔 레지스트리·매니페스트가 전부 어긋납니다.
    // 그래서 기본값은 "그냥 둔다" 입니다.
    console.log(`${shown} 이(가) 이미 있어서 그대로 뒀어요.`);
    console.log('새 id 로 바꾸려면 --force 를 주세요. 그때는 레지스트리 등록도 다시 해야 해요.');
    return 0;
  }

  const record = buildKeyRecord(generatePublicKeyBase64());
  writeFileSync(keyFilePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  console.log(`확장 id  ${record.id}`);
  console.log(`남긴 곳  ${shown}`);
  console.log('담긴 것  공개키(key) · id · createdAt — 비밀키는 만들지도 남기지도 않았어요.');
  return 0;
}

// 진입점 가드입니다. `node extension-key.mjs` 로 직접 돌릴 때만 움직입니다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
