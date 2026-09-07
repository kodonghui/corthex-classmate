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
  ASK_TIMEOUT_MS,
  SCRUBBED_ENV_NAMES,
  SMOKE_PERIOD_ID,
  SMOKE_QUESTION_ID,
  buildSmokeEnv,
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

describe('돈이 나가지 않게 하는 장치', () => {
  // 되돌리면(= askOnce 가 부모 환경을 그대로 물려주면) 이 절이 무너집니다.

  it('제공자 CLI 변수를 자식 환경에서 지운다', () => {
    const parent = {
      PATH: '/usr/bin',
      CLASSMATE_CLAUDE_CLI: 'C:/tools/claude.exe',
      CLASSMATE_CODEX_CLI: 'C:/tools/codex.exe',
    };
    const child = buildSmokeEnv(parent, 'C:/Temp/classmate-smoke-abc');
    assert.equal(child.CLASSMATE_DISABLE_CLI_DISCOVERY, '1');

    for (const name of ['CLASSMATE_CLAUDE_CLI', 'CLASSMATE_CODEX_CLI']) {
      assert.ok(!(name in child), `${name} 이 자식 환경에 남아 있어요`);
      assert.ok(SCRUBBED_ENV_NAMES.includes(name), `${name} 이 지울 목록에 없어요`);
    }
    // 부모는 그대로 둡니다(호출한 쪽의 process.env 를 망가뜨리면 안 됩니다).
    assert.equal(parent.CLASSMATE_CLAUDE_CLI, 'C:/tools/claude.exe');
    assert.equal(child.PATH, '/usr/bin');
  });

  it('저장 폴더를 넘겨준 임시 폴더로 돌린다', () => {
    const child = buildSmokeEnv({ CLASSMATE_DATA_DIR: 'C:/Users/x/AppData/Local/CorthexClassmate/sessions' }, 'C:/Temp/smoke');
    assert.equal(child.CLASSMATE_DATA_DIR, 'C:/Temp/smoke');
  });

  it('교시 id 가 실제 수업과 겹칠 수 없다', () => {
    const year = Number(SMOKE_PERIOD_ID.slice(0, 4));
    assert.ok(Number.isInteger(year), `${SMOKE_PERIOD_ID} 앞 네 글자가 연도가 아니에요`);
    assert.ok(year < 2000, `${SMOKE_PERIOD_ID} 는 실제 교시와 겹칠 수 있는 연도예요`);
  });

  it('② 의 상한이 호스트의 45초 종료 예산보다 길다', () => {
    assert.ok(ASK_TIMEOUT_MS > 45_000, `${ASK_TIMEOUT_MS} ms 는 호스트 45초 정리보다 짧아요`);
  });
});

describe('응답에 이름 붙이기', () => {
  it('unknown-message-type 은 기대값이 아니라 퇴행 의심이다', () => {
    const said = describeAskReply({ type: 'error', reason: 'unknown-message-type' });
    assert.match(said, /퇴행 의심/);
    assert.ok(!/기대값/.test(said), '아직도 "기대값" 이라고 적혀 있어요');
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
