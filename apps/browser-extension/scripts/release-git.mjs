// Git 접근은 순수 release-identity.mjs 와 분리합니다. 명령과 인자는 모두 이 파일의 상수이고,
// stdout 전문은 밖으로 내보내지 않아 untracked 파일 이름이 패키지 로그에 섞이지 않습니다.

import { spawnSync } from 'node:child_process';

const COMMIT_ARGS = ['rev-parse', '--short=12', 'HEAD'];
const STATUS_ARGS = ['status', '--porcelain=v1', '--untracked-files=normal'];

function gitOutput(cwd, args, spawn) {
  const result = spawn('git', args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (result.error || result.status !== 0 || typeof result.stdout !== 'string') {
    throw new Error('Git 빌드 식별자를 읽지 못했어요. Git 저장소에서 다시 실행해 주세요.');
  }
  return result.stdout.trimEnd();
}

/** 현재 HEAD와 작업 트리 변경 유무만 읽습니다. 파일 이름과 diff 내용은 돌려주지 않습니다. */
export function readGitReleaseState(cwd, spawn = spawnSync) {
  return {
    commit: gitOutput(cwd, COMMIT_ARGS, spawn),
    porcelain: gitOutput(cwd, STATUS_ARGS, spawn),
  };
}
