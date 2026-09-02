#!/usr/bin/env node
// 로컬 도우미를 Chrome 에 등록하는 **계획을 보여 주는** 스크립트입니다. 기본값은 dry-run 입니다.
//
// 왜 계획만 먼저 보여 주나
// -----------------------
// 레지스트리는 되돌리기가 번거롭고, 잘못 적으면 Chrome 이 아무 말 없이 안 붙습니다. 그래서
// 이 저장소는 "무엇을 바꿀 것인지 먼저 글로 보여 주고, 사람이 읽은 뒤에만 바꾼다" 를 규칙으로
// 둡니다(`docs/master-prompt.md` §0 의 '대기' 항목). `--apply` 는 **사람이 직접** 실행합니다.
//
// 이 스크립트가 하는 일
//   ① dist/classmate-host.exe 의 절대 경로와 extension-key.json 의 id 로 계획을 세웁니다
//   ② 계획을 사람이 읽을 줄로 보여 줍니다 (register-host.mjs 의 describePlan 을 그대로 씁니다)
//   ③ 매니페스트 JSON 을 dist/com.corthex.classmate.json 으로 써 둡니다
//      (dist 는 .gitignore 에 있고, 이 파일을 쓰는 것만으로는 Chrome 이 아무것도 하지 않습니다.
//       Chrome 이 보는 것은 레지스트리 값이고 그건 --apply 때만 생깁니다.)
//   ④ --apply 면 register-host.mjs 의 main 에 넘깁니다. 등록 규칙의 정본은 그쪽 하나뿐입니다.
//
//   node install.mjs                 계획만 (기본값)
//   node install.mjs --apply         실제 등록   ← 사람이 확인한 뒤에만
//   node install.mjs --remove        해제 계획만
//   node install.mjs --remove --apply 실제 해제  ← 사람이 확인한 뒤에만
//
// 이 파일은 import 만으로는 아무 일도 하지 않습니다. 맨 아래 진입점 가드를 보세요.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  EXTENSION_ID_PATTERN,
  buildManifest,
  describePlan,
  main as registerHostMain,
  planRegistration,
} from '../../apps/native-host/scripts/register-host.mjs';
import {
  distDir,
  distExePath,
  distManifestPath,
  ensureDist,
  keyFilePath,
  repoRoot,
  toPosix,
} from './paths.mjs';

/** 저장소 루트 기준 상대 경로로 바꿔 보여 줍니다. 슬래시는 한 방향으로 통일합니다. */
export function show(absolutePath) {
  return toPosix(relative(repoRoot, absolutePath));
}

/** 인자를 읽습니다. 모르는 인자는 조용히 넘기지 않고 오류로 세웁니다. */
export function parseArgs(argv) {
  const parsed = { apply: false, remove: false, help: false };
  for (const arg of argv) {
    switch (arg) {
      case '--apply':
        parsed.apply = true;
        break;
      case '--remove':
        parsed.remove = true;
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

/** extension-key.json 을 읽습니다. 없거나 모양이 틀리면 무엇을 해야 하는지 알려 줍니다. */
export function readKeyRecord(path = keyFilePath) {
  if (!existsSync(path)) {
    return { ok: false, reason: 'extension-key.json 이 없어요. node installer/windows/extension-key.mjs 를 먼저 돌려 주세요.' };
  }

  let record;
  try {
    record = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { ok: false, reason: `extension-key.json 을 읽지 못했어요: ${error.message}` };
  }

  if (!EXTENSION_ID_PATTERN.test(record.id ?? '')) {
    // 받은 값을 그대로 되뇌지 않습니다. 길이만 알려 줍니다(register-host.mjs 와 같은 태도입니다).
    return { ok: false, reason: `extension-key.json 의 id 가 확장 id 형식이 아니에요(${String(record.id ?? '').length}자).` };
  }
  return { ok: true, record };
}

/**
 * dist 기준 등록 계획을 만듭니다. **아무것도 쓰지 않습니다.**
 *
 * register-host.mjs 의 planRegistration 을 그대로 부릅니다. 계획의 모양을 여기서 다시
 * 정의하지 않는 이유는 하나입니다 — 등록 규칙이 두 곳에 있으면 언젠가 어긋나기 때문입니다.
 */
export function planForDist(extensionId, { remove = false, exe = distExePath, manifestDir = distDir } = {}) {
  return planRegistration({ extensionId, exe, manifestDir, remove });
}

function printUsage() {
  console.log(`사용법
  node installer/windows/install.mjs [--remove] [--apply]

하는 일 (기본값은 dry-run · 레지스트리를 건드리지 않습니다)
  installer/windows/dist/classmate-host.exe 와 extension-key.json 의 id 로
  Native Messaging 등록 계획을 보여 주고, 매니페스트 JSON 을 dist 에 써 둡니다.

인자
  --remove  등록 해제 계획을 보여 줍니다.
  --apply   실제로 고칩니다. **사람이 계획을 읽은 뒤에만** 붙이세요.
  --help    이 도움말.`);
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

  const key = readKeyRecord();
  if (!key.ok) {
    console.error(key.reason);
    return 1;
  }
  const extensionId = key.record.id;

  // --apply 는 우리가 다시 구현하지 않고 등록 스크립트에 그대로 넘깁니다.
  // 그쪽이 실행 파일 존재 확인·reg 실행·되돌리기를 모두 갖고 있습니다.
  if (options.apply) {
    const forwarded = ['--extension-id', extensionId, '--exe', distExePath, '--manifest-dir', distDir, '--apply'];
    if (options.remove) forwarded.push('--remove');
    console.log('register-host.mjs 로 넘깁니다:');
    console.log(`  node apps/native-host/scripts/register-host.mjs ${forwarded.join(' ')}`);
    console.log('');
    return registerHostMain(forwarded);
  }

  const plan = planForDist(extensionId, { remove: options.remove });
  for (const line of describePlan(plan)) console.log(line);

  if (plan.mode === 'register') {
    // 매니페스트 파일 자체는 dry-run 에서도 써 둡니다. dist 는 커밋되지 않는 자리이고,
    // 이 파일이 있다고 Chrome 이 무엇을 하지는 않습니다(Chrome 은 레지스트리 값을 봅니다).
    ensureDist();
    const manifest = buildManifest(extensionId, distExePath);
    writeFileSync(distManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`써 둔 것   ${show(distManifestPath)}`);
  }

  console.log('');
  console.log('[dry-run] 레지스트리를 건드리지 않았어요. 실제로 하려면 아래 한 줄입니다.');
  console.log(`     reg ${plan.registryArgs.map((arg) => (/[\s\\]/.test(arg) ? `"${arg}"` : arg)).join(' ')}`);
  console.log('');
  console.log('대기 항목 · 사람이 확인한 뒤에 직접 실행해 주세요');
  console.log(`     node installer/windows/install.mjs${options.remove ? ' --remove' : ''} --apply`);
  return 0;
}

// 진입점 가드입니다. `node install.mjs` 로 직접 돌릴 때만 움직입니다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
