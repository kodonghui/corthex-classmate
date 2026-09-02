// smoke-host.mjs 시험입니다.
//
// 여기서는 **실행 파일을 띄우지 않습니다.** 프레임 만들기와 봉투 모양, 응답 이름 붙이기만 봅니다.
// 실제 왕복은 `node installer/windows/smoke-host.mjs` 가 사람 앞에서 합니다.
//
// 실행: node --test installer/windows/smoke-host.test.mjs

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeFrames } from '../../apps/native-host/scripts/host-roundtrip.mjs';
import {
  SMOKE_PERIOD_ID,
  SMOKE_QUESTION_ID,
  buildTutorAsk,
  describeAskReply,
  encodeAskFrame,
  parseArgs,
} from './smoke-host.mjs';

describe('프레임 만들기', () => {
  it('앞 4바이트가 리틀엔디언 본문 길이다', () => {
    const frame = encodeAskFrame();
    const declared = frame.readUInt32LE(0);

    assert.equal(frame.length, 4 + declared);
    assert.equal(declared, Buffer.byteLength(JSON.stringify(buildTutorAsk()), 'utf8'));
  });

  it('만든 프레임을 host-roundtrip 의 해독기가 그대로 되읽는다', () => {
    const ask = buildTutorAsk();
    const { frames, rest } = decodeFrames(encodeAskFrame(ask));

    assert.equal(frames.length, 1);
    assert.equal(rest.length, 0);
    assert.deepEqual(frames[0], ask);
  });

  it('두 프레임을 이어 붙여도 경계가 살아 있다', () => {
    const one = buildTutorAsk({ questionId: 'q-smoke-001' });
    const two = buildTutorAsk({ questionId: 'q-smoke-002' });
    const { frames } = decodeFrames(Buffer.concat([encodeAskFrame(one), encodeAskFrame(two)]));

    assert.equal(frames.length, 2);
    assert.equal(frames[1].questionId, 'q-smoke-002');
  });
});

describe('tutor.ask 봉투', () => {
  const ask = buildTutorAsk();

  it('계약 (마) 의 칸을 그대로 담는다', () => {
    assert.equal(ask.type, 'tutor.ask');
    assert.equal(ask.periodId, SMOKE_PERIOD_ID);
    assert.equal(ask.questionId, SMOKE_QUESTION_ID);
    assert.ok(['missed', 'confused', 'code-flow', 'teacher-evidence', 'free'].includes(ask.kind));
    assert.ok(['claude', 'codex'].includes(ask.provider));
  });

  it('봉인은 비어 있고 자료 나이 세 칸은 null 이다', () => {
    assert.deepEqual(ask.snapshot.transcriptSegmentIds, []);
    assert.deepEqual(ask.snapshot.ages, { transcriptSec: null, screenSec: null, editorSec: null });
  });

  it('전사·화면 문장을 싣지 않는다', () => {
    // 스모크는 배선만 보는 자리라 수업 자료가 프레임에 실리면 안 됩니다(§4-3·§4-5).
    const text = JSON.stringify(ask);
    assert.ok(!text.includes('transcript"'));
    assert.equal(ask.snapshot.screenFrameId, undefined);
    assert.equal(ask.snapshot.editorContextId, undefined);
  });

  it('question 을 주면 4096 바이트 상한 안에 있어야 한다', () => {
    const question = '왜 new 로 직접 만들면 안 되나요?';
    const withQuestion = { ...buildTutorAsk({ kind: 'free' }), question };

    assert.ok(Buffer.byteLength(withQuestion.question, 'utf8') <= 4096);
  });
});

describe('응답에 이름 붙이기', () => {
  it('지금 브랜치의 기대값을 알아본다', () => {
    const said = describeAskReply({ type: 'error', reason: 'unknown-message-type' });
    assert.match(said, /단위 5 병합 전/);
  });

  it('단위 5·6 병합 뒤의 답도 알아본다', () => {
    assert.match(describeAskReply({ type: 'error', reason: 'not-implemented' }), /단위 5/);
    assert.match(describeAskReply({ type: 'tutor.accepted' }), /단위 6/);
    assert.match(describeAskReply({ type: 'error', reason: 'provider-unavailable' }), /제공자/);
  });

  it('모르는 답도 조용히 넘기지 않는다', () => {
    assert.match(describeAskReply({ type: 'pong' }), /모르는 응답/);
    assert.match(describeAskReply(null), /읽지 못했어요/);
  });
});

describe('인자 읽기', () => {
  it('--exe 를 읽고 기본값은 비어 있다', () => {
    assert.deepEqual(parseArgs([]), { exe: null, help: false });
    assert.equal(parseArgs(['--exe', 'C:/x/classmate-host.exe']).exe, 'C:/x/classmate-host.exe');
  });

  it('모르는 인자는 오류로 세운다', () => {
    assert.throws(() => parseArgs(['--fast']), /모르는 인자/);
  });
});
