#!/usr/bin/env node
// 가짜 CLI — classmate-host 의 튜터 파이프라인 시험이 자식 프로세스로 띄우는 프로그램입니다.
//
// 실제 튜터 CLI 는 이 저장소의 어떤 시험에서도 실행되지 않습니다. Gate C2 에서 검증 스크립트가
// 모듈을 import 했다는 이유만으로 실제 호출 5회가 나가 승인 없이 1.251323 USD 를 쓴 사고가 있었고,
// 그 뒤로 시험은 저장소 안의 가짜 CLI 만 띄웁니다(docs/spikes/gate-c2-provider.md).
// `crates/providers/tests/fake-claude.mjs` 와 형제이지만 그 파일은 제공자 크레이트의 것이라
// 고치지 않고, 파이프라인 시험이 필요로 하는 모드를 여기에 따로 두었습니다.
//
// 흉내 내는 것은 `--output-format stream-json --verbose` 의 줄 단위 출력입니다.
//
//   {"type":"system","subtype":"init","model":"…"}
//   {"type":"assistant","message":{"content":[{"type":"text","text":"<답 JSON>"}]}}
//   {"type":"result","subtype":"success","duration_ms":…,"total_cost_usd":0,"result":"<답 JSON>"}
//
// 옵션 (시험이 넘깁니다)
//   --answer-file <경로>   그 파일 내용을 답 본문으로 그대로 내보냅니다.
//   --dump-stdin <경로>    받은 stdin 본문과 자기 argv 를 JSON 파일로 남깁니다(시험 대조용).
//   --state-file <경로>    몇 번째 호출인지 세는 파일입니다. --fail-times 와 함께 씁니다.
//   --fail-times <n>       상태 파일 기준 앞의 n 번은 실패하고 그다음부터 성공합니다.
//   --fail                 stderr 배너를 남기고 종료 코드 1 로 끝납니다.
//   --hang                 stdin 을 다 읽고 아무것도 내보내지 않은 채 버팁니다(타임아웃 유도).
//   --delay-ms <n>         호출 수를 센 뒤 n 밀리초 자고 나서 답을 내보냅니다(회차를 늦춥니다).
//   --bad-json             JSON 이 아닌 글을 답으로 내보냅니다(파싱 실패 유도).
//   --too-long             conclusion 이 41자인 답을 내보냅니다(계약 검사 실패 유도).
//   --partial              답 JSON 을 stream_event 청크 여러 개로 쪼개 먼저 흘립니다.
//                          실제 CLI 처럼 `--include-partial-messages` 를 실제로 받았을 때만 흘립니다.
//   --session              stdin 을 줄 단위로 읽어 **한 줄마다** 답 한 벌을 냅니다. 프로세스는
//                          stdin 이 닫힐 때까지 살아 있습니다(SessionClaudeProvider 시험용).
//   --spawn-file <경로>    프로세스가 뜰 때마다 그 파일의 숫자를 하나 올립니다. 시험이
//                          "질문 세 번에 spawn 몇 회인가" 를 세는 자리입니다.
//
// stdin 으로 들어온 프롬프트는 **절대 실행하지 않습니다**(불변 원칙 §4-7).
// 본문을 파일로 남기는 것은 "질문·전사는 argv 가 아니라 stdin 으로 왔는가" 를 시험이 대조하려고
// 만든 **시험 전용 통로**이며 실제 CLI 의 동작이 아닙니다.

import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'

const MODEL = 'fake-tutor-model'

// 계약(answer.schema.json)을 통과하는 기본 답입니다. 다섯 칸 가운데 세 칸이 필수입니다.
const DEFAULT_ANSWER = JSON.stringify({
  conclusion: '생성 책임을 나눠서 바꿔 끼울 수 있어요',
  evidence: 'confirmed',
  chips: ['더 쉽게', '지금 화면 코드'],
  nowLine: '지금 · 생성자 주입 코드로 넘어갔어요',
})

// conclusion 이 41자라 계약(40자 이내)에 걸립니다.
const TOO_LONG_ANSWER = JSON.stringify({
  conclusion: '가'.repeat(41),
  evidence: 'confirmed',
  chips: ['더 쉽게', '지금 화면 코드'],
})

function emit(object) {
  process.stdout.write(JSON.stringify(object) + '\n')
}

// 부분 스트리밍 청크 한 줄입니다. 실제 CLI 가 `--include-partial-messages` 에서 내는 모양이며
// `crates/providers/tests/fake-claude.mjs` 의 같은 함수와 같은 모양을 씁니다.
function emitPartialChunk(text) {
  emit({
    type: 'stream_event',
    event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  })
}

/** 글을 size 글자씩 잘라 조각 목록으로 만듭니다. 결론이 조각 경계에 걸치게 하려는 것입니다. */
function sliceInto(text, size) {
  const pieces = []
  for (let at = 0; at < text.length; at += size) pieces.push(text.slice(at, at + size))
  return pieces
}

function valueAfter(argv, flag) {
  const at = argv.indexOf(flag)
  return at === -1 ? null : argv[at + 1]
}

function readArgs(argv) {
  return {
    answerFile: valueAfter(argv, '--answer-file'),
    dumpStdin: valueAfter(argv, '--dump-stdin'),
    stateFile: valueAfter(argv, '--state-file'),
    failTimes: Number(valueAfter(argv, '--fail-times') ?? 0),
    fail: argv.includes('--fail'),
    hang: argv.includes('--hang'),
    delayMs: Number(valueAfter(argv, '--delay-ms') ?? 0),
    badJson: argv.includes('--bad-json'),
    tooLong: argv.includes('--too-long'),
    partial: argv.includes('--partial'),
    session: argv.includes('--session'),
    spawnFile: valueAfter(argv, '--spawn-file'),
    // 제공자가 언제나 붙이는 고정 인자입니다. 이 옵션이 실제로 와야 청크를 흘립니다.
    includePartialMessages: argv.includes('--include-partial-messages'),
  }
}

/** 프로세스가 뜬 횟수를 파일에 하나 더합니다. 시험이 spawn 수를 세는 유일한 통로입니다. */
function bumpSpawnCount(path) {
  if (path === null) return
  let before = 0
  try {
    before = Number.parseInt(readFileSync(path, 'utf8').trim(), 10)
    if (Number.isNaN(before)) before = 0
  } catch {
    before = 0
  }
  writeFileSync(path, String(before + 1), 'utf8')
}

/**
 * `--input-format stream-json` 을 흉내 냅니다. stdin 한 줄이 물음 하나이고, 줄마다 답 한 벌을
 * 냅니다. `system/init` 은 실제 CLI 와 같이 **세션에 한 번만** 냅니다.
 *
 * 받은 줄은 **절대 실행하지 않습니다**(불변 원칙 §4-7). 몇 번째 줄인지만 세고 버립니다.
 */
async function runSession(args) {
  emit({ type: 'system', subtype: 'init', model: MODEL })

  const answer = chooseAnswer(args)
  const lines = createInterface({ input: process.stdin })
  for await (const line of lines) {
    if (line.trim() === '') continue
    if (args.partial && args.includePartialMessages) {
      for (const piece of sliceInto(answer, 7)) emitPartialChunk(piece)
    }
    emit({ type: 'assistant', message: { content: [{ type: 'text', text: answer }] } })
    emit({
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: 5,
      duration_api_ms: 4,
      num_turns: 1,
      total_cost_usd: 0,
      result: answer,
    })
  }
}

function readStdin() {
  return new Promise((resolve) => {
    const chunks = []
    process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    const done = () => resolve(Buffer.concat(chunks).toString('utf8'))
    process.stdin.on('end', done)
    process.stdin.on('error', done)
  })
}

/** 상태 파일의 숫자를 하나 올리고 **올리기 전** 값을 돌려줍니다(0 부터 셉니다). */
function bumpCallCount(path) {
  if (path === null) return 0
  let before = 0
  try {
    before = Number.parseInt(readFileSync(path, 'utf8').trim(), 10)
    if (Number.isNaN(before)) before = 0
  } catch {
    before = 0
  }
  writeFileSync(path, String(before + 1), 'utf8')
  return before
}

function chooseAnswer(args) {
  if (args.badJson) return '답은 이렇습니다. JSON 이 아닙니다.'
  if (args.tooLong) return TOO_LONG_ANSWER
  if (args.answerFile !== null) return readFileSync(args.answerFile, 'utf8').trim()
  return DEFAULT_ANSWER
}

async function main() {
  const args = readArgs(process.argv.slice(2))
  bumpSpawnCount(args.spawnFile)

  if (args.session) {
    // 세션 모드는 stdin 을 통째로 읽지 않습니다. 한 줄이 물음 하나이기 때문입니다.
    await runSession(args)
    return
  }

  const stdin = await readStdin()

  if (args.dumpStdin !== null) {
    // 시험 전용 통로입니다. 본문을 해석하거나 실행하지 않고 그대로 적기만 합니다.
    writeFileSync(args.dumpStdin, JSON.stringify({ argv: process.argv, stdin }), 'utf8')
  }

  const callIndex = bumpCallCount(args.stateFile)
  const shouldFail = args.fail || callIndex < args.failTimes

  // 호출 수를 먼저 적고 나서 잡니다. 시험이 "지금 몇 번째 회차인가" 를 자는 동안에도 봅니다.
  if (Number.isFinite(args.delayMs) && args.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, args.delayMs))
  }

  emit({ type: 'system', subtype: 'init', model: MODEL })

  if (args.hang) {
    // 아무것도 더 내보내지 않고 버팁니다. 제공자가 타임아웃으로 트리를 끊습니다.
    setInterval(() => {}, 1000)
    return
  }

  if (shouldFail) {
    process.stderr.write('fake-tutor-cli: 일부러 실패합니다\n')
    // process.exit() 은 파이프로 나가던 stdout 을 자를 수 있어 exitCode 만 정하고 자연 종료합니다.
    process.exitCode = 1
    return
  }

  const answer = chooseAnswer(args)

  // 실제 CLI 와 같이, 청크는 `--include-partial-messages` 를 실제로 받았을 때만 흘립니다.
  // 그래서 고정 인자에서 그 옵션이 빠지면 --partial 시험이 곧바로 깨집니다.
  if (args.partial && !args.includePartialMessages) {
    process.stderr.write('fake-tutor-cli: --partial 인데 청크 옵션이 없어 조각을 내지 않습니다\n')
  }
  if (args.partial && args.includePartialMessages) {
    // 7글자씩 쪼갭니다. 답 JSON 의 conclusion 이 반드시 조각 경계에 걸치는 크기입니다.
    for (const piece of sliceInto(answer, 7)) emitPartialChunk(piece)
  }

  emit({ type: 'assistant', message: { content: [{ type: 'text', text: answer }] } })
  emit({
    type: 'result',
    subtype: 'success',
    is_error: false,
    duration_ms: 5,
    duration_api_ms: 4,
    num_turns: 1,
    total_cost_usd: 0,
    result: answer,
  })
}

// 진입점 가드 — 이 파일을 직접 실행했을 때만 돕니다.
// import 만으로 자식 프로세스가 뜨는 사고를 막는 장치이며 저장소 규약입니다.
const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(String(error && error.message) + '\n')
    process.exitCode = 2
  })
}
