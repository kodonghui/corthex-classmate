// Gate C 탐침 시험 — 진짜 IntelliJ 없이도 규칙과 흐름을 확인한다.
//
// IntelliJ 내장 MCP 서버 대신 SDK 의 McpServer 로 도구 이름만 흉내 낸 스텁을 띄운다.
// 스텁에는 읽기 도구 3개와 쓰기 도구 2개를 둔다. 탐침이
//   ① tools/list 를 받고
//   ② 쓰기 도구를 차단하고
//   ③ 허용된 읽기 도구 하나만 호출해 크기·시간을 재는지
// 를 본다. 스텁의 쓰기 도구는 호출되면 시험을 실패시키도록 표시를 남긴다.

import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import {
  probe,
  ProbeError,
  parseArgs,
  readToken,
  maskUrl,
  urlCarriesSecretSlot,
  makeAuthFetch,
  TOKEN_ENV,
  DEFAULT_MCP_URLS
} from '../intellij-mcp-probe.mjs';
import { classifyTool, filterTools, pickProbeTool } from '../lib/intellij-readonly.mjs';

/** 쓰기 도구가 한 번이라도 불리면 여기에 이름이 쌓인다. 비어 있어야 통과다. */
const writeToolCalls = [];

/** 스텁 서버가 받은 Authorization 헤더. 실제 비밀값이 아니라 시험용 고정 문자열이다. */
const authHeaders = [];
const STUB_TOKEN = 'stub-token-not-a-secret';

/** vitest.config 의 testTimeout 과 맞춘 상한. 시간 값이 NaN·비정상으로 새는지 본다. */
const TIMING_UPPER_MS = 20000;

function expectTiming(label, value) {
  expect(Number.isFinite(value), `${label} 이 유한한 수여야 한다`).toBe(true);
  expect(value, label).toBeGreaterThanOrEqual(0);
  expect(value, label).toBeLessThan(TIMING_UPPER_MS);
}

const READ_TOOLS = ['get_all_open_file_paths', 'get_open_in_editor_file_text', 'get_project_modules'];
const WRITE_TOOLS = ['replace_file_text_by_path', 'execute_terminal_command'];

/** 골든 fixture 의 IoC 수업 파일 이름만 쓴다(본문·개인정보 없음). */
const STUB_OPEN_FILES = ['/synthetic/chap01-ioc/OrderService.java', '/synthetic/chap01-ioc/AppConfig.java'];

function buildStubServer() {
  const server = new McpServer({ name: 'stub-intellij-mcp', version: '2025.3.0' });

  server.registerTool('get_all_open_file_paths', { description: '열린 파일 경로' }, async () => ({
    content: [{ type: 'text', text: STUB_OPEN_FILES.join('\n') }]
  }));

  server.registerTool('get_open_in_editor_file_text', { description: '현재 편집기 본문' }, async () => ({
    content: [{ type: 'text', text: 'public class OrderService { }' }]
  }));

  server.registerTool('get_project_modules', { description: '모듈 목록' }, async () => ({
    content: [{ type: 'text', text: 'chap01-ioc-container-practice' }]
  }));

  for (const name of WRITE_TOOLS) {
    server.registerTool(name, { description: '쓰기/실행 도구(스텁)' }, async () => {
      writeToolCalls.push(name);
      return { content: [{ type: 'text', text: 'should never be called' }] };
    });
  }

  return server;
}

let httpServer;
let baseUrl;
/** beforeAll 에서 한 번 붙어 받은 탐침 결과. 아래 시험들이 나눠 본다. */
let probeResult;

beforeAll(async () => {
  // 요청마다 McpServer 와 전송을 새로 만드는 상태 없는(stateless) 방식이다.
  // 하나를 계속 쓰면 두 번째 initialize 가 "Server already initialized" 로 거절돼
  // 탐침을 여러 번 돌릴 수 없다.
  httpServer = createServer(async (req, res) => {
    authHeaders.push(req.headers.authorization ?? null);
    const server = buildStubServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      if (!res.headersSent) res.statusCode = 500;
      res.end(String(error?.message ?? error));
    }
  });

  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address();
  baseUrl = `http://127.0.0.1:${port}/mcp`;

  probeResult = await probe(baseUrl);

  // docs/spikes/gate-c-intellij.md 의 측정값 칸을 이 줄에서 옮겨 적는다.
  console.log(
    `[gate-c 측정] 스텁 initialize ${probeResult.connectMs} ms · tools/list ${probeResult.listMs} ms · ` +
      `${probeResult.call.tool} 왕복 ${probeResult.call.roundTripMs} ms · 응답 ${probeResult.call.bytes} bytes`
  );
});

afterAll(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
});

describe('읽기 전용 허용 규칙', () => {
  it('알려진 읽기 도구를 허용한다', () => {
    for (const name of READ_TOOLS) {
      expect(classifyTool(name).allowed, name).toBe(true);
    }
  });

  it('쓰기·실행·터미널 도구를 차단한다', () => {
    const denied = [
      'replace_file_text_by_path',
      'replace_specific_text',
      'create_new_file_with_text',
      'execute_terminal_command',
      'execute_action_by_id',
      'run_configuration',
      'open_file_in_editor',
      'toggle_debugger_breakpoint',
      'reformat_file',
      'rename_refactoring',
      'get_terminal_text'
    ];
    for (const name of denied) {
      expect(classifyTool(name).allowed, name).toBe(false);
    }
  });

  it('모르는 이름은 기본 차단한다', () => {
    const verdict = classifyTool('some_future_intellij_tool_2027');
    expect(verdict.allowed).toBe(false);
    expect(verdict.rule).toBe('default-deny');
  });

  it('부분 일치로 새어 나가지 않는다', () => {
    expect(classifyTool('get_file_text_by_path_and_replace').allowed).toBe(false);
  });

  it('filterTools 는 객체 목록과 문자열 목록을 모두 받는다', () => {
    const fromObjects = filterTools([{ name: 'get_project_modules' }, { name: 'run_configuration' }]);
    expect(fromObjects.allowed.map((t) => t.name)).toEqual(['get_project_modules']);
    expect(fromObjects.blocked.map((t) => t.name)).toEqual(['run_configuration']);

    const fromStrings = filterTools(['get_project_modules', 'run_configuration']);
    expect(fromStrings.allowed).toHaveLength(1);
    expect(fromStrings.blocked).toHaveLength(1);
  });

  it('호출 시험 도구는 인자 없는 조회 도구 중에서 고른다', () => {
    expect(pickProbeTool([{ name: 'get_project_modules' }, { name: 'get_all_open_file_paths' }])).toBe(
      'get_all_open_file_paths'
    );
    expect(pickProbeTool([])).toBe(null);
  });
});

describe('스텁 MCP 서버에 붙는 탐침', () => {
  it('tools/list 를 받아 읽기 3개를 허용하고 쓰기 2개를 차단한다', () => {
    const result = probeResult;

    expect(result.ok).toBe(true);
    expect(result.transport).toBe('streamable-http');
    expect(result.serverInfo?.name).toBe('stub-intellij-mcp');
    expect(result.toolCount).toBe(5);
    expect(result.allowed.map((t) => t.name).sort()).toEqual([...READ_TOOLS].sort());
    expect(result.blocked.map((t) => t.name).sort()).toEqual([...WRITE_TOOLS].sort());
  });

  it('허용된 읽기 도구 하나만 호출하고 크기·왕복 시간을 잰다', () => {
    const result = probeResult;

    expect(result.call).not.toBeNull();
    expect(result.call.tool).toBe('get_all_open_file_paths');
    expect(result.call.isError).toBe(false);
    expect(result.call.bytes).toBeGreaterThan(0);
    expectTiming('call.roundTripMs', result.call.roundTripMs);
    expectTiming('connectMs', result.connectMs);
    expectTiming('listMs', result.listMs);
  });

  it('두 번 붙어도 같은 결과가 나온다', async () => {
    const again = await probe(baseUrl);
    expect(again.toolNames.sort()).toEqual([...READ_TOOLS, ...WRITE_TOOLS].sort());
    expect(again.call.tool).toBe('get_all_open_file_paths');
  });

  it('쓰기 도구는 한 번도 호출되지 않는다', () => {
    expect(writeToolCalls).toEqual([]);
  });
});

describe('연결 실패 처리', () => {
  it('닫힌 포트에서는 ProbeError 를 던지고 원인 코드를 담는다', async () => {
    // 포트를 잠깐 열었다 닫아 확실히 비어 있는 번호를 얻는다.
    const scratch = createServer();
    await new Promise((resolve) => scratch.listen(0, '127.0.0.1', resolve));
    const { port } = scratch.address();
    await new Promise((resolve) => scratch.close(resolve));

    await expect(probe(`http://127.0.0.1:${port}/mcp`, { timeoutMs: 1500 })).rejects.toBeInstanceOf(ProbeError);

    const error = await probe(`http://127.0.0.1:${port}/mcp`, { timeoutMs: 1500 }).catch((e) => e);
    expect(error.code).toBe('ECONNREFUSED');
    expect(error.attempts.map((a) => a.transport)).toEqual(['streamable-http', 'sse']);
  });
});

describe('URL 결정', () => {
  it('인자가 없으면 64342 의 /sse 와 /mcp 를 순서대로 시도한다', () => {
    const previous = process.env.INTELLIJ_MCP_URL;
    delete process.env.INTELLIJ_MCP_URL;
    try {
      expect(parseArgs([])).toEqual({ urls: DEFAULT_MCP_URLS, source: 'default' });
    } finally {
      if (previous !== undefined) process.env.INTELLIJ_MCP_URL = previous;
    }
  });

  it('--url 이 있으면 그것만 쓴다', () => {
    expect(parseArgs(['--url', 'http://127.0.0.1:1/mcp'])).toEqual({
      urls: ['http://127.0.0.1:1/mcp'],
      source: '--url'
    });
  });
});

// 검증자 지적(major): 해석한 URL 을 그대로 찍으면 URL 에 실린 토큰이
// 콘솔 → 채팅 → 커밋 문서로 흘러간다. 아래 시험이 그 경로를 막는다.
describe('URL 가리기와 토큰 취급', () => {
  it('쿼리·해시·사용자·비밀번호 자리를 지우고 origin+경로만 남긴다', () => {
    expect(maskUrl('http://127.0.0.1:64342/sse')).toBe('http://127.0.0.1:64342/sse');
    expect(maskUrl('http://127.0.0.1:64342/sse?token=abc123')).toBe(
      'http://127.0.0.1:64342/sse (쿼리·자격 부분 가림)'
    );
    expect(maskUrl('http://user:pw@127.0.0.1:64342/mcp#frag')).toBe(
      'http://127.0.0.1:64342/mcp (쿼리·자격 부분 가림)'
    );
    for (const secret of ['abc123', 'user', 'pw', 'frag']) {
      expect(maskUrl('http://user:pw@127.0.0.1:64342/mcp?token=abc123#frag')).not.toContain(secret);
    }
  });

  it('파싱할 수 없는 값은 통째로 가린다', () => {
    expect(maskUrl('not a url ?token=abc123')).toBe('<URL 파싱 실패 — 가림>');
  });

  it('비밀값이 실릴 수 있는 자리를 알아본다', () => {
    expect(urlCarriesSecretSlot('http://127.0.0.1:64342/sse')).toBe(false);
    expect(urlCarriesSecretSlot('http://127.0.0.1:64342/sse?token=abc123')).toBe(true);
    expect(urlCarriesSecretSlot('http://user:pw@127.0.0.1:64342/sse')).toBe(true);
  });

  it('연결에 성공해도 결과에는 가린 URL 이 함께 담긴다', async () => {
    expect(probeResult.maskedUrl).toBe(baseUrl);
    expect(probeResult.authenticated).toBe(false);

    const withQuery = await probe(`${baseUrl}?token=abc123`);
    expect(withQuery.maskedUrl).toBe(`${baseUrl} (쿼리·자격 부분 가림)`);
    expect(withQuery.maskedUrl).not.toContain('abc123');
  });

  it('연결 실패 오류 메시지와 attempts 에 원본 URL 이 남지 않는다', async () => {
    const scratch = createServer();
    await new Promise((resolve) => scratch.listen(0, '127.0.0.1', resolve));
    const { port } = scratch.address();
    await new Promise((resolve) => scratch.close(resolve));

    const error = await probe(`http://127.0.0.1:${port}/mcp?token=abc123`, { timeoutMs: 1500 }).catch((e) => e);
    expect(error).toBeInstanceOf(ProbeError);
    expect(error.message).not.toContain('abc123');
    expect(error.url).not.toContain('abc123');
    for (const attempt of error.attempts) {
      expect(attempt.message ?? '').not.toContain('abc123');
    }
  });

  it('토큰은 URL 이 아니라 Authorization 헤더로 간다', async () => {
    authHeaders.length = 0;
    const result = await probe(baseUrl, { token: STUB_TOKEN });

    expect(result.authenticated).toBe(true);
    expect(result.maskedUrl).toBe(baseUrl);
    expect(authHeaders.length).toBeGreaterThan(0);
    for (const header of authHeaders) {
      expect(header).toBe(`Bearer ${STUB_TOKEN}`);
    }
  });

  it('토큰이 없으면 Authorization 헤더를 붙이지 않는다', async () => {
    authHeaders.length = 0;
    await probe(baseUrl);

    expect(authHeaders.length).toBeGreaterThan(0);
    for (const header of authHeaders) {
      expect(header).toBe(null);
    }
    expect(makeAuthFetch(undefined)).toBe(undefined);
    expect(makeAuthFetch('')).toBe(undefined);
  });

  it('토큰은 전용 환경 변수에서만 읽는다', () => {
    expect(TOKEN_ENV).toBe('INTELLIJ_MCP_TOKEN');
    expect(readToken({})).toBe(undefined);
    expect(readToken({ [TOKEN_ENV]: '' })).toBe(undefined);
    expect(readToken({ [TOKEN_ENV]: STUB_TOKEN })).toBe(STUB_TOKEN);
    // URL 환경 변수는 토큰 통로가 아니다.
    expect(readToken({ INTELLIJ_MCP_URL: 'http://127.0.0.1:64342/sse?token=abc123' })).toBe(undefined);
  });
});
