// compare-design.mjs 시험입니다.
//
// 여기서는 **브라우저를 띄우지 않습니다.** 표·문자열·경로 계산처럼 눈으로 확인하기 어려운
// 순수 함수만 봅니다. 실제 렌더와 합성은 `node apps/browser-extension/scripts/compare-design.mjs`
// 가 하고, 그 결과는 `docs/screenshots/compare/summary.json` 과 사람 눈으로 확인합니다.
//
// 실행: node --test apps/browser-extension/scripts/compare-design.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  CONTENT_TYPES,
  STATES,
  VIEWPORT,
  buildCompareHtml,
  captureVerdict,
  contentTypeOf,
  displayWidth,
  escapeHtml,
  fileNameOf,
  implLabelOf,
  thenLabelOf,
  pngSize,
  resolveServedPath,
  summaryRow,
  summaryTable,
} from './compare-design.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const replayStorePath = path.resolve(scriptDir, '..', 'src', 'panel', 'replay-store.ts');

/** `replay-store.ts` 의 `CHECKPOINTS` 배열에 적힌 이름을 그대로 읽어 옵니다(TS 를 import 하지 않으려고). */
function checkpointsFromSource() {
  const source = readFileSync(replayStorePath, 'utf8');
  const block = /export const CHECKPOINTS = \[([\s\S]*?)\] as const;/.exec(source);
  assert.ok(block, 'replay-store.ts 에서 CHECKPOINTS 배열을 찾지 못했어요');
  return [...block[1].matchAll(/"([a-z]+)"/g)].map((match) => match[1]);
}

const okShot = { ok: true, dataUri: 'data:image/png;base64,AAAA' };

describe('상태 ↔ 체크포인트 표', () => {
  it('상태 아홉 개가 A~H(그리고 H-1)를 한 번씩만 덮는다', () => {
    assert.equal(STATES.length, 9);
    const ids = STATES.map((state) => state.id);
    assert.deepEqual(ids, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'H1']);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('구현 쪽 체크포인트는 replay-store.ts 의 CHECKPOINTS 에 실제로 있는 이름이다', () => {
    const known = checkpointsFromSource();
    assert.ok(known.length >= 9, `CHECKPOINTS 를 못 읽었어요: ${JSON.stringify(known)}`);
    for (const state of STATES) {
      if (state.impl.kind !== 'checkpoint') continue;
      assert.ok(
        known.includes(state.impl.checkpoint),
        `${state.id} 의 체크포인트 ${state.impl.checkpoint} 가 CHECKPOINTS 에 없어요`,
      );
    }
  });

  it('골든 시나리오의 대응이 그대로 유지된다', () => {
    const pairs = Object.fromEntries(
      STATES.filter((state) => state.impl.kind === 'checkpoint').map((state) => [
        state.id,
        state.impl.checkpoint,
      ]),
    );
    assert.deepEqual(pairs, {
      A: 'listening',
      B: 'caught',
      C: 'answer',
      D: 'sentence',
      E: 'folded',
      F: 'detail',
      G: 'answer',
      H: 'waiting',
      H1: 'listening',
    });
  });

  it('기록은 답 장면에서 바닥줄 카운트를 눌러 들어간다(정본과 같은 입구)', () => {
    const history = STATES.find((state) => state.id === 'G');
    assert.equal(history.impl.kind, 'checkpoint');
    assert.equal(history.impl.checkpoint, 'answer');
    assert.deepEqual(history.impl.then, { click: '.cm-sf__r', expect: '[data-screen-label="기록"]' });
  });

  it('전사 멈춤은 듣는 중 장면에 connector.status 한 줄을 손잡이로 넣어 세운다', () => {
    const tiro = STATES.find((state) => state.id === 'H1');
    assert.equal(tiro.impl.kind, 'checkpoint');
    assert.equal(tiro.impl.checkpoint, 'listening');
    assert.deepEqual(tiro.impl.then, { connector: ['tiro-share', 'paused'], expect: '.cm-sf--paused' });
  });

  it('then 은 클릭이나 커넥터 한 손짓만 적고, 없으면 빈 문자열이다', () => {
    assert.equal(thenLabelOf(undefined), '');
    assert.equal(thenLabelOf({ click: '.cm-sf__r' }), ' → 클릭 .cm-sf__r');
    assert.equal(
      thenLabelOf({ connector: ['tiro-share', 'paused'] }),
      ' → classmateConnector(tiro-share, paused)',
    );
  });

  it('파일 이름은 <상태>-<이름>.png 이고 서로 겹치지 않는다', () => {
    const files = STATES.map(fileNameOf);
    assert.equal(files[0], 'A-listening.png');
    assert.equal(files.at(-1), 'H1-tiro-paused.png');
    assert.equal(new Set(files).size, files.length);
    for (const file of files) assert.match(file, /^[A-H]1?-[a-z-]+\.png$/);
  });

  it('오른쪽 제목은 세우는 방법을 그대로 적는다', () => {
    assert.equal(implLabelOf(STATES[0]), '구현 · 체크포인트 listening');
    assert.equal(
      implLabelOf(STATES.at(-1)),
      '구현 · 체크포인트 listening → classmateConnector(tiro-share, paused)',
    );
    assert.equal(
      implLabelOf(STATES.find((state) => state.id === 'G')),
      '구현 · 체크포인트 answer → 클릭 .cm-sf__r',
    );
    assert.equal(
      implLabelOf({ impl: { kind: 'clock', iso: '2026-09-02T10:31:35+09:00' } }),
      '구현 · advanceTo(2026-09-02T10:31:35+09:00)',
    );
    assert.equal(implLabelOf({ impl: { kind: 'none', reason: '아직' } }), '구현 · 없음');
  });
});

describe('합성 HTML', () => {
  const state = STATES[0];

  it('두 캡처가 다 있으면 data URI 두 개와 캡션이 들어간다', () => {
    const html = buildCompareHtml({
      state,
      left: okShot,
      right: { ok: true, dataUri: 'data:image/png;base64,BBBB', how: '체크포인트 listening' },
      meta: { date: '2026-09-03', commit: '22f4058' },
    });
    assert.equal(html.match(/data:image\/png;base64,/g).length, 2);
    assert.ok(html.includes('src="data:image/png;base64,AAAA"'));
    assert.ok(html.includes('src="data:image/png;base64,BBBB"'));
    assert.ok(html.includes('정본 · 상태 A 듣는 중'));
    assert.ok(html.includes('구현 · 체크포인트 listening'));
    assert.ok(html.includes('2026-09-03 · 커밋 22f4058'));
    assert.ok(html.includes('A-listening.png'));
  });

  it('두 그림이 같은 높이 상자에 들어간다', () => {
    const html = buildCompareHtml({
      state,
      left: okShot,
      right: okShot,
      meta: { date: '2026-09-03', commit: 'abc1234', height: VIEWPORT.height },
    });
    assert.ok(html.includes(`height: ${VIEWPORT.height}px;`));
    assert.equal(html.match(/class="frame"/g).length, 2);
  });

  it('구현이 없으면 회색 자리표시 상자에 문구를 넣는다', () => {
    const html = buildCompareHtml({
      state: STATES.find((item) => item.id === 'G'),
      left: okShot,
      right: { ok: false, title: '구현 없음', message: '구현에 기록 화면이 없어요' },
      meta: { date: '2026-09-03', commit: 'abc1234' },
    });
    assert.equal(html.match(/data:image\/png;base64,/g).length, 1);
    assert.ok(html.includes('class="missing"'));
    assert.ok(html.includes('구현 없음'));
    assert.ok(html.includes('구현에 기록 화면이 없어요'));
  });

  it('정본이 실패하면 왼쪽도 자리표시가 된다', () => {
    const html = buildCompareHtml({
      state,
      left: { ok: false, title: '정본 렌더 실패', message: 'unpkg 를 받지 못했어요' },
      right: okShot,
      meta: { date: '2026-09-03', commit: 'abc1234' },
    });
    assert.ok(html.includes('정본 렌더 실패'));
    assert.ok(html.includes('unpkg 를 받지 못했어요'));
  });

  it('문구에 든 꺾쇠와 따옴표는 그대로 새어 나가지 않는다', () => {
    assert.equal(escapeHtml('<b>"x" & \'y\'</b>'), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
    const html = buildCompareHtml({
      state,
      left: okShot,
      right: { ok: false, title: '구현 캡처 실패', message: '<script>alert(1)</script>' },
      meta: { date: '2026-09-03', commit: 'abc1234' },
    });
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });
});

describe('content-type', () => {
  it('확장자마다 정해진 타입을 준다', () => {
    assert.equal(contentTypeOf('Classmate Side Panel.dc.html'), 'text/html; charset=utf-8');
    assert.equal(contentTypeOf('/a/_ds_bundle.js'), 'text/javascript; charset=utf-8');
    assert.equal(contentTypeOf('tokens/colors.css'), 'text/css; charset=utf-8');
    assert.equal(contentTypeOf('_ds_manifest.json'), 'application/json; charset=utf-8');
    assert.equal(contentTypeOf('font.woff2'), 'font/woff2');
  });

  it('대문자 확장자도 같게 본다', () => {
    assert.equal(contentTypeOf('A.HTML'), CONTENT_TYPES['.html']);
  });

  it('모르는 확장자는 내려받기 기본값이다', () => {
    assert.equal(contentTypeOf('README'), 'application/octet-stream');
    assert.equal(contentTypeOf('a.zzz'), 'application/octet-stream');
  });
});

describe('정적 서버 경로', () => {
  const root = path.resolve('/tmp/design');

  it('뿌리 안의 파일은 절대 경로로 바꿔 준다', () => {
    assert.equal(resolveServedPath(root, '/_ds/styles.css'), path.join(root, '_ds', 'styles.css'));
    assert.equal(
      resolveServedPath(root, '/Classmate%20Side%20Panel.dc.html'),
      path.join(root, 'Classmate Side Panel.dc.html'),
    );
    assert.equal(resolveServedPath(root, '/a.js?v=1#top'), path.join(root, 'a.js'));
    assert.equal(resolveServedPath(root, '/'), root);
  });

  it('뿌리 밖으로 나가는 경로는 거절한다', () => {
    assert.equal(resolveServedPath(root, '/../secret.txt'), null);
    assert.equal(resolveServedPath(root, '/_ds/../../secret.txt'), null);
    assert.equal(resolveServedPath(root, '/%2e%2e/%2e%2e/secret.txt'), null);
    assert.equal(resolveServedPath(root, '/..%2f..%2fsecret.txt'), null);
    assert.equal(resolveServedPath(root, '/a/..\\..\\secret.txt'), null);
  });

  it('깨진 인코딩과 널 문자도 거절한다', () => {
    assert.equal(resolveServedPath(root, '/%ZZ'), null);
    assert.equal(resolveServedPath(root, '/a%00.js'), null);
  });
});

describe('PNG 크기', () => {
  it('IHDR 에서 폭과 높이를 읽는다', () => {
    const buffer = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
    buffer.writeUInt32BE(834, 16);
    buffer.writeUInt32BE(1086, 20);
    assert.deepEqual(pngSize(buffer), { width: 834, height: 1086 });
  });

  it('PNG 가 아니면 null 이다', () => {
    assert.equal(pngSize(Buffer.from('not a png at all, really not')), null);
    assert.equal(pngSize(Buffer.alloc(4)), null);
    assert.equal(pngSize(null), null);
  });
});

describe('콘솔 표', () => {
  it('한글 폭을 두 칸으로 세어 칸을 맞춘다', () => {
    assert.equal(displayWidth('OK'), 2);
    assert.equal(displayWidth('듣는 중'), 7);
  });

  it('상태별 성공·실패와 파일 이름을 한 줄씩 적는다', () => {
    const rows = [
      summaryRow(STATES[0], { ok: true, size: { width: 382, height: 902 } }, { ok: true, kind: 'checkpoint' }, { width: 834, height: 1086 }),
      summaryRow(
        STATES.find((state) => state.id === 'G'),
        { ok: true },
        { ok: false, kind: 'none', message: '없어요' },
        { width: 834, height: 1086 },
      ),
    ];
    const table = summaryTable(rows);
    const lines = table.split('\n');
    assert.equal(lines.length, 4); // 머리 + 구분선 + 두 줄
    assert.ok(lines[0].includes('상태'));
    assert.ok(lines[2].includes('A-listening.png'));
    assert.ok(lines[2].includes('834×1086'));
    assert.ok(lines[3].includes('없음'));
    // 칸이 맞으면 모든 줄의 표시 폭이 같습니다.
    assert.equal(new Set(lines.map(displayWidth)).size, 1);
  });

  it('요약 줄은 조작 방법과 실패 이유를 함께 담는다', () => {
    // 지금 STATES 에는 none 이 없으므로 가짜 상태로 그 갈래를 봅니다.
    const missing = {
      id: 'Z',
      name: 'missing',
      title: 'Z 없음',
      design: 'tick 1',
      impl: { kind: 'none', reason: '아직 없어요' },
    };
    const row = summaryRow(
      missing,
      { ok: false, message: '정본을 못 열었어요' },
      { ok: false, kind: 'none', message: '구현에 기록 화면이 없어요' },
      null,
    );
    assert.equal(row.canonical.ok, false);
    assert.equal(row.canonical.message, '정본을 못 열었어요');
    assert.equal(row.implementation.kind, 'none');
    assert.equal(row.implementation.checkpoint, null);
    assert.equal(row.size, null);
    assert.ok(row.canonical.move.length > 0);
  });
});

describe('종료 코드 판정', () => {
  // 되돌리면(= "양쪽 다 실패" 만 세면) "정본 전멸" 절이 무너집니다.

  /** 판정만 보는 최소 요약 줄입니다. summaryRow 의 모양 중 쓰는 칸만 담습니다. */
  const row = (id, canonicalOk, implementationOk, kind = 'checkpoint') => ({
    id,
    canonical: { ok: canonicalOk },
    implementation: { ok: implementationOk, kind },
  });

  it('양쪽 다 서면 0 이다', () => {
    const verdict = captureVerdict([row('A', true, true), row('B', true, true)]);
    assert.equal(verdict.code, 0);
    assert.deepEqual(verdict.reasons, []);
  });

  it('정본이 전멸하면 구현이 다 서도 실패다', () => {
    // unpkg 가 막혀 .dc.html 이 자리표시만 그린 경우입니다. 예전에는 0 으로 끝났습니다.
    const rows = [row('A', false, true), row('B', false, true), row('C', false, true)];
    const verdict = captureVerdict(rows);

    assert.equal(verdict.code, 1);
    assert.ok(verdict.reasons.some((reason) => reason.includes('정본이 3장 모두 서지 않았어요')));
  });

  it('구현이 전멸해도 실패다', () => {
    const verdict = captureVerdict([row('A', true, false), row('B', true, false)]);
    assert.equal(verdict.code, 1);
    assert.ok(verdict.reasons.some((reason) => reason.includes('구현이 2장 모두 서지 않았어요')));
  });

  it('한 장씩의 실패는 종료 코드로 세지 않는다', () => {
    const verdict = captureVerdict([row('A', true, true), row('B', false, true), row('C', true, false)]);
    assert.equal(verdict.code, 0);
  });

  it('양쪽이 모두 빈 줄이 하나라도 있으면 실패다', () => {
    const verdict = captureVerdict([row('A', true, true), row('B', false, false)]);
    assert.equal(verdict.code, 1);
    assert.ok(verdict.reasons.some((reason) => reason.includes('B')));
  });

  it('구현이 아예 없는 상태(kind=none)는 구현 전멸로 세지 않는다', () => {
    const verdict = captureVerdict([row('A', true, true), row('Z', true, false, 'none')]);
    assert.equal(verdict.code, 0);
  });

  it('줄이 하나도 없으면 실패다', () => {
    assert.equal(captureVerdict([]).code, 1);
  });
});
