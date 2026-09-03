// ask-once.mjs 의 순수 함수만 봅니다. 실행 파일도 제공자 CLI 도 절대 띄우지 않습니다.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ASK_ONCE_PERIOD_ID,
  CLI_ENV_NAME,
  COST_FLAG,
  MODEL_ENV_NAME,
  buildAsk,
  buildAskEnv,
  describeFrame,
  isFinal,
  parseArgs,
  verdict,
} from './ask-once.mjs';

test('비용 동의 플래그가 없으면 accept 가 false 다', () => {
  assert.equal(parseArgs([]).accept, false);
  assert.equal(parseArgs([COST_FLAG]).accept, true);
});

test('인자를 읽고 모르는 인자는 거절한다', () => {
  const parsed = parseArgs([COST_FLAG, '--word', '상속', '--model', 'x', '--timeout-ms', '10']);
  assert.equal(parsed.word, '상속');
  assert.equal(parsed.model, 'x');
  assert.equal(parsed.timeoutMs, 10);
  assert.throws(() => parseArgs(['--nope']), /모르는 인자/);
  assert.throws(() => parseArgs(['--word']), /값이 필요/);
  assert.throws(() => parseArgs(['--timeout-ms', '0']), /양수/);
});

test('자식 환경에 CLI 경로를 넣고 codex 변수는 지운다', () => {
  const env = buildAskEnv({ PATH: 'p', CLASSMATE_CODEX_CLI: 'c', [MODEL_ENV_NAME]: 'old' }, { cli: 'C:/x/claude.cmd', dataDir: 'D:/tmp' });
  assert.equal(env[CLI_ENV_NAME], 'C:/x/claude.cmd');
  assert.equal(env.CLASSMATE_CODEX_CLI, undefined);
  assert.equal(env[MODEL_ENV_NAME], undefined);
  assert.equal(env.CLASSMATE_DATA_DIR, 'D:/tmp');
  assert.equal(env.PATH, 'p');
  assert.equal(buildAskEnv({}, { cli: 'a', dataDir: 'b', model: 'm' })[MODEL_ENV_NAME], 'm');
  assert.throws(() => buildAskEnv({}, { cli: '', dataDir: 'b' }), /cli 경로/);
  assert.throws(() => buildAskEnv({}, { cli: 'a', dataDir: '' }), /dataDir/);
});

test('봉투는 1999 년 교시와 빈 봉인을 쓰고 question 은 줄 때만 붙는다', () => {
  const word = buildAsk({ word: 'new' });
  assert.equal(word.type, 'tutor.ask');
  assert.equal(word.periodId, ASK_ONCE_PERIOD_ID);
  assert.match(word.periodId, /^1999-/);
  assert.equal(word.provider, 'claude');
  assert.deepEqual(word.snapshot, { transcriptSegmentIds: [], ages: { transcriptSec: null, screenSec: null, editorSec: null } });
  assert.equal('question' in word, false);
  const sentence = buildAsk({ word: 'new', question: '이게 뭐예요' });
  assert.equal(sentence.question, '이게 뭐예요');
});

test('끝내는 사건과 판정', () => {
  const ev = (type, payload = {}) => ({ type: 'tutor.event', periodId: ASK_ONCE_PERIOD_ID, event: { type, payload } });
  assert.equal(isFinal(ev('answer.completed')), true);
  assert.equal(isFinal(ev('answer.recovered')), true);
  assert.equal(isFinal(ev('answer.failed')), false);
  assert.equal(isFinal(ev('question.asked')), false);
  assert.equal(isFinal({ type: 'error', reason: 'provider-unavailable' }), true);
  assert.equal(isFinal({ type: 'tutor.accepted' }), false);

  assert.deepEqual(verdict([{ type: 'tutor.accepted' }, ev('question.asked'), ev('answer.completed')], false).ok, true);
  assert.equal(verdict([ev('answer.failed'), ev('answer.recovered')], false).ok, true);
  assert.equal(verdict([{ type: 'error', reason: 'provider-unavailable' }], false).ok, false);
  assert.match(verdict([{ type: 'error', reason: 'provider-unavailable' }], false).label, /provider-unavailable/);
  assert.equal(verdict([ev('answer.failed')], true).ok, false);
  assert.equal(verdict([], true).ok, false);
});

test('프레임 설명 한 줄', () => {
  assert.match(describeFrame({ type: 'tutor.accepted', questionId: 'q1' }), /q1/);
  assert.match(describeFrame({ type: 'error', reason: 'x', message: 'm' }), /error \/ x · m/);
  const answer = { type: 'tutor.event', event: { type: 'answer.completed', payload: { evidence: 'live', provider: 'claude', answer: { conclusion: '한 줄' } } } };
  assert.match(describeFrame(answer), /answer\.completed · "한 줄"/);
  assert.match(describeFrame({ type: 'tutor.event', event: { type: 'connector.status', payload: { connector: 'provider', state: 'off', reason: 'r' } } }), /provider off r/);
});
