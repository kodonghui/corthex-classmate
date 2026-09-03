#!/usr/bin/env node
// 실제 제공자 CLI 를 **딱 한 번** 부르는, 사람이 직접 돌리는 스크립트입니다.
//
// smoke-host.mjs 와 정반대 자리입니다.
//   smoke-host.mjs  : 자식 환경에서 CLASSMATE_CLAUDE_CLI 를 지워 절대 돈을 쓰지 않습니다.
//   ask-once.mjs    : CLASSMATE_CLAUDE_CLI 를 자식에게 **넘겨서** 진짜 답이 오는지 봅니다. 구독 한도를 씁니다(ANTHROPIC_API_KEY 가 있으면 과금).
//
// 그래서 세 겹으로 막아 둡니다.
//   ① `--i-accept-cost` 가 없으면 아무것도 띄우지 않고 1 로 끝납니다.
//   ② 자동화(시험 · 체크포인트 · loop · 에이전트)는 이 파일을 돌리지 않습니다. `ask-once.test.mjs`
//      는 순수 함수만 봅니다. 진입점 가드가 있어 import 만으로는 아무 일도 하지 않습니다.
//   ③ 교시 id 는 실제 수업과 겹칠 수 없는 1999 년이고, 저장 폴더는 기본이 임시 폴더라
//      오늘 교시 파일에 시험 질문이 섞이지 않습니다(`--data-dir` 로 바꿀 수 있습니다).
//
// 프레이밍 · 봉투는 다른 스크립트 것을 그대로 가져옵니다(규칙이 두 벌이 되지 않게).
//   encodeFrame · decodeFrames  ← apps/native-host/scripts/host-roundtrip.mjs
//   buildTutorAsk               ← installer/windows/smoke-host.mjs
//
// 사용 (PowerShell · 저장소 루트)
//   $env:CLASSMATE_CLAUDE_CLI = "C:\Users\<이름>\AppData\Roaming\npm\claude.cmd"
//   node installer/windows/ask-once.mjs --i-accept-cost --word 생성자
//
// 무엇이 보이나
//   tutor.accepted → tutor.event question.asked → tutor.event answer.completed(한 줄 답)
//   제공자가 실패하면 answer.failed → answer.queued → (5·15·45초 뒤) answer.recovered 또는 끝.

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

import { decodeFrames, encodeFrame } from '../../apps/native-host/scripts/host-roundtrip.mjs';
import { buildTutorAsk } from './smoke-host.mjs';
import { distExePath, repoRoot, toPosix } from './paths.mjs';

/** 스모크(1999-01-01-p1)와도, 실제 수업과도 겹치지 않는 교시 id 입니다. */
export const ASK_ONCE_PERIOD_ID = '1999-01-02-p1';
export const ASK_ONCE_QUESTION_ID = 'q-ask-once-001';
/** 이 플래그가 없으면 아무것도 띄우지 않습니다. */
export const COST_FLAG = '--i-accept-cost';
/** 제공자 CLI 경로를 읽는 환경 변수 이름 — 정본은 `apps/native-host/src/router.rs` 의 `TutorSources`. */
export const CLI_ENV_NAME = 'CLASSMATE_CLAUDE_CLI';
export const MODEL_ENV_NAME = 'CLASSMATE_TUTOR_MODEL';
/**
 * 답을 기다리는 상한입니다. 제공자 요청 45초 + 자동 재시도 5·15·45초 + 여유.
 * 넘기면 자식을 끊고 2 로 끝납니다.
 */
export const ANSWER_TIMEOUT_MS = 180_000;
/** 이 사건이 오면 더 기다리지 않습니다. `answer.failed` 는 재시도가 남아 있어 기다립니다. */
export const FINAL_EVENT_TYPES = ['answer.completed', 'answer.recovered'];

/** 인자를 읽습니다. 모르는 인자는 오류입니다. */
export function parseArgs(argv) {
  const parsed = {
    accept: false,
    cli: null,
    word: '생성자',
    question: null,
    kind: 'missed',
    model: null,
    dataDir: null,
    exe: null,
    timeoutMs: ANSWER_TIMEOUT_MS,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} 뒤에 값이 필요해요.`);
      index += 1;
      return value;
    };
    switch (arg) {
      case COST_FLAG:
        parsed.accept = true;
        break;
      case '--cli':
        parsed.cli = next();
        break;
      case '--word':
        parsed.word = next();
        break;
      case '--question':
        parsed.question = next();
        break;
      case '--kind':
        parsed.kind = next();
        break;
      case '--model':
        parsed.model = next();
        break;
      case '--data-dir':
        parsed.dataDir = next();
        break;
      case '--exe':
        parsed.exe = next();
        break;
      case '--timeout-ms':
        parsed.timeoutMs = Number(next());
        if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs <= 0) throw new Error('--timeout-ms 는 양수여야 해요.');
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

/**
 * 자식에게 넘길 환경입니다. 순수 함수입니다.
 *
 * 스모크와 반대로 `CLASSMATE_CLAUDE_CLI` 를 **넣습니다.** 다만 값은 인자로 받은 것 하나뿐이고,
 * `CLASSMATE_CODEX_CLI` 는 지웁니다(이 스크립트는 claude 한 번만 봅니다). 모델은 주면 넣고,
 * 저장 폴더는 반드시 넘겨받은 것으로 덮어씁니다.
 */
export function buildAskEnv(baseEnv, { cli, model = null, dataDir }) {
  if (!cli) throw new Error('cli 경로가 비었어요.');
  if (!dataDir) throw new Error('dataDir 이 비었어요.');
  const env = { ...baseEnv };
  env[CLI_ENV_NAME] = cli;
  delete env.CLASSMATE_CODEX_CLI;
  if (model) env[MODEL_ENV_NAME] = model;
  else delete env[MODEL_ENV_NAME];
  env.CLASSMATE_DATA_DIR = dataDir;
  return env;
}

/** 계약 (마) 봉투. `question` 을 주면 `word` 대신 문장으로 묻습니다. */
export function buildAsk({ word, question = null, kind = 'missed' } = {}) {
  const ask = buildTutorAsk({
    periodId: ASK_ONCE_PERIOD_ID,
    questionId: ASK_ONCE_QUESTION_ID,
    kind,
    word,
    provider: 'claude',
  });
  if (question) ask.question = question;
  return ask;
}

/** 프레임 하나를 사람이 읽을 한 줄로 만듭니다. 순수 함수입니다. */
export function describeFrame(frame) {
  if (!frame || typeof frame.type !== 'string') return '읽을 수 없는 프레임';
  if (frame.type === 'tutor.accepted') return `tutor.accepted · 질문 ${frame.questionId} 을 받아들였어요`;
  if (frame.type === 'error') return `error / ${frame.reason ?? '(reason 없음)'} · ${frame.message ?? ''}`.trim();
  if (frame.type === 'tutor.event') {
    const event = frame.event ?? {};
    const payload = event.payload ?? {};
    const head = `tutor.event ${event.type ?? '?'}`;
    if (payload.answer && payload.answer.conclusion) {
      return `${head} · "${payload.answer.conclusion}" (${payload.evidence ?? ''} · ${payload.provider ?? ''})`.replace(/\s+\(\s*·\s*\)/, '');
    }
    if (payload.message) return `${head} · ${payload.message}`;
    if (payload.connector) return `${head} · ${payload.connector} ${payload.state ?? ''} ${payload.reason ?? ''}`.trim();
    return head;
  }
  return `모르는 type ${frame.type}`;
}

/** 이 프레임이 오면 기다림을 끝냅니다. 순수 함수입니다. */
export function isFinal(frame) {
  if (!frame) return false;
  if (frame.type === 'error') return true;
  return frame.type === 'tutor.event' && FINAL_EVENT_TYPES.includes(frame.event?.type);
}

/** 받은 프레임 전체로 결과를 판정합니다. 순수 함수입니다. */
export function verdict(frames, timedOut) {
  const events = frames.filter((f) => f.type === 'tutor.event').map((f) => f.event?.type);
  if (events.includes('answer.completed')) return { ok: true, label: '한 번에 답이 왔어요' };
  if (events.includes('answer.recovered')) return { ok: true, label: '한 번 실패한 뒤 재시도로 답이 왔어요' };
  const error = frames.find((f) => f.type === 'error');
  if (error) return { ok: false, label: `호스트가 거절했어요: ${error.reason ?? '?'}` };
  if (events.includes('answer.failed')) return { ok: false, label: timedOut ? '실패 뒤 재시도가 상한 안에 끝나지 않았어요' : '실패했고 재시도도 답을 못 냈어요' };
  if (timedOut) return { ok: false, label: '상한 안에 아무 답도 오지 않았어요' };
  return { ok: false, label: '답 사건 없이 호스트가 끝났어요' };
}

/**
 * 실행 파일을 띄워 봉투 하나를 보내고 답 사건이 올 때까지 기다립니다.
 *
 * stdin 은 답이 오거나 상한이 지나면 닫습니다. 호스트는 stdin 이 닫히면 하던 물음을 마치고
 * 끝나므로(최대 45초) 그 뒤 잠깐 더 기다렸다가 자식이 안 끝나면 끊습니다.
 */
export function askForReal(exePath, ask, env, { timeoutMs = ANSWER_TIMEOUT_MS, onFrame = () => {} } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(exePath, [], { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const frames = [];
    let pending = Buffer.alloc(0);
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(killer);
      resolvePromise({ frames, stderr, timedOut, exitCode });
    };
    const closeInput = () => { try { child.stdin.end(); } catch { /* 이미 닫힘 */ } };
    let killer = null;
    const timer = setTimeout(() => {
      timedOut = true;
      closeInput();
      killer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* 이미 끝남 */ } }, 5_000);
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      let decoded;
      try {
        decoded = decodeFrames(pending);
      } catch (error) {
        stderr += `\n[ask-once] 응답을 읽지 못했어요: ${error.message}`;
        closeInput();
        return;
      }
      pending = decoded.rest;
      for (const frame of decoded.frames) {
        frames.push(frame);
        onFrame(frame);
        if (isFinal(frame)) {
          closeInput();
          killer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* 이미 끝남 */ } }, 60_000);
        }
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', (error) => { stderr += `\n[ask-once] 실행하지 못했어요: ${error.message}`; finish(null); });
    child.on('close', (code) => finish(code));

    child.stdin.write(encodeFrame(ask));
  });
}

function printUsage() {
  console.log(`사용법 (사람만 · 구독 한도를 씁니다)
  node installer/windows/ask-once.mjs ${COST_FLAG} [--word <낱말> | --question <문장>] [--cli <경로>] [--model <이름>]

하는 일
  dist/classmate-host.exe 를 띄워 계약 모양의 tutor.ask 를 한 번 보내고, 도우미가 실제 제공자 CLI 를
  불러 만든 답 사건(tutor.event)을 보여 줍니다. 교시 id 는 ${ASK_ONCE_PERIOD_ID}, 저장 폴더는 임시 폴더입니다.

인자
  ${COST_FLAG}   필수. 없으면 아무것도 띄우지 않습니다.
  --cli <경로>      선택. 제공자 CLI 절대 경로. 없으면 환경 변수 ${CLI_ENV_NAME} 을 씁니다.
  --word <낱말>     선택. 붙잡은 낱말(기본 "생성자").
  --question <문장> 선택. 낱말 대신 문장으로 묻습니다.
  --kind <종류>     선택. 기본 missed.
  --model <이름>    선택. ${MODEL_ENV_NAME} 로 넘깁니다. 없으면 CLI 기본값.
  --data-dir <폴더> 선택. 세션 파일을 남길 곳. 없으면 임시 폴더를 만들고 끝나면 지웁니다.
  --exe <경로>      선택. 실행 파일. 없으면 installer/windows/dist/classmate-host.exe.
  --timeout-ms <n>  선택. 기본 ${ANSWER_TIMEOUT_MS}.
  --help            이 도움말.`);
}

export async function main(argv, { env = process.env } = {}) {
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
  if (!options.accept) {
    console.error(`${COST_FLAG} 가 없어 아무것도 띄우지 않았어요. 이 스크립트는 실제 제공자를 불러 구독 한도(API 키가 있으면 돈)를 씁니다.`);
    console.error(`읽고 동의하면 ${COST_FLAG} 를 붙여 다시 돌려 주세요.`);
    return 1;
  }

  const exePath = options.exe ? resolve(options.exe) : distExePath;
  if (!existsSync(exePath)) {
    console.error(`실행 파일이 없어요: ${exePath}`);
    console.error('node installer/windows/build-host.mjs 를 먼저 돌려 주세요.');
    return 1;
  }
  const cli = options.cli ?? env[CLI_ENV_NAME] ?? null;
  if (!cli) {
    console.error(`제공자 CLI 경로가 없어요. --cli <경로> 를 주거나 ${CLI_ENV_NAME} 환경 변수를 두세요.`);
    return 1;
  }
  if (!isAbsolute(cli) || !existsSync(cli)) {
    console.error(`제공자 CLI 는 실재하는 절대 경로여야 해요: ${cli}`);
    return 1;
  }

  const ask = buildAsk({ word: options.word, question: options.question, kind: options.kind });
  const ownDataDir = !options.dataDir;
  const dataDir = options.dataDir ? resolve(options.dataDir) : mkdtempSync(join(tmpdir(), 'classmate-ask-once-'));
  const childEnv = buildAskEnv(env, { cli, model: options.model, dataDir });

  console.log(`실행 파일  ${toPosix(relative(repoRoot, exePath))}`);
  console.log(`제공자 CLI ${cli}${options.model ? ` · 모델 ${options.model}` : ' · 모델은 CLI 기본값'}`);
  console.log(`교시       ${ask.periodId} · 저장 폴더 ${dataDir}${ownDataDir ? ' (끝나면 지움)' : ''}`);
  console.log(`질문       kind=${ask.kind} ${ask.question ? `question="${ask.question}"` : `word="${ask.word}"`} · 전사·화면·편집기 자료는 없음`);
  console.log('');
  console.log('실제 제공자를 부릅니다. 구독 한도를 씁니다(API 키가 있으면 과금). 답 사건이 오면 자동으로 끝납니다.');
  console.log('');

  const started = Date.now();
  let result;
  try {
    result = await askForReal(exePath, ask, childEnv, {
      timeoutMs: options.timeoutMs,
      onFrame: (frame) => console.log(`  +${((Date.now() - started) / 1000).toFixed(1)}s  ${describeFrame(frame)}`),
    });
  } finally {
    if (ownDataDir) rmSync(dataDir, { recursive: true, force: true });
  }

  const summary = verdict(result.frames, result.timedOut);
  console.log('');
  console.log(`${summary.ok ? '성공' : '실패'} · ${summary.label} · 프레임 ${result.frames.length}개 · ${((Date.now() - started) / 1000).toFixed(1)}s`);
  const answer = [...result.frames].reverse().find((f) => f.type === 'tutor.event' && f.event?.payload?.answer);
  if (answer) {
    console.log('');
    console.log(JSON.stringify(answer.event.payload.answer, null, 2));
  }
  if (!summary.ok && result.stderr.trim()) {
    console.log('');
    console.log('호스트 로그');
    console.log(result.stderr.trim().split('\n').slice(-12).join('\n'));
  }
  return summary.ok ? 0 : 2;
}

// 진입점 가드입니다. `node ask-once.mjs` 로 직접 돌릴 때만 움직입니다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
