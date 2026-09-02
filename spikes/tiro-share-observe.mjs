#!/usr/bin/env node
// Gate A (b)(c) 관찰기 — 녹음 중인 Tiro 공유 페이지를 Playwright 로 열고
// 문단이 자라는 것을 정해진 시간 동안 지켜본다.
//
// 하는 일
//   ① TIRO_SHARE_URL 의 페이지를 Chromium 으로 연다 (URL 은 환경변수로만 받는다)
//   ② TIRO_SHARE_PASSWORD 가 있으면 비밀번호 칸에 넣어 본다
//   ③ 페이지 안에 MutationObserver 를 심고, 문단이 바뀔 때마다 Node 로 올려 보낸다
//      (타이머 폴링이 아니라 이벤트 기반. 백그라운드 탭 스로틀을 피한다)
//   ④ spikes/out/tiro-observe-<시각>.jsonl 에 { t, index, state, chars } 만 적는다
//   ⑤ 끝나면 지연 통계(진행→확정 전이 간격 p50/p95)·문단 수·이벤트 공백만 stdout 에 낸다
//
// 하지 않는 일
//   - 공유 URL·비밀번호를 화면·파일·오류 메시지에 남기지 않는다 (불변 원칙 §4-3).
//   - 전사 본문을 저장하거나 출력하지 않는다. 글자 수(chars)만 센다.
//   - 전사 문장을 명령으로 실행하지 않는다 (불변 원칙 §4-7).
//   - 페이지를 고치지 않는다. 읽기만 한다.
//
// 실행 (저장소 루트에서 · Windows Git Bash)
//   node spikes/tiro-share-observe.mjs                      사용법을 내고 종료 코드 2
//   TIRO_SHARE_URL="…" node spikes/tiro-share-observe.mjs --minutes 60
//   TIRO_SHARE_URL="…" TIRO_SHARE_PASSWORD="…" node spikes/tiro-share-observe.mjs --minutes 60 --headed
//
// 종료 코드
//   0 관찰을 마쳤다   2 사용법(환경변수 없음·인자 잘못)   3 페이지에 붙지 못했다

import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'out');

/** 기본 관찰 시간(분). Gate A 합격 기준이 60분 연속 유지다. */
export const DEFAULT_MINUTES = 60;

/** 같은 진행 중 문단을 이만큼마다 한 번만 기록한다. 확정 전이는 언제나 기록한다. */
export const DEFAULT_PARTIAL_SAMPLE_MS = 1000;

/** 이 시간보다 긴 이벤트 공백은 "끊겼다"로 센다. Gate A 기준은 초과 0회다. */
export const GAP_THRESHOLD_MS = 30_000;

const USAGE = `Gate A 관찰기 — 녹음 중인 Tiro 공유 페이지를 지켜보고 지연만 잰다.

  TIRO_SHARE_URL="<녹음 중인 공유 링크>" node spikes/tiro-share-observe.mjs [옵션]

환경변수
  TIRO_SHARE_URL        (필수) 공유 링크. 명령 인자로 넘기지 말 것 — 셸 기록에 남는다.
  TIRO_SHARE_PASSWORD   (선택) 공유 비밀번호. 있으면 자동으로 넣어 본다.

옵션
  --minutes <수>        관찰 시간(분). 기본 ${DEFAULT_MINUTES}
  --partial-ms <수>     진행 중 문단 기록 간격(ms). 기본 ${DEFAULT_PARTIAL_SAMPLE_MS}
  --headed              창을 띄운다. 기본은 headless
  --help                이 도움말

남는 것
  spikes/out/tiro-observe-<시각>.jsonl  — { t, index, state, chars } 만. 본문은 없다.
  stdout                                 — 문단 수·지연 p50/p95·이벤트 공백 통계만.

비밀 취급
  URL 과 비밀번호는 화면에도 파일에도 남기지 않는다 (불변 원칙 §4-3).`;

/** 인자를 읽는다. 잘못된 값은 message 를 채워 돌려준다(던지지 않는다). */
export function parseArgs(argv) {
  const options = {
    minutes: DEFAULT_MINUTES,
    partialSampleMs: DEFAULT_PARTIAL_SAMPLE_MS,
    headed: false,
    help: false,
    error: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--headed') {
      options.headed = true;
    } else if (arg === '--minutes' || arg === '--partial-ms') {
      const raw = argv[i + 1];
      i += 1;
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) {
        options.error = `${arg} 에는 0 보다 큰 수가 와야 해요`;
        return options;
      }
      if (arg === '--minutes') options.minutes = value;
      else options.partialSampleMs = value;
    } else {
      options.error = `모르는 옵션이에요: ${arg}`;
      return options;
    }
  }

  return options;
}

/** 오름차순 정렬된 수 목록에서 백분위 값을 고른다. 비어 있으면 null. */
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(Math.max(rank, 1), sorted.length) - 1;
  return sorted[index];
}

/**
 * 기록한 사건들에서 통계를 뽑는다.
 *
 * 지연 = 어떤 문단을 **처음 본 시각** 부터 그 문단이 **확정된 시각** 까지.
 * 녹음 중 공유 페이지에는 문단 시각이 없으므로 이것이 잴 수 있는 전부다
 * (발화 → 화면 지연은 사람이 눈으로 재야 한다 · Gate A (c)).
 */
export function summarize(events, observedMs) {
  const firstSeen = new Map();
  const finalizedAt = new Map();
  let lastText = 0;
  let noMatchEvents = 0;

  for (const event of events) {
    // index -1 은 "선택자가 하나도 안 잡혔다"는 표시라 문단으로 세지 않는다.
    if (event.state === 'no_match') {
      noMatchEvents += 1;
      continue;
    }
    if (!firstSeen.has(event.index)) firstSeen.set(event.index, event.t);
    if (event.state === 'final' && !finalizedAt.has(event.index)) {
      finalizedAt.set(event.index, event.t);
    }
    lastText = Math.max(lastText, event.chars);
  }

  const latencies = [];
  for (const [index, at] of finalizedAt) {
    const seen = firstSeen.get(index);
    if (seen !== undefined) latencies.push(at - seen);
  }
  latencies.sort((a, b) => a - b);

  // 이벤트 공백: **사건과 사건 사이**가 GAP_THRESHOLD_MS 를 넘은 횟수다.
  //
  // 관찰 시작 ~ 첫 사건은 공백으로 세지 않는다. 그 구간은 "전사가 끊겼다"가 아니라
  // 페이지를 열고 사람이 말을 시작하기까지의 대기라, 같은 잣대로 재면 조용히 시작한
  // 모든 관찰이 실패로 나온다. 그 대기 시간은 firstEventAfterMs 로 따로 낸다.
  // 마지막 사건 ~ 관찰 끝은 공백으로 센다. 도중에 끊긴 것과 뜻이 같기 때문이다.
  let gapsOverThreshold = 0;
  let longestGapMs = 0;
  let firstEventAfterMs = null;
  let previous = null;

  for (const event of events) {
    if (previous === null) {
      firstEventAfterMs = event.t;
      previous = event.t;
      continue;
    }
    const gap = event.t - previous;
    if (gap > longestGapMs) longestGapMs = gap;
    if (gap > GAP_THRESHOLD_MS) gapsOverThreshold += 1;
    previous = event.t;
  }

  // 사건이 하나도 없었으면 관찰 시간 전체가 한 번의 공백이다(첫 사건을 기다린 게 아니라 끝내 못 봤다).
  const tailGap = previous === null ? observedMs : observedMs - previous;
  if (tailGap > longestGapMs) longestGapMs = tailGap;
  if (tailGap > GAP_THRESHOLD_MS) gapsOverThreshold += 1;

  return {
    observedMs,
    events: events.length,
    noMatchEvents,
    paragraphsSeen: firstSeen.size,
    paragraphsFinalized: finalizedAt.size,
    longestParagraphChars: lastText,
    latencyP50Ms: percentile(latencies, 50),
    latencyP95Ms: percentile(latencies, 95),
    latencyMaxMs: latencies.length > 0 ? latencies[latencies.length - 1] : null,
    /** 관찰 시작부터 첫 사건까지 걸린 시간(ms). 사건이 없었으면 null. 공백 횟수에는 넣지 않는다. */
    firstEventAfterMs,
    gapsOverThreshold,
    longestGapMs,
  };
}

/** 통계를 사람이 읽을 줄들로 바꾼다. 본문도 URL 도 여기 없다. */
export function formatSummary(summary) {
  const ms = (value) => (value === null ? '미측정' : `${value}ms`);
  return [
    '--- Gate A (b) 관찰 결과 ---',
    `관찰 시간            ${Math.round(summary.observedMs / 1000)}초`,
    `기록한 사건          ${summary.events}건`,
    `본 문단              ${summary.paragraphsSeen}개`,
    `선택자 못 잡음       ${summary.noMatchEvents}회`,
    `확정된 문단          ${summary.paragraphsFinalized}개`,
    `가장 긴 문단         ${summary.longestParagraphChars}자`,
    `진행→확정 지연 p50   ${ms(summary.latencyP50Ms)}`,
    `진행→확정 지연 p95   ${ms(summary.latencyP95Ms)}`,
    `진행→확정 지연 최대  ${ms(summary.latencyMaxMs)}`,
    `첫 사건까지 대기     ${ms(summary.firstEventAfterMs)} (공백으로 세지 않음)`,
    `${GAP_THRESHOLD_MS / 1000}초 넘는 이벤트 공백  ${summary.gapsOverThreshold}회 (가장 긴 공백 ${summary.longestGapMs}ms)`,
    '--- 합격 기준: 공백 초과 0회 · 새로고침 없이 60분 · 지연 30초 이내 95% ---',
  ];
}

/** 파일 이름에 쓸 시각. 콜론은 Windows 파일 이름에 못 쓴다. */
export function stampFor(date) {
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return (
    `${pad(date.getFullYear(), 4)}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/**
 * 페이지 안에서 도는 코드.
 *
 * `apps/browser-extension/src/tiro/share-parser.ts` 의 규칙을 **손으로 옮긴 사본**이다.
 * 스파이크는 버리는 코드라 번들러 없이 문자열로 주입한다. 규칙을 고치면 두 곳을 함께 고친다.
 *
 * `config.originMs` 는 Node 가 정한 시작 시각이다. 페이지가 새로고침돼도 `t` 가 0 으로
 * 되돌아가지 않아야 (c) 새로고침 후 복구를 같은 시간축에서 볼 수 있다.
 */
function installPageObserver(config) {
  if (window.__classmateInstalled) return;
  window.__classmateInstalled = true;

  const SELECTORS = [
    'main div.whitespace-pre-wrap',
    'main [class*="whitespace-pre-wrap"]',
    'div.whitespace-pre-wrap',
    '[class*="whitespace-pre-wrap"]',
  ];
  const startedAt = config.originMs;
  const lastReported = new Map();
  const finalized = new Set();
  let lastNoMatchAt = -Infinity;

  function findParagraphs() {
    for (const selector of SELECTORS) {
      const found = Array.from(document.querySelectorAll(selector)).filter(
        (element) => (element.textContent || '').trim().length > 0,
      );
      if (found.length > 0) return found;
    }
    return [];
  }

  function scan() {
    const elements = findParagraphs();
    if (elements.length === 0) {
      // 선택자가 깨진 동안에도 DOM 변경은 계속 오므로 초당 한 번만 남긴다.
      const now = Date.now() - startedAt;
      if (now - lastNoMatchAt < 1000) return;
      lastNoMatchAt = now;
      window.__classmateEmit({ t: now, index: -1, state: 'no_match', chars: 0 });
      return;
    }

    const classes = elements.map((element) => (element.getAttribute('class') || '').split(/\s+/));
    const last = elements.length - 1;

    // 문단마다 따로 가른다. 다른 문단의 클래스를 근거로 쓰지 않는다.
    // 마지막 문단은 확정 표시가 **명시적으로** 있을 때만 확정이다(share-parser.ts 와 같은 규칙).
    elements.forEach((element, index) => {
      const list = classes[index] || [];
      let state;
      if (list.includes('font-semibold')) state = 'in_progress';
      else if (list.includes('font-medium') || list.includes('text-tds-fg-subtle')) state = 'final';
      else state = index === last ? 'in_progress' : 'final';

      const chars = (element.textContent || '').trim().length;
      const t = Date.now() - startedAt;

      if (state === 'final') {
        if (finalized.has(index)) return;
        finalized.add(index);
        window.__classmateEmit({ t, index, state, chars });
        return;
      }

      const previous = lastReported.get(index);
      if (previous === undefined) {
        lastReported.set(index, { t, chars });
        window.__classmateEmit({ t, index, state, chars });
        return;
      }
      if (previous.chars === chars) return;
      if (t - previous.t < config.partialSampleMs) return;
      lastReported.set(index, { t, chars });
      window.__classmateEmit({ t, index, state, chars });
    });
  }

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  scan();
}

/** 비밀번호 칸이 있으면 채워 본다. 값을 로그에 남기지 않는다. */
async function tryUnlock(page, password) {
  if (!password) return 'no_password';
  const field = page.locator('input[type="password"]').first();
  try {
    await field.waitFor({ state: 'visible', timeout: 5_000 });
  } catch {
    return 'no_password_field';
  }
  try {
    await field.fill(password);
    await field.press('Enter');
    await page.waitForTimeout(2_000);
    return 'submitted';
  } catch {
    return 'submit_failed';
  }
}

async function run(options) {
  const shareUrl = process.env.TIRO_SHARE_URL;
  const password = process.env.TIRO_SHARE_PASSWORD;

  const { chromium } = await import('playwright');
  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `tiro-observe-${stampFor(new Date())}.jsonl`);
  const out = createWriteStream(outPath, { encoding: 'utf8' });

  const events = [];
  const browser = await chromium.launch({ headless: !options.headed });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.exposeFunction('__classmateEmit', (event) => {
    events.push(event);
    out.write(`${JSON.stringify(event)}\n`);
  });

  try {
    await page.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  } catch {
    await browser.close();
    out.end();
    // 오류 메시지에 URL 이 들어 있을 수 있어 그대로 내지 않는다.
    console.error('공유 페이지를 열지 못했어요 · 링크가 살아 있는지, 녹음 중인지 확인해 주세요');
    return 3;
  }

  const unlock = await tryUnlock(page, password);
  console.log(`페이지에 붙었어요 · 비밀번호 처리 ${unlock}`);

  // 시간축의 원점을 Node 가 정해 넘긴다. 새로고침해도 t 가 이어진다.
  const pageConfig = { partialSampleMs: options.partialSampleMs, originMs: Date.now() };
  // addInitScript 는 다음 이동·새로고침부터, evaluate 는 지금 열려 있는 문서에 심는다.
  await page.addInitScript(installPageObserver, pageConfig);
  await page.evaluate(installPageObserver, pageConfig);

  const observeMs = Math.round(options.minutes * 60 * 1000);
  console.log(`${options.minutes}분 동안 지켜봅니다 · 기록 ${outPath}`);
  console.log('중간에 멈추려면 Ctrl+C — 거기까지의 통계를 냅니다');

  const startedAt = Date.now();
  let stopped = false;
  const onSigint = () => {
    stopped = true;
  };
  process.on('SIGINT', onSigint);

  // 이벤트 기반이라 Node 쪽은 그냥 기다리기만 한다. 페이지가 사건을 밀어 올린다.
  while (!stopped && Date.now() - startedAt < observeMs) {
    await page.waitForTimeout(1_000);
    if (page.isClosed()) break;
  }
  process.off('SIGINT', onSigint);

  const observedMs = Date.now() - startedAt;
  await browser.close();
  await new Promise((resolve) => out.end(resolve));

  for (const line of formatSummary(summarize(events, observedMs))) {
    console.log(line);
  }
  console.log(`기록 파일: ${outPath}`);
  return 0;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  if (options.error) {
    console.error(options.error);
    console.error('');
    console.error(USAGE);
    return 2;
  }
  if (!process.env.TIRO_SHARE_URL) {
    console.error('TIRO_SHARE_URL 환경변수가 없어요. 공유 링크는 인자가 아니라 환경변수로 넘깁니다.');
    console.error('');
    console.error(USAGE);
    return 2;
  }

  return run(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`관찰기가 멈췄어요: ${error?.message ?? error}`);
      process.exitCode = 1;
    },
  );
}
