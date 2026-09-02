// host-roundtrip.mjs 의 프레이밍 함수와 왕복 갈래 시험입니다.
//
// 여기서는 **로컬 도우미(classmate-host)를 띄우지 않습니다.** 진짜 실행 파일을 쓰는 왕복은
// `node apps/native-host/scripts/host-roundtrip.mjs` 로 사람이 직접 돌립니다.
// 이 파일이 보는 것은 두 가지입니다.
//   ① encodeFrame/decodeFrames 가 Rust 쪽 framing.rs 와 같은 규칙인지
//   ② roundTrip() 의 실패 갈래가 실제로 실패로 서는지 — 이때는 node 로 만든
//      **가짜 호스트**(-e 한 줄)를 띄웁니다. 빌드가 없어도 돌아갑니다.
//
// 실행: node --test apps/native-host/scripts/host-roundtrip.test.mjs

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HEADER_BYTES,
  MAX_MESSAGE_BYTES,
  PING_REPLY_TYPE,
  ROUNDTRIP_TIMEOUT_MS,
  decodeFrames,
  encodeFrame,
  executableCandidates,
  parseArgs,
  roundTrip,
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
    // "가" 는 UTF-8 로 3바이트입니다. 글자 수로 세면 길이가 어긋납니다.
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
    // {"text":""} 이 11바이트입니다. 나머지를 ASCII 로 채워 정확히 상한을 맞춥니다.
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
    // src/main.rs 의 respond() 가 이 이름으로 답합니다. 바뀌면 여기도 같이 바꿉니다.
    assert.equal(PING_REPLY_TYPE, 'hello');
  });
});

/**
 * node 로 만드는 가짜 호스트 한 줄입니다. 준 값을 프레임 하나로 stdout 에 씁니다.
 *
 * 여기 들어가는 문자열은 **이 시험 파일이 직접 쓴 것**이고 밖에서 받은 값이 아닙니다.
 */
function fakeHostWriting(literal) {
  return (
    `const b=Buffer.from(JSON.stringify(${literal}),'utf8');` +
    'const h=Buffer.alloc(4);h.writeUInt32LE(b.length,0);' +
    'process.stdout.write(Buffer.concat([h,b]));'
  );
}

/** 가짜 호스트를 띄워 한 번 왕복합니다. 진짜 실행 파일은 건드리지 않습니다. */
function roundTripWithFakeHost(code, options = {}) {
  return roundTrip(process.execPath, { args: ['-e', code], ...options });
}

describe('왕복 갈래', () => {
  it('프레임 하나로 hello 를 돌려주면 성공이다', () => {
    const result = roundTripWithFakeHost(fakeHostWriting("{type:'hello',host:'fake'}"));

    assert.equal(result.ok, true, result.reason ?? '');
    assert.equal(result.reply.type, PING_REPLY_TYPE);
    assert.equal(result.reason, null);
  });

  it('아무것도 안 쓰고 끝나면 프레임 개수로 세운다', () => {
    const result = roundTripWithFakeHost('process.exit(0);');

    assert.equal(result.ok, false);
    assert.match(result.reason, /응답 프레임이 0 개/);
  });

  it('0 이 아닌 종료 코드로 끝나면 그 코드를 알려 준다', () => {
    const result = roundTripWithFakeHost('process.exit(3);');

    assert.equal(result.ok, false);
    assert.match(result.reason, /3 로 끝났어요/);
  });

  it('프레임 뒤에 바이트가 남으면 세운다', () => {
    const code = `${fakeHostWriting("{type:'hello'}")}process.stdout.write(Buffer.from([1,2,3]));`;
    const result = roundTripWithFakeHost(code);

    assert.equal(result.ok, false);
    assert.match(result.reason, /3 바이트가 남았어요/);
  });

  it('type 이 hello 가 아니면 받은 응답과 함께 세운다', () => {
    const result = roundTripWithFakeHost(fakeHostWriting("{type:'goodbye'}"));

    assert.equal(result.ok, false);
    assert.equal(result.reply.type, 'goodbye');
    assert.match(result.reason, /hello/);
  });

  it('없는 실행 파일이면 실행 실패로 세운다', () => {
    const result = roundTrip('C:\\없는폴더\\classmate-host.exe');

    assert.equal(result.ok, false);
    assert.match(result.reason, /실행하지 못했어요/);
  });

  it('끝나지 않는 호스트는 상한에서 멈춰 세운다', () => {
    // 60 초를 자는 가짜 호스트입니다. 상한을 넘기면 죽이고 실패로 돌려줘야 합니다.
    const code = 'const a=new Int32Array(new SharedArrayBuffer(4));Atomics.wait(a,0,0,60000);';
    const started = Date.now();
    const result = roundTripWithFakeHost(code, { timeoutMs: 700 });

    assert.equal(result.ok, false);
    assert.match(result.reason, /700 ms 안에 끝나지 않아/);
    assert.ok(Date.now() - started < 30_000, '상한에서 돌아와야 합니다');
  });

  it('기본 상한은 15 초다', () => {
    assert.equal(ROUNDTRIP_TIMEOUT_MS, 15_000);
  });
});
