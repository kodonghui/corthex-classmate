#!/usr/bin/env node
// 시험 다섯 갈래를 한 명령으로 묶는 러너입니다 (docs/plan/round-8-units.md `#### U-22` · 2026-09-10 cargo-core 추가).
//
// 왜 있는가
// ---------
// 갈래마다 실행기가 달라(vitest · cargo · node --test · playwright) 루트에서 한 번에
// 도는 길이 없었습니다. `pnpm -r --if-present test` 는 pnpm 워크스페이스 패키지만 돌아
// node --test 145건과 cargo 326건이 어떤 명령에도 걸리지 않았습니다. 이 파일이 그
// 네 갈래를 순서대로 돌리고 **갈래별 건수를 마지막에 표로 찍습니다**.
//
// 무엇을 지키는가
// ---------------
// 1. 갈래 하나가 빨개도 나머지를 마저 돌고 끝에 전부 보여 줍니다(--bail 로 끌 수 있음).
//    실패를 감추지 않는 것이 이 러너의 첫째 목적입니다. 하나라도 실패하면 exit 1 입니다.
// 2. `no_real_cli` 가드 두 개(루트 크레이트 · providers 크레이트)가 **실제로 돌았는지**를
//    cargo 출력에서 확인합니다. 돌지 않았으면 다른 시험이 다 통과해도 실패로 처리합니다.
//    Gate C2 에서 승인 없이 1.25 USD 가 나갔던 사고(docs/spikes/gate-c2-provider.md)를
//    막는 그물이라, 그물이 사라진 것을 조용히 넘기면 안 됩니다.
// 3. 새 의존성을 쓰지 않습니다. Node 표준 모듈만 씁니다.
//
// 쓰는 법
// -------
//   node scripts/run-all-tests.mjs                 자동 갈래 넷(vitest · cargo · cargo-core · node)
//   node scripts/run-all-tests.mjs --with-e2e      e2e 까지 다섯 다
//   node scripts/run-all-tests.mjs cargo node      고른 갈래만
//   node scripts/run-all-tests.mjs --bail          첫 실패에서 멈춤
//
// e2e 가 왜 기본에서 빠져 있는가
// ------------------------------
// `apps/browser-extension/e2e/extension.spec.ts` 는 (가) `pnpm --filter
// @classmate/browser-extension build` 가 만든 `.output/chrome-mv3` 가 있어야 하고
// (나) 실제 Chromium 을 영속 컨텍스트로 띄우며 (다) **저장소에 담겨 있는**
// `docs/screenshots/golden-*.png` 를 덮어씁니다. 시험 한 번에 추적 중인 파일이 바뀌는
// 갈래라 `pnpm test` 의 기본에 둘 수 없습니다. 대신 기본 실행에서도 `--list` 로
// **건수만** 읽어 표에 적습니다(브라우저를 띄우지 않습니다).

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** cargo 출력에서 이 이름의 시험 바이너리가 보이지 않으면 실패로 봅니다. */
const REQUIRED_CARGO_GUARDS = ['no_real_cli_root.rs', 'no_real_cli.rs'];

// ── 갈래 정의 ────────────────────────────────────────────────────────────────

/** @type {ReadonlyArray<{key: string, label: string, note: string, cwd: string, command: string, args: string[], parse: (text: string) => object, auto: boolean}>} */
export const BRANCHES = [
  {
    key: 'vitest',
    label: 'vitest',
    note: 'pnpm 워크스페이스 패키지',
    cwd: repoRoot,
    // `-r` 은 워크스페이스 루트를 빼고 돕니다(--include-workspace-root 를 줘야 넣습니다).
    // 그래서 루트 test 가 이 러너여도 여기서 다시 자기를 부르지 않습니다.
    command: 'pnpm',
    args: ['-r', '--if-present', 'test'],
    parse: parseVitest,
    auto: true,
  },
  {
    key: 'cargo',
    label: 'cargo',
    note: 'apps/native-host 워크스페이스(루트 + providers + transport)',
    cwd: path.join(repoRoot, 'apps', 'native-host'),
    command: 'cargo',
    args: ['test', '--workspace'],
    parse: parseCargo,
    auto: true,
  },
  {
    key: 'cargo-core',
    label: 'cargo (core)',
    note: 'apps/core — v0.3 Classmate Core (native-host 와 다른 워크스페이스)',
    cwd: path.join(repoRoot, 'apps', 'core'),
    command: 'cargo',
    args: ['test'],
    // 코어는 실제 튜터 CLI 를 부르지 않으므로 no_real_cli 가드가 없습니다. 건수만 읽습니다.
    parse: parseCargoCounts,
    auto: true,
  },
  {
    key: 'node',
    label: 'node --test',
    note: 'installer · native-host scripts · browser-extension scripts',
    cwd: repoRoot,
    command: process.execPath,
    // 리포터를 못 박습니다. 기본값은 TTY 여부에 따라 달라져 건수 줄의 모양이 바뀝니다.
    // 폴더를 그냥 주면 Node 24 는 그것을 "모듈 경로" 로 읽어 MODULE_NOT_FOUND 를 냅니다.
    // 반드시 glob 로 줘야 합니다.
    args: [
      '--test',
      '--test-reporter=spec',
      'installer/windows/*.test.mjs',
      'apps/native-host/scripts/*.test.mjs',
      'apps/browser-extension/scripts/*.test.mjs',
    ],
    parse: parseNodeTest,
    auto: true,
  },
  {
    key: 'e2e',
    label: 'playwright e2e',
    note: '확장 빌드 산출물 + Chromium 필요',
    cwd: repoRoot,
    command: 'pnpm',
    args: ['--filter', '@classmate/browser-extension', 'exec', 'playwright', 'test'],
    parse: parsePlaywright,
    auto: false,
  },
];

// ── 실행 ─────────────────────────────────────────────────────────────────────

async function main(argv) {
  const bail = argv.includes('--bail');
  const withE2e = argv.includes('--with-e2e');
  const picked = argv.filter((arg) => !arg.startsWith('-'));

  const unknown = picked.filter((key) => !BRANCHES.some((branch) => branch.key === key));
  if (unknown.length > 0) {
    console.error(`모르는 갈래입니다: ${unknown.join(', ')}`);
    console.error(`고를 수 있는 것: ${BRANCHES.map((branch) => branch.key).join(' · ')}`);
    return 2;
  }

  const selected = BRANCHES.filter((branch) =>
    picked.length > 0 ? picked.includes(branch.key) : branch.auto || (withE2e && branch.key === 'e2e'),
  );
  const listOnlyE2e = !selected.some((branch) => branch.key === 'e2e') && picked.length === 0;

  const results = [];
  let stopped = false;

  console.log(rule('═'));
  console.log(`  시험 갈래 ${selected.length}개를 순서대로 돕니다 — corthex-classmate`);
  console.log(`  ${selected.map((branch) => branch.label).join(' → ')}`);
  console.log(rule('═'));

  for (const [index, branch] of selected.entries()) {
    if (stopped) {
      results.push({ branch, state: 'skipped', reason: '앞 갈래가 실패해 --bail 로 멈췄습니다' });
      continue;
    }

    const heading = `[${index + 1}/${selected.length}] ${branch.label} — ${branch.note}`;
    console.log(`\n${rule('─')}\n  ${heading}\n  $ ${display(branch.command, branch.args)}`);
    console.log(`  (cwd: ${path.relative(repoRoot, branch.cwd) || '.'})\n${rule('─')}`);

    const started = Date.now();
    const run = await execute(branch.command, branch.args, branch.cwd);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    results.push({ ...judge(branch, run), seconds });
    if (results.at(-1).state === 'failed' && bail) stopped = true;
  }

  // e2e 를 돌리지 않았으면 건수만이라도 읽어 표에 적습니다(브라우저를 띄우지 않습니다).
  let e2eListed = null;
  if (listOnlyE2e) {
    const listed = await execute(
      'pnpm',
      ['--filter', '@classmate/browser-extension', 'exec', 'playwright', 'test', '--list'],
      repoRoot,
      { quiet: true },
    );
    const match = /Total:\s+(\d+)\s+tests?/.exec(strip(listed.output));
    e2eListed = listed.code === 0 && match ? Number(match[1]) : null;
  }

  return report(results, listOnlyE2e ? e2eListed : null, listOnlyE2e);
}

/** 갈래 하나의 결과를 판정합니다. 종료 코드 · 읽어 낸 실패 건수 · 가드 셋 중 하나라도 걸리면 빨강입니다. */
export function judge(branch, run) {
  const stats = run.spawnError ? {} : branch.parse(strip(run.output));
  const problems = [];
  if (run.spawnError) problems.push(`실행하지 못했습니다 — ${run.spawnError}`);
  else if (run.code !== 0) problems.push(`종료 코드 ${run.code}`);
  if (typeof stats.failed === 'number' && stats.failed > 0) problems.push(`${stats.failed}건 실패`);
  if (stats.guardProblem) problems.push(stats.guardProblem);
  return { branch, state: problems.length > 0 ? 'failed' : 'passed', stats, problems };
}

// ── 표 ───────────────────────────────────────────────────────────────────────

function report(results, e2eListed, listOnlyE2e) {
  console.log(`\n${rule('═')}`);
  console.log('  갈래별 건수');
  console.log(rule('═'));

  let totalRun = 0;
  let totalFailed = 0;
  for (const result of results) {
    const { stats = {}, branch } = result;
    const count = typeof stats.total === 'number' ? stats.total : null;
    if (count !== null) totalRun += count;
    if (typeof stats.failed === 'number') totalFailed += stats.failed;

    const mark = result.state === 'passed' ? 'ok  ' : result.state === 'skipped' ? '건너뜀' : 'FAIL';
    const counted = count === null ? '건수를 읽지 못함' : `${String(count).padStart(5)}건`;
    const detail = stats.detail ? `  ${stats.detail}` : '';
    const time = result.seconds ? `  ${result.seconds}초` : '';
    console.log(`  ${mark}  ${branch.label.padEnd(15)}${counted}${detail}${time}`);
    for (const problem of result.problems ?? []) console.log(`        └ ${problem}`);
    if (result.reason) console.log(`        └ ${result.reason}`);
  }

  if (listOnlyE2e) {
    const counted = e2eListed === null ? '건수를 읽지 못함' : `${String(e2eListed).padStart(5)}건`;
    console.log(`  건너뜀  ${'playwright e2e'.padEnd(15)}${counted}  돌리지 않았습니다`);
    console.log('        └ 확장 빌드 산출물(.output/chrome-mv3)·Chromium 이 필요하고');
    console.log('          추적 중인 docs/screenshots/golden-*.png 를 덮어씁니다.');
    console.log('        └ 돌리려면: pnpm run test:e2e  (빌드 먼저: pnpm --filter @classmate/browser-extension build)');
  }

  console.log(rule('─'));
  console.log(`  합계 ${totalRun}건을 돌려 ${totalFailed}건 실패했습니다.`);
  if (e2eListed !== null) console.log(`  (위 합계에 e2e ${e2eListed}건은 들어 있지 않습니다)`);

  const cargo = results.find((result) => result.branch.key === 'cargo');
  if (cargo?.stats?.guardLine) console.log(`  no_real_cli 가드: ${cargo.stats.guardLine}`);

  const failed = results.filter((result) => result.state === 'failed');
  console.log(rule('═'));
  if (failed.length === 0) {
    console.log('  전부 통과했습니다.');
    return 0;
  }
  console.log(`  빨간 갈래 ${failed.length}개: ${failed.map((result) => result.branch.label).join(' · ')}`);
  return 1;
}

// 직접 실행할 때만 돕니다. import 하면 아래 갈래 정의와 파서만 얻습니다
// (파서가 정말 실패를 잡아내는지 시험으로 확인할 수 있어야 하기 때문입니다).
const runDirectly = import.meta.main ?? process.argv[1] === fileURLToPath(import.meta.url);
if (runDirectly) process.exit(await main(process.argv.slice(2)));

// ── 거들기 ───────────────────────────────────────────────────────────────────

function rule(char) {
  return `  ${char.repeat(74)}`;
}

/** 셸에 넘길 인자 하나를 따옴표로 감쌉니다. `*` 는 POSIX 셸이 먼저 펼쳐 버리므로 반드시 감쌉니다. */
function quote(arg) {
  if (process.platform === 'win32') {
    return /[\s"^&|<>()]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg;
  }
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`;
}

function display(command, args) {
  return [command, ...args].map(quote).join(' ');
}

/**
 * 갈래 하나를 돌립니다. 출력을 그대로 흘려 보내면서 동시에 모읍니다
 * (건수를 세려면 모아야 하고, 사람이 보려면 흘려 보내야 합니다).
 */
function execute(command, args, cwd, { quiet = false } = {}) {
  return new Promise((resolve) => {
    // pnpm 은 Windows 에서 `pnpm.cmd` 라 셸 없이는 못 띄웁니다. 셸을 쓰는 대신
    // 인자는 위 quote() 로 직접 감쌉니다(Node 는 shell:true 에서 감싸 주지 않습니다).
    const child = spawn(display(command, args), {
      cwd,
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let output = '';
    const collect = (stream, sink) => {
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        output += chunk;
        if (!quiet) sink.write(chunk);
      });
    };
    collect(child.stdout, process.stdout);
    collect(child.stderr, process.stderr);

    child.on('error', (error) => resolve({ code: -1, output, spawnError: error.message }));
    child.on('close', (code) => resolve({ code: code ?? -1, output }));
  });
}

/** ANSI 색 코드를 걷어 냅니다. 건수 정규식이 색 코드에 걸리지 않게 하려는 것입니다. */
export function strip(text) {
  return text.replaceAll(/\u001B\[[0-9;]*[A-Za-z]/gu, '');
}

// ── 갈래별 건수 읽기 ─────────────────────────────────────────────────────────

/** vitest 는 패키지마다 `Tests  N passed (N)` 을 한 줄씩 냅니다. 그걸 다 더합니다. */
export function parseVitest(text) {
  let total = 0;
  let failed = 0;
  let packages = 0;
  let files = 0;

  for (const match of text.matchAll(/\bTests\s+([^()\n]*?)\((\d+)\)/g)) {
    packages += 1;
    total += Number(match[2]);
    const failure = /(\d+) failed/.exec(match[1]);
    if (failure) failed += Number(failure[1]);
  }
  for (const match of text.matchAll(/\bTest Files\s+[^()\n]*?\((\d+)\)/g)) {
    files += Number(match[1]);
  }

  if (packages === 0) return { total: null, failed: /FAIL|ELIFECYCLE/.test(text) ? 1 : 0 };
  return { total, failed, detail: `(패키지 ${packages} · 파일 ${files})` };
}

/**
 * cargo 는 시험 바이너리마다 `test result: ok. N passed; M failed; ...` 을 냅니다.
 * 앞선 `Running <경로>` / `Doc-tests <크레이트>` 줄이 그 결과의 임자입니다.
 * 여기서 no_real_cli 가드 두 개가 실제로 돌았는지도 함께 확인합니다.
 */
export function parseCargo(text) {
  const parsed = parseCargoCounts(text);
  if (parsed.total === null) return parsed;

  // 가드가 실제로 돌았는지. 파일이 지워지거나 이름이 바뀌면 cargo 는 조용히 잘 끝납니다.
  const guardParts = [];
  const missing = [];
  for (const guard of REQUIRED_CARGO_GUARDS) {
    const found = parsed.entries.find((entry) => entry.name === guard);
    if (!found) {
      missing.push(guard);
      continue;
    }
    guardParts.push(`${guard} ${found.passed}건 ${found.ok ? 'ok' : 'FAILED'}`);
    if (!found.ok) missing.push(`${guard}(빨감)`);
  }

  return {
    ...parsed,
    guardLine: guardParts.join(' · ') || '(하나도 못 찾음)',
    guardProblem:
      missing.length > 0
        ? `no_real_cli 가드가 돌지 않았습니다 — ${missing.join(', ')}. 실제 CLI 호출을 막는 그물이라 통과로 셈하지 않습니다`
        : undefined,
  };
}

/**
 * cargo 출력에서 건수만 읽습니다(가드 확인 없음). apps/core 갈래가 씁니다.
 * 돌려주는 `entries` 는 parseCargo 가 가드를 찾는 데 다시 씁니다.
 */
export function parseCargoCounts(text) {
  const entries = [];
  let current = null;

  for (const line of text.split(/\r?\n/)) {
    const running = /^\s+Running\s+(?:unittests\s+)?(\S+)/.exec(line);
    if (running) {
      current = { name: path.basename(running[1].replaceAll('\\', '/')), doc: false };
      continue;
    }
    const doc = /^\s+Doc-tests\s+(\S+)/.exec(line);
    if (doc) {
      current = { name: doc[1], doc: true };
      continue;
    }
    const result = /^test result:\s+(\S+)\.\s+(\d+) passed;\s+(\d+) failed;/.exec(line);
    if (result) {
      entries.push({
        name: current?.name ?? '(모름)',
        doc: current?.doc ?? false,
        ok: result[1] === 'ok',
        passed: Number(result[2]),
        failed: Number(result[3]),
      });
      current = null;
    }
  }

  if (entries.length === 0) {
    return { total: null, failed: 1, guardProblem: 'cargo 출력에서 결과 줄을 찾지 못했습니다' };
  }

  const sum = (list, key) => list.reduce((acc, entry) => acc + entry[key], 0);
  const unit = entries.filter((entry) => !entry.doc);
  const docs = entries.filter((entry) => entry.doc);
  const total = sum(entries, 'passed') + sum(entries, 'failed');
  const failed = sum(entries, 'failed');

  return {
    total,
    failed,
    detail: `(단위·통합 ${sum(unit, 'passed') + sum(unit, 'failed')} + 문서 ${sum(docs, 'passed') + sum(docs, 'failed')} · 바이너리 ${entries.length})`,
    entries,
  };
}

/** node --test 의 spec 리포터 요약(`ℹ tests N` · `ℹ fail N`)을 읽습니다. */
export function parseNodeTest(text) {
  const stat = (key) => {
    const match = new RegExp(String.raw`^[^\d\n]*\b${key}\s+(\d+)\s*$`, 'm').exec(text);
    return match ? Number(match[1]) : null;
  };
  const total = stat('tests');
  const failed = stat('fail');
  const suites = stat('suites');
  if (total === null) return { total: null, failed: 1 };
  return { total, failed: failed ?? 0, detail: suites === null ? '' : `(스위트 ${suites})` };
}

/** playwright 의 list 리포터 마지막 줄(`N passed (…)`)을 읽습니다. */
export function parsePlaywright(text) {
  const passed = /(\d+) passed/.exec(text);
  const failure = /(\d+) failed/.exec(text);
  const flaky = /(\d+) flaky/.exec(text);
  const skipped = /(\d+) skipped/.exec(text);
  if (!passed && !failure) return { total: null, failed: 1 };
  const total =
    Number(passed?.[1] ?? 0) + Number(failure?.[1] ?? 0) + Number(flaky?.[1] ?? 0) + Number(skipped?.[1] ?? 0);
  return { total, failed: Number(failure?.[1] ?? 0) };
}
