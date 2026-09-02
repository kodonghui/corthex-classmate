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
//   --broken-json          중간에 깨진 JSON 줄 하나를 흘립니다.
//   --banner               JSON 이 아닌 경고 줄을 앞에 하나 흘립니다.
//   --no-result            result 줄 없이 끝납니다.
//   --error-result         subtype 이 success 가 아닌 result 를 흘립니다.
//   --echo-stdin           받은 stdin 바이트 수를 result 에 실어 돌려줍니다.
//
// stdin 으로 들어온 프롬프트는 **길이만 세고 절대 실행하지 않습니다**(불변 원칙 §4-7).

import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const MODEL = 'fake-claude-model'

function emit(object) {
  process.stdout.write(JSON.stringify(object) + '\n')
}

function readArgs(argv) {
  const args = {
    hang: argv.includes('--hang'),
    grandchild: argv.includes('--grandchild'),
    brokenJson: argv.includes('--broken-json'),
    banner: argv.includes('--banner'),
    noResult: argv.includes('--no-result'),
    errorResult: argv.includes('--error-result'),
    echoStdin: argv.includes('--echo-stdin'),
    exitCode: 0,
    pidFile: null,
  }
  const exitAt = argv.indexOf('--exit')
  if (exitAt !== -1) args.exitCode = Number(argv[exitAt + 1])
  const pidAt = argv.indexOf('--pid-file')
  if (pidAt !== -1) args.pidFile = argv[pidAt + 1]
  return args
}

function readStdin() {
  return new Promise((resolve) => {
    let bytes = 0
    process.stdin.on('data', (chunk) => {
      // 본문은 담지 않습니다. 바이트 수만 셉니다.
      bytes += Buffer.byteLength(chunk)
    })
    process.stdin.on('end', () => resolve(bytes))
    process.stdin.on('error', () => resolve(bytes))
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
  const stdinBytes = await readStdin()

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

  emit({ type: 'assistant', message: { content: [{ type: 'text', text: '결론입니다. ' }] } })
  emit({ type: 'assistant', message: { content: [{ type: 'text', text: '이유는 둘입니다.' }] } })

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
      result: '결론입니다. 이유는 둘입니다.',
      ...(args.echoStdin ? { stdin_bytes: stdinBytes } : {}),
    })
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
