#!/usr/bin/env node
// 로컬 도우미를 **릴리스로 빌드해 dist 에 옮겨 놓는** 스크립트입니다.
//
// 하는 일
//   ① cargo build --release --manifest-path apps/native-host/Cargo.toml
//   ② 만들어진 classmate-host.exe 를 installer/windows/dist/ 로 복사
//   ③ 실행 파일 옆에 함께 놓여야 할 dll 이 있으면 같이 복사
//
// winsqlite3.dll 은 왜 안 넣나
// ----------------------------
// `apps/native-host/build.rs` 가 System32 의 `winsqlite3.dll` 을 **빌드용 임시 폴더(OUT_DIR)** 로
// 한 장 복사합니다. 그것은 GNU 링커가 import 라이브러리 대신 DLL 을 보고 링크하게 하려는 것이고,
// 실행할 때 쓰이는 파일이 아닙니다. 실행할 때는 Windows 로더가 System32 의 원본을 찾습니다
// (Windows 10 1709 부터 OS 에 들어 있습니다 · `apps/native-host/README.md` §2-3).
// 그래서 dist 에는 넣지 않습니다. OS 파일을 함께 배포하면 Windows 업데이트로 고쳐진 판 대신
// 우리가 굳혀 둔 옛 판이 먼저 잡힐 수 있어 오히려 위험합니다.
// 대신 ③ 에서 **cargo 가 릴리스 폴더에 실제로 놓은 dll** 만 골라 복사합니다. 지금은 없습니다.
//
// 이 파일은 import 만으로는 아무 일도 하지 않습니다. 맨 아래 진입점 가드를 보세요.

import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import { EXE_NAME, distDir, ensureDist, repoRoot, toPosix } from './paths.mjs';

/** 빌드할 crate 의 Cargo.toml 입니다. */
export const MANIFEST_PATH = join(repoRoot, 'apps', 'native-host', 'Cargo.toml');

/** CARGO_TARGET_DIR 이 없을 때 결과가 놓이는 자리입니다. */
export function defaultTargetDir() {
  return join(repoRoot, 'apps', 'native-host', 'target');
}

/** 결과를 찾을 자리를 정합니다. 환경 변수를 먼저 봅니다(다른 단위와 target 을 나눠 쓰는 자리). */
export function resolveTargetDir(env = process.env) {
  return env.CARGO_TARGET_DIR ? resolve(env.CARGO_TARGET_DIR) : defaultTargetDir();
}

/**
 * 릴리스 실행 파일이 놓일 수 있는 자리들입니다. 앞에서부터 봅니다.
 *
 * `--target` 을 준 빌드는 타깃 이름 폴더가 한 단계 더 생깁니다. 이 저장소의 기본 툴체인이
 * `stable-x86_64-pc-windows-gnu` 라 그 이름도 함께 봅니다(register-host.mjs 와 같은 순서입니다).
 */
export function releaseCandidates(targetDir) {
  return [
    join(targetDir, 'release', EXE_NAME),
    join(targetDir, 'x86_64-pc-windows-gnu', 'release', EXE_NAME),
  ];
}

/** cargo 를 부를 수 있는 이름들입니다. PATH 에 없으면 홈의 .cargo/bin 으로 내려갑니다. */
export function cargoCandidates(env = process.env) {
  const names = [];
  if (env.CARGO) names.push(env.CARGO);
  names.push('cargo');
  names.push(join(homedir(), '.cargo', 'bin', 'cargo.exe'));
  return names;
}

/**
 * 실행 파일과 **함께 옮겨야 하는 파일**을 고릅니다. 순수 함수라 시험이 목록만 넘겨 봅니다.
 *
 * 규칙은 둘입니다.
 *   - 실행 파일 자신은 늘 넣습니다.
 *   - 같은 폴더에 cargo 가 놓은 `.dll` 이 있으면 함께 넣습니다(지금은 없습니다).
 * `.pdb` · `.d` · `.rlib` 같은 빌드 부산물과 `deps/` 같은 폴더는 넣지 않습니다.
 */
export function collectArtifacts(entries, exeName = EXE_NAME) {
  const files = entries.filter((entry) => entry.isFile).map((entry) => entry.name);
  const picked = [];
  if (files.includes(exeName)) picked.push(exeName);
  for (const name of files) {
    if (name.toLowerCase().endsWith('.dll')) picked.push(name);
  }
  return picked;
}

/** 폴더 하나를 collectArtifacts 가 읽는 모양으로 훑습니다. */
function listEntries(dir) {
  return readdirSync(dir, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    isFile: entry.isFile(),
  }));
}

/** 릴리스 빌드를 한 번 돌립니다. 성공하면 true 입니다. */
export function buildRelease(env = process.env) {
  const args = ['build', '--release', '--manifest-path', MANIFEST_PATH];
  for (const cargo of cargoCandidates(env)) {
    console.log(`실행     ${cargo} ${args.join(' ')}`);
    const result = spawnSync(cargo, args, { stdio: 'inherit', windowsHide: true, env });
    // 그 이름으로 cargo 를 못 찾았으면 다음 후보로 넘어갑니다.
    if (result.error && result.error.code === 'ENOENT') continue;
    if (result.error) {
      console.error(`cargo 를 실행하지 못했어요: ${result.error.message}`);
      return false;
    }
    return result.status === 0;
  }

  console.error('cargo 를 찾지 못했어요. PATH 에 ~/.cargo/bin 을 넣어 주세요.');
  return false;
}

function printUsage() {
  console.log(`사용법
  node installer/windows/build-host.mjs [--skip-build]

하는 일
  릴리스 빌드를 돌리고 classmate-host.exe 를 installer/windows/dist/ 로 옮깁니다.
  결과를 찾을 자리는 CARGO_TARGET_DIR 을 먼저 보고, 없으면 apps/native-host/target 입니다.

인자
  --skip-build  이미 빌드해 둔 결과를 복사만 합니다.
  --help        이 도움말.`);
}

/** 인자를 읽습니다. 모르는 인자는 조용히 넘기지 않고 오류로 세웁니다. */
export function parseArgs(argv) {
  const parsed = { skipBuild: false, help: false };
  for (const arg of argv) {
    switch (arg) {
      case '--skip-build':
        parsed.skipBuild = true;
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

export function main(argv, env = process.env) {
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

  const targetDir = resolveTargetDir(env);
  console.log(`crate    ${MANIFEST_PATH}`);
  console.log(`target   ${targetDir}${env.CARGO_TARGET_DIR ? ' (CARGO_TARGET_DIR)' : ''}`);

  if (!options.skipBuild && !buildRelease(env)) {
    console.error('릴리스 빌드에 실패했어요. 위 cargo 출력을 보세요.');
    return 1;
  }

  const exePath = releaseCandidates(targetDir).find((candidate) => existsSync(candidate));
  if (!exePath) {
    console.error('빌드는 끝났는데 실행 파일을 못 찾았어요. 본 자리:');
    for (const candidate of releaseCandidates(targetDir)) console.error(`  ${candidate}`);
    return 1;
  }

  const releaseDir = resolve(exePath, '..');
  const names = collectArtifacts(listEntries(releaseDir));
  ensureDist();

  console.log('');
  for (const name of names) {
    const from = join(releaseDir, name);
    const to = join(distDir, name);
    copyFileSync(from, to);
    console.log(`복사     ${name} (${statSync(to).size.toLocaleString('en-US')} 바이트)`);
  }
  console.log(`놓인 곳  ${toPosix(relative(repoRoot, distDir))}/`);
  console.log('');
  console.log('winsqlite3.dll 은 넣지 않았어요. Windows 10 1709+ 의 System32 에 들어 있고');
  console.log('로더가 거기서 찾습니다(apps/native-host/README.md §2-3).');
  return 0;
}

// 진입점 가드입니다. `node build-host.mjs` 로 직접 돌릴 때만 움직입니다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
