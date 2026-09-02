#!/usr/bin/env node
// dist 에 놓인 릴리스 실행 파일이 **정말 말을 주고받는지** 확인하는 스크립트입니다.
//
// 두 걸음입니다.
//   ① ping → hello   엄격히 판정합니다. 프레임이 정확히 하나여야 하고 15초를 넘기면 실패입니다.
//   ② tutor.ask      계약 (마) 모양 그대로 보내고 **돌아온 type/reason 을 보여 주기만** 합니다.
//
// ② 를 실패로 치지 않는 이유
// -------------------------
// `tutor.ask` 갈래는 지금 이 브랜치에 아직 없습니다. 단위 5·6 이 다른 자리에서 넣는 중이라
// 병합 시점에 따라 답이 세 가지로 달라집니다.
//
//   지금(갈래 없음)        error / unknown-message-type
//   단위 5 병합 뒤         error / not-implemented
//   단위 6 병합 뒤         tutor.accepted  또는  error / provider-unavailable
//
// 셋 다 "프레이밍이 통했고 호스트가 살아서 답했다" 는 뜻이라 스모크로서는 합격입니다.
// 그래서 이 스크립트는 셋을 구분해 이름을 붙여 보여 주고 종료 코드는 ① 만으로 정합니다.
//
// 프레이밍 코드는 베끼지 않고 apps/native-host/scripts/host-roundtrip.mjs 에서 그대로 가져옵니다.
// 규칙이 두 벌이 되면 언젠가 어긋나기 때문입니다.
//
// 이 파일은 import 만으로는 아무 일도 하지 않습니다. 맨 아래 진입점 가드를 보세요.

import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  ROUNDTRIP_TIMEOUT_MS,
  decodeFrames,
  encodeFrame,
  roundTrip,
} from '../../apps/native-host/scripts/host-roundtrip.mjs';
import { distExePath, repoRoot, toPosix } from './paths.mjs';

export { ROUNDTRIP_TIMEOUT_MS, encodeFrame };

/** 스모크가 쓰는 교시·질문 id 입니다. 실제 수업 자료와 섞이지 않게 smoke 라고 적어 둡니다. */
export const SMOKE_PERIOD_ID = '2026-09-02-p3';
export const SMOKE_QUESTION_ID = 'q-smoke-001';

/**
 * 계약 (마) 의 `tutor.ask` 봉투를 만듭니다. 순수 함수입니다.
 *
 *   { type, periodId, questionId, kind, word?, question?, provider, snapshot }
 *
 * `snapshot` 은 **아무 자료도 붙이지 않은 빈 봉인**입니다. 스모크는 배선만 보는 자리이고
 * 실제 전사·화면·편집기 발췌를 넣으면 그 문장이 로그로 새어 나갈 수 있기 때문입니다
 * (`docs/master-prompt.md` §4-3·§4-5). `ages` 세 칸은 "잰 적 없음" 이라 null 입니다.
 */
export function buildTutorAsk({
  periodId = SMOKE_PERIOD_ID,
  questionId = SMOKE_QUESTION_ID,
  kind = 'missed',
  word = 'new',
  provider = 'claude',
} = {}) {
  return {
    type: 'tutor.ask',
    periodId,
    questionId,
    kind,
    word,
    provider,
    snapshot: {
      transcriptSegmentIds: [],
      ages: { transcriptSec: null, screenSec: null, editorSec: null },
    },
  };
}

/** 봉투 하나를 프레임 한 개로 만듭니다. 프레이밍 규칙은 host-roundtrip.mjs 것을 그대로 씁니다. */
export function encodeAskFrame(ask = buildTutorAsk()) {
  return encodeFrame(ask);
}

/**
 * 돌아온 답이 어느 단계의 것인지 이름을 붙입니다. 순수 함수입니다.
 *
 * 판정이 아니라 **설명**입니다. 어느 것이든 스모크는 통과입니다.
 */
export function describeAskReply(reply) {
  if (!reply || typeof reply.type !== 'string') return '답을 읽지 못했어요.';
  if (reply.type === 'tutor.accepted') return '단위 6(context-builder)까지 붙어 질문을 받아들였어요.';
  if (reply.type !== 'error') return `모르는 응답 type 이에요: ${reply.type}`;
  if (reply.reason === 'unknown-message-type') return '아직 tutor.ask 갈래가 없어요(단위 5 병합 전 · 지금 브랜치의 기대값).';
  if (reply.reason === 'not-implemented') return '단위 5(host-core)까지 붙었고 알맹이는 단위 6 몫이에요.';
  if (reply.reason === 'provider-unavailable') return '갈래는 붙었는데 제공자가 지금 없어요(인증·한도 확인).';
  return `error / ${reply.reason ?? '(reason 없음)'}`;
}

/**
 * 봉투 하나를 보내고 돌아온 프레임들을 받습니다.
 *
 * `roundTrip` 은 ping 전용이라 여기서만 따로 씁니다. 프레이밍 자체는 위에서 가져온
 * `encodeFrame` · `decodeFrames` 가 하고, 이 함수는 자식을 띄우고 기다리는 몫만 합니다.
 */
export function askOnce(exePath, ask, { timeoutMs = ROUNDTRIP_TIMEOUT_MS } = {}) {
  const result = spawnSync(exePath, [], {
    input: encodeAskFrame(ask),
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
  });

  const stderr = result.stderr ? result.stderr.toString('utf8') : '';
  if (result.error && result.error.code === 'ETIMEDOUT') {
    return { ok: false, reply: null, stderr, reason: `${timeoutMs} ms 안에 끝나지 않아 멈춰 세웠어요.` };
  }
  if (result.error) {
    return { ok: false, reply: null, stderr, reason: `실행하지 못했어요: ${result.error.message}` };
  }

  let decoded;
  try {
    decoded = decodeFrames(result.stdout ?? Buffer.alloc(0));
  } catch (error) {
    return { ok: false, reply: null, stderr, reason: `응답을 읽지 못했어요: ${error.message}` };
  }
  if (decoded.frames.length === 0) {
    return { ok: false, reply: null, stderr, reason: '응답 프레임이 하나도 없어요.' };
  }
  return { ok: true, reply: decoded.frames[0], frames: decoded.frames, stderr, reason: null };
}

function printUsage() {
  console.log(`사용법
  node installer/windows/smoke-host.mjs [--exe <경로>]

하는 일
  ① ping → hello 왕복을 엄격히 확인합니다(프레임 1개 · ${ROUNDTRIP_TIMEOUT_MS} ms 상한).
  ② 계약 모양의 tutor.ask 를 보내고 돌아온 type/reason 을 보여 줍니다(판정하지 않습니다).

인자
  --exe <경로>  선택. 띄울 실행 파일. 없으면 installer/windows/dist/classmate-host.exe 입니다.
  --help        이 도움말.`);
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

  const exePath = options.exe ? resolve(options.exe) : distExePath;
  if (!existsSync(exePath)) {
    console.error(`실행 파일이 없어요: ${exePath}`);
    console.error('node installer/windows/build-host.mjs 를 먼저 돌려 주세요.');
    return 1;
  }

  console.log(`실행 파일  ${toPosix(relative(repoRoot, exePath))}`);
  console.log('');

  // ── ① ping → hello (판정합니다) ─────────────────────────────────────────
  const ping = roundTrip(exePath);
  if (!ping.ok) {
    console.error(`① ping 왕복 실패 · ${ping.reason}`);
    if (ping.reply) console.error(`   받은 응답 ${JSON.stringify(ping.reply)}`);
    if (ping.stderr.trim()) console.error(`   호스트 로그\n${ping.stderr.trim()}`);
    return 1;
  }
  console.log(`① ping → ${JSON.stringify(ping.reply)}`);
  console.log('   프레임 1개 · 계약대로예요.');
  console.log('');

  // ── ② tutor.ask (보여 주기만 합니다) ────────────────────────────────────
  const ask = buildTutorAsk();
  const askFrame = encodeAskFrame(ask);
  console.log(`② tutor.ask 보냄 (${askFrame.length} 바이트 프레임 · kind=${ask.kind} provider=${ask.provider})`);

  const answer = askOnce(exePath, ask);
  if (!answer.ok) {
    // 여기도 실패로 치지 않습니다. 무엇을 못 봤는지만 알려 줍니다.
    console.log(`   응답 없음 · ${answer.reason}`);
    if (answer.stderr.trim()) console.log(`   호스트 로그 ${answer.stderr.trim().split('\n')[0]}`);
  } else {
    const { type, reason } = answer.reply;
    console.log(`   type=${type}${reason ? ` reason=${reason}` : ''}`);
    console.log(`   ${describeAskReply(answer.reply)}`);
  }

  console.log('');
  console.log('스모크 통과 · 판정은 ① 만으로 합니다. ② 는 병합 상태를 보여 주는 자리예요.');
  return 0;
}

// 진입점 가드입니다. `node smoke-host.mjs` 로 직접 돌릴 때만 움직입니다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
