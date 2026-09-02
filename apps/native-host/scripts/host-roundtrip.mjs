#!/usr/bin/env node
// 로컬 도우미 실행 파일과 실제로 한 번 주고받아 보는 왕복 확인 스크립트입니다.
//
// 하는 일
//   ① 실행 파일을 찾습니다(--exe 로 직접 주거나, 없으면 cargo build 로 만듭니다)
//   ② 프레임으로 감싼 {"type":"ping"} 을 자식 프로세스 stdin 에 씁니다
//   ③ stdout 에서 프레임 하나를 읽어 type 이 hello 인지 봅니다
// 맞으면 0, 아니면 1 로 끝납니다.
//
// 프레이밍은 Rust 쪽 crates/transport/src/framing.rs 와 같은 규칙입니다.
// 리틀엔디언 4바이트 길이 + 그 길이만큼의 UTF-8 JSON 입니다.
//
// 지키는 경계
// - 이 스크립트는 인자로 받은 실행 파일만 띄웁니다. 프레임 안의 문자열을 명령으로 쓰지 않습니다.
// - 자식이 stderr 로 내보내는 사람용 로그는 실패했을 때만 그대로 보여 줍니다.
// - 자식이 끝나지 않아도 ROUNDTRIP_TIMEOUT_MS 에서 멈춰 세웁니다. 사람이 눈으로 보는
//   도구라 대답 없이 멈춰 있는 것이 곧 판정 불능이기 때문입니다.
// - 이 파일은 import 만으로는 아무 일도 하지 않습니다. 맨 아래 진입점 가드를 보세요.

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const crateDir = resolve(scriptDir, '..');
const manifestPath = join(crateDir, 'Cargo.toml');

/** 한 메시지 본문의 상한입니다. Rust 쪽 MAX_MESSAGE_BYTES 와 같은 값입니다. */
export const MAX_MESSAGE_BYTES = 1024 * 1024;

/** 길이 헤더의 바이트 수입니다. */
export const HEADER_BYTES = 4;

/** 호스트가 ping 에 답하는 이름입니다. src/main.rs 의 respond() 와 같아야 합니다. */
export const PING_REPLY_TYPE = 'hello';

/** 자식이 이 시간 안에 끝나지 않으면 멈춰 세웁니다. 왕복 한 번에 넉넉한 값입니다. */
export const ROUNDTRIP_TIMEOUT_MS = 15_000;

const isWindows = process.platform === 'win32';
const exeName = isWindows ? 'classmate-host.exe' : 'classmate-host';

/** 값 하나를 프레임 한 개(길이 헤더 + 본문)로 만듭니다. */
export function encodeFrame(value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  if (body.length > MAX_MESSAGE_BYTES) {
    throw new Error(`본문 ${body.length} 바이트가 상한 ${MAX_MESSAGE_BYTES} 바이트를 넘었어요.`);
  }

  const header = Buffer.alloc(HEADER_BYTES);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

/**
 * 바이트 뭉치에서 온전한 프레임들을 꺼냅니다.
 *
 * 돌려주는 것: { frames: [값들], rest: 아직 모자란 나머지 바이트 }
 * 길이만 있고 본문이 덜 온 꼬리는 rest 에 남깁니다.
 */
export function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (buffer.length - offset >= HEADER_BYTES) {
    const declared = buffer.readUInt32LE(offset);
    if (declared > MAX_MESSAGE_BYTES) {
      throw new Error(`본문 ${declared} 바이트가 상한 ${MAX_MESSAGE_BYTES} 바이트를 넘었어요.`);
    }
    if (buffer.length - offset - HEADER_BYTES < declared) break;

    const start = offset + HEADER_BYTES;
    const body = buffer.subarray(start, start + declared).toString('utf8');
    frames.push(JSON.parse(body));
    offset = start + declared;
  }

  return { frames, rest: buffer.subarray(offset) };
}

/** 인자를 읽습니다. 모르는 인자는 조용히 넘기지 않고 오류로 세웁니다. */
export function parseArgs(argv) {
  const parsed = { exe: null, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--exe':
        parsed.exe = argv[index + 1] ?? null;
        index += 1;
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

/** 개발 빌드 결과가 놓일 수 있는 자리들입니다. CARGO_TARGET_DIR 을 먼저 봅니다. */
export function executableCandidates(env = process.env) {
  const candidates = [];
  if (env.CARGO_TARGET_DIR) {
    candidates.push(join(env.CARGO_TARGET_DIR, 'debug', exeName));
  }
  candidates.push(join(crateDir, 'target', 'debug', exeName));
  return candidates;
}

/** 이미 만들어져 있는 실행 파일을 찾습니다. 없으면 null 입니다. */
export function findExecutable(env = process.env) {
  return executableCandidates(env).find((candidate) => existsSync(candidate)) ?? null;
}

/** cargo 를 부를 수 있는 이름들입니다. PATH 에 없으면 홈의 .cargo/bin 으로 내려갑니다. */
function cargoCandidates() {
  const names = [];
  if (process.env.CARGO) names.push(process.env.CARGO);
  names.push('cargo');
  names.push(join(homedir(), '.cargo', 'bin', isWindows ? 'cargo.exe' : 'cargo'));
  return names;
}

/** 개발 빌드를 한 번 돌립니다. 성공하면 true 입니다. */
export function buildHost() {
  for (const cargo of cargoCandidates()) {
    const result = spawnSync(cargo, ['build', '--manifest-path', manifestPath], {
      stdio: 'inherit',
      windowsHide: true,
    });
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

/**
 * 실행 파일 하나와 한 번 주고받습니다.
 *
 * 돌려주는 것: { ok, reply, stderr, reason }
 *
 * 두 번째 인자는 **시험 전용**입니다. main() 은 넘기지 않습니다.
 * - args       자식에게 줄 인자. 시험이 node 로 만든 가짜 호스트를 띄울 때만 씁니다.
 * - timeoutMs  기다릴 상한. 넘기면 자식을 멈춰 세우고 실패로 돌려줍니다.
 */
export function roundTrip(exePath, { args = [], timeoutMs = ROUNDTRIP_TIMEOUT_MS } = {}) {
  const result = spawnSync(exePath, args, {
    input: encodeFrame({ type: 'ping' }),
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
  });

  const stderr = result.stderr ? result.stderr.toString('utf8') : '';

  // 상한을 넘겨 멈춰 세운 경우입니다. 실행 실패와 구별해서 알려 줍니다.
  if (result.error && result.error.code === 'ETIMEDOUT') {
    return {
      ok: false,
      reply: null,
      stderr,
      reason: `호스트가 ${timeoutMs} ms 안에 끝나지 않아 멈춰 세웠어요.`,
    };
  }
  if (result.error) {
    return { ok: false, reply: null, stderr, reason: `실행하지 못했어요: ${result.error.message}` };
  }
  if (result.status !== 0) {
    return { ok: false, reply: null, stderr, reason: `호스트가 ${result.status} 로 끝났어요.` };
  }

  let decoded;
  try {
    decoded = decodeFrames(result.stdout ?? Buffer.alloc(0));
  } catch (error) {
    return { ok: false, reply: null, stderr, reason: `응답을 읽지 못했어요: ${error.message}` };
  }

  if (decoded.frames.length !== 1) {
    return {
      ok: false,
      reply: null,
      stderr,
      reason: `응답 프레임이 ${decoded.frames.length} 개예요. 하나여야 해요.`,
    };
  }
  if (decoded.rest.length !== 0) {
    return {
      ok: false,
      reply: decoded.frames[0],
      stderr,
      reason: `프레임 뒤에 ${decoded.rest.length} 바이트가 남았어요.`,
    };
  }

  const reply = decoded.frames[0];
  if (reply?.type !== PING_REPLY_TYPE) {
    return { ok: false, reply, stderr, reason: `type 이 ${PING_REPLY_TYPE} 이(가) 아니에요.` };
  }

  return { ok: true, reply, stderr, reason: null };
}

function printUsage() {
  console.log(`사용법
  node apps/native-host/scripts/host-roundtrip.mjs [--exe <경로>]

인자
  --exe <경로>  선택. 띄울 실행 파일. 없으면 개발 빌드를 찾고, 없으면 cargo build 로 만듭니다.
  --help        이 도움말.`);
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

  let exePath = options.exe ? resolve(options.exe) : findExecutable();
  if (options.exe && !existsSync(exePath)) {
    console.error(`--exe 로 준 실행 파일이 없어요: ${exePath}`);
    return 1;
  }

  if (!exePath) {
    console.log('개발 빌드가 없어서 cargo build 로 먼저 만들어요.');
    if (!buildHost()) {
      console.error('빌드에 실패했어요.');
      return 1;
    }
    exePath = findExecutable();
    if (!exePath) {
      console.error(`빌드는 됐는데 실행 파일을 못 찾았어요: ${executableCandidates().join(', ')}`);
      return 1;
    }
  }

  console.log(`실행 파일  ${exePath}`);
  console.log(`보내는 것  {"type":"ping"} (${encodeFrame({ type: 'ping' }).length} 바이트 프레임)`);

  const result = roundTrip(exePath);
  if (!result.ok) {
    console.error(`왕복 실패 · ${result.reason}`);
    if (result.reply) console.error(`받은 응답  ${JSON.stringify(result.reply)}`);
    if (result.stderr.trim()) console.error(`호스트 로그\n${result.stderr.trim()}`);
    return 1;
  }

  console.log(`받은 것    ${JSON.stringify(result.reply)}`);
  console.log('왕복 성공 · 프레이밍과 응답이 계약대로예요.');
  return 0;
}

// 진입점 가드입니다. `node host-roundtrip.mjs` 로 직접 돌릴 때만 움직입니다.
// import 만으로 실제 CLI 가 돌아 버린 사고가 있어서 이 저장소는 이 가드를 반드시 둡니다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
