import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readGitReleaseState } from './release-git.mjs';

describe('Git 릴리스 상태 읽기', () => {
  it('shell 없이 고정 인자만 쓰고 stdout 전문은 호출자가 로그로 받지 않는다', () => {
    const calls = [];
    const spawn = (command, args, options) => {
      calls.push({ command, args, options });
      return {
        status: 0,
        stdout: calls.length === 1 ? 'abcdef123456\n' : '?? secret-looking-name.txt\n',
      };
    };

    assert.deepEqual(readGitReleaseState('C:/repo', spawn), {
      commit: 'abcdef123456',
      porcelain: '?? secret-looking-name.txt',
    });
    assert.deepEqual(
      calls.map(({ command, args, options }) => ({ command, args, cwd: options.cwd, shell: options.shell })),
      [
        { command: 'git', args: ['rev-parse', '--short=12', 'HEAD'], cwd: 'C:/repo', shell: false },
        {
          command: 'git',
          args: ['status', '--porcelain=v1', '--untracked-files=normal'],
          cwd: 'C:/repo',
          shell: false,
        },
      ],
    );
  });

  it('Git 실패 세부 출력은 되뇌지 않고 고정 오류로 닫는다', () => {
    const spawn = () => ({ status: 1, stdout: '', stderr: 'private path' });
    assert.throws(
      () => readGitReleaseState('C:/repo', spawn),
      (error) => error instanceof Error && !error.message.includes('private path') && error.message.includes('Git 저장소'),
    );
  });
});
