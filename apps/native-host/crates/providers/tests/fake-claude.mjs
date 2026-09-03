#!/usr/bin/env node
// 가짜 CLI — classmate-providers 의 시험이 자식 프로세스로 띄우는 프로그램입니다.
//
// 실제 튜터 CLI 는 이 저장소의 어떤 시험에서도 실행되지 않습니다. Gate C2 에서 검증 스크립트가
// 모듈을 import 했다는 이유만으로 실제 호출 5회가 나가 승인 없이 1.251323 USD 를 쓴 사고가 있었고,
// 그 뒤로 시험은 이 파일만 띄웁니다(docs/spikes/gate-c2-provider.md).
//
// 흉내 내는 것은 `--output-format stream-json --verbose` 의 줄 단위 출력입니다.
//
//   {"type":"system","subtype":"init","model":"…"}
//   {"type":"assistant","message":{"content":[{"type":"text","text":"…"}]}}
//   {"type":"result","subtype":"success","duration_ms":…,"total_cost_usd":…}
//
// 옵션 (시험이 넘깁니다)
//   --hang                 stdin 을 읽고 끝나지 않습니다. 타임아웃·트리 종료 시험에 씁니다.
//   --grandchild           --hang 과 함께 손자 프로세스를 하나 더 띄웁니다(트리 종료 확인용).
//   --pid-file <경로>      자기 PID(그리고 손자 PID)를 이 파일에 적습니다.
//   --exit <코드>          stderr 배너를 남기고 그 코드로 끝납니다.
//   --stderr-banner        stderr 에 진단용 한 줄을 먼저 씁니다(--hang 과 같이 씁니다).
//   --broken-json          중간에 깨진 JSON 줄 하나를 흘립니다.
//   --banner               JSON 이 아닌 경고 줄을 앞에 하나 흘립니다.
//   --no-result            result 줄 없이 끝납니다.
//   --error-result         subtype 이 success 가 아닌 result 를 흘립니다.
//   --close-stdin-early    프롬프트를 읽지 않고 stdin 을 먼저 닫습니다(부모의 BrokenPipe 를 만듭니다).
//   --echo-stdin           받은 stdin 본문과 자기 argv 를 답변 조각으로 되돌려 보냅니다.
//   --partial              답을 stream_event 청크로 먼저 흘린 뒤 assistant 전체 본문과 result 를 냅니다.
//   --break-stdout-and-linger  답을 다 낸 뒤 UTF-8 이 아닌 바이트 한 줄을 흘리고 끝나지 않습니다.
//                          부모의 stdout 읽기는 그 줄에서 스스로 끝나는데 자식은 살아 있는
//                          상태를 만듭니다. 성공 경로의 기다림에 마감이 있는지 보려는 것입니다.
//   --session              stdin 을 줄 단위로 읽어 **한 줄마다** 답 한 벌을 냅니다. 프로세스는
//                          stdin 이 닫힐 때까지 살아 있습니다(SessionClaudeProvider 시험용).
//   --spawn-file <경로>    프로세스가 뜰 때마다 그 파일의 숫자를 하나 올립니다. 시험이
//                          "질문 세 번에 spawn 몇 회인가" 를 세는 자리입니다.
//   --die-after <n>        --session 에서 n 번째 물음에 답한 뒤 스스로 끝납니다(세션이 죽는 상황).
//
// 위 옵션들의 **이름과 뜻은 고정입니다.** 다른 단위(파이프라인)가 이 파일 경로와 옵션을 그대로
// 참고하므로, 옵션을 지우거나 뜻을 바꾸면 그쪽 시험이 함께 깨집니다. 더하는 것만 합니다.
//
// 알 수 없는 인자는 조용히 무시합니다. 제공자가 언제나 붙이는 고정 인자
// (`-p --output-format stream-json --verbose --include-partial-messages`)가 그대로 들어오는데,
// 그중 하나라도 만나서 죽으면 모든 시험이 함께 죽기 때문입니다.
//
// stdin 으로 들어온 프롬프트는 **절대 실행하지 않습니다**(불변 원칙 §4-7).
// 기본값은 길이만 세는 것이고, 본문을 붙잡아 두는 것은 `--echo-stdin` 을 준 시험뿐입니다.
// 그 되돌려 보내기는 "질문·문맥이 argv 가 아니라 stdin 으로 왔는가" 를 시험이 대조하려고 만든
// **시험 전용 통로**이며 실제 CLI 의 동작이 아닙니다.

import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'

const MODEL = 'fake-claude-model'

function emit(object) {
  process.stdout.write(JSON.stringify(object) + '\n')
}

// 부분 스트리밍 청크 한 줄입니다. 실제 CLI 가 `--include-partial-messages` 에서 내는 모양입니다.
function emitPartialChunk(text) {
  emit({
    type: 'stream_event',
    event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  })
}

function readArgs(argv) {
  const args = {
    hang: argv.includes('--hang'),
    grandchild: argv.includes('--grandchild'),
    brokenJson: argv.includes('--broken-json'),
    banner: argv.includes('--banner'),
    stderrBanner: argv.includes('--stderr-banner'),
    noResult: argv.includes('--no-result'),
    errorResult: argv.includes('--error-result'),
    closeStdinEarly: argv.includes('--close-stdin-early'),
    echoStdin: argv.includes('--echo-stdin'),
    partial: argv.includes('--partial'),
    breakStdoutAndLinger: argv.includes('--break-stdout-and-linger'),
    // 제공자가 붙이는 고정 인자입니다. 흐름을 바꾸지는 않고 "받아도 죽지 않는다" 는 사실만 담습니다.
    includePartialMessages: argv.includes('--include-partial-messages'),
    session: argv.includes('--session'),
    exitCode: 0,
    pidFile: null,
    spawnFile: null,
    dieAfter: 0,
  }
  const exitAt = argv.indexOf('--exit')
  if (exitAt !== -1) args.exitCode = Number(argv[exitAt + 1])
  const pidAt = argv.indexOf('--pid-file')
  if (pidAt !== -1) args.pidFile = argv[pidAt + 1]
  const spawnAt = argv.indexOf('--spawn-file')
  if (spawnAt !== -1) args.spawnFile = argv[spawnAt + 1]
  const dieAt = argv.indexOf('--die-after')
  if (dieAt !== -1) args.dieAfter = Number(argv[dieAt + 1])
  return args
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
 */
async function runSession(args) {
  emit({ type: 'system', subtype: 'init', model: MODEL })

  let turn = 0
  const lines = createInterface({ input: process.stdin })
  for await (const line of lines) {
    if (line.trim() === '') continue
    turn += 1

    // 몇 번째 물음인지 답에 적습니다. 시험이 "같은 프로세스가 이어서 답했다" 를 봅니다.
    const body = `${turn}번째 답입니다.`
    if (args.partial && args.includePartialMessages) {
      for (const piece of [`${turn}번째 `, '답입니다.']) emitPartialChunk(piece)
    }
    emit({ type: 'assistant', message: { content: [{ type: 'text', text: body }] } })
    emit({
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: 5,
      duration_api_ms: 4,
      num_turns: turn,
      total_cost_usd: 0,
      result: body,
    })

    if (args.dieAfter > 0 && turn >= args.dieAfter) {
      // 세션이 조용히 죽는 상황입니다. 부모는 다음 물음에서 EOF 로 알아채야 합니다.
      lines.close()
      return
    }
  }
}

function readStdin(keepBody) {
  return new Promise((resolve) => {
    let bytes = 0
    const chunks = []
    process.stdin.on('data', (chunk) => {
      // 기본값은 바이트 수만 세는 것입니다. 본문은 `--echo-stdin` 일 때만 붙잡습니다.
      bytes += Buffer.byteLength(chunk)
      if (keepBody) chunks.push(Buffer.from(chunk))
    })
    const done = () => resolve({ bytes, text: keepBody ? Buffer.concat(chunks).toString('utf8') : '' })
    process.stdin.on('end', done)
    process.stdin.on('error', done)
  })
}

function startGrandchild() {
  // 60초 자는 손자입니다. taskkill /T 가 트리를 끊는지 보려고 띄웁니다.
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
  return child.pid
}

async function main() {
  const args = readArgs(process.argv.slice(2))
  bumpSpawnCount(args.spawnFile)

  if (args.session) {
    // 세션 모드는 stdin 을 통째로 읽지 않습니다. 한 줄이 물음 하나이기 때문입니다.
    await runSession(args)
    return
  }

  let stdin = { bytes: 0, text: '' }
  if (args.closeStdinEarly) {
    // 프롬프트를 다 읽지 않고 읽는 쪽을 먼저 닫습니다. 부모의 write 가 BrokenPipe 로 실패할 수
    // 있는 상황을 만들어, 그래도 회차가 성공으로 끝나는지 시험이 확인합니다.
    process.stdin.destroy()
  } else {
    stdin = await readStdin(args.echoStdin)
  }

  if (args.pidFile !== null) {
    const pids = [String(process.pid)]
    if (args.hang && args.grandchild) pids.push(String(startGrandchild()))
    writeFileSync(args.pidFile, pids.join('\n') + '\n', 'utf8')
  } else if (args.hang && args.grandchild) {
    startGrandchild()
  }

  if (args.banner) {
    process.stdout.write('Warning: 이 줄은 JSON 이 아닙니다\n')
  }

  if (args.stderrBanner) {
    process.stderr.write('fake-claude: 로그인 만료를 흉내 내는 진단 배너입니다\n')
  }

  emit({ type: 'system', subtype: 'init', model: MODEL })

  if (args.hang) {
    // 아무것도 더 내보내지 않고 버팁니다. 시험이 타임아웃으로 트리를 끊습니다.
    setInterval(() => {}, 1000)
    return
  }

  if (args.brokenJson) {
    process.stdout.write('{"type":"assistant","message":\n')
    return
  }

  // 시험 전용 통로입니다. 받은 stdin 본문과 자기 argv 를 그대로 되돌려 보내, 시험이
  // "질문·문맥은 stdin 에만 있고 argv 에는 없다" 를 두 쪽 다 보고 대조할 수 있게 합니다.
  const echo = args.echoStdin
    ? `\n[STDIN-BYTES]${stdin.bytes}[/STDIN-BYTES]\n` +
      `[STDIN]${stdin.text}[/STDIN]\n` +
      `[ARGV]${JSON.stringify(process.argv)}[/ARGV]`
    : ''

  // 실제 CLI 와 같이, 청크는 `--include-partial-messages` 를 실제로 받았을 때만 흘립니다.
  // 그래서 고정 인자에서 그 옵션이 빠지면 --partial 시험이 곧바로 깨집니다.
  const streamsPartials = args.partial && args.includePartialMessages
  if (args.partial && !args.includePartialMessages) {
    process.stderr.write('fake-claude: --partial 인데 --include-partial-messages 가 없어 청크를 내지 않습니다\n')
  }

  // 청크를 흘리든 아니든 최종 본문은 같습니다. 다른 것은 "몇 조각으로 나눠 보내는가" 뿐입니다.
  let body = '결론입니다. 이유는 둘입니다.'

  if (streamsPartials) {
    // 우리가 읽지 않는 하위 타입도 하나 섞습니다. 파서가 조용히 넘기는지 e2e 로 보려는 것입니다.
    emit({ type: 'stream_event', event: { type: 'message_start', message: { id: 'fake-msg-1' } } })
    const pieces = ['결론입니다. ', '이유는 ', '둘입니다.']
    if (echo) pieces.push(echo)
    for (const piece of pieces) emitPartialChunk(piece)
    body = pieces.join('')
    // 청크를 다 보낸 뒤 같은 내용을 한 번 더 보냅니다. 실제 CLI 가 그렇게 하고,
    // 파서가 이 줄을 두 번 세지 않는지가 시험의 핵심입니다.
    emit({ type: 'assistant', message: { content: [{ type: 'text', text: body }] } })
  } else {
    emit({ type: 'assistant', message: { content: [{ type: 'text', text: '결론입니다. ' }] } })
    emit({ type: 'assistant', message: { content: [{ type: 'text', text: '이유는 둘입니다.' }] } })
    if (echo) {
      emit({ type: 'assistant', message: { content: [{ type: 'text', text: echo }] } })
    }
  }

  if (args.exitCode !== 0) {
    process.stderr.write('fake-claude: 일부러 실패합니다 · 로그인 만료를 흉내 냅니다\n')
    // process.exit() 은 파이프로 나가던 stdout 을 자를 수 있어 exitCode 만 정하고 자연 종료합니다.
    process.exitCode = args.exitCode
    return
  }

  if (args.errorResult) {
    emit({ type: 'result', subtype: 'error_max_turns', duration_ms: 5, num_turns: 9 })
    return
  }

  if (!args.noResult) {
    emit({
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: 5,
      duration_api_ms: 4,
      num_turns: 1,
      total_cost_usd: 0,
      // 청크로 나눠 보낸 회차에서는 이 칸이 정본입니다(제공자가 `result` 를 먼저 봅니다).
      result: body,
      ...(args.echoStdin ? { stdin_bytes: stdin.bytes } : {}),
    })
  }

  if (args.breakStdoutAndLinger) {
    // 같은 스트림에 이어 씁니다(순서를 지키려고 writeSync 를 섞지 않습니다).
    // 부모의 줄 단위 읽기는 이 바이트에서 스스로 끝나는데, 이 프로세스는 살아 있습니다.
    process.stdout.write(Buffer.from([0xff, 0x0a]))
    setInterval(() => {}, 1000)
  }
}

// 진입점 가드 — 이 파일을 직접 실행했을 때만 돕니다.
// import 만으로 자식 프로세스가 뜨는 사고를 막는 장치이며 저장소 규약입니다.
const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(String(error && error.message) + '\n')
    process.exitCode = 2
  })
}
