#!/usr/bin/env node
// Gate C2 — Codex 제공자 프로토콜 정찰 (네트워크 호출 없음 · 버리는 코드)
//
// 목적: codex 사용 한도가 소진된 상태에서도 확인할 수 있는 것만 확인한다.
//   1) codex --version
//   2) codex app-server --help (하위 명령 목록)
//   3) codex app-server generate-ts --out <dir> 로 stdio 프로토콜의 TypeScript 바인딩 생성
//   4) 생성된 타입에서 요청/응답 메시지 이름 상위 20개만 출력
// 실제 프롬프트 실행(모델 호출)은 하지 않는다 → Gate C2 의 Codex 측정은 BLOCKED.
//
// 원칙(§4-2): 인증정보·토큰을 읽지도 저장하지도 않는다. `~/.codex/auth.json` 등을 건드리지 않는다.
//
// 실행 (저장소 루트 · Git Bash):
//   node spikes/provider-codex-probe.mjs
//
// 옵션:
//   --out DIR   생성물 디렉터리 (기본 spikes/out/codex-protocol)
//   --top N     출력할 메시지 이름 개수 (기본 20)

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const args = { out: join(HERE, 'out', 'codex-protocol'), top: 20 }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === '--out') args.out = resolve(argv[++i])
    else if (flag === '--top') args.top = Number(argv[++i])
    else throw new Error(`알 수 없는 옵션: ${flag}`)
  }
  return args
}

/** PATH 에서 실행 파일을 찾는다. Windows 의 .cmd 셈은 cmd.exe 를 거쳐야 실행된다. */
function resolveExecutable(name) {
  const isWindows = process.platform === 'win32'
  const exts = isWindows ? ['.cmd', '.exe', '.bat', ''] : ['']
  const sep = isWindows ? ';' : ':'
  const dirs = (process.env.PATH ?? '').split(sep).filter(Boolean)
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir.replace(/^"|"$/g, ''), name + ext)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

function run(executable, args, timeoutMs = 60000) {
  const isCmdShim = /\.(cmd|bat)$/i.test(executable)
  const command = isCmdShim ? (process.env.ComSpec ?? 'cmd.exe') : executable
  const argv = isCmdShim ? ['/c', executable, ...args] : args
  const started = Date.now()
  const result = spawnSync(command, argv, {
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    argsShown: `codex ${args.join(' ')}`,
    status: result.status,
    elapsedMs: Date.now() - started,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ? result.error.message : null,
  }
}

function listFilesRecursive(dir) {
  const found = []
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry)
      if (statSync(full).isDirectory()) walk(full)
      else found.push(full)
    }
  }
  if (existsSync(dir)) walk(dir)
  return found.sort()
}

/**
 * 생성된 .ts 바인딩에서 요청/응답 메시지 이름을 뽑는다.
 * app-server 프로토콜은 JSON-RPC 형태이므로 메소드 이름 리터럴과 Request/Response 타입 이름을 모두 본다.
 */
function extractMessageNames(files) {
  const methodNames = new Set()
  const typeNames = new Set()
  for (const file of files) {
    if (!file.endsWith('.ts')) continue
    const text = readFileSync(file, 'utf8')
    // "method": "session/new" 같은 리터럴 (점·슬래시를 포함한 소문자 식별자)
    for (const match of text.matchAll(/["'`]([a-z][A-Za-z0-9]*(?:[/.][A-Za-z0-9]+)+)["'`]/g)) {
      methodNames.add(match[1])
    }
    // export type XxxRequest / XxxResponse / XxxNotification / XxxParams
    for (const match of text.matchAll(
      /export\s+(?:type|interface)\s+([A-Z][A-Za-z0-9]*(?:Request|Response|Notification|Params|Event))\b/g,
    )) {
      typeNames.add(match[1])
    }
  }
  return {
    methodNames: [...methodNames].sort(),
    typeNames: [...typeNames].sort(),
  }
}

function section(title) {
  console.log('')
  console.log(`== ${title} ==`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const executable = resolveExecutable('codex')
  if (executable === null) {
    console.error('codex 실행 파일을 PATH 에서 찾지 못했습니다.')
    process.exitCode = 2
    return
  }
  console.log(`codex 실행 파일: ${executable}`)
  console.log('네트워크 호출 없음 — 버전·도움말·타입 생성만 실행합니다.')

  section('codex --version')
  const version = run(executable, ['--version'])
  console.log(version.stdout.trim() || version.stderr.trim() || '(출력 없음)')
  console.log(`exit=${version.status} · ${version.elapsedMs}ms`)

  section('codex app-server --help (하위 명령)')
  const help = run(executable, ['app-server', '--help'])
  const commandLines = []
  let inCommands = false
  for (const line of help.stdout.split('\n')) {
    if (/^Commands:/.test(line)) {
      inCommands = true
      continue
    }
    if (inCommands) {
      if (line.trim() === '') break
      commandLines.push(line.trimEnd())
    }
  }
  console.log(commandLines.length > 0 ? commandLines.join('\n') : '(Commands 절을 찾지 못함)')
  console.log(`exit=${help.status} · ${help.elapsedMs}ms`)

  section(`codex app-server generate-ts --out ${relative(process.cwd(), args.out) || args.out}`)
  mkdirSync(args.out, { recursive: true })
  const generate = run(executable, ['app-server', 'generate-ts', '--out', args.out], 120000)
  console.log(`exit=${generate.status} · ${generate.elapsedMs}ms`)
  if (generate.status !== 0) {
    console.log('생성 실패 발췌:')
    console.log((generate.stderr || generate.stdout).split('\n').slice(0, 8).join('\n'))
    process.exitCode = 1
    return
  }

  const files = listFilesRecursive(args.out)
  console.log(`생성 파일 ${files.length}개:`)
  for (const file of files.slice(0, 20)) {
    console.log(`  ${relative(args.out, file)} (${statSync(file).size} bytes)`)
  }

  const { methodNames, typeNames } = extractMessageNames(files)
  section(`요청/응답 메시지 이름 상위 ${args.top}개 (메소드 리터럴)`)
  console.log(methodNames.length === 0 ? '(없음)' : methodNames.slice(0, args.top).join('\n'))
  console.log(`총 ${methodNames.length}개 중 ${Math.min(args.top, methodNames.length)}개 표시`)

  section(`요청/응답 타입 이름 상위 ${args.top}개`)
  console.log(typeNames.length === 0 ? '(없음)' : typeNames.slice(0, args.top).join('\n'))
  console.log(`총 ${typeNames.length}개 중 ${Math.min(args.top, typeNames.length)}개 표시`)

  section('판정')
  console.log('프로토콜 형태 확인 = 가능. 실제 프롬프트 지연 측정 = BLOCKED (사용 한도 소진 · 사람이 복구 확인 필요).')
}

// 진입점 가드: 직접 실행할 때만 정찰을 돌린다(provider-claude.mjs 와 같은 모양).
// 이쪽은 네트워크·비용이 없지만, import 부작용으로 외부 프로세스를 띄우는 모양 자체를 없앤다.
const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 2
  }
}
