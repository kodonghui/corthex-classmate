#!/usr/bin/env node
// Codex app-server 가짜 서버입니다.
//
// 실제 CLI·로그인·모델은 절대 부르지 않습니다. 부모가 보낸 JSONL을 상태기로 읽고 공식
// app-server의 최소 응답/알림만 돌려줍니다. 모든 입력은 시험이 만든 임시 audit 파일에 JSONL로
// 기록할 수 있으며, 그 파일은 저장소가 아니라 시스템 TEMP 아래에만 생깁니다.

import { appendFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'

const argv = process.argv.slice(2)
const valueAfter = (name, fallback = null) => {
  const at = argv.indexOf(name)
  return at === -1 ? fallback : argv[at + 1]
}

const scenario = valueAfter('--scenario', 'success')
const auditFile = valueAfter('--audit-file')
const MODEL = 'fake-codex-model'
const THREAD_ID = 'thread-fake-1'
const TURN_ID = 'turn-fake-1'
const ITEM_ID = 'message-fake-1'

function emit(object) {
  process.stdout.write(JSON.stringify(object) + '\n')
}

function audit(object) {
  if (auditFile === null) return
  appendFileSync(auditFile, JSON.stringify(object) + '\n', 'utf8')
}

function response(id, result) {
  emit({ id, result })
}

function turn(status, error = null) {
  return { id: TURN_ID, status, items: [], error }
}

function thread(cwd) {
  return {
    cliVersion: '0.152.0',
    createdAt: 1,
    cwd,
    ephemeral: true,
    id: THREAD_ID,
    modelProvider: 'openai',
    path: null,
    preview: '',
    projectId: null,
    sessionId: 'session-fake-1',
    source: 'appServer',
    status: { type: 'idle' },
    turns: [],
    updatedAt: 1,
  }
}

function threadStartResult(cwd) {
  const unsafe = scenario === 'unsafe-effective-policy'
  return {
    approvalPolicy: unsafe ? 'untrusted' : 'never',
    approvalsReviewer: 'user',
    cwd,
    instructionSources: unsafe ? ['C:\\fake\\AGENTS.md'] : [],
    model: MODEL,
    modelProvider: 'openai',
    runtimeWorkspaceRoots: [],
    sandbox: { type: 'readOnly', networkAccess: false },
    serviceTier: null,
    thread: thread(cwd),
  }
}

function emitSuccess(withDelta = true) {
  const text = '의존성은 객체가 필요로 하는 협력 대상입니다.'
  emit({
    method: 'item/started',
    params: {
      threadId: THREAD_ID,
      turnId: TURN_ID,
      startedAtMs: Date.now(),
      item: { id: ITEM_ID, type: 'agentMessage', text: '', phase: 'final_answer' },
    },
  })
  if (withDelta) {
    for (const delta of ['의존성은 객체가 ', '필요로 하는 협력 대상입니다.']) {
      emit({
        method: 'item/agentMessage/delta',
        params: { threadId: THREAD_ID, turnId: TURN_ID, itemId: ITEM_ID, delta },
      })
    }
  }
  emit({
    method: 'item/completed',
    params: {
      threadId: THREAD_ID,
      turnId: TURN_ID,
      completedAtMs: Date.now(),
      item: { id: ITEM_ID, type: 'agentMessage', text, phase: 'final_answer' },
    },
  })
  emit({ method: 'turn/completed', params: { threadId: THREAD_ID, turn: turn('completed') } })
}

function validateThreadStart(message) {
  const params = message.params || {}
  return params.ephemeral === true &&
    params.approvalPolicy === 'never' &&
    params.sandbox === 'read-only' &&
    Array.isArray(params.runtimeWorkspaceRoots) && params.runtimeWorkspaceRoots.length === 0 &&
    Array.isArray(params.environments) && params.environments.length === 0 &&
    Array.isArray(params.dynamicTools) && params.dynamicTools.length === 0 &&
    Array.isArray(params.selectedCapabilityRoots) && params.selectedCapabilityRoots.length === 0 &&
    typeof params.cwd === 'string' &&
    params.cwd.includes('classmate-codex-tutor-') &&
    typeof params.developerInstructions === 'string' &&
    params.developerInstructions.includes('Never call tools')
}

function validateTurnStart(message) {
  const params = message.params || {}
  const prompt = params.input?.[0]?.text
  const questionLeakedToArgv = argv.some((arg) => arg.includes('의존성이 뭐예요'))
  const expectsImage = scenario === 'local-image'
  const localImage = params.input?.[1]
  const validImage = localImage?.type === 'localImage' &&
    localImage?.detail === 'high' &&
    typeof localImage?.path === 'string' &&
    localImage.path.includes('classmate-codex-tutor-') &&
    /question-frame\.(jpg|jpeg|png|webp)$/i.test(localImage.path) &&
    existsSync(localImage.path)
  return params.threadId === THREAD_ID &&
    params.approvalPolicy === 'never' &&
    params.sandboxPolicy?.type === 'readOnly' &&
    params.sandboxPolicy?.networkAccess === false &&
    Array.isArray(params.runtimeWorkspaceRoots) && params.runtimeWorkspaceRoots.length === 0 &&
    Array.isArray(params.environments) && params.environments.length === 0 &&
    typeof prompt === 'string' &&
    prompt.includes('의존성이 뭐예요') &&
    (expectsImage ? params.input.length === 2 && validImage : params.input.length === 1) &&
    !questionLeakedToArgv
}

async function main() {
  const lines = createInterface({ input: process.stdin })
  for await (const line of lines) {
    if (line.trim() === '') continue
    let message
    try {
      message = JSON.parse(line)
    } catch {
      process.stderr.write('fake app-server: 부모가 깨진 JSON을 보냈습니다\n')
      process.exitCode = 8
      return
    }
    audit(message)

    if (message.method === 'initialize') {
      if (scenario === 'exit') {
        process.stderr.write('fake app-server: 인증 실패를 흉내 냅니다\n')
        process.exitCode = 7
        return
      }
      if (message.params?.capabilities?.experimentalApi !== true) {
        emit({ id: message.id, error: { code: -32602, message: 'experimental API opt-in missing' } })
        continue
      }
      response(message.id, {
        userAgent: 'fake-app-server/1',
        platformFamily: 'windows',
        platformOs: 'windows',
        codexHome: 'C:\\fake',
      })
      continue
    }

    if (message.method === 'initialized') continue

    if (message.method === 'thread/start') {
      if (!validateThreadStart(message)) {
        emit({ id: message.id, error: { code: -32602, message: 'unsafe thread/start shape' } })
        continue
      }
      if (scenario === 'rpc-error') {
        emit({ id: message.id, error: { code: -32000, message: 'fake handshake failure' } })
        continue
      }
      const effective = threadStartResult(message.params.cwd)
      response(message.id, effective)
      emit({ method: 'thread/started', params: { thread: effective.thread } })
      continue
    }

    if (message.method === 'turn/start') {
      if (!validateTurnStart(message)) {
        emit({ id: message.id, error: { code: -32602, message: 'unsafe turn/start shape' } })
        continue
      }
      response(message.id, { turn: turn('inProgress') })
      emit({ method: 'turn/started', params: { threadId: THREAD_ID, turn: turn('inProgress') } })

      switch (scenario) {
        case 'success':
        case 'local-image':
          emitSuccess(true)
          break
        case 'no-delta':
          emitSuccess(false)
          break
        case 'reroute':
          emit({
            method: 'model/rerouted',
            params: { threadId: THREAD_ID, turnId: TURN_ID, fromModel: MODEL, toModel: 'fake-rerouted-model', reason: 'highRiskCyberActivity' },
          })
          emitSuccess(true)
          break
        case 'failed': {
          const error = { message: '가짜 turn 실패', codexErrorInfo: 'other' }
          emit({ method: 'error', params: { threadId: THREAD_ID, turnId: TURN_ID, error, willRetry: false } })
          emit({ method: 'turn/completed', params: { threadId: THREAD_ID, turn: turn('failed', error) } })
          break
        }
        case 'malformed':
          process.stdout.write('{"method":"item/started","params":\n')
          break
        case 'approval':
          emit({
            id: 'approval-1',
            method: 'item/commandExecution/requestApproval',
            params: {
              itemId: 'cmd-1',
              threadId: THREAD_ID,
              turnId: TURN_ID,
              startedAtMs: Date.now(),
              command: 'whoami',
            },
          })
          break
        case 'unsafe-item':
          emit({
            method: 'item/started',
            params: {
              threadId: THREAD_ID,
              turnId: TURN_ID,
              startedAtMs: Date.now(),
              item: { id: 'search-1', type: 'webSearch', query: 'should never run' },
            },
          })
          break
        case 'mismatched-scope':
          emit({
            method: 'item/started',
            params: {
              threadId: THREAD_ID,
              turnId: 'turn-from-another-session',
              startedAtMs: Date.now(),
              item: { id: ITEM_ID, type: 'agentMessage', text: '', phase: 'final_answer' },
            },
          })
          break
        case 'unsafe-effective-policy':
          process.stderr.write('fake app-server: turn/start가 오면 안 됩니다\n')
          process.exitCode = 11
          return
        case 'eof':
          lines.close()
          return
        case 'hang':
          break
        default:
          process.stderr.write(`fake app-server: 알 수 없는 scenario ${scenario}\n`)
          process.exitCode = 9
          return
      }
      continue
    }

    if (message.id === 'approval-1') {
      if (message.result?.decision !== 'cancel') {
        process.stderr.write('fake app-server: 승인 요청이 cancel로 닫히지 않았습니다\n')
        process.exitCode = 10
        return
      }
      continue
    }

    if (message.method === 'turn/interrupt') {
      response(message.id, {})
      emit({ method: 'turn/completed', params: { threadId: THREAD_ID, turn: turn('interrupted') } })
      lines.close()
      return
    }
  }
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(String(error?.message || error) + '\n')
    process.exitCode = 2
  })
}
