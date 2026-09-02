#!/usr/bin/env node
// Gate C 탐침 — IntelliJ 내장 MCP 서버에 읽기 전용으로 붙어 도구 목록을 받아 온다.
//
// 하는 일
//   ① initialize (Streamable HTTP → 실패하면 SSE 로 폴백)
//   ② tools/list
//   ③ spikes/lib/intellij-readonly.mjs 의 허용 규칙으로 도구를 가른다
//   ④ 허용된 조회 도구 하나만 인자 없이 호출해 응답 크기(바이트)와 왕복 시간(ms)을 잰다
//
// 하지 않는 일
//   - 응답 본문을 화면·파일에 남기지 않는다. 길이만 남긴다(소스 코드가 로그로 새지 않게).
//   - 쓰기·실행·터미널 도구는 목록에 있어도 호출하지 않는다(불변 원칙 §4-6).
//   - IntelliJ 설정을 바꾸지 않는다. 서버가 꺼져 있으면 종료 코드 3 과 절차를 알린다.
//   - URL 을 그대로 찍지 않는다. origin + 경로만 남기고 쿼리·userinfo(사용자·비밀번호)는
//     지운 뒤 출력한다. 토큰은 URL 이 아니라 INTELLIJ_MCP_TOKEN 으로만 받고 값은 어디에도
//     출력하지 않는다(불변 원칙 §2-2·§2-3).
//
// 실행 (저장소 루트에서)
//   node spikes/intellij-mcp-probe.mjs
//   node spikes/intellij-mcp-probe.mjs --url http://127.0.0.1:64342/sse
//   INTELLIJ_MCP_URL=http://127.0.0.1:64342/mcp node spikes/intellij-mcp-probe.mjs
//   INTELLIJ_MCP_TOKEN=… node spikes/intellij-mcp-probe.mjs   ← 토큰이 필요할 때만

import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

import { filterTools, pickProbeTool } from './lib/intellij-readonly.mjs';

/** IntelliJ 2025.x 내장 MCP 서버의 기본 포트. 화면에서 바뀌었으면 --url 로 넘긴다. */
export const DEFAULT_MCP_URLS = ['http://127.0.0.1:64342/sse', 'http://127.0.0.1:64342/mcp'];

const CLIENT_INFO = { name: 'classmate-gate-c-probe', version: '0.0.1' };

/** 토큰은 URL 이 아니라 이 환경 변수로만 받는다. 값은 출력하지 않는다. */
export const TOKEN_ENV = 'INTELLIJ_MCP_TOKEN';

/**
 * 출력용으로 URL 을 깎는다. origin + 경로만 남기고 쿼리·해시·사용자·비밀번호는 지운다.
 * 토큰이 실수로 URL 에 들어와도 콘솔·채팅·커밋 문서로 새지 않게 하려는 것이다.
 * @param {string} value
 * @returns {string}
 */
export function maskUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    return '<URL 파싱 실패 — 가림>';
  }
  const hadSecretSlot = Boolean(parsed.search || parsed.hash || parsed.username || parsed.password);
  parsed.search = '';
  parsed.hash = '';
  parsed.username = '';
  parsed.password = '';
  const shown = `${parsed.origin}${parsed.pathname}`;
  return hadSecretSlot ? `${shown} (쿼리·자격 부분 가림)` : shown;
}

/** URL 에 비밀값이 실릴 수 있는 자리(쿼리·해시·userinfo)가 있는지. */
export function urlCarriesSecretSlot(value) {
  try {
    const parsed = new URL(String(value));
    return Boolean(parsed.search || parsed.hash || parsed.username || parsed.password);
  } catch {
    return false;
  }
}

/** 토큰이 있으면 Authorization 헤더를 붙인 fetch 를 만든다. 값은 로그로 나가지 않는다. */
export function makeAuthFetch(token) {
  if (!token) return undefined;
  return (input, init = {}) => {
    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
}

/** 붙지 못했을 때 던진다. code 에 ECONNREFUSED 같은 원인 코드를 담는다. */
export class ProbeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ProbeError';
    // 원본 URL 은 담지 않는다. 메시지·필드가 그대로 출력·전달될 수 있어서다.
    this.url = details.url === undefined ? undefined : maskUrl(details.url);
    this.code = details.code ?? 'UNKNOWN';
    this.attempts = details.attempts ?? [];
  }
}

/** 오류 사슬(err.cause, AggregateError.errors)을 훑어 원인 코드를 모은다. */
export function collectErrorCodes(error, seen = new Set()) {
  const codes = [];
  let node = error;
  let guard = 0;
  while (node && typeof node === 'object' && guard < 10) {
    guard += 1;
    if (seen.has(node)) break;
    seen.add(node);
    if (typeof node.code === 'string') codes.push(node.code);
    if (Array.isArray(node.errors)) {
      for (const inner of node.errors) codes.push(...collectErrorCodes(inner, seen));
    }
    node = node.cause;
  }
  return codes;
}

/**
 * 오류 문구에 원본 URL 이 통째로 실려 오는 전송이 있다(SSE). 그 자리를 가린 URL 로 바꾼다.
 * @param {string} message
 * @param {string} url
 */
function scrubUrl(message, url) {
  if (!url) return message;
  return String(message).split(String(url)).join(maskUrl(url));
}

function describeError(error, url) {
  const codes = collectErrorCodes(error);
  return {
    code: codes[0] ?? 'UNKNOWN',
    codes,
    message: scrubUrl(error?.message ?? String(error), url)
  };
}

function ms(start) {
  return Math.round((performance.now() - start) * 10) / 10;
}

function makeTransport(kind, url, token) {
  const target = new URL(url);
  // 토큰은 헤더로만 싣는다. URL 에는 넣지 않고, 값은 출력하지 않는다.
  const options = {};
  const authFetch = makeAuthFetch(token);
  if (authFetch) {
    options.fetch = authFetch;
    options.requestInit = { headers: { Authorization: `Bearer ${token}` } };
  }
  return kind === 'sse' ? new SSEClientTransport(target, options) : new StreamableHTTPClientTransport(target, options);
}

/**
 * 한 전송 방식으로 붙어 목록을 받고 읽기 도구 하나를 호출한다.
 * @param {string} url
 * @param {'streamable-http' | 'sse'} kind
 * @param {{ timeoutMs?: number, callTool?: boolean, token?: string }} options
 */
async function inspectOnce(url, kind, options) {
  const timeout = options.timeoutMs ?? 5000;
  const client = new Client(CLIENT_INFO, { capabilities: {} });
  const transport = makeTransport(kind, url, options.token);

  // 붙지 못했을 때도 전송을 반드시 닫는다. SSE 전송은 닫지 않으면 재접속을 계속 시도해
  // 프로세스가 끝나지 않는다(실측: 종료되지 않고 매달림).
  let connected = false;
  try {
    const connectStarted = performance.now();
    await client.connect(transport, { timeout });
    connected = true;
    const connectMs = ms(connectStarted);

    const listStarted = performance.now();
    const listed = await client.listTools({}, { timeout });
    const listMs = ms(listStarted);

    const toolNames = (listed.tools ?? []).map((tool) => tool.name);
    const { allowed, blocked } = filterTools(listed.tools ?? []);

    let call = null;
    const pick = options.callTool === false ? null : pickProbeTool(allowed);
    if (pick) {
      const callStarted = performance.now();
      const result = await client.callTool({ name: pick, arguments: {} }, undefined, { timeout });
      const roundTripMs = ms(callStarted);
      // 본문은 절대 남기지 않는다. 직렬화한 길이만 잰다.
      const bytes = Buffer.byteLength(JSON.stringify(result?.content ?? result ?? null), 'utf8');
      call = { tool: pick, bytes, roundTripMs, isError: result?.isError === true };
    }

    return {
      ok: true,
      url,
      // 출력·문서에는 이 값만 쓴다. url 은 프로그램 안에서만 쓴다.
      maskedUrl: maskUrl(url),
      authenticated: Boolean(options.token),
      transport: kind,
      connectMs,
      listMs,
      serverInfo: client.getServerVersion() ?? null,
      toolCount: toolNames.length,
      toolNames,
      allowed,
      blocked,
      call
    };
  } finally {
    if (connected) {
      await client.close().catch(() => {});
    } else {
      await transport.close().catch(() => {});
    }
  }
}

/**
 * URL 하나에 대해 Streamable HTTP → SSE 순서로 시도한다.
 * @param {string} url
 * @param {{ timeoutMs?: number, transports?: string[], callTool?: boolean, token?: string }} [options]
 */
export async function probe(url, options = {}) {
  const kinds = options.transports ?? ['streamable-http', 'sse'];
  const attempts = [];

  for (const kind of kinds) {
    const started = performance.now();
    try {
      return await inspectOnce(url, kind, options);
    } catch (error) {
      attempts.push({ transport: kind, ms: ms(started), ...describeError(error, url) });
    }
  }

  const first = attempts[0] ?? { code: 'UNKNOWN', message: '시도 없음' };
  throw new ProbeError(`MCP 연결 실패: ${maskUrl(url)} (${first.code})`, { url, code: first.code, attempts });
}

/**
 * 후보 URL 을 순서대로 시도한다.
 * @param {string[]} urls
 */
export async function probeAny(urls, options = {}) {
  const attempts = [];
  for (const url of urls) {
    try {
      return await probe(url, options);
    } catch (error) {
      // attempts 는 그대로 출력되므로 가린 URL 만 담는다.
      attempts.push({ url: maskUrl(url), code: error.code, attempts: error.attempts ?? [] });
    }
  }
  const code = attempts[0]?.attempts?.[0]?.code ?? attempts[0]?.code ?? 'UNKNOWN';
  throw new ProbeError(`후보 ${urls.length}개 모두 실패 (${code})`, { url: urls[0], code, attempts });
}

export function parseArgs(argv) {
  const flagIndex = argv.indexOf('--url');
  const fromFlag = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;
  const fromEnv = process.env.INTELLIJ_MCP_URL;
  const explicit = fromFlag ?? fromEnv;
  return {
    urls: explicit ? [explicit] : [...DEFAULT_MCP_URLS],
    source: fromFlag ? '--url' : fromEnv ? 'INTELLIJ_MCP_URL' : 'default'
  };
}

/** 토큰을 환경 변수에서만 읽는다. 값은 반환만 하고 어디에도 출력하지 않는다. */
export function readToken(env = process.env) {
  const value = env[TOKEN_ENV];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function printSuccess(result) {
  console.log('판정: 연결됨');
  console.log(`URL          ${result.maskedUrl}`);
  console.log(`인증         ${result.authenticated ? `${TOKEN_ENV} 헤더 사용 (값은 출력하지 않음)` : '없음'}`);
  console.log(`전송         ${result.transport}`);
  console.log(`서버         ${result.serverInfo?.name ?? '?'} ${result.serverInfo?.version ?? ''}`.trim());
  console.log(`initialize   ${result.connectMs} ms`);
  console.log(`tools/list   ${result.listMs} ms · 도구 ${result.toolCount}개`);
  console.log(`허용 ${result.allowed.length}개  차단 ${result.blocked.length}개`);
  console.log('');
  console.log('허용된 읽기 도구');
  for (const tool of result.allowed) console.log(`  + ${tool.name}  — ${tool.reason}`);
  console.log('차단된 도구');
  for (const tool of result.blocked) console.log(`  - ${tool.name}  — ${tool.reason}`);
  console.log('');
  if (result.call) {
    console.log(`호출 시험    ${result.call.tool} → ${result.call.bytes} bytes · ${result.call.roundTripMs} ms · isError=${result.call.isError}`);
    console.log('(응답 본문은 출력하지 않습니다. 길이만 잽니다.)');
  } else {
    console.log('호출 시험    건너뜀 — 인자 없는 허용 도구가 목록에 없습니다.');
  }
}

function printFailure(error, urls) {
  console.error('판정: BLOCKED — IntelliJ 내장 MCP 서버에 붙지 못했습니다.');
  console.error(`원인 코드    ${error.code}`);
  console.error(`시도한 URL   ${urls.map(maskUrl).join(', ')}`);
  for (const attempt of error.attempts ?? []) {
    const inner = (attempt.attempts ?? []).map((a) => `${a.transport}=${a.code}`).join(' · ');
    console.error(`  ${attempt.url ?? '-'}  ${inner || attempt.code}`);
  }
  console.error('');
  console.error('사람이 할 일');
  console.error('  1. IntelliJ IDEA → Settings → Tools → MCP Server → Enable 을 켭니다.');
  console.error('  2. 그 화면에 표시된 포트와 인증 방식(토큰 여부)을 확인합니다.');
  console.error(`     포트는 --url 또는 INTELLIJ_MCP_URL 로, 토큰은 ${TOKEN_ENV} 으로만 넘깁니다.`);
  console.error('     토큰을 URL 에 넣지 않습니다. 파일·커밋·스크린샷에도 적지 않습니다.');
  console.error('  3. 골든 시나리오 프로젝트(OrderService.java 가 있는 창)를 열어 둡니다.');
  console.error('  4. 저장소 루트에서 다시 실행합니다: node spikes/intellij-mcp-probe.mjs');
}

async function main() {
  const { urls, source } = parseArgs(process.argv.slice(2));
  const token = readToken();
  // URL 은 반드시 가려서 찍는다. 이 줄이 채팅·문서로 그대로 복사되기 때문이다.
  console.log(`후보 URL(${source}): ${urls.map(maskUrl).join(', ')}`);
  console.log(`인증: ${token ? `${TOKEN_ENV} 헤더 사용 (값은 출력하지 않음)` : '없음'}`);
  if (urls.some(urlCarriesSecretSlot)) {
    console.log(`주의: URL 에 쿼리·자격 정보가 있어 출력에서 가렸습니다. 토큰은 ${TOKEN_ENV} 으로 넘기세요.`);
  }
  try {
    const result = await probeAny(urls, { token });
    printSuccess(result);
    process.exitCode = 0;
  } catch (error) {
    if (error instanceof ProbeError) {
      printFailure(error, urls);
      process.exitCode = 3;
      return;
    }
    throw error;
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  await main();
}
