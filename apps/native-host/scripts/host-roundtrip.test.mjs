// host-roundtrip.mjs 의 프레이밍 함수 시험.
//
// 여기서는 **실행 파일을 띄우지 않는다.** 자식 프로세스를 띄우는 왕복은
// `node apps/native-host/scripts/host-roundtrip.mjs` 로 사람이 직접 돌린다.
// 이 파일이 보는 것은 encodeFrame/decodeFrames 가 Rust 쪽 framing.rs 와 같은 규칙인지다.
//
// 실행: node --test apps/native-host/scripts/host-roundtrip.test.mjs

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HEADER_BYTES,
  MAX_MESSAGE_BYTES,
  PING_REPLY_TYPE,
  decodeFrames,
  encodeFrame,
  executableCandidates,
  parseArgs,
} from './host-roundtrip.mjs';

describe('프레이밍', () => {
  it('길이 헤더는 리틀엔디언 4바이트다', () => {
    const frame = encodeFrame({});

    assert.equal(frame.length, HEADER_BYTES + 2);
    assert.deepEqual([...frame.subarray(0, HEADER_BYTES)], [0x02, 0x00, 0x00, 0x00]);
    assert.equal(frame.subarray(HEADER_BYTES).toString('utf8'), '{}');
  });

  it('쓴 것을 그대로 다시 읽는다', () => {
    const original = { type: 'ping', at: '2026-09-02T10:32:18+09:00' };
    const { frames, rest } = decodeFrames(encodeFrame(original));

    assert.deepEqual(frames, [original]);
    assert.equal(rest.length, 0);
  });

  it('여러 프레임을 순서대로 읽는다', () => {
    const originals = [{ type: 'hello' }, { type: 'event.ack', seq: 3 }, { type: 'error' }];
    const wire = Buffer.concat(originals.map(encodeFrame));

    const { frames, rest } = decodeFrames(wire);
    assert.deepEqual(frames, originals);
    assert.equal(rest.length, 0);
  });

  it('한글도 바이트 수로 세어 담는다', () => {
    // "가" 는 UTF-8 로 3바이트다. 글자 수로 세면 길이가 어긋난다.
    const frame = encodeFrame({ t: '가나다' });
    const declared = frame.readUInt32LE(0);

    assert.equal(declared, frame.length - HEADER_BYTES);
    assert.deepEqual(decodeFrames(frame).frames, [{ t: '가나다' }]);
  });

  it('덜 온 꼬리는 rest 로 남긴다', () => {
    const wire = Buffer.concat([encodeFrame({ type: 'hello' }), encodeFrame({ type: 'ping' })]);
    const cut = wire.subarray(0, wire.length - 3);

    const { frames, rest } = decodeFrames(cut);
    assert.deepEqual(frames, [{ type: 'hello' }]);
    assert.ok(rest.length > 0, '두 번째 프레임의 앞부분이 남아 있어야 한다');
  });

  it('헤더도 다 못 온 꼬리는 그대로 남긴다', () => {
    const { frames, rest } = decodeFrames(Buffer.from([0x02, 0x00]));

    assert.deepEqual(frames, []);
    assert.equal(rest.length, 2);
  });

  it('빈 바이트 뭉치는 프레임 0 개다', () => {
    const { frames, rest } = decodeFrames(Buffer.alloc(0));

    assert.deepEqual(frames, []);
    assert.equal(rest.length, 0);
  });

  it('상한을 넘는 길이를 선언하면 거절한다', () => {
    const header = Buffer.alloc(HEADER_BYTES);
    header.writeUInt32LE(MAX_MESSAGE_BYTES + 1, 0);

    assert.throws(() => decodeFrames(Buffer.concat([header, Buffer.from('{}')])), /상한/);
  });

  it('상한을 넘는 본문은 쓰지도 않는다', () => {
    const huge = { text: 'a'.repeat(MAX_MESSAGE_BYTES) };

    assert.throws(() => encodeFrame(huge), /상한/);
  });

  it('상한과 꼭 같은 본문은 통과한다', () => {
    // {"text":""} 이 11바이트다. 나머지를 ASCII 로 채워 정확히 상한을 맞춘다.
    const filler = 'a'.repeat(MAX_MESSAGE_BYTES - JSON.stringify({ text: '' }).length);
    const frame = encodeFrame({ text: filler });

    assert.equal(frame.length, HEADER_BYTES + MAX_MESSAGE_BYTES);
    assert.equal(decodeFrames(frame).frames[0].text.length, filler.length);
  });
});

describe('인자와 실행 파일 찾기', () => {
  it('--exe 를 읽고 모르는 인자는 세운다', () => {
    assert.deepEqual(parseArgs(['--exe', 'C:\\bin\\h.exe']), { exe: 'C:\\bin\\h.exe', help: false });
    assert.throws(() => parseArgs(['--nope']), /모르는 인자/);
  });

  it('CARGO_TARGET_DIR 이 있으면 그쪽을 먼저 본다', () => {
    const candidates = executableCandidates({ CARGO_TARGET_DIR: 'C:\\tmp\\_target' });

    assert.equal(candidates.length, 2);
    assert.match(candidates[0], /_target[\\/]debug[\\/]classmate-host/);
    assert.match(candidates[1], /native-host[\\/]target[\\/]debug[\\/]classmate-host/);
  });

  it('CARGO_TARGET_DIR 이 없으면 crate 안의 target 만 본다', () => {
    const candidates = executableCandidates({});

    assert.equal(candidates.length, 1);
    assert.match(candidates[0], /native-host[\\/]target[\\/]debug[\\/]classmate-host/);
  });
});

describe('계약과 맞추기', () => {
  it('ping 에 대한 응답 이름은 hello 다', () => {
    // src/main.rs 의 respond() 가 이 이름으로 답한다. 바뀌면 여기도 같이 바꾼다.
    assert.equal(PING_REPLY_TYPE, 'hello');
  });
});
