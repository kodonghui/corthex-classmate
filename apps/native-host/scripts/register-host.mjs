#!/usr/bin/env node
// Corthex Classmate 로컬 도우미를 Chrome 에 알리는 스크립트.
//
// Chrome 은 Native Messaging 호스트를 두 조각으로 찾는다.
//   ① 매니페스트 JSON — 호스트 이름 · 실행 파일 절대 경로 · 허용할 확장 ID
//   ② 레지스트리 값   — 그 매니페스트 파일의 절대 경로
// 이 스크립트는 ①을 항상 쓰고, ②는 --apply 가 있을 때만 건드린다.
//
// 지키는 경계
// - HKCU 만 쓴다. HKLM(모든 사용자)은 관리자 권한이 필요하고 다른 사용자에게도 영향을 주므로 쓰지 않는다.
// - 만들어진 매니페스트는 PC 마다 경로와 확장 ID 가 달라 커밋하지 않는다(apps/native-host/.gitignore).
// - 실행 파일 경로는 인자로만 정한다. 매니페스트나 레지스트리에서 읽어 와 실행하지 않는다.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HOST_NAME = 'com.corthex.classmate';

// 레지스트리 경로는 역슬래시가 많아 조각으로 두고 이어 붙인다(이스케이프 실수를 줄인다).
const REGISTRY_KEY = ['HKCU', 'Software', 'Google', 'Chrome', 'NativeMessagingHosts', HOST_NAME].join('\\');

const MANIFEST_DESCRIPTION = 'Corthex Classmate 사이드패널이 이 PC 의 로컬 도우미와 주고받는 통로예요';

// Chrome 확장 ID 는 32자이고 a~p 만 쓴다(16진수 0~f 를 a~p 로 옮긴 표기).
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const crateDir = resolve(scriptDir, '..');
const repoRoot = resolve(crateDir, '..', '..');
const manifestPath = join(crateDir, 'manifest', `${HOST_NAME}.json`);

// 릴리스 실행 파일을 찾는 순서. GNU 타깃을 먼저 보고, 없으면 기본 타깃으로 내려간다.
// 저장소 루트를 먼저 보되, 이 crate 는 자기 워크스페이스라 실제 결과물은 보통 마지막 두 후보에 놓인다.
const EXECUTABLE_CANDIDATES = [
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
  --apply              선택. 실제로 레지스트리를 고친다. 없으면 실행할 명령만 보여 준다.
  --remove             선택. 등록을 되돌린다(--apply 와 함께 써야 실제로 지운다).
  --help               이 도움말.`);
}

/** 인자를 읽는다. 모르는 인자는 조용히 넘기지 않고 오류로 세운다. */
function parseArgs(argv) {
    const parsed = { extensionId: null, exe: null, apply: false, remove: false, help: false };

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
function resolveExecutable(explicit) {
    if (explicit) {
        const path = resolve(explicit);
        return { path, found: existsSync(path) };
    }

    const found = EXECUTABLE_CANDIDATES.find((candidate) => existsSync(candidate));
    return { path: found ?? EXECUTABLE_CANDIDATES[0], found: Boolean(found) };
}

function buildManifest(extensionId, executablePath) {
    return {
        name: HOST_NAME,
        description: MANIFEST_DESCRIPTION,
        path: executablePath,
        type: 'stdio',
        allowed_origins: [`chrome-extension://${extensionId}/`],
    };
}

/** 보여 주기용으로 명령 한 줄을 만든다. 공백이나 역슬래시가 있으면 따옴표로 감싼다. */
function formatCommand(args) {
    const quoted = args.map((arg) => (/[\s\\]/.test(arg) ? `"${arg}"` : arg));
    return ['reg', ...quoted].join(' ');
}

/** 레지스트리 명령을 실행하거나(apply), 실행할 명령만 보여 준다(dry-run). */
function runRegistry(args, apply) {
    const shown = formatCommand(args);

    if (!apply) {
        console.log('');
        console.log('[dry-run] 실제로 실행하지 않았어요. --apply 를 붙이면 아래 명령이 실행돼요.');
        console.log(`  ${shown}`);
        return 0;
    }

    console.log('');
    console.log(`[apply] ${shown}`);
    const result = spawnSync('reg', args, { stdio: 'inherit', windowsHide: true });

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

function main(argv) {
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
        console.error(`확장 ID 형식이 아니에요: ${options.extensionId}`);
        console.error('Chrome 확장 ID 는 a~p 소문자 32자예요. chrome://extensions 에서 확인해 주세요.');
        return 1;
    }

    console.log(`호스트     ${HOST_NAME}`);
    console.log(`레지스트리 ${REGISTRY_KEY}`);
    console.log(`확장 ID    ${options.extensionId}`);

    if (options.remove) {
        console.log('');
        console.log('등록을 되돌려요. 매니페스트 파일은 지우지 않고 그대로 둬요.');
        console.log(`매니페스트 ${manifestPath}`);
        return runRegistry(['delete', REGISTRY_KEY, '/f'], options.apply);
    }

    const executable = resolveExecutable(options.exe);
    const manifest = buildManifest(options.extensionId, executable.path);

    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    console.log(`실행 파일  ${executable.path}`);
    if (!executable.found) {
        console.log('           아직 없어요. cargo build --release --manifest-path apps/native-host/Cargo.toml 를 먼저 돌려 주세요.');
    }
    console.log(`매니페스트 ${manifestPath} 에 남겼어요.`);

    return runRegistry(['add', REGISTRY_KEY, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f'], options.apply);
}

process.exitCode = main(process.argv.slice(2));
