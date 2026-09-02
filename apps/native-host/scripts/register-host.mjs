#!/usr/bin/env node
// Corthex Classmate 로컬 도우미를 Chrome 에 알리는 스크립트.
//
// Chrome 은 Native Messaging 호스트를 두 조각으로 찾는다.
//   ① 매니페스트 JSON — 호스트 이름 · 실행 파일 절대 경로 · 허용할 확장 ID
//   ② 레지스트리 값   — 그 매니페스트 파일의 절대 경로
// 이 스크립트는 --apply 가 있을 때만 ①을 쓰고 ②를 건드린다. 없으면 계획만 보여 준다.
//
// 지키는 경계
// - HKCU 만 쓴다. HKLM(모든 사용자)은 관리자 권한이 필요하고 다른 사용자에게도 영향을 주므로 쓰지 않는다.
// - dry-run 은 **아무것도 바꾸지 않는다.** 파일도 만들지 않고 레지스트리도 건드리지 않는다.
//   (Phase 1 에서는 dry-run 인데도 매니페스트 파일을 썼다. 2026-09-02 에 고쳤다.)
// - 만들어진 매니페스트는 PC 마다 경로와 확장 ID 가 달라 커밋하지 않는다(apps/native-host/.gitignore).
// - 실행 파일 경로는 인자로만 정한다. 매니페스트나 레지스트리에서 읽어 와 실행하지 않는다.
// - 이 파일은 import 만으로는 아무 일도 하지 않는다. 맨 아래 진입점 가드를 보라.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const HOST_NAME = 'com.corthex.classmate';

// 레지스트리 경로는 역슬래시가 많아 조각으로 두고 이어 붙인다(이스케이프 실수를 줄인다).
export const REGISTRY_KEY = [
  'HKCU',
  'Software',
  'Google',
  'Chrome',
  'NativeMessagingHosts',
  HOST_NAME,
].join('\\');

export const MANIFEST_DESCRIPTION =
  'Corthex Classmate 사이드패널이 이 PC 의 로컬 도우미와 주고받는 통로예요';

// Chrome 확장 ID 는 32자이고 a~p 만 쓴다(16진수 0~f 를 a~p 로 옮긴 표기).
export const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const crateDir = resolve(scriptDir, '..');
const repoRoot = resolve(crateDir, '..', '..');

/** 매니페스트를 놓는 기본 자리. --manifest-dir 로 바꿀 수 있다(시험이 임시 폴더를 쓴다). */
export function defaultManifestDir() {
  return join(crateDir, 'manifest');
}

// 릴리스 실행 파일을 찾는 순서. GNU 타깃을 먼저 보고, 없으면 기본 타깃으로 내려간다.
// 저장소 루트를 먼저 보되, 이 crate 는 자기 워크스페이스라 실제 결과물은 보통 마지막 두 후보에 놓인다.
export const EXECUTABLE_CANDIDATES = [
  join(repoRoot, 'target', 'x86_64-pc-windows-gnu', 'release', 'classmate-host.exe'),
  join(repoRoot, 'target', 'release', 'classmate-host.exe'),
  join(crateDir, 'target', 'x86_64-pc-windows-gnu', 'release', 'classmate-host.exe'),
  join(crateDir, 'target', 'release', 'classmate-host.exe'),
];

function printUsage() {
  console.log(`사용법
  node apps/native-host/scripts/register-host.mjs --extension-id <32자 ID> [--exe <경로>] [--apply]
  node apps/native-host/scripts/register-host.mjs --extension-id <32자 ID> --remove [--apply]

인자
  --extension-id <id>  필수. Chrome 확장 ID 32자(a~p). chrome://extensions 에서 확인한다.
  --exe <경로>         선택. 로컬 도우미 실행 파일 경로. 없으면 릴리스 빌드 결과를 찾는다.
  --manifest-dir <경로> 선택. 매니페스트를 놓을 폴더. 없으면 apps/native-host/manifest 다.
  --apply              선택. 이것이 있을 때만 파일을 쓰고 레지스트리를 고친다.
  --remove             선택. 등록을 되돌린다(--apply 와 함께 써야 실제로 지운다).
  --help               이 도움말.`);
}

/** 인자를 읽는다. 모르는 인자는 조용히 넘기지 않고 오류로 세운다. */
export function parseArgs(argv) {
  const parsed = {
    extensionId: null,
    exe: null,
    manifestDir: null,
    apply: false,
    remove: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--extension-id':
        parsed.extensionId = argv[index + 1] ?? null;
        index += 1;
        break;
      case '--exe':
        parsed.exe = argv[index + 1] ?? null;
        index += 1;
        break;
      case '--manifest-dir':
        parsed.manifestDir = argv[index + 1] ?? null;
        index += 1;
        break;
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

/** --exe 가 없을 때 릴리스 실행 파일을 찾는다. 못 찾으면 첫 후보를 그대로 쓰고 알려 준다. */
export function resolveExecutable(explicit) {
  if (explicit) {
    const path = resolve(explicit);
    return { path, found: existsSync(path) };
  }

  const found = EXECUTABLE_CANDIDATES.find((candidate) => existsSync(candidate));
  return { path: found ?? EXECUTABLE_CANDIDATES[0], found: Boolean(found) };
}

/** Chrome 이 읽는 매니페스트 내용이다. 파일로 쓰기 전에 이 함수만 따로 시험할 수 있다. */
export function buildManifest(extensionId, executablePath) {
  return {
    name: HOST_NAME,
    description: MANIFEST_DESCRIPTION,
    path: executablePath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
}

/** 보여 주기용으로 명령 한 줄을 만든다. 공백이나 역슬래시가 있으면 따옴표로 감싼다. */
export function formatCommand(args) {
  const quoted = args.map((arg) => (/[\s\\]/.test(arg) ? `"${arg}"` : arg));
  return ['reg', ...quoted].join(' ');
}

/**
 * 무엇을 할 것인지만 계산한다. **아무것도 쓰지 않는다.**
 *
 * dry-run 과 --apply 가 같은 계획을 보고 움직이도록, 계획 만들기와 실행을 갈라 두었다.
 */
export function planRegistration(options) {
  const manifestDir = options.manifestDir ? resolve(options.manifestDir) : defaultManifestDir();
  const manifestPath = join(manifestDir, `${HOST_NAME}.json`);

  if (options.remove) {
    return {
      mode: 'remove',
      hostName: HOST_NAME,
      registryKey: REGISTRY_KEY,
      extensionId: options.extensionId,
      manifestDir,
      manifestPath,
      manifest: null,
      executable: null,
      registryArgs: ['delete', REGISTRY_KEY, '/f'],
    };
  }

  const executable = resolveExecutable(options.exe);
  return {
    mode: 'register',
    hostName: HOST_NAME,
    registryKey: REGISTRY_KEY,
    extensionId: options.extensionId,
    manifestDir,
    manifestPath,
    manifest: buildManifest(options.extensionId, executable.path),
    executable,
    registryArgs: ['add', REGISTRY_KEY, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f'],
  };
}

/** 계획을 사람이 읽을 줄들로 만든다. dry-run 도 --apply 도 같은 줄을 먼저 보여 준다. */
export function describePlan(plan) {
  const lines = [
    `호스트     ${plan.hostName}`,
    `레지스트리 ${plan.registryKey}`,
    `확장 ID    ${plan.extensionId}`,
  ];

  if (plan.mode === 'remove') {
    lines.push('');
    lines.push('등록을 되돌려요. 매니페스트 파일은 지우지 않고 그대로 둬요.');
    lines.push(`매니페스트 ${plan.manifestPath}`);
    return lines;
  }

  lines.push(`실행 파일  ${plan.executable.path}`);
  if (!plan.executable.found) {
    lines.push(
      '           아직 없어요. cargo build --release --manifest-path apps/native-host/Cargo.toml 를 먼저 돌려 주세요.',
    );
  }
  lines.push(`매니페스트 ${plan.manifestPath}`);
  return lines;
}

/** 계획대로 실제로 고친다. --apply 가 있을 때만 부른다. */
function applyPlan(plan) {
  if (plan.mode === 'register') {
    mkdirSync(plan.manifestDir, { recursive: true });
    writeFileSync(plan.manifestPath, `${JSON.stringify(plan.manifest, null, 2)}\n`, 'utf8');
    console.log(`[apply] 매니페스트를 ${plan.manifestPath} 에 남겼어요.`);
  }

  const shown = formatCommand(plan.registryArgs);
  console.log(`[apply] ${shown}`);

  const result = spawnSync('reg', plan.registryArgs, { stdio: 'inherit', windowsHide: true });
  if (result.error) {
    console.error(`reg 명령을 실행하지 못했어요: ${result.error.message}`);
    return 1;
  }
  if (result.status !== 0) {
    console.error(`reg 명령이 ${result.status} 로 끝났어요.`);
    return result.status ?? 1;
  }
  return 0;
}

/** 계획만 보여 준다. 파일도 레지스트리도 건드리지 않는다. */
function showPlan(plan) {
  console.log('');
  console.log('[dry-run] 아무것도 바꾸지 않았어요. --apply 를 붙이면 아래대로 해요.');

  if (plan.mode === 'register') {
    console.log(`  ① 매니페스트 ${plan.manifestPath} 에 이 내용을 씁니다`);
    for (const line of JSON.stringify(plan.manifest, null, 2).split('\n')) {
      console.log(`     ${line}`);
    }
    console.log('  ② 레지스트리 명령을 실행합니다');
  } else {
    console.log('  ① 매니페스트 파일은 그대로 둡니다');
    console.log('  ② 레지스트리 값을 지웁니다');
  }
  console.log(`     ${formatCommand(plan.registryArgs)}`);
  return 0;
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

  if (!options.extensionId) {
    console.error('--extension-id 가 필요해요.');
    printUsage();
    return 1;
  }
  if (!EXTENSION_ID_PATTERN.test(options.extensionId)) {
    // 받은 값을 그대로 되뇌지 않는다. 길이와 모양만 알려 준다.
    console.error(`확장 ID 형식이 아니에요(${options.extensionId.length}자를 받았어요).`);
    console.error('Chrome 확장 ID 는 a~p 소문자 32자예요. chrome://extensions 에서 확인해 주세요.');
    return 1;
  }

  const plan = planRegistration(options);
  for (const line of describePlan(plan)) {
    console.log(line);
  }

  return options.apply ? applyPlan(plan) : showPlan(plan);
}

// 진입점 가드. `node register-host.mjs` 로 직접 돌릴 때만 움직인다.
// import 만으로 실제 CLI 가 돌아 버린 사고가 있어서 이 저장소는 이 가드를 반드시 둔다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
