#!/usr/bin/env node
// 정본 디자인 렌더와 구현 사이드패널을 나란히 놓는 비교 이미지를 만드는 스크립트입니다.
//
//   design/…/Classmate Side Panel.dc.html ──▶ 127.0.0.1 정적 서버 ──▶ Playwright ──▶ 정본 PNG
//   apps/browser-extension/.output/chrome-mv3 ──▶ 확장 로드 ──▶ sidepanel.html?replay=manual ──▶ 구현 PNG
//                                    └────────────┬────────────┘
//                                  두 PNG 를 data URI 로 넣은 합성 HTML ──▶ docs/screenshots/compare/<상태>.png
//
// 지키는 경계
// - 정본(`design/**`)은 **읽기만** 합니다. dc.html 은 unpkg 에서 React·Babel 을 SRI 로 받아 오므로
//   `file://` 로는 열리지 않습니다. 그래서 임의 빈 포트에 정적 서버를 잠깐 띄웁니다(디렉터리 밖 금지).
// - 구현은 이미 빌드돼 있다고 봅니다. `.output/chrome-mv3` 가 없으면 안내만 하고 1 로 끝냅니다.
// - 확장 로드는 `e2e/extension.spec.ts` 의 방식을 그대로 복사했습니다(영속 컨텍스트 + --load-extension).
//   스펙 파일은 단위 1a 소유라 여기서 고치지 않습니다.
// - 스크린샷은 전부 `animations: 'disabled'` 입니다. 정본은 `cm-fade-in` 이 걸려 있어 이걸 빼면
//   전사 줄이 opacity 0 인 채로 찍힙니다(빈 패널처럼 보입니다).
// - `docs/screenshots/golden-*.png` 와 `docs/screenshots/README.md` 는 단위 1a 소유입니다.
//   이 스크립트는 `docs/screenshots/compare/` 아래에만 씁니다.
// - 이 파일은 import 만으로는 아무 일도 하지 않습니다. 맨 아래 진입점 가드를 보세요.

import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFile, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(extensionDir, '..', '..');

/** `pnpm --filter @classmate/browser-extension build` 가 만드는 산출물 폴더입니다. */
export const EXTENSION_PATH = path.join(extensionDir, '.output', 'chrome-mv3');

/** 정본 디자인이 있는 폴더(읽기 전용)와 그 안의 파일 이름입니다. */
export const DESIGN_DIR = path.join(
  repoRoot,
  'design',
  'claude-design-export',
  'project-classmate-side-panel',
);
export const DESIGN_FILE = 'Classmate Side Panel.dc.html';

/** 비교 이미지와 요약이 남는 자리입니다. */
export const OUTPUT_DIR = path.join(repoRoot, 'docs', 'screenshots', 'compare');

/** 사이드패널 폭 380 · 디자인 프레임 높이 900. 정본과 구현을 같은 크기로 엽니다. */
export const VIEWPORT = { width: 380, height: 900 };

/** dc.html 이 unpkg 에서 React·Babel 을 받아 오는 데 주는 시간입니다. */
export const DESIGN_LOAD_TIMEOUT_MS = 30_000;

// ── 상태 ↔ 체크포인트 표 ───────────────────────────────────────────────────────
//
// 정본의 상태 이름(A~H)은 `design/…/prompts/claude-design-prompt.md:21-28`,
// 조작 방법은 `docs/design-map.md` §4-2 · §5 의 셀렉터 표에서 왔습니다.
// 구현의 체크포인트 이름은 `src/panel/replay-store.ts` 의 `CHECKPOINTS` 입니다.

/**
 * 구현 쪽을 세우는 방법 세 가지입니다.
 *   checkpoint  `window.classmateReplay.goto(<이름>)`
 *               + `then` 이 있으면 그 뒤에 한 손짓 — `click`(셀렉터 클릭) 또는
 *                 `connector`(`window.classmateConnector(<커넥터>, <형편>)` · 계약 connector.status 한 줄) —
 *                 를 하고 `expect` 셀렉터가 보일 때까지 기다립니다. 기록(G)·전사 멈춤(H-1)이 이렇게 섭니다.
 *   clock       `window.classmateReplay.advanceTo(<ISO>)`
 *   none        구현에 그 화면이 아직 없음 → 자리표시
 */
export const STATES = [
  {
    id: 'A',
    name: 'listening',
    title: 'A 듣는 중',
    design: '초기 화면 · 1초 tick 31번(전사 5줄까지)',
    impl: { kind: 'checkpoint', checkpoint: 'listening' },
  },
  {
    id: 'B',
    name: 'caught',
    title: 'B 붙잡은 직후',
    design: "tick 31 → l3 의 점선 낱말 'new' 클릭 · 준비(1.6초) 전에 촬영",
    impl: { kind: 'checkpoint', checkpoint: 'caught' },
  },
  {
    id: 'C',
    name: 'answer',
    title: 'C 한 줄 답변',
    design: "tick 31 → 'new' 클릭 → tick 2(준비 끝)",
    impl: { kind: 'checkpoint', checkpoint: 'answer' },
  },
  {
    id: 'D',
    name: 'sentence',
    title: 'D 문장을 붙잡음',
    design: 'tick 8(전사 4줄) → 마지막 문장 클릭 → GuessList',
    impl: { kind: 'checkpoint', checkpoint: 'sentence' },
  },
  {
    id: 'E',
    name: 'folded',
    title: 'E 접힌 메모',
    design: "tick 31 → 'new' 클릭 → tick 2 → tick 18(18초 자동 접힘)",
    impl: { kind: 'checkpoint', checkpoint: 'folded' },
  },
  {
    id: 'F',
    name: 'detail',
    title: 'F 자세히',
    design: "tick 31 → 'new' 클릭 → tick 2 → '자세히 보기 ▸' 클릭",
    impl: { kind: 'checkpoint', checkpoint: 'detail' },
  },
  {
    id: 'G',
    name: 'history',
    title: 'G 기록',
    design: 'tick 31 → 바닥줄 "기록 N" 클릭',
    // 정본과 같은 입구: 바닥줄의 카운트(`SourceFooter onCount`) 하나뿐입니다(docs/design-map.md §4-2-1).
    impl: {
      kind: 'checkpoint',
      checkpoint: 'answer',
      then: { click: '.cm-sf__r', expect: '[data-screen-label="기록"]' },
    },
  },
  {
    id: 'H',
    name: 'tutor-paused',
    title: 'H 튜터 멈춤',
    design: "props aiDown=true → tick 31 → 'new' 클릭(답이 오지 않음)",
    impl: { kind: 'checkpoint', checkpoint: 'waiting' },
  },
  {
    id: 'H1',
    name: 'tiro-paused',
    title: 'H-1 전사 멈춤',
    design: 'tick 31 → props tiroDown=true → tick 1(전사 얼림)',
    // 골든 fixture 의 connector.status 는 전부 connected 라 사건 하나를 손잡이로 더 넣습니다
    // (정본도 이 상태를 Tweaks 의 tiroDown 으로 켭니다 · docs/screenshots/README.md).
    impl: {
      kind: 'checkpoint',
      checkpoint: 'listening',
      then: { connector: ['tiro-share', 'paused'], expect: '.cm-sf--paused' },
    },
  },
];

/** `A-listening.png` 처럼 상태 하나의 파일 이름을 만듭니다. */
export function fileNameOf(state) {
  return `${state.id}-${state.name}.png`;
}

/** `then` 한 손짓을 사람이 읽을 한 토막으로 적습니다. 없으면 빈 문자열입니다. */
export function thenLabelOf(then) {
  if (then === undefined) return '';
  if (then.click !== undefined) return ` → 클릭 ${then.click}`;
  if (then.connector !== undefined) {
    return ` → classmateConnector(${then.connector[0]}, ${then.connector[1]})`;
  }
  return '';
}

/** 구현 쪽이 어떻게 세워졌는지 한 줄로 적습니다(합성 이미지의 오른쪽 제목). */
export function implLabelOf(state) {
  if (state.impl.kind === 'checkpoint') {
    return `구현 · 체크포인트 ${state.impl.checkpoint}${thenLabelOf(state.impl.then)}`;
  }
  if (state.impl.kind === 'clock') return `구현 · advanceTo(${state.impl.iso})`;
  return '구현 · 없음';
}

// ── 정적 서버 ──────────────────────────────────────────────────────────────────

export const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** 확장자로 content-type 을 고릅니다. 모르는 확장자는 내려받기 기본값입니다. */
export function contentTypeOf(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * 요청 경로를 실제 파일 경로로 바꿉니다. 뿌리 폴더 밖으로 나가면 null 입니다.
 *
 *     resolveServedPath('/tmp/design', '/_ds/styles.css')  → '/tmp/design/_ds/styles.css'
 *     resolveServedPath('/tmp/design', '/../secret.txt')   → null
 *
 * `..` 은 정규화해서 뿌리에 붙이지 않고 **그 자리에서 거절합니다.** 정규화는 `/../a` 를 `/a` 로
 * 바꿔 주긴 하지만, 거절하는 쪽이 "밖을 노린 요청이 왔다"를 로그와 시험에서 그대로 보여 줍니다.
 */
export function resolveServedPath(rootDir, requestUrl) {
  const root = path.resolve(rootDir);
  const withoutQuery = String(requestUrl ?? '/').split('?')[0].split('#')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    return null; // %ZZ 같은 깨진 인코딩
  }
  if (decoded.includes('\0')) return null;
  const segments = decoded
    .replaceAll('\\', '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.');
  if (segments.includes('..')) return null;
  const target = path.join(root, ...segments);
  const rel = path.relative(root, target);
  if (rel !== '' && (rel.startsWith('..') || path.isAbsolute(rel))) return null;
  return target;
}

/** `rootDir` 를 127.0.0.1 임의 빈 포트에 정적으로 서빙합니다. `{ port, close }` 를 돌려줍니다. */
export async function startStaticServer(rootDir) {
  const server = createServer((req, res) => {
    const target = resolveServedPath(rootDir, req.url);
    if (target === null) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('밖으로 나가는 경로는 서빙하지 않아요');
      return;
    }
    readFile(target, (error, buffer) => {
      if (error) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('없는 파일이에요');
        return;
      }
      res.writeHead(200, { 'content-type': contentTypeOf(target) });
      res.end(buffer);
    });
  });
  await new Promise((resolve_) => server.listen(0, '127.0.0.1', resolve_));
  const { port } = server.address();
  return {
    port,
    close: () => new Promise((resolve_) => server.close(() => resolve_())),
  };
}

// ── PNG 크기 ───────────────────────────────────────────────────────────────────

/** PNG 머리(IHDR)에서 픽셀 크기를 읽습니다. PNG 가 아니면 null 입니다. */
export function pngSize(buffer) {
  if (!buffer || buffer.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (const [index, byte] of signature.entries()) {
    if (buffer[index] !== byte) return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// ── 합성 HTML ──────────────────────────────────────────────────────────────────

/** HTML 본문에 그대로 넣을 수 없는 다섯 글자를 바꿉니다. */
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function paneHtml(heading, how, shot) {
  const body =
    shot.ok === true
      ? `<img alt="${escapeHtml(heading)}" src="${shot.dataUri}">`
      : `<div class="missing"><b>${escapeHtml(shot.title ?? '없음')}</b><span>${escapeHtml(shot.message ?? '')}</span></div>`;
  return [
    '<figure>',
    `<figcaption>${escapeHtml(heading)}</figcaption>`,
    `<div class="frame">${body}</div>`,
    `<p class="how">${escapeHtml(how)}</p>`,
    '</figure>',
  ].join('\n');
}

/**
 * 왼쪽 정본 · 오른쪽 구현을 같은 높이로 놓은 합성 HTML 을 만듭니다.
 *
 * `left` · `right` 는 `{ ok: true, dataUri }` 또는 `{ ok: false, title, message }` 입니다.
 * 자리표시는 회색 상자로 그립니다.
 */
export function buildCompareHtml({ state, left, right, meta }) {
  const height = meta?.height ?? VIEWPORT.height;
  const caption = [meta?.date, meta?.commit ? `커밋 ${meta.commit}` : null, meta?.note]
    .filter((part) => part !== null && part !== undefined && part !== '')
    .join(' · ');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${escapeHtml(state.title)} — 정본 vs 구현</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    background: #E8E5DF;
    font: 13px/1.5 "Segoe UI", "Malgun Gothic", system-ui, sans-serif;
    color: #2B2A28;
  }
  .sheet {
    display: inline-block;
    padding: 20px 24px 16px;
    background: #FFFFFF;
    border: 1px solid #CFCAC1;
    border-radius: 12px;
  }
  h1 { margin: 0 0 4px; font-size: 17px; font-weight: 700; letter-spacing: -0.2px; }
  .sub { margin: 0 0 16px; font-size: 12px; color: #6E6A63; }
  .cols { display: flex; gap: 24px; align-items: flex-start; }
  figure { margin: 0; width: ${VIEWPORT.width}px; }
  figcaption { margin-bottom: 8px; font-size: 12px; font-weight: 700; color: #3B3A37; }
  .frame {
    height: ${height}px;
    border: 1px solid #CFCAC1;
    border-radius: 8px;
    overflow: hidden;
    background: #F7F5F1;
  }
  .frame img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: top center; }
  .missing {
    display: flex; flex-direction: column; gap: 8px;
    align-items: center; justify-content: center;
    height: 100%; padding: 24px; text-align: center;
    background: repeating-linear-gradient(45deg, #E6E3DD 0 10px, #DEDAD3 10px 20px);
    color: #55524C;
  }
  .missing b { font-size: 14px; }
  .missing span { font-size: 12px; line-height: 1.6; }
  .how { margin: 8px 0 0; font-size: 11px; line-height: 1.6; color: #6E6A63; word-break: keep-all; }
  .meta { margin: 16px 0 0; font-size: 11px; color: #8A857D; }
</style>
</head>
<body>
<div class="sheet" id="sheet">
  <h1>${escapeHtml(state.title)}</h1>
  <p class="sub">${escapeHtml(fileNameOf(state))} · ${VIEWPORT.width}×${VIEWPORT.height} · animations disabled</p>
  <div class="cols">
${paneHtml(`정본 · 상태 ${state.title}`, state.design, left)}
${paneHtml(implLabelOf(state), right.how ?? '', right)}
  </div>
  <p class="meta">${escapeHtml(caption)}</p>
</div>
</body>
</html>`;
}

// ── 콘솔 표 ────────────────────────────────────────────────────────────────────

/** 한글·한자는 두 칸을 먹습니다. 표를 맞추려고 세어 둡니다. */
export function displayWidth(text) {
  let width = 0;
  for (const char of String(text)) {
    const code = char.codePointAt(0);
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6);
    width += wide ? 2 : 1;
  }
  return width;
}

function padCell(text, width) {
  return `${text}${' '.repeat(Math.max(0, width - displayWidth(text)))}`;
}

/** 요약 줄들을 사람이 읽을 표 문자열로 만듭니다. */
export function summaryTable(rows) {
  const header = ['상태', '정본', '구현', '파일', '크기'];
  const body = rows.map((row) => [
    row.title,
    row.canonical.ok ? 'OK' : '실패',
    row.implementation.ok ? 'OK' : row.implementation.kind === 'none' ? '없음' : '실패',
    row.file,
    row.size === null ? '-' : `${row.size.width}×${row.size.height}`,
  ]);
  const widths = header.map((cell, index) =>
    Math.max(displayWidth(cell), ...body.map((line) => displayWidth(line[index]))),
  );
  const line = (cells) => `| ${cells.map((cell, i) => padCell(cell, widths[i])).join(' | ')} |`;
  const rule = `|${widths.map((width) => '-'.repeat(width + 2)).join('|')}|`;
  return [line(header), rule, ...body.map(line)].join('\n');
}

// ── 정본 렌더 ──────────────────────────────────────────────────────────────────

/**
 * dc.html 의 1초 시계를 손으로 돌리는 갈고리입니다.
 *
 * 컴포넌트는 `setInterval(this.tick, 1000)` 하나로 수업 시계를 밉니다. 그 등록만 가로채
 * `window.__dcTick(n)` 으로 n 번 부르면 실제 시간을 기다리지 않고 장면을 만들 수 있습니다.
 * 화면에 보이는 시각은 `clock + 1000 * n` 이라 실제 시간과 무관하게 늘 같습니다.
 */
function tickHook() {
  const realSetInterval = window.setInterval.bind(window);
  window.__dcTicks = [];
  window.setInterval = (handler, delay, ...rest) => {
    if (delay === 1000 && typeof handler === 'function') {
      window.__dcTicks.push(handler);
      return -1 - window.__dcTicks.length;
    }
    return realSetInterval(handler, delay, ...rest);
  };
  window.__dcTick = (times = 1) => {
    for (let i = 0; i < times; i += 1) {
      for (const handler of window.__dcTicks) handler();
    }
  };
}

async function tick(page, times) {
  await page.evaluate((n) => window.__dcTick(n), times);
  await page.waitForTimeout(80);
}

async function setDesignProps(page, overrides) {
  await page.evaluate((props) => {
    window.__dcSetProps(window.__dcRootName(), props);
  }, overrides);
  await page.waitForTimeout(80);
}

/** l3("객체를 직접 new로 만들면 …")의 점선 낱말 `new` 를 누릅니다. */
async function clickNewTerm(page) {
  const clicked = await page.evaluate(() => {
    const lines = [...document.querySelectorAll('.cm-tf__ln')];
    const line = lines.find((node) => node.textContent.includes('객체를 직접'));
    if (!line) return false;
    const term = [...line.querySelectorAll('.cm-tf__term')].find(
      (node) => node.textContent.trim() === 'new',
    );
    if (!term) return false;
    term.click();
    return true;
  });
  if (!clicked) throw new Error("정본에서 l3 의 점선 낱말 'new' 를 찾지 못했어요");
  await page.waitForTimeout(80);
}

async function clickLastSentence(page) {
  const clicked = await page.evaluate(() => {
    const lines = [...document.querySelectorAll('.cm-tf__ln--tap')];
    const last = lines[lines.length - 1];
    if (!last) return false;
    last.click();
    return true;
  });
  if (!clicked) throw new Error('정본에서 누를 문장을 찾지 못했어요');
  await page.waitForTimeout(80);
}

async function clickSelector(page, selector, what) {
  const found = await page.evaluate((css) => {
    const node = document.querySelector(css);
    if (!node) return false;
    node.click();
    return true;
  }, selector);
  if (!found) throw new Error(`정본에서 ${what}(${selector})를 찾지 못했어요`);
  await page.waitForTimeout(80);
}

/** 상태별 조작표입니다. 각 함수는 새로 연 dc.html 페이지 하나를 받습니다. */
const DESIGN_MOVES = {
  A: async (page) => {
    await tick(page, 31);
  },
  B: async (page) => {
    await tick(page, 31);
    await clickNewTerm(page);
  },
  C: async (page) => {
    await tick(page, 31);
    await clickNewTerm(page);
    await tick(page, 2);
  },
  D: async (page) => {
    await tick(page, 8);
    await clickLastSentence(page);
  },
  E: async (page) => {
    await tick(page, 31);
    await clickNewTerm(page);
    await tick(page, 2);
    await tick(page, 18);
  },
  F: async (page) => {
    await tick(page, 31);
    await clickNewTerm(page);
    await tick(page, 2);
    await clickSelector(page, '.cm-note__more', "'자세히 보기'");
  },
  G: async (page) => {
    await tick(page, 31);
    await clickSelector(page, 'button.cm-sf__r', "바닥줄 '기록 N'");
  },
  H: async (page) => {
    await setDesignProps(page, { aiDown: true });
    await tick(page, 31);
    await clickNewTerm(page);
    await tick(page, 2);
  },
  H1: async (page) => {
    await tick(page, 31);
    await setDesignProps(page, { tiroDown: true });
    await tick(page, 1);
  },
};

/** 정본 dc.html 을 상태별로 캡처합니다. 실패한 상태는 이유만 담고 넘어갑니다. */
export async function captureCanonical(states) {
  const results = new Map();
  const fail = (message) => {
    for (const state of states) {
      if (!results.has(state.id)) results.set(state.id, { ok: false, message });
    }
    return results;
  };

  if (!existsSync(path.join(DESIGN_DIR, DESIGN_FILE))) {
    return fail(`정본 파일이 없어요: ${path.join(DESIGN_DIR, DESIGN_FILE)}`);
  }

  const server = await startStaticServer(DESIGN_DIR);
  const url = `http://127.0.0.1:${server.port}/${encodeURIComponent(DESIGN_FILE)}`;
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 760, height: 960 } });
    await page.addInitScript(tickHook);

    for (const state of states) {
      try {
        await page.goto(url, { waitUntil: 'load', timeout: DESIGN_LOAD_TIMEOUT_MS });
        // unpkg 의 React·Babel 이 다 온 뒤에야 dc 런타임이 붙습니다.
        await page.waitForFunction(() => typeof window.__dcSetProps === 'function', {
          timeout: DESIGN_LOAD_TIMEOUT_MS,
        });
        await page.waitForSelector('[data-screen-label]', { timeout: DESIGN_LOAD_TIMEOUT_MS });
        await (DESIGN_MOVES[state.id] ?? DESIGN_MOVES.A)(page);
        // 시연 컬럼은 디자인이 아니라 조작판이라 캡처에서 뺍니다.
        await page.evaluate(() => {
          const aside = document.querySelector('aside[aria-label="시연 컨트롤"]');
          if (aside) aside.style.display = 'none';
        });
        const buffer = await page
          .locator('[data-screen-label]')
          .screenshot({ animations: 'disabled' });
        const label = await page.getAttribute('[data-screen-label]', 'data-screen-label');
        results.set(state.id, { ok: true, buffer, size: pngSize(buffer), screenLabel: label });
      } catch (error) {
        results.set(state.id, { ok: false, message: String(error?.message ?? error) });
      }
    }
    return results;
  } catch (error) {
    return fail(`정본 렌더를 띄우지 못했어요: ${String(error?.message ?? error)}`);
  } finally {
    await browser?.close();
    await server.close();
  }
}

// ── 구현 렌더 ──────────────────────────────────────────────────────────────────

/**
 * 빌드된 확장을 얹고 `sidepanel.html?replay=manual` 을 상태별로 캡처합니다.
 * 로드 방식은 `e2e/extension.spec.ts` 와 같습니다(사이드패널은 브라우저 UI 라 일반 페이지로 엽니다).
 */
export async function captureImplementation(states) {
  const results = new Map();
  const fail = (message) => {
    for (const state of states) {
      if (!results.has(state.id)) {
        results.set(state.id, { ok: false, kind: state.impl.kind, message });
      }
    }
    return results;
  };

  let context;
  try {
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      viewport: VIEWPORT,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    const [existing] = context.serviceWorkers();
    const worker = existing ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(worker.url()).host;
    const url = `chrome-extension://${extensionId}/sidepanel.html?replay=manual`;

    const page = await context.newPage();
    for (const state of states) {
      if (state.impl.kind === 'none') {
        results.set(state.id, { ok: false, kind: 'none', message: state.impl.reason });
        continue;
      }
      try {
        // 상태마다 새로 열어 앞 상태가 남지 않게 합니다(advanceTo 는 되감지 못합니다).
        await page.goto(url);
        await page.waitForFunction(() => typeof window.classmateReplay === 'object');
        if (state.impl.kind === 'checkpoint') {
          await page.evaluate((checkpoint) => {
            window.classmateReplay.goto(checkpoint);
          }, state.impl.checkpoint);
          await applyThen(page, state.impl.then);
        } else {
          await page.evaluate((iso) => {
            window.classmateReplay.advanceTo(iso);
          }, state.impl.iso);
        }
        await page.waitForTimeout(120);
        const buffer = await page.screenshot({ fullPage: false, animations: 'disabled' });
        const facts = await page.evaluate(() => ({
          screen: document.querySelector('[data-screen-label]')?.getAttribute('data-screen-label') ?? null,
          note: document.querySelector('[data-note]')?.getAttribute('data-note') ?? null,
          footerPaused: document.querySelector('.cm-sf--paused') !== null,
          footerOff: document.querySelector('.cm-sf--off') !== null,
        }));
        results.set(state.id, {
          ok: true,
          kind: state.impl.kind,
          buffer,
          size: pngSize(buffer),
          facts,
        });
      } catch (error) {
        results.set(state.id, {
          ok: false,
          kind: state.impl.kind,
          message: String(error?.message ?? error),
        });
      }
    }
    return results;
  } catch (error) {
    return fail(`확장을 얹지 못했어요: ${String(error?.message ?? error)}`);
  } finally {
    await context?.close();
  }
}

/**
 * 체크포인트 뒤의 한 손짓입니다. 값은 `STATES` 에 박힌 상수뿐이라 페이지에서 온 문자열을
 * 실행하는 일은 없습니다(§4-7).
 */
async function applyThen(page, then) {
  if (then === undefined) return;
  if (then.click !== undefined) {
    await page.locator(then.click).click();
  }
  if (then.connector !== undefined) {
    await page.evaluate(([connector, connectorState]) => {
      window.classmateConnector(connector, connectorState);
    }, then.connector);
  }
  if (then.expect !== undefined) {
    await page.locator(then.expect).first().waitFor({ state: 'visible', timeout: 5_000 });
  }
}

// ── 합성 ───────────────────────────────────────────────────────────────────────

function toDataUri(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

/** 두 캡처를 한 장으로 합쳐 PNG 로 씁니다. 파일 크기를 돌려줍니다. */
async function composeAll(states, canonical, implementation, meta) {
  const browser = await chromium.launch();
  const sizes = new Map();
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 1040 } });
    for (const state of states) {
      const shot = canonical.get(state.id);
      const impl = implementation.get(state.id);
      const left = shot.ok
        ? { ok: true, dataUri: toDataUri(shot.buffer) }
        : { ok: false, title: '정본 렌더 실패', message: shot.message };
      const right = impl.ok
        ? { ok: true, dataUri: toDataUri(impl.buffer), how: implHow(state, impl) }
        : {
            ok: false,
            title: impl.kind === 'none' ? '구현 없음' : '구현 캡처 실패',
            message: impl.message,
            how: '',
          };
      const html = buildCompareHtml({ state, left, right, meta });
      await page.setContent(html, { waitUntil: 'load' });
      const buffer = await page.locator('#sheet').screenshot({ animations: 'disabled' });
      const file = path.join(OUTPUT_DIR, fileNameOf(state));
      writeFileSync(file, buffer);
      sizes.set(state.id, pngSize(buffer));
    }
    return sizes;
  } finally {
    await browser.close();
  }
}

function implHow(state, impl) {
  if (state.impl.kind === 'checkpoint') {
    const paused = impl.facts?.footerPaused === true ? ' · 바닥줄 호박색' : '';
    return `window.classmateReplay.goto('${state.impl.checkpoint}')${thenLabelOf(state.impl.then)} · 화면 ${impl.facts?.screen ?? '?'} · note ${impl.facts?.note ?? '-'}${paused}`;
  }
  const footer = impl.facts?.footerPaused === true ? '바닥줄 호박색' : '바닥줄 정상(전사 멈춤 아님)';
  return `window.classmateReplay.advanceTo('${state.impl.iso}') · ${footer}`;
}

// ── 실행 ───────────────────────────────────────────────────────────────────────

function shortCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

function today() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 요약 줄 하나를 만듭니다(파일로 남고 콘솔 표에도 씁니다). */
export function summaryRow(state, canonical, implementation, size) {
  return {
    id: state.id,
    name: state.name,
    title: state.title,
    file: fileNameOf(state),
    size: size ?? null,
    canonical: {
      ok: canonical.ok === true,
      move: state.design,
      size: canonical.size ?? null,
      message: canonical.ok === true ? null : (canonical.message ?? null),
    },
    implementation: {
      ok: implementation.ok === true,
      kind: implementation.kind ?? state.impl.kind,
      checkpoint: state.impl.kind === 'checkpoint' ? state.impl.checkpoint : null,
      then: state.impl.kind === 'checkpoint' ? (state.impl.then ?? null) : null,
      iso: state.impl.kind === 'clock' ? state.impl.iso : null,
      size: implementation.size ?? null,
      facts: implementation.facts ?? null,
      message: implementation.ok === true ? null : (implementation.message ?? null),
    },
  };
}

export async function main() {
  if (!existsSync(EXTENSION_PATH)) {
    console.error('빌드 산출물이 없어요:', EXTENSION_PATH);
    console.error('먼저 `pnpm --filter @classmate/browser-extension build` 를 돌려 주세요.');
    return 1;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`정본 렌더 ${STATES.length}개를 캡처합니다 (${DESIGN_FILE}).`);
  const canonical = await captureCanonical(STATES);
  console.log(`구현 사이드패널을 캡처합니다 (${EXTENSION_PATH}).`);
  const implementation = await captureImplementation(STATES);

  const meta = {
    date: today(),
    commit: shortCommit(),
    height: VIEWPORT.height,
    note: `정본 ${DESIGN_FILE} · 구현 sidepanel.html?replay=manual`,
  };
  console.log('두 캡처를 나란히 합성합니다.');
  const sizes = await composeAll(STATES, canonical, implementation, meta);

  const rows = STATES.map((state) =>
    summaryRow(state, canonical.get(state.id), implementation.get(state.id), sizes.get(state.id)),
  );
  const summary = {
    generatedAt: new Date().toISOString(),
    commit: meta.commit,
    viewport: VIEWPORT,
    design: { dir: path.relative(repoRoot, DESIGN_DIR).replaceAll('\\', '/'), file: DESIGN_FILE },
    implementation: {
      output: path.relative(repoRoot, EXTENSION_PATH).replaceAll('\\', '/'),
      page: 'sidepanel.html?replay=manual',
    },
    rows,
  };
  writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  console.log('');
  console.log(summaryTable(rows));
  console.log('');

  const bothFailed = rows.filter((row) => !row.canonical.ok && !row.implementation.ok);
  for (const row of rows) {
    if (!row.canonical.ok) console.error(`정본 실패 ${row.id}: ${row.canonical.message}`);
    if (!row.implementation.ok && row.implementation.kind !== 'none') {
      console.error(`구현 실패 ${row.id}: ${row.implementation.message}`);
    }
  }
  if (bothFailed.length > 0) {
    console.error('');
    console.error(
      `양쪽이 모두 비어 있는 상태가 ${bothFailed.length}개예요: ${bothFailed.map((row) => row.id).join(', ')}`,
    );
    return 1;
  }
  console.log(`비교 이미지 ${rows.length}장과 summary.json 을 ${path.relative(repoRoot, OUTPUT_DIR).replaceAll('\\', '/')} 에 두었어요.`);
  return 0;
}

// 진입점 가드입니다. `node scripts/compare-design.mjs` 로 직접 돌릴 때만 브라우저를 띄웁니다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
