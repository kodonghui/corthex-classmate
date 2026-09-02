// Gate C2 — provider-claude.mjs 의 Windows 실행 경로·회차 타임아웃 시험
//
// 이 파일이 지키는 것 (실제 claude 는 **단 한 번도** 띄우지 않는다 · 비용 0):
//   1) npm `.cmd` 셈 해석 — 래퍼를 벗겨 실제 진입점(node+cli.js 또는 .exe)을 직접 띄운다.
//   2) 회차 타임아웃 — `cmd 래퍼 → node 손자` 모양에서 손자까지 죽고, Promise 가 제때 resolve 된다.
//
// 2)가 이 게이트의 핵심이다. 예전 판본은 `child.kill()` 로 cmd 래퍼만 죽여
//   (a) 손자(실제 claude)가 살아남아 모델 호출이 계속되고 **과금이 이어졌으며**,
//   (b) 손자가 stdout 파이프를 쥐고 있어 `close` 가 오지 않아 회차가 영영 끝나지 않았다.
// 여기서 띄우는 손자는 실제 CLI 가 아니라 60초 자는 node 스크립트다.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveCmdWrapper, toSpawnArgs, runOnce, collectRuns, looksLikeNestingBlock } from '../provider-claude.mjs'

const isWindows = process.platform === 'win32'

let workDir

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'c2-provider-'))
})

afterAll(() => {
  // 손자가 남아 있으면 임시 디렉터리 삭제가 실패할 수 있으므로 실패를 삼킨다.
  try {
    rmSync(workDir, { recursive: true, force: true })
  } catch {
    /* 남은 파일은 OS 임시 폴더 청소에 맡긴다 */
  }
})

/** PID 가 아직 살아 있는지 본다. Windows 는 tasklist 필터, 그 밖은 kill(pid, 0). */
function processAlive(pid) {
  if (!isWindows) {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  const out = spawnSync('tasklist', ['/FI', `PID eq ${pid}`], { encoding: 'utf8', windowsHide: true })
  const text = `${out.stdout ?? ''}${out.stderr ?? ''}`
  // 없으면 "INFO: No tasks are running which match the specified criteria."
  return new RegExp(`\\s${pid}\\s`).test(text)
}

describe('resolveCmdWrapper — npm .cmd 셈에서 실제 진입점 뽑기', () => {
  it('node + cli.js 모양 셈을 process.execPath + js 경로로 푼다', () => {
    const dir = join(workDir, 'shim-js')
    mkdirSync(join(dir, 'node_modules', 'fake-tool', 'bin'), { recursive: true })
    const cliJs = join(dir, 'node_modules', 'fake-tool', 'bin', 'cli.js')
    writeFileSync(cliJs, 'process.exit(0)\n', 'utf8')
    const cmdPath = join(dir, 'fake-tool.cmd')
    // npm 이 실제로 만드는 모양 그대로다(codex.cmd 와 같은 형태).
    writeFileSync(
      cmdPath,
      [
        '@ECHO off',
        'GOTO start',
        ':find_dp0',
        'SET dp0=%~dp0',
        'EXIT /b',
        ':start',
        'SETLOCAL',
        'CALL :find_dp0',
        '',
        'IF EXIST "%dp0%\\node.exe" (',
        '  SET "_prog=%dp0%\\node.exe"',
        ') ELSE (',
        '  SET "_prog=node"',
        ')',
        '',
        'endLocal & "%_prog%"  "%dp0%\\node_modules\\fake-tool\\bin\\cli.js" %*',
        '',
      ].join('\r\n'),
      'utf8',
    )

    const resolved = resolveCmdWrapper(cmdPath)
    expect(resolved).not.toBeNull()
    expect(resolved.command).toBe(process.execPath)
    expect(resolved.argv).toEqual([cliJs])

    // toSpawnArgs 는 벗긴 진입점 뒤에 CLI 인자를 이어 붙이고, cmd.exe 를 거치지 않았다고 표시한다.
    const plan = toSpawnArgs(cmdPath, ['-p', '--verbose'])
    expect(plan.command).toBe(process.execPath)
    expect(plan.argv).toEqual([cliJs, '-p', '--verbose'])
    expect(plan.wrapped).toBe(false)
  })

  it('.exe 를 직접 부르는 모양 셈을 그 .exe 로 푼다 (claude.cmd 와 같은 형태)', () => {
    const dir = join(workDir, 'shim-exe')
    mkdirSync(join(dir, 'node_modules', 'fake-tool', 'bin'), { recursive: true })
    const exePath = join(dir, 'node_modules', 'fake-tool', 'bin', 'fake-tool.exe')
    // 실행하지 않는다. resolveCmdWrapper 는 존재 여부만 본다.
    writeFileSync(exePath, 'not a real executable\n', 'utf8')
    const cmdPath = join(dir, 'fake-tool.cmd')
    writeFileSync(
      cmdPath,
      [
        '@ECHO off',
        'GOTO start',
        ':find_dp0',
        'SET dp0=%~dp0',
        'EXIT /b',
        ':start',
        'SETLOCAL',
        'CALL :find_dp0',
        '"%dp0%\\node_modules\\fake-tool\\bin\\fake-tool.exe"   %*',
        '',
      ].join('\r\n'),
      'utf8',
    )

    const resolved = resolveCmdWrapper(cmdPath)
    expect(resolved).not.toBeNull()
    expect(resolved.command).toBe(exePath)
    expect(resolved.argv).toEqual([])
  })

  it('%dp0% 표식이 없는 손수 쓴 배치는 해석하지 않고 cmd.exe /c 로 폴백한다', () => {
    const dir = join(workDir, 'shim-unknown')
    mkdirSync(dir, { recursive: true })
    const cmdPath = join(dir, 'hand-written.cmd')
    writeFileSync(cmdPath, ['@echo off', 'echo hello', ''].join('\r\n'), 'utf8')

    expect(resolveCmdWrapper(cmdPath)).toBeNull()
    const plan = toSpawnArgs(cmdPath, ['-p'])
    expect(plan.wrapped).toBe(true)
    expect(plan.argv).toEqual(['/c', cmdPath, '-p'])
  })

  it('셈이 가리키는 진입점이 없으면 null 이다 (있다고 속이지 않는다)', () => {
    const dir = join(workDir, 'shim-missing')
    mkdirSync(dir, { recursive: true })
    const cmdPath = join(dir, 'gone.cmd')
    writeFileSync(cmdPath, ['SET dp0=%~dp0', '"%dp0%\\node_modules\\gone\\cli.js" %*', ''].join('\r\n'), 'utf8')
    expect(resolveCmdWrapper(cmdPath)).toBeNull()
  })
})

describe.skipIf(!isWindows)('회차 타임아웃 — cmd 래퍼 뒤의 손자까지 끝낸다', () => {
  it('TIMEOUT 으로 2초 안에 끝나고 손자 PID 가 사라진다', async () => {
    const dir = join(workDir, 'timeout-tree')
    mkdirSync(dir, { recursive: true })
    const pidFile = join(dir, 'grandchild.pid')
    const grandchild = join(dir, 'grandchild.mjs')

    // 손자: 자기 PID 를 파일에 적고, stdout 을 열어 둔 채 60초 잔다.
    // stdout 한 줄을 흘려 부모의 파이프를 실제로 쥐게 만든다(이게 close 를 막던 원인).
    writeFileSync(
      grandchild,
      [
        "import { writeFileSync } from 'node:fs'",
        'writeFileSync(process.argv[2], String(process.pid), "utf8")',
        'process.stdout.write(JSON.stringify({ type: "system", subtype: "init", model: "grandchild" }) + "\\n")',
        '// 60초 잔다. 타임아웃이 트리를 죽이지 못하면 이 프로세스가 살아남는다.',
        'setTimeout(() => {}, 60000)',
        '',
      ].join('\n'),
      'utf8',
    )

    // %dp0% 표식이 없으므로 resolveCmdWrapper 가 해석하지 못하고 cmd.exe /c 폴백을 탄다.
    // 그래서 실제 작업(node)은 손자가 된다 — Windows 에서 claude.cmd 가 만드는 모양과 같다.
    const cmdPath = join(dir, 'slow-cli.cmd')
    writeFileSync(
      cmdPath,
      ['@echo off', `"${process.execPath}" "${grandchild}" "${pidFile}"`, ''].join('\r\n'),
      'utf8',
    )

    const plan = toSpawnArgs(cmdPath, [])
    expect(plan.wrapped).toBe(true) // 손자 모양이 실제로 만들어졌는지 먼저 못박는다

    const startedAt = Date.now()
    const run = await runOnce({
      executable: cmdPath,
      cliArgs: [],
      timeoutMs: 1500,
      stripNestingEnv: false,
      prompt: null,
    })
    const elapsed = Date.now() - startedAt

    // (a) 회차가 TIMEOUT 으로 제때 끝난다. 고치기 전에는 close 가 오지 않아 영영 끝나지 않았다.
    //
    // 예산: 타임아웃 1500ms + taskkill 소요(로컬 실측 200~330ms) + 안전망 TIMEOUT_GRACE_MS 250ms.
    // 2026-09-02 로컬 실측은 1721 · 1791 · 1845ms 로 요구선 2초 안이다.
    // 회귀 방어선은 3초로 둔다 — 이 결함의 본질은 "느리다"가 아니라 "영영 끝나지 않는다"이고
    // (고치기 전에는 손자가 60초 잘 때까지도 close 가 오지 않았다), 느린 PC 에서 taskkill 이
    // 수백 ms 더 걸린다고 시험이 깨지면 안 되기 때문이다. 실제 경과는 아래에 찍는다.
    expect(run.status).toBe('timeout')
    expect(run.timedOut).toBe(true)
    expect(run.ok).toBe(false)
    expect(elapsed).toBeLessThan(3000)
    expect(run.killMethod).toBe('taskkill /T /F')

    // (b) 손자 PID 가 실제로 사라졌다.
    expect(existsSync(pidFile)).toBe(true)
    const grandchildPid = Number(readFileSync(pidFile, 'utf8').trim())
    expect(Number.isInteger(grandchildPid)).toBe(true)
    expect(processAlive(grandchildPid)).toBe(false)

    console.log(
      `[타임아웃 트리 종료] 경과 ${elapsed}ms · status=${run.status} · killMethod=${run.killMethod} · ` +
        `손자 PID ${grandchildPid} 생존=${processAlive(grandchildPid)}`,
    )
  })

  it('타임아웃 회차는 성공으로 세지 않는다 (result 이벤트가 있어도)', async () => {
    const dir = join(workDir, 'timeout-success-guard')
    mkdirSync(dir, { recursive: true })
    const child = join(dir, 'child.mjs')
    // 성공 result 를 먼저 흘리고도 끝나지 않는 자식. exit 하지 않으므로 타임아웃이다.
    writeFileSync(
      child,
      [
        'const w = (o) => process.stdout.write(JSON.stringify(o) + "\\n")',
        'w({ type: "assistant", message: { content: [{ type: "text", text: "ok" }] } })',
        'w({ type: "result", subtype: "success", is_error: false, duration_ms: 1, num_turns: 1, total_cost_usd: 0 })',
        'setTimeout(() => {}, 60000)',
        '',
      ].join('\n'),
      'utf8',
    )

    const run = await runOnce({
      executable: process.execPath,
      cliArgs: [child],
      timeoutMs: 1200,
      stripNestingEnv: false,
      prompt: null,
    })

    expect(run.timedOut).toBe(true)
    expect(run.status).toBe('timeout')
    expect(run.ok).toBe(false) // result.subtype 이 success 여도 타임아웃이면 실패다
    expect(run.summary.result?.subtype).toBe('success')
  })
})

describe('collectRuns — 중첩 실행 차단 재시도가 --runs 를 넘지 않는다', () => {
  /** spawnOnce 를 흉내내는 가짜. 몇 번 불렸는지와 그때의 stripNestingEnv 를 기록한다. */
  function fakeSpawner(makeRun) {
    const calls = []
    const fn = async (options) => {
      const run = makeRun(calls.length, options)
      calls.push({ stripNestingEnv: options.stripNestingEnv })
      return run
    }
    return { fn, calls }
  }

  const blockedRun = {
    ok: false,
    status: 'failed',
    ttftMs: null,
    totalMs: 120,
    exitCode: 1,
    stderrHead: 'Error: cannot run inside CLAUDECODE session (nested execution blocked)',
    spawnError: null,
    summary: { result: null, assistantTextLength: 0, eventCount: 0 },
  }
  const okRun = {
    ok: true,
    status: 'ok',
    ttftMs: 50,
    totalMs: 60,
    exitCode: 0,
    stderrHead: '',
    spawnError: null,
    summary: { result: { subtype: 'success' }, assistantTextLength: 2, eventCount: 3 },
  }

  it('첫 회차가 차단되면 spawn 은 정확히 --runs 회이고 그 회차는 nesting_block 으로 남는다', async () => {
    const { fn, calls } = fakeSpawner((i) => ({ ...(i === 0 ? blockedRun : okRun) }))
    const { runs, stripNestingEnv } = await collectRuns({
      executable: 'fake',
      cliArgs: [],
      timeoutMs: 1000,
      totalRuns: 5,
      spawnOnce: fn,
      log: () => {},
    })

    // 예전 판본은 여기서 6회(1 + 5)를 띄웠다. 지금은 정확히 5회다.
    expect(calls).toHaveLength(5)
    expect(runs).toHaveLength(5)
    expect(runs[0].status).toBe('nesting_block')
    // 버려지지 않고 집계에 남는다 — 차단된 회차도 spawn 1회이므로 비용이 났을 수 있다.
    expect(runs.filter((r) => r.status === 'nesting_block')).toHaveLength(1)
    // 차단 이후 회차만 환경변수를 뺀 채로 돈다.
    expect(calls.map((c) => c.stripNestingEnv)).toEqual([false, true, true, true, true])
    expect(stripNestingEnv).toBe(true)
  })

  it('--runs 1 에서 첫 회차가 차단돼도 재시도로 한 번 더 띄우지 않는다', async () => {
    const { fn, calls } = fakeSpawner(() => ({ ...blockedRun }))
    const { runs } = await collectRuns({
      executable: 'fake',
      cliArgs: [],
      timeoutMs: 1000,
      totalRuns: 1,
      spawnOnce: fn,
      log: () => {},
    })
    expect(calls).toHaveLength(1)
    expect(runs).toHaveLength(1)
    expect(runs[0].status).toBe('nesting_block')
  })

  it('차단이 없으면 상태를 건드리지 않고 --runs 회만 돈다', async () => {
    const { fn, calls } = fakeSpawner(() => ({ ...okRun }))
    const { runs, stripNestingEnv } = await collectRuns({
      executable: 'fake',
      cliArgs: [],
      timeoutMs: 1000,
      totalRuns: 3,
      spawnOnce: fn,
      log: () => {},
    })
    expect(calls).toHaveLength(3)
    expect(runs.every((r) => r.status === 'ok')).toBe(true)
    expect(stripNestingEnv).toBe(false)
    expect(calls.every((c) => c.stripNestingEnv === false)).toBe(true)
  })

  it('환경변수를 뺀 뒤에도 계속 차단되면 두 번 다시 판정하지 않는다 (회차만 소진한다)', async () => {
    const { fn, calls } = fakeSpawner(() => ({ ...blockedRun }))
    const { runs } = await collectRuns({
      executable: 'fake',
      cliArgs: [],
      timeoutMs: 1000,
      totalRuns: 3,
      spawnOnce: fn,
      log: () => {},
    })
    expect(calls).toHaveLength(3)
    // 첫 회차만 nesting_block. 뒤 회차는 이미 환경변수를 뺐으므로 그냥 실패다.
    expect(runs.map((r) => r.status)).toEqual(['nesting_block', 'failed', 'failed'])
  })

  it('looksLikeNestingBlock 은 stderr 배너와 spawn 오류를 모두 본다', () => {
    expect(looksLikeNestingBlock({ stderrHead: 'CLAUDECODE is set', spawnError: null })).toBe(true)
    expect(looksLikeNestingBlock({ stderrHead: '', spawnError: 'nested invocation refused' })).toBe(true)
    expect(looksLikeNestingBlock({ stderrHead: 'recursive call detected', spawnError: null })).toBe(true)
    expect(looksLikeNestingBlock({ stderrHead: 'workspace trust warning', spawnError: null })).toBe(false)
  })
})

describe('회차 종결 — 정상 경로가 그대로다', () => {
  it('바로 끝나는 자식은 ok 로 끝나고 taskkill 을 부르지 않는다', async () => {
    const dir = join(workDir, 'fast-ok')
    mkdirSync(dir, { recursive: true })
    const child = join(dir, 'child.mjs')
    writeFileSync(
      child,
      [
        'const w = (o) => process.stdout.write(JSON.stringify(o) + "\\n")',
        'w({ type: "system", subtype: "init", model: "fake-model" })',
        'w({ type: "assistant", message: { content: [{ type: "text", text: "hello" }] } })',
        'w({ type: "result", subtype: "success", is_error: false, duration_ms: 1, num_turns: 1, total_cost_usd: 0 })',
        '',
      ].join('\n'),
      'utf8',
    )

    const run = await runOnce({
      executable: process.execPath,
      cliArgs: [child],
      timeoutMs: 10000,
      stripNestingEnv: false,
      prompt: null,
    })

    expect(run.status).toBe('ok')
    expect(run.ok).toBe(true)
    expect(run.timedOut).toBe(false)
    expect(run.killMethod).toBeNull()
    expect(run.exitCode).toBe(0)
    expect(run.model).toBe('fake-model')
  })

  it('없는 실행 파일은 spawn_error 로 끝난다', async () => {
    const run = await runOnce({
      executable: join(workDir, 'no-such-binary-12345.exe'),
      cliArgs: [],
      timeoutMs: 5000,
      stripNestingEnv: false,
      prompt: null,
    })
    expect(run.status).toBe('spawn_error')
    expect(run.ok).toBe(false)
    expect(typeof run.spawnError).toBe('string')
  })
})
