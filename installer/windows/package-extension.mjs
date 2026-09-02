#!/usr/bin/env node
// 확장을 **zip 두 벌** 로 묶는 스크립트입니다.
//
//   (a) dev   … CLASSMATE_EXTENSION_KEY 를 주고 묶습니다 → dist/classmate-extension-dev.zip
//               매니페스트에 key 가 들어가 확장 id 가 폴더 경로와 상관없이 고정됩니다.
//   (b) store … 환경 변수 없이 묶습니다                  → dist/classmate-extension-store.zip
//               Web Store 는 자기가 id 를 정하므로 key 가 들어가면 안 됩니다.
//
// 지금은 두 zip 이 같아도 정상입니다
// ---------------------------------
// 이 브랜치의 `apps/browser-extension/wxt.config.ts` 는 아직 CLASSMATE_EXTENSION_KEY 를 읽지
// 않습니다(단위 2 가 같은 시간에 넣는 중입니다). 그래서 이 스크립트는 zip 안 manifest.json 을
// 열어 `key` 가 있는지 **보고만 하고 실패로 치지 않습니다.** 단위 2 가 병합되면 dev zip 에만
// key 가 생기고, 그때 이 스크립트의 출력이 저절로 바뀝니다.
//
// zip 을 여는 코드를 직접 쓴 이유
// ------------------------------
// 새 의존성을 넣지 않기로 했으므로 node 내장(`node:zlib`)만 씁니다. 읽기는 파일 한 개
// (`manifest.json`)를 꺼내 보는 데까지만 하고 zip 을 쓰는 일은 하지 않습니다(그것은 wxt 몫).
//
// 이 파일은 import 만으로는 아무 일도 하지 않습니다. 맨 아래 진입점 가드를 보세요.

import { copyFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

import {
  DEV_ZIP_NAME,
  STORE_ZIP_NAME,
  distDir,
  ensureDist,
  keyFilePath,
  repoRoot,
  toPosix,
} from './paths.mjs';

/** wxt zip 이 결과를 놓는 자리입니다. */
export const OUTPUT_DIR = join(repoRoot, 'apps', 'browser-extension', '.output');

/** 확장 패키지 이름입니다. pnpm --filter 가 이 이름을 씁니다. */
export const EXTENSION_PACKAGE = '@classmate/browser-extension';

/** wxt.config.ts(단위 2)가 읽기로 한 환경 변수 이름입니다. 고정 계약 (바) 입니다. */
export const KEY_ENV_NAME = 'CLASSMATE_EXTENSION_KEY';

/**
 * `.output` 안의 zip 여러 개 중 **이번에 만들어진 확장 zip 한 개**를 고릅니다.
 *
 * 순수 함수입니다. `entries` 는 `{ name, mtimeMs }` 목록입니다.
 * 규칙은 둘입니다.
 *   - 이름에 `sources` 가 든 것은 소스 zip 이라 뺍니다(firefox 제출용이고 확장 알맹이가 아닙니다).
 *   - 남은 것 중 **가장 최근에 쓰인 것**을 고릅니다. wxt 는 같은 이름에 덮어쓰므로 보통 하나뿐이고,
 *     예전 판이 남아 있어도 방금 만든 것을 집습니다.
 */
export function pickBuildZip(entries) {
  const candidates = entries
    .filter((entry) => entry.name.toLowerCase().endsWith('.zip'))
    .filter((entry) => !entry.name.toLowerCase().includes('sources'));

  if (candidates.length === 0) throw new Error('.output 에서 확장 zip 을 찾지 못했어요.');

  return candidates.reduce((best, entry) => (entry.mtimeMs > best.mtimeMs ? entry : best)).name;
}

// ── zip 읽기 (필요한 만큼만) ───────────────────────────────────────────────
// zip 한 개의 구조입니다. 뒤에서부터 읽어야 어디에 무엇이 있는지 알 수 있습니다.
//
//   ┌ 지역 헤더 + 파일 데이터 ┐ … 반복 …  ┌ 중앙 목록 ┐  ┌ 끝 기록(EOCD) ┐
//   │ 30바이트 + 이름 + 데이터│           │ 46바이트  │  │ 22바이트      │
//   └─────────────────────────┘           │ + 이름    │  │ 목록 위치·개수│
//                                         └───────────┘  └───────────────┘

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_BYTES = 22;
const CENTRAL_FIXED_BYTES = 46;
const LOCAL_FIXED_BYTES = 30;

/** 끝 기록(EOCD)의 자리를 뒤에서부터 찾습니다. 주석이 붙어 있어도 찾도록 훑습니다. */
function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - EOCD_MIN_BYTES; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error('zip 의 끝 기록(EOCD)을 찾지 못했어요.');
}

/**
 * zip 바이트에서 이름이 정확히 맞는 파일 하나를 꺼냅니다. 없으면 null 입니다.
 *
 * 순수 함수입니다. 파일 시스템을 보지 않고 받은 버퍼만 읽습니다.
 * 압축 방식은 저장(0)과 deflate(8) 둘만 압니다. 다른 방식이면 오류로 세웁니다.
 */
export function readZipEntry(buffer, entryName) {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error(`중앙 목록 ${index} 번째 항목의 표식이 달라요.`);
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + CENTRAL_FIXED_BYTES;
    const name = buffer.toString('utf8', nameStart, nameStart + nameLength);

    if (name === entryName) {
      if (buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
        throw new Error(`${entryName} 의 지역 헤더 표식이 달라요.`);
      }
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + LOCAL_FIXED_BYTES + localNameLength + localExtraLength;
      const raw = buffer.subarray(start, start + compressedSize);

      if (method === 0) return raw;
      if (method === 8) return inflateRawSync(raw);
      throw new Error(`${entryName} 의 압축 방식 ${method} 는 읽을 줄 몰라요.`);
    }

    offset += CENTRAL_FIXED_BYTES + nameLength + extraLength + commentLength;
  }

  return null;
}

/** zip 안 manifest.json 을 열어 key 가 있는지 봅니다. 값 자체는 보여 주지 않습니다. */
export function inspectManifest(zipPath) {
  const found = readZipEntry(readFileSync(zipPath), 'manifest.json');
  if (!found) return { ok: false, hasKey: false, reason: 'manifest.json 이 zip 안에 없어요.' };

  let manifest;
  try {
    manifest = JSON.parse(found.toString('utf8'));
  } catch (error) {
    return { ok: false, hasKey: false, reason: `manifest.json 을 읽지 못했어요: ${error.message}` };
  }

  return {
    ok: true,
    hasKey: typeof manifest.key === 'string' && manifest.key.length > 0,
    name: manifest.name,
    version: manifest.version,
    permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
  };
}

// ── 묶기 ──────────────────────────────────────────────────────────────────

/** pnpm 에 넘길 인자입니다. 전부 상수입니다. */
export const ZIP_ARGS = ['--filter', EXTENSION_PACKAGE, 'zip'];

/**
 * pnpm 을 어떻게 띄울지 정합니다. 순수 함수라 시험이 플랫폼만 바꿔 넣어 봅니다.
 *
 * Windows 에서 `pnpm` 은 진짜 실행 파일이 아니라 `pnpm.cmd` 배치 파일입니다. Node 는 24 부터
 * 배치 파일을 shell 없이 띄우지 못하게 막았습니다(CVE-2024-27980 대응). 그래서 Windows 에서만
 * shell 을 켭니다.
 *
 * shell 을 켜도 프롬프트 주입 경계(`docs/master-prompt.md` §4-7)는 그대로입니다 — 아래 ZIP_ARGS
 * 는 이 파일에 글자로 박힌 상수뿐이고, 전사·화면·확장이 보낸 값이 명령줄에 닿는 자리가 없습니다.
 */
export function pnpmSpawn(platform = process.platform) {
  if (platform !== 'win32') return { command: 'pnpm', args: ZIP_ARGS, shell: false };

  // shell 을 켠 채로 args 를 따로 넘기면 Node 가 escape 없이 이어 붙인다고 경고합니다(DEP0190).
  // 그래서 이어 붙이는 일을 우리가 눈에 보이게 합니다. 붙는 조각은 전부 위의 상수입니다.
  return { command: ['pnpm.cmd', ...ZIP_ARGS].join(' '), args: [], shell: true };
}

/**
 * `pnpm --filter @classmate/browser-extension zip` 을 한 번 돌립니다.
 *
 * `key` 가 문자열이면 환경 변수를 얹고, null 이면 **환경에서 지웁니다**(store zip 은 key 가
 * 없어야 하는데 셸에 이미 값이 있으면 딸려 들어가기 때문입니다).
 */
export function runZip(key, env = process.env) {
  const childEnv = { ...env };
  if (key) childEnv[KEY_ENV_NAME] = key;
  else delete childEnv[KEY_ENV_NAME];

  const { command, args, shell } = pnpmSpawn();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    windowsHide: true,
    env: childEnv,
    shell,
  });

  if (result.error) {
    console.error(`pnpm 을 실행하지 못했어요: ${result.error.message}`);
    return false;
  }
  return result.status === 0;
}

/** `.output` 을 훑어 방금 만들어진 zip 을 dist 의 정해진 이름으로 옮깁니다. */
function moveZip(targetName) {
  const entries = readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({ name: entry.name, mtimeMs: statSync(join(OUTPUT_DIR, entry.name)).mtimeMs }));

  const picked = pickBuildZip(entries);
  const to = join(distDir, targetName);
  copyFileSync(join(OUTPUT_DIR, picked), to);
  return { from: picked, to, bytes: statSync(to).size };
}

/** 한 벌을 묶고 옮기고 매니페스트를 들여다봅니다. */
function packageOnce(label, key, env) {
  console.log('');
  console.log(`── ${label} 묶는 중 ──────────────────────────────────────────`);
  if (!runZip(key, env)) {
    console.error(`${label} 묶기에 실패했어요.`);
    return null;
  }

  const moved = moveZip(label === 'dev' ? DEV_ZIP_NAME : STORE_ZIP_NAME);
  const shown = toPosix(relative(repoRoot, moved.to));
  console.log(`옮김       ${moved.from} → ${shown} (${moved.bytes.toLocaleString('en-US')} 바이트)`);

  const seen = inspectManifest(moved.to);
  if (!seen.ok) console.log(`매니페스트 ${seen.reason}`);
  else console.log(`매니페스트 name=${seen.name} version=${seen.version} key=${seen.hasKey ? '있음' : '없음'}`);
  return { ...moved, manifest: seen };
}

function printUsage() {
  console.log(`사용법
  node installer/windows/package-extension.mjs [--help]

하는 일
  확장을 두 벌 묶어 installer/windows/dist/ 에 놓습니다.
    dev   ${KEY_ENV_NAME} 를 주고 묶음 → ${DEV_ZIP_NAME}   (매니페스트에 key · 고정 id)
    store 환경 변수 없이 묶음          → ${STORE_ZIP_NAME} (Web Store 는 스스로 id 를 정함)
  key 는 installer/windows/extension-key.json 에서 읽습니다. 없으면 먼저 만들라고 알려 줍니다.`);
}

export function main(argv, env = process.env) {
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    return 0;
  }
  const unknown = argv.find((arg) => arg !== '--help' && arg !== '-h');
  if (unknown) {
    console.error(`모르는 인자예요: ${unknown}`);
    printUsage();
    return 1;
  }

  if (!existsSync(keyFilePath)) {
    console.error('installer/windows/extension-key.json 이 없어요.');
    console.error('먼저 node installer/windows/extension-key.mjs 를 돌려 주세요.');
    return 1;
  }
  const record = JSON.parse(readFileSync(keyFilePath, 'utf8'));
  console.log(`확장 id    ${record.id} (개발용 고정 id)`);

  ensureDist();

  const dev = packageOnce('dev', record.key, env);
  if (!dev) return 1;
  const store = packageOnce('store', null, env);
  if (!store) return 1;

  console.log('');
  if (!dev.manifest.hasKey) {
    console.log('참고       dev zip 에 아직 key 가 없어요. 이 브랜치의 wxt.config.ts 가');
    console.log(`           ${KEY_ENV_NAME} 를 읽지 않기 때문입니다(단위 2 가 넣는 중).`);
    console.log('           단위 2 가 병합되면 이 자리가 "key=있음" 으로 바뀝니다.');
  }
  if (store.manifest.hasKey) {
    console.error('경고       store zip 에 key 가 들어갔어요. Web Store 제출 전에 확인해 주세요.');
  }
  return 0;
}

// 진입점 가드입니다. `node package-extension.mjs` 로 직접 돌릴 때만 움직입니다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
