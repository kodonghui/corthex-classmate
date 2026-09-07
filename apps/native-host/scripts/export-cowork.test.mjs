import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studyMarkdown, exportCowork } from './export-cowork.mjs';

test('latest transcript revision, every question, and linked response/image survive', () => {
  const text = studyMarkdown({ sessionId: '2000-01-01-p1', artifacts: [{ id: 'image1', path: 'frames/image1.jpg' }], moments: [
    { id:'t1', type:'transcript', at:'2000-01-01T01:00:00Z', text:'old revision', transcript:{segmentId:'t'} },
    { id:'t2', type:'transcript', at:'2000-01-01T01:00:01Z', text:'final revision', transcript:{segmentId:'t'} },
    { id:'q1', type:'question', at:'2000-01-01T01:00:02Z', text:'first question', assetRefIds:['image1'] },
    { id:'q2', type:'question', at:'2000-01-01T01:00:03Z', text:'second question' },
    { id:'a1', type:'response', response:{questionId:'q1', conclusion:'first answer'} },
  ] });
  assert.ok(!text.includes('old revision'));
  for (const expected of ['final revision','first question','second question','first answer','frames/image1.jpg','저장된 답변 없음']) assert.ok(text.includes(expected));
});
test('invalid session paths are rejected before process or filesystem writes', () => {
  assert.throws(() => exportCowork({ sessionId:'../../escape' }), /sessionId/);
});
